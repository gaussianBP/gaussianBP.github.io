<script>
  import { onMount } from "svelte";
  import { onInterval } from "../utils/util.js";
  import * as gbp from "../gbp/gbp_playground.js";

  // svg
  let svg;
  let svg_width = 800;
  let svg_height = 800;

  // Playground
  let graph;
  $: var_nodes = [];
  $: factor_nodes = [];

  let n_landmarks = 20;

  // GBP parameters
  // var eta_damping = 0;
  let lmk_prior_std = 60;
  let robot_prior_std = 60;
  let meas_model = "linear";

  let odometry_params = {
    "linear" : {
      "noise_model_std": 40,
      "noise_std": 2,
    },
  }

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

  // UI
  const time_res = 0.01; // time resolution
  let iters_per_sec = 10;
  let n_iters = 0; // this counts how many times the overall graph has completed a sweep/sync
  let iter_sec = 1.0;
  let counter = 0;
  let gbp_on = true;

  let show_belief_mean = true;
  let show_belief_cov = true;
  let show_MAP_mean = false;
  let show_MAP_cov = false;
  let show_ground_truth = true;
  let show_edges = true;

  // Visual appearance
  const factor_size = 20;
  const radius = 10;
  const lmk_radius = 6;
  const mean_radius = 2;
  const gt_color = "green";
  const belief_color = "red";
  const map_color = "blue";
  const linear_color = "orange";
  const nonlinear_color = "purple";
  const robot_color = "red";
  const lmk_color = "orange";
  const lmk_belief_color = "yellow";


  // Robot motion params
  let robot_loc = {x: 100, y: 100};
  let last_key_pose = {x: robot_loc.x, y: robot_loc.y};
  const step = 11;
  const new_pose_dist = 75;
  const meas_range = 150;


  onMount(() => {
    reset_playground();
  });

  onInterval(() => update_playground(), 10);

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

    // graph.update_priors(prior_std, true);  // Update beliefs as prior std is changed with slider
    graph.update_factor_noise_models_robotsim(meas_params, odometry_params, n_landmarks);  // Update factors as meas noise models are changed with sliders
    graph.update_cov_ellipses();
    graph.compute_MAP();
  }

  function pass_message_interval() {
    // Enables pass message in adjustable interval
    if (gbp_on) {
      if (counter * time_res >= iter_sec ) {
        counter = 0;
        graph.relinearize();
        sync_pass_message();
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
    graph = new gbp.FactorGraph();

    // Generate landmarks, first landmark near robot
    let lmk1_todo = true;
    while (lmk1_todo) {
      var x = robot_loc.x + Math.random() * meas_range / Math.sqrt(2) - meas_range / (2 * Math.sqrt(2)); 
      var y = robot_loc.y + Math.random() * meas_range / Math.sqrt(2) - meas_range / (2 * Math.sqrt(2)); 
      if ( x>20 && x<svg_width-20 && y>20 && y<svg_height-20) {
        graph.add_var_node(x, y, lmk_prior_std, 0, n_landmarks);
        lmk1_todo = false;
      }
    }
    for (var i=0; i<n_landmarks-1; i++) {
      var x = Math.random() * (svg_width - 20) + 10;
      var y = Math.random() * (svg_height - 20) + 10;
      graph.add_var_node(x, y, lmk_prior_std, 0, n_landmarks);
    }

    graph.add_var_node(robot_loc.x, robot_loc.y, robot_prior_std, n_landmarks, n_landmarks);

    console.log(graph.var_nodes)

    add_meas_factors();  // add initial measurements

    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;

    return graph;
  }

  function reset_playground() {
    graph = create_empty_playground();
    graph.update_beliefs();
    graph.compute_MAP();
    update_playground();
    gbp_on = true;
    n_iters = 0;
  }

  function add_meas_factors() {
    // Add measurement factors for latest robot pose
    let pose = graph.var_nodes[graph.var_nodes.length - 1];

    for (var j=0; j<n_landmarks; j++) {
      let lmk = graph.var_nodes[j];
      var dist = Math.sqrt(Math.pow(lmk.x - pose.x, 2) + Math.pow(lmk.y - pose.y, 2));
      if (dist < meas_range) {
        graph.add_factor_node(pose.id, lmk.id, meas_model, meas_params);
      }
    }
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
    gbp_on = true;
  }
 

  function check_add_new_pose() {
    const dist = Math.sqrt(Math.pow(robot_loc.x - last_key_pose.x, 2) + Math.pow(robot_loc.y - last_key_pose.y, 2));

    if (dist > new_pose_dist) {
      graph.add_var_node(robot_loc.x, robot_loc.y, robot_prior_std);
      last_key_pose = {x: robot_loc.x, y: robot_loc.y};
      graph.add_factor_node(var_nodes[var_nodes.length-2].id, var_nodes[var_nodes.length-1].id, "linear", odometry_params);
      add_meas_factors(); 
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


  function toggle_gbp() {
    gbp_on = !gbp_on;
    if (gbp_on) {
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
        <radialGradient id="lmk_belief_cov_gradient">
          <stop offset="0.35" stop-color="{lmk_belief_color}" stop-opacity="0.5" />
          <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
        </radialGradient>
        <radialGradient id="robot_belief_cov_gradient">
          <stop offset="0.35" stop-color="{belief_color}" stop-opacity="0.5" />
          <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
        </radialGradient>
        <radialGradient id="MAP_cov_gradient">
          <stop offset="0.35" stop-color="blue" stop-opacity="0.5" />
          <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
        </radialGradient>
      </defs>

      <!-- Draw edges -->
      {#each factor_nodes as factor, i}
        {#if factor.adj_ids[1] < n_landmarks}
          <line 
            x1={factor.adj_beliefs[0].getMean().get(0,0)} 
            y1={factor.adj_beliefs[0].getMean().get(1,0)} 
            x2={factor.adj_beliefs[1].getMean().get(0,0)} 
            y2={factor.adj_beliefs[1].getMean().get(1,0)} 
            stroke="blue" 
            stroke-width="1"/>
        {:else}
          <line 
            x1={factor.adj_beliefs[0].getMean().get(0,0)} 
            y1={factor.adj_beliefs[0].getMean().get(1,0)} 
            x2={factor.adj_beliefs[1].getMean().get(0,0)} 
            y2={factor.adj_beliefs[1].getMean().get(1,0)} 
            stroke="black" 
            stroke-width="1"/>
        {/if}
      {/each}


      {#each var_nodes as var_node, i}

        <!-- Draw landmarks -->
        {#if var_node.id < n_landmarks}
          {#if var_node.adj_ids.length == 0}
            <circle cx={var_node.x} cy={var_node.y} r={lmk_radius} fill={lmk_color}/>
          {:else}

            {#if show_ground_truth}
              <circle cx={var_node.x} cy={var_node.y} r={mean_radius} fill={gt_color}/>
            {/if}

            {#if show_MAP_mean}
              <circle cx={var_node.MAP_ellipse.cx} cy={var_node.MAP_ellipse.cy} r={mean_radius} fill={map_color}/>
            {/if}

            {#if show_MAP_cov}
              <ellipse
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

            {#if show_belief_mean}
              <circle id={"node_belief_mean_"+var_node.id} cx={var_node.belief_ellipse.cx} cy={var_node.belief_ellipse.cy} r={mean_radius} fill={belief_color}/>
            {/if}
            {#if show_belief_cov}
              <ellipse
                cx={var_node.belief_ellipse.cx}
                cy={var_node.belief_ellipse.cy}
                rx={var_node.belief_ellipse.rx}
                ry={var_node.belief_ellipse.ry}
                transform="rotate({var_node.belief_ellipse.angle}, {var_node.belief_ellipse.cx}, {var_node.belief_ellipse.cy})"
                stroke={lmk_belief_color}
                fill="url(#lmk_belief_cov_gradient)"
                stroke-opacity={0.75} />
              <ellipse
                cx={var_node.belief_ellipse.cx}
                cy={var_node.belief_ellipse.cy}
                rx={var_node.belief_ellipse.rx}
                ry={var_node.belief_ellipse.ry}
                transform="rotate({var_node.belief_ellipse.angle}, {var_node.belief_ellipse.cx}, {var_node.belief_ellipse.cy})"
                stroke={lmk_belief_color}
                stroke-width={2}
                stroke-opacity={0}
                fill={lmk_belief_color}
                fill-opacity={0} />
            {/if}
          {/if}


        <!-- Draw robot poses -->
        {:else}

          {#if show_ground_truth}
            <circle cx={var_node.x} cy={var_node.y} r={mean_radius} fill={gt_color}/>
          {/if}

          {#if show_MAP_mean}
            <circle cx={var_node.MAP_ellipse.cx} cy={var_node.MAP_ellipse.cy} r={mean_radius} fill={map_color}/>
          {/if}

          {#if show_MAP_cov}
            <ellipse
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

          {#if show_belief_mean}
            <circle id={"node_belief_mean_"+var_node.id} cx={var_node.belief_ellipse.cx} cy={var_node.belief_ellipse.cy} r={mean_radius} fill={belief_color}/>
          {/if}
          {#if show_belief_cov}
            <ellipse
              cx={var_node.belief_ellipse.cx}
              cy={var_node.belief_ellipse.cy}
              rx={var_node.belief_ellipse.rx}
              ry={var_node.belief_ellipse.ry}
              transform="rotate({var_node.belief_ellipse.angle}, {var_node.belief_ellipse.cx}, {var_node.belief_ellipse.cy})"
              stroke={belief_color}
              fill="url(#robot_belief_cov_gradient)"
              stroke-opacity={0.75} />
            <ellipse
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
        {/if}
      {/each}

      <circle cx={robot_loc.x} cy={robot_loc.y} r={radius} fill={robot_color}/>

    </svg>
  </div>


  <div id="playground-settings-panel">

    <div style="display: inline-block;">
      {#if gbp_on}
        <button class="icon-button" style="outline: none;" data-tooltip="Pause GBP" on:click={toggle_gbp}>
          <svg class="icon" id="pause"><use xlink:href="#pauseIcon"></use></svg>
        </button>
      {:else}
        <button class="icon-button" style="outline: none;" data-tooltip="Play GBP" on:click={toggle_gbp}>
          <svg class="icon" id="play"><use xlink:href="#playIcon"></use></svg>
        </button>
      {/if}

      <button class="icon-button" style="outline: none;" data-tooltip="Reset playground" on:click={reset_playground}>
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
        <span> Odometry noise model std: {odometry_params["linear"]["noise_model_std"]} </span><br>
        <input type="range" min="5" max="60" bind:value={odometry_params["linear"]["noise_model_std"]} style="width:200px;"/><br>
      </label>

      {#if meas_model == "linear"}
        <label class="slider">
          Landmark noise model std: {meas_params["linear"]["noise_model_std"]}
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
        <input type="range" min="1" max="20" step="0.1" bind:value={iters_per_sec} style="width:200px;"/>
      </label>

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

