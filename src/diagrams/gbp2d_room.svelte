<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  import * as m from 'ml-matrix';
  import * as r from 'random';

  import * as gauss from '../gaussian';
  import * as gbp from '../gbp/gbp2d.js';

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

  let odometry_distance_std = 80;
  let odometry_angle_std = 0.5;
  let meas_distance_std = 80;
  let meas_angle_std = 0.5;

  const odometry_angle_noise = r.normal(0, 0.02);
  const odometry_dist_noise = r.normal(0, 5);
  const meas_angle_noise = r.normal(0, 0.02);
  const meas_dist_noise = r.normal(0, 5);

  // GBP variables
  let graph;
  let poses_gt = [];
  let n_landmarks;

  // Landmarks
  let landmarks_gt = [];
  let lmk_observed_yet = [];
  let lmk_graph_ix = [];

  let sync_on = false;
  let n_iters = 0;
  let iters_per_sec = 25;
  let dist = 0; // Average distance of belief means from MAP solution

  // Robot motion params
  let robot_loc = [180, 580];
  let last_key_pose = [180, 580];
  const step = 11;
  let new_pose_dist = 75;

  for (var i=0; i<landmarks_gt.length; i++) {
    lmk_observed_yet.push(0);
    lmk_graph_ix.push(-1);
  }

  onMount(() => {
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 4;

    for (var c=0; c<8; c++) {
      var x = 60 + c * (canvas.width-120) / 7;
      var y_bottom = 740;
      var y_top = 60;
      landmarks_gt.push({x:x, y:y_bottom});
      landmarks_gt.push({x:x, y:y_top});
    }
    for (var c=0; c<4; c++) {
      var x = 400 + c * (canvas.width-800) / 3;
      var y_middle = 400;
      landmarks_gt.push({x:x, y:y_middle});
    }
    for (var c=0; c<3; c++) {
      var y = 200 + c * (canvas.height-400) / 2;
      var x_right = canvas.width - 60;
      var x_left = 60;
      landmarks_gt.push({x:x_right, y:y});
      landmarks_gt.push({x:x_left, y:y});
    }

    n_landmarks = landmarks_gt.length;

    // Create initial factor graph
    graph = new gbp.FactorGraph();
    let first_var_node = new gbp.VariableNode(2, n_landmarks);
    first_var_node.prior.eta = new m.Matrix([[robot_loc[0]], [robot_loc[1]]]);
    first_var_node.prior.lam = new m.Matrix([[1, 0], [0, 1]]);  // strong prior for first measurement
    first_var_node.update_belief();
    graph.pose_nodes.push(first_var_node);
    poses_gt.push({x: robot_loc[0], y: robot_loc[1]})

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
    graph.sync_iter();
    relinearise();
    if (!(n_iters == 0)) {
      dist = graph.compare_to_MAP(n_landmarks, lmk_graph_ix);   
    }
    n_iters++;
  }

  // Jacobian function for nonlinear bearing and distance measurement
  function getJac(cam_coords, lmk_coords) {
    var x1 = cam_coords.get(0,0);
    var y1 = cam_coords.get(1,0);
    var x2 = lmk_coords.get(0,0);
    var y2 = lmk_coords.get(1,0);
    var d = Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
    
    var j00 = (y2-y1)*(x2-x1) / Math.pow(d, 3);
    var j01 = Math.pow(y2-y1, 2) / Math.pow(d, 3) - 1/d;
    var j02 = -(y2-y1)*(x2-x1) / Math.pow(d, 3);
    var j03 = -Math.pow(y2-y1, 2) / Math.pow(d, 3) + 1/d;
    var j10 = -(x2-x1) / d;
    var j11 = -(y2-y1) / d;
    var j12 = (x2-x1) / d;
    var j13 = (y2-y1) / d;

    return new m.Matrix([[j00, j01, j02, j03], [j10, j11, j12, j13]]);
  }

  function relinearise() {
    for(var c=0; c<graph.factors.length; c++) {
      // Compute new jac
      const cam_coords = graph.factors[c].adj_beliefs[0].getMean();
      const lmk_coords = graph.factors[c].adj_beliefs[1].getMean();
      var lin_point = new m.Matrix([[cam_coords.get(0,0)], [cam_coords.get(1,0)], [lmk_coords.get(0,0)], [lmk_coords.get(1,0)]]);
      let jac = getJac(cam_coords, lmk_coords);
      graph.factors[c].jacs[0] = jac;

      graph.factors[c].factor.eta = m.Matrix.zeros(graph.factors[c].dofs, 1);
      graph.factors[c].factor.lam = m.Matrix.zeros(graph.factors[c].dofs, graph.factors[c].dofs);

      if (graph.factors[c].adj_var_ids[1] >= n_landmarks) {
        var lambda = new m.Matrix([[1 / Math.pow(odometry_angle_std, 2), 0], [0, 1 / Math.pow(odometry_distance_std, 2)]]);
      } else {
        var lambda = new m.Matrix([[1 / Math.pow(meas_angle_std, 2), 0], [0, 1 / Math.pow(meas_distance_std, 2)]]);
      }
      graph.factors[c].lambdas[0] = lambda;

      var d = Math.sqrt(Math.pow(lmk_coords.get(0,0)-cam_coords.get(0,0), 2) + Math.pow(lmk_coords.get(1,0)-cam_coords.get(1,0), 2));
      const measurement = new m.Matrix([[(lmk_coords.get(1,0) - cam_coords.get(1,0)) / d], [d]]);
      const bracket = jac.mmul(lin_point).add(graph.factors[c].meas[0]).sub(measurement);
      graph.factors[c].factor.eta.add((jac.transpose().mmul(lambda)).mmul(bracket) );
      graph.factors[c].factor.lam.add((jac.transpose().mmul(lambda)).mmul(jac));
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
  }

  // Add odometry factor connecting to most recent pose to penultimate pose
  function addOdometryFactor() {
    var n_pose_nodes = graph.pose_nodes.length;

    const odometry_factor = new gbp.LinearFactor(4, [graph.pose_nodes[n_pose_nodes-2].var_id, graph.pose_nodes[n_pose_nodes-1].var_id]);
    var jac = getJac(graph.pose_nodes[n_pose_nodes-2].belief.getMean(), graph.pose_nodes[n_pose_nodes-1].belief.getMean());
    odometry_factor.jacs.push(jac);

    var d = Math.sqrt(Math.pow(poses_gt[n_pose_nodes-1].x-poses_gt[n_pose_nodes-2].x, 2) + Math.pow(poses_gt[n_pose_nodes-1].y-poses_gt[n_pose_nodes-2].y, 2));
    const measurement = new m.Matrix([[(poses_gt[n_pose_nodes-1].y - poses_gt[n_pose_nodes-2].y) / d + odometry_angle_noise()], [d + odometry_dist_noise()]]);
    odometry_factor.meas.push(measurement);

    var lambda = new m.Matrix([[1 / Math.pow(odometry_angle_std, 2), 0], [0, 1 / Math.pow(odometry_distance_std, 2)]]);
    odometry_factor.lambdas.push(lambda);

    odometry_factor.adj_var_dofs.push(2);
    odometry_factor.adj_var_dofs.push(2);

    odometry_factor.adj_beliefs.push(graph.pose_nodes[n_pose_nodes-2].belief);
    odometry_factor.adj_beliefs.push(graph.pose_nodes[n_pose_nodes-1].belief);

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

        const new_factor = new gbp.LinearFactor(4, [graph.pose_nodes[n_pose_nodes-1].var_id, j]);
        var jac = getJac(graph.pose_nodes[n_pose_nodes-1].belief.getMean(), graph.lmk_nodes[lmk_graph_ix[j]].belief.getMean());
        new_factor.jacs.push(jac);

        var d = Math.sqrt(Math.pow(landmarks_gt[j].x-poses_gt[n_pose_nodes-1].x, 2) + Math.pow(landmarks_gt[j].y-poses_gt[n_pose_nodes-1].y, 2));
        const measurement = new m.Matrix([[(landmarks_gt[j].y - poses_gt[n_pose_nodes-1].y) / d  + meas_angle_noise()], [d + meas_dist_noise()]]);
        new_factor.meas.push(measurement);

        var lambda = new m.Matrix([[1 / Math.pow(meas_angle_std, 2), 0], [0, 1 / Math.pow(meas_distance_std, 2)]]);
        new_factor.lambdas.push(lambda);

        new_factor.adj_var_dofs.push(2);
        new_factor.adj_var_dofs.push(2);

        new_factor.adj_beliefs.push(graph.pose_nodes[n_pose_nodes-1].belief);
        new_factor.adj_beliefs.push(graph.lmk_nodes[lmk_graph_ix[j]].belief);

        new_factor.messages.push(new gauss.Gaussian([[0],[0]], [[0,0],[0,0]]));
        new_factor.messages.push(new gauss.Gaussian([[0],[0]], [[0,0],[0,0]]));
        graph.factors.push(new_factor);

        graph.pose_nodes[n_pose_nodes-1].adj_factors.push(new_factor);
        graph.lmk_nodes[lmk_graph_ix[j]].adj_factors.push(new_factor);
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
    poses_gt = [];
    lmk_observed_yet = [];
    lmk_graph_ix = [];

    // Create initial factor graph
    graph = new gbp.FactorGraph();
    let first_var_node = new gbp.VariableNode(2, n_landmarks);
    first_var_node.prior.eta = new m.Matrix([[robot_loc[0]], [robot_loc[1]]]);
    first_var_node.prior.lam = new m.Matrix([[1, 0], [0, 1]]);  // strong prior for first measurement
    first_var_node.update_belief();
    graph.pose_nodes.push(first_var_node);
    poses_gt.push({x: robot_loc[0], y: robot_loc[1]})

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
      if ( document.getElementById("robot-room-container").classList.contains('l-page-outset') ) {
        document.getElementById("robot-room-container").classList.remove("l-page-outset");
        document.getElementById("robot-room-container").classList.add("l-screen-inset");
        fullscreen = true;
      } else {
        document.getElementById("robot-room-container").classList.remove("l-screen-inset");
        document.getElementById("robot-room-container").classList.add("l-page-outset");
        fullscreen = false;
      }
    }


</script>

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
    <input type="range" min="10" max="150" bind:value={odometry_distance_std}><br> 
    Angle factors, &sigma = <b>{odometry_angle_std}</b>
    <input type="range" min="0.1" max="1" step="0.01" bind:value={odometry_angle_std}><br>

    <b>Landmark Measurements</b><br>
    Distance factors, &sigma = <b>{meas_distance_std}</b>
    <input type="range" min="10" max="150" bind:value={meas_distance_std}><br> 
    Angle factors, &sigma = <b>{meas_angle_std}</b>
    <input type="range" min="0.1" max="1" step="0.01" bind:value={meas_angle_std}><br>


  </div>
</div>

