<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import * as pg from "../playground/playground.js";
  import { onInterval } from "../util.js";
  import * as m from "ml-matrix";
  import * as r from "random";
  import * as gauss from "../gaussian";

  // GBP
  const meas_jac = new m.Matrix([[-1, 0, 1, 0], [0, -1, 0, 1]]);
  const var_node_prior_std = 30;
  const factor_node_prior_std = 50;
  const random_noise = r.normal(0, 10);
  var sec_per_iter = 1.5;

  // svg
  var svg;
  var svg_width = 600;
  var svg_height = 400;

  // Playground
  var graph;
  var n_var_nodes = 10;
  var sync_schedule = true;
  var message_idx = 0;

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
  var edit_mode = true;
  var pass_message = false;
  var show_node_text = true;
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

  onInterval(() => update_playground(), 25);

  onInterval(() => update_node_message(), sec_per_iter * 1000);

  function create_new_playground(n_var_nodes = 2) {
    graph = new pg.FactorGraph();
    const var_node = new pg.VariableNode(2, 0, 50, 50);
    var_node.prior.lam = new m.Matrix([[1, 0], [0, 1]]);
    var_node.prior.eta = var_node.prior.lam.mmul(new m.Matrix([[50], [50]]));
    var_node.update_node();
    graph.var_nodes.push(var_node);
    graph.last_node = var_node;
    for (var i = 1; i < n_var_nodes; i++) {
      add_var_node(50 + 50 * i, 50, i * 2);
      if (i > 0) {
        add_factor_node(graph.var_nodes[i - 1].id, graph.var_nodes[i].id, i * 2 - 1);
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
    graph.var_nodes[0].prior.eta = new m.Matrix([
      [graph.var_nodes[0].x],
      [graph.var_nodes[0].y]
    ]);
    graph.var_nodes[0].prior.lam = new m.Matrix([[1, 0], [0, 1]]); // strong prior for first measurement
  }

  function update_playground() {
    graph.update_node_id();
    graph.update_factor_node_location();
    graph.update_node_cov_ellipse();
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;
    update_connection();
    update_messages();
  }

  function update_node_message() {
    // FIXME: Change update interval based on range slider value
    if (!edit_mode && pass_message && sync_schedule) {
      graph.sync_graph();
    }
    else if (!edit_mode && pass_message && !sync_schedule) {
      if (message_idx >= graph.var_nodes.length + graph.factor_nodes.length) {
        message_idx = 0;
      }
      graph.find_node(message_idx).update_node(graph);
      console.log(graph.find_node(message_idx).type, graph.find_node(message_idx).id);
      message_idx ++;
    }
  }

  function update_connection() {
    connections = [];
    for (var i = 0; i < graph.factor_nodes.length; i++) {
      var factor_node = graph.factor_nodes[i];
      for (var j = 0; j < factor_node.adj_ids.length; j++) {
        var var_node = graph.find_node(factor_node.adj_ids[j]);
        var connection = {
          id: i,
          var_id: var_node.id,
          factor_id: factor_node.id,
          x1: var_node.x,
          y1: var_node.y,
          x2: factor_node.x,
          y2: factor_node.y
        };
        connections.push(connection);
      }
    }
  }

  function add_var_node(x = 100, y = 100, id = null) {
    var var_node;
    if (!id && graph.last_node) {
      id = graph.last_node.id + 1;
    }
    else if (!id) {
      id = graph.var_nodes.length + graph.factor_nodes.length;
    }
    var_node = new pg.VariableNode(2, id, x, y);
    var lambda = 1 / Math.pow(var_node_prior_std, 2);
    var_node.prior.lam = new m.Matrix([[lambda, 0], [0, lambda]]);
    var_node.prior.eta = var_node.prior.lam.mmul(new m.Matrix([[x], [y]]));
    var_node.update_node();
    graph.var_nodes.push(var_node);
    graph.last_node = var_node;
  }

  function add_factor_node(node1_id, node2_id, id = null) {
    node1_id = parseInt(node1_id);
    node2_id = parseInt(node2_id);
    if (!id && graph.last_node) {
      id = graph.last_node.id + 1;
    }
    else if (!id) {
      id = graph.var_nodes.length + graph.factor_nodes.length;
    }
    if (
      !graph.find_factor_node(node1_id, node2_id) &&
      graph.find_node(node1_id).type == "var_node" &&
      graph.find_node(node2_id).type == "var_node" &&
      node1_id != node2_id
    ) {
      // No existing connection between node1 and node2
      const factor_node = new pg.LinearFactor(4, id, [
        node1_id,
        node2_id
      ]);
      const measurement = new m.Matrix([
        [
          graph.find_node(node1_id).x -
            graph.find_node(node2_id).x +
            random_noise()
        ],
        [
          graph.find_node(node1_id).y -
            graph.find_node(node2_id).y +
            random_noise()
        ]
      ]);
      factor_node.jacs.push(meas_jac);
      factor_node.meas.push(measurement);
      factor_node.lambdas.push(1 / Math.pow(factor_node_prior_std, 2));
      factor_node.adj_var_dofs.push(2);
      factor_node.adj_var_dofs.push(2);
      factor_node.adj_beliefs.push(graph.find_node(node1_id).belief);
      factor_node.adj_beliefs.push(graph.find_node(node2_id).belief);
      factor_node.messages.push(
        new gauss.Gaussian([[0], [0]], [[0, 0], [0, 0]])
      );
      factor_node.messages.push(
        new gauss.Gaussian([[0], [0]], [[0, 0], [0, 0]])
      );
      factor_node.compute_factor();
      graph.factor_nodes.push(factor_node);
      graph.last_node = factor_node;
      graph.find_node(node1_id).adj_ids.push(id);
      graph.find_node(node2_id).adj_ids.push(id);
      // console.log("Added connection between", node1_id, "and", node2_id);
      return true;
    } else {
      // console.log(
      //   "Could not add connection between",
      //   node1_id,
      //   "and",
      //   node2_id
      // );
      return false;
    }
  }

  function mousedown_handler(e) {
    mouse_up = false;
    node_mousedown = null;
    node_mousedown = e.path.find(element => element.classList == "g_node");
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
    // edit_click_handler(e);
  }

  function click_handler(e) {
    if (edit_mode) {
      edit_click_handler(e);
    } else {
      play_click_handler(e);
    }
  }

  function edit_click_handler(e) {
    // FIXME:
    node_clicked = null;
    node_clicked = e.path.find(element => element.classList == "g_node");
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
    // FIXME:
    node_clicked = null;
    node_clicked = e.path.find(element => element.classList == "g_node");
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
            // TODO:
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

  function check_connection() {
    if (graph.check_connection()) {
      check_connection_message = {
        message: "Connections are good!",
        timestamp: Date.now(),
        duration: 3000
      };
    } else {
      check_connection_message = {
        message: "Missing connections!",
        timestamp: Date.now(),
        duration: 3000
      };
    }
  }

  function update_web_element() {
    if (edit_mode) {
      document.getElementById("edit_mode_radio_button").checked = true;
    } else {
      document.getElementById("play_mode_radio_button").checked = true;
    }
    document.getElementById(
      "toggle_node_text_display_checkbox"
    ).checked = show_node_text;
    if (sync_schedule) {
      document.getElementById("sync_mode_radio_button").checked = true;
    } else {
      document.getElementById("sweep_mode_radio_button").checked = true;
    }
    
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

  function click_add_var_node() {
    add_var_node();
  }

  function toggle_mode() {
    edit_mode = !edit_mode;
    last_node_clicked = null;
    pass_message = false;
  }

  function toggle_pass_message() {
    pass_message = !pass_message;
  }

  function toggle_schedule() {
    sync_schedule = !sync_schedule;
  }

  function toggle_node_text() {
    show_node_text = !show_node_text;
  }

  function console_output() {
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
      {#each connections as connection}
        <g cursor="pointer" draggable="true">
          <line
            class="line_connection"
            id={connection.id}
            x1={connection.x1}
            y1={connection.y1}
            x2={connection.x2}
            y2={connection.y2}
            stroke="#D3D3D3"
            stroke-width="7" />
        </g>
      {/each}
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
      <g>
        {#each factor_nodes as factor_node}
          <g
            class="g_node"
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
              fill="white" />
            {#if show_node_text}
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
            {/if}
          </g>
        {/each}
        {#each var_nodes as var_node, i}
          <g
            class="g_node"
            id={var_node.id}
            transform="translate({var_node.x}
            {var_node.y})"
            cursor="pointer"
            draggable="true">
            {#if !edit_mode}
              <ellipse
                cx={0}
                cy={0}
                rx={var_node.rx}
                ry={var_node.ry}
                transform="rotate({var_node.angle})"
                stroke="red"
                stroke-opacity={0.5}
                fill="none" />
            {/if}
            <circle
              class="node"
              cx={0}
              cy={0}
              r={10}
              stroke="red"
              fill="white" />
            {#if show_node_text}
              <g class="unselectable">
                <text
                  class="node_id"
                  x={0}
                  y={5}
                  text-anchor='middle'
                  stroke="black"
                  font-size={14}
                  style="user-select: none">
                  {var_node.id}
                </text>
              </g>
            {/if}
          </g>
        {/each}
      </g>
    </svg>
  </div>

  <div id="playground-settings-panel">
    <label class="radio-inline">
      <input
        type="radio"
        id="edit_mode_radio_button"
        name="toggle_mode_radio_button"
        on:click={toggle_mode} />
      Edit Mode
    </label>
    <label class="radio-inline">
      <input
        type="radio"
        id="play_mode_radio_button"
        name="toggle_mode_radio_button"
        on:click={toggle_mode} />
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
      {:else}
        {#if pass_message}
          <label>
            <button
              type="button"
              class="btn"
              on:click={toggle_pass_message}
              style="width:200px; border:2px solid black">
              Pause Passing Message
            </button>
          </label>
        {:else}
          <label>
            <button
              type="button"
              class="btn"
              on:click={toggle_pass_message}
              style="width:200px; border:2px solid black">
              Start Passing Message
            </button>
          </label>
        {/if}
      {/if}
      <label>
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
      </label>
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
          on:click={console_output}
          style="width:200px; border:2px solid black">
          Console Output
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
      <b>{sec_per_iter}</b> sec per iteration:
      <input type="range" min="0.1" max="5" step="0.1" bind:value={sec_per_iter} style="width:200px;">
      </label>
      <label style="user-select: none">
        <input
          type="checkbox"
          id="toggle_node_text_display_checkbox"
          value={show_node_text}
          on:click={toggle_node_text} />
        Toggle Node Text
      </label>
    </div>
    <div>
      {#if message.message}
        <p transition:fade font-size="14">{message.message}</p>
      {/if}
    </div>
  </div>
</div>
