<script>
  import { onMount } from "svelte";
  import * as pg from "../playground/playground.js";
  import { onInterval } from '../util.js';
  
  let svg;
  let svg_width = 1300;
  let svg_height = 960;
  let graph;
  let n_var_nodes = 2;
  let n_factor_nodes = 1;


  $: var_nodes = [];
  $: factor_nodes = [];
  $: connections = [];

  onMount(() => {
    graph = pg.createNewPlayground(n_var_nodes, n_factor_nodes);
    random_location();
    update_playground();
  });


  onInterval(() => update_playground(), 25);

  function update_connection() {
    connections = [];
    for (let i = 0; i < graph.var_nodes.length; i ++) {
      let var_node = graph.var_nodes[i];
      for (let j = 0; j < var_node.adj_factor_ids.length; j ++){
        let factor_node = graph.find_factor_node(var_node.adj_factor_ids[j]);
        connections.push({x1: var_node.x, y1: var_node.y, x2: factor_node.x, y2: factor_node.y});
      }
    }
  }

  function update_playground() {
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;
    update_connection();
  }

  function add_var_node() {
    graph.add_var_node(Math.random() * (svg_width - 400), Math.random() * (svg_height - 400));
    graph.add_node_connection(graph.var_nodes[graph.var_nodes.length - 1].var_id, 
                              graph.factor_nodes[graph.factor_nodes.length - 1].factor_id);
    console.log('Added one variable node');
    console.log(graph);
  }

  function add_factor_node() {
    graph.add_factor_node(Math.random() * (svg_width - 400), Math.random() * (svg_height - 400));
    graph.add_node_connection(graph.var_nodes[graph.var_nodes.length - 1].var_id, 
                              graph.factor_nodes[graph.factor_nodes.length - 1].factor_id);
    console.log('Added one factor node');
    console.log(graph);
  }

  function clear_graph() {
    console.clear();
    var_nodes = [];
    factor_nodes = [];
    connections = [];
    graph = pg.createNewPlayground(n_var_nodes, n_factor_nodes);
    random_location();
    update_playground();
  }

  function random_location() {
    for (let i = 0; i < graph.var_nodes.length; i ++) {
      graph.var_nodes[i].x = Math.random() * (svg_width - 400);
      graph.var_nodes[i].y = Math.random() * (svg_height - 400);
    }
    for (let i = 0; i < graph.factor_nodes.length; i ++) {
      graph.factor_nodes[i].x = Math.random() * (svg_width - 400);
      graph.factor_nodes[i].y = Math.random() * (svg_height - 400);
    }
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
    <svg bind:this={svg} width={svg_width} height={svg_height} on:click={random_location}>
      {#each var_nodes as var_node}
        <circle cx={var_node.x} cy={var_node.y} r={20} fill={"red"}></circle>
        <text x={var_node.x} y={var_node.y} stroke="black">{var_node.var_id}</text>
      {/each}
      {#each factor_nodes as factor_node}
        <rect x={factor_node.x - 10} y={factor_node.y - 10} width={20} height={20} fill={"blue"}></rect>
        <text x={factor_node.x} y={factor_node.y} stroke="black">{factor_node.factor_id}</text>
      {/each}
      {#each connections as connection}
        <line x1={connection.x1} y1={connection.y1} x2={connection.x2} y2={connection.y2} stroke="black"></line>
      {/each}
    </svg>
  </div>

  <div id="playground-settings-panel">
    <button
      type="button"
      class="btn btn-primary"
      on:click={add_var_node}
      style="width:200px">
      Add Variable Node
    </button>
    <br><br>
    <button
      type="button"
      class="btn btn-primary"
      on:click={add_factor_node}
      style="width:200px">
      Add Factor Node
    </button>
    <br><br>
    <button
      type="button"
      class="btn btn-primary"
      on:click={clear_graph}
      style="width:200px">
      Clear Graph
    </button>
    <br><br>
    Number of Variable Node: {n_var_nodes}
    <input type="range" min="2" max="10" bind:value={n_var_nodes} on:input={clear_graph}>
    <br><br>
    Number of Factor Node: {n_factor_nodes}
    <input type="range" min="1" max="10" bind:value={n_factor_nodes} on:input={clear_graph}>
  </div>
</div>
