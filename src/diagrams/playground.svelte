<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import * as pg from "../playground/playground.js";
  import { print } from "../playground/playground.js";
  import { onInterval } from "../util.js";
  import * as m from "ml-matrix";
  import * as r from "random";
  import * as gauss from "../gaussian";

  // GBP
  const meas_jac = new m.Matrix([[-1, 0, 1, 0], [0, -1, 0, 1]]);
  const var_node_prior_std = 30;
  var var_lambda = 1 / Math.pow(var_node_prior_std, 2);
  const factor_node_prior_std = 30;
  var factor_lambda = 1 / Math.pow(factor_node_prior_std, 2);
  const random_noise = r.normal(0, 10);
  var eta_damping = 0.2;

  // svg
  var svg;
  var svg_width = 600;
  var svg_height = 400;

  // Playground
  var graph;
  var n_var_nodes = 5;
  var sync_schedule = true;
  var message_idx = 0;
  var total_error_distance = 0;

  // Drag and drop function
  const click_time_span = 100; // Threshold for time span during click
  const double_click_time_span = 350; // Threshold for time span during double click
  var mousedown_time = null;
  var click_time = null;
  var last_click_time = null;
  var mouse_up = false;
  var moving_node = false;
  var node_mousedown = null;
  var node_clicked = null;
  var last_node_clicked = null;
  var current_mouse_location = { x: null, y: null };

  // Message passing animation
  var source_node = null;
  var target_node = null;

  // UI
  const time_res = 0.1;  // Time resolution
  var iter_sec = 1.0;
  var counter = 0;
  var edit_mode = true;
  var passing_message = false;
  var show_cov_ellipse = true;
  var show_mean = true;
  var show_ground_truth = true;
  var message = { message: null, timestamp: null, duration: null };
  var check_connection_message = {
    message: null,
    timestamp: null,
    duration: null
  };

  $: var_nodes = [];
  $: factor_nodes = [];
  $: connections = [];

  onMount(() => {
    graph = create_new_playground(n_var_nodes);
    reset_playground();
  });

  onInterval(() => update_playground(), parseInt(1000 / 60));

  onInterval(() => pass_message_interval(), 1000 * time_res);

  function create_new_playground(n_var_nodes = 2) {
    graph = new pg.FactorGraph();
    var var_node = new pg.VariableNode(2, 0, 50, 50);
    var_node.prior.lam = new m.Matrix([[1, 0], [0, 1]]);
    var_node.prior.eta = var_node.prior.lam.mmul(
      new m.Matrix([[var_node.x], [var_node.y]])
    );
    var_node.pass_message(graph);
    graph.var_nodes.push(var_node);
    graph.last_node = var_node;
    for (var i = 1; i < n_var_nodes; i++) {
      add_var_node(50 + 100 * i, 50, i * 2);
      if (i > 0) {
        add_factor_node(
          graph.var_nodes[i - 1].id,
          graph.var_nodes[i].id,
          i * 2 - 1
        );
      }
    }
    console.log(graph);
    return graph;
  }

  function reset_playground() {
    console.clear();
    edit_mode = true;
    var_nodes = [];
    factor_nodes = [];
    connections = [];
    message_idx = 0;
    graph = create_new_playground(n_var_nodes);
    update_playground();
    update_web_element();
  }

  function update_playground() {
    graph.update_node_id();
    graph.update_factor_node_location();
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;
    update_connection();
    update_messages();
    if (!edit_mode) {
      graph.update_cov_ellipse();
    }
  }

  function pass_message_interval() {
    // Enables pass message in adjustable interval
    if (counter >= iter_sec * 10 - 1) {
      counter = 0;
      pass_message();
    }
    else {
      counter ++;
    }
  }

  function pass_message() {
    if (!edit_mode && passing_message) {
      if (sync_schedule) {
        // TODO: two message passing schedules, which one?
        for (
          var i = 0;
          i < graph.var_nodes.length + graph.factor_nodes.length;
          i++
        ) {
          graph.find_node(i).pass_message(graph);
        }
        // for (var i = 0; i < graph.var_nodes.length; i++) {
        //   var var_node = graph.var_nodes[i];
        //   var_node.pass_message(graph);
        //   for (var j = 0; j < var_node.adj_ids.length; j ++) {
        //     graph.find_node(var_node.adj_ids[j]).pass_message(graph);
        //   }
        // }
      } else {
        if (message_idx >= graph.var_nodes.length + graph.factor_nodes.length) {
          message_idx = 0;
        }
        graph.find_node(message_idx).pass_message(graph);
        message_idx++;
      }
      total_error_distance = parseInt(graph.compute_error());
    }
  }

  function update_connection() {
    connections = [];
    var id = 0;
    for (var i = 0; i < graph.factor_nodes.length; i++) {
      var factor_node = graph.factor_nodes[i];
      for (var j = 0; j < factor_node.adj_ids.length; j++) {
        var var_node = graph.find_node(factor_node.adj_ids[j]);
        var connection = {
          id: id,
          var_id: var_node.id,
          factor_id: factor_node.id,
          x1: var_node.x,
          y1: var_node.y,
          x2: factor_node.x,
          y2: factor_node.y
        };
        connections.push(connection);
        id ++;
      }
    }
  }

  function add_var_node(x = 100, y = 100, id = null) {
    if (!id && graph.last_node) {
      id = graph.last_node.id + 1;
    } else if (!id) {
      id = graph.var_nodes.length + graph.factor_nodes.length;
    }
    const var_node = new pg.VariableNode(2, id, x, y);
    // var_node.prior.lam = new m.Matrix([[var_lambda, 0], [0, var_lambda]]);
    // var_node.prior.eta = var_node.prior.lam.mmul(new m.Matrix([[x], [y]]));
    // var_node.pass_message(graph);
    graph.var_nodes.push(var_node);
    graph.last_node = var_node;
  }

  function add_factor_node(node1_id, node2_id, id = null) {
    node1_id = parseInt(node1_id);
    node2_id = parseInt(node2_id);
    if (!id && graph.last_node) {
      id = graph.last_node.id + 1;
    } else if (!id) {
      id = graph.var_nodes.length + graph.factor_nodes.length;
    }
    if (
      !graph.find_factor_node(node1_id, node2_id) &&
      graph.find_node(node1_id).type == "var_node" &&
      graph.find_node(node2_id).type == "var_node" &&
      node1_id != node2_id
    ) {
      // No existing connection between node1 and node2
      const factor_node = new pg.LinearFactor(4, id, [node1_id, node2_id]);
      factor_node.messages.push(
        new gauss.Gaussian([[0], [0]], [[0, 0], [0, 0]])
      );
      factor_node.messages.push(
        new gauss.Gaussian([[0], [0]], [[0, 0], [0, 0]])
      );
      graph.factor_nodes.push(factor_node);
      graph.last_node = factor_node;
      graph.find_node(node1_id).adj_ids.push(id);
      graph.find_node(node2_id).adj_ids.push(id);
      return true;
    } else {
      return false;
    }
  }

  function compute_nodes() {
    for (var i = 0; i < graph.var_nodes.length; i++) {
      var var_node = graph.var_nodes[i];
      if (i == 0) {
        var_node.prior.lam = new m.Matrix([[1, 0], [0, 1]]);
      } else {
        var_node.prior.lam = new m.Matrix([[var_lambda, 0], [0, var_lambda]]);
      }
      var_node.prior.eta = var_node.prior.lam.mmul(
        new m.Matrix([[var_node.x], [var_node.y]])
      );
      var_node.pass_message(graph);
    }
    for (var i = 0; i < graph.factor_nodes.length; i++) {
      var factor_node = graph.factor_nodes[i];
      var measurement = new m.Matrix([
        [
          graph.find_node(factor_node.adj_ids[1]).x -
            graph.find_node(factor_node.adj_ids[0]).x +
            random_noise()
        ],
        [
          graph.find_node(factor_node.adj_ids[1]).y -
            graph.find_node(factor_node.adj_ids[0]).y +
            random_noise()
        ]
      ]);
      factor_node.jacs.push(meas_jac);
      factor_node.meas.push(measurement);
      factor_node.lambdas.push(factor_lambda);
      factor_node.adj_var_dofs.push(2);
      factor_node.adj_var_dofs.push(2);
      factor_node.adj_beliefs.push(
        graph.find_node(factor_node.adj_ids[0]).belief
      );
      factor_node.adj_beliefs.push(
        graph.find_node(factor_node.adj_ids[1]).belief
      );
      factor_node.compute_factor();
    }
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
  }

  function mouseup_handler(e) {
    click_time = Date.now() - mousedown_time;
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
            add_factor_node(node_clicked.id, last_node_clicked.id);
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
    node_clicked = e.path.find(element => element.classList == "node_g");
    if (click_time <= click_time_span && mouse_up) {
      if (node_clicked) {
        node_clicked = graph.find_node(node_clicked.id);
        if (node_clicked.type == "var_node") {
          console.log(node_clicked.belief.getMean());
        } else {
          console.log(node_clicked.factor.getMean());
        }

        // Consider as a click
        if (!last_node_clicked) {
          last_node_clicked = node_clicked;
        } else {
          if (
            node_clicked.id == last_node_clicked.id &&
            Date.now() - last_click_time <= double_click_time_span
          ) {
            graph.pass_message(node_clicked.id, node_clicked.id);
            last_node_clicked = null;
          } else if (node_clicked.type != last_node_clicked.type) {
            graph.pass_message(last_node_clicked.id, node_clicked.id);
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

  function update_web_element() {
    document.getElementById("edit_mode_radio_button").checked = edit_mode;
    document.getElementById("play_mode_radio_button").checked = !edit_mode;
    document.getElementById("sync_mode_radio_button").checked = sync_schedule;
    document.getElementById("sweep_mode_radio_button").checked = !sync_schedule;
    document.getElementById("toggle_mean_checkbox").checked = show_mean;
    document.getElementById("toggle_cov_ellipse_checkbox").checked = show_cov_ellipse;
    document.getElementById("toggle_ground_truth_checkbox").checked = show_ground_truth;
  }

  function update_messages() {
    if (message.message) {
      if (Date.now() - message.timestamp >= message.duration) {
        // Clear message if message has passed duration
        message = { message: null, timestamp: null, duration: null };
      }
    }
    if (check_connection_message.message) {
      if (
        Date.now() - check_connection_message.timestamp >=
        check_connection_message.duration
      ) {
        // Clear message if message has passed duration
        check_connection_message = {
          message: null,
          timestamp: null,
          duration: null
        };
      }
    }
  }

  function toggle_mode() {
    edit_mode = (document.getElementById("edit_mode_radio_button").checked &&
                !document.getElementById("play_mode_radio_button").checked);
    compute_nodes();
    last_node_clicked = null;
    passing_message = false;
  }

  function click_add_var_node() {
    add_var_node();
  }

  function toggle_passing_message() {
    passing_message = !passing_message;
  }

  function toggle_schedule() {
    sync_schedule = (document.getElementById("sync_mode_radio_button").checked && 
                    !document.getElementById("sweep_mode_radio_button").checked);
  }

  function toggle_mean() {
    show_mean = document.getElementById("toggle_mean_checkbox").checked;
  }

  function toggle_cov_ellipse() {
    show_cov_ellipse = document.getElementById("toggle_cov_ellipse_checkbox").checked;
  }

  function toggle_ground_truth() {
    show_ground_truth = document.getElementById("toggle_ground_truth_checkbox").checked;
  }

  function update_eta_damping() {
    for (var i = 0; i < graph.factor_nodes.length; i ++) {
      graph.factor_nodes[i].eta_damping = eta_damping;
    }
  }

  function print_graph_detail() {
    console.log(graph);
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
        <radialGradient id="var_cov_gradient">
          <stop offset="0" stop-color="red" stop-opacity="1" />
          <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
        </radialGradient>
      </defs>
      {#if edit_mode}
        {#each connections as connection}
          <g cursor="pointer">
            <line
              x1={connection.x1}
              y1={connection.y1}
              x2={connection.x2}
              y2={connection.y2}
              stroke="black"
              stroke-width="1" />
          </g>
        {/each}
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
      {/if}
      {#if edit_mode}
        {#each factor_nodes as factor_node}
          <g
            class="node_g"
            id={factor_node.id}
            transform="translate({factor_node.x}
            {factor_node.y})"
            cursor="pointer"
            draggable="true">
            <rect
              class="node"
              x={-10}
              y={-10}
              width={20}
              height={20}
              stroke="blue"
              fill="white"
              fill-opacity={0} />
              <g cursor="pointer">
                <text
                  class="node_id"
                  x={0}
                  y={5}
                  text-anchor="middle"
                  stroke="black"
                  font-size={14}
                  style="user-select: none">
                  {factor_node.id}
                </text>
              </g>
          </g>
        {/each}
      {/if}
      {#each var_nodes as var_node, i}
        <g
          class="node_g"
          id={var_node.id}
          cursor="pointer"
          draggable="true">
          {#if edit_mode}
            <circle
              class="node"
              cx={var_node.x}
              cy={var_node.y}
              r={10}
              stroke="red"
              fill="white"
              fill-opacity={0} />
            <g class="unselectable">
              <text
                class="node_text"
                x={var_node.x}
                y={var_node.y + 5}
                text-anchor="middle"
                stroke="black"
                font-size={14}
                style="user-select: none">
                {var_node.id}
              </text>
            </g>
          {:else}
            {#if show_cov_ellipse}
              <ellipse
                cx={var_node.cx}
                cy={var_node.cy}
                rx={var_node.rx}
                ry={var_node.ry}
                transform="rotate({var_node.angle})"
                stroke="red"
                stroke-opacity={0.25}
                fill="url(#var_cov_gradient)" />
            {/if}
            {#if show_mean}
              <circle 
                class="node_mean" 
                cx={var_node.cx}
                cy={var_node.cy}
                r={2}
                stroke="yellow"
                fill="yellow" />
            {/if}
            {#if show_ground_truth}
              <circle 
                class="node_ground_truth" 
                cx={var_node.x}
                cy={var_node.y}
                r={2}
                stroke="green"
                fill="green" />
            {/if}
          {/if}
        </g>
      {/each}
    </svg>
  </div>

  <div id="playground-settings-panel">
    <div>
    <b>Total Error: {total_error_distance}</b>
    </div>
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
    <div>
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
            Pause Passing Message
          </button>
        </label>
      {:else}
        <label>
          <button
            type="button"
            class="btn"
            on:click={toggle_passing_message}
            style="width:200px; border:2px solid black">
            Start Passing Message
          </button>
        </label>
      {/if}
      <!-- <label>
        <button
          type="button"
          class="btn"
          on:click={check_connection}
          style="width:200px; border:2px solid black">
          {#if check_connection_message.message}
            <p font-size="12" style="display:inline; color:red">
              {check_connection_message.message}
            </p>
          {:else}
            <p font-size="12" style="display:inline; color:black">
              Check Connection
            </p>
          {/if}
        </button>
      </label> -->
      <label>
        <button
          type="button"
          class="btn"
          on:click={reset_playground}
          style="width:200px; border:2px solid black">
          Reset Playground
        </button>
      </label>
      <label>
        <button
          type="button"
          class="btn"
          on:click={print_graph_detail}
          style="width:200px; border:2px solid black">
          Show Graph Details
        </button>
      </label>
      Message Passing Schedule:
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
      <label>
        &eta Damping: <b>{eta_damping}</b>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          bind:value={eta_damping}
          on:change={update_eta_damping}
          style="width:200px;" />
      </label>
      <label>
        Iteration Interval: <b>{iter_sec}</b> sec
        <input
          type="range"
          min="0.1"
          max="5"
          step={time_res}
          bind:value={iter_sec}
          style="width:200px;" />
      </label>
      <label style="user-select: none">
        <input
          type="checkbox"
          id="toggle_mean_checkbox"
          on:click={toggle_mean} />
        Show Belief Mean
      </label>
      <label style="user-select: none">
        <input
          type="checkbox"
          id="toggle_cov_ellipse_checkbox"
          on:click={toggle_cov_ellipse} />
        Show Covariance Ellipse
      </label>
      <label style="user-select: none">
        <input
          type="checkbox"
          id="toggle_ground_truth_checkbox"
          on:click={toggle_ground_truth} />
        Show Ground Truth
      </label>
    </div>
    <div>
      {#if message.message}
        <p transition:fade font-size="14">{message.message}</p>
      {/if}
    </div>
  </div>
</div>
