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
  let y = 0.4;
  let y2 = 0.6;

  let x_key = 0.2;
  let y_key = 0.2;

  let radius = 0.03;
  let factor_size = 0.03;

  let svg_width, svg_height;

  let lambda_mat_width = 0.9;
  let mat_side = 0;
  let lam_offset = 0;
  let eta_offset = 0;

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

  let lambda = m.Matrix.zeros(3, 3);
  let eta = m.Matrix.zeros(3, 1);

  let sigma = m.Matrix.zeros(3, 3);
  let mu = m.Matrix.zeros(3, 1);


  let std_color = "green";
  let meas_color = "blue";

  let node_mousedown = null;
  let val0 = null;
  let x0 = null;
  let scale = 0.2;

  function update_matrices() {

    let include_factors = [true, true, true, true, true]

    // Turn off factors if lam = 0
    for (let i=0; i < 3; ++i) {
      if (!active_factors[i] || unary_lams[i] == 0.) {
        include_factors[i] = false;
      }
    }
    if (!active_factors[3] || lam_m12 == 0.) {
      include_factors[3] = false;
    }
    if (!active_factors[4] || lam_m23 == 0.) {
      include_factors[4] = false;
    }

    lambda = m.Matrix.zeros(3, 3);
    eta = m.Matrix.zeros(3, 1);

    // Contributions from unary factors
    for (let i=0; i < 3; ++i) {
      if (include_factors[i]) {
        new m.MatrixSubView(lambda, i, i, i, i).add(unary_lams[i]);
        new m.MatrixSubView(eta, i, i, 0, 0).add(unary_etas[i]);
      }
    }

    // Contributions from binary factors
    if (include_factors[3]) {
      new m.MatrixSubView(lambda, 0, 1, 0, 1).add(JTJ.clone().mul(lam_m12));
      new m.MatrixSubView(eta, 0, 1, 0, 0).add(J.clone().mul(lam_m12 * z12));
    }
    if (include_factors[4]) {
      new m.MatrixSubView(lambda, 1, 2, 1, 2).add(JTJ.clone().mul(lam_m23));
      new m.MatrixSubView(eta, 1, 2, 0, 0).add(J.clone().mul(lam_m23 * z23));
    }

    // If no anchors, all nans
    if (!include_factors[0] && !include_factors[1] && !include_factors[2]) {
      sigma = new m.Matrix([[NaN, NaN, NaN],[NaN, NaN, NaN], [NaN, NaN, NaN]]);
      mu = new m.Matrix([[NaN], [NaN], [NaN]]);
    } else if (!include_factors[3] && !include_factors[4]) {
      // All variables in separate
      sigma = m.Matrix.zeros(3, 3);
      mu = m.Matrix.zeros(3, 1);
      for (let i=0; i < 3; ++i) {
        if (include_factors[i]) {
          new m.MatrixSubView(sigma, i, i, i, i).add(1 / unary_lams[i]);
          new m.MatrixSubView(mu, i, i, 0, 0).add(unary_etas[i]/ unary_lams[i]);
        } else {
          mu.set(i, 0, NaN);
          sigma.set(i, 0, NaN);
          sigma.set(i, 1, NaN);
          sigma.set(i, 2, NaN);
          sigma.set(0, i, NaN);
          sigma.set(1, i, NaN);
          sigma.set(2, i, NaN);
        }
      }
    } else if (!include_factors[3]) {
      // Variable 1 on its own
      sigma = m.Matrix.zeros(3, 3);
      mu = m.Matrix.zeros(3, 1);
      if (include_factors[0]) {
        new m.MatrixSubView(sigma, 0, 0, 0, 0).add(1 / unary_lams[0]);
        new m.MatrixSubView(mu, 0, 0, 0, 0).add(unary_etas[0]/ unary_lams[0]);
      } else {
        mu.set(0, 0, NaN);
        sigma.set(0, 0, NaN);
        sigma.set(0, 1, NaN);
        sigma.set(0, 2, NaN);
        sigma.set(1, 0, NaN);
        sigma.set(2, 0, NaN);
      }
      // Check for anchor in graph with nodes 2 and 3
      if (!include_factors[1] && !include_factors[2]) {
        mu.set(1, 0, NaN);
        mu.set(2, 0, NaN);
        sigma.set(1, 1, NaN);
        sigma.set(1, 2, NaN);
        sigma.set(2, 1, NaN);
        sigma.set(2, 2, NaN);
        sigma.set(0, 1, NaN);
        sigma.set(0, 2, NaN);
        sigma.set(1, 0, NaN);
        sigma.set(2, 0, NaN);
      } else {
        let lam_block = new m.Matrix([[lambda.get(1,1), lambda.get(1,2)], [lambda.get(2,1), lambda.get(2,2)]]);
        let eta_block = new m.Matrix([[eta.get(1, 0)], [eta.get(2, 0)]]);
        new m.MatrixSubView(sigma, 1, 2, 1, 2).add(m.inverse(lam_block));
        new m.MatrixSubView(mu, 1, 2, 0, 0).add(m.inverse(lam_block).mmul(eta_block));
      }
    } else if (!include_factors[4]) {
      // Variable 3 on its own
      sigma = m.Matrix.zeros(3, 3);
      mu = m.Matrix.zeros(3, 1);
      if (include_factors[2]) {
        new m.MatrixSubView(sigma, 2, 2, 2, 2).add(1 / unary_lams[2]);
        new m.MatrixSubView(mu, 2, 2, 0, 0).add(unary_etas[2]/ unary_lams[2]);
      } else {
        mu.set(2, 0, NaN);
        sigma.set(2, 0, NaN);
        sigma.set(2, 1, NaN);
        sigma.set(2, 2, NaN);
        sigma.set(0, 2, NaN);
        sigma.set(1, 2, NaN);
      }
      // Check for anchor in graph with nodes 1 and 2
      if (!include_factors[0] && !include_factors[1]) {
        mu.set(0, 0, NaN);
        mu.set(1, 0, NaN);
        sigma.set(0, 0, NaN);
        sigma.set(0, 1, NaN);
        sigma.set(1, 0, NaN);
        sigma.set(1, 1, NaN);
        sigma.set(0, 2, NaN);
        sigma.set(1, 2, NaN);
        sigma.set(2, 0, NaN);
        sigma.set(2, 1, NaN);
      } else {
        let lam_block = new m.Matrix([[lambda.get(0,0), lambda.get(0,1)], [lambda.get(1,0), lambda.get(1,1)]]);
        let eta_block = new m.Matrix([[eta.get(0, 0)], [eta.get(1, 0)]]);
        new m.MatrixSubView(sigma, 0, 1, 0, 1).add(m.inverse(lam_block));
        new m.MatrixSubView(mu, 0, 1, 0, 0).add(m.inverse(lam_block).mmul(eta_block));
      }
    } else {
      sigma = m.inverse(lambda);
      mu = sigma.mmul(eta);
    }

  }

  function zero(val) {
    if (Math.abs(val) < 1e-5) {
      val = 0.
    }
    return val;
  }

  function zero_mat(mat) {
    for (let i=0; i < mat.numberRows; i++) {
      for (let j=0; j < mat.numberCols; j++) {
        if (Math.abs(mat.get(i, j)) < 1e-5) {
          mat.set(i, j, 0.);
        }
      }
    }
  }

  onMount(() => {

    var bb = document.querySelector ('#col1').getBoundingClientRect();
    console.log(bb);
    svg_width = bb.width;
    svg_height = bb.height;

    console.log(bb);

    xs[0] *= svg_width;
    xs[1] *= svg_width;
    xs[2] *= svg_width;

    x1 *= svg_width;
    x2 *= svg_width;
    x3 *= svg_width;
    y *= svg_height;
    y2 *= svg_height;

    x_key *= svg_width;
    y_key *= svg_height;

    radius *= svg_width;
    factor_size *= svg_width;

    var lam_svg = document.querySelector ('#lam_matrix').getBoundingClientRect();
    console.log(lam_svg, lam_svg.width, lam_svg.height);
    lam_offset = (1 - lambda_mat_width) * Math.min(lam_svg.width, lam_svg.height) / 2;
    lambda_mat_width *= Math.min(lam_svg.width, lam_svg.height);
    mat_side = lambda_mat_width / 3;
    console.log(mat_side, lam_offset);

    var eta_svg = document.querySelector ('#eta_matrix').getBoundingClientRect();
    eta_offset = (eta_svg.width - mat_side) / 2;

    update_matrices();

  });

  onInterval(() => update_matrices(), 100);


  function click_handler(e) {

    console.log(e);

    node_clicked = null;
    node_clicked = e.path.find((element) => element.classList == "node_g svelte-155wgvt");

    if (node_clicked) {
      active_factors[node_clicked.id] = !active_factors[node_clicked.id];
    }
  }

  function mousedown_handler(e) {

    node_mousedown = null;
    node_mousedown = e.path.find((element) => element.classList == "node_g svelte-155wgvt");

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
  width: 33.3%;
  padding: 10px;
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


</style>


<div class="row">
  <div class="column" id="col1" style="width: 40%;">

    <svg
      bind:this={svg}
      on:click={click_handler}
      on:mousedown={mousedown_handler}
      on:mouseup={mouseup_handler}
      on:mousemove={mousemove_handler}
      style="background-color: white; border: black;"
      >

      <!-- Draw graph -->

      <!-- Key -->
      <circle class="var_node" cx={x_key} cy={y_key} r={radius}/>
      <text class="legend_text" x={x_key + radius*1.8} y={y_key + 0.5*radius}> Variable </text>
      <rect class="factor_node" x={x_key + 100 - factor_size/2} y={y_key - factor_size/2} width={factor_size} height={factor_size} stroke="black"/>
      <text class="legend_text" x={x_key + 100 + radius*1.8} y={y_key + 0.5*radius}> Factor </text>

      <!-- Edges -->
      {#if active_factors[3]}
        <line x1={x1} y1={y} x2={x2} y2={y} stroke="black" stroke-width="1"/>
      {/if}
      {#if active_factors[4]}
        <line x1={x2} y1={y} x2={x3} y2={y} stroke="black" stroke-width="1"/>
      {/if}

      {#each Array(3) as _, i}
        {#if active_factors[i]}
          <line x1={xs[i]} y1={y} x2={xs[i]} y2={y2} stroke="black" stroke-width="1"/>
        {/if}
      {/each}

      <!-- Variable nodes -->
      {#each Array(3) as _, i}
        <circle class="var_node" cx={xs[i]} cy={y} r={radius}/>
        <text class="node_text" x={xs[i]} y={y + 0.5*radius}> {i} </text>
      {/each}

      <!-- Factor nodes -->

      {#each Array(3) as _, i}
        <g class="node_g" id="{i}" cursor="pointer" draggable="true">
          {#if active_factors[i]}
            <rect class="factor_node" x={xs[i] - factor_size/2} y={y2 - factor_size/2} width={factor_size} height={factor_size} stroke="black"/>
          {:else}
            <rect class="factor_node_off" x={xs[i] - factor_size/2} y={y2 - factor_size/2} width={factor_size} height={factor_size} stroke="black"/>
          {/if}
        </g>
        <g class="node_g" id="{"eta" + i}" cursor="ew-resize" draggable="true">
          <text class="node_text" fill="{meas_color}" x={xs[i] - 2.5*factor_size} y={y2 + factor_size/2}> {unary_etas[i].toFixed(1)} </text>
        </g>
        <g class="node_g" id="{"lam" + i}" cursor="ew-resize" draggable="true">
          <text class="node_text" fill="{std_color}" x={xs[i]} y={y2 + 2.5*factor_size}> {unary_lams[i].toFixed(1)} </text>
        </g>
      {/each}

      <g class="node_g" id="3" cursor="pointer" draggable="true">
        {#if active_factors[3]}
          <rect class="factor_node" x={(x1+x2)/2 - factor_size/2} y={y - factor_size/2} width={factor_size} height={factor_size} stroke="black"/>
        {:else}
          <rect class="factor_node_off" x={(x1+x2)/2 - factor_size/2} y={y - factor_size/2} width={factor_size} height={factor_size} stroke="black"/>
        {/if}
      </g>
      <g class="node_g" id="eta3" cursor="ew-resize" draggable="true">
        <text class="node_text" fill="{meas_color}" x={(x1+x2)/2} y={y - 1.5*factor_size}> {z12.toFixed(1)} </text>
      </g>
      <g class="node_g" id="lam3" cursor="ew-resize" draggable="true">
          <text class="node_text" fill="{std_color}" x={(x1+x2)/2} y={y + 2.5*factor_size}> {lam_m12.toFixed(1)} </text>
      </g>

      <g class="node_g" id="4" cursor="pointer" draggable="true">
        {#if active_factors[4]}x1
          <rect class="factor_node" x={(x2+x3)/2 - factor_size/2} y={y - factor_size/2} width={factor_size} height={factor_size} stroke="black"/>
        {:else}
          <rect class="factor_node_off" x={(x2+x3)/2 - factor_size/2} y={y - factor_size/2} width={factor_size} height={factor_size} stroke="black"/>
        {/if}
      </g>
      <g class="node_g" id="eta4" cursor="ew-resize" draggable="true">
        <text class="node_text" fill="{meas_color}" x={(x2+x3)/2} y={y - 1.5*factor_size}> {z23.toFixed(1)} </text>
      </g>
      <g class="node_g" id="lam4" cursor="ew-resize" draggable="true">
        <text class="node_text" fill="{std_color}" x={(x2+x3)/2} y={y + 2.5*factor_size}> {lam_m23.toFixed(1)} </text>
      </g>

    </svg>

  </div>
  <div class="column" style="width: 5%;"></div>
  <div class="column" id="col2" style="width: 25%;">

    <div class="row">

      <div class="column" style="width: 70%">

        <div style="text-align: center; width: 100%;">
          <d-math>\Lambda</d-math>
        </div>

        <svg style="background-color: white; border: black; width:100%" id="lam_matrix">
            <g>
                <rect class="matrix_block" x={lam_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side/2} y={0 + mat_side/2}> {lambda.get(0, 0).toFixed(1)}</text>
                <rect class="matrix_block" x={lam_offset + mat_side} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side + mat_side/2} y={0 + mat_side/2}> {lambda.get(0, 1).toFixed(1)}</text>
                <rect class="matrix_block" x={lam_offset + 2*mat_side} y={0} width={mat_side} height={mat_side}></rect>
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
                <rect class="matrix_block" x={lam_offset + 0} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side/2} y={2*mat_side + mat_side/2}> {lambda.get(2, 0).toFixed(1)}</text>
                <rect class="matrix_block" x={lam_offset + mat_side} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side + mat_side/2} y={2*mat_side + mat_side/2}> {lambda.get(2, 1).toFixed(1)}</text>
                <rect class="matrix_block" x={lam_offset + 2*mat_side} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + 2*mat_side + mat_side/2} y={2*mat_side + mat_side/2}> {lambda.get(2, 2).toFixed(1)}</text>
            </g>
        </svg>
      </div>
      <div class="column" style="width: 29%">
        <div style="text-align: center; width: 100%;">
          <d-math>\eta</d-math>
        </div>
        <svg style="background-color: white; border: black; width: 100%" id="eta_matrix">
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

  </div>
  <div class="column" style="width: 5%;"></div>
  <div class="column" style="width: 25%;">

    <div class="row">

      <div class="column" style="width: 70%">

        <div style="text-align: center; width: 100%;">
          <d-math>&Sigma=&Lambda^-1</d-math>
        </div>

        <svg style="background-color: white; border: black; width:100%" id="lam_matrix">
            <g>
                <rect class="matrix_block" x={lam_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side/2} y={0 + mat_side/2}> {sigma.get(0, 0).toFixed(2)}</text>
                <rect class="matrix_block" x={lam_offset + mat_side} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side + mat_side/2} y={0 + mat_side/2}> {sigma.get(0, 1).toFixed(2)}</text>
                <rect class="matrix_block" x={lam_offset + 2*mat_side} y={0} width={mat_side} height={mat_side}></rect>
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
                <rect class="matrix_block" x={lam_offset + 0} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side/2} y={2*mat_side + mat_side/2}> {sigma.get(2, 0).toFixed(2)}</text>
                <rect class="matrix_block" x={lam_offset + mat_side} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + mat_side + mat_side/2} y={2*mat_side + mat_side/2}> {sigma.get(2, 1).toFixed(2)}</text>
                <rect class="matrix_block" x={lam_offset + 2*mat_side} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={lam_offset + 2*mat_side + mat_side/2} y={2*mat_side + mat_side/2}> {sigma.get(2, 2).toFixed(2)}</text>
            </g>
        </svg>
      </div>
      <div class="column" style="width: 29%">
        <div style="text-align: center; width: 100%;">
          <d-math>&mu=&Lambda^-1 &eta</d-math>
        </div>
        <svg style="background-color: white; border: black; width: 100%">
            <g>
                <rect class="matrix_block" x={eta_offset + 0} y={0} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={eta_offset + mat_side/2} y={0 + mat_side/2}> {zero(mu.get(0, 0)).toFixed(2)}</text>
                <rect class="matrix_block" x={eta_offset + 0} y={mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={eta_offset + mat_side/2} y={mat_side + mat_side/2}> {zero(mu.get(1, 0)).toFixed(2)}</text>
                <rect class="matrix_block" x={eta_offset + 0} y={2*mat_side} width={mat_side} height={mat_side}></rect>
                <text class="matrix_text" x={eta_offset + mat_side/2} y={2*mat_side + mat_side/2}> {zero(mu.get(2, 0)).toFixed(2)}</text>
            </g>
        </svg>
      </div>

    </div>

  </div>
</div>
