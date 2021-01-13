<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  import * as m from 'ml-matrix';
  import * as r from 'random';

  import * as gauss from '../gaussian';
  import * as gbp from '../gbp/gbp2d.js';
  import * as nlm from '../gbp/nonlinear_meas_fn.js';

	import { onInterval } from '../util.js';

  // Visual varaibles
  let canvas;
  let var_node_radius = 9;
  let gt_node_radius = 6;

  let then; // time of start of vis
  let display_map = false;
  let visible_alert = false;
  let fullscreen = false;
  let started = false;

  // Measurement model
  let meas_range = 170;
  let lmk_prior_std = 60;
  let robot_prior_std = 60;

  let odometry_distance_std = 30;
  let odometry_angle_std = 0.5;
  let meas_distance_std = 70;
  let meas_angle_std = 0.5;

  const odometry_angle_noise = r.normal(0, 0.1);
  const odometry_dist_noise = r.normal(0, 5);
  const meas_angle_noise = r.normal(0, 0.01);
  const meas_dist_noise = r.normal(0, 2);

  // GBP variables
  let graph;
  let n_landmarks = 25;
  let landmarks_gt = [];
  let poses_gt = [];
  let lmk_observed_yet = [];
  let lmk_graph_ix = [];

  let eta_damping = 0.;

  let sync_on = false;
  let n_iters = 0;
  let iters_per_sec = 25;
  let dist = 0; // Average distance of belief means from MAP solution

  // Robot motion params
  let robot_loc = [80, 720];
  let last_key_pose = [80, 720];
  const step = 11;
  let new_pose_dist = 75;

  onMount(() => {
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 4;

    // Create initial factor graph
    graph = new gbp.FactorGraph();
    let first_pose_node = new gbp.VariableNode(2, n_landmarks);
    first_pose_node.prior.lam = new m.Matrix([[0.1, 0], [0, 0.1]]); 
    first_pose_node.prior.eta = first_pose_node.prior.lam.mmul(new m.Matrix([[robot_loc[0]], [robot_loc[1]]]));

    first_pose_node.update_belief();
    graph.pose_nodes.push(first_pose_node);
    poses_gt.push({x: robot_loc[0], y: robot_loc[1]})

    // data.nodes.push({"id": "cam0", "group": 1});

    // Generate landmarks, first landmark near robot
    let lmk1_todo = true;
    while (lmk1_todo) {
      var x = robot_loc[0] + Math.random() * meas_range / Math.sqrt(2) - meas_range / (2 * Math.sqrt(2)); 
      var y = robot_loc[1] + Math.random() * meas_range / Math.sqrt(2) - meas_range / (2 * Math.sqrt(2)); 
      if ((x>20) && (x<canvas.width-20) && (y>20) && (y<canvas.height-20)) {
        lmk1_todo = false;
      }
    }
    landmarks_gt.push({x: x, y: y});
    lmk_observed_yet.push(0);
    lmk_graph_ix.push(-1);
    for (var i=0; i<n_landmarks-1; i++) {
      var x = Math.random()*(canvas.width-20) + 10;
      var y = Math.random()*(canvas.height-20) + 10;
      landmarks_gt.push({x: x, y: y});
      lmk_observed_yet.push(0);
      lmk_graph_ix.push(-1);
    }

    addMeasurementFactors();  // add initial measurements
    then = Date.now();

  });

	onInterval(() => updateVis(), 25);

    
// ******************************* Drawing functions ********************************

  function drawRobot() {
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(robot_loc[0], robot_loc[1], var_node_radius, 0, Math.PI*2);
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.closePath();
  }

  function drawPoseNodes() {
    const ctx = canvas.getContext("2d");
    for(var c=0; c<graph.pose_nodes.length; c++) {
      const mean = graph.pose_nodes[c].belief.getMean();
      var x = mean.get(0, 0);
      var y = mean.get(1, 0);

      // Draw means
      ctx.beginPath();
      ctx.arc(x, y, var_node_radius, 0, Math.PI*2);
      ctx.fillStyle = "#0095DD";
      ctx.fill();
      ctx.closePath();

      var values = graph.pose_nodes[c].belief.getCovEllipse();
      var eig_values = values[0];
      var angle = values[1];

      // Draw variances
      ctx.beginPath();
      ctx.ellipse(x, y, Math.sqrt(eig_values[0]), Math.sqrt(eig_values[1]), angle, 0, 2*Math.PI)
      ctx.strokeStyle = "#0095DD";
      ctx.stroke();
    }
  }

  function drawLandmarkNodes() {
    const ctx = canvas.getContext("2d");
    for(var c=0; c<graph.lmk_nodes.length; c++) {
      const mean = graph.lmk_nodes[c].belief.getMean();
      var x = mean.get(0, 0);
      var y = mean.get(1, 0);

      // Draw means
      ctx.beginPath();
      ctx.arc(x, y, var_node_radius, 0, Math.PI*2);
      ctx.fillStyle = "yellow";
      ctx.fill();
      ctx.closePath();

      var values = graph.lmk_nodes[c].belief.getCovEllipse();
      var eig_values = values[0];
      var angle = values[1];

      // Draw variances
      ctx.beginPath();
      ctx.ellipse(x, y, Math.sqrt(eig_values[0]), Math.sqrt(eig_values[1]), angle, 0, 2*Math.PI)
      ctx.strokeStyle = "yellow";
      ctx.stroke();
    }
  }

  function drawPosesGT() {
    const ctx = canvas.getContext("2d");
    for(var i=0; i<poses_gt.length; i++) {
      ctx.beginPath();
      ctx.arc(poses_gt[i].x, poses_gt[i].y, gt_node_radius, 0, Math.PI*2);
      ctx.fillStyle = "black";
      ctx.fill();
      ctx.closePath();
    }
  }

  function drawLandmarksGT() {
    const ctx = canvas.getContext("2d");
    for (var i=0; i<landmarks_gt.length; i++) {
      ctx.beginPath();
      ctx.arc(landmarks_gt[i].x, landmarks_gt[i].y, gt_node_radius, 0, Math.PI*2);
      ctx.fillStyle = "orange";
      ctx.fill();
      ctx.closePath();
    }
  }

  function drawLines() {
    const ctx = canvas.getContext("2d");
    for (var c=0; c<graph.factors.length; c++) {
      ctx.beginPath();
      if ((graph.factors[c].adj_var_ids[1] < n_landmarks)) {
        const mean0 = graph.pose_nodes[graph.factors[c].adj_var_ids[0] - n_landmarks].belief.getMean();
        const mean1 = graph.lmk_nodes[lmk_graph_ix[graph.factors[c].adj_var_ids[1]]].belief.getMean();
        ctx.moveTo(mean0.get(0,0), mean0.get(1,0));
        ctx.lineTo(mean1.get(0,0), mean1.get(1,0));
        ctx.strokeStyle = "black";
      } else {
        const mean0 = graph.pose_nodes[graph.factors[c].adj_var_ids[0] - n_landmarks].belief.getMean();
        const mean1 = graph.pose_nodes[graph.factors[c].adj_var_ids[1] - n_landmarks].belief.getMean();
        ctx.moveTo(mean0.get(0,0), mean0.get(1,0));
        ctx.lineTo(mean1.get(0,0), mean1.get(1,0)); 
        ctx.strokeStyle = "blue";
      }
        ctx.stroke();
    }
  }

  function drawMAP() {
    const ctx = canvas.getContext("2d");
    var values = graph.computeMAP(n_landmarks, lmk_graph_ix);
    const means = values[0];
    const bigSigma = values[1];
    for(var c=0; c<graph.lmk_nodes.length; c++) {
      const mean = new m.MatrixSubView(means, c*2, c*2+1, 0, 0);
      const Sigma = new m.MatrixSubView(bigSigma, c*2, c*2+1, c*2, c*2+1);
      var x = mean.get(0, 0);
      var y = mean.get(1, 0);

      // Draw means
      ctx.beginPath();
      ctx.arc(x, y, var_node_radius, 0, Math.PI*2);
      ctx.fillStyle = "green";
      ctx.fill();
      ctx.closePath();

      var values = gauss.getEllipse(Sigma);
      var eig_values = values[0];
      var angle = values[1];

      // Draw variances
      ctx.beginPath();
      ctx.ellipse(x, y, Math.sqrt(eig_values[0]), Math.sqrt(eig_values[1]), angle, 0, 2*Math.PI)
      ctx.strokeStyle = "green";
      ctx.stroke();
    }
    for(var c=0; c<graph.pose_nodes.length; c++) {
      const i = c + graph.lmk_nodes.length;
      const mean = new m.Matrix(new m.MatrixSubView(means, i*2, i*2+1, 0, 0));
      const Sigma = new m.Matrix(new m.MatrixSubView(bigSigma, i*2, i*2+1, i*2, i*2+1));
      var x = mean.get(0, 0);
      var y = mean.get(1, 0);

      // Draw means
      ctx.beginPath();
      ctx.arc(x, y, var_node_radius, 0, Math.PI*2);
      ctx.fillStyle = "green";
      ctx.fill();
      ctx.closePath();

      var values = gauss.getEllipse(Sigma);
      var eig_values = values[0];
      var angle = values[1];

      // Draw variances
      ctx.beginPath();
      ctx.ellipse(x, y, Math.sqrt(eig_values[0]), Math.sqrt(eig_values[1]), angle, 0, 2*Math.PI)
      ctx.strokeStyle = "green";
      ctx.stroke();
    }
  }

  function updateVis() {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var fpsInterval = 1000 / iters_per_sec;
    var now = Date.now();
    var elapsed = now - then;
    if (elapsed > fpsInterval) {
      then = now - (elapsed % fpsInterval);
      if (sync_on) {
        syncGBP();
      } 
    }

    update_lambdas();

    drawLines();
    drawRobot();
    drawPoseNodes();
    drawLandmarkNodes();
    drawPosesGT();
    drawLandmarksGT();
    if (display_map) {
      drawMAP();
    }
    var rect = canvas.getBoundingClientRect();
    if (!(started) && (rect.top < window.innerHeight)) {
      sync_on = true;
      started = true;
    }
  }


  // ******************* GBP functions ***********************

  function syncGBP() {
    // if (n_iters % 20 === 0) {
      graph.relinearise();
    // }
    graph.sync_iter();
    if (!(n_iters == 0)) {
      dist = graph.compare_to_MAP(n_landmarks, lmk_graph_ix);   
    }
    n_iters++;
  }

  function update_lambdas() {
    for(var c=0; c<graph.factors.length; c++) {
      if (graph.factors[c].adj_var_ids[1] >= n_landmarks) {
        var lambda = new m.Matrix([[1 / Math.pow(odometry_angle_std, 2), 0], [0, 1 / Math.pow(odometry_distance_std, 2)]]);
      } else {
        var lambda = new m.Matrix([[1 / Math.pow(meas_angle_std, 2), 0], [0, 1 / Math.pow(meas_distance_std, 2)]]);
      }
      graph.factors[c].lambda = lambda;
    }
  }

  function addLandmarkNode(ix) {
    const lmk_node = new gbp.VariableNode(2, ix);
    var lambda = 1 / Math.pow(lmk_prior_std, 2);
    lmk_node.prior.lam = new m.Matrix([[lambda, 0], [0, lambda]]);
    lmk_node.prior.eta = lmk_node.prior.lam.mmul(new m.Matrix([[landmarks_gt[ix].x], [landmarks_gt[ix].y]]));
    lmk_node.update_belief();
    lmk_graph_ix[ix] = graph.lmk_nodes.length;
    graph.lmk_nodes.push(lmk_node);

    // data.nodes.push({"id": "lmk".concat(ix.toString()), "group": 2});
  }

  // Add odometry factor connecting to most recent pose to penultimate pose
  function addOdometryFactor() {
    var n_pose_nodes = graph.pose_nodes.length;

    var dx = poses_gt[n_pose_nodes-1].x - poses_gt[n_pose_nodes-2].x;
    const odometry_factor = new gbp.NonLinearFactor(4, [graph.pose_nodes[n_pose_nodes-2].var_id, graph.pose_nodes[n_pose_nodes-1].var_id], nlm.measFnR, nlm.jacFnR);
    if (dx < 0) {
      odometry_factor.measFn = nlm.measFnL;
      odometry_factor.jacFn = nlm.jacFnL;
    } else {
    }
    const measurement = odometry_factor.measFn(poses_gt[n_pose_nodes-2], poses_gt[n_pose_nodes-1]);
    const noise = new m.Matrix([[odometry_angle_noise()], [odometry_dist_noise()]]);
    measurement.add(noise);
    odometry_factor.meas = measurement;
    odometry_factor.eta_damping = eta_damping;

    var lambda = new m.Matrix([[1 / Math.pow(odometry_angle_std, 2), 0], [0, 1 / Math.pow(odometry_distance_std, 2)]]);
    odometry_factor.lambda = lambda;

    odometry_factor.adj_var_dofs.push(2);
    odometry_factor.adj_var_dofs.push(2);

    odometry_factor.adj_beliefs.push(graph.pose_nodes[n_pose_nodes-2].belief);
    odometry_factor.adj_beliefs.push(graph.pose_nodes[n_pose_nodes-1].belief);
    odometry_factor.compute_factor();

    odometry_factor.messages.push(new gauss.Gaussian([[0],[0]], [[0,0],[0,0]]));
    odometry_factor.messages.push(new gauss.Gaussian([[0],[0]], [[0,0],[0,0]]));
    graph.factors.push(odometry_factor);

    graph.pose_nodes[n_pose_nodes-2].adj_factors.push(odometry_factor);
    graph.pose_nodes[n_pose_nodes-1].adj_factors.push(odometry_factor);
  }

  function addMeasurementFactors() {
    // Add measurement factors connecting to observed landmarks
    let n_pose_nodes = graph.pose_nodes.length;

    for (var j=0; j<n_landmarks; j++) {
      var dist = Math.sqrt(Math.pow(landmarks_gt[j].x - poses_gt[n_pose_nodes -1].x, 2) + Math.pow(landmarks_gt[j].y - poses_gt[n_pose_nodes -1].y, 2));
      if (dist < meas_range) {
        // Create new landmark node if first observation of the landmark
        if (!(lmk_observed_yet[j])) {
          addLandmarkNode(j);
          lmk_observed_yet[j] = 1;
        }

        var dx = landmarks_gt[j].x - poses_gt[n_pose_nodes-1].x;
        const new_factor = new gbp.NonLinearFactor(4, [graph.pose_nodes[n_pose_nodes-1].var_id, j], nlm.measFnR, nlm.jacFnR);
        if (dx < 0) {
          new_factor.measFn = nlm.measFnL;
          new_factor.jacFn = nlm.jacFnL;
        }
        const measurement = new_factor.measFn(poses_gt[n_pose_nodes-1], landmarks_gt[j]);
        const noise = new m.Matrix([[meas_angle_noise()], [meas_dist_noise()]]);
        measurement.add(noise); 
        new_factor.meas = measurement;
        new_factor.eta_damping = eta_damping;


        var lambda = new m.Matrix([[1 / Math.pow(meas_angle_std, 2), 0], [0, 1 / Math.pow(meas_distance_std, 2)]]);
        new_factor.lambda = lambda;

        new_factor.adj_var_dofs.push(2);
        new_factor.adj_var_dofs.push(2);

        new_factor.adj_beliefs.push(graph.pose_nodes[n_pose_nodes-1].belief);
        new_factor.adj_beliefs.push(graph.lmk_nodes[lmk_graph_ix[j]].belief);
        new_factor.compute_factor();

        new_factor.messages.push(new gauss.Gaussian([[0],[0]], [[0,0],[0,0]]));
        new_factor.messages.push(new gauss.Gaussian([[0],[0]], [[0,0],[0,0]]));
        graph.factors.push(new_factor);

        graph.pose_nodes[n_pose_nodes-1].adj_factors.push(new_factor);
        graph.lmk_nodes[lmk_graph_ix[j]].adj_factors.push(new_factor);

        // data.links.push({"source": "cam".concat((n_pose_nodes-1).toString()), "target": "lmk".concat(j.toString())});
      }
    }
  }

  function checkAddVarNode() {
    var dist = Math.sqrt(Math.pow(robot_loc[0] - last_key_pose[0], 2) + 
                        Math.pow(robot_loc[1] - last_key_pose[1], 2));
    if (dist > new_pose_dist) {
      const new_var_node = new gbp.VariableNode(2, n_landmarks + graph.pose_nodes.length);
      var lambda = 1 / Math.pow(robot_prior_std, 2);
      new_var_node.prior.lam = new m.Matrix([[lambda, 0], [0, lambda]]);
      new_var_node.prior.eta = new_var_node.prior.lam.mmul(new m.Matrix([[robot_loc[0]], [robot_loc[1]]]))
      new_var_node.update_belief();
      graph.pose_nodes.push(new_var_node);
      poses_gt.push({x: robot_loc[0], y: robot_loc[1]});
      last_key_pose[0] = robot_loc[0];
      last_key_pose[1] = robot_loc[1];

      addOdometryFactor();
      addMeasurementFactors();
    }
  }

  function reset() {
    sync_on = false;
    n_iters = 0;
    landmarks_gt = [];
    poses_gt = [];
    lmk_observed_yet = [];
    lmk_graph_ix = [];

    // Create initial factor graph
    graph = new gbp.FactorGraph();
    let first_pose_node = new gbp.VariableNode(2, n_landmarks);
    first_pose_node.prior.eta = new m.Matrix([[robot_loc[0]], [robot_loc[1]]]);
    first_pose_node.prior.lam = new m.Matrix([[1, 0], [0, 1]]);  
    first_pose_node.update_belief();
    graph.pose_nodes.push(first_pose_node);
    poses_gt.push({x: robot_loc[0], y: robot_loc[1]})

    // Generate landmarks, first landmark near robot
    let lmk1_todo = true;
    while (lmk1_todo) {
      var x = robot_loc[0] + Math.random() * meas_range / Math.sqrt(2) - meas_range / (2 * Math.sqrt(2)); 
      var y = robot_loc[1] + Math.random() * meas_range / Math.sqrt(2) - meas_range / (2 * Math.sqrt(2)); 
      if ((x>20) && (x<canvas.width-20) && (y>20) && (y<canvas.height-20)) {
        lmk1_todo = false;
      }
    }
    landmarks_gt.push({x: x, y: y});
    lmk_observed_yet.push(0);
    lmk_graph_ix.push(-1);
    for (var i=0; i<n_landmarks-1; i++) {
      var x = Math.random()*(canvas.width-20) + 10;
      var y = Math.random()*(canvas.height-20) + 10;
      landmarks_gt.push({x: x, y: y});
      lmk_observed_yet.push(0);
      lmk_graph_ix.push(-1);
    }

    addMeasurementFactors();  // add initial measurements

    then = Date.now();
    sync_on = true;
  }

  // User interaction functions

  function toggleGBP() {
    if (sync_on) {
      sync_on = false;
    } else {
      sync_on = true;
    }
  }

  function toggleMAP() {
    if (display_map == false) {
      display_map = true;
    } else {
      display_map = false;
    }
  }

  function update_odometry_model_std() {
    var lambda = 1 / Math.pow(odometry_std, 2);
    for (var c=0; c<graph.factors.length; c++) {
      if (graph.factors[c].adj_var_ids[1] >= n_landmarks) {
        graph.factors[c].lambdas[0] = lambda;
        graph.factors[c].compute_factor();
      }
    }
  }

  // On click
  function addLandmark(e) {
    var relativeX = e.clientX - canvas.offsetLeft;
    var relativeY = e.clientY - canvas.offsetTop;
    if(relativeX > 0 && relativeX < canvas.width && relativeY > 0 && relativeY < canvas.height) {
      landmarks.push({x: relativeX, y: relativeY});
    }
  }

  // On key press
  document.addEventListener("keydown", checkKey);
  function checkKey(e) {
    e = e || window.event;
    if (e.keyCode == '87') {
      if (robot_loc[1] > var_node_radius + step) {
        robot_loc[1] -= step;
      }
    }
    else if (e.keyCode == '83') {
      if (robot_loc[1] < canvas.height - var_node_radius - step) {
        robot_loc[1] += step;
      }
    }
    else if (e.keyCode == '65') {
      if (robot_loc[0] > var_node_radius + step) {
        robot_loc[0] -= step;
      }
    }
    else if (e.keyCode == '68') {
      if (robot_loc[0] < canvas.width - var_node_radius - step) {
        robot_loc[0] += step;
      }
    }
    checkAddVarNode();
  }

    function toggleFullscreen() {
      if ( document.getElementById("robot-nonlinear-container").classList.contains('l-page-outset') ) {
        document.getElementById("robot-nonlinear-container").classList.remove("l-page-outset");
        document.getElementById("robot-nonlinear-container").classList.add("l-screen-inset");
        fullscreen = true;
      } else {
        document.getElementById("robot-nonlinear-container").classList.remove("l-screen-inset");
        document.getElementById("robot-nonlinear-container").classList.add("l-page-outset");
        fullscreen = false;
      }
    }


</script>

<style>
  /* .chart {
    width: 100%;
    height: 500px;
   width: 100%;
    height:100%;
    max-width: 640px;
    height: calc(100% - 4em);
    min-height: 280px;
    max-height: 480px;
    margin: 0 auto;
  } */
</style>


<div class="demo-container">

  <div id="gbp-container">
    <canvas bind:this={canvas} width={1400} height={800}></canvas>
      <div class="top-left">
        {#if fullscreen}
          <i class="fa fa-compress-arrows-alt tooltip-fs" on:click={toggleFullscreen} style="width: 10%">
            <span class="tooltiptext">Toggle fullscreen</span>
          </i>
        {:else}
          <i class="fas fa-expand-arrows-alt tooltip-fs" on:click={toggleFullscreen} style="width:20px">
            <span class="tooltiptext">Toggle fullscreen</span>
          </i>
          {/if}
      </div>
    <div class="buttons-panel">
      {#if sync_on}
        <i class="fa fa-pause tooltip" on:click={toggleGBP} style="width:25px">
          <span class="tooltiptext">Pause synchronous GBP</span>
        </i>
      {:else}
        <i class="fa fa-play tooltip"  on:click={toggleGBP} style="width:25px">
          <span class="tooltiptext">Play synchronous GBP</span>
        </i>
      {/if} 

      <i class="fa fa-repeat tooltip" on:click={reset}>
          <span class="tooltiptext">Reset</span>
      </i>

      {#if display_map}
        <button class="tooltip" on:click={toggleMAP}> 
        <b>MAP</b>
          <span class="tooltiptext">Hide MAP</span>
        </button>
      {:else}
        <button class="tooltip" on:click={toggleMAP}  style="color: rgb(39, 36, 36, 0.6)"> 
        <b>MAP</b>
          <span class="tooltiptext">Display MAP</span>
        </button>
      {/if} 

      <div id="demo-tip">
        <i class="fa fa-keyboard-o"></i>
        <div id="hint">
          Use WASD to move the robot.                
        </div>
      </div>

    </div>
  </div>

  <div id="settings-panel">
    <b>Iteration {n_iters}</b> &nbsp; (iters / s: {iters_per_sec})
    <input type="range" min="1" max="50" bind:value={iters_per_sec}><br>

    <br><b>Standard deviation of noise in Gaussian measurement models:<br></b>

    <b>Odometry</b><br>
    Distance factors, &sigma = <b>{odometry_distance_std}</b>
    <input type="range" min="5" max="40" bind:value={odometry_distance_std}><br> 
    Angle factors, &sigma = <b>{odometry_angle_std}</b>
    <input type="range" min="0.01" max="1" step="0.01" bind:value={odometry_angle_std}><br>

    <b>Landmark Measurements</b><br>
    Distance factors, &sigma = <b>{meas_distance_std}</b>
    <input type="range" min="30" max="100" bind:value={meas_distance_std}><br> 
    Angle factors, &sigma = <b>{meas_angle_std}</b>
    <input type="range" min="0.4" max="1" step="0.01" bind:value={meas_angle_std}><br>


  </div>
</div>

<!-- <div class="chart">
  <Graph graph={data}/>
</div>
 -->