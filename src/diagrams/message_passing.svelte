<!-- 
TODO
-show covariance ellipses 
- dots for gt mean


 -->

<script>
  import { onMount } from 'svelte';
  import { onInterval } from '../utils/util.js';
  // import * as colormap from 'colormap';
  import * as m from 'ml-matrix';
  // import * as d3 from 'd3';
  import * as gbp from "../gbp/gbp_playground.js";
  import * as r from "random";


  // svg
  let svg;
  let svg_width = 0;
  let svg_height = 0;

  let ub_color = "green";
  let v2f_color = "red";
  let f2v_color = "blue";

  let t = 0;

  let beliefs = {0: {xs: [0,0,0,0,0,0,0,0,0], ys: [0,0,0,0,0,0,0,0,0]}};
  let scale = 50;
  let x_offset = 30;
  let y_offset = 15;

  onMount(() => {

    var bb = document.querySelector ('#svg1').getBoundingClientRect();
    svg_width = bb.width;
    svg_height = bb.height;



    let graph = new gbp.FactorGraph();


    let grid_size = 3;
    let n_iters = 50;

    let prior_std = 3.;
    let anchor_prior_std = 0.001;
    let meas_params = {
        "linear" : {
            "noise_model_std": 3.,
            "noise_std": 0,
        }
    }

    const noise_gen = r.normal(0, 0.2);

    for (var i=0; i<grid_size; i++) {
        for (var j=0; j<grid_size; j++) {
            graph.add_var_node(i, j, prior_std, 3*i+j, 0, anchor_prior_std);
            if (i!=0 && j!=0) {
              graph.var_nodes[i*grid_size + j].prior.eta = graph.var_nodes[i*grid_size + j].prior.lam.mmul(new m.Matrix(
                [[i + noise_gen()], [j + noise_gen()]]));              
            }
        }
    }

    for (var i=0; i<grid_size; i++) {
        for (var j=0; j<grid_size; j++) {
            if (!(i==2 && j==2)) {
              if (j == grid_size-1) {
                  graph.add_factor_node(3*i + j, 3*i + j + 3, "linear", meas_params); // factor with node below
              } else if (i == grid_size - 1) {
                  graph.add_factor_node(3*i + j, 3*i + j + 1, "linear", meas_params); // factor with node on rhs
              } else {
                  graph.add_factor_node(3*i + j, 3*i + j + 1, "linear", meas_params); // factor with node on rhs
                  graph.add_factor_node(3*i + j, 3*i + j + 3, "linear", meas_params); // factor with node below
              }
            }
        }
    }


    graph.update_beliefs();

    for (let i=0; i < n_iters; ++i) {
      var bp_means = {xs: [], ys: []};
      for (var j = 0; j < graph.var_nodes.length; j++) {
        bp_means.xs.push(graph.var_nodes[j].belief.getMean().get(0,0));
        bp_means.ys.push(graph.var_nodes[j].belief.getMean().get(1,0));
      }
      beliefs[i] = bp_means;
      graph.sync_iter();
    }

    console.log(beliefs);
    console.log(graph);

  });

</script>

<input type="range" min="0" max="20" bind:value={t} step="0.01" style="width:200px;"/>

<div class="row">

  <div class="column" style="width: 50%" id="svg1">

    <svg style="background-color: white;">

      <defs>
        <marker id="arrowhead" markerWidth="3" markerHeight="3" refX="0" refY="1.5" orient="auto">
          <path d="M 0 0 L 3 1.5 L 0 3 z" stroke="none" fill="red"/>

          <!-- <polygon points="0 0, 3 1.5, 0 3" style="stroke: red;"/> -->
        </marker>
      </defs>

      <line x1={0.2*svg_width} y1={0.2*svg_height} x2={0.85*svg_width} y2={0.2*svg_height} stroke="black"></line>
      <line x1={0.2*svg_width} y1={0.12*svg_height} x2={0.2*svg_width} y2={0.28*svg_height} stroke="black"></line>
      <line x1={0.8*svg_width} y1={0.12*svg_height} x2={0.8*svg_width} y2={0.28*svg_height} stroke="black"></line>
      <line x1={0.4*svg_width} y1={0.15*svg_height} x2={0.4*svg_width} y2={0.25*svg_height} stroke="black"></line>
      <line x1={0.6*svg_width} y1={0.15*svg_height} x2={0.6*svg_width} y2={0.25*svg_height} stroke="black"></line>

      <rect x={0.2*svg_width} y={0.2*svg_height} width={0.2*svg_width} height={0.05*svg_height} style="fill: {ub_color}; opacity: 0.5;"></rect>
      <rect x={0.4*svg_width} y={0.2*svg_height} width={0.2*svg_width} height={0.05*svg_height} style="fill: {v2f_color}; opacity: 0.5;"></rect>
      <rect x={0.6*svg_width} y={0.2*svg_height} width={0.2*svg_width} height={0.05*svg_height} style="fill: {f2v_color}; opacity: 0.5;"></rect>
    
      <text x={0.2*svg_width} y={0.1*svg_height} style="text-anchor: middle;"> t = {Math.floor(t)}</text>
      <text x={0.3*svg_width} y={0.35*svg_height} style="text-anchor: middle; font-size: 10px;"> Update belief</text>
      <text x={0.5*svg_width} y={0.35*svg_height} style="text-anchor: middle; font-size: 10px;">Variable to</text>
      <text x={0.5*svg_width} y={0.43*svg_height} style="text-anchor: middle; font-size: 10px;">factor MP</text>
      <text x={0.7*svg_width} y={0.35*svg_height} style="text-anchor: middle; font-size: 10px;">Factor to</text>
      <text x={0.7*svg_width} y={0.43*svg_height} style="text-anchor: middle; font-size: 10px;">variable MP</text>
    
      <polygon 
        points="{((t%1)*0.6 + 0.2)*svg_width},{0.2*svg_height} {((t%1)*0.6 + 0.2 + 0.02)*svg_width},{0.1*svg_height} {((t%1)*0.6 + 0.2 - 0.02)*svg_width},{0.1*svg_height}" 
        style="fill: yellow; stroke: black; stroke-width: 1;" />

      <line x1={0.23*svg_width} y1={0.7*svg_height} x2={0.77*svg_width} y2={0.7*svg_height} stroke="black"></line>
      <circle class="var_node" cx={0.35*svg_width} cy={0.7*svg_height} r={svg_height/15}/>
      <rect class="factor_node" x={0.65*svg_width - svg_height/20} y={0.7*svg_height - svg_height/20} 
        width={svg_height/10} height={svg_height/10} stroke="black"/>
      {#if t%1 < 0.33}
        <circle class="var_node" cx={0.35*svg_width} cy={0.7*svg_height} r={svg_height/15} style="fill: {ub_color}; opacity: 0.5"/>
      {:else if t%1 < 0.66}
        <line x1={0.4*svg_width} y1={0.62*svg_height} x2={0.58*svg_width} y2={0.62*svg_height} fill="none"
          style="stroke: {v2f_color}; opacity: 0.5;" stroke-width="4" marker-end="url(#arrowhead)" />
        <line x1={0.3*svg_width} y1={0.62*svg_height} x2={0.2*svg_width} y2={0.62*svg_height} fill="none"
          style="stroke: {v2f_color}; opacity: 0.5;" stroke-width="4" marker-end="url(#arrowhead)" />
        <line x1={0.8*svg_width} y1={0.62*svg_height} x2={0.72*svg_width} y2={0.62*svg_height} fill="none"
          style="stroke: {v2f_color}; opacity: 0.5;" stroke-width="4" marker-end="url(#arrowhead)" />
      {:else}
        <line x1={0.6*svg_width} y1={0.78*svg_height} x2={0.42*svg_width} y2={0.78*svg_height} fill="none"
          style="stroke: {f2v_color}; opacity: 0.5;" stroke-width="4" marker-end="url(#arrowhead)" />
        <line x1={0.18*svg_width} y1={0.78*svg_height} x2={0.28*svg_width} y2={0.78*svg_height} fill="none"
          style="stroke: {f2v_color}; opacity: 0.5;" stroke-width="4" marker-end="url(#arrowhead)" />
        <line x1={0.7*svg_width} y1={0.78*svg_height} x2={0.78*svg_width} y2={0.78*svg_height} fill="none"
          style="stroke: {f2v_color}; opacity: 0.5;" stroke-width="4" marker-end="url(#arrowhead)" />
      {/if}
    </svg>

  </div>

  <div class="column" style="width: 50%" id="svg1">

    <svg style="background-color: white;">
    
      {#each Array(3) as _, i}
        {#each Array(3) as _, j}
          {#if j < 2}
            <line x1={x_offset + beliefs[Math.floor(t)].xs[3*i + j]*scale} x2={x_offset + beliefs[Math.floor(t)].xs[3*i + j + 1]*scale}
                  y1={y_offset + beliefs[Math.floor(t)].ys[3*i + j]*scale} y2={y_offset + beliefs[Math.floor(t)].ys[3*i + j + 1]*scale} 
                  stroke="black"></line>
          {/if}
          {#if i < 2}
            <line x1={x_offset + beliefs[Math.floor(t)].xs[3*i + j]*scale} x2={x_offset + beliefs[Math.floor(t)].xs[3*i + j + 3]*scale}
                  y1={y_offset + beliefs[Math.floor(t)].ys[3*i + j]*scale} y2={y_offset + beliefs[Math.floor(t)].ys[3*i + j + 3]*scale} 
                  stroke="black"></line>
          {/if}
        {/each}
      {/each}

      {#each Array(beliefs["0"].xs.length) as _, i}
        <circle class="var_node" cx={x_offset + beliefs[Math.floor(t)].xs[i]*scale} cy={y_offset + beliefs[Math.floor(t)].ys[i]*scale} r={svg_height/15}/>
      {/each}
    </svg>


  </div>

</div>
