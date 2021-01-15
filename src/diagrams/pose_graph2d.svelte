<script>
  import { onMount } from "svelte";
  import { onInterval } from "../utils/util.js";
  import { tweened } from "svelte/motion";
  import { fade } from "svelte/transition";
  import * as easing from "svelte/easing";
  import anime from "animejs";
  import * as gbp from "../gbp/gbp_playground.js";

  // svg
  let svg;
  let svg_width = 800;
  let svg_height = 800;

  // GBP parameters
  // var eta_damping = 0;
  let prior_std = 50;
  let meas_params = {
    "linear" : {
      "noise_model_std": 40,
      "noise_std": 2,
    },
    "nonlinear" : {
      "angle_noise_model_std": 0.5,
      "angle_noise_std": 0.4,  
      "dist_noise_model_std": 40,
      "dist_noise_std": 2,
    }
  };


  let forward_sweep = true;

  // Playground
  let graph;
  $: var_nodes = [];
  $: factor_nodes = [];
  let edges = [];

  let n_var_nodes = 5;
  let meas_model = "linear";
  let schedule = "sync";
  let bidir_sweep = true;
  let message_idx = 0;
  let last_message_idx = null;


  // Drag and drop function
  const click_time_span = 150; // Threshold for time span during click
  let mousedown_time = null;
  let click_time = null;
  let mouse_up = false;
  let moving_node = false;
  $: node_mousedown = null;
  $: node_onhover = null;
  let node_clicked = null;
  let last_node_clicked = null;
  let current_mouse_location = { x: null, y: null };

  // Message passing animation
  const clear_message_highlight_delay = 0.5;
  let pause_one_iter = false;
  let animation_in_progress = false; // set to true to prevent new input during animation
  let highlight_node = null;
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

  let update_var_node_mean;
  let update_var_node_cov;
  let update_edge_type_0;
  let messages = []; //  { message: null, timestamp: null, duration: null };

  // UI
  const time_res = 0.1; // time resolution
  let iters_per_sec = 1;
  let n_iters = 0; // this counts how many times the overall graph has completed a sweep/sync
  let iter = 0; // this counts each individual sweep
  let iter_sec = 1.0;
  let counter = 0;
  let mode = "edit";
  let passing_message = false;

  let show_belief_mean = true;
  let show_belief_cov = true;
  let show_MAP_mean = true;
  let show_MAP_cov = true;
  let show_ground_truth = true;
  let show_edges = true;

  // Visual appearance
  let factor_size = 20;
  let radius = 10;
  let mean_radius = 2;
  let can_open = false;
  let gt_color = "green";
  let belief_color = "red";
  let map_color = "blue";
  let linear_color = "orange";
  let nonlinear_color = "purple";


  onMount(() => {
    reset_playground();
  });

  onInterval(() => update_playground(), parseInt(1000 / 60));

  onInterval(() => pass_message_interval(), 1000 * time_res);


  // ************************************************************
  // Callback functions
  // ************************************************************

  function update_playground() {

    if (mode == "edit") {
      graph.update_node_id();
      graph.update_factor_node_location();
    }
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;
    update_edge();
    update_messages();
    update_message_animation();

    iter_sec = 1 / iters_per_sec;

    if (mode == "init") {
      graph.update_priors(prior_std, true);  // Update beliefs as prior std is changed with slider
      graph.update_cov_ellipses();
      graph.update_factor_noise_models(meas_params);  // Update factors as meas noise models are changed with sliders
      graph.compute_MAP();
    }
  }

  function pass_message_interval() {
    // Enables pass message in adjustable interval
    if (mode == "play" && passing_message) {
      if (counter >= iter_sec * 10 - 1 || !iter_sec) {
        counter = 0;
        if (!pause_one_iter) {
          graph.relinearize();
          pass_message();

        } else {
          pause_one_iter = false;
        }
      } else {
        counter++;
      }
    }
  }

  // ************************************************************
  // Playground templates
  // ************************************************************

  function create_empty_playground() {
    graph = new gbp.FactorGraph();

    graph.add_var_node(svg_width / 2 - 50, svg_height / 2, prior_std, 0);
    graph.add_var_node(svg_width / 2 + 50, svg_height / 2, prior_std, 1);
    graph.add_factor_node(0, 1, meas_model, meas_params, 0);

    return graph;
  }

  function create_linear_playground(n_var_nodes) {
    graph = new gbp.FactorGraph();

    let x0 = 100;
    let inc = (svg_width - 2*x0) / (n_var_nodes-1);

    graph.add_var_node(x0, svg_height / 2, prior_std, 0);
    for (let j=1; j < n_var_nodes; j++) {
      graph.add_var_node(x0 + j*inc, svg_height / 2, prior_std, 2*j);
      graph.add_factor_node(2*(j-1), 2*j, meas_model, meas_params, 2*j-1);
    }
    return graph;
  }

  function create_loop_playground(n_var_nodes = 2) {
    graph = new gbp.FactorGraph();
    for (var i = 0; i < n_var_nodes; i++) {
      if (i < 8) {
        graph.add_var_node(50 + 100 * i, 100, prior_std, i * 2);
      } else if (i < 15) {
        graph.add_var_node(750, 100 + 100 * (i - 7), prior_std, i * 2);
      } else if (i < 22) {
        graph.add_var_node(50 + 100 * (21 - i), 750, prior_std, i * 2);
      } else if (i < 28) {
        graph.add_var_node(50, 100 + 100 * (28 - i), prior_std, i * 2);
      } else {
        graph.add_var_node(svg_width * Math.random(), svg_height * Math.random(), prior_std, i * 2 );
      }
      if (i > 0) {
        graph.add_factor_node((i - 1) * 2, i * 2, meas_model, meas_params, i * 2 - 1);
      }
    }
    return graph;
  }

  function clear_playground() {
    var_nodes = [];
    factor_nodes = [];
    edges = [];
    message_idx = 0;
    passing_message = false;
    graph = create_empty_playground();
    graph.update_beliefs();
    graph.compute_MAP();
    update_playground();
    n_iters = 0;
    iter = 0;
    clear_highlight_node();
    clear_message_bubbles();
  }


  function reset_playground() {
    // console.clear();
    var_nodes = [];
    factor_nodes = [];
    edges = [];
    message_idx = 0;
    passing_message = false;
    graph = create_linear_playground(n_var_nodes);
    graph.update_beliefs();
    graph.compute_MAP();
    update_playground();
    n_iters = 0;
    iter = 0;
    clear_highlight_node();
    clear_message_bubbles();
  }

  // ************************************************************
  // Message passing functions
  // ************************************************************

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

  function sync_pass_message() {
    for (var i = 0; i < graph.factor_nodes.length; i++) {
      graph.factor_nodes[i].pass_message(graph);
    }
    for (var i = 0; i < graph.var_nodes.length; i++) {
      graph.var_nodes[i].pass_message(graph);
      graph.var_nodes[i].update_cov_ellipse();
    }
    n_iters++;
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
        n_iters++;
      } else if (
        !graph.find_node(message_idx - 1) &&
        !forward_sweep &&
        bidir_sweep
      ) {
        // backward sweeping reached 0 for bidireciton, start forward sweeping
        message_idx++;
        forward_sweep = true;
        n_iters++;
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
    iter++;
  }

  function pass_message() {
    if (schedule == "sync") {
      sync_pass_message();
    } else {
      sweep_pass_message();
    }
  }

  function update_edge() {
    edges = [];
    var id = 0;
    if (mode == "edit") {
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
        if (mode != "edit" && show_ground_truth && (show_belief_mean || show_belief_cov) ) {
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
        if (mode != "edit" && (show_belief_mean || show_belief_cov) && (show_MAP_mean || show_MAP_cov) ) {
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
        if (mode != "edit" && show_ground_truth && (show_MAP_mean || show_MAP_cov) ) {
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
      factor_node.zero_messages();
      factor_node.compute_factor();
    }
    // sync_pass_message();
    n_iters = 0;
    iter = 0;
    passing_message = false;
    message_idx = 0;
  }

  function pause_gbp() {
    passing_message = false;
  }

  // ************************************************************
  // Mouse handler functions
  // ************************************************************

  function mousedown_handler(e) {
    mousedown_time = Date.now();
    mouse_up = false;

    node_mousedown = null;
    node_mousedown = e.path.find((element) => element.classList == "node_g");

    if (node_mousedown && node_mousedown.id == "new_node") {
      graph.add_var_node(svg_width - 30, 30, prior_std);
      clear_previous_message();
      node_mousedown = graph.var_nodes[graph.var_nodes.length - 1];
    }
    else if (node_mousedown) {
      node_mousedown = graph.find_node(node_mousedown.id);
    }
  }

  function mousemove_handler(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    current_mouse_location = {
      x: e.clientX - rect.x,
      y: e.clientY - rect.y,
    };

    // Open trash can lid if hovering over it
    node_onhover = null;
    node_onhover = e.path.find((element) => element.classList == "node_g");
    if (node_onhover && moving_node && node_mousedown.type == "var_node") {
      if (node_onhover.id == "trash") {
        can_open = true;
      } else {
        can_open = false;
      }
    } else {
      can_open = false;
    }

    if (node_mousedown) {
      moving_node = true;
      if (mode == "edit") {  // If in edit mode update node gt position
        node_mousedown.x = current_mouse_location.x;
        node_mousedown.y = current_mouse_location.y;
      } else if (mode == "init") {  // If in init mode update node prior
        node_mousedown.move_node(current_mouse_location.x, current_mouse_location.y, graph, false);
        node_mousedown.update_cov_ellipse();
        graph.compute_MAP();
      }
    }
  }

  function mouseup_handler(e) {
    click_time = Date.now() - mousedown_time;
    mouse_up = true;

    if (mode == "edit") {
      let drop = false;

      node_onhover = null;
      node_onhover = e.path.find((element) => element.classList == "node_g");
      if (moving_node && node_mousedown.type == "var_node") {
        if (node_onhover) {
          if (node_onhover.id == "trash") {
            graph.remove_node(node_mousedown.id);
            graph.update_node_id();
            can_open = false;
          } else{
            drop = true;
          }
        } else {
          drop = true;
        }
      }
      
      if (drop) { // Moved variable node (not to bin)
        clear_previous_message();
        node_mousedown.move_node(node_mousedown.x, node_mousedown.y, graph);
      }
    }

    node_mousedown = null;
    moving_node = false;
  }

  function click_handler(e) {
    if (mode == "edit") {
      edit_click_handler(e);
    } else if (mode == "play") {
      play_click_handler(e);
    }
  }

  function edit_click_handler(e) {
    // Handles creating factors between variable nodes
    node_clicked = null;
    node_clicked = e.path.find((element) => element.classList == "node_g");

    if (click_time <= click_time_span && mouse_up) {
      if (node_clicked) {
        node_clicked = graph.find_node(node_clicked.id);
        if (!last_node_clicked) {  // if not in dragging mode to create factor
          last_node_clicked = node_clicked;  // Enter dragging mode
        } else {  // if in dragging mode
          if (node_clicked.type == "var_node" && last_node_clicked.type == "var_node") {
            graph.add_factor_node(last_node_clicked.id, node_clicked.id, meas_model, meas_params);
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
          last_node_clicked = null;
        }
      } else {
        last_node_clicked = null;
        clear_highlight_node();
      }
    } else {
      last_node_clicked = null;
    }
  }

  // If factors are linear they are replaced by nonlinear factors and vice-versa
  function change_meas_model(e, id = null) {
    clear_previous_message();
    graph.update_meas_model(meas_model, meas_params, id);
    clear_previous_message();
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

  function handle_mode_change() {

    clear_previous_message();
    graph.update_beliefs();

    if (mode == "edit") {
      // Reset all beliefs to be at priors and zero all messages
      graph.priors_to_gt();
    }

    if (mode != "edit") {
      graph.compute_MAP();
    }
    node_clicked = null;
    last_node_clicked = null;
    highlight_node = null;
    passing_message = false;
    n_iters = 0;
    clear_highlight_node();
    clear_message_bubbles();
  }

  function toggle_passing_message() {
    if (mode == "play") {
      passing_message = !passing_message;
    }
    if (passing_message) {
      counter = iter_sec * 10 - 1;
    }
    clear_highlight_node();
    clear_message_bubbles();
  }

  function max(list) {
    return Math.max(...list.map((sub_list) => Math.max(...sub_list)));
  }

  function min(list) {
    return Math.min(...list.map((sub_list) => Math.min(...sub_list)));
  }

</script>


<svelte:head>
	<link rel="stylesheet" href="https://unpkg.com/mono-icons@1.0.5/iconfont/icons.css" >
</svelte:head>

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


      {#if mode == "edit"}
        <g class="node_g" id={"new_node"} cursor="pointer" draggable="true">
          <circle class="var_node" cx={svg_width - 30} cy={30} r={radius}/>
        </g>
        {#if can_open}
          <rect x={svg_width - 90} y={2} width={33} height={46} fill=none/>
          <path transform="translate({svg_width - 90}, 12) scale(0.07) rotate(-20, 0, 0)" stroke="black" fill="black"d="M432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16z"></path>
          <path transform="translate({svg_width - 90}, 12) scale(0.07)"stroke="black" fill="black" d="M32 464a48 48 0 0 0 48 48h288a48 48 0 0 0 48-48V128H32zm272-256a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0z"></path>
        {:else}
          <path transform="translate({svg_width - 90}, 12) scale(0.07)"stroke="black" fill="black" d="M32 464a48 48 0 0 0 48 48h288a48 48 0 0 0 48-48V128H32zm272-256a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0z M432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16z"></path>
         {/if}
      {/if}

      <!-- Draw edges -->
      {#if show_edges}
        {#each edges as edge}
          {#if edge.type == 0 && mode == "edit"}
            <line id={"edge_type_0_"+edge.edge_id} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke="black" stroke-width="1"/>
          {/if}
          {#if edge.type == 0 && mode != "edit" && (show_belief_mean || show_belief_cov)}
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
          {#if edge.type == 1 && mode != "edit" && show_ground_truth && (show_belief_mean || show_belief_cov)}
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
          {#if edge.type == 2 && mode != "edit" && (show_MAP_mean || show_MAP_cov) && (show_belief_mean || show_belief_cov)}
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
          {#if edge.type == 3 && mode != "edit" && (show_MAP_mean || show_MAP_cov) && show_ground_truth && !(show_belief_mean || show_belief_cov)}
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
      {#if last_node_clicked && !moving_node && mode == "edit"}
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
      {#if mode == "edit"}
        {#each factor_nodes as factor_node}
          <g class="node_g" id={factor_node.id} transform="translate({factor_node.x} {factor_node.y})">
            {#if factor_node.type == "linear_factor"}
              <rect class="factor_node" x={-10} y={-10} width={factor_size} height={factor_size} stroke={linear_color}/>
            {:else}
              <rect class="factor_node" x={-10} y={-10} width={factor_size} height={factor_size} stroke={nonlinear_color}/>
            {/if}
            <text class="node_text" x={0} y={5}> {factor_node.id}</text>
          </g>
        {/each}
      {/if}



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


      <!-- Display variable nodes -->
      {#each var_nodes as var_node, i}
          {#if mode == "edit"}
            <g class="node_g" id={var_node.id} cursor="pointer" draggable="true">
              <circle class="var_node" cx={var_node.x} cy={var_node.y} r={radius}/>
              <text class="node_text" x={var_node.x} y={var_node.y + 5}> {var_node.id} </text>
            </g>
          {:else}

            {#if show_ground_truth}
              <circle cx={var_node.x} cy={var_node.y} r={mean_radius} fill={gt_color}/>
            {/if}

            {#if show_MAP_mean}
              <circle cx={var_node.MAP_ellipse.cx} cy={var_node.MAP_ellipse.cy} r={mean_radius} fill={map_color}/>
            {/if}

            {#if show_MAP_cov}
              <ellipse
                class="node_MAP_cov"
                cx={var_node.MAP_ellipse.cx}
                cy={var_node.MAP_ellipse.cy}
                rx={var_node.MAP_ellipse.rx}
                ry={var_node.MAP_ellipse.ry}
                transform="rotate({var_node.MAP_ellipse.angle}, {var_node.MAP_ellipse.cx}, {var_node.MAP_ellipse.cy})"
                stroke={map_color}
                fill="url(#MAP_cov_gradient)"
                stroke-opacity={0.5}
                fill-opacity={0} />
            {/if}

            <g class="node_g" id={var_node.id} cursor="pointer" draggable="true">
              {#if show_belief_mean}
                <circle id={"node_belief_mean_"+var_node.id} cx={var_node.belief_ellipse.cx} cy={var_node.belief_ellipse.cy} r={mean_radius} fill={belief_color}/>
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
                  stroke={belief_color}
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
                  stroke={belief_color}
                  stroke-width={2}
                  stroke-opacity={0}
                  fill={belief_color}
                  fill-opacity={0} />
              {/if}
            </g>
          {/if}
      {/each}

      {#if mode == "edit"}
        <g class="node_g" id={"trash"}>
          <rect x={svg_width - 90} y={2} width={33} height={46} opacity=0/>
        </g>
      {/if}

    </svg>
  </div>




  <div id="playground-settings-panel">

    <div style="display: inline-block;">
      {#if passing_message}
        <button class="icon-button" style="outline: none;" data-tooltip="Pause GBP" on:click={toggle_passing_message}>
          <svg class="icon" id="pause"><use xlink:href="#pauseIcon"></use></svg>
        </button>
      {:else}
        <button class="icon-button" style="outline: none;" class:not_pressable={mode != "play"} data-tooltip="Play GBP" on:click={toggle_passing_message}>
          <svg class="icon" id="play"><use xlink:href="#playIcon"></use></svg>
        </button>
      {/if}

      <button class="icon-button" style="outline: none;" data-tooltip="Reset playground" on:click={reset_playground}>
        <svg class="icon" id="reset"><use xlink:href="#resetIcon"></use></svg>
      </button>

      <button class="icon-button" style="outline: none;" data-tooltip="Clear playground" on:click={clear_playground}>
        <svg class="icon" id="remove"><use xlink:href="#removeIcon"></use></svg>
      </button>
    </div>

    <div>
      <label class="radio-inline">
        <input type="radio" bind:group={mode} value={"edit"} on:change={handle_mode_change}> Edit 
      </label>
      <i class="mi mi-arrow-right"><span class="u-sr-only">Arrow right</span></i>
      <label class="radio-inline">
        <input type="radio" bind:group={mode} value={"init"} on:change={handle_mode_change}> Set init
      </label>
      <i class="mi mi-arrow-right"><span class="u-sr-only">Arrow right</span></i>
      <label class="radio-inline">
        <input type="radio" bind:group={mode} value={"play"} on:change={handle_mode_change}> Run
      </label>    
    </div>

    <div class="boxon">

      <div>
        Factor Type:
        <br />
        <label class="radio-inline">
          <input type="radio" bind:group={meas_model} value="linear" on:change={change_meas_model}> 
          <span style="color: {linear_color}"> Linear </span>
        </label>
        <label class="radio-inline">
          <input type="radio" bind:group={meas_model} value="nonlinear" on:change={change_meas_model}>
          <span style="color: {nonlinear_color}"> Non-linear </span>

        </label>    
      </div>

      <label class="slider">
        <span> Prior std: {prior_std} </span><br>
        <input type="range" min="30" max="60" bind:value={prior_std} style="width:200px;"/><br>
      </label>

      {#if meas_model == "linear"}
        <label class="slider">
          Meas noise model std: {meas_params["linear"]["noise_model_std"]}
          <input type="range" min="30" max="50" bind:value={meas_params["linear"]["noise_model_std"]} style="width:200px;"/>
        </label>
      {:else if meas_model == "nonlinear"}
        <label class="slider">
          Angle meas noise model std: {meas_params["nonlinear"]["angle_noise_model_std"].toFixed(2)}
          <input type="range" min="0.4" max="0.6" step="0.01" bind:value={meas_params["nonlinear"]["angle_noise_model_std"]} style="width:200px;"/>
        </label>

        <label class="slider">
          Dist meas noise model std: {meas_params["nonlinear"]["dist_noise_model_std"]}
          <input type="range" min="30" max="60" bind:value={meas_params["nonlinear"]["dist_noise_model_std"]} style="width:200px;"/>
        </label>

      {/if}
      <br />

    </div>


    <div class="boxon" style="margin-top: 5px">
      <label class="slider">
        <b>Iteration {n_iters}</b> &nbsp; (iters /s: {iters_per_sec})
        <input type="range" min="1" max="10" step="0.1" bind:value={iters_per_sec} style="width:200px;"/>
      </label>
      <br />

      <span>Schedule: </span>
      <label class="radio-inline"> 
        <input type="radio" bind:group={schedule} value="sweep" on:change={pause_gbp}> Sweep
      </label>
      <label class="radio-inline">
        <input type="radio" bind:group={schedule} value="sync" on:change={pause_gbp}> Sync
      </label>
      <label class="checkbox-inline">
        <input type="checkbox" bind:checked={bidir_sweep}/> Bidir
      </label>

      <br>
      <span>Displays:</span>
      <br>

      <div style="display: inline-block;">
        <span style="color: {belief_color}"> <b>Belief:</b> </span>
        <label class="checkbox-inline">
          <input type="checkbox" bind:checked={show_belief_mean}/> Mean
        </label>
        <label class="checkbox-inline">
          <input type="checkbox" bind:checked={show_belief_cov}/> Cov
        </label>
      </div>

      <div style="display: inline-block;">
        <span style="color: {map_color}"> <b>True posterior:</b> </span>
        <label class="checkbox-inline">
          <input type="checkbox" bind:checked={show_MAP_mean}/> Mean
        </label>
        <label class="checkbox-inline">
          <input type="checkbox" bind:checked={show_MAP_cov}/> Cov
        </label>
      </div>

      <label class="checkbox-inline" style="user-select: none; color: {gt_color}}">
        <input type="checkbox" bind:checked={show_ground_truth}/> <span style="color: {gt_color}"> Ground Truth </span>
      </label>
      <br />
      <!-- <label class="checkbox-inline">
        <input type="checkbox" bind:checked={show_edges}/> Edges
      </label> -->
    </div>


    <div id="messages_div">
      {#each messages as message}
        {#if message.message}
          <p transition:fade font-size="14">{message.message}</p>
        {/if}
      {/each}
    </div>
  </div>

  <!-- <div id="playground-settings-panel">
    Difference to MAP: {belief_MAP_diff.toFixed(2)}<br>
    Energy: {belief_MAP_diff.toFixed(2)}<br>
  </div> -->

  <div id="hints-panel">

    {#if mode == "edit"} 
      <p>
        <b>Hint. </b>
        Build the pose graph by dragging variable nodes from the top right. 
        Factors are created by clicking one after the other on the two variable nodes you want to connect. 
      </p>
    {:else if mode == "init"}
      <p>
        <b>Hint. </b>
        Drag the variable nodes to set the initial beliefs.
      </p>
    {:else if mode == "play"}
      <p>
        <b>Hint. </b>
        Double click on a variable node to send messages to adjacent nodes.
      </p>
    {/if}

  </div>

</div>

