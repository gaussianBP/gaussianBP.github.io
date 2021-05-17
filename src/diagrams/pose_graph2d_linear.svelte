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
    let svg_width = 600;
    let svg_height = 600;

    // GBP parameters
    export let prior_std = 100;
    export let meas_params = {
        "linear" : {
            "noise_model_std": 20,
            "noise_std": 2,
        }
    };

    // Local graph variables
    let graph;
    $: var_nodes = [];
    $: factor_nodes = [];
    const damping = 0.7;  // Only for grid
    const dropout = 0.;  // Only for grid

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
    let highlight_id = null;
    $: message_bubbles = [];
    $: moving_beliefs = [];
    const bubble_progress = tweened(0);
    const move_belief_progress = tweened(0);
    const bubble_time = 400;  // ms
    const move_belief_time = 500;
    const highlight_time = 300;

    // UI
    let n_iters = 0; 
    let mode = "edit";
    let lastTime = 0;
    let speed = 0;
    let dist_to_MAP = 0;
    const speed_labels = ["1/4x", "1/2x", "1x", "5x", "10x"];
    const iters_per_sec = [1, 2, 4, 20, 40];
    let sync_on = false;
    let show_batch = true;

    // Visual appearance
    let factor_size = 20;
    let radius = 10;
    let mean_radius = 6;
    let can_open = false;

    // Preset initializations
    const chain_prior = {"0":{"eta":[100,300],"lam":1},"1":{"eta":[0.01980625,0.022881250000000002],"lam":0.0001},"2":{"eta":[0.02830625,0.039581250000000005],"lam":0.0001},"3":{"eta":[0.04020625,0.021181250000000002],"lam":0.0001},"4":{"eta":[0.05270625,0.03848125],"lam":0.0001}};
    const grid_prior = {"0":{"eta":[100,100],"lam":1},"1":{"eta":[0.024606250000000017,0.007181250000000011],"lam":0.0001},"2":{"eta":[0.05340625000000004,0.014781250000000003],"lam":0.0001},"3":{"eta":[0.005006250000000001,0.03498125],"lam":0.0001},"4":{"eta":[0.027306249999999997,0.03518125000000002],"lam":0.0001},"5":{"eta":[0.04500625,0.025081250000000006],"lam":0.0001},"6":{"eta":[0.015206250000000003,0.04338125000000001],"lam":0.0001},"7":{"eta":[0.034306250000000045,0.05538125],"lam":0.0001},"8":{"eta":[0.05020625000000001,0.04408125000000003],"lam":0.0001}};
    const loop_prior = {"0":{"eta":[100,100],"lam":1},"1":{"eta":[0.02500625,0.01588125],"lam":0.0001},"2":{"eta":[0.04320625,0.0069812500000000005],"lam":0.0001},"3":{"eta":[0.05150625,0.024081250000000002],"lam":0.0001},"4":{"eta":[0.044306250000000005,0.04178125],"lam":0.0001},"5":{"eta":[0.03210625,0.054081250000000004],"lam":0.0001},"6":{"eta":[0.01150625,0.04208125],"lam":0.0001},"7":{"eta":[0.00770625,0.02388125],"lam":0.0001}};


    onMount(() => {
        set_playground("linear");
    });

    onInterval(() => {
        update_local_vars()

        if (sync_on) {
            const now = Date.now();
            if ((now - lastTime) > 1000 / iters_per_sec[speed+2]) {
                graph.sync_iter();
                n_iters++;
                lastTime = now;
            }
        }

    }, 1000 / 30);


    $: {
        if (graph) {  // Update prior factors when prior_std is changed
            graph.update_priors(prior_std, true);
            graph.update_ellipses();  
            graph.compute_MAP();
            dist_to_MAP = graph.compare_to_MAP();
        }
    }

    $: {
        if (graph) {  // Update data factors when meas_params is changed
            graph.update_factor_noise_models(meas_params);
            graph.compute_MAP();
            dist_to_MAP = graph.compare_to_MAP();
        }
    }

    // Playground templates -----------------------------------------------------------

    function create_empty_playground() {
        graph = new gbp.FactorGraph();
        graph.add_var_node(svg_width / 2, svg_height / 2, prior_std, 0);
        return graph;
    }

    function create_linear_playground(n_var_nodes = 5) {
        graph = new gbp.FactorGraph();
        const x0 = 100;
        const inc = (svg_width - 2*x0) / (n_var_nodes-1);

        for (let j=0; j < n_var_nodes; j++) {
            graph.add_var_node(x0 + j*inc, svg_height / 2, prior_std);
        }
        for (let j=1; j < n_var_nodes; j++) {
            graph.add_factor_node(j-1, j, "linear", meas_params);
        }
        return graph;
    }

    function create_grid_playground() {
        graph = new gbp.FactorGraph();
        const grid_size = 3;
        const x0 = 100;
        const inc = (svg_width - 2*x0) / (grid_size-1);

        for (var i=0; i<grid_size; i++) {
            for (var j=0; j<grid_size; j++) {
                graph.add_var_node(x0 + j*inc, x0 + i*inc, prior_std, grid_size*i+j);
                if (i!=0 && j!=0) {
                    graph.var_nodes[i*grid_size + j].prior.eta = graph.var_nodes[i*grid_size + j].prior.lam.mmul(new m.Matrix(
                    [[x0 + j*inc], [x0 + i*inc]]));              
                }
            }
        }
        for (var i=0; i<grid_size; i++) {
            for (var j=0; j<grid_size; j++) {
                if (j < 2) {
                    graph.add_factor_node(grid_size*i + j, grid_size*i + j + 1, "linear", meas_params); // factor with node below
                }
                if (i < 2) {
                    graph.add_factor_node(grid_size*i + j, grid_size*i + j + grid_size, "linear", meas_params); // factor with node on rhs
                }
            }
        }
        for (var i=0; i<graph.factor_nodes.length; i++) {
            graph.factor_nodes[i].damping = damping;
            graph.factor_nodes[i].dropout = dropout;
        }
        return graph;
    }

    function create_loop_playground(n_var_nodes = 8) {
        graph = new gbp.FactorGraph();
        const x0 = 100;
        const inc = (svg_width - 2*x0) / 2;
        
        for (var i = 0; i < n_var_nodes; i++) {
            if (i < 3) {
                graph.add_var_node(x0 + i*inc, x0, prior_std);
            } else if (i < 5) {
                graph.add_var_node(x0 + 2*inc, x0 + inc*(i - 2), prior_std);
            } else if (i < 7) {
                graph.add_var_node(x0 + 2*inc - inc*(i - 4), x0 + 2*inc, prior_std);
            } else {
                graph.add_var_node(x0, x0 + inc - inc*(i - 7), prior_std);
            }
        }
        for (var i = 1; i < n_var_nodes; i++) {
            graph.add_factor_node(i-1, i, "linear", meas_params);
        }
        graph.add_factor_node(n_var_nodes-1, 0, "linear", meas_params);
        return graph;
    }

    function set_playground(type="linear") {
        var_nodes = [];
        factor_nodes = [];
        mode = "edit";
        sync_on = false;
        n_iters = 0;

        if (type == "empty") {
            graph = create_empty_playground();
        } else if (type == "grid") {
            graph = create_grid_playground();
        } else if (type == "loop") {
            graph = create_loop_playground();
        } else {  // Default to linear
            graph = create_linear_playground();
        }

        graph.update_beliefs();
        graph.compute_MAP();
        dist_to_MAP = graph.compare_to_MAP();
        update_local_vars();
    }

    // Other functions ------------------------------------------------------

    function update_local_vars() {
        var_nodes = graph.var_nodes;
        factor_nodes = graph.factor_nodes;
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
        n_iters = 0;
        sync_on = false;
    }

    // Animation functions -------------------------------------------------------------

    function highlight_node(id) {
        highlight_id = id;
        setTimeout( () => { highlight_id = null; }, highlight_time);
    }

    function create_message_bubble(id0, id1) {
        const message_bubble = { 
            x: {start: graph.find_node(id0).belief_ellipse.cx, end: graph.find_node(id1).belief_ellipse.cx},
            y: {start: graph.find_node(id0).belief_ellipse.cy, end: graph.find_node(id1).belief_ellipse.cy},
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
                x: {start: node.belief_ellipse.cx, end: mean.get(0,0)},
                y: {start: node.belief_ellipse.cy, end: mean.get(1,0)},
                r: {start: node.belief_ellipse.rx, end: Math.sqrt(values[0][0])}
            }
            moving_beliefs.push(move_belief);
            
            // Moves after message bubble arrives
            move_belief_progress.set(1, {
                delay: bubble_time,
                duration: move_belief_time,
                easing: easing.sineOut,
            });

            setTimeout(() => {
                node.update_ellipse();
                update_local_vars();
                clear_moving_beliefs();
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


  // Mouse handler functions ------------------------------------------------------------

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
                dist_to_MAP = graph.compare_to_MAP();
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
                        graph.add_factor_node(last_node_clicked.id, node_clicked.id, "linear", meas_params);
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
        }
    }

    // Event handlers -----------------------------------------------------------

    function handle_mode_change(e) {
        clear_previous_message();
        graph.update_beliefs();

        if (mode == "edit") {
            graph.priors_to_gt();  // Reset all beliefs to be at priors and zero all messages
        }
        if (mode != "edit") {
            graph.compute_MAP();
            dist_to_MAP = graph.compare_to_MAP();
        }
        node_clicked = null;
        last_node_clicked = null;
        sync_on = false;
        n_iters = 0;
    }

    function toggleSyncGBP(e) {
        if (mode == "play") {
            sync_on = !sync_on;
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

            // Animations
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

            // Animations
            for (var i = 0; i < graph.factor_nodes.length; i++) {
                create_message_bubble(graph.factor_nodes[i].adj_ids[0], graph.factor_nodes[i].adj_ids[1]);
                create_message_bubble(graph.factor_nodes[i].adj_ids[1], graph.factor_nodes[i].adj_ids[0]);
            }
            for (var i = 0; i < graph.var_nodes.length; i++) {
                move_belief(graph.var_nodes[i].id);
            }
        }
    }

    function saveGraph(e) {
        const priors = {};

        for (var i = 0; i < graph.var_nodes.length; i++) {
            const n = graph.var_nodes[i];
            priors[n.id] = {
                eta: [n.prior.eta.get(0,0), n.prior.eta.get(1,0)],
                lam: n.prior.lam.get(0,0)
            };
        }
        console.log(JSON.stringify(priors));
    }

    function load_priors(type, priors) {
        set_playground(type);
        for (var i = 0; i < graph.var_nodes.length; i++) {
            const n = graph.var_nodes[i];
            n.prior.eta = new m.Matrix([[priors[n.id].eta[0]], [priors[n.id].eta[1]]]);
            n.prior.lam = new m.Matrix([[priors[n.id].lam, 0.], [0., priors[n.id].lam]]);
        }
        graph.update_beliefs()
    }


    // Utility functions --------------------------------------------------------

    function max(list) {
        return Math.max(...list.map((sub_list) => Math.max(...sub_list)));
    }

    function min(list) {
        return Math.min(...list.map((sub_list) => Math.min(...sub_list)));
    }

    function get_factor_loc(f) {
        // Factor is located at average position of variable nodes
        const x = (graph.find_node(f.adj_ids[0]).x + graph.find_node(f.adj_ids[1]).x) / 2;
        const y = (graph.find_node(f.adj_ids[0]).y + graph.find_node(f.adj_ids[1]).y) / 2;
        return [x, y];
    }

    function linear_progress(x, p) {
        return x.start + (x.end - x.start)*p;
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

    .map-diff {
        stroke: green;
        opacity: 0.5;
        stroke-width: 1;
        stroke-dasharray: 6, 3;
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
                <g class="node_g" id={f.id} transform="translate({get_factor_loc(f)[0]} {get_factor_loc(f)[1]})">
                    <rect class="factor-node" x={-10} y={-10} width={factor_size} height={factor_size}/>
                    <text class="node-text" x={0} y={5}> {f.id}</text>
                </g>
            {:else}
                {#if moving_beliefs.map(x => x.id).includes(f.adj_ids[0]) && moving_beliefs.map(x => x.id).includes(f.adj_ids[1])}
                    <line class="edge" 
                        x1={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[0]).x, $move_belief_progress)} 
                        y1={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[0]).y, $move_belief_progress)}
                        x2={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[1]).x, $move_belief_progress)} 
                        y2={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[1]).y, $move_belief_progress)}/>                    
                {:else if moving_beliefs.map(x => x.id).includes(f.adj_ids[0])}
                    <line class="edge" 
                        x1={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[0]).x, $move_belief_progress)} 
                        y1={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[0]).y, $move_belief_progress)}
                        x2={graph.find_node(f.adj_ids[1]).belief_ellipse.cx} 
                        y2={graph.find_node(f.adj_ids[1]).belief_ellipse.cy}/>
                {:else if moving_beliefs.map(x => x.id).includes(f.adj_ids[1])}
                    <line class="edge" 
                        x2={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[1]).x, $move_belief_progress)} 
                        y2={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[1]).y, $move_belief_progress)}
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
                    {#if moving_beliefs.map(x => x.id).includes(n.id)}
                        <line class="map-diff" x1={n.MAP_ellipse.cx} y1={n.MAP_ellipse.cy} 
                        x2={linear_progress(moving_beliefs.find(x => x.id == n.id).x, $move_belief_progress)} 
                        y2={linear_progress(moving_beliefs.find(x => x.id == n.id).y, $move_belief_progress)}/>
                    {:else}
                        <line class="map-diff" x1={n.MAP_ellipse.cx} y1={n.MAP_ellipse.cy} x2={n.belief_ellipse.cx} y2={n.belief_ellipse.cy}/>
                    {/if}
                {/if}

                {#if moving_beliefs.map(x => x.id).includes(n.id)}
                    <circle class="belief-mean" r={mean_radius}
                        cx={linear_progress(moving_beliefs.find(x => x.id == n.id).x, $move_belief_progress)}
                        cy={linear_progress(moving_beliefs.find(x => x.id == n.id).y, $move_belief_progress)}/>
                    <ellipse class="belief-cov" fill="url(#belief_covariance_gradient)"
                        cx={linear_progress(moving_beliefs.find(x => x.id == n.id).x, $move_belief_progress)} 
                        cy={linear_progress(moving_beliefs.find(x => x.id == n.id).y, $move_belief_progress)} 
                        rx={linear_progress(moving_beliefs.find(x => x.id == n.id).r, $move_belief_progress)} 
                        ry={linear_progress(moving_beliefs.find(x => x.id == n.id).r, $move_belief_progress)}/>
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
                cx={linear_progress(b.x, $bubble_progress)}
                cy={linear_progress(b.y, $bubble_progress)}
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

    <span class="hint bold-text">
        Preconfigured graphs:
    </span>

    <div>
        <button on:click={() => set_playground("linear")}>
            Reset playground
        </button>
        <button on:click={() => set_playground("empty")}>
            Clear playground
        </button>  
        <button on:click={() => set_playground("grid")}>
            Grid
        </button>
        <button on:click={() => set_playground("loop")}>
            Loop
        </button>    
    </div>


    <span class="hint bold-text">
        Send messages through the graph:
    </span>

    <div>
        <button on:click={randomMessage}>
            Random message
        </button>  
    </div>

    <span class="hint bold-text">
        Synchronous message passing:
    </span>

    <div id="play-speed">
        <div id="center">
            <button class="mp-button" on:click={oneSyncIter}> 
                1 iter
            </button>
        </div>

        <div id="play-pause">
            {#if sync_on}
                <button class="gbp-button" on:click={toggleSyncGBP}>
                    <svg class="icon" id="pause"><use xlink:href="#pauseIcon"></use></svg>
                </button>
            {:else}
                <button class="gbp-button" class:not_pressable={mode != "play"} on:click={toggleSyncGBP}>
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

    <span class="hint bold-text">
        Balance the data and smoothing factors:
    </span>

    <div id="precision-sliders">
        <div class="slider-container">
            Prior std: <br>
            <input class="full-width-slider" type="range" min="{30}" max="{200}" bind:value={prior_std}/>
            <div class="status">
                ({prior_std} units)
            </div>
        </div>  

        <div class="slider-container">
            Measurement std: <br>
            <input class="full-width-slider" type="range" min="{5}" max="{60}" bind:value={meas_params["linear"]["noise_model_std"]}/>
            <div class="status">
                ({meas_params["linear"]["noise_model_std"]} units)
            </div>
        </div>                  
    </div>


    <div>
        <button on:click={() => { show_batch = !show_batch; }}>
            Toggle true marginals
        </button>  
        <button on:click={saveGraph}>
            Save graph
        </button>  
        <button on:click={() => load_priors("grid", grid_prior)}>
            Load graph
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

