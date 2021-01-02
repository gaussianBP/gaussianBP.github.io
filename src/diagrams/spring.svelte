<script>
  import { onMount } from 'svelte';

  import * as m from 'ml-matrix';
  import * as gauss from '../gaussian';
  import * as gbp1d from '../gbp/gbp1d_v1.js';
  import * as nlm from '../gbp/nonlinear_meas_fn.js';

  import * as d3 from 'd3';

  import { onInterval, pannable } from '../util.js';

  import anime from 'animejs';

  // svg
  var svg;
  var svg_width = 1000;
  var svg_height = 400;

  let var_node_gt_radius = 10;
  let var_node_belief_radius = 15;

  let then; // time of start of vis
  let started = false;
  let gt_node_radius = 15;
  let x_buffer = 150;
  let stroke_width = 4;
  $: var_nodes_length = 0;

  $: var_nodes = [];
  $: factor_nodes = [];
  var gt_locs = [];

  // Measurement model std
  var prior_std = 50;

  // GBP variables
  let graph;
  var energies = null;
  var energy = 0;

  let sync_on = false;
  let n_iters = 0;
  let iters_per_sec = 1;

  let down = [false];

  let n_var_nodes = 2;
  var spring_meas_std = 40.;

  let anchor = 100;

  // Gaussian visual variables
  const STEP = 1;
  const gauss_max_height = 50;
  const gauss_width_stds = 2.3;
  const gauss_max_width = 300;
  var y_offset = svg_height / 2 + 50;
  var map_y = d3.scaleLinear().domain([0, 1]).range([y_offset, y_offset + gauss_max_height]);

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

  // UI
  var show_MAP = true;

  const time_res = 0.1; // time resolution
  let mode = "set_springs";
  let schedule = "sweep";
  let gbp_on = false;

  onMount(() => {

    svg_width = svg.clientWidth;
    svg_height = svg.clientHeight;

    graph = new gbp1d.FactorGraph();
    creategraph(graph, n_var_nodes, spring_meas_std);
    var_nodes_length = graph.var_nodes.length;

	// nlm.checkJac(graph.pose_nodes[0].belief.getMean(), graph.lmk_nodes[0].belief.getMean());

    then = Date.now();
    anime.timeline({
      easing: 'easeInSine',
      autoplay: true,
      duration: 3500
    }).add({
      targets: '#line_0',
      opacity: [0, 1]
    });

  });

  onInterval(() => updateVis(), parseInt(1000 / 60));
  
  onInterval(() => gbp_iter(), 1000 / iters_per_sec);


  function updateVis() {

    var fpsInterval = 1000 / iters_per_sec;
    var now = Date.now();
    var elapsed = now - then;
    if (elapsed > fpsInterval) {
      then = now - (elapsed % fpsInterval);
      var_nodes_length = graph.var_nodes.length;
    }

    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;
    update_web_elements();

    gt_locs = [];
    for(var i=0; i<n_var_nodes; i++) {
      gt_locs.push(var_nodes[i].gt);
    }

    svg_width = svg.clientWidth;
    svg_height = svg.clientHeight;

    if (mode != "set_springs") {
      energies = graph.compute_energy();
      energy = energies.reduce((a, b) => a + b, 0);
    }

    if (mode != "set_springs" && show_MAP) {
      graph.computeMAP();
    }

    if (mode != "play") {
      gbp_on = false;
    }

    y_offset = svg_height / 2 + 50;
    map_y = d3.scaleLinear().domain([0, 1]).range([y_offset, y_offset + gauss_max_height]);
    var_nodes[0].update_path(gauss_max_width, gauss_width_stds, STEP, map_y);

    console.log(graph);

  }

  function gbp_iter() {
    if (mode == "play" && gbp_on) {
      if (schedule == "sync") {
        graph.sync_iter();
        console.log(graph);
      }

      n_iters++;
    }

  }

  // *********************** Factor graph functions ************************* 

  function creategraph(graph, n_var_nodes, spring_meas_std) {

    let dist = (svg_width - 2*x_buffer) / (n_var_nodes - 1);
    // Create variable nodes
    for(var i=0; i<n_var_nodes; i++) {
      const new_var_node = new gbp1d.VariableNode(i, x_buffer + i*dist, prior_std);
      graph.var_nodes.push(new_var_node);
      down.push(false);
    }

    // Create unary factor connecting first mass to anchor
    const new_factor = new gbp1d.UnaryFactor(x_buffer, spring_meas_std, 0);
    new_factor.adj_belief = graph.var_nodes[0].belief;
    graph.factors.push(new_factor);
    graph.var_nodes[0].adj_factors.push(new_factor);

    // Create measurement factors, one factor connecting to anchor and remaining factors between masses
    const smoothness_jac = new m.Matrix([[-1, 1]]);
    for(var i=0; i<(n_var_nodes-1); i++) {
      const new_factor = new gbp1d.LinearFactor(2, [i, i+1], );
      new_factor.jacs.push(smoothness_jac);
      new_factor.meas.push(graph.var_nodes[i+1].gt - graph.var_nodes[i].gt);
      new_factor.lambdas.push(1 / (spring_meas_std * spring_meas_std));

      new_factor.adj_beliefs.push(graph.var_nodes[i].belief);
      new_factor.adj_beliefs.push(graph.var_nodes[i+1].belief);
      new_factor.messages.push(new gauss.Gaussian([[0]], [[0]]));
      new_factor.messages.push(new gauss.Gaussian([[0]], [[0]]));
      new_factor.compute_factor();
      graph.factors.push(new_factor);
      graph.var_nodes[i].adj_factors.push(new_factor);
      graph.var_nodes[i+1].adj_factors.push(new_factor);
    }

    var_nodes = graph.var_nodes;
    factor_nodes = graph.factors;

    return graph;
  }

  function update_spring_constant() {
    var lambda = 1 / (spring_meas_std * spring_meas_std);

    // Update factors
    for (var i=0; i < graph.factors.length; i++) {
      if (graph.factors[i].type == "unary") {
        graph.factors[i].std = spring_meas_std;
        graph.factors[i].update_message();
      }
      else if (graph.factors[i].type == "binary") {
        graph.factors[i].lambdas[0] = lambda;
        graph.factors[i].compute_factor();
      }

    }
  }

  // ************************ Event handlers *************************

  function toggleGBP() {
    gbp_on = !gbp_on;
  }

  function update_web_elements() {

  }

  function mousemove_handler(e) {
      node_onhover = null;
      node_onhover = e.path.find((element) => element.classList == "node_g");
      const rect = e.currentTarget.getBoundingClientRect();
      current_mouse_location = {
        x: e.clientX - rect.x,
        y: e.clientY - rect.y,
      };
      
      // If in set springs mode then change gt mass locations
      if (node_mousedown && mode == "set_springs") {
        // Move node with mouse
        moving_node = true;
        var min_bound = anchor + 50;
        var max_bound = svg_width - 20;
        if (node_mousedown.id != 0) {
          min_bound = var_nodes[node_mousedown.id - 1].gt + 50;
        }
        if (node_mousedown.id != n_var_nodes-1) {
          max_bound = var_nodes[node_mousedown.id + 1].gt - 50;
        }
        node_mousedown.gt = Math.min(Math.max(current_mouse_location.x, min_bound), max_bound);
      }
      // if in set init mode then change var node priors 
      else if (node_mousedown && mode == "set_init") {
        // Move node with mouse
        moving_node = true;
        var min_bound = anchor + 50;
        var max_bound = svg_width - 20;
        if (node_mousedown.id != 0) {
          min_bound = var_nodes[node_mousedown.id - 1].belief.getMean().get(0, 0) + 50;
        }
        if (node_mousedown.id != n_var_nodes-1) {
          max_bound = var_nodes[node_mousedown.id + 1].belief.getMean().get(0, 0) - 50;
        }
        var prior_mean = Math.min(Math.max(current_mouse_location.x, min_bound), max_bound);
        node_mousedown.prior.eta = node_mousedown.prior.lam.mmul(
          new m.Matrix([[prior_mean]])
        );
        node_mousedown.belief.eta = node_mousedown.prior.eta.clone();
        node_mousedown.belief.lam = node_mousedown.prior.lam.clone();
      }

      // if (node_onhover) {
      //   node_onhover = graph.find_node(node_onhover.id);
      //   if (node_onhover.type != "var_node") {
      //     node_onhover = null;
      //   }
      // }
  }

  function mousedown_handler(e) {
    mouse_up = false;
    node_mousedown = null;
    node_mousedown = e.path.find((element) => element.classList == "node_g");
    mousedown_time = Date.now();
    if (node_mousedown) {
      node_mousedown = graph.find_node(node_mousedown.id);
    }
  }

  function mouseup_handler(e) {
    click_time = Date.now() - mousedown_time;
    if (moving_node && node_mousedown.type == "var_node") {
      // clear_previous_message();
      if (mode == "set_springs") {
        // Set new prior and update belief with new prior
        node_mousedown.prior.eta = node_mousedown.prior.lam.mmul(
          new m.Matrix([[node_mousedown.gt]])
        );
        node_mousedown.belief.eta = node_mousedown.prior.eta.clone();
        node_mousedown.belief.lam = node_mousedown.prior.lam.clone();

        // Update adjacent factors when it is moved and dropped
        for (var i = 0; i < node_mousedown.adj_factors.length; i++) {
          var factor_node = node_mousedown.adj_factors[i];
          if (factor_node.type == "binary") {
            factor_node.meas[0] = graph.var_nodes[factor_node.adj_var_ids[1]].gt - graph.var_nodes[factor_node.adj_var_ids[0]].gt;
            factor_node.compute_factor();
          }
          else if (factor_node.type == "unary") { // If first mass then update spring connected to anchor
            factor_node.mean = graph.var_nodes[factor_node.adj_var_id].gt;
            factor_node.update_message();
          }

        }
      }

    }
    node_mousedown = null;
    moving_node = false;
    mouse_up = true;
  }

function click_handler(e) {
  // TODO: Improve click algorithm
  node_clicked = null;
  node_clicked = e.path.find((element) => element.classList == "node_g");
}



</script>

<div class="demo-container">
	<div id="gbp-container">
    <svg
      bind:this={svg}
      width={svg_width}
      height={svg_height}
      on:mousemove={mousemove_handler}
      on:mousedown={mousedown_handler}
      on:mouseup={mouseup_handler}
      on:click={click_handler}
      >

      <!-- Draw springs connecting masses -->
      <!-- Line connecting anchor to first mass -->
      <line 
        id={"anchor_line"}
        x1={anchor}
        y1={svg_height/2}
        x2={gt_locs[0]}
        y2={svg_height/2}
        stroke="#2F4F4F"
        stroke-width={stroke_width}
        />
      <!-- Lines connecting remaining masses -->
      {#each Array(n_var_nodes - 1) as _, i}
        <line 
          id={"line_"+i}
          x1={gt_locs[i]}
          y1={svg_height/2}
          x2={gt_locs[i+1]}
          y2={svg_height/2}
          stroke="#2F4F4F"
          stroke-width={stroke_width}
          />
      {/each}


      <!-- Draw gt var nodes -->
        {#if mode == "set_springs"}
          {#each var_nodes as var_node, i}
            <g class="node_g" id={var_node.id} cursor="pointer" draggable="true">
              <circle 
                id={"var_node_gt_"+i}
                cx={var_node.gt}
                cy={svg_height / 2}
                r={var_node_gt_radius}
                stroke="#0095DD"
                fill="#0095DD"/>
            </g>
          {/each}
        {:else}
          {#each var_nodes as var_node, i}
            <circle 
              id={"var_node_gt_"+i}
              cx={var_node.gt}
              cy={svg_height / 2}
              r={var_node_gt_radius}
              stroke="#0095DD"
              fill="#0095DD"/>
          {/each}


          {#each var_nodes as var_node, i}
            <line 
              id={"belief_std_line_"+i}
              x1={var_node.belief.getMean().get(0, 0) - Math.sqrt(var_node.belief.getCov().get(0, 0))}
              y1={svg_height/2 + 50}
              x2={var_node.belief.getMean().get(0, 0) + Math.sqrt(var_node.belief.getCov().get(0, 0))}
              y2={svg_height/2 + 50}
              stroke="#2F4F4F"
              stroke-width={stroke_width}/>
          {/each}
          {#each var_nodes as var_node, i}
            <g class="node_g" id={var_node.id} cursor="pointer" draggable="true">
              <circle 
                id={"var_node_belief_"+i}
                cx={var_node.belief.getMean().get(0, 0)}
                cy={svg_height / 2 + 50}
                r={var_node_belief_radius}
                stroke="#A5BCC7"
                fill="#A5BCC7" />
            </g>
            <path d="{var_node.belief_path}" class="curve" stroke="black" stroke-width="2" fill="none"></path>
          {/each}


        {/if}

      {#if show_MAP && mode != "set_springs"} 
        {#each var_nodes as var_node, i}
          <line 
            id={"var_node_map_cov_"+i}
            x1={var_node.MAP_mean - var_node.MAP_std}
            y1={svg_height / 2 - 50}
            x2={var_node.MAP_mean + var_node.MAP_std}
            y2={svg_height / 2 - 50}
            stroke="#2F4F4F"
            stroke-width={stroke_width}/>
        {/each}
        {#each var_nodes as var_node, i}
          <circle 
            id={"var_node_map_"+i}
            cx={var_node.MAP_mean}
            cy={svg_height / 2 - 50}
            r={var_node_gt_radius}
            stroke="#0095DD"
            fill="#0095DD"/>
        {/each}
      {/if}


      <!-- Draw anchor varaible node -->
      <rect
        id="anchor"
        x={anchor-15}
        y={svg_height / 2 - 15}
        width={30}
        height={30}
        stroke="00FF00"
        fill="00FF00" />

    </svg>

	</div>
  
  <!-- Draw settings panel -->
  <div id="settings-panel">

    <label class="radio-inline">
      <input type="radio" bind:group={mode} value="set_springs"> Set springs
    </label>
    <br>
    <label class="radio-inline">
      <input type="radio" bind:group={mode} value="set_init"> Set init
    </label>
    <br>
    <label class="radio-inline">
      <input type="radio" bind:group={mode} value="play"> Play mode
    </label>

    {#if mode == "play"}
      <br>
      <span style="color: blue"> <b>Schedule: </b> </span>
      <label class="radio-inline">
        <input type="radio" bind:group={schedule} value="sweep"> Sweep
      </label>
      <label class="radio-inline">
        <input type="radio" bind:group={schedule} value="sync"> Sync
      </label>

      <b>Iteration {n_iters}</b> &nbsp; (iters / s: {iters_per_sec})
      <input type="range" min="1" max="50" bind:value={iters_per_sec}><br>

      <!-- {#if !gbp_on}
        <i class="fa fa-pause tooltip" on:click={toggleGBP} style="width:25px">
          <span class="tooltiptext">Pause synchronous GBP</span>
        </i>
      {:else}
        <i class="fa fa-play tooltip"  on:click={toggleGBP} style="width:25px">
          <span class="tooltiptext">Play synchronous GBP</span>
        </i>
      {/if}  -->

      {#if gbp_on}
        <label>
          <button
            type="button"
            class="btn"
            on:click={toggleGBP}
            style="width:200px; border:2px solid black">
            Pause Message Passing
            </button>
        </label>
      {:else}
        <label>
          <button
            type="button"
            class="btn"
            on:click={toggleGBP}
            style="width:200px; border:2px solid black">
            Start Message Passing
            </button>
        </label>
      {/if}
    {/if}

    <br>
    Spring constant, k = <b>{(1 / (spring_meas_std * spring_meas_std)).toFixed(5)}</b>
    <input type="range" min="1" max="100" bind:value={spring_meas_std} on:change={update_spring_constant} ><br>

    {#if mode != "set_springs"}
      Spring internal energy: {energy.toFixed(2)}
    {/if}

    <div style="display: inline-block;">
      <span style="color: blue"> <b>MAP</b> </span>
      <label class="checkbox-inline">
        <input
          type="checkbox"
          id="toggle_MAP_checkbox"
          bind:checked={show_MAP} />
      </label>
    </div>



    <div id="left-demo-tip">
      <img id="pointer" src="images/pointer.svg" alt="pointer" style="width: 40px">
      <div id="hint">
          Drag to move the masses.                
      </div>
    </div>
    
  </div>
  
</div>
