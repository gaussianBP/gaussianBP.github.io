<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import * as m from "ml-matrix";
  import * as gauss from "../gaussian";
  import * as gbp from "../gbp/gbp1d.js";
  import { onInterval } from "../util.js";

  // Visual varaibles
  let canvas;
  let svg;
  let width = 500;
  let height = 600;
  let nodes_x_offset;
  let node_x_spacing;
  let stroke_width;
  let node_radius;
  let then; // time of start of vis
  let display_map = false;
  let visible_alert = false;

  // Measurement model std
  let meas_model_std = 50;
  let smoothness_std = 50;

  // GBP variables
  let graph;
  const n_var_nodes = 10;
  const n_measurements = 8;
  let measurements = [];

  let mp_schedule = 0;
  var sync_on = false;
  var sweep_on = false;
  let GBP_sweep_done = false;

  let n_iters = 0;
  let iters_per_sec = 2.5;
  let dist = 0; // Average distance of belief means from MAP solution

  $: var_nodes = [];
  $: meas_nodes = [];
  $: map_nodes = [];
  let var_line;
  let meas_line;
  let map_line;

  var line = d3.line()
		.x(d => d.x)
		.y(d => d.y)
		.curve(d3.curveBasis);

  onMount(() => {
    resize();

    graph = gbp.create1Dgraph(n_var_nodes, smoothness_std);

    nodes_x_offset = width / (2 * n_var_nodes);
    node_x_spacing = (width - nodes_x_offset * 2) / (n_var_nodes - 1);
    node_radius = height / 38;
	stroke_width = 3;
    genRandomMeasurements(n_measurements, measurements);
	then = Date.now();
	
  });

  onInterval(() => updateVis(), 25);

  function resize() {
    ({ width, height } = svg.getBoundingClientRect());
  }

  function generateLine(nodes) {
	let line_data = [];
	for (let i = 0; i < nodes.length; i++) {
	  line_data.push({x: nodes[i].x, y: nodes[i].y});
	}
	let path = line(line_data);
	return path
  }

  // Draw functions
  function drawNodes() {
    var_nodes = [];
    for (let c = 0; c < graph.var_nodes.length; c++) {
      var x = nodes_x_offset + c * node_x_spacing;
      if (graph.var_nodes[c].belief.lam.get(0, 0) == 0) {
        var y = height - height / 8;
        var var_y = Math.pow(height / 10, 2);
      } else {
        var y = graph.var_nodes[c].belief.getMean().get(0, 0);
        var var_y = graph.var_nodes[c].belief.getCov().get(0, 0);
      }

      let node = {
        x: x,
        y: y,
        radius: node_radius,
        color: "#0095DD",
        var_h: parseInt(y) + parseInt(Math.sqrt(var_y)),
        var_l: parseInt(y) - parseInt(Math.sqrt(var_y)),
        stroke_width: stroke_width
      };

      var_nodes.push(node);
	}
	var_line = generateLine(var_nodes);
  }

  function drawMeasurements(meas_model_std) {
    meas_nodes = [];
    for (var c = 0; c < measurements.length; c++) {
      var x = measurements[c].x;
      var y = measurements[c].y;

      let node = {
        x: x,
        y: y,
        radius: node_radius,
        color: "red",
        var_h: parseInt(y) + parseInt(meas_model_std),
        var_l: parseInt(y) - parseInt(meas_model_std),
        stroke_width: stroke_width
      };

      meas_nodes.push(node);
    }
  }

  function drawMAP() {
    map_nodes = [];
    var values = graph.computeMAP();
    const means = values[0];
    const bigSigma = values[1];
    for (var c = 0; c < graph.var_nodes.length; c++) {
      var x = nodes_x_offset + c * node_x_spacing;
      var y = means.get(c, 0);
      var var_y = bigSigma.get(c, c);

      let node = {
        x: x,
        y: y,
        radius: node_radius,
        color: "green",
        var_h: parseInt(y) + parseInt(Math.sqrt(var_y)),
        var_l: parseInt(y) - parseInt(Math.sqrt(var_y)),
        stroke_width: stroke_width
      };

      map_nodes.push(node);
    }
  }

  function updateVis() {
    var fpsInterval = 1000 / iters_per_sec;
    var now = Date.now();
    var elapsed = now - then;
    if (elapsed > fpsInterval) {
      then = now - (elapsed % fpsInterval);
      if (mp_schedule && sync_on) {
        syncGBP();
      } else if (mp_schedule == 0 && sweep_on) {
        graph.sweep_step();
        if (graph.forward == 1 && graph.sweep_ix == 0) {
          // Back and forth sweep complete
          sweep_on = false;
          GBP_sweep_done = true;
        }
      }
    }
    update_meas_model_std();
    update_smoothness_std();
    drawNodes();
    drawMeasurements(meas_model_std);
    if (display_map) {
      drawMAP();
    }
  }

  // GBP functions
  function syncGBP() {
    if (n_iters == 0 && GBP_sweep_done == 0) {
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

  function addMeasurement(e) {
    visible_alert = false;
    var rect = svg.getBoundingClientRect();
    var x = (width * (e.clientX - rect.left)) / rect.width;
    var y = (height * (e.clientY - rect.top)) / rect.height;
    if (
      x > nodes_x_offset &&
      x < width - nodes_x_offset &&
      y > 0 &&
      y < height
    ) {
      var ix = (x - nodes_x_offset) / node_x_spacing;
      var x_lhs = nodes_x_offset + Math.floor(ix) * node_x_spacing;
      var x_rhs = nodes_x_offset + Math.ceil(ix) * node_x_spacing;
      graph.addLinearMeasurement(
        y,
        x,
        [Math.floor(ix), Math.ceil(ix)],
        x_lhs,
        x_rhs,
        meas_model_std
      );
      measurements.push({ x: x, y: y });
    }
  }

  function genRandomMeasurements() {
    visible_alert = false;
    measurements = [];
    graph.factors = graph.factors.slice(0, 9);
    for (var i = 0; i < n_measurements; i++) {
      var x = Math.random() * (width - 2 * nodes_x_offset) + nodes_x_offset;
      var y = Math.random() * (height - 2 * nodes_x_offset) + nodes_x_offset;
      var ix = (x - nodes_x_offset) / node_x_spacing;
      var x_lhs = nodes_x_offset + Math.floor(ix) * node_x_spacing;
      var x_rhs = nodes_x_offset + Math.ceil(ix) * node_x_spacing;
      graph.addLinearMeasurement(
        y,
        x,
        [Math.floor(ix), Math.ceil(ix)],
        x_lhs,
        x_rhs,
        meas_model_std
      );
      measurements.push({ x: x, y: y });
    }
  }

  function newRandMeasurements() {
    sync_on = false;
    sweep_on = false;
    n_iters = 0;
    graph = gbp.create1Dgraph(n_var_nodes, smoothness_std);
    genRandomMeasurements(n_measurements, measurements);
    then = Date.now();
  }

  function clearMeasurements() {
    measurements = [];
    graph.factors = graph.factors.slice(0, 9);
    sync_on = false;
    sweep_on = false;
    display_map = false;
    n_iters = 0;
    graph = gbp.create1Dgraph(n_var_nodes, smoothness_std);
    then = Date.now();
  }

  // User interaction functions
  function toggleSweepGBP() {
    if (measurements.length == 0) {
      visible_alert = true;
    } else {
      if (sweep_on) {
        sweep_on = false;
      } else {
        sweep_on = true;
        iters_per_sec = 2.5;
        sync_on = false;
      }
    }
  }

  function toggleGBP() {
    if (measurements.length == 0) {
      visible_alert = true;
    } else {
      if (sync_on) {
        sync_on = false;
      } else {
        sync_on = true;
      }
    }
  }

  function toggleMAP() {
    if (measurements.length == 0) {
      visible_alert = true;
    } else {
      if (display_map == false) {
        display_map = true;
      } else {
        display_map = false;
      }
    }
  }

  function change_schedule() {
    sync_on = 0;
    sweep_on = 0;
    iters_per_sec = 25;
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

<style>
  svg {
    width: 100%;
    height: 100%;
    float: left;
    fill: white;
  }
</style>

<svelte:window />

<div class="demo-container">

  <div id="gbp-container">
    <svg
      bind:this={svg}
      width={1300}
      height={640}
      on:click={addMeasurement}
      id="click-svg">
      {#each var_nodes as node}
        <circle cx={node.x} cy={node.y} r={node.radius} fill={node.color}></circle>
		<line x1={node.x} y1={node.var_l} x2={node.x} y2={node.var_h} stroke-width={node.stroke_width} stroke={node.color}></line>
	  {/each}
      {#each meas_nodes as node}
        <circle cx={node.x} cy={node.y} r={node.radius} fill={node.color}></circle>
		<line x1={node.x} y1={node.var_l} x2={node.x} y2={node.var_h} stroke-width={node.stroke_width} stroke={node.color}></line>
      {/each}
      {#each map_nodes as node}
        <circle cx={node.x} cy={node.y} r={node.radius} fill={node.color}></circle>
		<line x1={node.x} y1={node.var_l} x2={node.x} y2={node.var_h} stroke-width={node.stroke_width} stroke={node.color}></line>
      {/each}
    </svg>
    <div class="center">
      {#if visible_alert}
        <p transition:fade id="alert">Before starting add measurements!</p>
      {/if}
    </div>

    <div class="buttons-panel">
      {#if mp_schedule}
        {#if sync_on}
          <i
            class="fa fa-pause tooltip"
            on:click={toggleGBP}
            style="width:25px">
            <span class="tooltiptext">Pause synchronous GBP</span>
          </i>
        {:else}
          <i class="fa fa-play tooltip" on:click={toggleGBP} style="width:25px">
            <span class="tooltiptext">Play synchronous GBP</span>
          </i>
        {/if}
      {:else if sweep_on}
        <i
          class="fa fa-pause tooltip"
          on:click={toggleSweepGBP}
          style="width:25px">
          <span class="tooltiptext">Pause GBP sweep</span>
        </i>
      {:else}
        <i
          class="fa fa-play tooltip"
          on:click={toggleSweepGBP}
          style="width:25px">
          <span class="tooltiptext">Play GBP sweep</span>
        </i>
      {/if}

      <i class="fa fa-repeat tooltip" on:click={newRandMeasurements}>
        <span class="tooltiptext">Generate new random measurements</span>
      </i>
      <i class="fa fa-remove tooltip" on:click={clearMeasurements}>
        <span class="tooltiptext">Clear measurements</span>
      </i>

      {#if display_map}
        <button class="tooltip" on:click={toggleMAP}>
          <b>MAP</b>
          <span class="tooltiptext">Hide MAP</span>
        </button>
      {:else}
        <button
          class="tooltip"
          on:click={toggleMAP}
          style="color: rgb(39, 36, 36, 0.6)">
          <b>MAP</b>
          <span class="tooltiptext">Display MAP</span>
        </button>
      {/if}

      <div id="demo-tip">
        <img id="pointer" src="images/pointer.svg" alt="pointer" />
        <div id="hint">Click on the canvas to surface factors.</div>
      </div>

    </div>
  </div>

  <div id="settings-panel">
    <b>Message Passing Schedule:</b>
    <br />
    <label>
      <input
        type="radio"
        bind:group={mp_schedule}
        value={0}
        on:click={change_schedule} />
      Sweep
    </label>
    <br />

    <label>
      <input
        type="radio"
        bind:group={mp_schedule}
        value={1}
        on:click={change_schedule} />
      Synchronous
    </label>
    <br />

    <br />
    <b>
      Standard deviation of noise in Gaussian measurement models:
      <br />
    </b>
    Surface factors, &sigma =
    <b>{meas_model_std}</b>
    <input type="range" min="1" max="100" bind:value={meas_model_std} />
    <br />
    Smoothness factors, &sigma =
    <b>{smoothness_std}</b>
    <input type="range" min="1" max="100" bind:value={smoothness_std} />
    <br />

    {#if mp_schedule}
      <br />
      <b>Iteration {n_iters}</b>
      &nbsp; (iters / s: {iters_per_sec})
      <input type="range" min="1" max="50" bind:value={iters_per_sec} />
      <br />
    {/if}

  </div>
</div>
