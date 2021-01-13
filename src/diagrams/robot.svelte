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
  import anime from "animejs";


  // GBP parameters
  // var eta_damping = 0;
  let prior_std = 50;
  let meas_params = {
    "linear" : {
      "noise_model_std": 40,
      "noise_std": 2,
    },
    "nonlinear" : {
      "angle_noise_model_std": 0.5,
      "angle_noise_std": 0.4,  
      "dist_noise_model_std": 40,
      "dist_noise_std": 2,
    }
  };

  let forward_sweep = true;

  // svg
  let svg;
  let svg_width = 800;
  let svg_height = 800;

  // Playground
  let graph;
  $: var_nodes = [];
  $: factor_nodes = [];
  let edges = [];

  let n_var_nodes = 5;
  let meas_model = "linear";
  let bidir_sweep = true;
  let message_idx = 0;
  let last_message_idx = null;


  // Drag and drop function
  const click_time_span = 150; // Threshold for time span during click
  let mousedown_time = null;
  let click_time = null;
  let mouse_up = false;
  let moving_node = false;
  $: node_mousedown = null;
  $: node_onhover = null;
  let node_clicked = null;
  let last_node_clicked = null;
  let current_mouse_location = { x: null, y: null };

  // UI
  const time_res = 0.1; // time resolution
  let iters_per_sec = 1;
  let n_iters = 0; // this counts how many times the overall graph has completed a sweep/sync
  let iter = 0; // this counts each individual sweep
  let iter_sec = 1.0;
  let counter = 0;
  let passing_message = false;

  let show_belief_mean = true;
  let show_belief_cov = true;
  let show_MAP_mean = true;
  let show_MAP_cov = true;
  let show_ground_truth = true;
  let show_edges = true;

  // Visual appearance
  let factor_size = 20;
  let radius = 10;
  let mean_radius = 2;
  let can_open = false;
  let gt_color = "green";
  let belief_color = "red";
  let map_color = "blue";
  let linear_color = "orange";
  let nonlinear_color = "purple";

  // added

  // Robot motion params
  const step = 11;
  let new_pose_dist = 75;
  let robot_loc = {x: 100, y: 100};
  let last_key_pose = {x: robot_loc.x, y: robot_loc.y};
  let robot_color = "red";

  let landmarks_gt = [];

  onMount(() => {
    reset_playground();
  });

  onInterval(() => update_playground(), parseInt(1000 / 60));

  onInterval(() => pass_message_interval(), 1000 * time_res);


  // ************************************************************
  // Callback functions
  // ************************************************************

  function update_playground() {
    graph.update_node_id();
    graph.update_factor_node_location();
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;

    iter_sec = 1 / iters_per_sec;

    check_add_new_pose()

    graph.update_priors(prior_std, true);  // Update beliefs as prior std is changed with slider
    graph.update_cov_ellipses();
    graph.update_factor_noise_models(meas_params);  // Update factors as meas noise models are changed with sliders
    graph.compute_MAP();
  }

  function pass_message_interval() {
    // Enables pass message in adjustable interval
    if (passing_message) {
      if (counter >= iter_sec * 10 - 1 || !iter_sec) {
        counter = 0;
        if (!pause_one_iter) {
          graph.relinearize();
          pass_message();

        } else {
          pause_one_iter = false;
        }
      } else {
        counter++;
      }
    }
  }

  // ************************************************************
  // Playground templates
  // ************************************************************

  function create_empty_playground() {

    // Create initial factor graph
    graph = new playground.FactorGraph();
    graph.add_var_node(robot_loc.x, robot_loc.y, prior_std, 0);

    // // Generate landmarks, first landmark near robot
    // let lmk1_todo = true;
    // while (lmk1_todo) {
    //   var x = robot_loc.x + Math.random() * meas_range / Math.sqrt(2) - meas_range / (2 * Math.sqrt(2)); 
    //   var y = robot_loc.y + Math.random() * meas_range / Math.sqrt(2) - meas_range / (2 * Math.sqrt(2)); 
    //   if ((x>20) && (x<svg_width-20) && (y>20) && (y<svg_height-20)) {
    //     lmk1_todo = false;
    //   }
    // }
    // landmarks_gt.push({x: x, y: y});
    // lmk_observed_yet.push(0);
    // lmk_graph_ix.push(-1);
    // for (var i=0; i<n_landmarks-1; i++) {
    //   var x = Math.random()*(canvas.width-20) + 10;
    //   var y = Math.random()*(canvas.height-20) + 10;
    //   landmarks_gt.push({x: x, y: y});
    //   lmk_observed_yet.push(0);
    //   lmk_graph_ix.push(-1);
    // }

    // addMeasurementFactors();  // add initial measurements

    return graph;
  }

  function reset_playground() {
    // console.clear();
    var_nodes = [];
    factor_nodes = [];
    edges = [];
    message_idx = 0;
    passing_message = false;
    graph = create_empty_playground(n_var_nodes);
    graph.update_beliefs();
    graph.compute_MAP();
    update_playground();
    n_iters = 0;
    iter = 0;
  }

  // ************************************************************
  // Message passing functions
  // ************************************************************


  function sync_pass_message() {
    for (var i = 0; i < graph.factor_nodes.length; i++) {
      graph.factor_nodes[i].pass_message(graph);
    }
    for (var i = 0; i < graph.var_nodes.length; i++) {
      graph.var_nodes[i].pass_message(graph);
      graph.var_nodes[i].update_cov_ellipse();
    }
    n_iters++;
    iter++;
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
        (adj_id) => graph.find_node(adj_id).belief
      );
      factor_node.zero_messages();
      factor_node.compute_factor();
    }
    // sync_pass_message();
    n_iters = 0;
    iter = 0;
    passing_message = false;
    message_idx = 0;
  }
 

  function check_add_new_pose() {
    const dist = Math.sqrt(Math.pow(robot_loc.x - last_key_pose.x, 2) + Math.pow(robot_loc.y - last_key_pose.y, 2));

    if (dist > new_pose_dist) {
      graph.add_var_node(robot_loc.x, robot_loc.y, prior_std);
      last_key_pose = {x: robot_loc.x, y: robot_loc.y};

      graph.add_factor_node(graph.var_nodes.length-2, graph.var_nodes.length-1, "linear", meas_params);

      // addMeasurementFactors();
    }
  }


  function click_handler(e) {
    // add landmark
  }

  // If factors are linear they are replaced by nonlinear factors and vice-versa
  function change_meas_model(e, id = null) {
    clear_previous_message();
    graph.update_meas_model(meas_model, meas_params, id);
    clear_previous_message();
  }


  function toggle_passing_message() {
    passing_message = !passing_message;
    if (passing_message) {
      counter = iter_sec * 10 - 1;
    }
  }

  function max(list) {
    return Math.max(...list.map((sub_list) => Math.max(...sub_list)));
  }

  function min(list) {
    return Math.min(...list.map((sub_list) => Math.min(...sub_list)));
  }



	function handleKeydown(e) {
    if (e.key == "w") {
      if (robot_loc.y > radius + step) {
        robot_loc.y -= step;
      }
    }
    else if (e.key == "s") {
      if (robot_loc.y < svg_height - radius - step) {
        robot_loc.y += step;
      }
    }
    else if (e.key == "a") {
      if (robot_loc.x > radius + step) {
        robot_loc.x -= step;
      }
    }
    else if (e.key == "d") {
      if (robot_loc.x < svg_width - radius - step) {
        robot_loc.x += step;
      }
    }
	}

</script>

<style>
  svg {
    width: 100%;
    height: 100%;
    float: left;
  }

  .icon {
    width: 40px; height: 40px;
    background: steelblue;
    fill: white;
    color: white;
    border-radius: 20px;
    padding: 5px;
    margin: 0px;
    cursor: pointer;
    position: relative;
  }

  .button {
    outline: none;
    width: fit-content;
    height: fit-content;
    float: left;
  }

</style>

<svelte:head>
	<link rel="stylesheet" href="https://unpkg.com/mono-icons@1.0.5/iconfont/icons.css" >
</svelte:head>

<svelte:window on:keydown={handleKeydown}/>


<div class="demo-container">

  <div id="playground-container">

    <svg
      bind:this={svg}
      width={svg_width}
      height={svg_height}
      on:click={click_handler}>

      <defs>
        <radialGradient id="belief_cov_gradient">
          <stop offset="0.35" stop-color="red" stop-opacity="0.5" />
          <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
        </radialGradient>
        <radialGradient id="MAP_cov_gradient">
          <stop offset="0.35" stop-color="blue" stop-opacity="0.5" />
          <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
        </radialGradient>
      </defs>

      <circle cx={robot_loc.x} cy={robot_loc.y} r={radius} fill={robot_color}/>


      <!-- Draw edges -->
      {#if show_edges}
        {#each edges as edge}
          {#if edge.type == 0 }
            <line id={"edge_type_0_"+edge.edge_id} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke="black" stroke-width="1"/>
          {/if}
          {#if edge.type == 0  && (show_belief_mean || show_belief_cov)}
            <!-- {#if edge.node1_id == update_var_node.node_id && iter_sec}
              <line
                x1={update_var_node.new.cx * $update_var_node_cov_progress + update_var_node.old.cx * (1 - $update_var_node_cov_progress)}
                y1={update_var_node.new.cy * $update_var_node_cov_progress + update_var_node.old.cy * (1 - $update_var_node_cov_progress)}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5" />
            {/if}
            {#if edge.node2_id == update_var_node.node_id && iter_sec}
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={update_var_node.new.cx * $update_var_node_cov_progress + update_var_node.old.cx * (1 - $update_var_node_cov_progress)}
                y2={update_var_node.new.cy * $update_var_node_cov_progress + update_var_node.old.cy * (1 - $update_var_node_cov_progress)}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5" />
            {/if} -->
            {#if edge.node1_id == update_var_node.node_id && iter_sec}
              <line
                x1={update_var_node.old.cx}
                y1={update_var_node.old.cy}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5" />
            {/if}
            {#if edge.node2_id == update_var_node.node_id && iter_sec}
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={update_var_node.old.cx}
                y2={update_var_node.old.cy}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5" />
            {/if}
            {#if edge.node1_id != update_var_node.node_id && edge.node2_id != update_var_node.node_id}
              <line
                id={"edge_"+edge.edge_id}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5" />
            {/if}
          {/if}
          {#if edge.type == 1 && mode != "edit" && show_ground_truth && (show_belief_mean || show_belief_cov)}
            <!-- {#if edge.node1_id == update_var_node.node_id && iter_sec}
              <line
                x1={update_var_node.new.cx * $update_var_node_cov_progress + update_var_node.old.cx * (1 - $update_var_node_cov_progress)}
                y1={update_var_node.new.cy * $update_var_node_cov_progress + update_var_node.old.cy * (1 - $update_var_node_cov_progress)}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5"
                stroke-dasharray="2, 4" />
            {:else} -->
              <line
                id={"edge_"+edge.edge_id}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5"
                stroke-dasharray="2, 4" />
            <!-- {/if} -->
          {/if}
          {#if edge.type == 2 && mode != "edit" && (show_MAP_mean || show_MAP_cov) && (show_belief_mean || show_belief_cov)}
            <!-- {#if edge.node1_id == update_var_node.node_id && iter_sec}
              <line
                x1={update_var_node.new.cx * $update_var_node_cov_progress + update_var_node.old.cx * (1 - $update_var_node_cov_progress)}
                y1={update_var_node.new.cy * $update_var_node_cov_progress + update_var_node.old.cy * (1 - $update_var_node_cov_progress)}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5"
                stroke-dasharray="2, 4" />
            {:else} -->
              <line
                id={"edge_"+edge.edge_id}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke="black"
                stroke-width="1"
                stroke-opacity="0.5"
                stroke-dasharray="2, 4" />
            <!-- {/if} -->
          {/if}
          {#if edge.type == 3 && (show_MAP_mean || show_MAP_cov) && show_ground_truth && !(show_belief_mean || show_belief_cov)}
            <line
              id={"edge_"+edge.edge_id}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="black"
              stroke-width="1"
              stroke-opacity="0.5"
              stroke-dasharray="2, 4" />
          {/if}
        {/each}
      {/if}
      {#if last_node_clicked && !moving_node}
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

      <!-- Display variable nodes -->
      {#each var_nodes as var_node, i}

        {#if show_ground_truth}
          <circle cx={var_node.x} cy={var_node.y} r={mean_radius} fill={gt_color}/>
        {/if}

        {#if show_MAP_mean}
          <circle cx={var_node.MAP_ellipse.cx} cy={var_node.MAP_ellipse.cy} r={mean_radius} fill={map_color}/>
        {/if}

        {#if show_MAP_cov}
          <ellipse
            class="node_MAP_cov"
            cx={var_node.MAP_ellipse.cx}
            cy={var_node.MAP_ellipse.cy}
            rx={var_node.MAP_ellipse.rx}
            ry={var_node.MAP_ellipse.ry}
            transform="rotate({var_node.MAP_ellipse.angle}, {var_node.MAP_ellipse.cx}, {var_node.MAP_ellipse.cy})"
            stroke={map_color}
            fill="url(#MAP_cov_gradient)"
            stroke-opacity={0.5}
            fill-opacity={0} />
        {/if}

        <g class="node_g" id={var_node.id} cursor="pointer" draggable="true">
          {#if show_belief_mean}
            <circle id={"node_belief_mean_"+var_node.id} cx={var_node.belief_ellipse.cx} cy={var_node.belief_ellipse.cy} r={mean_radius} fill={belief_color}/>
          {/if}
          {#if show_belief_cov}
            <ellipse
              class="node_belief_cov"
              id={"node_belief_cov_"+var_node.id}
              cx={var_node.belief_ellipse.cx}
              cy={var_node.belief_ellipse.cy}
              rx={var_node.belief_ellipse.rx}
              ry={var_node.belief_ellipse.ry}
              transform="rotate({var_node.belief_ellipse.angle}, {var_node.belief_ellipse.cx}, {var_node.belief_ellipse.cy})"
              stroke={belief_color}
              fill="url(#belief_cov_gradient)"
              stroke-opacity={0.75} />
            <ellipse
              class="node_belief_cov"
              id={"node_belief_cov_overlay_"+var_node.id}
              cx={var_node.belief_ellipse.cx}
              cy={var_node.belief_ellipse.cy}
              rx={var_node.belief_ellipse.rx}
              ry={var_node.belief_ellipse.ry}
              transform="rotate({var_node.belief_ellipse.angle}, {var_node.belief_ellipse.cx}, {var_node.belief_ellipse.cy})"
              stroke={belief_color}
              stroke-width={2}
              stroke-opacity={0}
              fill={belief_color}
              fill-opacity={0} />
          {/if}
        </g>
      {/each}


    </svg>
  </div>


  <div id="playground-settings-panel">

    <div style="display: inline-block;">
      {#if passing_message}
        <button class="button" data-tooltip="Pause GBP" on:click={toggle_passing_message}>
          <svg class="icon" id="pause"><use xlink:href="#pauseIcon"></use></svg>
        </button>
      {:else}
        <button class="button" data-tooltip="Play GBP" on:click={toggle_passing_message}>
          <svg class="icon" id="play"><use xlink:href="#playIcon"></use></svg>
        </button>
      {/if}

      <button class="button" data-tooltip="Reset playground" on:click={reset_playground}>
        <svg class="icon" id="reset"><use xlink:href="#resetIcon"></use></svg>
      </button>

    </div>


    <div class="boxon">

      <div>
        Factor Type:
        <br />
        <label class="radio-inline">
          <input type="radio" bind:group={meas_model} value="linear" on:change={change_meas_model}> 
          <span style="color: {linear_color}"> Linear </span>
        </label>
        <label class="radio-inline">
          <input type="radio" bind:group={meas_model} value="nonlinear" on:change={change_meas_model}>
          <span style="color: {nonlinear_color}"> Non-linear </span>

        </label>    
      </div>

      <label class="slider">
        <span> Prior std: {prior_std} </span><br>
        <input type="range" min="30" max="60" bind:value={prior_std} style="width:200px;"/><br>
      </label>

      {#if meas_model == "linear"}
        <label class="slider">
          Meas noise model std: {meas_params["linear"]["noise_model_std"]}
          <input type="range" min="30" max="50" bind:value={meas_params["linear"]["noise_model_std"]} style="width:200px;"/>
        </label>
      {:else if meas_model == "nonlinear"}
        <label class="slider">
          Angle meas noise model std: {meas_params["nonlinear"]["angle_noise_model_std"].toFixed(2)}
          <input type="range" min="0.4" max="0.6" step="0.01" bind:value={meas_params["nonlinear"]["angle_noise_model_std"]} style="width:200px;"/>
        </label>

        <label class="slider">
          Dist meas noise model std: {meas_params["nonlinear"]["dist_noise_model_std"]}
          <input type="range" min="30" max="60" bind:value={meas_params["nonlinear"]["dist_noise_model_std"]} style="width:200px;"/>
        </label>

      {/if}
      <br />

    </div>


    <div class="boxon" style="margin-top: 5px">
      <label class="slider">
        <b>Iteration {n_iters}</b> &nbsp; (iters /s: {iters_per_sec})
        <input type="range" min="1" max="10" step="0.1" bind:value={iters_per_sec} style="width:200px;"/>
      </label>
      <br />

      <br>
      <span>Displays:</span>
      <br>

      <div style="display: inline-block;">
        <span style="color: {belief_color}"> <b>Belief:</b> </span>
        <label class="checkbox-inline">
          <input type="checkbox" bind:checked={show_belief_mean}/> Mean
        </label>
        <label class="checkbox-inline">
          <input type="checkbox" bind:checked={show_belief_cov}/> Cov
        </label>
      </div>

      <div style="display: inline-block;">
        <span style="color: {map_color}"> <b>MAP:</b> </span>
        <label class="checkbox-inline">
          <input type="checkbox" bind:checked={show_MAP_mean}/> Mean
        </label>
        <label class="checkbox-inline">
          <input type="checkbox" bind:checked={show_MAP_cov}/> Cov
        </label>
      </div>

      <label class="checkbox-inline" style="user-select: none; color: {gt_color}}">
        <input type="checkbox" bind:checked={show_ground_truth}/> <span style="color: {gt_color}"> Ground Truth </span>
      </label>
      <br />
    </div>


  </div>

  <!-- <div id="playground-settings-panel">
    Difference to MAP: {belief_MAP_diff.toFixed(2)}<br>
    Energy: {belief_MAP_diff.toFixed(2)}<br>
  </div> -->

  <div id="demo-tip">
    <i class="fa fa-keyboard-o"></i>
    <div id="hint">
      Use WASD to move the robot.                
    </div>
  </div>

</div>

