<script>
    import * as m from 'ml-matrix';
    import { onMount } from "svelte";
    import { onInterval } from "../utils/util.js";
    import { tweened } from "svelte/motion";
    import { fade } from "svelte/transition";
    import * as easing from "svelte/easing";
    import anime from "animejs";
    import ButtonGroup from '../utils/ButtonGroup.svelte'
    import * as gbp from "../gbp/gbp_playground.js";

    // svg
    let svg;
    let svg_width = 600;
    let svg_height = 600;

    // GBP parameters
    // var eta_damping = 0;
    let prior_std = 50;
    let meas_params = {
        "linear" : {
            "noise_model_std": 40,
            "noise_std": 2,
        }
    };


    let highlight_id = null;

    // Playground
    let graph;
    $: var_nodes = [];
    $: factor_nodes = [];

    let n_var_nodes = 5;

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

    // Message passing animation
    const clear_message_highlight_delay = 0.5;
    let pause_one_iter = false;
    let animation_in_progress = false; // set to true to prevent new input during animation
    $: message_bubbles = [];
    $: update_var_node = {
        node_id: null,
        old: null,
        new: null,
    };

    $: message_bubbles = [];
    $: moving_beliefs = [];

    const bubble_progress = tweened(0);
    const move_belief_progress = tweened(0);
    const bubble_time = 400;  // ms
    const move_belief_time = 500;
    const highlight_time = 300;


    let messages = []; //  { message: null, timestamp: null, duration: null };

    // UI
    const time_res = 0.1; // time resolution
    let n_iters = 0; 
    let iter_sec = 1.0;
    let counter = 0;
    let mode = "edit";
    let passing_message = false;

    let show_batch = true;


    let speed = 0;
    const speed_labels = ["1/4x", "1/2x", "1x", "5x", "10x"];
    const iters_per_sec = [1, 2, 4, 20, 40];

    // Visual appearance
    let factor_size = 20;
    let radius = 10;
    let mean_radius = 6;
    let can_open = false;
    let gt_color = "green";
    let linear_color = "orange";

    const meas_model = "linear";

    onMount(() => {
        reset_playground();

        console.log(graph);
        console.log(var_nodes, factor_nodes);

        for (let c=0; c < graph.factor_nodes.length; c++) {
            console.log(graph.factor_nodes[c].adj_ids);
            console.log(graph.var_nodes[graph.factor_nodes[c].adj_ids[0]])
        }

    });

    onInterval(() => update_playground(), parseInt(1000 / 60));

    onInterval(() => {
            pass_message_interval();

        }
    , 1000 * time_res);


  // ************************************************************
  // Callback functions
  // ************************************************************

  function update_playground() {

    if (mode == "edit") {
      graph.update_node_id();
      graph.update_factor_node_location();
    }
    var_nodes = graph.var_nodes;
    factor_nodes = graph.factor_nodes;

    iter_sec = 1 / iters_per_sec[speed+2];

    if (mode == "init") {
      graph.update_priors(prior_std, true);  // Update beliefs as prior std is changed with slider
      graph.update_ellipses();
      graph.update_factor_noise_models(meas_params);  // Update factors as meas noise models are changed with sliders
      graph.compute_MAP();
    }
  }

  function pass_message_interval() {
    // Enables pass message in adjustable interval
    if (mode == "play" && passing_message) {
      if (counter >= iter_sec * 10 - 1 || !iter_sec) {
        counter = 0;
        if (!pause_one_iter) {
          sync_iter();

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
    graph = new gbp.FactorGraph();
    graph.add_var_node(svg_width / 2, svg_height / 2, prior_std, 0);
    return graph;
  }

  function create_linear_playground(n_var_nodes) {
    graph = new gbp.FactorGraph();

    let x0 = 100;
    let inc = (svg_width - 2*x0) / (n_var_nodes-1);

    graph.add_var_node(x0, svg_height / 2, prior_std, 0);
    for (let j=1; j < n_var_nodes; j++) {
      graph.add_var_node(x0 + j*inc, svg_height / 2, prior_std, 2*j);
      graph.add_factor_node(2*(j-1), 2*j, meas_model, meas_params, 2*j-1);
    }
    return graph;
  }

    function create_grid_playground() {
        const grid_size = 3;
        graph = new gbp.FactorGraph();

        let prior_std = 0.6;
        let anchor_prior_std = 0.0001;

        let x0 = 100;
        let inc = (svg_width - 2*x0) / (grid_size-1);

        for (var i=0; i<grid_size; i++) {
            for (var j=0; j<grid_size; j++) {
                graph.add_var_node(x0 + j*inc, x0 + i*inc, prior_std, 3*i+j);
                if (i!=0 && j!=0) {
                    graph.var_nodes[i*grid_size + j].prior.eta = graph.var_nodes[i*grid_size + j].prior.lam.mmul(new m.Matrix(
                    [[x0 + j*inc], [x0 + i*inc]]));              
                }
            }
        }
        
        for (var i=0; i<grid_size; i++) {
            for (var j=0; j<grid_size; j++) {
                if (j < 2) {
                    graph.add_factor_node(3*i + j, 3*i + j + 1, "linear", meas_params); // factor with node below
                }
                if (i < 2) {
                    graph.add_factor_node(3*i + j, 3*i + j + 3, "linear", meas_params); // factor with node on rhs
                }
            }
        }
        console.log(graph);
        return graph;
    }

  function create_loop_playground(n_var_nodes = 2) {
    graph = new gbp.FactorGraph();
    for (var i = 0; i < n_var_nodes; i++) {
      if (i < 8) {
        graph.add_var_node(50 + 100 * i, 100, prior_std, i * 2);
      } else if (i < 15) {
        graph.add_var_node(750, 100 + 100 * (i - 7), prior_std, i * 2);
      } else if (i < 22) {
        graph.add_var_node(50 + 100 * (21 - i), 750, prior_std, i * 2);
      } else if (i < 28) {
        graph.add_var_node(50, 100 + 100 * (28 - i), prior_std, i * 2);
      } else {
        graph.add_var_node(svg_width * Math.random(), svg_height * Math.random(), prior_std, i * 2 );
      }
      if (i > 0) {
        graph.add_factor_node((i - 1) * 2, i * 2, meas_model, meas_params, i * 2 - 1);
      }
    }
    return graph;
  }

  function clear_playground() {
    var_nodes = [];
    factor_nodes = [];
    passing_message = false;
    graph = create_empty_playground();
    graph.update_beliefs();
    graph.compute_MAP();
    update_playground();
    n_iters = 0;
  }


    function reset_playground() {
        var_nodes = [];
        factor_nodes = [];
        passing_message = false;
        graph = create_linear_playground(n_var_nodes);
        var_nodes = graph.var_nodes;
        factor_nodes = graph.factor_nodes;
        graph.update_beliefs();
        graph.compute_MAP();
        update_playground();
        n_iters = 0;
    }

    function grid_playground() {
        var_nodes = [];
        factor_nodes = [];
        passing_message = false;
        graph = create_grid_playground(n_var_nodes);
        var_nodes = graph.var_nodes;
        factor_nodes = graph.factor_nodes;
        graph.update_beliefs();
        graph.compute_MAP();
        update_playground();
        n_iters = 0;
    }

  // ************************************************************
  // Message passing functions
  // ************************************************************


    function sync_iter() {
        graph.sync_iter();
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
    passing_message = false;
  }

  function pause_gbp() {
    passing_message = false;
  }


  // ************************************************************
  // Animation functions
  // ************************************************************

    function highlight_node(id) {
        highlight_id = id;
        setTimeout( () => { highlight_id = null; }, highlight_time);
    }

    function create_message_bubble(id0, id1) {
        const message_bubble = { 
            x0: graph.find_node(id0).belief_ellipse.cx, 
            y0: graph.find_node(id0).belief_ellipse.cy, 
            x1: graph.find_node(id1).belief_ellipse.cx, 
            y1: graph.find_node(id1).belief_ellipse.cy, 
        };
        message_bubbles.push(message_bubble);
        bubble_progress.set(1, {
            duration: bubble_time,
        });
        setTimeout(() => {
            clear_message_bubbles();
        }, bubble_time);
    }

    function move_belief(id) {
        // Belief has been updated in the graph, but cov ellipse has not yet been updated
        const node = graph.find_node(id);
        if (node.type == "var_node") {

            const mean = node.belief.getMean();
            const values = node.belief.getCovEllipse();
            
            const move_belief = {
                id: id,
                x0: node.belief_ellipse.cx,
                y0: node.belief_ellipse.cy,
                r0: node.belief_ellipse.rx,
                x1: mean.get(0,0), 
                y1: mean.get(1,0),
                r1: Math.sqrt(values[0][0]),
            }
            moving_beliefs.push(move_belief);
            
            // Moves after message bubble arrives
            move_belief_progress.set(1, {
                delay: bubble_time,
                duration: move_belief_time,
                easing: easing.sineOut,
            });

            setTimeout(() => {
                clear_moving_beliefs();
                node.update_ellipse();
            }, bubble_time + move_belief_time);
        }
    }

    function clear_message_bubbles() {
        message_bubbles = [];
        bubble_progress.set(0, { duration: 0 });
    }

    function clear_moving_beliefs() {
        moving_beliefs = [];
        move_belief_progress.set(0, { duration: 0 });
    }


  // ************************************************************
  // Mouse handler functions
  // ************************************************************

  function mousedown_handler(e) {
    mousedown_time = Date.now();
    mouse_up = false;

    node_mousedown = null;
    const possible_nodes = e.composedPath().filter((element) => element.classList != undefined);
    node_mousedown = possible_nodes.find((element) => element.classList[0] == "node_g");
    
    if (node_mousedown && node_mousedown.id == "new_node") {
      graph.add_var_node(svg_width - 30, 30, prior_std);
      clear_previous_message();
      node_mousedown = graph.var_nodes[graph.var_nodes.length - 1];
    }
    else if (node_mousedown) {
      node_mousedown = graph.find_node(node_mousedown.id);
    }
  }

  function mousemove_handler(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    current_mouse_location = {
      x: e.clientX - rect.x,
      y: e.clientY - rect.y,
    };

    // Open trash can lid if hovering over it
    node_onhover = null;
    node_onhover = e.path.find((element) => element.classList == "node_g");
    if (node_onhover && moving_node && node_mousedown.type == "var_node") {
      if (node_onhover.id == "trash") {
        can_open = true;
      } else {
        can_open = false;
      }
    } else {
      can_open = false;
    }

    if (node_mousedown) {
      moving_node = true;
      if (mode == "edit") {  // If in edit mode update node gt position
        node_mousedown.x = current_mouse_location.x;
        node_mousedown.y = current_mouse_location.y;
      } else if (mode == "init") {  // If in init mode update node prior
        node_mousedown.move_node(current_mouse_location.x, current_mouse_location.y, graph, false);
        node_mousedown.update_ellipse();
        graph.compute_MAP();
      }
    }
  }

  function mouseup_handler(e) {
    click_time = Date.now() - mousedown_time;
    mouse_up = true;

    if (mode == "edit") {
      let drop = false;

      node_onhover = null;
      node_onhover = e.path.find((element) => element.classList == "node_g");
      if (moving_node && node_mousedown.type == "var_node") {
        if (node_onhover) {
          if (node_onhover.id == "trash") {
            graph.remove_node(node_mousedown.id);
            graph.update_node_id();
            can_open = false;
          } else{
            drop = true;
          }
        } else {
          drop = true;
        }
      }
      
      if (drop) { // Moved variable node (not to bin)
        clear_previous_message();
        node_mousedown.move_node(node_mousedown.x, node_mousedown.y, graph);
      }
    }

    node_mousedown = null;
    moving_node = false;
  }

  function click_handler(e) {
    if (mode == "edit") {
      edit_click_handler(e);
    } else if (mode == "play") {
      play_click_handler(e);
    }
  }

  function edit_click_handler(e) {
    // Handles creating factors between variable nodes
    node_clicked = null;
    const possible_nodes = e.composedPath().filter((element) => element.classList != undefined);
    node_clicked = possible_nodes.find((element) => element.classList[0] == "node_g");

    if (click_time <= click_time_span && mouse_up) {
      if (node_clicked) {
        node_clicked = graph.find_node(node_clicked.id);
        if (!last_node_clicked) {  // if not in dragging mode to create factor
          last_node_clicked = node_clicked;  // Enter dragging mode
        } else {  // if in dragging mode
          if (node_clicked.type == "var_node" && last_node_clicked.type == "var_node") {
            graph.add_factor_node(last_node_clicked.id, node_clicked.id, meas_model, meas_params);
            clear_previous_message();
            last_node_clicked = null;
          } else {
            last_node_clicked = node_clicked;
          }
        }
      } else {
        last_node_clicked = null;
      }
    } else {
      last_node_clicked = null;
    }
  }




    function play_click_handler(e) {
        node_clicked = null;
        const possible_nodes = e.composedPath().filter((element) => element.classList != undefined);
        node_clicked = possible_nodes.find((element) => element.classList[0] == "node_g");

        if (node_clicked) {
            node_clicked = graph.find_node(node_clicked.id);
            highlight_node(node_clicked.id);

            for (let i=0; i < node_clicked.adj_ids.length; i++) {
                const factor = graph.find_node(node_clicked.adj_ids[i]);
                const dest_id = factor.adj_ids.find((x) => x != node_clicked.id);
                factor.send_message_to(graph, [dest_id]);
                graph.update_beliefs([dest_id], false);  // don't update ellipse

                create_message_bubble(node_clicked.id, dest_id);
                move_belief(dest_id);
            }

            // console.log("sending message from node", node_clicked.id, "to nodes ", updated_ids);
        }
    }

    function randomMessage(e) {
        if (mode == "play") {
            const factor_ix = Math.floor(Math.random() * graph.factor_nodes.length);
            const dest_ix = Math.floor(Math.random() * 2);
            const factor = graph.factor_nodes[factor_ix];
            const dest_id = factor.adj_ids[dest_ix];
            const source_id = factor.adj_ids[(dest_ix+1)%2];

            factor.send_message_to(graph, [dest_id]);
            graph.update_beliefs([dest_id], false); // don't update ellipses

            highlight_node(source_id);
            create_message_bubble(source_id, dest_id);
            move_belief(dest_id);

            // console.log("random message from var ", source_id, "via  factor", factor.id, "to variable", dest_id)
        }
    }

    function oneSyncIter(e) {
        if (mode == "play") {
            graph.send_messages();
            graph.update_beliefs(null, false);
            n_iters++;

            for (var i = 0; i < graph.factor_nodes.length; i++) {
                create_message_bubble(graph.factor_nodes[i].adj_ids[0], graph.factor_nodes[i].adj_ids[1]);
                create_message_bubble(graph.factor_nodes[i].adj_ids[1], graph.factor_nodes[i].adj_ids[0]);
            }
            for (var i = 0; i < graph.var_nodes.length; i++) {
                move_belief(graph.var_nodes[i].id);
            }
            console.log(moving_beliefs)
        }
    }

  function handle_mode_change() {

    clear_previous_message();
    graph.update_beliefs();

    if (mode == "edit") {
      // Reset all beliefs to be at priors and zero all messages
      graph.priors_to_gt();
    }

    if (mode != "edit") {
      graph.compute_MAP();
    }
    node_clicked = null;
    last_node_clicked = null;
    passing_message = false;
    n_iters = 0;
  }

  function toggle_passing_message() {
    if (mode == "play") {
      passing_message = !passing_message;
    }
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

</script>


<style>

    #wrapper {
        display: grid;
        font-size: 14px;
        user-select: none;
        grid-column: page;  /* start and end the grid on the page */
        max-width: calc(100vw - 2em);
        grid-template-columns: auto 400px;
        grid-template-rows: auto;  
        grid-auto-flow: column;
        grid-column-gap: 25px;
        width: 1025px;
    }

    #svg {
        background-color: #FCF7DE;
        border: 1px solid var(--gray);
        width: 600px;
        height: 600px;
    }

    .var-node {
        fill: white;
        stroke: #FF0000;
        stroke-width: 2;
    }
    .factor-node {
        fill: white;
        stroke: black;
        stroke-width: 2;
    }
    .node-text {
        user-select: none;
        font-size: 12px;
        text-anchor: middle;
    }
    .edge {
        stroke:black;
        stroke-width: 1; 
        stroke-opacity: 0.5;
    }

    .belief-mean {
        fill: red;
    }
    .belief-cov {
        stroke: red;
        stroke-opacity: 0.75;
    }
    .gt-mean {
        fill: green;
    }
    .gt-cov {
        stroke: green;
        stroke-opacity: 0.5;
        fill-opacity: 0;
    }

    .highlight-mean {
        fill: orange;
        stroke: orange;
        stroke-width: 4;
    }

    #settings-panel {
        display: grid;
        grid-template-rows: auto auto auto auto;
        width: 100%;
        font-size: 16px;
        user-select: none;

    }

    .hint {
        color: rgba(0, 0, 0, 0.6);
        user-select: text;
        font-size: 16px;
        line-height: 1.4em;
    }
    
    .bold-text {
        font-weight: bold;
    }
    .status {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
        font-family: monospace;
    }
    .slider-container {
        font-size: 14px;
    }

    .full-width-slider {
        width: 100%;
    }

    #precision-sliders {
        display: grid; 
        grid-template-columns: 1fr 1fr;
        grid-gap: 20px;
    }

    button {
      border: none;
      padding: 0.4em 0.7em;
      text-align: center;
      text-decoration: none;
      font-size: 1.05em;
      margin-top: 1px;
      float: left; 
      margin-left: 5px;
      margin-right: 5px;
      border-radius: var(--border-radius);
      border: 1px solid green; /* Green border */
      background-color:  rgba(0, 0, 0, 0.1);
    }
    .gbp-button {
        float: left;
        outline: none;
        border: none;
        background-color: white;
    }

    #speed-slider-container {
        /* text-align: center; */
        vertical-align: middle;
        margin-top: 8px;
    }

    #play-speed {
        display: grid; 
        grid-template-columns: 1fr 1fr 2.4fr;
        grid-gap: 2px;
    }

    #center {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .mess-bubble {
        stroke: var(--red);
        fill: var(--red);
    }


</style>


<div id="wrapper">

  <div id="svg-container">

    <svg
      id="svg"
      bind:this={svg}
      on:mousedown={mousedown_handler}
      on:mousemove={mousemove_handler}
      on:mouseup={mouseup_handler}
      on:click={click_handler}>

        <defs>
            <radialGradient id="belief_covariance_gradient">
                <stop offset="0.35" stop-color="red" stop-opacity="0.5" />
                <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
            </radialGradient>
            <radialGradient id="gt_cov_gradient">
                <stop offset="0.35" stop-color="blue" stop-opacity="0.5" />
                <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
            </radialGradient>
        </defs>


        {#if mode == "edit"}
            <g class="node_g" id="new_node" cursor="pointer" draggable="true">
            <circle class="var-node" cx={svg_width - 30} cy={30} r={radius}/>
            </g>
            {#if can_open}
                <rect x={svg_width - 90} y={2} width={33} height={46} fill=none/>
                <path transform="translate({svg_width - 90}, 12) scale(0.07) rotate(-20, 0, 0)" stroke="black" fill="black"d="M432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16z"></path>
                <path transform="translate({svg_width - 90}, 12) scale(0.07)"stroke="black" fill="black" d="M32 464a48 48 0 0 0 48 48h288a48 48 0 0 0 48-48V128H32zm272-256a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0z"></path>
            {:else}
                <path transform="translate({svg_width - 90}, 12) scale(0.07)"stroke="black" fill="black" d="M32 464a48 48 0 0 0 48 48h288a48 48 0 0 0 48-48V128H32zm272-256a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0z M432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16z"></path>
            {/if}
        {/if}

        {#if last_node_clicked && !moving_node && mode == "edit"}
            {#if last_node_clicked.type == 'var_node'}
                <line class="edge" x1={last_node_clicked.x} y1={last_node_clicked.y} 
                    x2={current_mouse_location.x} y2={current_mouse_location.y}/>
            {/if}
        {/if}

        {#each factor_nodes as f}
            {#if mode == "edit"}
                <line class="edge" 
                    x1={graph.find_node(f.adj_ids[0]).x} y1={graph.find_node(f.adj_ids[0]).y} 
                    x2={graph.find_node(f.adj_ids[1]).x} y2={graph.find_node(f.adj_ids[1]).y}/>
                <g class="node_g" id={f.id} transform="translate({f.x} {f.y})">
                    <rect class="factor-node" x={-10} y={-10} width={factor_size} height={factor_size}/>
                    <text class="node-text" x={0} y={5}> {f.id}</text>
                </g>
            {:else}
                {#if moving_beliefs.map(x => x.id).includes(f.adj_ids[0]) && moving_beliefs.map(x => x.id).includes(f.adj_ids[1])}
                    <line class="edge" 
                        x1={moving_beliefs.find(x => x.id == f.adj_ids[0]).x0 + (moving_beliefs.find(x => x.id == f.adj_ids[0]).x1-moving_beliefs.find(x => x.id == f.adj_ids[0]).x0) * $move_belief_progress} 
                        y1={moving_beliefs.find(x => x.id == f.adj_ids[0]).y0 + (moving_beliefs.find(x => x.id == f.adj_ids[0]).y1-moving_beliefs.find(x => x.id == f.adj_ids[0]).y0) * $move_belief_progress}
                        x2={moving_beliefs.find(x => x.id == f.adj_ids[1]).x0 + (moving_beliefs.find(x => x.id == f.adj_ids[1]).x1-moving_beliefs.find(x => x.id == f.adj_ids[1]).x0) * $move_belief_progress} 
                        y2={moving_beliefs.find(x => x.id == f.adj_ids[1]).y0 + (moving_beliefs.find(x => x.id == f.adj_ids[1]).y1-moving_beliefs.find(x => x.id == f.adj_ids[1]).y0) * $move_belief_progress}/>                    
                {:else if moving_beliefs.map(x => x.id).includes(f.adj_ids[0])}
                    <line class="edge" 
                        x1={moving_beliefs.find(x => x.id == f.adj_ids[0]).x0 + (moving_beliefs.find(x => x.id == f.adj_ids[0]).x1-moving_beliefs.find(x => x.id == f.adj_ids[0]).x0) * $move_belief_progress} 
                        y1={moving_beliefs.find(x => x.id == f.adj_ids[0]).y0 + (moving_beliefs.find(x => x.id == f.adj_ids[0]).y1-moving_beliefs.find(x => x.id == f.adj_ids[0]).y0) * $move_belief_progress}
                        x2={graph.find_node(f.adj_ids[1]).belief_ellipse.cx} 
                        y2={graph.find_node(f.adj_ids[1]).belief_ellipse.cy}/>
                {:else if moving_beliefs.map(x => x.id).includes(f.adj_ids[1])}
                    <line class="edge" 
                        x2={moving_beliefs.find(x => x.id == f.adj_ids[1]).x0 + (moving_beliefs.find(x => x.id == f.adj_ids[1]).x1-moving_beliefs.find(x => x.id == f.adj_ids[1]).x0) * $move_belief_progress} 
                        y2={moving_beliefs.find(x => x.id == f.adj_ids[1]).y0 + (moving_beliefs.find(x => x.id == f.adj_ids[1]).y1-moving_beliefs.find(x => x.id == f.adj_ids[1]).y0) * $move_belief_progress}
                        x1={graph.find_node(f.adj_ids[0]).belief_ellipse.cx} y1={graph.find_node(f.adj_ids[0]).belief_ellipse.cy}/>
                {:else}
                    <line class="edge" 
                        x1={graph.find_node(f.adj_ids[0]).belief_ellipse.cx} y1={graph.find_node(f.adj_ids[0]).belief_ellipse.cy} 
                        x2={graph.find_node(f.adj_ids[1]).belief_ellipse.cx} y2={graph.find_node(f.adj_ids[1]).belief_ellipse.cy}/>
                {/if}
            {/if}
        {/each}


        {#each var_nodes as n, i}
            {#if mode == "edit"}
                <g class="node_g" id={n.id} cursor="pointer" draggable="true">
                    <circle class="var-node" cx={n.x} cy={n.y} r={radius}/>
                    <text class="node-text" x={n.x} y={n.y + 5}> {n.id} </text>
                </g>
            {:else}

                {#if show_batch}
                    <circle class="gt-mean" cx={n.MAP_ellipse.cx} cy={n.MAP_ellipse.cy} r={mean_radius}/>
                    <ellipse class="gt-cov" fill="url(#gt_cov_gradient)"
                    cx={n.MAP_ellipse.cx} cy={n.MAP_ellipse.cy} rx={n.MAP_ellipse.rx} ry={n.MAP_ellipse.ry}
                    transform="rotate({n.MAP_ellipse.angle}, {n.MAP_ellipse.cx}, {n.MAP_ellipse.cy})"/>
                {/if}

                {#if moving_beliefs.map(x => x.id).includes(n.id)}
                    <circle class="belief-mean" r={mean_radius}
                        cx={moving_beliefs.find(x => x.id == n.id).x0 + (moving_beliefs.find(x => x.id == n.id).x1-moving_beliefs.find(x => x.id == n.id).x0) * $move_belief_progress} 
                        cy={moving_beliefs.find(x => x.id == n.id).y0 + (moving_beliefs.find(x => x.id == n.id).y1-moving_beliefs.find(x => x.id == n.id).y0) * $move_belief_progress}/>
                    <ellipse class="belief-cov" fill="url(#belief_covariance_gradient)"
                        cx={moving_beliefs.find(x => x.id == n.id).x0 + (moving_beliefs.find(x => x.id == n.id).x1-moving_beliefs.find(x => x.id == n.id).x0) * $move_belief_progress} 
                        cy={moving_beliefs.find(x => x.id == n.id).y0 + (moving_beliefs.find(x => x.id == n.id).y1-moving_beliefs.find(x => x.id == n.id).y0) * $move_belief_progress} 
                        rx={moving_beliefs.find(x => x.id == n.id).r0 + (moving_beliefs.find(x => x.id == n.id).r1-moving_beliefs.find(x => x.id == n.id).r0) * $move_belief_progress} 
                        ry={moving_beliefs.find(x => x.id == n.id).r0 + (moving_beliefs.find(x => x.id == n.id).r1-moving_beliefs.find(x => x.id == n.id).r0) * $move_belief_progress}/>
                {:else}
                    <g class="node_g" id={n.id} cursor="pointer" draggable="true">
                        <circle class:belief-mean={highlight_id != n.id} class:highlight-mean={highlight_id == n.id} id={"node_belief_mean_"+n.id} 
                            cx={n.belief_ellipse.cx} cy={n.belief_ellipse.cy} r={mean_radius}/>
                        <ellipse  class="belief-cov" id={"node_belief_cov_"+n.id} 
                            fill="url(#belief_covariance_gradient)"
                            cx={n.belief_ellipse.cx} cy={n.belief_ellipse.cy} rx={n.belief_ellipse.rx} ry={n.belief_ellipse.ry}
                            transform="rotate({n.belief_ellipse.angle}, {n.belief_ellipse.cx}, {n.belief_ellipse.cy})"/>
                    </g>
                {/if}

            {/if}
        {/each}

        {#each message_bubbles as b}
            <circle
                class="mess-bubble" r={5}
                cx={b.x0 + (b.x1 - b.x0) * $bubble_progress}
                cy={b.y0 + (b.y1 - b.y0) * $bubble_progress}
                opacity={1 - 4 * ($bubble_progress - 0.5) * ($bubble_progress - 0.5)} />
        {/each}

        {#if mode == "edit"}
            <g class="node_g" id="trash">
                <rect x={svg_width - 90} y={2} width={33} height={46} opacity=0/>
            </g>
        {/if}

    </svg>
  </div>




  <div id="settings-panel">

    <!-- <div>
      <ButtonGroup options={[{ id: 0, name: "Edit" }, { id: 1, name: "Set init" }, { id: 2, name: "Run GBP" }]} labelTitle="" selected={mode1} on:change={handle_mode_change}/>
    </div> -->


    <div>
      <label class="radio-inline">
        <input type="radio" bind:group={mode} value={"edit"} on:change={handle_mode_change}> Edit 
      </label>
      <i class="mi mi-arrow-right"><span class="u-sr-only">Arrow right</span></i>
      <label class="radio-inline">
        <input type="radio" bind:group={mode} value={"init"} on:change={handle_mode_change}> Set init
      </label>
      <i class="mi mi-arrow-right"><span class="u-sr-only">Arrow right</span></i>
      <label class="radio-inline">
        <input type="radio" bind:group={mode} value={"play"} on:change={handle_mode_change}> Run
      </label>    
    </div>

    <div>
        <button on:click={reset_playground}>
            Reset playground
        </button>

        <button on:click={clear_playground}>
            Clear playground
        </button>  

        <button on:click={grid_playground}>
            Grid
        </button>  
    </div>

    <div>
        <button on:click={randomMessage}>
            Random message
        </button>  
    </div>


    <div id="play-speed">
        <div id="center">
            <button class="mp-button" on:click={oneSyncIter}> 
                1 iter
            </button>
        </div>

        <div id="play-pause">
            {#if passing_message}
                <button class="gbp-button" on:click={toggle_passing_message}>
                    <svg class="icon" id="pause"><use xlink:href="#pauseIcon"></use></svg>
                </button>
            {:else}
                <button class="gbp-button" class:not_pressable={mode != "play"} on:click={toggle_passing_message}>
                    <svg class="icon" id="play"><use xlink:href="#playIcon"></use></svg>
                </button>
            {/if}              
        </div>            

        <div id="speed-slider-container" class="slider-container">
            Speed: <span class="bold-text">{speed_labels[speed+2]}</span><br>
            <input class="full-width-slider" type="range" min="-2" max="2" bind:value={speed} step="1"/>
            <div class="status">
                Iteration {n_iters}  ({iters_per_sec[speed+2]} iters / s) 
            </div>
        </div>  
    </div>


    <!-- <div>
        {#if passing_message}
            <button class="icon-button" style="outline: none;" data-tooltip="Pause GBP" on:click={toggle_passing_message}>
            <svg class="icon" id="pause"><use xlink:href="#pauseIcon"></use></svg>
            </button>
        {:else}
            <button class="icon-button" style="outline: none;" class:not_pressable={mode != "play"} on:click={toggle_passing_message}>
            <svg class="icon" id="play"><use xlink:href="#playIcon"></use></svg>
            </button>
        {/if}

    </div> -->


    <span class="hint bold-text">
        Balance the data and smoothing factors:
    </span>

    <div id="precision-sliders">
        <div class="slider-container">
            Prior std: <br>
            <input class="full-width-slider" type="range" min="{30}" max="{60}" bind:value={prior_std}/>
            <div class="status">
                ({prior_std} units)
            </div>
        </div>  

        <div class="slider-container">
            Measurement std: <br>
            <input class="full-width-slider" type="range" min="{5e-5}" max="{0.0051}" bind:value={meas_params["linear"]["noise_model_std"]} step="5e-5"/>
            <div class="status">
                ({meas_params["linear"]["noise_model_std"]} units)
            </div>
        </div>                  
    </div>


    <div>
        <button on:click={() => { show_batch = !show_batch; }}>
            Toggle GT marginals
        </button>  
    </div>

    <div id="hints-panel">

        <p>
            <b>Hint. </b>
            Build the pose graph by dragging variable nodes from the top right. 
            Factors are created by clicking one after the other on the two variable nodes you want to connect. 
            Drag the variable nodes to set the initial beliefs.
            Double click on a variable node to send messages to adjacent nodes.
        </p>

    </div>


    <!-- <div>
      Difference to MAP: {belief_MAP_diff.toFixed(2)}<br>
      Energy: {belief_MAP_diff.toFixed(2)}<br>
    </div> -->


  </div>




</div>

