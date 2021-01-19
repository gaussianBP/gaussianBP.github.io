<script>
  import { onMount } from 'svelte';
  import { onInterval } from '../utils/util.js';
  // import * as colormap from 'colormap';
  import * as m from 'ml-matrix';
  // import * as d3 from 'd3';

  // svg
  let svg;

  let xs = [0.2, 0.5, 0.8];

  let x1 = 0.2;
  let x2 = 0.5;
  let x3 = 0.8;
  let y = 0.29;
  let y2 = 0.72;

  let radius = 0.1;
  let factor_size = 0.1;

  let svg_width=0, svg_height=0;

  let mat_side = 34;
  let lambda_mat_width = 0.9;
  let lam_offset = 0;
  let eta_offset = 0;
  let r_eta_offset = 0;
  let r_lam_offset = 0;

  let active_factors = [true, true, true, true, true]

  let unary_etas = [0, 1, 2];
  let unary_lams = [1, 1, 1];

  let node_clicked = null;

  let JTJ = new m.Matrix([[1, -1], [-1, 1]]);
  let J = new m.Matrix([[-1], [1]]);
  let lam_m12 = 1;
  let lam_m23 = 1;
  let z12 = 1;
  let z23 = 1;

  let cond_x2 = 1.;

  let lambda = m.Matrix.zeros(3, 3);
  let eta = m.Matrix.zeros(3, 1);

  let sigma = m.Matrix.zeros(3, 3);
  let mu = m.Matrix.zeros(3, 1);

  let cond_lam = m.Matrix.zeros(2, 2);
  let cond_eta = m.Matrix.zeros(2, 1);
  let marg_lam = m.Matrix.zeros(2, 2);
  let marg_eta = m.Matrix.zeros(2, 1);
  let cond_sigma = m.Matrix.zeros(2, 2);
  let cond_mu = m.Matrix.zeros(2, 1);
  let marg_sigma = m.Matrix.zeros(2, 2);
  let marg_mu = m.Matrix.zeros(2, 1);

  let std_color = "green";
  let meas_color = "blue";

  let node_mousedown = null;
  let val0 = null;
  let x0 = null;
  let scale = 0.2;

  let red_width = 0.25;
  let middle_width = 0.3;
  let gap_width = (1 - middle_width - 2*red_width) / 2;

  let x0_cond = 0, x2_cond = 0;
  let x0_marg = 0, x2_marg = 0;


  function update_matrices() {

    lambda = new m.Matrix([[unary_lams[0], 0., 0.], [0., unary_lams[1], 0.], [0., 0., unary_lams[2]]]);
    eta = new m.Matrix([[unary_etas[0]], [unary_etas[1]], [unary_etas[2]]]);

    // Contributions from binary factors
    new m.MatrixSubView(lambda, 0, 1, 0, 1).add(JTJ.clone().mul(lam_m12));
    new m.MatrixSubView(eta, 0, 1, 0, 0).add(J.clone().mul(lam_m12 * z12));
    new m.MatrixSubView(lambda, 1, 2, 1, 2).add(JTJ.clone().mul(lam_m23));
    new m.MatrixSubView(eta, 1, 2, 0, 0).add(J.clone().mul(lam_m23 * z23));

    sigma = m.inverse(lambda);
    mu = sigma.mmul(eta);

    // Marginalise over x2
    marg_sigma = new m.Matrix([[sigma.get(0, 0), sigma.get(0, 2)], 
                               [sigma.get(2, 0), sigma.get(2, 2)]]);
    marg_mu = new m.Matrix([[mu.get(0, 0)], [mu.get(2, 0)]])
    marg_lam = m.inverse(marg_sigma);
    marg_eta = marg_lam.mmul(marg_mu);

    // Condition on x2
    cond_lam = new m.Matrix([[lambda.get(0, 0), lambda.get(0, 2)], 
                             [lambda.get(2, 0), lambda.get(2, 2)]]);
    const eta_block = new m.Matrix([[eta.get(0, 0)], [eta.get(2, 0)]]);
    const lam_block = new m.Matrix([[lambda.get(0, 1)], [lambda.get(2, 1)]]);
    cond_eta = m.Matrix.sub(eta_block, lam_block.mul(cond_x2));
    cond_sigma = m.inverse(cond_lam);
    cond_mu = cond_sigma.mmul(cond_eta);
  }

  function zero(val) {
    if (Math.abs(val) < 1e-5) {
      val = 0.
    }
    return val;
  }


  onMount(() => {

    // For drawing factor graphs

    var bb = document.querySelector ('#fg_svg').getBoundingClientRect();
    svg_width = bb.width;
    svg_height = bb.height;

    x0_cond = xs[0] * red_width * svg_width;
    x2_cond = xs[2] * red_width * svg_width;

    x0_marg = svg_width*(1-red_width) + xs[0] * red_width * svg_width;
    x2_marg = svg_width*(1-red_width) + xs[2] * red_width * svg_width;

    xs[0] = svg_width * (red_width + gap_width + xs[0] * middle_width)
    xs[1] = svg_width * (red_width + gap_width + xs[1] * middle_width)
    xs[2] = svg_width * (red_width + gap_width + xs[2] * middle_width)

    y *= svg_height;
    y2 *= svg_height;

    radius *= svg_height;
    factor_size *= svg_height;


    // For drawing matrices

    var lam_svg = document.querySelector ('#full_lam_matrix').getBoundingClientRect();
    lam_offset = (1 - lambda_mat_width) * Math.min(lam_svg.width, lam_svg.height) / 2;
    lambda_mat_width *= Math.min(lam_svg.width, lam_svg.height);
    mat_side = lambda_mat_width / 3;
    console.log(mat_side);
    lam_offset = (lam_svg.width - 3*mat_side) / 2;

    var eta_svg = document.querySelector ('#full_eta_matrix').getBoundingClientRect();
    eta_offset = (eta_svg.width - mat_side) / 2;

    var red_eta_svg = document.querySelector ('#red_eta_svg').getBoundingClientRect();
    var red_lam_svg = document.querySelector ('#red_lam_svg').getBoundingClientRect();
    r_eta_offset = (red_eta_svg.width - mat_side) / 2;
    r_lam_offset = (red_lam_svg.width - 2*mat_side) / 2;


    update_matrices();

  });

  onInterval(() => update_matrices(), 100);


  function click_handler(e) {

    console.log(e);

    node_clicked = null;
    node_clicked = e.path.find((element) => element.classList == "node_g svelte-1pz3min");

    if (node_clicked) {
      active_factors[node_clicked.id] = !active_factors[node_clicked.id];
    }
  }

  function mousedown_handler(e) {

    node_mousedown = null;
    node_mousedown = e.path.find((element) => element.classList == "node_g svelte-1pz3min");

    if (node_mousedown) {
      const rect = e.currentTarget.getBoundingClientRect();
      x0 = e.clientX - rect.x;
      if (node_mousedown.id == "lam0") {
        val0 = unary_lams[0];        
      } else if (node_mousedown.id == "lam1") {
        val0 = unary_lams[1];        
      } else if (node_mousedown.id == "lam2") {
        val0 = unary_lams[2];        
      } else if (node_mousedown.id == "lam3") {
        val0 = lam_m12;        
      } else if (node_mousedown.id == "lam4") {
        val0 = lam_m23;        
      } else if (node_mousedown.id == "eta0") {
        val0 = unary_etas[0];        
      } else if (node_mousedown.id == "eta1") {
        val0 = unary_etas[1];        
      } else if (node_mousedown.id == "eta2") {
        val0 = unary_etas[2];        
      } else if (node_mousedown.id == "eta3") {
        val0 = z12;        
      } else if (node_mousedown.id == "eta4") {
        val0 = z23;        
      } else if (node_mousedown.id == "cond_x2") {
        val0 = cond_x2;        
      }
    }

  }

  function mousemove_handler(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    let current_mouse_location = {
      x: e.clientX - rect.x,
      y: e.clientY - rect.y,
    };

    if (node_mousedown) {
      if (node_mousedown.id == "lam0") {
        unary_lams[0] = Math.max(0, val0 + scale * (current_mouse_location.x - x0));
      } else if (node_mousedown.id == "lam1") {
        unary_lams[1] = Math.max(0, val0 + scale * (current_mouse_location.x - x0));
      } else if (node_mousedown.id == "lam2") {
        unary_lams[2] = Math.max(0, val0 + scale * (current_mouse_location.x - x0));
      } else if (node_mousedown.id == "lam3") {
        lam_m12 = Math.max(0, val0 + scale * (current_mouse_location.x - x0));
      } else if (node_mousedown.id == "lam4") {
        lam_m23 = Math.max(0, val0 + scale * (current_mouse_location.x - x0));
      } else if (node_mousedown.id == "eta0") {
        unary_etas[0] = Math.max(0, val0 + scale * (current_mouse_location.x - x0));
      } else if (node_mousedown.id == "eta1") {
        unary_etas[1] = Math.max(0, val0 + scale * (current_mouse_location.x - x0));
      } else if (node_mousedown.id == "eta2") {
        unary_etas[2] = Math.max(0, val0 + scale * (current_mouse_location.x - x0));
      } else if (node_mousedown.id == "eta3") {
        z12 = Math.max(0, val0 + scale * (current_mouse_location.x - x0));
      } else if (node_mousedown.id == "eta4") {
        z23 = Math.max(0, val0 + scale * (current_mouse_location.x - x0));
      } else if (node_mousedown.id == "cond_x2") {
        cond_x2 = val0 + scale * (current_mouse_location.x - x0);
      }
    }
  }

  function mouseup_handler(e) {
    node_mousedown = null;
  }

</script>

<style>
  * {
    box-sizing: border-box;
  }

  /* Create three unequal columns that floats next to each other */
  .column {
    float: left;
    padding: 10px;
    width: var(--width);
  }

  svg {
    height: var(--height);
  }

  /* .left, .right {
    width: 25%;
  }

  .middle {
    width: 50%;
  } */

  /* Clear floats after the columns */
  .row:after {
    content: "";
    display: table;
    clear: both;
  }

  .cond_copy {
    fill: red;
    fill-opacity: 0.4;
  }

  .marg_copy {
    fill: green;
    fill-opacity: 0.4;
  }


</style>


<div class="row">

  <svg
    bind:this={svg}
    on:click={click_handler}
    on:mousedown={mousedown_handler}
    on:mouseup={mouseup_handler}
    on:mousemove={mousemove_handler}
    style="background-color: white; border: black; height: 100px;"
    id="fg_svg"
    >

    <text class="svg_text" x={0.3*svg_width} y={svg_height/3- 10}> 
      Condition at
    </text>
    <g class="node_g" id="cond_x2" cursor="ew-resize" draggable="true">
      <text class="svg_text" style="text-decoration: underline #000 dotted;" x={0.3*svg_width} y={svg_height/3 + 10}> 
        x1 = {cond_x2.toFixed(1)}
      </text>
    </g>

    <text class="svg_text" x={0.7*svg_width} y={svg_height/3 + 10}> 
      Marginalise
    </text>

    <defs>
      <marker id="arrowhead" markerWidth="3" markerHeight="3" refX="0" refY="1.5" orient="auto">
        <polygon points="0 0, 3 1.5, 0 3" />
      </marker>
    </defs>
    <line x1={0.7*svg_width-30} y1={2*svg_height/3} x2={0.7*svg_width + 10} y2={2*svg_height/3} stroke="#000" stroke-width="8" marker-end="url(#arrowhead)" />
    <line x1={0.3*svg_width+30} y1={2*svg_height/3} x2={0.3*svg_width - 10} y2={2*svg_height/3} stroke="#000" stroke-width="8" marker-end="url(#arrowhead)" />


    <!-- Conditioned factor graph -->
    <!-- Edges -->
    <line x1={x0_cond} y1={y} x2={x0_cond} y2={y2} stroke="black" stroke-width="1"/>
    <line x1={x2_cond} y1={y} x2={x2_cond} y2={y2} stroke="black" stroke-width="1"/>

    <!-- Variable nodes -->
    <circle class="var_node" cx={x0_cond} cy={y} r={radius}/>
    <text class="node_text" x={x0_cond} y={y + 0.5*radius}> {0} </text>
    <circle class="var_node" cx={x2_cond} cy={y} r={radius}/>
    <text class="node_text" x={x2_cond} y={y + 0.5*radius}> {2} </text>

    <!-- Factor nodes -->
    <rect class="factor_node" x={x0_cond - factor_size/2} y={y2 - factor_size/2} 
      width={factor_size} height={factor_size} stroke="black"/>
    <rect class="factor_node" x={x2_cond - factor_size/2} y={y2 - factor_size/2} 
      width={factor_size} height={factor_size} stroke="black"/>

    <!-- Full factor graph -->
    <!-- Edges -->
    <line x1={xs[0]} y1={y} x2={xs[1]} y2={y} stroke="black" stroke-width="1"/>
    <line x1={xs[1]} y1={y} x2={xs[2]} y2={y} stroke="black" stroke-width="1"/>
    {#each Array(3) as _, i}
      <line x1={xs[i]} y1={y} x2={xs[i]} y2={y2} stroke="black" stroke-width="1"/>
    {/each}

    <!-- Variable nodes -->
    {#each Array(3) as _, i}
      <circle class="var_node" cx={xs[i]} cy={y} r={radius}/>
      <text class="node_text" x={xs[i]} y={y + 0.5*radius}> {i} </text>
    {/each}

    <!-- Factor nodes -->
    {#each Array(3) as _, i}
      <rect class="factor_node" x={xs[i] - factor_size/2} y={y2 - factor_size/2} width={factor_size} height={factor_size} stroke="black"/>
      <g class="node_g" id="{"eta" + i}" cursor="ew-resize" draggable="true">
        <text class="underlined_text" fill="{meas_color}" x={xs[i] - 2.5*factor_size} y={y2 + factor_size/2}> {unary_etas[i].toFixed(1)} </text>
      </g>
      <g class="node_g" id="{"lam" + i}" cursor="ew-resize" draggable="true">
        <text class="underlined_text" fill="{std_color}" x={xs[i]} y={y2 + 2.5*factor_size}> {unary_lams[i].toFixed(1)} </text>
      </g>
    {/each}

    <rect class="factor_node" x={(xs[0]+xs[1])/2 - factor_size/2} y={y - factor_size/2} width={factor_size} height={factor_size} stroke="black"/>
    <g class="node_g" id="eta3" cursor="ew-resize" draggable="true">
      <text class="underlined_text" fill="{meas_color}" x={(xs[0]+xs[1])/2} y={y - 1.5*factor_size}> {z12.toFixed(1)} </text>
    </g>
    <g class="node_g" id="lam3" cursor="ew-resize" draggable="true">
        <text class="underlined_text" fill="{std_color}" x={(xs[0]+xs[1])/2} y={y + 2.5*factor_size}> {lam_m12.toFixed(1)} </text>
    </g>

    <rect class="factor_node" x={(xs[1]+xs[2])/2 - factor_size/2} y={y - factor_size/2} width={factor_size} height={factor_size} stroke="black"/>
    <g class="node_g" id="eta4" cursor="ew-resize" draggable="true">
      <text class="underlined_text" fill="{meas_color}" x={(xs[1]+xs[2])/2} y={y - 1.5*factor_size}> {z23.toFixed(1)} </text>
    </g>
    <g class="node_g" id="lam4" cursor="ew-resize" draggable="true">
      <text class="underlined_text" fill="{std_color}" x={(xs[1]+xs[2])/2} y={y + 2.5*factor_size}> {lam_m23.toFixed(1)} </text>
    </g>


    <!-- Marginalised factor graph -->

    <!-- Edges -->
    <line x1={x0_marg} y1={y} x2={x0_marg} y2={y2} stroke="black" stroke-width="1"/>
    <line x1={x2_marg} y1={y} x2={x2_marg} y2={y2} stroke="black" stroke-width="1"/>
    <line x1={x0_marg} y1={y} x2={x2_marg} y2={y} stroke="black" stroke-width="1"/>

    <!-- Variable nodes -->
    <circle class="var_node" cx={x0_marg} cy={y} r={radius}/>
    <text class="node_text" x={x0_marg} y={y + 0.5*radius}> {0} </text>
    <circle class="var_node" cx={x2_marg} cy={y} r={radius}/>
    <text class="node_text" x={x2_marg} y={y + 0.5*radius}> {2} </text>

    <!-- Factor nodes -->
    <rect class="factor_node" x={x0_marg - factor_size/2} y={y2 - factor_size/2} 
      width={factor_size} height={factor_size} stroke="black"/>
    <rect class="factor_node" x={x2_marg - factor_size/2} y={y2 - factor_size/2} 
      width={factor_size} height={factor_size} stroke="black"/>
    <rect class="factor_node" x={(x0_marg+x2_marg)/2 - factor_size/2} y={y - factor_size/2} 
      width={factor_size} height={factor_size} stroke="black"/>

  </svg>

</div>

<div class="row">
  <div class="column" style="--width: {100*red_width}%;">

    <div class="row">
      <div class="column" style="width: 60%;">
        <div style="text-align: center; width: 100%;">
          <d-math>\Lambda</d-math>
        </div>
        <svg style="background-color: white; --height: {lambda_mat_width + 5}px;" id="red_lam_svg">
            <g>
                <rect class="matrix_block cond_copy" x={r_lam_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side/2} y={0 + mat_side/2}> {cond_lam.get(0, 0).toFixed(1)}</text>
                <rect class="matrix_block cond_copy" fill="red" x={r_lam_offset + mat_side} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side + mat_side/2} y={0 + mat_side/2}> {cond_lam.get(0, 1).toFixed(1)}</text>
            </g>
            <g>
                <rect class="matrix_block cond_copy" x={r_lam_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side/2} y={mat_side + mat_side/2}> {cond_lam.get(1, 0).toFixed(1)}</text>
                <rect class="matrix_block cond_copy" x={r_lam_offset + mat_side} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side + mat_side/2} y={mat_side + mat_side/2}> {cond_lam.get(1, 1).toFixed(1)}</text>
            </g> 
        </svg>
      </div>
      <div class="column" style="width: 40%">
        <div style="text-align: center; width: 100%;">
          <d-math>\eta</d-math>
        </div>
        <svg style="background-color: white; --height: {lambda_mat_width + 5}px;" id="red_eta_svg">
            <g>
                <rect class="matrix_block" x={r_eta_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_eta_offset + mat_side/2} y={0 + mat_side/2}> {cond_eta.get(0, 0).toFixed(1)}</text>
                <rect class="matrix_block" x={r_eta_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_eta_offset + mat_side/2} y={mat_side + mat_side/2}> {cond_eta.get(1, 0).toFixed(1)}</text>
            </g>
        </svg>
      </div>
    </div>

    <div class="row">
      <div class="column" style="width: 60%">
        <div style="text-align: center; width: 100%;">
          <d-math>&Sigma</d-math>
        </div>
        <svg style="background-color: white; --height: {lambda_mat_width + 5}px;">
            <g>
                <rect class="matrix_block" x={r_lam_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side/2} y={0 + mat_side/2}> {cond_sigma.get(0, 0).toFixed(2)}</text>
                <rect class="matrix_block" x={r_lam_offset + mat_side} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side + mat_side/2} y={0 + mat_side/2}> {cond_sigma.get(0, 1).toFixed(2)}</text>
            </g>
            <g>
                <rect class="matrix_block" x={r_lam_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side/2} y={mat_side + mat_side/2}> {cond_sigma.get(1, 0).toFixed(2)}</text>
                <rect class="matrix_block" x={r_lam_offset + mat_side} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side + mat_side/2} y={mat_side + mat_side/2}> {cond_sigma.get(1, 1).toFixed(2)}</text>
            </g> 
        </svg>
      </div>
      <div class="column" style="width: 40%">
        <div style="text-align: center; width: 100%;">
          <d-math>&mu</d-math>
        </div>
        <svg style="background-color: white; --height: {lambda_mat_width + 5}px;">
            <g>
                <rect class="matrix_block" x={r_eta_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_eta_offset + mat_side/2} y={0 + mat_side/2}> {zero(cond_mu.get(0, 0)).toFixed(2)}</text>
                <rect class="matrix_block" x={r_eta_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_eta_offset + mat_side/2} y={mat_side + mat_side/2}> {zero(cond_mu.get(1, 0)).toFixed(2)}</text>
            </g>
        </svg>
      </div>
    </div>

  </div>

  <div class="column" style="--width: {100*(1 - middle_width - 2*red_width) / 2}%"></div>
  
  <div class="column" style="--width: {100*middle_width}%">
    <div class="row">
      <div class="column" style="width: 70%">
        <div style="text-align: center; width: 100%;">
          <d-math>\Lambda</d-math>
        </div>
        <svg style="background-color: white; border: black; width:100%" id="full_lam_matrix">
            <g>
                <rect class="matrix_block cond_copy" x={lam_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side/2} y={0 + mat_side/2}> {lambda.get(0, 0).toFixed(1)}</text>
                <rect class="matrix_block" x={lam_offset + mat_side} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side + mat_side/2} y={0 + mat_side/2}> {lambda.get(0, 1).toFixed(1)}</text>
                <rect class="matrix_block cond_copy" x={lam_offset + 2*mat_side} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + 2*mat_side + mat_side/2} y={0 + mat_side/2}> {lambda.get(0, 2).toFixed(1)}</text>
            </g>
            <g>
                <rect class="matrix_block" x={lam_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side/2} y={mat_side + mat_side/2}> {lambda.get(1, 0).toFixed(1)}</text>
                <rect class="matrix_block" x={lam_offset + mat_side} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side + mat_side/2} y={mat_side + mat_side/2}> {lambda.get(1, 1).toFixed(1)}</text>
                <rect class="matrix_block" x={lam_offset + 2*mat_side} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + 2*mat_side + mat_side/2} y={mat_side + mat_side/2}> {lambda.get(1, 2).toFixed(1)}</text>
            </g> 
            <g>
                <rect class="matrix_block cond_copy" x={lam_offset + 0} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side/2} y={2*mat_side + mat_side/2}> {lambda.get(2, 0).toFixed(1)}</text>
                <rect class="matrix_block" x={lam_offset + mat_side} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side + mat_side/2} y={2*mat_side + mat_side/2}> {lambda.get(2, 1).toFixed(1)}</text>
                <rect class="matrix_block cond_copy" x={lam_offset + 2*mat_side} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + 2*mat_side + mat_side/2} y={2*mat_side + mat_side/2}> {lambda.get(2, 2).toFixed(1)}</text>
            </g>
        </svg>
      </div>
      <div class="column" style="width: 30%">
        <div style="text-align: center; width: 100%;">
          <d-math>\eta</d-math>
        </div>
        <svg style="background-color: white; border: black; width: 100%" id="full_eta_matrix">
            <g>
                <rect class="matrix_block" x={eta_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={eta_offset + mat_side/2} y={0 + mat_side/2}> {eta.get(0, 0).toFixed(1)}</text>
                <rect class="matrix_block" x={eta_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={eta_offset + mat_side/2} y={mat_side + mat_side/2}> {eta.get(1, 0).toFixed(1)}</text>
                <rect class="matrix_block" x={eta_offset + 0} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={eta_offset + mat_side/2} y={2*mat_side + mat_side/2}> {eta.get(2, 0).toFixed(1)}</text>
            </g>
        </svg>
      </div>
    </div>

    <div class="row">
      <div class="column" style="width: 70%">
        <div style="text-align: center; width: 100%;">
          <d-math>&Sigma</d-math>
        </div>
        <svg style="background-color: white; border: black; width:100%">
            <g>
                <rect class="matrix_block marg_copy" x={lam_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side/2} y={0 + mat_side/2}> {sigma.get(0, 0).toFixed(2)}</text>
                <rect class="matrix_block" x={lam_offset + mat_side} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side + mat_side/2} y={0 + mat_side/2}> {sigma.get(0, 1).toFixed(2)}</text>
                <rect class="matrix_block marg_copy" x={lam_offset + 2*mat_side} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + 2*mat_side + mat_side/2} y={0 + mat_side/2}> {sigma.get(0, 2).toFixed(2)}</text>
            </g>
            <g>
                <rect class="matrix_block" x={lam_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side/2} y={mat_side + mat_side/2}> {sigma.get(1, 0).toFixed(2)}</text>
                <rect class="matrix_block" x={lam_offset + mat_side} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side + mat_side/2} y={mat_side + mat_side/2}> {sigma.get(1, 1).toFixed(2)}</text>
                <rect class="matrix_block" x={lam_offset + 2*mat_side} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + 2*mat_side + mat_side/2} y={mat_side + mat_side/2}> {sigma.get(1, 2).toFixed(2)}</text>
            </g> 
            <g>
                <rect class="matrix_block marg_copy" x={lam_offset + 0} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side/2} y={2*mat_side + mat_side/2}> {sigma.get(2, 0).toFixed(2)}</text>
                <rect class="matrix_block" x={lam_offset + mat_side} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side + mat_side/2} y={2*mat_side + mat_side/2}> {sigma.get(2, 1).toFixed(2)}</text>
                <rect class="matrix_block marg_copy" x={lam_offset + 2*mat_side} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + 2*mat_side + mat_side/2} y={2*mat_side + mat_side/2}> {sigma.get(2, 2).toFixed(2)}</text>
            </g>
        </svg>
      </div>
      <div class="column" style="width: 29%">
        <div style="text-align: center; width: 100%;">
          <d-math>&mu</d-math>
        </div>
        <svg style="background-color: white; border: black; width: 100%">
            <g>
                <rect class="matrix_block marg_copy" x={eta_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={eta_offset + mat_side/2} y={0 + mat_side/2}> {zero(mu.get(0, 0)).toFixed(2)}</text>
                <rect class="matrix_block" x={eta_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={eta_offset + mat_side/2} y={mat_side + mat_side/2}> {zero(mu.get(1, 0)).toFixed(2)}</text>
                <rect class="matrix_block marg_copy" x={eta_offset + 0} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={eta_offset + mat_side/2} y={2*mat_side + mat_side/2}> {zero(mu.get(2, 0)).toFixed(2)}</text>
            </g>
        </svg>
      </div>
    </div>

  </div>

  <div class="column" style="--width: {100*(1 - middle_width - 2*red_width) / 2}%"></div>
  
  <div class="column" style="--width: {100*red_width}%;">
    <div class="row">
        <div class="column" style="width: 60%">
          <div style="text-align: center; width: 100%;">
            <d-math>\Lambda</d-math>
          </div>
          <svg style="background-color: white; --height: {lambda_mat_width + 5}px;">
              <g>
                  <rect class="matrix_block" x={r_lam_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                  <text class="matrix_text" x={r_lam_offset + mat_side/2} y={0 + mat_side/2}> {marg_lam.get(0, 0).toFixed(1)}</text>
                  <rect class="matrix_block" x={r_lam_offset + mat_side} y={0} width={mat_side} height={mat_side}></rect>
                  <text class="matrix_text" x={r_lam_offset + mat_side + mat_side/2} y={0 + mat_side/2}> {marg_lam.get(0, 1).toFixed(1)}</text>
              </g>
              <g>
                  <rect class="matrix_block" x={r_lam_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                  <text class="matrix_text" x={r_lam_offset + mat_side/2} y={mat_side + mat_side/2}> {marg_lam.get(1, 0).toFixed(1)}</text>
                  <rect class="matrix_block" x={r_lam_offset + mat_side} y={mat_side} width={mat_side} height={mat_side}></rect>
                  <text class="matrix_text" x={r_lam_offset + mat_side + mat_side/2} y={mat_side + mat_side/2}> {marg_lam.get(1, 1).toFixed(1)}</text>
              </g> 
          </svg>
        </div>
        <div class="column" style="width: 40%">
          <div style="text-align: center; width: 100%;">
            <d-math>\eta</d-math>
          </div>
          <svg style="background-color: white; --height: {lambda_mat_width + 5}px;">
              <g>
                  <rect class="matrix_block" x={r_eta_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                  <text class="matrix_text" x={r_eta_offset + mat_side/2} y={0 + mat_side/2}> {marg_eta.get(0, 0).toFixed(1)}</text>
                  <rect class="matrix_block" x={r_eta_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                  <text class="matrix_text" x={r_eta_offset + mat_side/2} y={mat_side + mat_side/2}> {marg_eta.get(1, 0).toFixed(1)}</text>
              </g>
          </svg>
        </div>
    </div>

    <div class="row">
      <div class="column" style="width: 60%">
        <div style="text-align: center; width: 100%;">
          <d-math>&Sigma</d-math>
        </div>
        <svg style="background-color: white; --height: {lambda_mat_width + 5}px;">
            <g>
                <rect class="matrix_block marg_copy" x={r_lam_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side/2} y={0 + mat_side/2}> {marg_sigma.get(0, 0).toFixed(2)}</text>
                <rect class="matrix_block marg_copy" x={r_lam_offset + mat_side} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side + mat_side/2} y={0 + mat_side/2}> {marg_sigma.get(0, 1).toFixed(2)}</text>
            </g>
            <g>
                <rect class="matrix_block marg_copy" x={r_lam_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side/2} y={mat_side + mat_side/2}> {marg_sigma.get(1, 0).toFixed(2)}</text>
                <rect class="matrix_block marg_copy" x={r_lam_offset + mat_side} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_lam_offset + mat_side + mat_side/2} y={mat_side + mat_side/2}> {marg_sigma.get(1, 1).toFixed(2)}</text>
            </g> 
        </svg>
      </div>
      <div class="column" style="width: 40%">
        <div style="text-align: center; width: 100%;">
          <d-math>&mu</d-math>
        </div>
        <svg style="background-color: white; --height: {lambda_mat_width + 5}px;">
            <g>
                <rect class="matrix_block marg_copy" x={r_eta_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_eta_offset + mat_side/2} y={0 + mat_side/2}> {zero(marg_mu.get(0, 0)).toFixed(2)}</text>
                <rect class="matrix_block marg_copy" x={r_eta_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={r_eta_offset + mat_side/2} y={mat_side + mat_side/2}> {zero(marg_mu.get(1, 0)).toFixed(2)}</text>
            </g>
        </svg>
      </div>
    </div>
  </div>
</div>
