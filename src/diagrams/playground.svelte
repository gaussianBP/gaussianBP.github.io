<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import * as pg from "../playground/playground.js";
  import { onInterval } from "../util.js";
  import * as m from 'ml-matrix';

  // svg
  let svg;
  let svg_width = 600;
  let svg_height = 400;

  // Playground
  let graph;
  let n_var_nodes = 2;
  let n_factor_nodes = 1;

  // Drag and drop function
  let mousedown_time = null;
  var node_mousedown = null;
  var connection_mousedown = null;
  var node_clicked = null;
  let last_node_clicked = false;
  var connection_clicked = null;
  var last_connection_clicked = null;
  let current_mouse_location = { x: null, y: null };

  // Message passing animation
  let source_node = null;
  let target_node = null;

  // UI
  let display_node_text = true;
  let message = { message: null, timestamp: null, duration: null };
  let check_connection_message = {
    message: null,
    timestamp: null,
    duration: null
  };
  let edit_mode = true;

  $: var_nodes = [];
  $: factor_nodes = [];
  $: connections = [];

  onMount(() => {
    graph = pg.create_new_playground(n_var_nodes, n_factor_nodes);
    reset_playground();
  });

  onInterval(() => update_playground(), 25);

  function update_playground() {
    graph.update_node_id();
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;
    update_connection();
    update_messages();
  }

  function update_connection() {
    connections = [];
    for (let i = 0; i < graph.factor_nodes.length; i++) {
      let factor_node = graph.factor_nodes[i];
      for (let j = 0; j < factor_node.adj_var_ids.length; j++) {
        let var_node = graph.find_node(factor_node.adj_var_ids[j]);
        let connection = {
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

  function add_var_node() {
    graph.add_var_node(100, 100);
  }

  function add_factor_node() {
    graph.add_factor_node(100, 100);
  }

  function reset_playground() {
    console.clear();
    var_nodes = [];
    factor_nodes = [];
    connections = [];
    graph = pg.create_new_playground(n_var_nodes, n_factor_nodes);
    update_playground();
    update_web_element();
    graph.var_nodes[0].prior.eta = new m.Matrix([[graph.var_nodes[0].x], [graph.var_nodes[0].y]]);
    graph.var_nodes[0].prior.lam = new m.Matrix([[1, 0], [0, 1]]);  // strong prior for first measurement
  }

  function find_connection(id) {
    let connection = connections.filter(
      connection => connection.id == parseInt(connection_clicked.id)
    )[0];
    if (connection) {
      return connection;
    } else {
      return null;
    }
  }

  function mousedown_handler(e) {
    node_mousedown = null;
    node_mousedown = e.path.find(element => element.classList == "g_node");
    mousedown_time = Date.now();
    if (node_mousedown) {
      node_mousedown = graph.find_node((node_mousedown = node_mousedown.id));
    }
  }

  function mousemove_handler(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    current_mouse_location = {
      x: e.clientX - rect.x,
      y: e.clientY - rect.y
    };
    if (node_mousedown && !last_node_clicked && edit_mode) {
      node_mousedown.x = current_mouse_location.x;
      node_mousedown.y = current_mouse_location.y;
    }
  }

  function mouseup_handler(e) {
    node_mousedown = null;
    connection_mousedown = null;
  }

  function click_handler(e) {
    if (edit_mode) {
      edit_click_handler(e);
    } else {
      play_click_handler(e);
    }
  }

  function edit_click_handler(e) {
    node_clicked = null;
    connection_clicked = null;
    node_clicked = e.path.find(element => element.classList == "g_node");
    connection_clicked = e.path.find(
      element => element.classList == "line_connection"
    );

    if (Date.now() - mousedown_time <= 100) {
      // If time between mousedown and mouseup is short, consider as a click
      if (node_clicked) {
        // When a node is clicked
        node_clicked = graph.find_node(node_clicked.id);
        if (!last_node_clicked) {
          // No node clicked before, initiate adding connection, save current node as starting point
          last_node_clicked = node_clicked;
        } else {
          // This is the second click
          if (node_clicked.id == last_node_clicked.id) {
            // Remove the node if double clicked the same node
            graph.remove_node(node_clicked.id);
            last_node_clicked = null;
            node_clicked = null;
          } else if (
            graph.add_connection(last_node_clicked.id, node_clicked.id)
          ) {
            // Successfully added a new connection
            console.log(
              "Added connection between",
              last_node_clicked.id,
              "and",
              node_clicked.id
            );
          } else {
            // Unable to add new connection
            console.log(
              "Failed to add connection between",
              last_node_clicked.id,
              "and",
              node_clicked.id
            );
          }
          last_node_clicked = null;
          node_clicked = null;
        }
      } else if (connection_clicked && !node_clicked) {
        // Clicked on a connection
        if (last_connection_clicked == connection_clicked) {
          // Doubleclick the same connection to remove it
          connection_clicked = find_connection(connection_clicked.id);
          if (connection_clicked) {
            // If the connection is valid
            graph.remove_connection(
              connection_clicked.var_id,
              connection_clicked.factor_id
            );
          }
          connection_clicked = null;
          last_connection_clicked = null;
        } else {
          // First time clicking on a connection
          last_connection_clicked = connection_clicked;
        }
      } else if (last_node_clicked && !node_clicked) {
        // Did not click on a node while adding connection, cancel
        last_node_clicked = null;
        node_clicked = null;
      }
    }
  }

  function play_click_handler(e) {
    // TODO: Change node color when selected as source or target node
    node_clicked = null;
    connection_clicked = null;
    node_clicked = e.path.find(element => element.classList == "g_node");
    connection_clicked = e.path.find(
      element => element.classList == "line_connection"
    );

    if (node_clicked) {
      // When a node is clicked
      node_clicked = graph.find_node(node_clicked.id);
      if (!last_node_clicked) {
        // Select source node
        last_node_clicked = node_clicked;
      } else {
        // This is the second click
        if (graph.pass_message(node_clicked.id, last_node_clicked.id)) {
          // Connection exists
          console.log(
            "Passed message from",
            last_node_clicked.id,
            "to",
            node_clicked.id
          );
        } else {
          console.log(
            "Failed to pass message from",
            last_node_clicked.id,
            "to",
            node_clicked.id
          );
        }
        last_node_clicked = null;
        node_clicked = null;
      }
    } else if (last_node_clicked && !node_clicked) {
      // Did not click on a target node for message passing
      last_node_clicked = null;
      node_clicked = null;
    }
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
    document.getElementById(
      "toggle_node_text_display_checkbox"
    ).checked = display_node_text;
    if (edit_mode) {
      document.getElementById("edit_mode_radio_button").checked = true;
    } else {
      document.getElementById("play_mode_radio_button").checked = true;
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

  function toggle_mode() {
    edit_mode = !edit_mode;
    node_clicked = null;
    last_node_clicked = null;
    connection_clicked = null;
    last_connection_clicked = null;
  }

  function toggle_node_text_display() {
    display_node_text = !display_node_text;
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
      {#if last_node_clicked && edit_mode}
        <line
          x1={last_node_clicked.x}
          y1={last_node_clicked.y}
          x2={current_mouse_location.x}
          y2={current_mouse_location.y}
          stroke="black"
          stroke-width="1" />
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
              stroke={'blue'}
              fill={'white'} />
            {#if display_node_text}
              <g cursor="pointer">
                <text
                  class="node_id"
                  x={0}
                  y={5}
                  text-anchor={'middle'}
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
            <circle
              class="node"
              cx={0}
              cy={0}
              r={10}
              stroke={'red'}
              fill={'white'} />
            {#if display_node_text}
              <g class="unselectable">
                <text
                  class="node_id"
                  x={0}
                  y={5}
                  text-anchor={'middle'}
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
    <label>
      <input
        type="radio"
        id="edit_mode_radio_button"
        name="toggle_mode_radio_button"
        on:click={toggle_mode} />
      Edit Mode
    </label>
    <br />
    <label>
      <input
        type="radio"
        id="play_mode_radio_button"
        name="toggle_mode_radio_button"
        on:click={toggle_mode} />
      Play Mode
    </label>
    <div>
      <label>
        <button
          type="button"
          class="btn"
          on:click={add_var_node}
          style="width:200px; border:2px solid black">
          Add Variable Node
        </button>
      </label>
      <label>
        <button
          type="button"
          class="btn"
          on:click={add_factor_node}
          style="width:200px; border:2px solid black">
          Add Factor Node
        </button>
      </label>
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
      <label style="user-select: none">
        <input
          type="checkbox"
          id="toggle_node_text_display_checkbox"
          value={display_node_text}
          on:click={toggle_node_text_display} />
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
