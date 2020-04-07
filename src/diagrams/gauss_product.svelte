<script>
  import { onMount } from 'svelte';

  import * as m from 'ml-matrix';
  import * as gauss from '../gaussian';
  import * as gbp from '../gbp/gbp2d.js';

  import { onInterval, pannable } from '../util.js';

  // Visual varaibles
  let canvas;
  let var_node_radius = 9;
  let gt_node_radius = 6;

  let then; // time of start of vis
  let display_map = false;
  let fullscreen = false;
  let started = false;

  // Measurement model std
  let lmk_prior_std = 100;
  let cam_prior_std = 1;
  let distance_std = 350;
  let angle_std = 0.05;

  // GBP variables
  let graph;
  let lmk_loc = {x: 600, y: 200};
  let cam_locs = [{x:200, y:640}, {x:1000, y:640}]

  let sync_on = false;
  let n_iters = 0;
  let iters_per_sec = 25;
  let dist = 0; // Average distance of belief means from MAP solution

  let down1 = false;
  let down2 = false;

  onMount(() => {
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 4;

    graph = new gbp.FactorGraph();
	genGraph();

	// checkJac(graph.pose_nodes[0].belief.getMean(), graph.lmk_nodes[0].belief.getMean());

    then = Date.now();
  });

	onInterval(() => updateVis(), 25);

// ******************************* Drawing functions ********************************

  function drawLine() {
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(0, 640);
    ctx.lineTo(canvas.width, 640);
    ctx.strokeStyle = '#2F4F4F';
    ctx.stroke();
  }

  function drawCams() {
    const ctx = canvas.getContext("2d");
    for(var c=0; c<2; c++) {
    	var x = cam_locs[c].x;
    	var y = cam_locs[c].y;
        ctx.beginPath();
	    ctx.moveTo(x, y+30);
	    ctx.lineTo(x+20, y-20);
  	    ctx.lineTo(x-20, y-20);
 	    ctx.fill();
	    ctx.fillStyle = "#0095DD";
	    ctx.fill();
	    ctx.closePath();
    }
  }

  function drawLandmark() {
    const ctx = canvas.getContext("2d");
    const mean = graph.lmk_nodes[0].belief.getMean();
    var x = mean.get(0, 0);
    var y = mean.get(1, 0);

    // Draw means
    ctx.beginPath();
    ctx.arc(x, y, var_node_radius, 0, Math.PI*2);
    ctx.fillStyle = "yellow";
    ctx.fill();
    ctx.closePath();

    var values = graph.lmk_nodes[0].belief.getCovEllipse();
    var eig_values = values[0];
    var angle = values[1];

    // Draw variances
    ctx.beginPath();
    ctx.ellipse(x, y, Math.sqrt(eig_values[0]), Math.sqrt(eig_values[1]), angle, 0, 2*Math.PI)
    ctx.strokeStyle = "yellow";
    ctx.stroke();
  }

  function drawLmkPrior() {
    const ctx = canvas.getContext("2d");
    const mean = graph.lmk_nodes[0].prior.getMean();
    var x = mean.get(0, 0);
    var y = mean.get(1, 0);

    // // Draw means
    // ctx.beginPath();
    // ctx.arc(x, y, var_node_radius, 0, Math.PI*2);
    // ctx.fillStyle = "blue";
    // ctx.fill();
    // ctx.closePath();

    var values = graph.lmk_nodes[0].prior.getCovEllipse();
    var eig_values = values[0];
    var angle = values[1];

    // Draw variances
    ctx.beginPath();
    ctx.ellipse(x, y, Math.sqrt(eig_values[0]), Math.sqrt(eig_values[1]), angle, 0, 2*Math.PI)
    ctx.strokeStyle = "blue";
    ctx.stroke();
  }

  function drawMessages() {
    const ctx = canvas.getContext("2d");
    for(var c=0; c<2; c++) {
    	const mean = graph.factors[c].messages[1].getMean();
	    var x = mean.get(0, 0);
	    var y = mean.get(1, 0);

	    // // Draw means
	    // ctx.beginPath();
	    // ctx.arc(x, y, var_node_radius, 0, Math.PI*2);
	    // ctx.fillStyle = "red";
	    // ctx.fill();
	    // ctx.closePath();

	    var values = graph.factors[c].messages[1].getCovEllipse();
	    var eig_values = values[0];
	    var angle = values[1];

	    // Draw variances
	    ctx.beginPath();
	    ctx.ellipse(x, y, Math.sqrt(eig_values[0]), Math.sqrt(eig_values[1]), angle, 0, 2*Math.PI)
	    ctx.strokeStyle = "red";
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

	update_landmark_prior_std();
    
    if (sync_on) {
	    drawMessages();
    	relinearise();
    }
    drawLine();
    drawLmkPrior();
    drawCams();
    drawLandmark();

    // if (display_map) {
    //   drawMAP();
    // }
    var rect = canvas.getBoundingClientRect();
    if (!(started) && (rect.top < window.innerHeight)) {
      sync_on = true;
      started = true;
    }
  }


  // ******************* GBP functions ***********************

  function genGraph() {
    const lmk_lambda = 1 / Math.pow(lmk_prior_std, 2);
	const cam_lambda = 1 / Math.pow(cam_prior_std, 2);

  	let first_var_node = new gbp.VariableNode(2, 0);
    first_var_node.prior.lam = new m.Matrix([[lmk_lambda, 0], [0, lmk_lambda]]);
    first_var_node.prior.eta = first_var_node.prior.lam.mmul(new m.Matrix([[lmk_loc.x], [lmk_loc.y]]));
    first_var_node.update_belief();
    graph.lmk_nodes.push(first_var_node);

    let cam1 = new gbp.VariableNode(2, 1);
    cam1.prior.lam = new m.Matrix([[cam_lambda, 0], [0, cam_lambda]]);
    cam1.prior.eta = cam1.prior.lam.mmul(new m.Matrix([[cam_locs[0].x], [cam_locs[0].y]]));
    cam1.update_belief();
    graph.pose_nodes.push(cam1);

    let cam2 = new gbp.VariableNode(2, 2);
    cam2.prior.lam = new m.Matrix([[cam_lambda, 0], [0, cam_lambda]]);
    cam2.prior.eta = cam2.prior.lam.mmul(new m.Matrix([[cam_locs[1].x], [cam_locs[1].y]]));
    cam2.update_belief();
    graph.pose_nodes.push(cam2);

	// Add measurements
    for(var c=0; c<2; c++) {
        const new_factor = new gbp.LinearFactor(4, [c+1, 0]);
       	var jac = getJac(graph.pose_nodes[c].belief.getMean(), graph.lmk_nodes[0].belief.getMean());
        new_factor.jacs.push(jac);

        var d = Math.sqrt(Math.pow(lmk_loc.x-cam_locs[c].x, 2) + Math.pow(lmk_loc.y-cam_locs[c].y, 2));
        const measurement = new m.Matrix([[(lmk_loc.y - cam_locs[c].y) / d], [d]]);
        new_factor.meas.push(measurement);

	    var lambda = new m.Matrix([[1 / Math.pow(angle_std, 2), 0], [0, 1 / Math.pow(distance_std, 2)]]);
	    new_factor.lambdas.push(lambda);

        new_factor.adj_var_dofs.push(2);
        new_factor.adj_var_dofs.push(2);

        new_factor.adj_beliefs.push(graph.pose_nodes[c].belief);
        new_factor.adj_beliefs.push(graph.lmk_nodes[0].belief);

        new_factor.messages.push(new gauss.Gaussian([[0],[0]], [[0,0],[0,0]]));
        new_factor.messages.push(new gauss.Gaussian([[0],[0]], [[0,0],[0,0]]));
        graph.factors.push(new_factor);

        graph.pose_nodes[c].adj_factors.push(new_factor);
        graph.lmk_nodes[0].adj_factors.push(new_factor);
    }
    relinearise();
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

  function getJacFd(cam_coords, lmk_coords) {
  	var delta = 0.00001;
  	var jac_fd = new m.Matrix([[0,0,0,0], [0,0,0,0]]);

    var oldd = Math.sqrt(Math.pow(lmk_coords.get(0,0)-cam_coords.get(0,0), 2) + Math.pow(lmk_coords.get(1,0)-cam_coords.get(1,0), 2));
    const meas = new m.Matrix([[(lmk_coords.get(1,0) - cam_coords.get(1,0)) / oldd], [oldd]]);

  	for(var c=0; c<2; c++) {
  		var new_cam_coords = cam_coords.clone();
  		var addition = m.Matrix.zeros(2, 1);
  		addition.set(c, 0, delta);
  		new_cam_coords.add(addition);
	    var newd = Math.sqrt(Math.pow(lmk_coords.get(0,0)-new_cam_coords.get(0,0), 2) + Math.pow(lmk_coords.get(1,0)-new_cam_coords.get(1,0), 2));
	    const new_meas = new m.Matrix([[(lmk_coords.get(1,0) - new_cam_coords.get(1,0)) / newd], [newd]]);

	    jac_fd.set(0, c, (new_meas.get(0,0) - meas.get(0,0)) / delta);
	    jac_fd.set(1, c, (new_meas.get(1,0) - meas.get(1,0)) / delta);
	}

  	for(var c=0; c<2; c++) {
  		var new_lmk_coordds = lmk_coords.clone();
  		var addition = m.Matrix.zeros(2, 1);
  		addition.set(c, 0, delta);
  		new_lmk_coordds.add(addition);
	    var newd = Math.sqrt(Math.pow(new_lmk_coordds.get(0,0)-cam_coords.get(0,0), 2) + Math.pow(new_lmk_coordds.get(1,0)-cam_coords.get(1,0), 2));
	    const new_meas = new m.Matrix([[(new_lmk_coordds.get(1,0) - cam_coords.get(1,0)) / newd], [newd]]);

	    jac_fd.set(0, c+2, (new_meas.get(0,0) - meas.get(0,0)) / delta);
	    jac_fd.set(1, c+2, (new_meas.get(1,0) - meas.get(1,0)) / delta);
	}
	return jac_fd;
  }

  function checkJac(cam_coords, lmk_coords) {

  	var jac = getJac(cam_coords, lmk_coords);
  	var jac_fd = getJacFd(cam_coords, lmk_coords);

	var diff = m.Matrix.sub(jac, jac_fd)
	console.log('Jacbian check av difference', diff.norm());
  }

  function relinearise() {
    for(var c=0; c<2; c++) {
    	// Compute new jac
    	const cam_coords = graph.factors[c].adj_beliefs[0].getMean();
    	const lmk_coords = graph.factors[c].adj_beliefs[1].getMean();
    	var lin_point = new m.Matrix([[cam_coords.get(0,0)], [cam_coords.get(1,0)], [lmk_coords.get(0,0)], [lmk_coords.get(1,0)]]);
    	let jac = getJac(cam_coords, lmk_coords);
    	graph.factors[c].jacs[0] = jac;


	    graph.factors[c].factor.eta = m.Matrix.zeros(graph.factors[c].dofs, 1);
	    graph.factors[c].factor.lam = m.Matrix.zeros(graph.factors[c].dofs, graph.factors[c].dofs);

	    var lambda = new m.Matrix([[1 / Math.pow(angle_std, 2), 0], [0, 1 / Math.pow(distance_std, 2)]]);

        var d = Math.sqrt(Math.pow(lmk_coords.get(0,0)-cam_coords.get(0,0), 2) + Math.pow(lmk_coords.get(1,0)-cam_coords.get(1,0), 2));
        const measurement = new m.Matrix([[(lmk_coords.get(1,0) - cam_coords.get(1,0)) / d], [d]]);
	    const bracket = jac.mmul(lin_point).add(graph.factors[c].meas[0]).sub(measurement);
	    graph.factors[c].factor.eta.add((jac.transpose().mmul(lambda)).mmul(bracket) );
	    graph.factors[c].factor.lam.add((jac.transpose().mmul(lambda)).mmul(jac));
	}
  }

  function update_landmark_prior_std() {
    var lmk_lambda = 1 / Math.pow(lmk_prior_std, 2);
    graph.lmk_nodes[0].prior.lam = new m.Matrix([[lmk_lambda, 0], [0, lmk_lambda]]);
    graph.lmk_nodes[0].prior.eta = graph.lmk_nodes[0].prior.lam.mmul(new m.Matrix([[lmk_loc.x], [lmk_loc.y]]));
  }

  function syncGBP() {
    graph.sync_iter();
    // if (!(n_iters == 0)) {
    //   dist = graph.compare_to_MAP(n_landmarks, lmk_graph_ix);   
    // }
    n_iters++;
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

  function update_meas_model_std() {
    var lambda = 1 / Math.pow(meas_std, 2);
    var count = 0;
    for (var c=0; c<2; c++) {
	    graph.factors[c].lambdas[0] = lambda;
	    graph.factors[c].compute_factor();
    }
  }

  	function handleMouseMove(e) {
  		var rect = canvas.getBoundingClientRect();
	    var x = canvas.width * (e.clientX - rect.left) / rect.width;
	    var y = canvas.height * (e.clientY - rect.top) / rect.height;

	    if (down1) {
	    	followMouse(0, x)
	    } else if (down2) {
	    	followMouse(1, x)
	    }
  	}

  	function followMouse(ix, x) {
    	cam_locs[ix].x = x;
    	updateCamPosition(ix)
  	}

    function handleMouseDown(e) {
	    var rect = canvas.getBoundingClientRect();
	    var x = canvas.width * (e.clientX - rect.left) / rect.width;
	    var y = canvas.height * (e.clientY - rect.top) / rect.height;

        console.log(x, y)

	    if ((x < cam_locs[0].x + 10) && (x > cam_locs[0].x - 10) && (y > cam_locs[0].y-10) && (y < cam_locs[0].y + 10)) {
	    	down1 = true;
	    } else if ((x < cam_locs[1].x + 10) && (x > cam_locs[1].x - 10) && (y > cam_locs[1].y-10) && (y < cam_locs[1].y + 10)) {
	    	down2 = true;
	    }
    }

    function handleMouseUp(e) {
    	down1 = false;
    	down2 = false;
    }

    function updateCamPosition(cam_ix) {
    	// Update prior
    	graph.pose_nodes[cam_ix].prior.eta = graph.pose_nodes[cam_ix].prior.lam.mmul(new m.Matrix([[cam_locs[cam_ix].x], [cam_locs[cam_ix].y]]));
		graph.pose_nodes[cam_ix].update_belief();

		// Update measurement
        var d = Math.sqrt(Math.pow(lmk_loc.x-cam_locs[cam_ix].x, 2) + Math.pow(lmk_loc.y-cam_locs[cam_ix].y, 2));
        const measurement = new m.Matrix([[(lmk_loc.y - cam_locs[cam_ix].y) / d], [d]]);
        graph.factors[cam_ix].meas[0] = measurement;
    }

</script>

<div class="demo-container">
	<div id="gbp-container">
		<canvas bind:this={canvas} width={1200} height={800} on:mousedown={handleMouseDown} on:mousemove={handleMouseMove} on:mouseup={handleMouseUp}></canvas>
	    <div class="buttons-panel">

	    </div>
	</div>
    
    <div id="settings-panel">
    	<b>Standard deviation of noise in Gaussian measurement models:<br></b>

   	    Distance factors, &sigma = <b>{distance_std}</b>
		<input type="range" min="10" max="500" bind:value={distance_std}><br> 
   	    Angle factors, &sigma = <b>{angle_std}</b>
		<input type="range" min="0.001" max="0.2" step="0.001" bind:value={angle_std}><br>
		Prior factor, &sigma = <b>{lmk_prior_std}</b>
		<input type="range" min="1" max="200" bind:value={lmk_prior_std}><br>

		<br>
		<div id="left-demo-tip">
	        <img id="pointer" src="images/pointer.svg" alt="pointer", style="width: 40px">
	        <div id="hint">
	          	Drag to move the cameras.                
	        </div>
	    </div>
	</div>
</div>
