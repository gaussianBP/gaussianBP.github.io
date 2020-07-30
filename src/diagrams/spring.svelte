<script>
  import { onMount } from 'svelte';

  import * as m from 'ml-matrix';
  import * as gauss from '../gaussian';
  import * as gbp from '../gbp/gbp1d.js';
  import * as nlm from '../gbp/nonlinear_meas_fn.js';

  import { onInterval, pannable } from '../util.js';

  // Visual varaibles
  let canvas;
  let var_node_radius = 10;

  let then; // time of start of vis
  let started = false;
  let gt_node_radius = 15;
  let x_buffer = 150;

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

  let down = [false];

  let n_var_nodes = 4;
  let spring_const = 40.;

  let gt_locs = [];
  let anchor = 100;

  let mode = 0;

  onMount(() => {
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 4;

    graph = new gbp.FactorGraph();
	  creategraph(graph, n_var_nodes, spring_const);

	// nlm.checkJac(graph.pose_nodes[0].belief.getMean(), graph.lmk_nodes[0].belief.getMean());

    then = Date.now();
  });

	onInterval(() => updateVis(), 60);

// ******************************* Drawing functions *******************************


  function drawGtNodes() {
    const ctx = canvas.getContext("2d");

    for(let c=0; c<graph.var_nodes.length; c++) {
      var x = gt_locs[c];

      ctx.beginPath();
      ctx.arc(x, 150, gt_node_radius, 0, Math.PI*2);
      if (mode == 0) {
        ctx.fillStyle = "#0095DD";
      } else if (mode == 1) {
        ctx.fillStyle = "#a5bcc7";
      }
      ctx.fill();
      ctx.closePath();
    }
  }

  function drawAnchor() {
    const ctx = canvas.getContext("2d");

    ctx.beginPath();
    ctx.rect(anchor-15, 135, 30, 30, Math.PI*2);
    ctx.fillStyle = "#00FF00";
    ctx.fill();
    ctx.closePath();

  }

  function drawLines() {
    const ctx = canvas.getContext("2d");

    for(let c=0; c<graph.var_nodes.length-1; c++) {
      var x1 = gt_locs[c];
      var x2 = gt_locs[c+1];

      ctx.beginPath();
      ctx.moveTo(x1, 150);
      ctx.lineTo(x2, 150);
      ctx.strokeStyle = '#2F4F4F';
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
      // if (sync_on) {
      //   graph.relinearise();
      //   graph.sync_iter();
      //   n_iters++;
      // } 
    }
    
    // if (sync_on) {
	  //   drawMessages();
    //   update_lambdas();
    // }

    drawLines();
    drawAnchor();
    drawGtNodes();

    if (mode == 1){
      drawVarNodes();
    }


    var rect = canvas.getBoundingClientRect();
    if (!(started) && (rect.top < window.innerHeight)) {
      sync_on = true;
      started = true;
    }
  }

  // *********************** Factor graph functions ************************* 

  function creategraph(graph, n_var_nodes, smoothness_std) {

    let dist = (canvas.width - 2*x_buffer) / (n_var_nodes - 1);

    // Create variable nodes
    for(var i=0; i<n_var_nodes; i++) {
      const new_var_node = new gbp.VariableNode(1, i);
      graph.var_nodes.push(new_var_node);
      gt_locs.push(x_buffer + i*dist)
      down.push(false);
    }

    // // Create measurement factors
    // const smoothness_jac = new m.Matrix([[-1, 1]]);
    // for(var i=0; i<(n_var_nodes-1); i++) {
    //   const new_factor = new LinearFactor(2, [i, i+1], );
    //   new_factor.jacs.push(smoothness_jac);
    //   new_factor.meas.push(0.);
    //   new_factor.lambdas.push(1 / Math.pow(smoothness_std, 2));

    //   new_factor.adj_beliefs.push(graph.var_nodes[i].belief);
    //   new_factor.adj_beliefs.push(graph.var_nodes[i+1].belief);
    //   new_factor.messages.push(new gauss.Gaussian([[0]], [[0]]));
    //   new_factor.messages.push(new gauss.Gaussian([[0]], [[0]]));
    //   new_factor.compute_factor();
    //   graph.factors.push(new_factor);
    //   graph.var_nodes[i].adj_factors.push(new_factor);
    //   graph.var_nodes[i+1].adj_factors.push(new_factor);
    // }

    return graph;
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

  function update_spring_constant() {
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

    // Check if over anchor
    var x = anchor;
    ctx.beginPath();
    ctx.moveTo(x, 150+30);
    ctx.lineTo(x+20, 150-20);
      ctx.lineTo(x-20, 150-20);
    ctx.closePath();
    if (ctx.isPointInPath(mouseX, mouseY)) {
	    on = true;
    }


    for(var c=0; c<graph.var_nodes.length; c++) {
      var x = gt_locs[c];
      
      ctx.beginPath();
	    ctx.moveTo(x, 150+30);
	    ctx.lineTo(x+20, 150-20);
  	    ctx.lineTo(x-20, 150-20);
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
      anchor = mouseX;
    }
    
    for(var c=0; c<graph.var_nodes.length; c++) { 
      if (down[c+1]) {
        gt_locs[c] = mouseX;
        // updateCamPosition(c);
      }
    }


  }

  function handleMouseDown(e) {
    const ctx = canvas.getContext("2d");
    var rect = canvas.getBoundingClientRect();
    var mouseX = canvas.width * (e.clientX - rect.left) / rect.width;
    var mouseY = canvas.height * (e.clientY - rect.top) / rect.height;

    // Check if over variable
    var onv = false;
    for(var c=0; c<graph.var_nodes.length; c++) {
      var x = gt_locs[c];
      
      ctx.beginPath();
	    ctx.moveTo(x, 150+30);
	    ctx.lineTo(x+20, 150-20);
  	    ctx.lineTo(x-20, 150-20);
	    ctx.closePath();

	    if (ctx.isPointInPath(mouseX, mouseY)) {
        down[c+1] = true;
        onv = true;
	    }
    }
    
    // If not then, check if over anchor
    if (onv == false) {
      var x = anchor;
      ctx.beginPath();
      ctx.moveTo(x, 150+30);
      ctx.lineTo(x+20, 150-20);
        ctx.lineTo(x-20, 150-20);
      ctx.closePath();
      if (ctx.isPointInPath(mouseX, mouseY)) {
        down[0] = true;
      }
    }
  }

  function handleMouseUp(e) {
    down[0] = false;
    for(var c=0; c<graph.var_nodes.length; c++) { 
      down[c+1] = false;
    }
  }

  function set_meas_mode(e) {
      mode = 0;
  }

  function set_init_mode(e) {
      mode = 1;
  }

</script>

<div class="demo-container">
	<div id="gbp-container">
		<canvas bind:this={canvas} width={1200} height={300} on:mousedown={handleMouseDown} on:mousemove={handleMouseMove} on:mouseup={handleMouseUp}></canvas>
	    <div class="buttons-panel">

	    </div>
	</div>
    
    <div id="settings-panel">
    <label class="radio-inline">
      <input
        type="radio"
        id="edit_mode_radio_button"
        name="toggle_mode_radio_button"
        on:change={set_meas_mode} />
      Set measurements
    </label>
    <label class="radio-inline">
      <input
        type="radio"
        id="play_mode_radio_button"
        name="toggle_mode_radio_button"
        on:change={set_init_mode} />
      Set init
    </label>


      Spring constant, k = <b>{spring_const}</b>
      <input type="range" min="1" max="100" bind:value={spring_const}><br>

      <div id="left-demo-tip">
            <img id="pointer" src="images/pointer.svg" alt="pointer", style="width: 40px">
            <div id="hint">
                Drag to move the masses.                
            </div>
        </div>
	</div>
</div>
