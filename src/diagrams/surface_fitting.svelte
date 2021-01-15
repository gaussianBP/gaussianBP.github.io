<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import * as m from "ml-matrix";
  import * as gauss from '../utils/gaussian';
  import * as gbp from "../gbp/gbp_surface_fitting.js";
  import { onInterval } from "../utils/util.js";

  // Visual varaibles
  let canvas;
  let svg;
  let svg_width = 800;
  let svg_height = 380;
  let x_offset;
  let x_spacing;

  let stroke_width = 3;
  let radius;
  let then; // time of start of vis
  let display_map = false;
  let visible_alert = false;

  // Measurement model std
  let meas_model_std = 50;
  let smoothness_std = 50;
  const smoothness_jac = new m.Matrix([[-1, 1]]);

  // GBP variables
  let graph;
  const n_var_nodes = 10;
  const n_measurements = 6;
  let measurements = [];

  let meas_count = 0;

  let gbp_on = false;

  let schedule = "sweep";
  let GBP_sweep_done = false;

  let n_iters = 0;
  let iters_per_sec = 2.5;
  let dist = 0; // Average distance of belief means from MAP solution

  let show_MAP = false;

  $: var_nodes = [];
  $: factors = [];
  let var_line;
  let meas_line;
  let map_line;

  const map_color = "green";

  var line = d3.line()
		.x(d => d.x)
		.y(d => d.y)
		.curve(d3.curveBasis);

  onMount(() => {

    x_offset = svg_width / (2 * n_var_nodes);
    x_spacing = (svg_width - x_offset * 2) / (n_var_nodes - 1);

    graph = gbp.create1Dgraph(n_var_nodes, x_offset, x_spacing, smoothness_std);
    meas_count = 0;

    var_nodes = graph.var_nodes;
    factors = graph.factors;

    radius = svg_height / 38;
    genRandomMeasurements(n_measurements, measurements);
	  then = Date.now();
	
  });

  onInterval(() => updateVis(), 25);

  function generateLine(nodes) {
    let line_data = [];
    for (let i = 0; i < nodes.length; i++) {
      line_data.push({x: nodes[i].x, y: nodes[i].y});
    }
    let path = line(line_data);
    return path
  }

  function updateVis() {


    var fpsInterval = 1000 / iters_per_sec;
    var now = Date.now();
    var elapsed = now - then;
    if (elapsed > fpsInterval) {
      then = now - (elapsed % fpsInterval);
      if (gbp_on) {
        if (schedule == "sweep") {
          graph.sweep_step();
          if (graph.forward == 1 && graph.sweep_ix == 0) {
            // Back and forth sweep complete
            GBP_sweep_done = true;
            gbp_on = false;
          }
        } else if (schedule == "sync") {
          syncGBP();
        }
      } 
    }

    if (show_MAP) {
      if (graph.count_meas() == 0) {
        visible_alert = true;
        show_MAP = false;
      } else {
        graph.computeMAP();
      }
    }

    // In callback so sliders update the graph during drag
    update_meas_model_std();
    update_smoothness_std();

    var_nodes = graph.var_nodes;
    factors = graph.factors;

  }


  // GBP functions
  function syncGBP() {
    if (n_iters == 0 && GBP_sweep_done) {
      // Set initial position of nodes
      for (let c = 0; c < graph.var_nodes.length; c++) {
        graph.var_nodes[c].belief.eta = new m.Matrix([[0.05]]);
        graph.var_nodes[c].belief.lam = new m.Matrix([[1e-4]]);
      }
    }
    graph.sync_iter();
    if (!(n_iters == 0)) {
      dist = graph.compare_to_MAP();
    }
    n_iters++;
  }

  function click_handler(e) {

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.x;
    const y = e.clientY - rect.y;

    visible_alert = false;
    if (
      x > x_offset &&
      x < svg_width - x_offset &&
      y > 0 &&
      y < svg_height
    ) {
      var ix = (x - x_offset) / x_spacing;
      var x_lhs = x_offset + Math.floor(ix) * x_spacing;
      var x_rhs = x_offset + Math.ceil(ix) * x_spacing;
      graph.addLinearMeasurement(
        y,
        x,
        [Math.floor(ix), Math.ceil(ix)],
        x_lhs,
        x_rhs,
        meas_model_std
      );
      meas_count += 1;
    } 
  }


  function genRandomMeasurements() {
    visible_alert = false;

    for (var i = 0; i < n_measurements; i++) {
      var x = Math.random() * (svg_width - 2 * x_offset) + x_offset;
      var y = Math.random() * (svg_height - 5 * x_offset) + 2*x_offset;
      var ix = (x - x_offset) / x_spacing;
      var x_lhs = x_offset + Math.floor(ix) * x_spacing;
      var x_rhs = x_offset + Math.ceil(ix) * x_spacing;
      graph.addLinearMeasurement(
        y,
        x,
        [Math.floor(ix), Math.ceil(ix)],
        x_lhs,
        x_rhs,
        meas_model_std
      );
      meas_count += 1;
    }
  }

  function newRandMeasurements() {
    n_iters = 0;
    const show_MAP_copy = show_MAP;
    clearMeasurements();
    genRandomMeasurements(n_measurements, measurements);
    show_MAP = show_MAP_copy;
  }

  function clearMeasurements() {
    show_MAP = false;
    gbp_on = false;
    n_iters = 0;

    graph = gbp.create1Dgraph(n_var_nodes, x_offset, x_spacing, smoothness_std);
    meas_count = 0;
  }

  function clearBeliefs() {
    for (let i=0; i < graph.var_nodes.length; i++) {
      graph.var_nodes[i].belief = new gauss.Gaussian(m.Matrix.zeros(1, 1), m.Matrix.zeros(1, 1));;
    }
  }

  function toggleGBP() {
    if (graph.count_meas() == 0) {
      visible_alert = true;
    } else {
      gbp_on = !gbp_on;
    }
  }

  function toggleMAP() {
    if (graph.count_meas() == 0) {
      visible_alert = true;
    } else {
      if (display_map == false) {
        display_map = true;
      } else {
        display_map = false;
      }
    }
  }

  function update_meas_model_std() {
    var lambda = 1 / Math.pow(meas_model_std, 2);
    for (var c = 0; c < graph.factors.length; c++) {
      var diff = false;
      for (var i = 1; i < graph.factors[c].lambdas.length; i++) {
        if (graph.factors[c].lambdas[i] != lambda) {
          graph.factors[c].lambdas[i] = lambda;
          diff = true;
        }
      }
      if (diff) {
        graph.factors[c].compute_factor();
      }
    }
  }

  function update_smoothness_std() {
    var lambda = 1 / Math.pow(smoothness_std, 2);
    for (var c = 0; c < graph.factors.length; c++) {
      if (graph.factors[c].lambdas[0] != lambda) {
        graph.factors[c].lambdas[0] = lambda;
        graph.factors[c].compute_factor();
      }
    }
  }
  
</script>

<svg style="display: none;" xmlns="http://www.w3.org/2000/svg">
    <symbol id="playIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path><path d="M0 0h24v24H0z" fill="none"></path></symbol>
    <symbol id="pauseIcon" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path><path d="M0 0h24v24H0z" fill="none"></path></symbol>
    <symbol id="resetIcon" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"></path><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"></path></symbol>
    <symbol id="removeIcon" viewBox="0 0 1792 1792"><path d="M0 0h1792v1792H0z" fill="none"></path><path d="M1490 1322q0 40-28 68l-136 136q-28 28-68 28t-68-28l-294-294-294 294q-28 28-68 28t-68-28l-136-136q-28-28-28-68t28-68l294-294-294-294q-28-28-28-68t28-68l136-136q28-28 68-28t68 28l294 294 294-294q28-28 68-28t68 28l136 136q28 28 28 68t-28 68l-294 294 294 294q28 28 28 68z"></path></symbol>
</svg>


<style>

  .gbp-container {
    position: relative;
    width: 75%;
    float: left;
    margin-right:5px;
  }

  .settings-panel {
    position: relative;
    width: 24%;
    float: left;
    font-size: 15px;
  }

</style>

<svelte:window />

<div class="demo-container">

  <div class="gbp-container">

    <div class="center" style="user-select: none">
      {#if visible_alert}
        <p transition:fade id="alert">Before starting add measurements!</p>
      {/if}
    </div>

    <svg
      bind:this={svg}
      width={svg_width}
      height={svg_height}
      on:click={click_handler}
      id="click-svg">

      {#each var_nodes as node}
        {#if node.belief.lam.get(0, 0) == 0}
          <circle cx={node.x} cy={svg_height - 60} r={radius} fill="blue"></circle>
          <line x1={node.x} y1={svg_height - 100} x2={node.x} y2={svg_height - 20} stroke-width={stroke_width} stroke="blue"></line>
        {:else}
          <circle cx={node.x} cy={node.belief.getMean().get(0, 0)} r={radius} fill="blue"></circle>
          <line 
            x1={node.x} 
            y1={node.belief.getMean().get(0, 0) - Math.sqrt(node.belief.getCov().get(0, 0))} 
            x2={node.x} 
            y2={node.belief.getMean().get(0, 0) + Math.sqrt(node.belief.getCov().get(0, 0))} 
            stroke-width={stroke_width} 
            stroke="blue"></line>
        {/if}
	    {/each}

      {#each factors as factor}
        {#each factor.meas as meas, i}
          {#if i != 0}
            <circle cx={factor.x_meas[i-1]} cy={factor.meas[i]} r={radius} fill="red"></circle>
            <line 
              x1={factor.x_meas[i-1]} 
              y1={factor.meas[i] - 1 / Math.sqrt(factor.lambdas[i])} 
              x2={factor.x_meas[i-1]} 
              y2={factor.meas[i] + 1 / Math.sqrt(factor.lambdas[i])} 
              stroke-width={stroke_width} 
              stroke="red"></line>

          {/if}
        {/each}
      {/each}

      {#if show_MAP && meas_count != 0}
        {#each var_nodes as node}
          {#if node.MAP_mean != null && node.MAP_std != null}
            <circle cx={node.x} cy={node.MAP_mean} r={radius} stroke="green" stroke-width=2 fill=none></circle>
            <line x1={node.x} y1={node.MAP_mean - node.MAP_std} x2={node.x} y2={node.MAP_mean + node.MAP_std} stroke-width={stroke_width} stroke="green"></line>
          {/if}
        {/each}
      {/if}

    </svg>

    <div id="left-demo-tip">
      <img id="pointer" src="images/pointer.svg" alt="pointer"/>
      <div id="hint">Click on the canvas to surface factors.</div>
    </div>

  </div>

  <div class="settings-panel">

    <div>
      {#if gbp_on}
        <button class="icon-button" style="outline: none;" data-tooltip="Pause GBP" on:click={toggleGBP}>
          <svg class="icon" id="pause"><use xlink:href="#pauseIcon"></use></svg>
        </button>
      {:else}
        <button class="icon-button" style="outline: none;" class:not_pressable={meas_count == 0} data-tooltip="Play GBP" on:click={toggleGBP}>
          <svg class="icon" id="play"><use xlink:href="#playIcon"></use></svg>
        </button>
      {/if}

      <button class="icon-button" style="outline: none;" data-tooltip="New random measurements" on:click={newRandMeasurements}>
        <svg class="icon" id="reset"><use xlink:href="#resetIcon"></use></svg>
      </button>

      <button class="icon-button" style="outline: none;" data-tooltip="Clear measurements" on:click={clearMeasurements}>
        <svg class="icon" id="remove"><use xlink:href="#removeIcon"></use></svg>
      </button>
    </div>

    <br><br>
    <div class="slider">
      <b>Iteration {n_iters}</b> &nbsp; (iters / s: {iters_per_sec})<br>
      <input type="range" min="1" max="50" bind:value={iters_per_sec} style="width:200px;"/><br>
    </div>

    <span>Schedule: </span>
    <label class="radio-inline"> 
      <input type="radio" bind:group={schedule} value="sweep"> Sweep
    </label>
    <label class="radio-inline">
      <input type="radio" bind:group={schedule} value="sync"> Sync
    </label>   

    <br>
    <span style="color: {map_color}"> <b>True posterior</b> </span>
    <label class="checkbox-inline">
      <input
        type="checkbox"
        id="toggle_MAP_checkbox"
        bind:checked={show_MAP} />
    </label>

    <br />

    <label class="slider">
      <span >Measurement factors, &sigma = <b>{meas_model_std}</b> </span><br>
      <input type="range" min="5" max="80" bind:value={meas_model_std} style="width:200px;"/><br>
    </label>
    <label class="slider">
      <span>Smoothness factors, &sigma = <b>{smoothness_std}</b></span><br>
      <input type="range" min="5" max="80" bind:value={smoothness_std} style="width:200px;"/><br>
    </label>

  </div>
</div>
