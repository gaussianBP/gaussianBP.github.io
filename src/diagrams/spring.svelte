<script>
  import { onMount } from 'svelte';

  import * as m from 'ml-matrix';
  import * as gauss from '../gaussian';
  import * as gbp1d from '../gbp/gbp1d_v1.js';
  import * as nlm from '../gbp/nonlinear_meas_fn.js';

  import * as d3 from 'd3';

  import * as colormap from 'colormap';

  import { onInterval, pannable } from '../util.js';

  import anime from 'animejs';

  // svg
  let svg;
  let svg_width = 700;
  let svg_height = 300;

  let node_radius = 10;

  let then; // time of start of vis
  let started = false;
  let x_buffer = 150;
  let stroke_width = 4;
  $: var_nodes_length = 0;

  $: var_nodes = [];
  $: factor_nodes = [];
  var gt_locs = [];

  // Measurement model std
  var prior_std = 80;

  // GBP variables
  let graph;
  let energies = null;
  let energy = 0;

  let dist_to_MAP = 0;

  let n_iters = 0;
  let iters_per_sec = 1;

  let n_var_nodes = 2;
  let spring_meas_lam = 1 / (40*40);
  let spring_meas_lam_int = spring_meas_lam * 10000;

  let anchor = 100;
  let anchor_end = 700;

  // Gaussian visual variables
  const STEP = 1;
  const gauss_max_height = 50;
  const gauss_width_stds = 2.3;
  const gauss_max_width = 300;
  let y_offset = svg_height / 2 - 50;
  let map_belief_gauss = d3.scaleLinear().domain([0, 1]).range([y_offset, y_offset - gauss_max_height]);
    
  let y_mean = svg_height / 2;
  let map_y_spring = d3.scaleLinear().domain([-1, 1]).range([y_mean - half_spring_height, y_mean + half_spring_height]);
  let half_spring_height = 20;

  let y_offset_MAP = svg_height / 2 - 100;
  let map_MAP_gauss = d3.scaleLinear().domain([0, 1]).range([y_offset, y_offset - gauss_max_height]);

  const nshades = 100;
  let colors = colormap({
      colormap: 'jet',
      nshades: nshades,
      format: 'hex',
      alpha: 1
  })
  const max_internal_energy = 50

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
  let schedule = "sync";
  let gbp_on = false;

  const min_spring_size = 80;
  const edge_buffer = 20;


  onMount(() => {

    svg_width = svg.clientWidth;
    svg_height = svg.clientHeight;

    graph = new gbp1d.FactorGraph();
    creategraph(graph, n_var_nodes, 1 / Math.sqrt(spring_meas_lam));
    var_nodes_length = graph.var_nodes.length;
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factors;

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
    factor_nodes = graph.factors;
    update_web_elements();

    gt_locs = [];
    for(var i=0; i<n_var_nodes; i++) {
      gt_locs.push(var_nodes[i].gt);
    }

    svg_width = svg.clientWidth;
    svg_height = svg.clientHeight;

    energies = graph.compute_energy();
    energy = energies.reduce((a, b) => a + b, 0);
    // console.log("energies", energies[0], energies[1], energies[2]);

    if (mode != "set_springs" && show_MAP) {
      graph.computeMAP();

      y_offset_MAP = svg_height / 2 - 100;
      map_MAP_gauss = d3.scaleLinear().domain([0, 1]).range([y_offset, y_offset - gauss_max_height]);
      for(var c=0; c<n_var_nodes; c++) {
        var_nodes[c].update_MAP_path(gauss_max_width, gauss_width_stds, STEP, map_MAP_gauss);
      }
    }

    if (mode != "play") {
      gbp_on = false;
    }

    y_offset = svg_height / 2 - 50;
    map_belief_gauss = d3.scaleLinear().domain([0, 1]).range([y_offset, y_offset - gauss_max_height]);
    for (var i=0; i < n_var_nodes; i++) {
      var_nodes[i].update_path(gauss_max_width, gauss_width_stds, STEP, map_belief_gauss);
    }

    y_mean = svg_height / 2;
    map_y_spring = d3.scaleLinear().domain([-1, 1]).range([y_mean - half_spring_height, y_mean + half_spring_height]);
    for (var i=0; i < factor_nodes.length; i++) {
      if (mode != "set_springs") {
        factor_nodes[i].update_path_init(map_y_spring);
      } else {
        factor_nodes[i].update_path(map_y_spring);
      }
      factor_nodes[i].get_color(colors, max_internal_energy, nshades);
    }

    dist_to_MAP = graph.compare_to_MAP();

  }

  function gbp_iter() {
    if (mode == "play" && gbp_on) {
      if (schedule == "sync") {
        graph.sync_iter();
      }

      n_iters++;
    }

  }

  // *********************** Factor graph functions ************************* 

  function creategraph(graph, n_var_nodes, spring_meas_std) {

    let dist = (svg_width - 2*x_buffer) / (n_var_nodes - 1);
    dist = 200;
    // Create variable nodes
    for(var i=0; i<n_var_nodes; i++) {
      const new_var_node = new gbp1d.VariableNode(i, anchor + x_buffer + i*dist, prior_std);
      graph.var_nodes.push(new_var_node);
    }

    // Create unary factor connecting first mass to anchor
    var new_factor = new gbp1d.UnaryFactor(anchor + x_buffer, spring_meas_std, 0, anchor, graph.var_nodes[0].belief);
    graph.factors.push(new_factor);
    graph.var_nodes[0].adj_factors.push(new_factor);

    // Create unary factor connecting last mass to anchor
    var new_factor = new gbp1d.UnaryFactor(graph.var_nodes[n_var_nodes - 1].belief.getMean().get(0, 0), 
                                            spring_meas_std, n_var_nodes-1, anchor_end, graph.var_nodes[n_var_nodes - 1].belief);
    graph.factors.push(new_factor);
    graph.var_nodes[n_var_nodes - 1].adj_factors.push(new_factor);


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

    spring_meas_lam = spring_meas_lam_int / 10000;

    // Update factors
    for (let i=0; i < graph.factors.length; i++) {
      if (graph.factors[i].type == "unary") {
        graph.factors[i].std = 1 / Math.sqrt(spring_meas_lam);
        graph.factors[i].update_message();
      }
      else if (graph.factors[i].type == "binary") {
        graph.factors[i].lambdas[0] = spring_meas_lam;
        graph.factors[i].compute_factor();
      }

    }
  }

  function handle_mode_change() {
    
    if (mode == "set_springs") {

      // Set current node positions as gt positions and reset beliefs
      for (let i=0; i < n_var_nodes; ++i) {
        const belief_mean = graph.var_nodes[i].belief.getMean().get(0, 0);
        graph.var_nodes[i].gt = belief_mean;
        graph.var_nodes[i].reset_belief_and_prior(belief_mean, prior_std);
      }

      for (let i=0; i < graph.factors.length; i++) {
        if (graph.factors[i].type == "unary") {
          graph.factors[i].mean = graph.var_nodes[graph.factors[i].adj_var_id].gt;
          graph.factors[i].update_message();
        }
        else {
          graph.factors[i].meas[0] = graph.var_nodes[graph.factors[i].adj_var_ids[1]].gt - graph.var_nodes[graph.factors[i].adj_var_ids[0]].gt;
          graph.factors[i].compute_factor();
        }
      }

    }

    if (mode == "set_init") {
      // Set current node positions as gt positions and reset beliefs
      for (let i=0; i < n_var_nodes; ++i) {
        let belief_mean = graph.var_nodes[i].belief.getMean().get(0, 0);
        graph.var_nodes[i].reset_belief_and_prior(belief_mean, prior_std);
      }
    }

  }


  // ************************ Event handlers *************************

  function toggleGBP() {
    gbp_on = !gbp_on;
  }

  function reset() {
    console.log("to do reset function");
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
      
      // If in set springs mode then change gt mass locations or anchor
      if (node_mousedown && mode == "set_springs") {
        if (node_mousedown.id == "anchor_end") {
          // Move right-most anchor
          anchor_end = Math.max(var_nodes[n_var_nodes - 1].gt + min_spring_size, Math.min(current_mouse_location.x, svg_width - edge_buffer));
          factor_nodes[1].anchor_loc = anchor_end;
          factor_nodes[1].update_path(map_y_spring);
        }
        else {
          // Move node with mouse
          moving_node = true;
          var min_bound = anchor + min_spring_size;
          var max_bound = anchor_end - min_spring_size;
          if (node_mousedown.id != 0) {
            min_bound = var_nodes[node_mousedown.id - 1].gt + min_spring_size;
          }
          if (node_mousedown.id != n_var_nodes-1) {
            max_bound = var_nodes[node_mousedown.id + 1].gt - min_spring_size;
          }
          node_mousedown.gt = Math.min(Math.max(current_mouse_location.x, min_bound), max_bound);
          node_mousedown.reset_belief_and_prior(node_mousedown.gt, prior_std);
        }
      }
      // if in set init mode then change var node priors 
      else if (node_mousedown && mode == "set_init") {
        if (node_mousedown.id == "anchor_end") {
          // Move right-most anchor
          anchor_end = Math.max(var_nodes[n_var_nodes - 1].belief.getMean().get(0, 0) + min_spring_size, Math.min(current_mouse_location.x, svg_width - edge_buffer));
          factor_nodes[1].anchor_loc = anchor_end;
          factor_nodes[1].mean = anchor_end - factor_nodes[1].spring_nat_length;
          factor_nodes[1].update_path_init(map_y_spring);
          factor_nodes[1].update_message();
        }
        else {
          // Move node with mouse
          moving_node = true;
          var min_bound = anchor + min_spring_size;
          var max_bound = anchor_end - min_spring_size;
          if (node_mousedown.id != 0) {
            min_bound = var_nodes[node_mousedown.id - 1].belief.getMean().get(0, 0) + min_spring_size;
          }
          if (node_mousedown.id != n_var_nodes-1) {
            max_bound = var_nodes[node_mousedown.id + 1].belief.getMean().get(0, 0) - min_spring_size;
          }
          var prior_mean = Math.min(Math.max(current_mouse_location.x, min_bound), max_bound);
          node_mousedown.reset_belief_and_prior(prior_mean, prior_std);
        }
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
    console.log(node_mousedown);
    if (node_mousedown && node_mousedown.id != "anchor_end") {
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
            factor_node.mean = node_mousedown.gt;
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



<svg style="display: none;" xmlns="http://www.w3.org/2000/svg">
    <symbol id="playIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path><path d="M0 0h24v24H0z" fill="none"></path></symbol>
    <symbol id="pauseIcon" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path><path d="M0 0h24v24H0z" fill="none"></path></symbol>
    <symbol id="resetIcon" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"></path><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"></path></symbol>
</svg>

<style>

  .icon {
    width: 30px; height: 30px;
    background: steelblue;
    fill: white;
    color: white;
    border-radius: 20px;
    padding: 5px;
    margin: 2px;
    cursor: pointer;
    position:relative;
  }

  .button {
    outline: none;
		width: fit-content;
    height: fit-content;
  }

  .demo-container {
    display:inline-block;
  }

  .gbp-container {
    position: relative;
    width: 70%;
    float: left;
    margin-right:5px;
  }

  .settings-panel {
    position: relative;
    width: 29%;
    float: left;
  }
  svg {
    width: 100%;
    height: 100%;
    float: left;
  }
</style>


<div class="demo-container">
	<div class="gbp-container">
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


      {#each factor_nodes as factor, i}
        {#if mode == "set_springs"}
          <path d="{factor.path}" class="curve" stroke="{colors[0]}" stroke-width="2" fill="none"></path>
        {:else} 
          <path d="{factor.path}" class="curve" stroke="{factor.color}" stroke-width="2" fill="none"></path>
        {/if}
      {/each}

      <!-- Draw gt var nodes -->

        {#each var_nodes as var_node, i}
          {#if mode != "play"}
            <g class="node_g" id={var_node.id} cursor="pointer" draggable="true">
              <circle 
                id={"var_node_gt_"+i}
                cx={var_node.belief.getMean().get(0, 0)}
                cy={svg_height / 2}
                r={node_radius}
                stroke="#0095DD"
                fill="#0095DD"/>
            </g>
          {:else}
            <circle 
              id={"var_node_gt_"+i}
              cx={var_node.belief.getMean().get(0, 0)}
              cy={svg_height / 2}
              r={node_radius}
              stroke="black"
              fill="black"/>
          {/if}
        {/each}

        {#if show_MAP && mode != "set_springs"} 
          {#each var_nodes as var_node, i}
              <path d="{var_node.MAP_path}" class="curve" stroke="green" stroke-width="6" opacity="0.9" fill="none"></path>
          {/each}
        {/if}

        {#if mode != "set_springs"}
          {#each var_nodes as var_node, i}
            <path d="{var_node.belief_path}" class="curve" stroke="black" stroke-width="2" fill="none"></path>
          {/each}
        {/if}


      <!-- Draw anchor varaible node -->
      <rect
        id="anchor"
        x={anchor-10}
        y={svg_height / 2 - 25}
        width={20}
        height={50}
        stroke="00FF00"
        fill="00FF00" />
      {#if mode != "play"}
        <g class="node_g" id="anchor_end" cursor="pointer" draggable="true">
          <rect
            id="anchor_end"
            x={anchor_end-10}
            y={svg_height / 2 - 25}
            width={20}
            height={50}
            stroke="#0095DD"
            fill="#0095DD" />
        </g>
      {:else}
        <rect
          id="anchor_end"
          x={anchor_end-10}
          y={svg_height / 2 - 25}
          width={20}
          height={50}
          stroke="black"
          fill="black" />
      {/if}

    </svg>

	</div>
  
  <!-- Draw settings panel -->
  <div class="settings-panel">

    <label class="radio-inline">
      <input type="radio" bind:group={mode} on:change={handle_mode_change} value="set_springs"> Set natural length of springs
    </label>
    <br>
    <label class="radio-inline">
      <input type="radio" bind:group={mode} on:change={handle_mode_change} value="set_init"> Set initial position of masses
    </label>
    <br>
    <label class="radio-inline">
      <input type="radio" bind:group={mode} on:change={handle_mode_change} value="play"> Run mode
    </label>
    <br>


    <div class:boxon={mode === "play"} class:boxoff={mode != "play"}>

      <div style="float:left;">
        {#if gbp_on}
          <button class="button" data-tooltip="Pause GBP" on:click={toggleGBP}>
            <svg class="icon" id="pause"><use xlink:href="#pauseIcon"></use></svg>
          </button>
        {:else}
          <button class="button" data-tooltip="Play GBP" on:click={toggleGBP}>
            <svg class="icon" id="play"><use xlink:href="#playIcon"></use></svg>
          </button>
        {/if}

        <button class="button" data-tooltip="Reset function todo" on:click={reset}>
          <svg class="icon" id="reset"><use xlink:href="#resetIcon"></use></svg>
        </button>
      </div>

      <label class="slider" style="display: inline-block text-align: center; width:60%; font-size: 15px; float: left; margin-left: 15px">
        <span><b>Iteration {n_iters}</b> &nbsp; (iters / s: {iters_per_sec})</span><br>
        <input type="range" min="1" max="20" bind:value={iters_per_sec}><br>
      </label>

      <br>
      <span style="color: blue"> <b>Schedule: </b> </span>
      <label class="radio-inline">
        <input type="radio" bind:group={schedule} value="sweep"> Sweep
      </label>
      <label class="radio-inline">
        <input type="radio" bind:group={schedule} value="sync"> Sync
      </label>      
    </div>
      


    <br>
    <label class="slider">
      <span>Spring constant, k = <b>{(spring_meas_lam_int / 100).toFixed(2)}</b></span><br>
      <input type="range" min="1" max="400" bind:value={spring_meas_lam_int} on:change={update_spring_constant}><br>
    </label>


    {#if mode != "set_springs"}
      Spring internal energy: {energy.toFixed(2)}

      <div>
        <span style="color: blue"> <b>MAP</b> </span>
        <label class="checkbox-inline">
          <input
            type="checkbox"
            id="toggle_MAP_checkbox"
            bind:checked={show_MAP} />
        </label>
      </div>
    {/if}

    {#if mode == "play"}
      Distance to MAP: {dist_to_MAP.toFixed(2)}
    {/if}
    <br>

    <div id="left-demo-tip">
      <img id="pointer" src="images/pointer.svg" alt="pointer" style="width: 40px">
      <div id="hint">
          Blue objects are draggable.                
      </div>
    </div>
    
    
  </div>
  
</div>
