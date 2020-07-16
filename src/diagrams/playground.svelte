<script>
  import { onMount } from "svelte";
  import { tweened } from "svelte/motion"
  import { fade } from "svelte/transition";
  import * as easing from "svelte/easing";
  import * as pg from "../playground/playground.js";
  import { print } from "../playground/playground.js";
  import { onInterval } from "../util.js";
  import * as m from "ml-matrix";
  import * as r from "random";
  import * as gauss from "../gaussian";

  // GBP
  const var_node_prior_std = 60;
  const factor_node_prior_std = 30;
  const meas_jac = new m.Matrix([[-1, 0, 1, 0], [0, -1, 0, 1]]);
  var var_lambda = 1 / Math.pow(var_node_prior_std, 2);
  var factor_lambda = 1 / Math.pow(factor_node_prior_std, 2);
  const random_noise = r.normal(0, 5);
  var eta_damping = 0;
  const new_gauss = new gauss.Gaussian([[0], [0]], [[0, 0], [0, 0]]);
  var bidir_sweep = false;
  var forward_sweep = true;
  var passed_message = false;

  // svg
  var svg;
  var svg_width = 800;
  var svg_height = 500;

  // Playground
  var graph;
  var n_var_nodes = 22;
  var sync_schedule = true;
  var message_idx = 0;
  var total_error_distance = 0;
  var belief_MAP_diff = 0;

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
  var animation_in_progress = false;  // set to true to prevent new input during animation
  var source_node = null;
  $: message_bubbles = [];
  const message_progress = tweened(0);
  const source_progress = tweened(0);
  const target_progress = tweened(0);

  // UI
  const time_res = 0.1; // Time resolution
  var total_iter = 0;
  var iter_sec = 1.0;
  var counter = 0;
  var edit_mode = true;
  var passing_message = false;
  var show_bp_mean = true;
  var show_bp_cov = true;
  var show_MAP_mean = true;
  var show_MAP_cov = true;
  var show_animations = true;
  var show_ground_truth = true;
  var show_edges = true;
  var message = { message: null, timestamp: null, duration: null };
  var check_edge_message = {
    message: null,
    timestamp: null,
    duration: null
  };

  $: var_nodes = [];
  $: factor_nodes = [];
  $: edges = [];

  onMount(() => {
    graph = create_new_playground(n_var_nodes);
    reset_playground();
  });

  onInterval(() => update_playground(), parseInt(1000 / 60));

  onInterval(() => pass_message_interval(), 1000 * time_res);

  function create_new_playground(n_var_nodes = 2) {
    graph = new pg.FactorGraph();
    for (var i = 0; i < n_var_nodes; i++) {
      if (i < 8) {
        add_var_node(50 + 100 * i, 50, i * 2);
      } else if (i < 12) {
        add_var_node(750, 50 + 100 * (i - 7), i * 2);
      } else if (i < 18) {
        add_var_node(50 + 100 * (18 - i), 450, i * 2);
      } else if (i < 23) {
        add_var_node(50, 50 + 100 * (22 - i), i * 2);
      } else {
        return graph;
      }
      if (i > 0) {
        add_factor_node(
          graph.var_nodes[i - 1].id,
          graph.var_nodes[i].id,
          i * 2 - 1
        );
      }
      
    }
    for (var i = 0; i < parseInt(Math.random() * n_var_nodes); i ++) { //
      // print(graph.var_nodes[parseInt(Math.random() * graph.var_nodes.length - 2) + 1].id);
      add_factor_node(
          graph.var_nodes[parseInt(Math.random() * graph.var_nodes.length - 2) + 1].id,
          graph.var_nodes[parseInt(Math.random() * graph.var_nodes.length - 2) + 1].id
        );
    }
    console.log(graph);
    return graph;
  }

  function reset_playground() {
    console.clear();
    edit_mode = true;
    var_nodes = [];
    factor_nodes = [];
    edges = [];
    message_idx = 0;
    total_iter = 0;
    passed_message = true;
    graph = create_new_playground(n_var_nodes);
    update_playground();
    update_web_element();
    sync_pass_message();
    graph.compute_MAP();
    total_error_distance = parseInt(graph.compute_error());
    belief_MAP_diff = parseInt(graph.compare_to_MAP());
  }

  function update_playground() {
    graph.update_node_id();
    graph.update_factor_node_location();
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;
    graph.update_cov_ellipse();
    update_edge();
    update_messages();
    update_message_animation();
  }

  function set_message_progress(source_timeout = null, target_timeout = null) {
    animation_in_progress = true;
    if (!source_timeout || source_timeout > 0.5 * iter_sec) {
      source_timeout = 0.5 * iter_sec;
    }
    if (!target_timeout || target_timeout > 0.5 * iter_sec) {
      target_timeout = 0.5 * iter_sec;
    }
    source_progress.set(1, {duration: 0});
    source_progress.set(0, {duration: source_timeout * 1000, easing: easing.sineOut});
    message_progress.set(0, {duration: 0});
    message_progress.set(1, {duration: iter_sec * 1000, easing: easing.sineOut});
    target_progress.set(0, {duration: 0});
    setTimeout(() => {target_progress.set(1, {duration: target_timeout * 1000, easing: easing.sineOut})}, (iter_sec - target_timeout) * 1000);
    setTimeout(() => {target_progress.set(0, {duration: target_timeout * 1000, easing: easing.sineOut})}, iter_sec * 1000);
    setTimeout(() => {
      source_progress.set(1, {duration: 0});
      message_progress.set(0, {duration: 0});
      animation_in_progress = false;
      clear_message_bubble();
    }, (iter_sec + target_timeout) * 1000);
  }

  function pass_message_interval() {
    // Enables pass message in adjustable interval
    if (!edit_mode && passing_message) {
      if (counter >= iter_sec * 10 - 1) {
        counter = 0;
        if (!pause_one_iter) {
          pass_message();
        }
        else {
          pause_one_iter = false;
        }
      } else {
        counter++;
      }
    }
  }

  function sync_pass_message() {
    for (
      var i = 0;
      i < graph.var_nodes.length + graph.factor_nodes.length;
      i++
    ) {
      graph.find_node(i).pass_message(graph);
    }
    passed_message = true;
    total_iter++;
  }

  function sweep_pass_message() {
    var node = graph.find_node(message_idx);
    node.pass_message(graph);
    if (node.type == "var_node") {
      source_node = node;
      setTimeout(clear_source_node, iter_sec * 1000);
    } else if (node.type == "factor_node") {
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
          angle2: graph.find_node(node.adj_ids[1]).belief_ellipse.angle
        };
      }
      else {
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
          angle2: graph.find_node(node.adj_ids[0]).belief_ellipse.angle
        };
      }
      message_bubbles.push(message_bubble);
      set_message_progress(0.5, 0.5);
    }
    if (forward_sweep || !bidir_sweep) {
      message_idx ++;
    } else {
      message_idx --;
    }
    if (bidir_sweep) {
      // In bidirectional mode, reaching one end reverses the message direction
      if (message_idx >= graph.var_nodes.length + graph.factor_nodes.length) {
        message_idx = graph.var_nodes.length + graph.factor_nodes.length - 1;
        forward_sweep = false;
      } else if (message_idx < 0) {
        message_idx = 1;
        forward_sweep = true;
        total_iter ++;
      }
    } else {
      if (message_idx >= graph.var_nodes.length + graph.factor_nodes.length) {
        message_idx = 0;
        forward_sweep = true;
        total_iter ++;
      }
    }
    if (node.type == 'factor_node' && graph.find_node(message_idx).type == 'factor_node') {
      pause_one_iter = true;
    }
    passed_message = true;
  }

  function pass_message(iter = null) {
    if (sync_schedule) {
      // TODO: two message passing schedules, which one?
      sync_pass_message();
    } else {
      sweep_pass_message();
    }
    total_error_distance = parseInt(graph.compute_error());
    belief_MAP_diff = parseInt(graph.compare_to_MAP());
  }

  function update_edge() {
    edges = [];
    if (edit_mode) {
      for (var i = 0; i < graph.factor_nodes.length; i++) {
        var factor_node = graph.factor_nodes[i];
        for (var j = 0; j < factor_node.adj_ids.length; j++) {
          var var_node = graph.find_node(factor_node.adj_ids[j]);
          var edge = {
            node1_id: var_node.id,
            node2_id: factor_node.id,
            type: 0, // type 0 is the edge between nodes
            x1: var_node.x,
            y1: var_node.y,
            x2: factor_node.x,
            y2: factor_node.y
          };
          edges.push(edge);
        }
      }
    } else {
      for (var i = 0; i < graph.factor_nodes.length; i++) {
        var node1 = graph.find_node(graph.factor_nodes[i].adj_ids[0]);
        var node2 = graph.find_node(graph.factor_nodes[i].adj_ids[1]);
        var edge = {
          node1_id: node1.id,
          node2_id: node2.id,
          type: 0, // type 0 is the edge between nodes
          x1: node1.belief_ellipse.cx,
          y1: node1.belief_ellipse.cy,
          x2: node2.belief_ellipse.cx,
          y2: node2.belief_ellipse.cy
        };
        edges.push(edge);
      }
      for (var i = 0; i < graph.var_nodes.length; i++) {
        var var_node = graph.var_nodes[i];
        var edge1 = {
          node1_id: var_node.id,
          node2_id: var_node.id,
          type: 1, // type 1 is the edge between belief mean and ground truth in play mode
          x1: var_node.belief_ellipse.cx,
          y1: var_node.belief_ellipse.cy,
          x2: var_node.x,
          y2: var_node.y
        };
        var edge2 = {
          node1_id: var_node.id,
          node2_id: var_node.id,
          type: 2, // type 2 is the edge between belief mean and MAP mean in play mode
          x1: var_node.belief_ellipse.cx,
          y1: var_node.belief_ellipse.cy,
          x2: var_node.MAP_ellipse.cx,
          y2: var_node.MAP_ellipse.cy
        };
        var edge3 = {
          node1_id: var_node.id,
          node2_id: var_node.id,
          type: 3, // type 3 is the edge between MAP mean and ground truth when belief is not shown in play mode
          x1: var_node.x,
          y1: var_node.y,
          x2: var_node.MAP_ellipse.cx,
          y2: var_node.MAP_ellipse.cy
        };
        edges.push(edge1);
        edges.push(edge2);
        edges.push(edge3);
      }
    }
  }

  function update_message_animation() {
    if (source_node) {
      source_node = graph.find_node(source_node.id);
    }
    if (message_bubbles) {
      for (var i = 0; i < message_bubbles.length; i ++) {
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
    const var_node = new pg.VariableNode(2, id, x, y);
    if (id == 0) {
      var_node.prior.lam = new m.Matrix([[1, 0], [0, 1]]);
    } else {
      var_node.prior.lam = new m.Matrix([[var_lambda, 0], [0, var_lambda]]);
    }
    var_node.prior.eta = var_node.prior.lam.mmul(
      new m.Matrix([[var_node.x], [var_node.y]])
    );
    graph.var_nodes.push(var_node);
    clear_previous_message();
  }

  function add_factor_node(node1_id, node2_id, id = null) {
    node1_id = parseInt(node1_id);
    node2_id = parseInt(node2_id);
    if (!id) {
      id = graph.var_nodes.length + graph.factor_nodes.length;
    }
    if (
      !graph.find_factor_node(node1_id, node2_id) &&
      graph.find_node(node1_id).type == "var_node" &&
      graph.find_node(node2_id).type == "var_node" &&
      node1_id != node2_id
    ) {
      // No existing edge between node1 and node2
      const factor_node = new pg.LinearFactor(4, id, [node1_id, node2_id]);
      factor_node.meas_noise = [random_noise(), random_noise()];
      var measurement = new m.Matrix([
        [
          graph.find_node(factor_node.adj_ids[1]).x -
            graph.find_node(factor_node.adj_ids[0]).x +
            factor_node.meas_noise[0]
        ],
        [
          graph.find_node(factor_node.adj_ids[1]).y -
            graph.find_node(factor_node.adj_ids[0]).y +
            factor_node.meas_noise[1]
        ]
      ]);
      factor_node.jacs = [meas_jac];
      factor_node.meas = [measurement];
      factor_node.lambdas = [factor_lambda];
      factor_node.adj_var_dofs = [2, 2];
      factor_node.adj_beliefs = factor_node.adj_ids.map(adj_id => graph.find_node(adj_id).belief);
      factor_node.messages = [new_gauss, new_gauss];
      factor_node.compute_factor();
      graph.factor_nodes.push(factor_node);
      graph.find_node(node1_id).adj_ids.push(id);
      graph.find_node(node2_id).adj_ids.push(id);
      clear_previous_message();
      return true;
    } else {
      return false;
    }
  }

  function clear_source_node() {
    source_node = null;
  }

  function clear_message_bubble() {
    message_bubbles = [];
    message_progress.set(0, {duration: 0});
  }

  function clear_previous_message() {
    for (var i = 0; i < graph.var_nodes.length; i ++) {
      var var_node = graph.var_nodes[i];
      var_node.belief.lam = var_node.prior.lam.clone();
      var_node.belief.eta = var_node.prior.eta.clone();
    }
    for (var i = 0; i < graph.factor_nodes.length; i ++) {
      var factor_node = graph.factor_nodes[i];
      factor_node.adj_beliefs = factor_node.adj_ids.map(adj_id => graph.find_node(adj_id).belief);
      factor_node.messages = [new_gauss, new_gauss];
      factor_node.compute_factor();
    }
    passed_message = false;
  }

  function mousedown_handler(e) {
    mouse_up = false;
    node_mousedown = null;
    node_mousedown = e.path.find(element => element.classList == "node_g");
    mousedown_time = Date.now();
    if (node_mousedown) {
      node_mousedown = graph.find_node(node_mousedown.id);
    }
  }

  function mousemove_handler(e) {
    node_onhover = null;
    node_onhover = e.path.find(element => element.classList == "node_g");
    const rect = e.currentTarget.getBoundingClientRect();
    current_mouse_location = {
      x: e.clientX - rect.x,
      y: e.clientY - rect.y
    };
    if (node_mousedown && edit_mode) {
      moving_node = true;
      node_mousedown.x = current_mouse_location.x;
      node_mousedown.y = current_mouse_location.y;
    }
    if (node_onhover && edit_mode) {
      node_onhover = graph.find_node(node_onhover.id);
      document.getElementById("node_info_div").style.display = "inline-block";
    } else {
      document.getElementById("node_info_div").style.display = "none";
    }
  }

  function mouseup_handler(e) {
    click_time = Date.now() - mousedown_time;
    if (moving_node && node_mousedown.type == 'var_node') {
      clear_previous_message();
      node_mousedown.prior.eta = node_mousedown.prior.lam.mmul(
        new m.Matrix([[node_mousedown.x], [node_mousedown.y]]));
      node_mousedown.belief.eta = node_mousedown.prior.eta.clone();
      node_mousedown.belief.lam = node_mousedown.prior.lam.clone();
      for (var i = 0; i < node_mousedown.adj_ids.length; i ++) {
        var factor_node = graph.find_node(node_mousedown.adj_ids[i]);
        var measurement = new m.Matrix([
          [
            graph.find_node(factor_node.adj_ids[1]).x -
              graph.find_node(factor_node.adj_ids[0]).x +
              factor_node.meas_noise[0]
          ],
          [
            graph.find_node(factor_node.adj_ids[1]).y -
              graph.find_node(factor_node.adj_ids[0]).y +
              factor_node.meas_noise[1]
          ]
        ]);
        factor_node.adj_beliefs = factor_node.adj_ids.map(adj_id => graph.find_node(adj_id).belief);
        factor_node.meas = [measurement];
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
    node_clicked = e.path.find(element => element.classList == "node_g");
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
            last_node_clicked = null;
          } else if (
            node_clicked.type == "var_node" &&
            last_node_clicked.type == "var_node"
          ) {
            add_factor_node(last_node_clicked.id, node_clicked.id);
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
    // FIXME: bug that doesn't recognize nodes
    node_clicked = null;
    node_clicked = e.path.find(element => element.classList == "node_g");
    if (click_time <= click_time_span && mouse_up && !animation_in_progress) {
      if (node_clicked) {
        node_clicked = graph.find_node(node_clicked.id);
        // Consider as a click
        if (!last_node_clicked) {
          last_node_clicked = node_clicked;
          source_node = node_clicked;
        } else {
          if (
            node_clicked.id == last_node_clicked.id
            // Date.now() - last_click_time <= double_click_time_span
          ) {
            var send_message_bubbles = [];
            var receive_message_bubbles = [];
            for (var i = 0; i < node_clicked.adj_ids.length; i ++) {
              var adj_var_node = graph.find_node(graph.find_node(node_clicked.adj_ids[i]
                ).adj_ids.filter(id => id != node_clicked.id)[0]);
              var message_bubble = {
                node1_id: adj_var_node.id,
                node2_id: node_clicked.id,
                node1_display: true,
                node2_display: (i == 0),  // only display node2 once
                cx1: adj_var_node.belief_ellipse.cx,
                cy1: adj_var_node.belief_ellipse.cy,
                rx1: adj_var_node.belief_ellipse.rx,
                ry1: adj_var_node.belief_ellipse.ry,
                angle1: adj_var_node.belief_ellipse.angle,
                cx2: node_clicked.belief_ellipse.cx,
                cy2: node_clicked.belief_ellipse.cy,
                rx2: node_clicked.belief_ellipse.rx,
                ry2: node_clicked.belief_ellipse.ry,
                angle2: node_clicked.belief_ellipse.angle
              };
              send_message_bubbles.push(message_bubble);
            }
            for (var i = 0; i < node_clicked.adj_ids.length; i ++) {
              var adj_var_node = graph.find_node(graph.find_node(node_clicked.adj_ids[i]
                ).adj_ids.filter(id => id != node_clicked.id)[0]);
              var message_bubble = {
                node1_id: node_clicked.id,
                node2_id: adj_var_node.id,
                node1_display: (i == 0),
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
                angle2: adj_var_node.belief_ellipse.angle
              };
              receive_message_bubbles.push(message_bubble);
            }
            message_bubbles = send_message_bubbles;
            set_message_progress(clear_message_highlight_delay, clear_message_highlight_delay);
            setTimeout(() => {
              message_bubbles = receive_message_bubbles;
              set_message_progress(clear_message_highlight_delay, clear_message_highlight_delay);
            }, (iter_sec + clear_message_highlight_delay) * 1000);
            clear_source_node();
            graph.pass_message(node_clicked.id, node_clicked.id);
          } else if (node_clicked.id != last_node_clicked.id){
            clear_source_node();
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
              angle2: node_clicked.belief_ellipse.angle
            };
            message_bubbles.push(message_bubble);
            setTimeout(() => {
              graph.pass_message(message_bubble.node1_id, message_bubble.node2_id);
            }, iter_sec * 1000);
            set_message_progress(clear_message_highlight_delay, clear_message_highlight_delay);
          }
          total_error_distance = parseInt(graph.compute_error());
          belief_MAP_diff = parseInt(graph.compare_to_MAP());
          last_node_clicked = null;
        }
      } else {
        last_node_clicked = null;
        clear_source_node();
      }
    } else {
      last_node_clicked = null;
    }
    last_click_time = Date.now();
  }

  function update_web_element() {
    document.getElementById("edit_mode_radio_button").checked = edit_mode;
    document.getElementById("play_mode_radio_button").checked = !edit_mode;
    document.getElementById("sync_mode_radio_button").checked = sync_schedule;
    document.getElementById("sweep_mode_radio_button").checked = !sync_schedule;
    document.getElementById(
      "toggle_bidir_sweep_checkbox"
    ).checked = bidir_sweep;
    document.getElementById("toggle_MAP_mean_checkbox").checked = show_MAP_mean;
    document.getElementById("toggle_MAP_cov_checkbox").checked = show_MAP_cov;
    document.getElementById("toggle_bp_mean_checkbox").checked = show_bp_mean;
    document.getElementById("toggle_bp_cov_checkbox").checked = show_bp_cov;
    document.getElementById(
      "toggle_animations_checkbox"
    ).checked = show_animations;
    document.getElementById(
      "toggle_ground_truth_checkbox"
    ).checked = show_ground_truth;
    document.getElementById(
      "toggle_edges_checkbox"
    ).checked = show_edges;
    if (edit_mode) {
      document.getElementById("message_passing_setting_div").style.display =
        "none";
    }
  }

  function update_messages() {
    if (message.message) {
      if (Date.now() - message.timestamp >= message.duration) {
        // Clear message if message has passed duration
        message = { message: null, timestamp: null, duration: null };
      }
    }
    if (check_edge_message.message) {
      if (
        Date.now() - check_edge_message.timestamp >=
        check_edge_message.duration
      ) {
        // Clear message if message has passed duration
        check_edge_message = {
          message: null,
          timestamp: null,
          duration: null
        };
      }
    }
  }

  function toggle_mode() {
    edit_mode =
      document.getElementById("edit_mode_radio_button").checked &&
      !document.getElementById("play_mode_radio_button").checked;
    if (!edit_mode) {
      if (!passed_message) {
        sync_pass_message();
      }
      graph.compute_MAP();
      document.getElementById("message_passing_setting_div").style.display =
        "block";
    } else {
      document.getElementById("message_passing_setting_div").style.display =
        "none";
    }
    total_error_distance = parseInt(graph.compute_error());
    belief_MAP_diff = parseInt(graph.compare_to_MAP());
    node_clicked = null;
    last_node_clicked = null;
    source_node = null;
    passing_message = false;
    total_iter = 0;
  }

  function click_add_var_node() {
    add_var_node();
  }

  function toggle_passing_message() {
    passing_message = !passing_message;
    if (passing_message) {
      counter = iter_sec * 10 - 1;
    }
    clear_source_node();
    clear_message_bubble();
  }

  function toggle_schedule() {
    sync_schedule =
      document.getElementById("sync_mode_radio_button").checked &&
      !document.getElementById("sweep_mode_radio_button").checked;
    if (sync_schedule) {
      bidir_sweep = false;
      document.getElementById(
        "toggle_bidir_sweep_checkbox"
      ).checked = bidir_sweep;
    }
    total_iter = 0;
  }

  function toggle_bidir_sweep() {
    if (!sync_schedule) {
      bidir_sweep = document.getElementById("toggle_bidir_sweep_checkbox")
        .checked;
    } else {
      document.getElementById("toggle_bidir_sweep_checkbox").checked = false;
    }
  }

  function toggle_bp_mean() {
    show_bp_mean = document.getElementById("toggle_bp_mean_checkbox").checked;
  }

  function toggle_bp_cov() {
    show_bp_cov = document.getElementById("toggle_bp_cov_checkbox").checked;
  }

  function toggle_MAP_mean() {
    show_MAP_mean = document.getElementById("toggle_MAP_mean_checkbox").checked;
  }

  function toggle_MAP_cov() {
    show_MAP_cov = document.getElementById("toggle_MAP_cov_checkbox").checked;
  }

  function toggle_animations() {
    show_animations = document.getElementById("toggle_animations_checkbox")
      .checked;
  }

  function toggle_ground_truth() {
    show_ground_truth = document.getElementById("toggle_ground_truth_checkbox")
      .checked;
  }

  function toggle_edges() {
    show_edges = document.getElementById("toggle_edges_checkbox")
      .checked;
  }

  function update_eta_damping() {
    for (var i = 0; i < graph.factor_nodes.length; i++) {
      graph.factor_nodes[i].eta_damping = eta_damping;
    }
  }

  function print_graph_detail() {
    print(graph);
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
        <radialGradient id="bp_cov_gradient">
          <stop offset="0.35" stop-color="red" stop-opacity="0.5" />
          <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
        </radialGradient>
        <radialGradient id="MAP_cov_gradient">
          <stop offset="0.35" stop-color="blue" stop-opacity="0.5" />
          <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
        </radialGradient>
      </defs>
      {#if show_edges}
        {#each edges as edge}
          {#if edge.type == 0 && edit_mode}
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="black"
              stroke-width="1" />
          {/if}
          {#if edge.type == 0 && !edit_mode && (show_bp_mean || show_bp_cov)}
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="black"
              stroke-width="1"
              stroke-opacity="0.5" />
          {/if}
          {#if edge.type == 1 && !edit_mode && show_ground_truth && (show_bp_mean || show_bp_cov)}
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="black"
              stroke-width="1"
              stroke-opacity="0.5"
              stroke-dasharray="2, 4" />
          {/if}
          {#if edge.type == 2 && !edit_mode && (show_MAP_mean || show_MAP_cov) && (show_bp_mean || show_bp_cov)}
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="black"
              stroke-width="1"
              stroke-opacity="0.5"
              stroke-dasharray="2, 4" />
          {/if}
          {#if edge.type == 3 && !edit_mode && (show_MAP_mean || show_MAP_cov) && show_ground_truth && !(show_bp_mean || show_bp_cov)}
            <line
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
      {#if edit_mode}
        {#each factor_nodes as factor_node}
          <g
            class="node_g"
            id={factor_node.id}
            transform="translate({factor_node.x}
            {factor_node.y})">
            <rect
              class="node"
              x={-10}
              y={-10}
              width={20}
              height={20}
              stroke="blue"
              fill="white"
              fill-opacity={1.0} />
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
              transform="rotate({var_node.MAP_ellipse.angle})"
              stroke="blue"
              fill="url(#MAP_cov_gradient)"
              stroke-opacity={0.5}
              fill-opacity={0} />
          {/if}
          {#if show_bp_cov}
            <ellipse
              class="node_bp_cov"
              cx={var_node.belief_ellipse.cx}
              cy={var_node.belief_ellipse.cy}
              rx={var_node.belief_ellipse.rx}
              ry={var_node.belief_ellipse.ry}
              transform="rotate({var_node.belief_ellipse.angle})"
              stroke="red"
              fill="url(#bp_cov_gradient)"
              stroke-opacity={0.75} />
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
          {#if show_bp_mean}
            <circle
              class="node_bp_mean"
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
      {#if message_bubbles && show_animations}
        {#each message_bubbles as message_bubble}
          {#if $source_progress && show_bp_cov && message_bubble.node1_display}
            <ellipse
              cx={message_bubble.cx1}
              cy={message_bubble.cy1}
              rx={message_bubble.rx1}
              ry={message_bubble.rx1}
              transform="rotate({message_bubble.angle1})"
              stroke="red"
              stroke-width={2}
              stroke-opacity={$source_progress}
              fill="red"
              fill-opacity={0.25 * $source_progress} />
          {/if}
          {#if $target_progress && show_bp_cov && message_bubble.node2_display}
            <ellipse
              cx={message_bubble.cx2}
              cy={message_bubble.cy2}
              rx={message_bubble.rx2}
              ry={message_bubble.rx2}
              transform="rotate({message_bubble.angle2})"
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
      {#if source_node && show_animations}
        {#if show_bp_cov}
          <ellipse
            cx={source_node.belief_ellipse.cx}
            cy={source_node.belief_ellipse.cy}
            rx={source_node.belief_ellipse.rx}
            ry={source_node.belief_ellipse.ry}
            transform="rotate({source_node.belief_ellipse.angle})"
            stroke="red"
            stroke-width={2}
            fill="red"
            fill-opacity={0.25}/>
        {:else}
          <circle
            class="node_MAP_mean"
            cx={source_node.belief_ellipse.cx}
            cy={source_node.belief_ellipse.cy}
            r={5}
            stroke="red"
            fill="red"/>
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
        </g>
      {/each}
    </svg>
  </div>

  <div id="playground-settings-panel" style="user-select: none">
    <div id="playground_info_div">
      <b>Iterations: {total_iter}</b>
      <br />
      <b>Total Error: {total_error_distance}</b>
      <br />
      <b>Difference to MAP: {belief_MAP_diff}</b>
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
              Pause Message Passing
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
        <label>
          <button
            type="button"
            class="btn"
            on:click={reset_playground}
            style="width:98px; border:2px solid black">
            Reset
          </button>
        </label>
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
    <div id="node_info_div" style="display: none;">
      {#if node_onhover}
        {#if node_onhover.type == 'var_node'}
          <b>id</b>
          = {node_onhover.id}
        {/if}
        {#if node_onhover.type == 'factor_node'}
          <b>id</b>
          = {node_onhover.id}
        {/if}
      {/if}
    </div>
    <div id="message_passing_setting_div" style="display: none;">
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
        <label class="checkbox-inline" style="user-select: none">
          <input
            type="checkbox"
            id="toggle_bidir_sweep_checkbox"
            on:click={toggle_bidir_sweep} />
          Bidir
        </label>
      </div>
      <!-- <label>
        &eta Damping: <b>{eta_damping}</b>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          bind:value={eta_damping}
          on:change={update_eta_damping}
          style="width:200px;" />
      </label> -->
      <label>
        Animation Speed:
        <b>{iter_sec}</b>
        <input
          type="range"
          min="0.1"
          max="5"
          step={time_res}
          bind:value={iter_sec}
          style="width:200px;" />
      </label>
      <br />
      <div style="display: inline-block;">
        <span style="color: red">
          <b>Belief:</b>
        </span>
        <label class="checkbox-inline" style="user-select: none">
          <input
            type="checkbox"
            id="toggle_bp_mean_checkbox"
            on:click={toggle_bp_mean} />
          Mean
        </label>
        <label class="checkbox-inline" style="user-select: none">
          <input
            type="checkbox"
            id="toggle_bp_cov_checkbox"
            on:click={toggle_bp_cov} />
          Cov
        </label>
      </div>
      <div style="display: inline-block;">
        <span style="color: blue">
          <b>MAP:</b>
        </span>
        <label class="checkbox-inline" style="user-select: none">
          <input
            type="checkbox"
            id="toggle_MAP_mean_checkbox"
            on:click={toggle_MAP_mean} />
          Mean
        </label>
        <label class="checkbox-inline" style="user-select: none">
          <input
            type="checkbox"
            id="toggle_MAP_cov_checkbox"
            on:click={toggle_MAP_cov} />
          Cov
        </label>
      </div>
      <div style="display: inline-block;">
        <label class="checkbox-inline" style="user-select: none; color: green">
          <input
            type="checkbox"
            id="toggle_ground_truth_checkbox"
            on:click={toggle_ground_truth} />
          <b>Ground Truth</b>
        </label>
      </div>
      <br />
      <label class="checkbox-inline" style="user-select: none">
        <input
          type="checkbox"
          id="toggle_animations_checkbox"
          on:click={toggle_animations} />
        Animations
      </label>
      <br />
      <label class="checkbox-inline" style="user-select: none">
        <input
          type="checkbox"
          id="toggle_edges_checkbox"
          on:click={toggle_edges} />
        Edges
      </label>
    </div>
    <div id="messages_div">
      {#if message.message}
        <p transition:fade font-size="14">{message.message}</p>
      {/if}
    </div>
  </div>
</div>
