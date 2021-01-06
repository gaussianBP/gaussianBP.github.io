<script>
  import { onMount } from "svelte";
  import { tweened } from "svelte/motion";
  import { fade } from "svelte/transition";
  import * as easing from "svelte/easing";
  import * as playground from "../playground/playground.js";
  import { print } from "../playground/playground.js";
  import * as nlm from "../gbp/nonlinear_meas_fn.js";
  import { onInterval } from "../util.js";
  import * as m from "ml-matrix";
  import * as r from "random";
  import * as gauss from "../gaussian";
  import anime from "animejs";


  // GBP
  const var_prior_std = 50;
  const var_lambda = 1 / Math.pow(var_prior_std, 2);
  const linear_prior_std = 40;
  const distance_prior_std = 40;
  const angle_prior_std = 0.5;
  const linear_jac = new m.Matrix([
    [-1, 0, 1, 0],
    [0, -1, 0, 1],
  ]);
  const linear_lambda = 1 / Math.pow(linear_prior_std, 2);
  const nonlinear_lambda = new m.Matrix([
    [1 / Math.pow(angle_prior_std, 2), 0],
    [0, 1 / Math.pow(distance_prior_std, 2)],
  ]);
  const linear_noise = r.normal(0, 5);
  const nonlinear_dist_noise = r.normal(0, 5);
  const nonlinear_angle_noise = r.normal(0, 0.2);
  var eta_damping = 0;
  const new_gauss = new gauss.Gaussian(
    [[0], [0]],
    [
      [0, 0],
      [0, 0],
    ]
  );
  var use_linear_factor = false;
  var forward_sweep = true;
  var passed_message = false;
  var is_tree_graph = true;

  // svg
  var svg;
  var svg_width = 800;
  var svg_height = 800;

  // Playground
  var graph;
  var n_var_nodes = 28;
  var n_random_edges = 0;
  var sync_schedule = false;
  var bidir_sweep = true;
  var message_idx = 0;
  var last_message_idx = null;
  var total_error_distance = 0;
  var belief_MAP_diff = 0;
  var overconfidence = 0;
  var overconfident_node_num = 0;
  var last_total_error_distance = null;
  var last_belief_MAP_diff = null;
  var last_overconfidence = null;
  $: belief_MAP_diff_list = [];
  $: overconfidence_list = [];
  $: overconfident_node_num_list = [];
  $: max_belief_MAP_diff = null;
  $: max_overconfidence = null;
  $: min_belief_MAP_diff = null;

  // Drag and drop function
  const click_time_span = 100; // Threshold for time span during click
  const double_click_time_span = 350; // Threshold for time span during double click
  var mousedown_time = null;
  var click_time = null;
  var last_click_time = null;
  var mouse_up = false;
  var moving_node = false;
  $: node_mousedown = null;
  $: node_onhover = null;
  var node_clicked = null;
  var last_node_clicked = null;
  var current_mouse_location = { x: null, y: null };

  // Message passing animation
  const clear_message_highlight_delay = 0.5;
  var pause_one_iter = false;
  var animation_in_progress = false; // set to true to prevent new input during animation
  var highlight_node = null;
  $: message_bubbles = [];
  $: update_var_node = {
    node_id: null,
    old: null,
    new: null,
  };
  const message_progress = tweened(0);
  const source_progress = tweened(0);
  const target_progress = tweened(0);
  const update_var_node_cov_progress = tweened(0);

  // UI
  const time_res = 0.1; // time resolution
  var total_iter = 0; // this counts how many times the overall graph has completed a sweep/sync
  var iter = 0; // this counts each individual sweep
  var iter_sec = 1.0;
  var counter = 0;
  var edit_mode = true;
  var passing_message = false;
  var show_belief_mean = true;
  var show_belief_cov = true;
  var show_MAP_mean = true;
  var show_MAP_cov = true;
  var show_ground_truth = true;
  var show_edges = true;
  var messages = []; //  { message: null, timestamp: null, duration: null };

  var update_var_node_mean;
  var update_var_node_cov;
  var update_edge_type_0;

  $: var_nodes = [];
  $: factor_nodes = [];
  var edges = [];

  // Plots
  var plot_width = 250;
  var plot_height = 150;
  var x_margin = 20;
  var y_margin = 0;
  var plot_margin = 5;
  var y_ticks = 5;

  onMount(() => {
    reset_playground();
  });

  onInterval(() => update_playground(), parseInt(1000 / 60));

  onInterval(() => pass_message_interval(), 1000 * time_res);

  function create_new_playground(n_var_nodes = 2) {
    graph = new playground.FactorGraph();
    for (var i = 0; i < n_var_nodes; i++) {
      if (i < 8) {
        add_var_node(50 + 100 * i, 50, i * 2);
      } else if (i < 15) {
        add_var_node(750, 50 + 100 * (i - 7), i * 2);
      } else if (i < 22) {
        add_var_node(50 + 100 * (21 - i), 750, i * 2);
      } else if (i < 28) {
        add_var_node(50, 50 + 100 * (28 - i), i * 2);
      } else {
        // break;
        add_var_node(
          svg_width * Math.random(),
          svg_height * Math.random(),
          i * 2
        );
      }
      if (i > 0) {
        add_factor_node((i - 1) * 2, i * 2, i * 2 - 1);
      }
    }
    for (var i = 0; i < n_random_edges; i++) {
      //
      add_factor_node(
        graph.var_nodes[
          parseInt(Math.random() * graph.var_nodes.length - 2) + 1
        ].id,
        graph.var_nodes[
          parseInt(Math.random() * graph.var_nodes.length - 2) + 1
        ].id
      );
    }
    print(graph);
    return graph;
  }

  function reset_playground() {
    // console.clear();
    var_nodes = [];
    factor_nodes = [];
    edges = [];
    message_idx = 0;
    passing_message = false;
    passed_message = false;
    last_total_error_distance = null;
    last_belief_MAP_diff = null;
    last_overconfidence = null;
    belief_MAP_diff_list = [];
    overconfidence_list = [];
    overconfident_node_num_list = [];
    max_belief_MAP_diff = null;
    max_overconfidence = null;
    min_belief_MAP_diff = null;
    graph = create_new_playground(n_var_nodes);
    graph.compute_MAP();
    update_playground();
    sync_pass_message();
    total_iter = 0;
    iter = 0;
    clear_highlight_node();
    clear_message_bubbles();
  }

  function update_playground() {
    if (edit_mode) {
      graph.update_node_id();
      graph.update_factor_node_location();
    }
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;
    update_web_elements();
    update_edge();
    update_messages();
    update_message_animation();
  }

  function set_message_progress(source_timeout = null, target_timeout = null) {
    if (iter_sec) {
      animation_in_progress = true;
      if (!source_timeout || source_timeout > 0.5 * iter_sec) {
        source_timeout = 0.5 * iter_sec;
      }
      if (!target_timeout || target_timeout > 0.5 * iter_sec) {
        target_timeout = 0.5 * iter_sec;
      }
      source_progress.set(1, { duration: 0 });
      source_progress.set(0, {
        duration: source_timeout * 1000,
        easing: easing.sineOut,
      });
      message_progress.set(0, { duration: 0 });
      message_progress.set(1, {
        duration: iter_sec * 1000,
        easing: easing.sineOut,
      });
      target_progress.set(0, { duration: 0 });
      setTimeout(() => {
        target_progress.set(1, {
          duration: target_timeout * 1000,
          easing: easing.sineOut,
        });
      }, (iter_sec - target_timeout) * 1000);
      setTimeout(() => {
        target_progress.set(0, {
          duration: target_timeout * 1000,
          easing: easing.sineOut,
        });
      }, iter_sec * 1000);
      setTimeout(() => {
        source_progress.set(1, { duration: 0 });
        message_progress.set(0, { duration: 0 });
        animation_in_progress = false;
        clear_message_bubbles();
      }, (iter_sec + target_timeout) * 1000);
    }
  }

  function pass_message_interval() {
    // Enables pass message in adjustable interval
    if (!edit_mode && passing_message) {
      if (counter >= iter_sec * 10 - 1 || !iter_sec) {
        counter = 0;
        if (!pause_one_iter) {
          graph.relinearize();
          pass_message();
          if (belief_MAP_diff <= 0.1) {
            passing_message = false;
            print(
              belief_MAP_diff_list.map((belief_MAP_diff) => belief_MAP_diff[0])
            );
            print(
              overconfidence_list.map((overconfidence) => overconfidence[0])
            );
          }
        } else {
          pause_one_iter = false;
        }
      } else {
        counter++;
      }
    }
  }

  function sync_pass_message() {
    for (var i = 0; i < graph.factor_nodes.length; i++) {
      graph.factor_nodes[i].pass_message(graph);
    }
    for (var i = 0; i < graph.var_nodes.length; i++) {
      graph.var_nodes[i].pass_message(graph);
      graph.var_nodes[i].update_cov_ellipse();
    }
    total_error_distance = graph.compute_error();
    belief_MAP_diff = graph.compare_to_MAP();
    overconfidence = graph.compute_overconfidence();
    overconfident_node_num = graph.var_nodes.filter(
      (var_node) =>
        1 -
          (var_node.belief_ellipse.rx * var_node.belief_ellipse.ry) /
            (var_node.MAP_ellipse.rx * var_node.MAP_ellipse.ry) >
        0.005
    ).length;
    if (passed_message) {
      belief_MAP_diff_list.push([last_belief_MAP_diff, belief_MAP_diff]);
      overconfidence_list.push([last_overconfidence, overconfidence]);
      overconfident_node_num_list.push([
        overconfident_node_num,
        graph.var_nodes.length - overconfident_node_num,
      ]);
      max_belief_MAP_diff = max(belief_MAP_diff_list);
      max_overconfidence = max(overconfidence_list);
      min_belief_MAP_diff = min(belief_MAP_diff_list);
    } else {
      max_belief_MAP_diff = 0;
      max_overconfidence = 0;
      min_belief_MAP_diff = 0;
    }
    last_total_error_distance = total_error_distance;
    last_belief_MAP_diff = belief_MAP_diff;
    last_overconfidence = overconfidence;
    passed_message = true;
    total_iter++;
    iter++;
  }

  function sweep_pass_message() {
    var node = graph.find_node(message_idx);
    if (node.type == "var_node") {
      update_var_node.node_id = node.id;
      update_var_node.old = Object.assign(
        {},
        node.belief_ellipse
      );
      update_var_node_cov = anime({
        targets: "#node_belief_cov_"+update_var_node.node_id,
        cx: update_var_node.old.cx,
        cy: update_var_node.old.cy,
        rx: update_var_node.old.rx,
        ry: update_var_node.old.ry,
        rotatez: update_var_node.old.angle,
        strokeWidth:  {
          value: 1,
          duration: 0,
        },
        easing: "linear",
        duration: iter_sec * 1000,
      });
      node.pass_message(graph);
      node.update_cov_ellipse();
      update_var_node.new = Object.assign(
        {},
        node.belief_ellipse
      );
      target_progress.set(0, { duration: 0 });
      
      update_var_node_mean = anime({
        targets: "#node_belief_mean_"+update_var_node.node_id,
        cx: update_var_node.new.cx,
        cy: update_var_node.new.cy,
        easing: "linear",
        duration: iter_sec * 1000,
      });
      update_var_node_cov = anime({
        targets: "#node_belief_cov_"+update_var_node.node_id,
        cx: update_var_node.new.cx,
        cy: update_var_node.new.cy,
        rx: update_var_node.new.rx,
        ry: update_var_node.new.ry,
        rotatez: update_var_node.new.angle,
        strokeWidth:  {
          value: 2,
          duration: 0,
        },
        easing: "linear",
        duration: iter_sec * 1000,
      });
      update_var_node_cov = anime({
        targets: "#node_belief_cov_overlay_"+update_var_node.node_id,
        cx: update_var_node.new.cx,
        cy: update_var_node.new.cy,
        rx: update_var_node.new.rx,
        ry: update_var_node.new.ry,
        rotatez: update_var_node.new.angle,
        strokeOpacity:  {
          value: 1,
          duration: 0,
        },
        fillOpacity:  {
          value: 0.25,
          duration: 0,
        },
        easing: "linear",
        duration: iter_sec * 1000,
      });

      for (var i = 0; i < edges.length; i ++) {
        var edge = edges[i];
        if (edge.node1_id == update_var_node.node_id && (edge.type == 0 || edge.type == 1 || edge.type == 2)) {
          console.log(1);
          anime({
            targets: "#edge_"+edge.id,
            x1: update_var_node.new.cx,
            y1: update_var_node.new.cy,
            x2: edge.x2,
            y2: edge.y2,
            easing: "linear",
            duration: iter_sec * 1000,
          });
        }
        else if (edge.node2_id == update_var_node.node_id && edge.type == 0) {
          anime({
            targets: "#edge_"+edge.id,
            x1: edge.x1,
            y1: edge.y1,
            x2: update_var_node.new.cx,
            y2: update_var_node.new.cy,
            easing: "linear",
            duration: iter_sec * 1000,
          });
        }
      }

      update_var_node_cov_progress.set(1, {
        duration: iter_sec * 1000,
        easing: easing.sineOut,
      });
      setTimeout(() => {
        update_var_node_cov_progress.set(0, { duration: 0 });
        update_var_node = {
          node_id: null,
          old: null,
          new: null,
        };
      }, iter_sec * 1000);
      if (!iter_sec) {
        highlight_node = node;
      }
      if (graph.find_node(message_idx + 1) && (forward_sweep || !bidir_sweep)) {
        // normal forward sweeping for bidirection or unidirection
        message_idx++;
      } else if (!graph.find_node(message_idx + 1) && !bidir_sweep) {
        // go back to 0 when reaching the end for unidirection
        message_idx = 0;
        total_iter++;
      } else if (
        !graph.find_node(message_idx - 1) &&
        !forward_sweep &&
        bidir_sweep
      ) {
        // backward sweeping reached 0 for bidireciton, start forward sweeping
        message_idx++;
        forward_sweep = true;
        total_iter++;
      } else if (
        graph.find_node(message_idx - 1) &&
        !forward_sweep &&
        bidir_sweep
      ) {
        // normal backward sweeping for bidirection
        message_idx--;
      } else if (
        !graph.find_node(message_idx + 1) &&
        forward_sweep &&
        bidir_sweep
      ) {
        // forward sweeping reached the end for bidireciton, start backward sweeping
        message_idx--;
        forward_sweep = false;
      }
    } else if (
      node.type == "linear_factor" ||
      node.type == "nonlinear_factor"
    ) {
      message_idx = node.adj_ids.filter((id) => id != last_message_idx)[0];
      node.pass_message(graph, message_idx);
      if (forward_sweep) {
        var message_bubble = {
          node1_id: graph.find_node(node.adj_ids[0]).id,
          node2_id: graph.find_node(node.adj_ids[1]).id,
          node1_display: true,
          node2_display: true,
          cx1: graph.find_node(node.adj_ids[0]).belief_ellipse.cx,
          cy1: graph.find_node(node.adj_ids[0]).belief_ellipse.cy,
          rx1: graph.find_node(node.adj_ids[0]).belief_ellipse.rx,
          ry1: graph.find_node(node.adj_ids[0]).belief_ellipse.ry,
          angle1: graph.find_node(node.adj_ids[0]).belief_ellipse.angle,
          cx2: graph.find_node(node.adj_ids[1]).belief_ellipse.cx,
          cy2: graph.find_node(node.adj_ids[1]).belief_ellipse.cy,
          rx2: graph.find_node(node.adj_ids[1]).belief_ellipse.rx,
          ry2: graph.find_node(node.adj_ids[1]).belief_ellipse.ry,
          angle2: graph.find_node(node.adj_ids[1]).belief_ellipse.angle,
        };
      } else {
        var message_bubble = {
          node1_id: graph.find_node(node.adj_ids[1]).id,
          node2_id: graph.find_node(node.adj_ids[0]).id,
          node1_display: true,
          node2_display: true,
          cx1: graph.find_node(node.adj_ids[1]).belief_ellipse.cx,
          cy1: graph.find_node(node.adj_ids[1]).belief_ellipse.cy,
          rx1: graph.find_node(node.adj_ids[1]).belief_ellipse.rx,
          ry1: graph.find_node(node.adj_ids[1]).belief_ellipse.ry,
          angle1: graph.find_node(node.adj_ids[1]).belief_ellipse.angle,
          cx2: graph.find_node(node.adj_ids[0]).belief_ellipse.cx,
          cy2: graph.find_node(node.adj_ids[0]).belief_ellipse.cy,
          rx2: graph.find_node(node.adj_ids[0]).belief_ellipse.rx,
          ry2: graph.find_node(node.adj_ids[0]).belief_ellipse.ry,
          angle2: graph.find_node(node.adj_ids[0]).belief_ellipse.angle,
        };
      }
      if (iter_sec) {
        message_bubbles.push(message_bubble);
        set_message_progress(0.5, 0.5);
      }
    }
    last_message_idx = node.id;
    total_error_distance = graph.compute_error();
    belief_MAP_diff = graph.compare_to_MAP();
    overconfidence = graph.compute_overconfidence();
    overconfident_node_num = graph.var_nodes.filter(
      (var_node) =>
        var_node.MAP_ellipse.rx * var_node.MAP_ellipse.ry -
          var_node.belief_ellipse.rx * var_node.belief_ellipse.ry >
        0
    ).length;
    if (passed_message) {
      belief_MAP_diff_list.push([last_belief_MAP_diff, belief_MAP_diff]);
      overconfidence_list.push([last_overconfidence, overconfidence]);
      overconfident_node_num_list.push([
        overconfident_node_num,
        graph.var_nodes.length - overconfident_node_num,
      ]);
    }
    max_belief_MAP_diff = max(belief_MAP_diff_list);
    max_overconfidence = max(overconfidence_list);
    min_belief_MAP_diff = min(belief_MAP_diff_list);
    last_total_error_distance = total_error_distance;
    last_belief_MAP_diff = belief_MAP_diff;
    last_overconfidence = overconfidence;
    iter++;
    passed_message = true;
  }

  function pass_message() {
    if (sync_schedule) {
      sync_pass_message();
    } else {
      sweep_pass_message();
    }
  }

  function update_web_elements() {
    document.getElementById("edit_mode_radio_button").checked = edit_mode;
    document.getElementById("play_mode_radio_button").checked = !edit_mode;
    if (!edit_mode) {
      document.getElementById("edit_mode_setting_div").style.display = "none";
      document.getElementById("play_mode_setting_div").style.display = "block";
    } else {
      document.getElementById("edit_mode_setting_div").style.display = "block";
      document.getElementById("play_mode_setting_div").style.display = "none";
    }
    document.getElementById(
      "linear_factor_radio_button"
    ).checked = use_linear_factor;
    document.getElementById(
      "nonlinear_factor_radio_button"
    ).checked = !use_linear_factor;
    if (sync_schedule) {
      document.getElementById("bidir_sweep_checkbox_div").style.display =
        "none";
    } else {
      document.getElementById("bidir_sweep_checkbox_div").style.display =
        "inline-block";
    }
    if (is_tree_graph) {
      document.getElementById("sweep_mode_radio_button").disabled = false;
      document.getElementById("toggle_bidir_sweep_checkbox").disabled = false;
    } else {
      sync_schedule = true;
      bidir_sweep = false;
      document.getElementById("sweep_mode_radio_button").disabled = true;
      document.getElementById("toggle_bidir_sweep_checkbox").disabled = true;
    }
    document.getElementById("sync_mode_radio_button").checked = sync_schedule;
    document.getElementById("sweep_mode_radio_button").checked = !sync_schedule;
    document.getElementById(
      "toggle_bidir_sweep_checkbox"
    ).checked = bidir_sweep;
    if (passing_message) {
      document.getElementById("animation_speed_range").disabled = true;
    } else {
      document.getElementById("animation_speed_range").disabled = false;
    }
  }

  function update_edge() {
    edges = [];
    var id = 0;
    if (edit_mode) {
      for (var i = 0; i < graph.factor_nodes.length; i++) {
        var factor_node = graph.factor_nodes[i];
        for (var j = 0; j < factor_node.adj_ids.length; j++) {
          var var_node = graph.find_node(factor_node.adj_ids[j]);
          var edge = {
            edge_id: id,
            node1_id: var_node.id,
            node2_id: factor_node.id,
            type: 0, // type 0 is the edge between nodes
            x1: var_node.x,
            y1: var_node.y,
            x2: factor_node.x,
            y2: factor_node.y,
          };
          edges.push(edge);
          id += 1;
        }
      }
      is_tree_graph = graph.var_nodes.every(
        (var_node) => var_node.adj_ids.length <= 2
      );
    } else {
      for (var i = 0; i < graph.factor_nodes.length; i++) {
        var node1 = graph.find_node(graph.factor_nodes[i].adj_ids[0]);
        var node2 = graph.find_node(graph.factor_nodes[i].adj_ids[1]);
        // the edge between nodes
        var edge = {
          edge_id: id,
          node1_id: node1.id,
          node2_id: node2.id,
          type: 0,
          x1: node1.belief_ellipse.cx,
          y1: node1.belief_ellipse.cy,
          x2: node2.belief_ellipse.cx,
          y2: node2.belief_ellipse.cy,
        };
        edges.push(edge);
        id += 1;
      }
      for (var i = 0; i < graph.var_nodes.length; i++) {
        var var_node = graph.var_nodes[i];
        if (
          !edit_mode &&
          show_ground_truth &&
          (show_belief_mean || show_belief_cov)
        ) {
          // the edge between belief mean and ground truth in play mode
          var edge = {
            edge_id: id,
            node1_id: var_node.id,
            node2_id: var_node.id,
            type: 1,
            x1: var_node.belief_ellipse.cx,
            y1: var_node.belief_ellipse.cy,
            x2: var_node.x,
            y2: var_node.y,
          };
          edges.push(edge);
          id += 1;
        }
        if (
          !edit_mode &&
          (show_belief_mean || show_belief_cov) &&
          (show_MAP_mean || show_MAP_cov)
        ) {
          // the edge between belief mean and MAP mean in play mode
          var edge = {
            edge_id: id,
            node1_id: var_node.id,
            node2_id: var_node.id,
            type: 2,
            x1: var_node.belief_ellipse.cx,
            y1: var_node.belief_ellipse.cy,
            x2: var_node.MAP_ellipse.cx,
            y2: var_node.MAP_ellipse.cy,
          };
          edges.push(edge);
          id += 1;
        }
        if (
          !edit_mode &&
          show_ground_truth &&
          (show_MAP_mean || show_MAP_cov)
        ) {
          // the edge between MAP mean and ground truth when belief is not shown in play mode
          var edge = {
            edge_id: id,
            node1_id: var_node.id,
            node2_id: var_node.id,
            type: 3,
            x1: var_node.x,
            y1: var_node.y,
            x2: var_node.MAP_ellipse.cx,
            y2: var_node.MAP_ellipse.cy,
          };
          edges.push(edge);
          id += 1;
        }
      }
    }
  }

  function update_message_animation() {
    if (highlight_node) {
      highlight_node = graph.find_node(highlight_node.id);
    }
    if (message_bubbles) {
      for (var i = 0; i < message_bubbles.length; i++) {
        var node1 = graph.find_node(message_bubbles[i].node1_id);
        var node2 = graph.find_node(message_bubbles[i].node2_id);
        message_bubbles[i].cx1 = node1.belief_ellipse.cx;
        message_bubbles[i].cy1 = node1.belief_ellipse.cy;
        message_bubbles[i].rx1 = node1.belief_ellipse.rx;
        message_bubbles[i].ry1 = node1.belief_ellipse.ry;
        message_bubbles[i].angle1 = node1.belief_ellipse.angle;
        message_bubbles[i].cx2 = node2.belief_ellipse.cx;
        message_bubbles[i].cy2 = node2.belief_ellipse.cy;
        message_bubbles[i].rx2 = node2.belief_ellipse.rx;
        message_bubbles[i].ry2 = node2.belief_ellipse.ry;
        message_bubbles[i].angle2 = node2.belief_ellipse.angle;
      }
    }
  }

  function randomize_node_location() {
    for (var i = 0; i < graph.var_nodes.length; i++) {
      graph.var_nodes[i].x = Math.random() * (svg_width - 100) + 50;
      graph.var_nodes[i].y = Math.random() * (svg_height - 100) + 50;
    }
  }

  function add_var_node(x = 100, y = 100, id = null) {
    if (!id) {
      id = graph.var_nodes.length + graph.factor_nodes.length;
    }
    const var_node = new playground.VariableNode(2, id, x, y);
    if (id == 0) {
      var_node.prior.lam = new m.Matrix([
        [1, 0],
        [0, 1],
      ]);
    } else {
      var_node.prior.lam = new m.Matrix([
        [var_lambda, 0],
        [0, var_lambda],
      ]);
    }
    var_node.prior.eta = var_node.prior.lam.mmul(
      new m.Matrix([[var_node.x], [var_node.y]])
    );
    var_node.belief.eta = var_node.prior.eta.clone();
    var_node.belief.lam = var_node.prior.lam.clone();
    graph.var_nodes.push(var_node);
  }

  function add_factor_node(node1_id, node2_id, id = null) {
    if (use_linear_factor) {
      add_linear_factor(node1_id, node2_id, id);
    } else {
      add_nonlinear_factor(node1_id, node2_id, id);
    }
  }

  function add_linear_factor(node1_id, node2_id, id = null) {
    var node1 = graph.find_node(parseInt(node1_id));
    var node2 = graph.find_node(parseInt(node2_id));
    if (!id) {
      id = graph.var_nodes.length + graph.factor_nodes.length;
    }
    if (
      !graph.find_factor_node(node1.id, node2.id) &&
      node1.type == "var_node" &&
      node2.type == "var_node" &&
      node1.id != node2.id
    ) {
      // No existing edge between node1 and node2
      const factor_node = new playground.LinearFactor(4, id, [
        node1.id,
        node2.id,
      ]);
      factor_node.meas_noise = new m.Matrix([
        [linear_noise()],
        [linear_noise()],
      ]);
      factor_node.meas = factor_node.meas_func(
        [node1.x, node1.y],
        [node2.x, node2.y]
      );
      factor_node.meas.add(factor_node.meas_noise);
      factor_node.jacs = [linear_jac];
      factor_node.lambda = [linear_lambda];
      factor_node.adj_var_dofs = [2, 2];
      factor_node.adj_beliefs = [node1.belief, node2.belief];
      factor_node.messages = [new_gauss, new_gauss];
      factor_node.compute_factor();
      graph.factor_nodes.push(factor_node);
      node1.adj_ids.push(id);
      node2.adj_ids.push(id);
      node1.receive_message(graph);
      node2.receive_message(graph);
      return true;
    } else {
      return false;
    }
  }

  function add_nonlinear_factor(node1_id, node2_id, id = null) {
    var node1 = graph.find_node(parseInt(node1_id));
    var node2 = graph.find_node(parseInt(node2_id));
    if (!id) {
      id = graph.var_nodes.length + graph.factor_nodes.length;
    }
    if (
      !graph.find_factor_node(node1.id, node2.id) &&
      node1.type == "var_node" &&
      node2.type == "var_node" &&
      node1.id != node2.id
    ) {
      // No existing edge between node1 and node2
      if (
        node2.belief.getMean().get(0, 0) - node1.belief.getMean().get(0, 0) >=
        0
      ) {
        var meas_func = nlm.measFnR;
        var jac_func = nlm.jacFnR;
      } else {
        var meas_func = nlm.measFnL;
        var jac_func = nlm.jacFnL;
      }
      const factor_node = new playground.NonLinearFactor(
        4,
        id,
        [node1.id, node2.id],
        meas_func,
        jac_func
      );
      factor_node.meas_noise = new m.Matrix([
        [nonlinear_angle_noise()],
        [nonlinear_dist_noise()],
      ]);
      factor_node.meas = factor_node.meas_func(
        node1.belief.getMean(),
        node2.belief.getMean()
      );
      factor_node.meas.add(factor_node.meas_noise);
      // factor_node.eta_damping = eta_damping;
      factor_node.lambda = nonlinear_lambda;
      factor_node.adj_var_dofs = [2, 2];
      factor_node.adj_beliefs = [node1.belief, node2.belief];
      factor_node.messages = [new_gauss, new_gauss];
      factor_node.compute_factor();
      graph.factor_nodes.push(factor_node);
      node1.adj_ids.push(id);
      node2.adj_ids.push(id);
      node1.receive_message(graph);
      node2.receive_message(graph);
      return true;
    } else {
      return false;
    }
  }

  function clear_highlight_node() {
    highlight_node = null;
  }

  function clear_message_bubbles() {
    message_bubbles = [];
    message_progress.set(0, { duration: 0 });
  }

  function clear_previous_message() {
    for (var i = 0; i < graph.var_nodes.length; i++) {
      var var_node = graph.var_nodes[i];
      var_node.belief.lam = var_node.prior.lam.clone();
      var_node.belief.eta = var_node.prior.eta.clone();
    }
    for (var i = 0; i < graph.factor_nodes.length; i++) {
      var factor_node = graph.factor_nodes[i];
      factor_node.adj_beliefs = factor_node.adj_ids.map(
        (adj_id) => graph.find_node(adj_id).belief
      );
      factor_node.messages = [new_gauss, new_gauss];
      factor_node.compute_factor();
    }
    sync_pass_message();
    total_iter = 0;
    iter = 0;
    passed_message = false;
    passing_message = false;
    message_idx = 0;
    belief_MAP_diff_list = [];
    overconfidence_list = [];
    overconfident_node_num_list = [];
    max_belief_MAP_diff = null;
    max_overconfidence = null;
    min_belief_MAP_diff = null;
  }

  function mousedown_handler(e) {
    mouse_up = false;
    node_mousedown = null;
    node_mousedown = e.path.find((element) => element.classList == "node_g");
    mousedown_time = Date.now();
    if (node_mousedown) {
      node_mousedown = graph.find_node(node_mousedown.id);
    }
  }

  function mousemove_handler(e) {
    node_onhover = null;
    node_onhover = e.path.find((element) => element.classList == "node_g");
    const rect = e.currentTarget.getBoundingClientRect();
    current_mouse_location = {
      x: e.clientX - rect.x,
      y: e.clientY - rect.y,
    };
    if (node_mousedown && edit_mode) {
      moving_node = true;
      node_mousedown.x = current_mouse_location.x;
      node_mousedown.y = current_mouse_location.y;
    }
    if (node_onhover) {
      node_onhover = graph.find_node(node_onhover.id);
      if (node_onhover.type != "var_node") {
        node_onhover = null;
      }
    }
  }

  function mouseup_handler(e) {
    click_time = Date.now() - mousedown_time;
    if (moving_node && node_mousedown.type == "var_node") {
      clear_previous_message();
      node_mousedown.prior.eta = node_mousedown.prior.lam.mmul(
        new m.Matrix([[node_mousedown.x], [node_mousedown.y]])
      );
      node_mousedown.belief.eta = node_mousedown.prior.eta.clone();
      node_mousedown.belief.lam = node_mousedown.prior.lam.clone();
      for (var i = 0; i < node_mousedown.adj_ids.length; i++) {
        var factor_node = graph.find_node(node_mousedown.adj_ids[i]);
        factor_node.meas = factor_node.meas_func(
          graph.find_node(factor_node.adj_ids[0]).belief.getMean(),
          graph.find_node(factor_node.adj_ids[1]).belief.getMean()
        );
        factor_node.meas.add(factor_node.meas_noise);
        factor_node.adj_beliefs = factor_node.adj_ids.map(
          (adj_id) => graph.find_node(adj_id).belief
        );
        factor_node.compute_factor();
      }
    }
    node_mousedown = null;
    moving_node = false;
    mouse_up = true;
  }

  function click_handler(e) {
    if (edit_mode) {
      edit_click_handler(e);
    } else {
      play_click_handler(e);
    }
  }

  function edit_click_handler(e) {
    // TODO: Improve click algorithm
    node_clicked = null;
    node_clicked = e.path.find((element) => element.classList == "node_g");
    if (click_time <= click_time_span && mouse_up) {
      if (node_clicked) {
        node_clicked = graph.find_node(node_clicked.id);
        // Consider as a click
        if (!last_node_clicked) {
          last_node_clicked = node_clicked;
        } else {
          if (
            node_clicked.id == last_node_clicked.id &&
            Date.now() - last_click_time <= double_click_time_span
          ) {
            // Remove the node if double clicked
            graph.remove_node(node_clicked.id);
            graph.update_node_id();
            last_node_clicked = null;
          } else if (
            node_clicked.type == "var_node" &&
            last_node_clicked.type == "var_node"
          ) {
            add_factor_node(last_node_clicked.id, node_clicked.id);
            clear_previous_message();
            last_node_clicked = null;
          } else {
            last_node_clicked = node_clicked;
          }
        }
      } else {
        last_node_clicked = null;
      }
    } else {
      last_node_clicked = null;
    }
    last_click_time = Date.now();
  }

  function play_click_handler(e) {
    // TODO: Improve click algorithm
    node_clicked = null;
    node_clicked = e.path.find((element) => element.classList == "node_g");
    if (click_time <= click_time_span && mouse_up && !animation_in_progress) {
      if (node_clicked) {
        node_clicked = graph.find_node(node_clicked.id);
        // Consider as a click
        if (!last_node_clicked) {
          last_node_clicked = node_clicked;
          highlight_node = node_clicked;
        } else {
          if (node_clicked.id == last_node_clicked.id) {
            // double clicked
            update_var_node.node_id = node_clicked.id;
            update_var_node.old = Object.assign(
              {},
              node_clicked.belief_ellipse
            );
            graph.pass_message(node_clicked.id, node_clicked.id);
            node_clicked.update_cov_ellipse();
            update_var_node.new = Object.assign(
              {},
              node_clicked.belief_ellipse
            );
            if (
              Math.abs(
                update_var_node.new.angle -
                  update_var_node.old.angle
              ) >= 90
            ) {
              update_var_node.new.angle =
                90 - update_var_node.old.angle;
            }
            target_progress.set(0, { duration: 0 });
            update_var_node_cov_progress.set(1, {
              duration: clear_message_highlight_delay * 1000,
              easing: easing.sineOut,
            });
            setTimeout(() => {
              update_var_node_cov_progress.set(0, { duration: 0 });
              update_var_node = {
                node_id: null,
                old: null,
                new: null,
              };
            }, clear_message_highlight_delay * 1000);
            for (var i = 0; i < node_clicked.adj_ids.length; i++) {
              var adj_var_node = graph.find_node(
                graph
                  .find_node(node_clicked.adj_ids[i])
                  .adj_ids.filter((id) => id != node_clicked.id)[0]
              );
              var message_bubble = {
                node1_id: node_clicked.id,
                node2_id: adj_var_node.id,
                node1_display: false,
                node2_display: true,
                cx1: node_clicked.belief_ellipse.cx,
                cy1: node_clicked.belief_ellipse.cy,
                rx1: node_clicked.belief_ellipse.rx,
                ry1: node_clicked.belief_ellipse.ry,
                angle1: node_clicked.belief_ellipse.angle,
                cx2: adj_var_node.belief_ellipse.cx,
                cy2: adj_var_node.belief_ellipse.cy,
                rx2: adj_var_node.belief_ellipse.rx,
                ry2: adj_var_node.belief_ellipse.ry,
                angle2: adj_var_node.belief_ellipse.angle,
              };
              message_bubbles.push(message_bubble);
            }
            set_message_progress(
              clear_message_highlight_delay,
              clear_message_highlight_delay
            );
            clear_highlight_node();
          } else if (node_clicked.id != last_node_clicked.id) {
            clear_highlight_node();
            var message_bubble = {
              node1_id: last_node_clicked.id,
              node2_id: node_clicked.id,
              node1_display: true,
              node2_display: true,
              cx1: last_node_clicked.belief_ellipse.cx,
              cy1: last_node_clicked.belief_ellipse.cy,
              rx1: last_node_clicked.belief_ellipse.rx,
              ry1: last_node_clicked.belief_ellipse.ry,
              angle1: last_node_clicked.belief_ellipse.angle,
              cx2: node_clicked.belief_ellipse.cx,
              cy2: node_clicked.belief_ellipse.cy,
              rx2: node_clicked.belief_ellipse.rx,
              ry2: node_clicked.belief_ellipse.ry,
              angle2: node_clicked.belief_ellipse.angle,
            };
            message_bubbles.push(message_bubble);
            setTimeout(() => {
              graph.pass_message(
                message_bubble.node1_id,
                message_bubble.node2_id
              );
            }, iter_sec * 1000);
            set_message_progress(
              clear_message_highlight_delay,
              clear_message_highlight_delay
            );
          }
          total_error_distance = graph.compute_error();
          belief_MAP_diff = graph.compare_to_MAP();
          last_node_clicked = null;
        }
      } else {
        last_node_clicked = null;
        clear_highlight_node();
      }
    } else {
      last_node_clicked = null;
    }
    last_click_time = Date.now();
  }

  // If factors are linear they are replaced by nonlinear factors and vice-versa
  function replace_factor(id = null) {
    clear_previous_message();
    for (var i = 0; i < graph.factor_nodes.length; i++) {
      var factor_node = graph.factor_nodes[i];
      var node1 = graph.find_node(factor_node.adj_ids[0]);
      var node2 = graph.find_node(factor_node.adj_ids[1]);
      if (factor_node.id == id || id == null) {
        if (factor_node.type == "linear_factor") {
          if (
            node2.belief.getMean().get(0, 0) -
              node1.belief.getMean().get(0, 0) >=
            0
          ) {
            var meas_func = nlm.measFnR;
            var jac_func = nlm.jacFnR;
          } else {
            var meas_func = nlm.measFnL;
            var jac_func = nlm.jacFnL;
          }
          const new_factor_node = new playground.NonLinearFactor(
            4,
            factor_node.id,
            factor_node.adj_ids,
            meas_func,
            jac_func
          );
          new_factor_node.meas_noise = new m.Matrix([
            [nonlinear_angle_noise()],
            [nonlinear_dist_noise()],
          ]);
          new_factor_node.meas = new_factor_node.meas_func(
            node1.belief.getMean(),
            node2.belief.getMean()
          );
          new_factor_node.meas.add(new_factor_node.meas_noise);
          new_factor_node.lambda = nonlinear_lambda;
          new_factor_node.adj_var_dofs = [2, 2];
          new_factor_node.adj_beliefs = [node1.belief, node2.belief];
          new_factor_node.messages = [new_gauss, new_gauss];
          new_factor_node.compute_factor();
          graph.factor_nodes[i] = new_factor_node;
          node1.receive_message(graph);
          node2.receive_message(graph);
        } else if (factor_node.type == "nonlinear_factor") {
          const new_factor_node = new playground.LinearFactor(
            4,
            factor_node.id,
            factor_node.adj_ids
          );
          new_factor_node.meas_noise = new m.Matrix([
            [linear_noise()],
            [linear_noise()],
          ]);
          new_factor_node.meas = new_factor_node.meas_func(
            [node1.x, node1.y],
            [node2.x, node2.y]
          );
          new_factor_node.meas.add(new_factor_node.meas_noise);
          new_factor_node.jacs = [linear_jac];
          new_factor_node.lambda = [linear_lambda];
          new_factor_node.adj_var_dofs = [2, 2];
          new_factor_node.adj_beliefs = [node1.belief, node2.belief];
          new_factor_node.messages = [new_gauss, new_gauss];
          new_factor_node.compute_factor();
          graph.factor_nodes[i] = new_factor_node;
          node1.receive_message(graph);
          node2.receive_message(graph);
        }
      }
    }
    clear_previous_message();
  }

  function update_random_edges() {
    clear_previous_message();
    var random_factor_node_ids = graph.factor_nodes
      .filter(
        (factor_node) =>
          factor_node.id > graph.var_nodes[graph.var_nodes.length - 1].id
      )
      .map((factor_node) => factor_node.id);
    for (var i = 0; i < random_factor_node_ids.length; i++) {
      graph.remove_node(random_factor_node_ids[i]);
    }
    if (n_random_edges > 0) {
      for (var i = 0; i < n_random_edges; i++) {
        //
        add_factor_node(
          graph.var_nodes[
            parseInt(Math.random() * graph.var_nodes.length - 2) + 1
          ].id,
          graph.var_nodes[
            parseInt(Math.random() * graph.var_nodes.length - 2) + 1
          ].id
        );
      }
    }
  }

  function update_messages() {
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].message) {
        if (Date.now() - messages[i].timestamp >= messages[i].duration) {
          // Clear message if message has expired
          messages[i] = { message: null, timestamp: null, duration: null };
        }
      }
    }
  }

  function toggle_mode() {
    edit_mode =
      document.getElementById("edit_mode_radio_button").checked &&
      !document.getElementById("play_mode_radio_button").checked;
    if (!edit_mode) {
      if (!passed_message) {
        clear_previous_message();
        sync_pass_message();
        total_iter = 0;
      }
      graph.compute_MAP();
    }
    total_error_distance = graph.compute_error();
    belief_MAP_diff = graph.compare_to_MAP();
    node_clicked = null;
    last_node_clicked = null;
    highlight_node = null;
    passing_message = false;
    total_iter = 0;
    clear_highlight_node();
    clear_message_bubbles();
  }

  function click_add_var_node() {
    add_var_node();
    clear_previous_message();
  }

  function toggle_passing_message() {
    passing_message = !passing_message;
    if (passing_message) {
      counter = iter_sec * 10 - 1;
    }
    clear_highlight_node();
    clear_message_bubbles();
  }

  function toggle_factor() {
    use_linear_factor =
      document.getElementById("linear_factor_radio_button").checked &&
      !document.getElementById("nonlinear_factor_radio_button").checked;
    replace_factor();
  }

  function toggle_schedule() {
    sync_schedule =
      document.getElementById("sync_mode_radio_button").checked &&
      !document.getElementById("sweep_mode_radio_button").checked;
  }

  function toggle_bidir_sweep() {
    if (!sync_schedule) {
      bidir_sweep = document.getElementById("toggle_bidir_sweep_checkbox")
        .checked;
    }
  }

  function max(list) {
    return Math.max(...list.map((sub_list) => Math.max(...sub_list)));
  }

  function min(list) {
    return Math.min(...list.map((sub_list) => Math.min(...sub_list)));
  }

  function print_graph_detail() {
    print(graph);
  }

  function openCity(evt, cityName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(cityName).style.display = "block";
    evt.currentTarget.className += " active";
  }


</script>

<style>
  svg {
    width: 100%;
    height: 100%;
    float: left;
  }
</style>

<svelte:window />


<div class="demo-container">
  <div id="playground-container">
    <svg
      bind:this={svg}
      width={svg_width}
      height={svg_height}
      on:mousedown={mousedown_handler}
      on:mousemove={mousemove_handler}
      on:mouseup={mouseup_handler}
      on:click={click_handler}>
      <defs>
        <radialGradient id="belief_cov_gradient">
          <stop offset="0.35" stop-color="red" stop-opacity="0.5" />
          <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
        </radialGradient>
        <radialGradient id="MAP_cov_gradient">
          <stop offset="0.35" stop-color="blue" stop-opacity="0.5" />
          <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
        </radialGradient>
      </defs>

      <!-- Draw bar for scale if in play mode -->
      {#if !edit_mode}
        <line x1={19} x2={121} y1={20} y2={20} stroke="black" stroke-width={1} />
        <line x1={20} x2={20} y1={20} y2={25} stroke="black" stroke-width={1} />
        <line x1={70} x2={70} y1={20} y2={25} stroke="black" stroke-width={1} />
        <line x1={120} x2={120} y1={20} y2={25} stroke="black" stroke-width={1} />
        <text x={70} y={15} text-anchor="middle" stroke="black" stroke-width={0.5} font-size={10} style="user-select: none"> 
          1 unit
        </text>
      {/if}

      <!-- Draw edges -->
      {#if show_edges}
        {#each edges as edge}
          {#if edge.type == 0 && edit_mode}
            <line
              id={"edge_type_0_"+edge.edge_id}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="black"
              stroke-width="1" />
          {/if}
          {#if edge.type == 0 && !edit_mode && (show_belief_mean || show_belief_cov)}
            <!-- {#if edge.node1_id == update_var_node.node_id && iter_sec}
              <line
                x1={update_var_node.new.cx * $update_var_node_cov_progress + update_var_node.old.cx * (1 - $update_var_node_cov_progress)}
                y1={update_var_node.new.cy * $update_var_node_cov_progress + update_var_node.old.cy * (1 - $update_var_node_cov_progress)}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5" />
            {/if}
            {#if edge.node2_id == update_var_node.node_id && iter_sec}
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={update_var_node.new.cx * $update_var_node_cov_progress + update_var_node.old.cx * (1 - $update_var_node_cov_progress)}
                y2={update_var_node.new.cy * $update_var_node_cov_progress + update_var_node.old.cy * (1 - $update_var_node_cov_progress)}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5" />
            {/if} -->
            {#if edge.node1_id == update_var_node.node_id && iter_sec}
              <line
                x1={update_var_node.old.cx}
                y1={update_var_node.old.cy}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5" />
            {/if}
            {#if edge.node2_id == update_var_node.node_id && iter_sec}
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={update_var_node.old.cx}
                y2={update_var_node.old.cy}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5" />
            {/if}
            {#if edge.node1_id != update_var_node.node_id && edge.node2_id != update_var_node.node_id}
              <line
                id={"edge_"+edge.edge_id}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5" />
            {/if}
          {/if}
          {#if edge.type == 1 && !edit_mode && show_ground_truth && (show_belief_mean || show_belief_cov)}
            <!-- {#if edge.node1_id == update_var_node.node_id && iter_sec}
              <line
                x1={update_var_node.new.cx * $update_var_node_cov_progress + update_var_node.old.cx * (1 - $update_var_node_cov_progress)}
                y1={update_var_node.new.cy * $update_var_node_cov_progress + update_var_node.old.cy * (1 - $update_var_node_cov_progress)}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5"
                stroke-dasharray="2, 4" />
            {:else} -->
              <line
                id={"edge_"+edge.edge_id}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5"
                stroke-dasharray="2, 4" />
            <!-- {/if} -->
          {/if}
          {#if edge.type == 2 && !edit_mode && (show_MAP_mean || show_MAP_cov) && (show_belief_mean || show_belief_cov)}
            <!-- {#if edge.node1_id == update_var_node.node_id && iter_sec}
              <line
                x1={update_var_node.new.cx * $update_var_node_cov_progress + update_var_node.old.cx * (1 - $update_var_node_cov_progress)}
                y1={update_var_node.new.cy * $update_var_node_cov_progress + update_var_node.old.cy * (1 - $update_var_node_cov_progress)}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5"
                stroke-dasharray="2, 4" />
            {:else} -->
              <line
                id={"edge_"+edge.edge_id}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5"
                stroke-dasharray="2, 4" />
            <!-- {/if} -->
          {/if}
          {#if edge.type == 3 && !edit_mode && (show_MAP_mean || show_MAP_cov) && show_ground_truth && !(show_belief_mean || show_belief_cov)}
            <line
              id={"edge_"+edge.edge_id}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="black"
              stroke-width="1"
              stroke-opacity="0.5"
              stroke-dasharray="2, 4" />
          {/if}
        {/each}
      {/if}
      {#if last_node_clicked && !moving_node && edit_mode}
        {#if last_node_clicked.type == 'var_node'}
          <line
            x1={last_node_clicked.x}
            y1={last_node_clicked.y}
            x2={current_mouse_location.x}
            y2={current_mouse_location.y}
            stroke="black"
            stroke-width="1" />
        {/if}
      {/if}

      <!-- Display factors -->
      {#if edit_mode}
        {#each factor_nodes as factor_node}
          <g
            class="node_g"
            id={"factor_node_"+factor_node.id}
            transform="translate({factor_node.x}
            {factor_node.y})">
            {#if factor_node.type == 'linear_factor'}
              <rect
                class="node"
                x={-10}
                y={-10}
                width={20}
                height={20}
                stroke="blue"
                fill="white"
                fill-opacity={1.0} />
            {:else}
              <rect
                class="node"
                x={-10}
                y={-10}
                width={20}
                height={20}
                stroke="purple"
                fill="white"
                fill-opacity={1.0} />
            {/if}
            <text
              class="node_id"
              x={0}
              y={5}
              text-anchor="middle"
              stroke="black"
              font-size={12}
              style="user-select: none">
              {factor_node.id}
            </text>
          </g>
        {/each}
      {/if}

      <!-- Display variable nodes -->
      {#each var_nodes as var_node, i}
        {#if edit_mode}
          <circle
            class="node"
            cx={var_node.x}
            cy={var_node.y}
            r={10}
            stroke="red"
            fill="white"
            fill-opacity={1.0} />
          <text
            class="node_text"
            x={var_node.x}
            y={var_node.y + 5}
            text-anchor="middle"
            stroke="black"
            font-size={12}
            style="user-select: none">
            {var_node.id}
          </text>
        {:else}
          {#if show_MAP_cov}
            <ellipse
              class="node_MAP_cov"
              cx={var_node.MAP_ellipse.cx}
              cy={var_node.MAP_ellipse.cy}
              rx={var_node.MAP_ellipse.rx}
              ry={var_node.MAP_ellipse.ry}
              transform="rotate({var_node.MAP_ellipse.angle}, {var_node.MAP_ellipse.cx}, {var_node.MAP_ellipse.cy})"
              stroke="blue"
              fill="url(#MAP_cov_gradient)"
              stroke-opacity={0.5}
              fill-opacity={0} />
          {/if}
          {#if show_belief_cov}
            <ellipse
              class="node_belief_cov"
              id={"node_belief_cov_"+var_node.id}
              cx={var_node.belief_ellipse.cx}
              cy={var_node.belief_ellipse.cy}
              rx={var_node.belief_ellipse.rx}
              ry={var_node.belief_ellipse.ry}
              transform="rotate({var_node.belief_ellipse.angle}, {var_node.belief_ellipse.cx}, {var_node.belief_ellipse.cy})"
              stroke="red"
              fill="url(#belief_cov_gradient)"
              stroke-opacity={0.75} />
            <ellipse
              class="node_belief_cov"
              id={"node_belief_cov_overlay_"+var_node.id}
              cx={var_node.belief_ellipse.cx}
              cy={var_node.belief_ellipse.cy}
              rx={var_node.belief_ellipse.rx}
              ry={var_node.belief_ellipse.ry}
              transform="rotate({var_node.belief_ellipse.angle}, {var_node.belief_ellipse.cx}, {var_node.belief_ellipse.cy})"
              stroke="red"
              stroke-width={2}
              stroke-opacity={0}
              fill="red"
              fill-opacity={0} />
          {/if}
          {#if show_MAP_mean}
            <circle
              class="node_MAP_mean"
              cx={var_node.MAP_ellipse.cx}
              cy={var_node.MAP_ellipse.cy}
              r={2}
              stroke="blue"
              fill="blue"
              stroke-opacity={1}
              fill-opacity={1} />
          {/if}
          {#if show_belief_mean}
            <circle
              class="node_belief_mean"
              id={"node_belief_mean_"+var_node.id}
              cx={var_node.belief_ellipse.cx}
              cy={var_node.belief_ellipse.cy}
              r={2}
              stroke="red"
              fill="red"
              stroke-opacity={1}
              fill-opacity={1} />
          {/if}
          {#if show_ground_truth}
            <circle
              class="node_ground_truth"
              cx={var_node.x}
              cy={var_node.y}
              r={2}
              stroke="green"
              fill="green"
              stroke-opacity={1}
              fill-opacity={1} />
          {/if}
        {/if}
      {/each}

      <!-- Display message bubbles -->
      {#if message_bubbles && iter_sec}
        {#each message_bubbles as message_bubble}
          {#if $source_progress && show_belief_cov && message_bubble.node1_display}
            <ellipse
              cx={message_bubble.cx1}
              cy={message_bubble.cy1}
              rx={message_bubble.rx1}
              ry={message_bubble.ry1}
              transform="rotate({message_bubble.angle1}, {message_bubble.cx1}, {message_bubble.cy1})"
              stroke="red"
              stroke-width={2}
              stroke-opacity={$source_progress}
              fill="red"
              fill-opacity={0.25 * $source_progress} />
          {/if}
          {#if $target_progress && show_belief_cov && message_bubble.node2_display}
            <ellipse
              cx={message_bubble.cx2}
              cy={message_bubble.cy2}
              rx={message_bubble.rx2}
              ry={message_bubble.ry2}
              transform="rotate({message_bubble.angle2}, {message_bubble.cx2}, {message_bubble.cy2})"
              stroke="red"
              stroke-width={2}
              stroke-opacity={$target_progress}
              fill="red"
              fill-opacity={0.25 * $target_progress} />
          {/if}
          <circle
            class="message_bubble"
            cx={message_bubble.cx1 + (message_bubble.cx2 - message_bubble.cx1) * $message_progress}
            cy={message_bubble.cy1 + (message_bubble.cy2 - message_bubble.cy1) * $message_progress}
            r={5}
            stroke="red"
            fill="red"
            opacity={1 - 4 * ($message_progress - 0.5) * ($message_progress - 0.5)} />
        {/each}
      {/if}

      
      {#if highlight_node}
        {#if show_belief_cov}
          <ellipse
            cx={highlight_node.belief_ellipse.cx}
            cy={highlight_node.belief_ellipse.cy}
            rx={highlight_node.belief_ellipse.rx}
            ry={highlight_node.belief_ellipse.ry}
            transform="rotate({highlight_node.belief_ellipse.angle}, {highlight_node.belief_ellipse.cx}, {highlight_node.belief_ellipse.cy})"
            stroke="red"
            stroke-width={2}
            fill="red"
            fill-opacity={0.25} />
        {:else}
          <circle
            class="node_MAP_mean"
            cx={highlight_node.belief_ellipse.cx}
            cy={highlight_node.belief_ellipse.cy}
            r={5}
            stroke="red"
            fill="red" />
        {/if}
      {/if}
      {#each var_nodes as var_node}
        <!-- always display on top of everything else for user interaction -->
        <g class="node_g" id={var_node.id} cursor="pointer" draggable="true">
          {#if edit_mode}
            <circle
              class="node"
              cx={var_node.x}
              cy={var_node.y}
              r={10}
              stroke="red"
              stroke-opacity={0}
              fill="red"
              fill-opacity={0} />
          {:else}
            {#if show_belief_cov}
              <ellipse
                cx={var_node.belief_ellipse.cx}
                cy={var_node.belief_ellipse.cy}
                rx={var_node.belief_ellipse.rx}
                ry={var_node.belief_ellipse.ry}
                transform="rotate({var_node.belief_ellipse.angle}, {var_node.belief_ellipse.cx}, {var_node.belief_ellipse.cy})"
                stroke="red"
                stroke-width={0}
                fill="red"
                fill-opacity={0} />
            {/if}
            {#if show_belief_mean}
              <circle
                class="node"
                cx={var_node.belief_ellipse.cx}
                cy={var_node.belief_ellipse.cy}
                r={10}
                stroke="red"
                stroke-opacity={0}
                fill="red"
                fill-opacity={0} />
            {/if}
          {/if}
        </g>
      {/each}
    </svg>
  </div>

  <div id="playground-settings-panel" style="user-select: none">
    <div id="playground_info_div">
      <b>Iterations: {total_iter}</b>
      <br />
      {#if total_error_distance < 1}
        <b>Total Error: {parseInt(total_error_distance * 100) / 100}</b>
      {:else}<b>Total Error: {parseInt(total_error_distance)}</b>{/if}
      <br />
      {#if node_onhover && !edit_mode}
        {#if node_onhover.type == 'var_node' && passed_message}
          <b>Node id: {node_onhover.id}</b>
          <br />
          <b>Difference to MAP:
            {parseInt(Math.sqrt(Math.pow(node_onhover.belief_ellipse.cx - node_onhover.MAP_ellipse.cx, 2) + Math.pow(node_onhover.belief_ellipse.cy - node_onhover.MAP_ellipse.cy, 2)) * 100) / 100}</b>
          <br />
          <b>Overconfidence:
            {parseInt(node_onhover.overconfidence * 10000) / 100}
            %</b>
        {/if}
      {:else}
        <b>Graph Overall</b>
        <br />
        {#if belief_MAP_diff < 1}
          <b>Difference to MAP: {parseInt(belief_MAP_diff * 100) / 100}</b>
        {:else}<b>Difference to MAP: {parseInt(belief_MAP_diff)}</b>{/if}
        <!-- <br />
        <b>Overconfidence: {parseInt(overconfidence * 10000) / 100} %</b>
        <b>Overconfident Node: {overconfident_node_num}</b> -->
      {/if}
      <br />
    </div>
    <div id="playground_setting_div">
      <label class="radio-inline">
        <input
          type="radio"
          id="edit_mode_radio_button"
          name="toggle_mode_radio_button"
          on:change={toggle_mode} />
        Edit Mode
      </label>
      <label class="radio-inline">
        <input
          type="radio"
          id="play_mode_radio_button"
          name="toggle_mode_radio_button"
          on:change={toggle_mode} />
        Play Mode
      </label>
      <div style="display: inline-block;">
        {#if edit_mode}
          <label>
            <button
              type="button"
              class="btn"
              on:click={click_add_var_node}
              style="width:200px; border:2px solid black">
              Add Variable Node
            </button>
          </label>
        {:else if passing_message}
          <label>
            <button
              type="button"
              class="btn"
              on:click={toggle_passing_message}
              style="width:200px; border:2px solid black">
              Pause
            </button>
          </label>
        {:else}
          <label>
            <button
              type="button"
              class="btn"
              on:click={toggle_passing_message}
              style="width:200px; border:2px solid black">
              Start Message Passing
            </button>
          </label>
        {/if}
        <br />
        {#if total_iter > 0}
          <label>
            <button
              type="button"
              class="btn"
              on:click={clear_previous_message}
              style="width:98px; border:2px solid black">
              Clear
            </button>
          </label>
        {:else}
          <label>
            <button
              type="button"
              class="btn"
              on:click={reset_playground}
              style="width:98px; border:2px solid black">
              Reset
            </button>
          </label>
        {/if}
        <label>
          <button
            type="button"
            class="btn"
            on:click={print_graph_detail}
            style="width:98px; border:2px solid black">
            Details
          </button>
        </label>
      </div>
    </div>
    <div id="edit_mode_setting_div" style="display: block;">
      <label class="range-inline">
        Random Edges:
        <b>{n_random_edges}</b>
        <input
          type="range"
          id="animation_speed_range"
          min="0"
          max="50"
          step={1}
          bind:value={n_random_edges}
          on:change={update_random_edges}
          style="width:200px;" />
      </label>
      <br />
      <div style="display: inline-block;">
        Factor Type:
        <br />
        <label class="radio-inline" style="color: blue">
          <input
            type="radio"
            id="linear_factor_radio_button"
            name="toggle_factor_type_radio_button"
            on:change={toggle_factor} />
          Linear
        </label>
        <label class="radio-inline" style="color: purple">
          <input
            type="radio"
            id="nonlinear_factor_radio_button"
            name="toggle_factor_type_radio_button"
            on:change={toggle_factor} />
          Nonlinear
        </label>
      </div>
    </div>
    <div id="play_mode_setting_div" style="display: none;">
      <label class="range-inline">
        Animation Speed:
        <b>{iter_sec}</b>
        <input
          type="range"
          id="animation_speed_range"
          min="0"
          max="5"
          step={time_res}
          bind:value={iter_sec}
          style="width:200px;" />
      </label>
      <br />
      <div style="display: inline-block;">
        Message Passing Schedule:
        <br />
        <label class="radio-inline">
          <input
            type="radio"
            id="sync_mode_radio_button"
            name="toggle_schedule_radio_button"
            on:click={toggle_schedule} />
          Sync
        </label>
        <label class="radio-inline">
          <input
            type="radio"
            id="sweep_mode_radio_button"
            name="toggle_schedule_radio_button"
            on:click={toggle_schedule} />
          Sweep
        </label>
        <div id="bidir_sweep_checkbox_div">
          <label class="checkbox-inline">
            <input
              type="checkbox"
              id="toggle_bidir_sweep_checkbox"
              on:click={toggle_bidir_sweep} />
            Bidir
          </label>
        </div>
      </div>
      <div style="display: inline-block;">
        <span style="color: red"> <b>Belief:</b> </span>
        <label class="checkbox-inline">
          <input
            type="checkbox"
            id="toggle_belief_mean_checkbox"
            bind:checked={show_belief_mean} />
          Mean
        </label>
        <label class="checkbox-inline">
          <input
            type="checkbox"
            id="toggle_belief_cov_checkbox"
            bind:checked={show_belief_cov} />
          Cov
        </label>
      </div>
      <div style="display: inline-block;">
        <span style="color: blue"> <b>MAP:</b> </span>
        <label class="checkbox-inline">
          <input
            type="checkbox"
            id="toggle_MAP_mean_checkbox"
            bind:checked={show_MAP_mean} />
          Mean
        </label>
        <label class="checkbox-inline">
          <input
            type="checkbox"
            id="toggle_MAP_cov_checkbox"
            bind:checked={show_MAP_cov} />
          Cov
        </label>
      </div>
      <br />
      <div style="display: inline-block;">
        <label class="checkbox-inline" style="user-select: none; color: green">
          <input
            type="checkbox"
            id="toggle_ground_truth_checkbox"
            bind:checked={show_ground_truth} />
          <b>Ground Truth</b>
        </label>
      </div>
      <br />
      <label class="checkbox-inline">
        <input
          type="checkbox"
          id="toggle_edges_checkbox"
          bind:checked={show_edges} />
        Edges
      </label>
    </div>
    <div id="messages_div">
      {#each messages as message}
        {#if message.message}
          <p transition:fade font-size="14">{message.message}</p>
        {/if}
      {/each}
    </div>
  </div>
</div>

<div id="plot_container">
  <div class="plot_div">
    <div class="plot_svg">
      <svg style="background-color: white;">
        <line
          x1={0 + x_margin}
          x2={plot_width + x_margin}
          y1={plot_height + y_margin}
          y2={plot_height + y_margin}
          stroke="black"
          stroke-width={1.5} />
        <line
          x1={0 + x_margin}
          x2={0 + x_margin}
          y1={0 + y_margin}
          y2={plot_height + y_margin}
          stroke="black"
          stroke-width={1.5} />
        <text
          x={10}
          y={plot_height / 2 + y_margin}
          text-anchor="middle"
          stroke="black"
          stroke-width={0.25}
          font-size={10}
          style="user-select: none; writing-mode: vertical-rl; text-orientation: mixed;">
          Difference to MAP
        </text>
        <text
          x={plot_width / 2 + x_margin}
          y={plot_height + y_margin + 15}
          text-anchor="middle"
          stroke="black"
          stroke-width={0.25}
          font-size={10}
          style="user-select: none">
          Iterations
        </text>
        {#if passed_message}
          {#each Array(y_ticks + 1) as _, i}
            <line
              x1={x_margin}
              x2={plot_width + x_margin}
              y1={((plot_height - plot_margin) * i) / y_ticks + plot_margin + y_margin}
              y2={((plot_height - plot_margin) * i) / y_ticks + plot_margin + y_margin}
              stroke="black"
              stroke-width="0.5"
              stroke-opacity="0.5"
              stroke-dasharray="2, 4" />
            <text
              x={2 + x_margin}
              y={((plot_height - 2 * plot_margin) * i) / y_ticks + plot_margin + y_margin + 2}
              text-anchor="left"
              stroke="black"
              opacity={0.75}
              stroke-width={0.25}
              font-size={10}
              style="user-select: none">
              {parseInt(((max_belief_MAP_diff * (y_ticks - i)) / y_ticks) * 100) / 100}
            </text>
          {/each}
          {#each belief_MAP_diff_list as diff, i}
            <line
              x1={((plot_width - 2 * plot_margin) * i) / (iter + 1) + plot_margin + x_margin}
              x2={((plot_width - 2 * plot_margin) * (i + 1)) / (iter + 1) + plot_margin + x_margin}
              y1={(plot_height - plot_margin) * (1 - diff[0] / (max_belief_MAP_diff + 0.01)) + plot_margin + y_margin}
              y2={(plot_height - plot_margin) * (1 - diff[1] / (max_belief_MAP_diff + 0.01)) + plot_margin + y_margin}
              stroke="red"
              stroke-width={1} />
          {/each}
        {/if}
      </svg>
    </div>
  </div>

  <!-- <div class="plot_div">
    <div class="plot_svg">
      <svg style="background-color: white;">
        <line
          x1={0 + x_margin}
          x2={plot_width + x_margin}
          y1={plot_height + y_margin}
          y2={plot_height + y_margin}
          stroke="black"
          stroke-width={1.5} />
        <line
          x1={0 + x_margin}
          x2={0 + x_margin}
          y1={0 + y_margin}
          y2={plot_height + y_margin}
          stroke="black"
          stroke-width={1.5} />
        <text
          x={10}
          y={plot_height / 2 + y_margin}
          text-anchor="middle"
          stroke="black"
          stroke-width={0.25}
          font-size={10}
          style="user-select: none; writing-mode: vertical-rl; text-orientation: mixed;">
          Overconfidence
        </text>
        <text
          x={plot_width / 2 + x_margin}
          y={plot_height + y_margin + 15}
          text-anchor="middle"
          stroke="black"
          stroke-width={0.25}
          font-size={10}
          style="user-select: none">
          Iterations
        </text>
        {#if passed_message}
          {#each Array(y_ticks + 1) as _, i}
            <line
              x1={x_margin}
              x2={plot_width + x_margin}
              y1={((plot_height - plot_margin) * i) / y_ticks + plot_margin + y_margin}
              y2={((plot_height - plot_margin) * i) / y_ticks + plot_margin + y_margin}
              stroke="black"
              stroke-width="0.5"
              stroke-opacity="0.5"
              stroke-dasharray="2, 4" />
            <text
              x={2 + x_margin}
              y={((plot_height - 2 * plot_margin) * i) / y_ticks + plot_margin + y_margin + 2}
              text-anchor="left"
              stroke="black"
              opacity={0.75}
              stroke-width={0.25}
              font-size={10}
              style="user-select: none">
              {parseInt(((max_overconfidence * (y_ticks - i)) / y_ticks) * 10000) / 100}
              %
            </text>
          {/each}
          {#each overconfidence_list as overconfidence, i}
            <line
              x1={((plot_width - 2 * plot_margin) * i) / (iter + 1) + plot_margin + x_margin}
              x2={((plot_width - 2 * plot_margin) * (i + 1)) / (iter + 1) + plot_margin + x_margin}
              y1={(plot_height - plot_margin) * (1 - overconfidence[0] / (max_overconfidence + 0.0001)) + plot_margin + y_margin}
              y2={(plot_height - plot_margin) * (1 - overconfidence[1] / (max_overconfidence + 0.0001)) + plot_margin + y_margin}
              stroke="red"
              stroke-width={1} />
          {/each}
        {/if}
      </svg>
    </div>
  </div>

  <div class="plot_div">
    <div class="plot_svg">
      <svg style="background-color: white;">
        <line
          x1={0 + x_margin}
          x2={plot_width + x_margin}
          y1={plot_height / 2 + y_margin}
          y2={plot_height / 2 + y_margin}
          stroke="black"
          stroke-width={1.5} />
        <line
          x1={0 + x_margin}
          x2={0 + x_margin}
          y1={0 + y_margin}
          y2={plot_height + y_margin}
          stroke="black"
          stroke-width={1.5} />
        <text
          x={10}
          y={plot_height / 2 + y_margin}
          text-anchor="middle"
          stroke="black"
          stroke-width={0.25}
          font-size={10}
          style="user-select: none; writing-mode: vertical-rl; text-orientation: mixed;">
          Under/Overconfident Node Num
        </text>
        <text
          x={plot_width + x_margin - 40}
          y={plot_height + y_margin - 5}
          text-anchor="middle"
          stroke="black"
          stroke-width={0.25}
          font-size={10}>
          Underconfident
        </text>
        <text
          x={plot_width + x_margin - 40}
          y={y_margin + 10}
          text-anchor="middle"
          stroke="black"
          stroke-width={0.25}
          font-size={10}>
          Overconfident
        </text>
        <text
          x={plot_width / 2 + x_margin}
          y={plot_height + y_margin + 15}
          text-anchor="middle"
          stroke="black"
          stroke-width={0.25}
          font-size={10}
          style="user-select: none">
          Iterations
        </text>
        {#if passed_message}
          {#each Array(y_ticks + 1) as _, i}
            <line
              x1={x_margin}
              x2={plot_width + x_margin}
              y1={((plot_height - 2 * plot_margin) * i) / y_ticks + plot_margin + y_margin}
              y2={((plot_height - 2 * plot_margin) * i) / y_ticks + plot_margin + y_margin}
              stroke="black"
              stroke-width="0.5"
              stroke-opacity="0.5"
              stroke-dasharray="2, 4" />
            {#if ((plot_height - 2 * plot_margin) * i) / y_ticks + plot_margin < plot_height / 2}
              <text
                x={2 + x_margin}
                y={((plot_height - 2 * plot_margin) * i) / y_ticks + plot_margin + y_margin + 2}
                text-anchor="left"
                stroke="black"
                opacity={0.75}
                stroke-width={0.25}
                font-size={10}
                style="user-select: none">
                {parseInt((graph.var_nodes.length * (y_ticks - i * 2)) / y_ticks)}
              </text>
            {:else}
              <text
                x={2 + x_margin}
                y={((plot_height - 2 * plot_margin) * i) / y_ticks + plot_margin + y_margin + 2}
                text-anchor="left"
                stroke="black"
                opacity={0.75}
                stroke-width={0.25}
                font-size={10}
                style="user-select: none">
                {parseInt((graph.var_nodes.length * i * 2) / y_ticks) - graph.var_nodes.length}
              </text>
            {/if}
          {/each}
          {#each overconfident_node_num_list as overconfidence_node_num, i}
            <line
              x1={((plot_width - 2 * plot_margin) * (i + 1)) / (iter + 1) + plot_margin + x_margin}
              x2={((plot_width - 2 * plot_margin) * (i + 1)) / (iter + 1) + plot_margin + x_margin}
              y1={plot_height / 2 + y_margin}
              y2={(plot_height / 2 - plot_margin) * (1 - overconfidence_node_num[0] / graph.var_nodes.length) + plot_margin + y_margin}
              stroke="red"
              stroke-width={2} />
            <line
              x1={((plot_width - 2 * plot_margin) * (i + 1)) / (iter + 1) + plot_margin + x_margin}
              x2={((plot_width - 2 * plot_margin) * (i + 1)) / (iter + 1) + plot_margin + x_margin}
              y1={plot_height / 2 + y_margin}
              y2={(plot_height / 2 - plot_margin) * (1 + overconfidence_node_num[1] / graph.var_nodes.length) + plot_margin + y_margin}
              stroke="blue"
              stroke-width={2} />
          {/each}
        {/if}
      </svg>
    </div>
  </div> -->

</div>
