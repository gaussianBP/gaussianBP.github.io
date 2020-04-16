<script>
  import { onMount } from 'svelte';

  import * as m from 'ml-matrix';
  import * as gauss from '../gaussian';
  import * as gbp from '../gbp/gbp2d.js';
  import * as nlm from '../gbp/nonlinear_meas_fn.js';

  import { onInterval, pannable } from '../util.js';

  // Visual varaibles
  let canvas;
  let var_node_radius = 9;

  let then; // time of start of vis
  let started = false;

  // Measurement model std
  let lmk_prior_std = 100;
  let cam_prior_std = 1;
  let distance_std = 250;
  let angle_std = 0.05;

  // GBP variables
  let graph;
  let lmk_loc = {x: 600, y: 200};
  let cam_locs = [{x:200, y:640}, {x:1000, y:640}]

  let sync_on = false;
  let n_iters = 0;
  let iters_per_sec = 60;

  let down = [false, false];

  onMount(() => {
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 4;

    graph = new gbp.FactorGraph();
	  genGraph();

	// nlm.checkJac(graph.pose_nodes[0].belief.getMean(), graph.lmk_nodes[0].belief.getMean());

    then = Date.now();
  });

	onInterval(() => updateVis(), 60);

// ******************************* Drawing functions *******************************

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
    var values = graph.lmk_nodes[0].prior.getCovEllipse();
    var eig_values = values[0];
    var angle = values[1];

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
	    var values = graph.factors[c].messages[1].getCovEllipse();
	    var eig_values = values[0];
	    var angle = values[1];

	    // Draw variance ellipse
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
        graph.relinearise();
        graph.sync_iter();
        n_iters++;
      } 
    }

	  update_landmark_prior_std();
    
    if (sync_on) {
	    drawMessages();
      update_lambdas();
    }
    drawLine();
    drawLmkPrior();
    drawCams();
    drawLandmark();

    var rect = canvas.getBoundingClientRect();
    if (!(started) && (rect.top < window.innerHeight)) {
      sync_on = true;
      started = true;
    }
  }

  // *********************** Factor graph functions ************************* 

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

    var lambda = new m.Matrix([[1 / Math.pow(angle_std, 2), 0], [0, 1 / Math.pow(distance_std, 2)]]);
    for(var c=0; c<2; c++) {
        var dx = lmk_loc.x - cam_locs[c].x;
        const new_factor = new gbp.NonLinearFactor(4, [c+1, 0], nlm.measFnR, nlm.jacFnR);
        if (dx < 0){
          new_factor.measFn = nlm.measFnL;
          new_factor.jacFn = nlm.jacFnL;
        }
        new_factor.meas = new_factor.measFn(cam_locs[c], lmk_loc);
	      new_factor.lambda = lambda;

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
    graph.relinearise();
  }

  function updateCamPosition(cam_ix) {
    // Update prior
    graph.pose_nodes[cam_ix].prior.eta = graph.pose_nodes[cam_ix].prior.lam.mmul(new m.Matrix([[cam_locs[cam_ix].x], [cam_locs[cam_ix].y]]));
    graph.pose_nodes[cam_ix].update_belief();

    // Update measurement
    const measurement = graph.factors[cam_ix].measFn(cam_locs[cam_ix], lmk_loc);
    graph.factors[cam_ix].meas = measurement;
    graph.factors[cam_ix].compute_factor();
  }

  function update_lambdas() {
    for(var c=0; c<2; c++) {
      graph.factors[c].lambda = new m.Matrix([[1 / Math.pow(angle_std, 2), 0], [0, 1 / Math.pow(distance_std, 2)]]);
    }
  }

  function update_landmark_prior_std() {
    var lmk_lambda = 1 / Math.pow(lmk_prior_std, 2);
    graph.lmk_nodes[0].prior.lam = new m.Matrix([[lmk_lambda, 0], [0, lmk_lambda]]);
    graph.lmk_nodes[0].prior.eta = graph.lmk_nodes[0].prior.lam.mmul(new m.Matrix([[lmk_loc.x], [lmk_loc.y]]));
  }


  // ************************ Event handlers *************************
  function handleMouseMove(e) {
    const ctx = canvas.getContext("2d");
		var rect = canvas.getBoundingClientRect();
    var mouseX = canvas.width * (e.clientX - rect.left) / rect.width;
    var mouseY = canvas.height * (e.clientY - rect.top) / rect.height;

    var on = false
    for(var c=0; c<2; c++) {
    	var x = cam_locs[c].x;
    	var y = cam_locs[c].y;
        ctx.beginPath();
	    ctx.moveTo(x, y+30);
	    ctx.lineTo(x+20, y-20);
  	    ctx.lineTo(x-20, y-20);
	    ctx.closePath();

	    if (ctx.isPointInPath(mouseX, mouseY)) {
	    	on = true;
	    }
		}

		if (on){ 
		  	canvas.style.cursor = "pointer";
		} else {
			canvas.style.cursor = "default";
		}
	    if (down[0]) {
	    	cam_locs[0].x = mouseX;
	    	updateCamPosition(0)
	    } else if (down[1]) {
	    	cam_locs[1].x = mouseX;
	    	updateCamPosition(1)
	    }
  }

  function handleMouseDown(e) {
    const ctx = canvas.getContext("2d");
    var rect = canvas.getBoundingClientRect();
    var mouseX = canvas.width * (e.clientX - rect.left) / rect.width;
    var mouseY = canvas.height * (e.clientY - rect.top) / rect.height;

    for(var c=0; c<2; c++) {
    	var x = cam_locs[c].x;
    	var y = cam_locs[c].y;
        ctx.beginPath();
	    ctx.moveTo(x, y+30);
	    ctx.lineTo(x+20, y-20);
  	    ctx.lineTo(x-20, y-20);
	    ctx.closePath();

	    if (ctx.isPointInPath(mouseX, mouseY)) {
	    	down[c] = true;
	    }
		}
  }

  function handleMouseUp(e) {
  	down[0] = false;
  	down[1] = false;
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
		<input type="range" min="10" max="400" bind:value={distance_std}><br> 
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
