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

  // GBP
  var var_prior_std = 50;
  var var_lambda = 1 / Math.pow(var_prior_std, 2);
  var linear_prior_std = 20;
  const linear_jac = new m.Matrix([[-1, 0, 1, 0], [0, -1, 0, 1]]);
  var linear_lambda = 1 / Math.pow(linear_prior_std, 2);
  var linear_noise_mag = 10;
  var linear_noise = r.normal(0, linear_noise_mag);
  const new_gauss = new gauss.Gaussian([[0], [0]], [[0, 0], [0, 0]]);
  var passed_message = false;

  // svg
  var svg;
  var svg_width = 800;
  var svg_height = 800;

  // Playground
  var graph;
  var n_var_nodes = 22;
  var n_edges_per_node = 2;
  var max_edge_length = 500;
  var convergence_threshold = 0.1;
  const min_node_spacing = 25;
  var total_error_distance = 0;
  var belief_MAP_diff = 0;
  var overconfidence = 0;
  var converged = false;

  // Message passing animation
  var animation_in_progress = false; // set to true to prevent new input during animation

  // UI
  const time_res = 0.1; // Time resolution
  var total_iter = 0;
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
    graph = new playground.FactorGraph();
    for (var i = 0; i < n_var_nodes; i++) {
      var attempts = 0;
      while (attempts < 10) {
        var x = (Math.random() * 0.9 + 0.05) * svg_width;
        var y = (Math.random() * 0.9 + 0.05) * svg_height;
        if (
          graph.var_nodes.every(
            var_node =>
              Math.pow(x - var_node.x, 2) + Math.pow(y - var_node.y, 2) >=
              Math.pow(min_node_spacing, 2)
          )
        ) {
          break;
        } else {
          attempts++;
        }
      }
      add_var_node(x, y);
    }
    reset_factors();
    print_graph_detail();
    return graph;
  }

  function reset_playground() {
    console.clear();
    var_nodes = [];
    factor_nodes = [];
    edges = [];
    total_iter = 0;
    passing_message = false;
    passed_message = false;
    graph = create_new_playground(n_var_nodes);
    update_web_elements();
    if (!edit_mode) {
      pass_message();
      graph.compute_MAP();
    }
    update_playground();
    graph.compute_MAP();
    total_error_distance = graph.compute_error();
    belief_MAP_diff = graph.compare_to_MAP();
    overconfidence = graph.compute_overconfidence();
  }

  function update_playground() {
    if (edit_mode) {
      graph.update_node_id();
      graph.update_factor_node_location();
    }
    graph.update_cov_ellipse();
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;
    update_web_elements();
    update_edge();
    update_messages();
    if (belief_MAP_diff <= convergence_threshold) {
      converged = true;
      passing_message = false;
    }
  }

  function pass_message_interval() {
    // Enables pass message in adjustable interval
    if (!edit_mode && passing_message) {
      if (counter >= iter_sec * 10 - 1 || !iter_sec) {
        counter = 0;
        pass_message();
      } else {
        counter++;
      }
    }
  }

  function pass_message() {
    for (var i = 0; i < graph.factor_nodes.length; i++) {
      graph.factor_nodes[i].pass_message(graph);
    }
    for (var i = 0; i < graph.var_nodes.length; i++) {
      graph.var_nodes[i].pass_message(graph);
    }
    passed_message = true;
    total_iter++;
    total_error_distance = graph.compute_error();
    belief_MAP_diff = graph.compare_to_MAP();
    overconfidence = graph.compute_overconfidence();
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
    if (passing_message) {
      document.getElementById("animation_speed_range").disabled = true;
    } else {
      document.getElementById("animation_speed_range").disabled = false;
    }
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
        // the edge between nodes
        var edge = {
          node1_id: node1.id,
          node2_id: node2.id,
          type: 0,
          x1: node1.belief_ellipse.cx,
          y1: node1.belief_ellipse.cy,
          x2: node2.belief_ellipse.cx,
          y2: node2.belief_ellipse.cy
        };
        edges.push(edge);
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
            node1_id: var_node.id,
            node2_id: var_node.id,
            type: 1,
            x1: var_node.belief_ellipse.cx,
            y1: var_node.belief_ellipse.cy,
            x2: var_node.x,
            y2: var_node.y
          };
          edges.push(edge);
        }
        if (
          !edit_mode &&
          (show_belief_mean || show_belief_cov) &&
          (show_MAP_mean || show_MAP_cov)
        ) {
          // the edge between belief mean and MAP mean in play mode
          var edge = {
            node1_id: var_node.id,
            node2_id: var_node.id,
            type: 2,
            x1: var_node.belief_ellipse.cx,
            y1: var_node.belief_ellipse.cy,
            x2: var_node.MAP_ellipse.cx,
            y2: var_node.MAP_ellipse.cy
          };
          edges.push(edge);
        }
        if (
          !edit_mode &&
          show_ground_truth &&
          (show_MAP_mean || show_MAP_cov)
        ) {
          // the edge between MAP mean and ground truth when belief is not shown in play mode
          var edge = {
            node1_id: var_node.id,
            node2_id: var_node.id,
            type: 3,
            x1: var_node.x,
            y1: var_node.y,
            x2: var_node.MAP_ellipse.cx,
            y2: var_node.MAP_ellipse.cy
          };
          edges.push(edge);
        }
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
      var_node.prior.lam = new m.Matrix([[1, 0], [0, 1]]);
    } else {
      var_node.prior.lam = new m.Matrix([[var_lambda, 0], [0, var_lambda]]);
    }
    var_node.prior.eta = var_node.prior.lam.mmul(
      new m.Matrix([[var_node.x], [var_node.y]])
    );
    var_node.belief.eta = var_node.prior.eta.clone();
    var_node.belief.lam = var_node.prior.lam.clone();
    graph.var_nodes.push(var_node);
  }

  function add_factor_node(node1_id, node2_id, id = null) {
    add_linear_factor(node1_id, node2_id, id);
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
        node2.id
      ]);
      factor_node.meas_noise = new m.Matrix([
        [linear_noise()],
        [linear_noise()]
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

  function clear_previous_message() {
    for (var i = 0; i < graph.var_nodes.length; i++) {
      var var_node = graph.var_nodes[i];
      var_node.belief.lam = var_node.prior.lam.clone();
      var_node.belief.eta = var_node.prior.eta.clone();
    }
    for (var i = 0; i < graph.factor_nodes.length; i++) {
      var factor_node = graph.factor_nodes[i];
      factor_node.adj_beliefs = factor_node.adj_ids.map(
        adj_id => graph.find_node(adj_id).belief
      );
      factor_node.messages = [new_gauss, new_gauss];
      factor_node.compute_factor();
    }
    passed_message = false;
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
        pass_message();
      }
      graph.compute_MAP();
    }
    total_error_distance = graph.compute_error();
    belief_MAP_diff = graph.compare_to_MAP();
    passing_message = false;
    total_iter = 0;
  }

  function click_add_var_node() {
    var x = (Math.random() * 0.9 + 0.05) * svg_width;
    var y = (Math.random() * 0.9 + 0.05) * svg_height;
    add_var_node(x, y);
    clear_previous_message();
  }

  function toggle_passing_message() {
    passing_message = !passing_message;
    if (passing_message) {
      counter = iter_sec * 10 - 1;
    }
  }

  function reset_factors() {
    var factor_ids = graph.factor_nodes.map(factor_node => factor_node.id);
    if (factor_ids) {
      for (var i = 0; i < factor_ids.length; i++) {
        graph.remove_node(factor_ids[i]);
      }
    }
    for (var i = 0; i < n_var_nodes; i++) {
      var nearby_var_nodes = graph.var_nodes.filter(
        var_node =>
          Math.pow(graph.var_nodes[i].x - var_node.x, 2) +
            Math.pow(graph.var_nodes[i].y - var_node.y, 2) <=
          Math.pow(max_edge_length, 2)
      );
      if (nearby_var_nodes) {
        nearby_var_nodes.sort(() => Math.random() - 0.5); // shuffle nodes
        for (var j = 0; j < nearby_var_nodes.length; j++) {
          if (
            graph.var_nodes[i].adj_ids.length < n_edges_per_node &&
            nearby_var_nodes[j].adj_ids.length < n_edges_per_node
          ) {
            add_factor_node(graph.var_nodes[i].id, nearby_var_nodes[j].id);
          }
        }
      }
    }
  }

  function reset_prior() {
    clear_previous_message();
    var_lambda = 1 / Math.pow(var_prior_std, 2);
    linear_lambda = 1 / Math.pow(linear_prior_std, 2);
    for (var i = 0; i < graph.factor_nodes.length; i ++) {
      var factor_node = graph.factor_nodes[i];
      var node1 = graph.find_node(parseInt(factor_node.adj_ids[0]));
      var node2 = graph.find_node(parseInt(factor_node.adj_ids[1]));
      factor_node.lambda = [linear_lambda];
      factor_node.meas_noise = new m.Matrix([
        [linear_noise()],
        [linear_noise()]
      ]);
      factor_node.meas = factor_node.meas_func(
        [node1.x, node1.y],
        [node2.x, node2.y]
      );
      factor_node.meas.add(factor_node.meas_noise);
      factor_node.compute_factor();
    }
    for (var i = 0; i < graph.var_nodes.length; i ++) {
      var var_node = graph.var_nodes[i];
      if (var_node.id != 0) {
        var_node.prior.lam = new m.Matrix([[var_lambda, 0], [0, var_lambda]]);
      }
      var_node.prior.eta = var_node.prior.lam.mmul(
        new m.Matrix([[var_node.x], [var_node.y]])
      );
      var_node.belief.eta = var_node.prior.eta.clone();
      var_node.belief.lam = var_node.prior.lam.clone();
      var_node.pass_message(graph);
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
    <svg bind:this={svg} width={svg_width} height={svg_height}>
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
              stroke-width="0.1" />
          {/if}
          {#if edge.type == 0 && !edit_mode && (show_belief_mean || show_belief_cov)}
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="black"
              stroke-width="1"
              stroke-opacity="0.1" />
          {/if}
          {#if edge.type == 1 && !edit_mode && show_ground_truth && (show_belief_mean || show_belief_cov)}
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="black"
              stroke-width="1"
              stroke-opacity="0.1"
              stroke-dasharray="2, 4" />
          {/if}
          {#if edge.type == 2 && !edit_mode && (show_MAP_mean || show_MAP_cov) && (show_belief_mean || show_belief_cov)}
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="black"
              stroke-width="1"
              stroke-opacity="0.1"
              stroke-dasharray="2, 4" />
          {/if}
          {#if edge.type == 3 && !edit_mode && (show_MAP_mean || show_MAP_cov) && show_ground_truth && !(show_belief_mean || show_belief_cov)}
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="black"
              stroke-width="1"
              stroke-opacity="0.1"
              stroke-dasharray="2, 4" />
          {/if}
        {/each}
      {/if}
      {#if edit_mode}
        {#each factor_nodes as factor_node}
          <g
            class="node_g"
            id={factor_node.id}
            transform="translate({factor_node.x}
            {factor_node.y})">
            <!-- <rect
              class="node"
              x={-10}
              y={-10}
              width={20}
              height={20}
              stroke="blue"
              fill="white"
              fill-opacity={1.0} /> -->
            <!-- <text
              class="node_id"
              x={0}
              y={5}
              text-anchor="middle"
              stroke="black"
              font-size={12}
              style="user-select: none">
              {factor_node.id}
            </text> -->
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
          <!-- <text
            class="node_text"
            x={var_node.x}
            y={var_node.y + 5}
            text-anchor="middle"
            stroke="black"
            font-size={12}
            style="user-select: none">
            {var_node.id}
          </text> -->
        {:else}
          {#if show_MAP_cov}
            <ellipse
              class="node_MAP_cov"
              cx={var_node.MAP_ellipse.cx}
              cy={var_node.MAP_ellipse.cy}
              rx={var_node.MAP_ellipse.rx}
              ry={var_node.MAP_ellipse.ry}
              transform="rotate({var_node.MAP_ellipse.angle}, {var_node.MAP_ellipse.cx},
              {var_node.MAP_ellipse.cy})"
              stroke="blue"
              fill="url(#MAP_cov_gradient)"
              stroke-opacity={0.5}
              fill-opacity={0} />
          {/if}
          {#if show_belief_cov}
            <ellipse
              class="node_belief_cov"
              cx={var_node.belief_ellipse.cx}
              cy={var_node.belief_ellipse.cy}
              rx={var_node.belief_ellipse.rx}
              ry={var_node.belief_ellipse.ry}
              transform="rotate({var_node.belief_ellipse.angle}, {var_node.belief_ellipse.cx},
              {var_node.belief_ellipse.cy})"
              stroke="red"
              fill="url(#bp_cov_gradient)"
              stroke-opacity={0.5}
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
                transform="rotate({var_node.belief_ellipse.angle}, {var_node.belief_ellipse.cx},
                {var_node.belief_ellipse.cy})"
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
      {:else}
        <b>Total Error: {parseInt(total_error_distance)}</b>
      {/if}
      <br />
      {#if belief_MAP_diff < 1}
        <b>Difference to MAP: {parseInt(belief_MAP_diff * 100) / 100}</b>
      {:else}
        <b>Difference to MAP: {parseInt(belief_MAP_diff)}</b>
      {/if}
      {#if overconfidence < 1}
        <b>Overconfidence: {parseInt(overconfidence * 100) / 100}</b>
      {:else}
        <b>Overconfidence: {parseInt(overconfidence)}</b>
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
    <div id="edit_mode_setting_div" style="display: block;">
      <div id="n_var_nodes_range_div">
        <label class="range-inline">
          Number of Var Nodes:
          <b>{n_var_nodes}</b>
          <input
            type="range"
            id="n_var_nodes_range"
            min="10"
            max="100"
            step="1"
            bind:value={n_var_nodes}
            on:mouseup={reset_playground}
            style="width:200px;" />
        </label>
      </div>
      <div id="n_edges_per_node_range_div">
        <label class="range-inline">
          Edges Per Node:
          <b>{n_edges_per_node}</b>
          <input
            type="range"
            id="n_edges_per_node_range"
            min="1"
            max="9"
            step="1"
            bind:value={n_edges_per_node}
            on:mouseup={reset_factors}
            style="width:200px;" />
        </label>
      </div>
      <div id="max_edge_length_range_div">
        <label class="range-inline">
          Max Edge Length:
          <b>{max_edge_length}</b>
          <input
            type="range"
            id="max_edge_length_range"
            min="100"
            max="1000"
            step="10"
            bind:value={max_edge_length}
            on:change={reset_factors}
            style="width:200px;" />
        </label>
      </div>
      <div id="var_prior_std_range_div">
        <label class="range-inline">
          Var Node Prior:
          <b>{var_prior_std}</b>
          <input
            type="range"
            id="var_prior_std_range"
            min="10"
            max="100"
            step="10"
            bind:value={var_prior_std}
            on:mouseup={reset_prior}
            style="width:200px;" />
        </label>
      </div>
      <div id="linear_prior_std_range_div">
        <label class="range-inline">
          Factor Prior:
          <b>{linear_prior_std}</b>
          <input
            type="range"
            id="linear_prior_std_range"
            min="10"
            max="100"
            step="10"
            bind:value={linear_prior_std}
            on:mouseup={reset_prior}
            style="width:200px;" />
        </label>
      </div>
      <div id="linear_noise_mag_range_div">
        <label class="range-inline">
          Measurement Noise:
          <b>{linear_noise_mag}</b>
          <input
            type="range"
            id="linear_noise_mag_range"
            min="0"
            max="50"
            step="5"
            bind:value={linear_noise_mag}
            on:mouseup={reset_prior}
            style="width:200px;" />
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
      <label class="range-inline">
        Convergence Threshold:
        <b>{convergence_threshold}</b>
        <input
          type="range"
          id="convergence_threshold_range"
          min="0.1"
          max="1"
          step="0.1"
          bind:value={convergence_threshold}
          style="width:200px;" />
      </label>
      <br />
      <div style="display: inline-block;">
        <span style="color: red">
          <b>Belief:</b>
        </span>
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
        <span style="color: blue">
          <b>MAP:</b>
        </span>
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
