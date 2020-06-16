<script>
  import { onMount } from "svelte";
  import * as pg from "../playground/playground.js";
  import { onInterval } from "../util.js";
  import { event as currentEvent } from "d3";

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
  let node_double_click = false;
  var connection_clicked = null;
  var last_connection_clicked = null;
  let connection_node1 = null;
  let connection_node2 = null;
  let current_mouse_location = { x: null, y: null };

  // UI
  let display_node_text = false;
  let x_offset = 72;
  let y_offset = 250;

  $: var_nodes = [];
  $: factor_nodes = [];
  $: connections = [];

  onMount(() => {
    graph = pg.createNewPlayground(n_var_nodes, n_factor_nodes);
    // random_location();
    update_playground();
  });

  onInterval(() => update_playground(), 25);

  function update_playground() {
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;
    update_connection();
  }

  function update_connection() {
    connections = [];
    for (let i = 0; i < graph.var_nodes.length; i++) {
      let var_node = graph.var_nodes[i];
      for (let j = 0; j < var_node.adj_factor_ids.length; j++) {
        let factor_node = graph.find_node(var_node.adj_factor_ids[j]);
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
    let location = random_location();
    graph.add_var_node(location.x, location.y);
  }

  function add_factor_node() {
    let location = random_location();
    graph.add_factor_node(location.x, location.y);
  }

  function random_location() {
    return {
      x: Math.random() * (svg_width - x_offset * 2) + x_offset,
      y: Math.random() * (svg_height - y_offset * 2) + y_offset
    };
  }

  function reset_playground() {
    console.clear();
    var_nodes = [];
    factor_nodes = [];
    connections = [];
    graph = pg.createNewPlayground(n_var_nodes, n_factor_nodes);
    update_playground();
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
    current_mouse_location = {
      x: e.clientX - x_offset,
      y: e.clientY - y_offset
    };
    if (node_mousedown && !node_double_click) {
      node_mousedown.x = current_mouse_location.x;
      node_mousedown.y = current_mouse_location.y;
    }
  }

  function mouseup_handler(e) {
    node_mousedown = null;
    connection_mousedown = null;
  }

  function click_handler(e) {
    node_clicked = null;
    connection_clicked = null;
    node_clicked = e.path.find(element => element.classList == "g_node");
    connection_clicked = e.path.find(
      element => element.classList == "g_connection"
    );
    if (Date.now() - mousedown_time <= 100) {
      // If time between mousedown and mouseup is short, consider as a click
      if (node_clicked) {
        // When a node is clicked
        if (!node_double_click) {
          // Clicked first node, initiate adding connection, save current node as starting point
          connection_node1 = graph.find_node(node_clicked.id);
          node_double_click = true;
        } else if (node_double_click) {
          connection_node2 = graph.find_node(node_clicked.id);
          if (connection_node1 == connection_node2) {
            // Remove the node if double-clicked
            graph.remove_node(node_clicked.id);
            node_double_click = false;
            connection_node1 = null;
            connection_node2 = null;
          } else if (
            graph.add_node_connection(connection_node1.id, connection_node2.id)
          ) {
            // Successfully added a new connection
            node_double_click = false;
            connection_node1 = null;
            connection_node2 = null;
          }
        }
      } else if (connection_clicked) {
        if (last_connection_clicked == connection_clicked) {
          let connection = connections.filter(
            connection => connection.id == parseInt(connection_clicked.id)
          )[0];
          if (connection) {
            graph.remove_node_connection(
              connection.var_id,
              connection.factor_id
            );
            update_playground();
          }
          last_connection_clicked = null;
        } else {
          last_connection_clicked = connection_clicked;
        }
      } else if (node_double_click && !node_clicked) {
        // Did not click on a node while adding connection, cancel
        node_double_click = false;
        connection_node1 = null;
        connection_node2 = null;
      }
    }
  }

  function toggle_node_text_display() {
    display_node_text = !display_node_text;
  }

  // on:dblclick={doubleclick_handler}
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
      cursor="pointer"
      on:mousedown={mousedown_handler}
      on:mousemove={mousemove_handler}
      on:mouseup={mouseup_handler}
      on:click={click_handler}>
      {#each connections as connection}
        <g
          class="g_connection"
          id={connection.id}
          transform="translate({connection.x1}
          {connection.y1})"
          draggable="true">
          <line
            x1={0}
            y1={0}
            x2={connection.x2 - connection.x1}
            y2={connection.y2 - connection.y1}
            stroke="#D3D3D3"
            stroke-width="5" />
          <line
            x1={0}
            y1={0}
            x2={connection.x2 - connection.x1}
            y2={connection.y2 - connection.y1}
            stroke="black"
            stroke-width="2" />
        </g>
      {/each}
      {#if node_double_click}
        <line
          x1={connection_node1.x}
          y1={connection_node1.y}
          x2={current_mouse_location.x}
          y2={current_mouse_location.y}
          stroke="black"
          stroke-width="2" />
      {/if}
      {#each factor_nodes as factor_node}
        <g
          class="g_node"
          id={factor_node.id}
          transform="translate({factor_node.x}
          {factor_node.y})"
          draggable="true">
          <rect
            x={-10}
            y={-10}
            width={20}
            height={20}
            stroke={'blue'}
            fill={'white'} />
          {#if display_node_text}
            <text
              x={0}
              y={5}
              text-anchor={'middle'}
              stroke="black"
              font-size={14}>
              {factor_node.id}
            </text>
          {/if}
        </g>
      {/each}
      {#each var_nodes as var_node, i}
        <g
          class="g_node"
          id={var_node.id}
          transform="translate({var_node.x}
          {var_node.y})"
          draggable="true">
          <circle cx={0} cy={0} r={10} stroke={'red'} fill={'white'} />
          {#if display_node_text}
            <text
              x={0}
              y={5}
              text-anchor={'middle'}
              stroke="black"
              font-size={14}>
              {var_node.id}
            </text>
          {/if}
        </g>
      {/each}
    </svg>
  </div>

  <div id="playground-settings-panel">
    <label>
      <button
        type="button"
        class="btn btn-primary"
        on:click={add_var_node}
        style="width:200px; border:2px solid black">
        Add Variable Node
      </button>
    </label>
    <label>
      <button
        type="button"
        class="btn btn-primary"
        on:click={add_factor_node}
        style="width:200px; border:2px solid black">
        Add Factor Node
      </button>
    </label>
    <label>
      <button
        type="button"
        class="btn btn-primary"
        on:click={reset_playground}
        style="width:200px; border:2px solid black">
        Reset Playground
      </button>
    </label>
    <label>
      <input
        type="checkbox"
        value={display_node_text}
        on:click={toggle_node_text_display} />
      Toggle Node Text
    </label>
  </div>
</div>
