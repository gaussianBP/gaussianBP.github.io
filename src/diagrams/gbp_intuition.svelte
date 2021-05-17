<script>
    import * as grid from "../gbp/grid.js";
    let t = 0;
    let [means, stds, direct_mu, direct_stds] = grid.gen_beliefs();
    // ticker
    let interval = 282; // svg units for one interval
    let start = 24.5; // svg units for one interval
    // Plotting marginals
    let scale = 0.3;
    let xstart = 500;
    let ystart = -10;
    const frac_std = 0.7;


    import * as m from 'ml-matrix';
    import { onMount } from "svelte";
    import { onInterval } from "../utils/util.js";
    import { tweened } from "svelte/motion";
    import { fade } from "svelte/transition";
    import * as easing from "svelte/easing";
    import anime from "animejs";
    import MultiButtonGroup from '../utils/MultiButtonGroup.svelte'
    import * as gbp from "../gbp/gbp_playground.js";


    let value = 2;

    // svg
    let svg_width = 600;
    let svg_height = 600;

    // GBP parameters
    export let prior_std = 100;
    export let meas_params = {
        "linear" : {
            "noise_model_std": 50,
            "noise_std": 0,
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
    const move_belief_time = 350;
    const highlight_time = 250;

    // UI
    let n_iters = 0; 
    const mode = "play";
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
    let mean_radius = 8;
    let can_open = false;

    // Preset initializations
    const chain_prior = {"0":{"eta":[100,300],"lam":1},"1":{"eta":[0.01980625,0.022881250000000002],"lam":0.0001},"2":{"eta":[0.02830625,0.039581250000000005],"lam":0.0001},"3":{"eta":[0.04020625,0.021181250000000002],"lam":0.0001},"4":{"eta":[0.05270625,0.03848125],"lam":0.0001}};
    const grid_prior = {"0":{"eta":[100,100],"lam":1},"1":{"eta":[0.024606250000000017,0.007181250000000011],"lam":0.0001},"2":{"eta":[0.05340625000000004,0.014781250000000003],"lam":0.0001},"3":{"eta":[0.005006250000000001,0.03498125],"lam":0.0001},"4":{"eta":[0.027306249999999997,0.03518125000000002],"lam":0.0001},"5":{"eta":[0.04500625,0.025081250000000006],"lam":0.0001},"6":{"eta":[0.015206250000000003,0.04338125000000001],"lam":0.0001},"7":{"eta":[0.034306250000000045,0.05538125],"lam":0.0001},"8":{"eta":[0.05020625000000001,0.04408125000000003],"lam":0.0001}};
    const loop_prior = {"0":{"eta":[100,100],"lam":1},"1":{"eta":[0.02500625,0.01588125],"lam":0.0001},"2":{"eta":[0.04320625,0.0069812500000000005],"lam":0.0001},"3":{"eta":[0.05150625,0.024081250000000002],"lam":0.0001},"4":{"eta":[0.044306250000000005,0.04178125],"lam":0.0001},"5":{"eta":[0.03210625,0.054081250000000004],"lam":0.0001},"6":{"eta":[0.01150625,0.04208125],"lam":0.0001},"7":{"eta":[0.00770625,0.02388125],"lam":0.0001}};


    onMount(() => {
        load_priors("grid", grid_prior);
    });

    onInterval(() => {
        update_local_vars();

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

    function update_local_vars() {
        var_nodes = graph.var_nodes;
        factor_nodes = graph.factor_nodes;
        dist_to_MAP = graph.compare_to_MAP();
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

    // Message passing functions ------------------------------------------------------

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
        graph.update_beliefs();
    }

    function handleChangeGraph(e) {
        value = e.detail.value;
        reset();
    }

    function reset(e) {
        if (value == 0) { load_priors("linear", chain_prior); }
        else if (value == 1) { load_priors("loop", loop_prior); }
        else if (value == 2) { load_priors("grid", grid_prior); }
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
    #iteration-slider {
        width: 100%;
    }

    #time-text {
        font-size: 25px;
    }

    #ticker {
        fill: #FF8A00; 
        stroke: none; 
        stroke-width: 0.7;
    }

    .no-fill {
        fill: white;
    }

    .belief-mean {
        fill: #0095DD;
    }

    .belief-std {
        stroke: #0095DD;
        stroke-opacity: 0.75;
    }

    .marg-mean {
        fill: var(--green);
    }

    .marg-std {
        stroke: var(--green);
        stroke-opacity: 1.0;
        stroke-width: 1.5;
    }

    .sec-container {
        background-color: var(--gray-bg);
        border: 1px solid orange;
        border-radius: var(--border-radius);
        /* border-bottom: 1px solid hsla(0, 0%, 0%, 0.1); */
        padding: 1em 1.5em;
        margin-bottom: 1em;
    }

    #part2 {
        display: grid;
        grid-template-rows: auto auto auto; 
    }

    #svg {
        width: 100%;
        height: auto;
        /* background-color: #FCF7DE; */
        /* border: 1px solid var(--gray); */
    }

    #wrapper {
        display: grid;
        margin-bottom: 0.5rem;
        min-height: 210px;
    }

    .edge {
        stroke:black;
        stroke-width: 3; 
        stroke-opacity: 0.6;
    }

    .belief-mean {
        fill: #0095DD;
    }
    .belief-cov {
        stroke: #0095DD;
        stroke-opacity: 0.75;
        stroke-width: 1.5;
    }
    .gt-mean {
        fill: var(--green);
    }
    .gt-cov {
        stroke: var(--green);
        stroke-opacity: 0.5;
        fill-opacity: 0;
        stroke-width: 1.5;
    }

    .map-diff {
        stroke: var(--green);
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
      width: 200px;
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

    #graph-panel {
        display: flex;
        justify-content: center;
        align-items: center;
        /* display: grid; */
        /* grid-template-columns: 1fr 3fr 1fr; */
    }

    .central {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .mess-bubble {
        stroke: var(--red);
        fill: var(--red);
    }

    #reset-svg {
        width: 42px; 
        height: 42px;
        margin-right: 20px;
    }

    .clickable {
        cursor: pointer;
    }

</style>



<figure class="subgrid" id="figure">

    <div id="wrapper" class="interactive-container">

        <span style="color: orange;">
            <span style="font-weight: bold;">Part 1:</span> Algorithm level operation    
        </span>

        <div class="sec-container">
        
            <input id="iteration-slider" type="range" min="0" max="10" bind:value={t} step="0.01"/>

            <svg width="682" height="199" viewBox="0 -4 682 195" fill="none" xmlns="http://www.w3.org/2000/svg">

                <g id="graph">
                    <line id="Line 1" x1="118" y1="156.5" x2="213" y2="156.5" stroke="black"/>
                    <circle class:no-fill={t%1 < 0.66} id="Ellipse 5" cx="104" cy="156" r="14.5" fill="#EC5147" stroke="#FF0000"/>
                    <path id="Rectangle 5" d="M213.5 145.5H235.5V167.5H213.5V145.5Z" stroke="black"/>
                    <line id="Line 2" x1="235" y1="156.5" x2="286" y2="156.5" stroke="black"/>
                    <line id="Line 3" x1="38" y1="156.5" x2="89" y2="156.5" stroke="black"/>
                </g>


                <g id="timeline">
                    <g id="Rectangle 6">
                    <path d="M118 60H212V74H118V60Z" fill="#00AACF"/>
                    <path d="M118 60H212V74H118V60Z" fill="#00AACF"/>
                    <path d="M118 60H212V74H118V60Z" fill="#00AACF"/>
                    <path d="M118 60H212V74H118V60Z" fill="#00AACF"/>
                    </g>
                    <g id="Rectangle 7">
                    <path d="M24 60H118V74H24V60Z" fill="#00A743"/>
                    <path d="M24 60H118V74H24V60Z" fill="#00A743"/>
                    <path d="M24 60H118V74H24V60Z" fill="#00A743"/>
                    <path d="M24 60H118V74H24V60Z" fill="#00A743"/>
                    </g>
                    <g id="Rectangle 8">
                    <path d="M212 60H306V74H212V60Z" fill="#EC5147"/>
                    <path d="M212 60H306V74H212V60Z" fill="#EC5147"/>
                    <path d="M212 60H306V74H212V60Z" fill="#EC5147"/>
                    <path d="M212 60H306V74H212V60Z" fill="#EC5147"/>
                    </g>
                    <path id="Arrow 1" d="M328.707 74.7071C329.098 74.3166 329.098 73.6834 328.707 73.2929L322.343 66.9289C321.953 66.5384 321.319 66.5384 320.929 66.9289C320.538 67.3195 320.538 67.9526 320.929 68.3431L326.586 74L320.929 79.6569C320.538 80.0474 320.538 80.6805 320.929 81.0711C321.319 81.4616 321.953 81.4616 322.343 81.0711L328.707 74.7071ZM10 75L328 75V73L10 73V75Z" fill="black"/>
                    <line id="Line 4" x1="24.5" y1="27" x2="24.5" y2="81" stroke="black"/>
                    <line id="Line 5" x1="306.5" y1="55" x2="306.5" y2="81" stroke="black"/>
                    <polygon id="ticker" points="{start + (t%1)*interval},75.9074 {start + 8 + (t%1)*interval},96.4 {start - 8 + (t%1)*interval},96.4"/>
                </g>

                <g id="timeline">

                    <path id="Arrow 1" d="M328.707 74.7071C329.098 74.3166 329.098 73.6834 328.707 73.2929L322.343 66.9289C321.953 66.5384 321.319 66.5384 320.929 66.9289C320.538 67.3195 320.538 67.9526 320.929 68.3431L326.586 74L320.929 79.6569C320.538 80.0474 320.538 80.6805 320.929 81.0711C321.319 81.4616 321.953 81.4616 322.343 81.0711L328.707 74.7071ZM10 75L328 75V73L10 73V75Z" fill="black"/>
                    <line id="Line 4" x1="24.5" y1="27" x2="24.5" y2="81" stroke="black"/>
                    <line id="Line 5" x1="306.5" y1="55" x2="306.5" y2="81" stroke="black"/>
                    <polygon id="ticker" points="{start + (t%1)*interval},75.9074 {start + 8 + (t%1)*interval},96.4 {start - 8 + (t%1)*interval},96.4"/>
                </g>

                <g id="text">
                    <path id="Factor to variable MP" d="M139.391 32.702V37H138.103V26.976H143.955V28.208H139.391V31.498H143.507V32.702H139.391ZM145.858 34.9C145.858 35.236 145.998 35.516 146.278 35.74C146.567 35.964 146.903 36.076 147.286 36.076C147.827 36.076 148.308 35.8753 148.728 35.474C149.157 35.0727 149.372 34.6013 149.372 34.06C148.97 33.7427 148.41 33.584 147.692 33.584C147.169 33.584 146.73 33.71 146.376 33.962C146.03 34.214 145.858 34.5267 145.858 34.9ZM147.524 29.916C148.476 29.916 149.227 30.1727 149.778 30.686C150.328 31.19 150.604 31.8853 150.604 32.772V37H149.372V36.048H149.316C148.784 36.832 148.074 37.224 147.188 37.224C146.432 37.224 145.797 37 145.284 36.552C144.78 36.104 144.528 35.544 144.528 34.872C144.528 34.1627 144.794 33.598 145.326 33.178C145.867 32.758 146.586 32.548 147.482 32.548C148.247 32.548 148.877 32.688 149.372 32.968V32.674C149.372 32.226 149.194 31.848 148.84 31.54C148.485 31.2227 148.07 31.064 147.594 31.064C146.875 31.064 146.306 31.3673 145.886 31.974L144.752 31.26C145.377 30.364 146.301 29.916 147.524 29.916ZM155.124 37.224C154.107 37.224 153.262 36.8787 152.59 36.188C151.927 35.4787 151.596 34.606 151.596 33.57C151.596 32.5153 151.927 31.6427 152.59 30.952C153.262 30.2613 154.107 29.916 155.124 29.916C155.824 29.916 156.435 30.0933 156.958 30.448C157.481 30.7933 157.873 31.274 158.134 31.89L156.958 32.38C156.594 31.5213 155.955 31.092 155.04 31.092C154.452 31.092 153.943 31.33 153.514 31.806C153.094 32.282 152.884 32.87 152.884 33.57C152.884 34.27 153.094 34.858 153.514 35.334C153.943 35.81 154.452 36.048 155.04 36.048C155.983 36.048 156.645 35.6187 157.028 34.76L158.176 35.25C157.924 35.866 157.527 36.3513 156.986 36.706C156.454 37.0513 155.833 37.224 155.124 37.224ZM161.95 37.112C161.39 37.112 160.924 36.9393 160.55 36.594C160.186 36.2487 160 35.768 159.99 35.152V31.316H158.786V30.14H159.99V28.04H161.278V30.14H162.958V31.316H161.278V34.732C161.278 35.1893 161.367 35.502 161.544 35.67C161.722 35.8287 161.922 35.908 162.146 35.908C162.249 35.908 162.347 35.8987 162.44 35.88C162.543 35.852 162.636 35.8193 162.72 35.782L163.126 36.93C162.79 37.0513 162.398 37.112 161.95 37.112ZM163.723 33.57C163.723 32.5153 164.054 31.6427 164.717 30.952C165.389 30.2613 166.234 29.916 167.251 29.916C168.268 29.916 169.108 30.2613 169.771 30.952C170.443 31.6427 170.779 32.5153 170.779 33.57C170.779 34.634 170.443 35.5067 169.771 36.188C169.108 36.8787 168.268 37.224 167.251 37.224C166.234 37.224 165.389 36.8787 164.717 36.188C164.054 35.4973 163.723 34.6247 163.723 33.57ZM165.011 33.57C165.011 34.3073 165.226 34.9047 165.655 35.362C166.084 35.8193 166.616 36.048 167.251 36.048C167.886 36.048 168.418 35.8193 168.847 35.362C169.276 34.9047 169.491 34.3073 169.491 33.57C169.491 32.842 169.276 32.2493 168.847 31.792C168.408 31.3253 167.876 31.092 167.251 31.092C166.626 31.092 166.094 31.3253 165.655 31.792C165.226 32.2493 165.011 32.842 165.011 33.57ZM173.1 37H171.812V30.14H173.044V31.26H173.1C173.231 30.896 173.497 30.588 173.898 30.336C174.309 30.0747 174.71 29.944 175.102 29.944C175.476 29.944 175.793 30 176.054 30.112L175.662 31.358C175.504 31.2927 175.252 31.26 174.906 31.26C174.421 31.26 173.996 31.456 173.632 31.848C173.278 32.24 173.1 32.6973 173.1 33.22V37ZM182.69 37.112C182.13 37.112 181.664 36.9393 181.29 36.594C180.926 36.2487 180.74 35.768 180.73 35.152V31.316H179.526V30.14H180.73V28.04H182.018V30.14H183.698V31.316H182.018V34.732C182.018 35.1893 182.107 35.502 182.284 35.67C182.462 35.8287 182.662 35.908 182.886 35.908C182.989 35.908 183.087 35.8987 183.18 35.88C183.283 35.852 183.376 35.8193 183.46 35.782L183.866 36.93C183.53 37.0513 183.138 37.112 182.69 37.112ZM184.463 33.57C184.463 32.5153 184.795 31.6427 185.457 30.952C186.129 30.2613 186.974 29.916 187.991 29.916C189.009 29.916 189.849 30.2613 190.511 30.952C191.183 31.6427 191.519 32.5153 191.519 33.57C191.519 34.634 191.183 35.5067 190.511 36.188C189.849 36.8787 189.009 37.224 187.991 37.224C186.974 37.224 186.129 36.8787 185.457 36.188C184.795 35.4973 184.463 34.6247 184.463 33.57ZM185.751 33.57C185.751 34.3073 185.966 34.9047 186.395 35.362C186.825 35.8193 187.357 36.048 187.991 36.048C188.626 36.048 189.158 35.8193 189.587 35.362C190.017 34.9047 190.231 34.3073 190.231 33.57C190.231 32.842 190.017 32.2493 189.587 31.792C189.149 31.3253 188.617 31.092 187.991 31.092C187.366 31.092 186.834 31.3253 186.395 31.792C185.966 32.2493 185.751 32.842 185.751 33.57ZM133.568 54H132.28L129.508 47.14H130.908L132.924 52.46H132.952L134.996 47.14H136.368L133.568 54ZM138.01 51.9C138.01 52.236 138.15 52.516 138.43 52.74C138.719 52.964 139.055 53.076 139.438 53.076C139.979 53.076 140.46 52.8753 140.88 52.474C141.309 52.0727 141.524 51.6013 141.524 51.06C141.123 50.7427 140.563 50.584 139.844 50.584C139.321 50.584 138.883 50.71 138.528 50.962C138.183 51.214 138.01 51.5267 138.01 51.9ZM139.676 46.916C140.628 46.916 141.379 47.1727 141.93 47.686C142.481 48.19 142.756 48.8853 142.756 49.772V54H141.524V53.048H141.468C140.936 53.832 140.227 54.224 139.34 54.224C138.584 54.224 137.949 54 137.436 53.552C136.932 53.104 136.68 52.544 136.68 51.872C136.68 51.1627 136.946 50.598 137.478 50.178C138.019 49.758 138.738 49.548 139.634 49.548C140.399 49.548 141.029 49.688 141.524 49.968V49.674C141.524 49.226 141.347 48.848 140.992 48.54C140.637 48.2227 140.222 48.064 139.746 48.064C139.027 48.064 138.458 48.3673 138.038 48.974L136.904 48.26C137.529 47.364 138.453 46.916 139.676 46.916ZM145.497 54H144.209V47.14H145.441V48.26H145.497C145.627 47.896 145.893 47.588 146.295 47.336C146.705 47.0747 147.107 46.944 147.499 46.944C147.872 46.944 148.189 47 148.451 47.112L148.059 48.358C147.9 48.2927 147.648 48.26 147.303 48.26C146.817 48.26 146.393 48.456 146.029 48.848C145.674 49.24 145.497 49.6973 145.497 50.22V54ZM150.961 44.774C150.961 45.026 150.872 45.2407 150.695 45.418C150.517 45.5953 150.303 45.684 150.051 45.684C149.799 45.684 149.584 45.5953 149.407 45.418C149.229 45.2407 149.141 45.026 149.141 44.774C149.141 44.522 149.229 44.3073 149.407 44.13C149.584 43.9527 149.799 43.864 150.051 43.864C150.303 43.864 150.517 43.9527 150.695 44.13C150.872 44.3073 150.961 44.522 150.961 44.774ZM150.695 47.14V54H149.407V47.14H150.695ZM153.241 51.9C153.241 52.236 153.381 52.516 153.661 52.74C153.95 52.964 154.286 53.076 154.669 53.076C155.21 53.076 155.691 52.8753 156.111 52.474C156.54 52.0727 156.755 51.6013 156.755 51.06C156.353 50.7427 155.793 50.584 155.075 50.584C154.552 50.584 154.113 50.71 153.759 50.962C153.413 51.214 153.241 51.5267 153.241 51.9ZM154.907 46.916C155.859 46.916 156.61 47.1727 157.161 47.686C157.711 48.19 157.987 48.8853 157.987 49.772V54H156.755V53.048H156.699C156.167 53.832 155.457 54.224 154.571 54.224C153.815 54.224 153.18 54 152.667 53.552C152.163 53.104 151.911 52.544 151.911 51.872C151.911 51.1627 152.177 50.598 152.709 50.178C153.25 49.758 153.969 49.548 154.865 49.548C155.63 49.548 156.26 49.688 156.755 49.968V49.674C156.755 49.226 156.577 48.848 156.223 48.54C155.868 48.2227 155.453 48.064 154.977 48.064C154.258 48.064 153.689 48.3673 153.269 48.974L152.135 48.26C152.76 47.364 153.684 46.916 154.907 46.916ZM163.065 54.224C162.561 54.224 162.099 54.1167 161.679 53.902C161.269 53.6873 160.951 53.4027 160.727 53.048H160.671V54H159.439V43.976H160.727V47.14L160.671 48.092H160.727C160.951 47.7373 161.269 47.4527 161.679 47.238C162.099 47.0233 162.561 46.916 163.065 46.916C163.971 46.916 164.736 47.2707 165.361 47.98C166.005 48.6987 166.327 49.562 166.327 50.57C166.327 51.5873 166.005 52.4507 165.361 53.16C164.736 53.8693 163.971 54.224 163.065 54.224ZM162.855 53.048C163.471 53.048 163.989 52.8147 164.409 52.348C164.829 51.8907 165.039 51.298 165.039 50.57C165.039 49.8513 164.829 49.2587 164.409 48.792C163.989 48.3253 163.471 48.092 162.855 48.092C162.23 48.092 161.707 48.3253 161.287 48.792C160.877 49.2587 160.671 49.8513 160.671 50.57C160.671 51.298 160.877 51.8953 161.287 52.362C161.707 52.8193 162.23 53.048 162.855 53.048ZM168.725 43.976V54H167.437V43.976H168.725ZM173.306 54.224C172.298 54.224 171.468 53.8787 170.814 53.188C170.161 52.4973 169.834 51.6247 169.834 50.57C169.834 49.5247 170.152 48.6567 170.786 47.966C171.421 47.266 172.233 46.916 173.222 46.916C174.24 46.916 175.047 47.2473 175.644 47.91C176.251 48.5633 176.554 49.4827 176.554 50.668L176.54 50.808H171.15C171.169 51.48 171.393 52.0213 171.822 52.432C172.252 52.8427 172.765 53.048 173.362 53.048C174.184 53.048 174.828 52.6373 175.294 51.816L176.442 52.376C176.134 52.9547 175.705 53.4073 175.154 53.734C174.613 54.0607 173.997 54.224 173.306 54.224ZM171.248 49.744H175.182C175.145 49.268 174.949 48.876 174.594 48.568C174.249 48.2507 173.782 48.092 173.194 48.092C172.709 48.092 172.289 48.2413 171.934 48.54C171.589 48.8387 171.36 49.24 171.248 49.744ZM182.32 54H181.032V43.976H182.32L185.806 50.08H185.862L189.348 43.976H190.636V54H189.348V48.05L189.404 46.37H189.348L186.212 51.872H185.456L182.32 46.37H182.264L182.32 48.05V54ZM193.942 49.94V54H192.654V43.976H196.07C196.938 43.976 197.675 44.2653 198.282 44.844C198.898 45.4227 199.206 46.1273 199.206 46.958C199.206 47.8073 198.898 48.5167 198.282 49.086C197.684 49.6553 196.947 49.94 196.07 49.94H193.942ZM193.942 45.208V48.708H196.098C196.611 48.708 197.036 48.5353 197.372 48.19C197.717 47.8447 197.89 47.434 197.89 46.958C197.89 46.4913 197.717 46.0853 197.372 45.74C197.036 45.3853 196.611 45.208 196.098 45.208H193.942Z" fill="#00AACF"/>
                <path id="Variable to factor MP" d="M44.2402 37H42.8962L39.3682 26.976H40.7962L43.5402 35.11H43.5962L46.4522 26.976H47.8802L44.2402 37ZM49.0706 34.9C49.0706 35.236 49.2106 35.516 49.4906 35.74C49.78 35.964 50.116 36.076 50.4986 36.076C51.04 36.076 51.5206 35.8753 51.9406 35.474C52.37 35.0727 52.5846 34.6013 52.5846 34.06C52.1833 33.7427 51.6233 33.584 50.9046 33.584C50.382 33.584 49.9433 33.71 49.5886 33.962C49.2433 34.214 49.0706 34.5267 49.0706 34.9ZM50.7366 29.916C51.6886 29.916 52.44 30.1727 52.9906 30.686C53.5413 31.19 53.8166 31.8853 53.8166 32.772V37H52.5846V36.048H52.5286C51.9966 36.832 51.2873 37.224 50.4006 37.224C49.6446 37.224 49.01 37 48.4966 36.552C47.9926 36.104 47.7406 35.544 47.7406 34.872C47.7406 34.1627 48.0066 33.598 48.5386 33.178C49.08 32.758 49.7986 32.548 50.6946 32.548C51.46 32.548 52.09 32.688 52.5846 32.968V32.674C52.5846 32.226 52.4073 31.848 52.0526 31.54C51.698 31.2227 51.2826 31.064 50.8066 31.064C50.088 31.064 49.5186 31.3673 49.0986 31.974L47.9646 31.26C48.59 30.364 49.514 29.916 50.7366 29.916ZM56.5574 37H55.2694V30.14H56.5014V31.26H56.5574C56.688 30.896 56.954 30.588 57.3554 30.336C57.766 30.0747 58.1674 29.944 58.5594 29.944C58.9327 29.944 59.25 30 59.5114 30.112L59.1194 31.358C58.9607 31.2927 58.7087 31.26 58.3634 31.26C57.878 31.26 57.4534 31.456 57.0894 31.848C56.7347 32.24 56.5574 32.6973 56.5574 33.22V37ZM62.0213 27.774C62.0213 28.026 61.9326 28.2407 61.7553 28.418C61.578 28.5953 61.3633 28.684 61.1113 28.684C60.8593 28.684 60.6446 28.5953 60.4673 28.418C60.29 28.2407 60.2013 28.026 60.2013 27.774C60.2013 27.522 60.29 27.3073 60.4673 27.13C60.6446 26.9527 60.8593 26.864 61.1113 26.864C61.3633 26.864 61.578 26.9527 61.7553 27.13C61.9326 27.3073 62.0213 27.522 62.0213 27.774ZM61.7553 30.14V37H60.4673V30.14H61.7553ZM64.3011 34.9C64.3011 35.236 64.4411 35.516 64.7211 35.74C65.0104 35.964 65.3464 36.076 65.7291 36.076C66.2704 36.076 66.7511 35.8753 67.1711 35.474C67.6004 35.0727 67.8151 34.6013 67.8151 34.06C67.4138 33.7427 66.8538 33.584 66.1351 33.584C65.6124 33.584 65.1738 33.71 64.8191 33.962C64.4738 34.214 64.3011 34.5267 64.3011 34.9ZM65.9671 29.916C66.9191 29.916 67.6704 30.1727 68.2211 30.686C68.7718 31.19 69.0471 31.8853 69.0471 32.772V37H67.8151V36.048H67.7591C67.2271 36.832 66.5178 37.224 65.6311 37.224C64.8751 37.224 64.2404 37 63.7271 36.552C63.2231 36.104 62.9711 35.544 62.9711 34.872C62.9711 34.1627 63.2371 33.598 63.7691 33.178C64.3104 32.758 65.0291 32.548 65.9251 32.548C66.6904 32.548 67.3204 32.688 67.8151 32.968V32.674C67.8151 32.226 67.6378 31.848 67.2831 31.54C66.9284 31.2227 66.5131 31.064 66.0371 31.064C65.3184 31.064 64.7491 31.3673 64.3291 31.974L63.1951 31.26C63.8204 30.364 64.7444 29.916 65.9671 29.916ZM74.1258 37.224C73.6218 37.224 73.1598 37.1167 72.7398 36.902C72.3292 36.6873 72.0118 36.4027 71.7878 36.048H71.7318V37H70.4998V26.976H71.7878V30.14L71.7318 31.092H71.7878C72.0118 30.7373 72.3292 30.4527 72.7398 30.238C73.1598 30.0233 73.6218 29.916 74.1258 29.916C75.0312 29.916 75.7965 30.2707 76.4218 30.98C77.0658 31.6987 77.3878 32.562 77.3878 33.57C77.3878 34.5873 77.0658 35.4507 76.4218 36.16C75.7965 36.8693 75.0312 37.224 74.1258 37.224ZM73.9158 36.048C74.5318 36.048 75.0498 35.8147 75.4698 35.348C75.8898 34.8907 76.0998 34.298 76.0998 33.57C76.0998 32.8513 75.8898 32.2587 75.4698 31.792C75.0498 31.3253 74.5318 31.092 73.9158 31.092C73.2905 31.092 72.7678 31.3253 72.3478 31.792C71.9372 32.2587 71.7318 32.8513 71.7318 33.57C71.7318 34.298 71.9372 34.8953 72.3478 35.362C72.7678 35.8193 73.2905 36.048 73.9158 36.048ZM79.7859 26.976V37H78.4979V26.976H79.7859ZM84.3669 37.224C83.3589 37.224 82.5283 36.8787 81.8749 36.188C81.2216 35.4973 80.8949 34.6247 80.8949 33.57C80.8949 32.5247 81.2123 31.6567 81.8469 30.966C82.4816 30.266 83.2936 29.916 84.2829 29.916C85.3003 29.916 86.1076 30.2473 86.7049 30.91C87.3116 31.5633 87.6149 32.4827 87.6149 33.668L87.6009 33.808H82.2109C82.2296 34.48 82.4536 35.0213 82.8829 35.432C83.3123 35.8427 83.8256 36.048 84.4229 36.048C85.2443 36.048 85.8883 35.6373 86.3549 34.816L87.5029 35.376C87.1949 35.9547 86.7656 36.4073 86.2149 36.734C85.6736 37.0607 85.0576 37.224 84.3669 37.224ZM82.3089 32.744H86.2429C86.2056 32.268 86.0096 31.876 85.6549 31.568C85.3096 31.2507 84.8429 31.092 84.2549 31.092C83.7696 31.092 83.3496 31.2413 82.9949 31.54C82.6496 31.8387 82.4209 32.24 82.3089 32.744ZM94.585 37.112C94.025 37.112 93.5583 36.9393 93.185 36.594C92.821 36.2487 92.6343 35.768 92.625 35.152V31.316H91.421V30.14H92.625V28.04H93.913V30.14H95.593V31.316H93.913V34.732C93.913 35.1893 94.0016 35.502 94.179 35.67C94.3563 35.8287 94.557 35.908 94.781 35.908C94.8836 35.908 94.9816 35.8987 95.075 35.88C95.1776 35.852 95.271 35.8193 95.355 35.782L95.761 36.93C95.425 37.0513 95.033 37.112 94.585 37.112ZM96.3578 33.57C96.3578 32.5153 96.6892 31.6427 97.3518 30.952C98.0238 30.2613 98.8685 29.916 99.8858 29.916C100.903 29.916 101.743 30.2613 102.406 30.952C103.078 31.6427 103.414 32.5153 103.414 33.57C103.414 34.634 103.078 35.5067 102.406 36.188C101.743 36.8787 100.903 37.224 99.8858 37.224C98.8685 37.224 98.0238 36.8787 97.3518 36.188C96.6892 35.4973 96.3578 34.6247 96.3578 33.57ZM97.6458 33.57C97.6458 34.3073 97.8605 34.9047 98.2898 35.362C98.7192 35.8193 99.2512 36.048 99.8858 36.048C100.52 36.048 101.052 35.8193 101.482 35.362C101.911 34.9047 102.126 34.3073 102.126 33.57C102.126 32.842 101.911 32.2493 101.482 31.792C101.043 31.3253 100.511 31.092 99.8858 31.092C99.2605 31.092 98.7285 31.3253 98.2898 31.792C97.8605 32.2493 97.6458 32.842 97.6458 33.57ZM45.7185 43.864C46.1852 43.864 46.5678 43.9433 46.8665 44.102L46.5165 45.236C46.2925 45.124 46.0405 45.068 45.7605 45.068C45.4432 45.068 45.1818 45.18 44.9765 45.404C44.7805 45.6187 44.6825 45.908 44.6825 46.272V47.14H46.4745V48.316H44.6825V54H43.3945V48.316H42.1065V47.14H43.3945V46.146C43.3945 45.4647 43.6092 44.914 44.0385 44.494C44.4772 44.074 45.0372 43.864 45.7185 43.864ZM48.3734 51.9C48.3734 52.236 48.5134 52.516 48.7934 52.74C49.0827 52.964 49.4187 53.076 49.8014 53.076C50.3427 53.076 50.8234 52.8753 51.2434 52.474C51.6727 52.0727 51.8874 51.6013 51.8874 51.06C51.486 50.7427 50.926 50.584 50.2074 50.584C49.6847 50.584 49.246 50.71 48.8914 50.962C48.546 51.214 48.3734 51.5267 48.3734 51.9ZM50.0394 46.916C50.9914 46.916 51.7427 47.1727 52.2934 47.686C52.844 48.19 53.1194 48.8853 53.1194 49.772V54H51.8874V53.048H51.8314C51.2994 53.832 50.59 54.224 49.7034 54.224C48.9474 54.224 48.3127 54 47.7994 53.552C47.2954 53.104 47.0434 52.544 47.0434 51.872C47.0434 51.1627 47.3094 50.598 47.8414 50.178C48.3827 49.758 49.1014 49.548 49.9974 49.548C50.7627 49.548 51.3927 49.688 51.8874 49.968V49.674C51.8874 49.226 51.71 48.848 51.3554 48.54C51.0007 48.2227 50.5854 48.064 50.1094 48.064C49.3907 48.064 48.8214 48.3673 48.4014 48.974L47.2674 48.26C47.8927 47.364 48.8167 46.916 50.0394 46.916ZM57.6397 54.224C56.6224 54.224 55.7777 53.8787 55.1057 53.188C54.4431 52.4787 54.1117 51.606 54.1117 50.57C54.1117 49.5153 54.4431 48.6427 55.1057 47.952C55.7777 47.2613 56.6224 46.916 57.6397 46.916C58.3397 46.916 58.9511 47.0933 59.4737 47.448C59.9964 47.7933 60.3884 48.274 60.6497 48.89L59.4737 49.38C59.1097 48.5213 58.4704 48.092 57.5557 48.092C56.9677 48.092 56.4591 48.33 56.0297 48.806C55.6097 49.282 55.3997 49.87 55.3997 50.57C55.3997 51.27 55.6097 51.858 56.0297 52.334C56.4591 52.81 56.9677 53.048 57.5557 53.048C58.4984 53.048 59.1611 52.6187 59.5437 51.76L60.6917 52.25C60.4397 52.866 60.0431 53.3513 59.5017 53.706C58.9697 54.0513 58.3491 54.224 57.6397 54.224ZM64.4658 54.112C63.9058 54.112 63.4392 53.9393 63.0658 53.594C62.7018 53.2487 62.5152 52.768 62.5058 52.152V48.316H61.3018V47.14H62.5058V45.04H63.7938V47.14H65.4738V48.316H63.7938V51.732C63.7938 52.1893 63.8825 52.502 64.0598 52.67C64.2372 52.8287 64.4378 52.908 64.6618 52.908C64.7645 52.908 64.8625 52.8987 64.9558 52.88C65.0585 52.852 65.1518 52.8193 65.2358 52.782L65.6418 53.93C65.3058 54.0513 64.9138 54.112 64.4658 54.112ZM66.2387 50.57C66.2387 49.5153 66.57 48.6427 67.2327 47.952C67.9047 47.2613 68.7493 46.916 69.7667 46.916C70.784 46.916 71.624 47.2613 72.2867 47.952C72.9587 48.6427 73.2947 49.5153 73.2947 50.57C73.2947 51.634 72.9587 52.5067 72.2867 53.188C71.624 53.8787 70.784 54.224 69.7667 54.224C68.7493 54.224 67.9047 53.8787 67.2327 53.188C66.57 52.4973 66.2387 51.6247 66.2387 50.57ZM67.5267 50.57C67.5267 51.3073 67.7413 51.9047 68.1707 52.362C68.6 52.8193 69.132 53.048 69.7667 53.048C70.4013 53.048 70.9333 52.8193 71.3627 52.362C71.792 51.9047 72.0067 51.3073 72.0067 50.57C72.0067 49.842 71.792 49.2493 71.3627 48.792C70.924 48.3253 70.392 48.092 69.7667 48.092C69.1413 48.092 68.6093 48.3253 68.1707 48.792C67.7413 49.2493 67.5267 49.842 67.5267 50.57ZM75.6159 54H74.3279V47.14H75.5599V48.26H75.6159C75.7466 47.896 76.0126 47.588 76.4139 47.336C76.8246 47.0747 77.2259 46.944 77.6179 46.944C77.9913 46.944 78.3086 47 78.5699 47.112L78.1779 48.358C78.0193 48.2927 77.7673 48.26 77.4219 48.26C76.9366 48.26 76.5119 48.456 76.1479 48.848C75.7933 49.24 75.6159 49.6973 75.6159 50.22V54ZM84.0021 54H82.7141V43.976H84.0021L87.4881 50.08H87.5441L91.0301 43.976H92.3181V54H91.0301V48.05L91.0861 46.37H91.0301L87.8941 51.872H87.1381L84.0021 46.37H83.9461L84.0021 48.05V54ZM95.6231 49.94V54H94.3351V43.976H97.7511C98.6191 43.976 99.3565 44.2653 99.9631 44.844C100.579 45.4227 100.887 46.1273 100.887 46.958C100.887 47.8073 100.579 48.5167 99.9631 49.086C99.3658 49.6553 98.6285 49.94 97.7511 49.94H95.6231ZM95.6231 45.208V48.708H97.7791C98.2925 48.708 98.7171 48.5353 99.0531 48.19C99.3985 47.8447 99.5711 47.434 99.5711 46.958C99.5711 46.4913 99.3985 46.0853 99.0531 45.74C98.7171 45.3853 98.2925 45.208 97.7791 45.208H95.6231Z" fill="#00A743"/>
                    <path id="Belief update" d="M221.374 47V36.976H225C225.794 36.976 226.475 37.2373 227.044 37.76C227.614 38.2733 227.898 38.922 227.898 39.706C227.898 40.6953 227.446 41.3907 226.54 41.792V41.848C227.054 42.016 227.464 42.31 227.772 42.73C228.08 43.1407 228.234 43.612 228.234 44.144C228.234 44.9653 227.936 45.6467 227.338 46.188C226.76 46.7293 226.046 47 225.196 47H221.374ZM222.662 38.208V41.274H225C225.458 41.274 225.84 41.12 226.148 40.812C226.456 40.4947 226.61 40.1353 226.61 39.734C226.61 39.342 226.461 38.9873 226.162 38.67C225.864 38.362 225.495 38.208 225.056 38.208H222.662ZM222.662 42.478V45.768H225.252C225.719 45.768 226.116 45.6047 226.442 45.278C226.76 44.9513 226.918 44.564 226.918 44.116C226.918 43.6773 226.755 43.2947 226.428 42.968C226.102 42.6413 225.691 42.478 225.196 42.478H222.662ZM232.543 47.224C231.535 47.224 230.704 46.8787 230.051 46.188C229.397 45.4973 229.071 44.6247 229.071 43.57C229.071 42.5247 229.388 41.6567 230.023 40.966C230.657 40.266 231.469 39.916 232.459 39.916C233.476 39.916 234.283 40.2473 234.881 40.91C235.487 41.5633 235.791 42.4827 235.791 43.668L235.777 43.808H230.387C230.405 44.48 230.629 45.0213 231.059 45.432C231.488 45.8427 232.001 46.048 232.599 46.048C233.42 46.048 234.064 45.6373 234.531 44.816L235.679 45.376C235.371 45.9547 234.941 46.4073 234.391 46.734C233.849 47.0607 233.233 47.224 232.543 47.224ZM230.485 42.744H234.419C234.381 42.268 234.185 41.876 233.831 41.568C233.485 41.2507 233.019 41.092 232.431 41.092C231.945 41.092 231.525 41.2413 231.171 41.54C230.825 41.8387 230.597 42.24 230.485 42.744ZM238.257 36.976V47H236.969V36.976H238.257ZM241.492 37.774C241.492 38.026 241.403 38.2407 241.226 38.418C241.049 38.5953 240.834 38.684 240.582 38.684C240.33 38.684 240.115 38.5953 239.938 38.418C239.761 38.2407 239.672 38.026 239.672 37.774C239.672 37.522 239.761 37.3073 239.938 37.13C240.115 36.9527 240.33 36.864 240.582 36.864C240.834 36.864 241.049 36.9527 241.226 37.13C241.403 37.3073 241.492 37.522 241.492 37.774ZM241.226 40.14V47H239.938V40.14H241.226ZM245.914 47.224C244.906 47.224 244.075 46.8787 243.422 46.188C242.768 45.4973 242.442 44.6247 242.442 43.57C242.442 42.5247 242.759 41.6567 243.394 40.966C244.028 40.266 244.84 39.916 245.83 39.916C246.847 39.916 247.654 40.2473 248.252 40.91C248.858 41.5633 249.162 42.4827 249.162 43.668L249.148 43.808H243.758C243.776 44.48 244 45.0213 244.43 45.432C244.859 45.8427 245.372 46.048 245.97 46.048C246.791 46.048 247.435 45.6373 247.902 44.816L249.05 45.376C248.742 45.9547 248.312 46.4073 247.762 46.734C247.22 47.0607 246.604 47.224 245.914 47.224ZM243.856 42.744H247.79C247.752 42.268 247.556 41.876 247.202 41.568C246.856 41.2507 246.39 41.092 245.802 41.092C245.316 41.092 244.896 41.2413 244.542 41.54C244.196 41.8387 243.968 42.24 243.856 42.744ZM253.367 36.864C253.834 36.864 254.216 36.9433 254.515 37.102L254.165 38.236C253.941 38.124 253.689 38.068 253.409 38.068C253.092 38.068 252.83 38.18 252.625 38.404C252.429 38.6187 252.331 38.908 252.331 39.272V40.14H254.123V41.316H252.331V47H251.043V41.316H249.755V40.14H251.043V39.146C251.043 38.4647 251.258 37.914 251.687 37.494C252.126 37.074 252.686 36.864 253.367 36.864ZM264.453 47H263.221V46.048H263.165C262.969 46.384 262.666 46.664 262.255 46.888C261.854 47.112 261.434 47.224 260.995 47.224C260.155 47.224 259.507 46.986 259.049 46.51C258.601 46.0247 258.377 45.3387 258.377 44.452V40.14H259.665V44.368C259.693 45.488 260.258 46.048 261.359 46.048C261.873 46.048 262.302 45.8427 262.647 45.432C262.993 45.012 263.165 44.5127 263.165 43.934V40.14H264.453V47ZM269.381 46.048C269.997 46.048 270.515 45.8147 270.935 45.348C271.355 44.8907 271.565 44.298 271.565 43.57C271.565 42.8513 271.355 42.2587 270.935 41.792C270.515 41.3253 269.997 41.092 269.381 41.092C268.756 41.092 268.233 41.3253 267.813 41.792C267.403 42.2587 267.197 42.8513 267.197 43.57C267.197 44.298 267.403 44.8953 267.813 45.362C268.233 45.8193 268.756 46.048 269.381 46.048ZM269.591 47.224C269.087 47.224 268.625 47.1167 268.205 46.902C267.795 46.6873 267.477 46.4027 267.253 46.048H267.197L267.253 47V50.024H265.965V40.14H267.197V41.092H267.253C267.477 40.7373 267.795 40.4527 268.205 40.238C268.625 40.0233 269.087 39.916 269.591 39.916C270.497 39.916 271.262 40.2707 271.887 40.98C272.531 41.6987 272.853 42.562 272.853 43.57C272.853 44.5873 272.531 45.4507 271.887 46.16C271.262 46.8693 270.497 47.224 269.591 47.224ZM277.113 46.048C277.748 46.048 278.266 45.8193 278.667 45.362C279.087 44.9047 279.297 44.3073 279.297 43.57C279.297 42.8513 279.087 42.2587 278.667 41.792C278.256 41.3253 277.738 41.092 277.113 41.092C276.497 41.092 275.979 41.3253 275.559 41.792C275.139 42.2587 274.929 42.8513 274.929 43.57C274.929 44.298 275.139 44.8907 275.559 45.348C275.979 45.8147 276.497 46.048 277.113 46.048ZM276.903 47.224C276.007 47.224 275.237 46.8693 274.593 46.16C273.958 45.4413 273.641 44.578 273.641 43.57C273.641 42.562 273.958 41.6987 274.593 40.98C275.237 40.2707 276.007 39.916 276.903 39.916C277.407 39.916 277.864 40.0233 278.275 40.238C278.695 40.4527 279.017 40.7373 279.241 41.092H279.297L279.241 40.14V36.976H280.529V47H279.297V46.048H279.241C279.017 46.4027 278.695 46.6873 278.275 46.902C277.864 47.1167 277.407 47.224 276.903 47.224ZM282.969 44.9C282.969 45.236 283.109 45.516 283.389 45.74C283.678 45.964 284.014 46.076 284.397 46.076C284.938 46.076 285.419 45.8753 285.839 45.474C286.268 45.0727 286.483 44.6013 286.483 44.06C286.082 43.7427 285.522 43.584 284.803 43.584C284.28 43.584 283.842 43.71 283.487 43.962C283.142 44.214 282.969 44.5267 282.969 44.9ZM284.635 39.916C285.587 39.916 286.338 40.1727 286.889 40.686C287.44 41.19 287.715 41.8853 287.715 42.772V47H286.483V46.048H286.427C285.895 46.832 285.186 47.224 284.299 47.224C283.543 47.224 282.908 47 282.395 46.552C281.891 46.104 281.639 45.544 281.639 44.872C281.639 44.1627 281.905 43.598 282.437 43.178C282.978 42.758 283.697 42.548 284.593 42.548C285.358 42.548 285.988 42.688 286.483 42.968V42.674C286.483 42.226 286.306 41.848 285.951 41.54C285.596 41.2227 285.181 41.064 284.705 41.064C283.986 41.064 283.417 41.3673 282.997 41.974L281.863 41.26C282.488 40.364 283.412 39.916 284.635 39.916ZM291.747 47.112C291.187 47.112 290.72 46.9393 290.347 46.594C289.983 46.2487 289.796 45.768 289.787 45.152V41.316H288.583V40.14H289.787V38.04H291.075V40.14H292.755V41.316H291.075V44.732C291.075 45.1893 291.164 45.502 291.341 45.67C291.518 45.8287 291.719 45.908 291.943 45.908C292.046 45.908 292.144 45.8987 292.237 45.88C292.34 45.852 292.433 45.8193 292.517 45.782L292.923 46.93C292.587 47.0513 292.195 47.112 291.747 47.112ZM296.992 47.224C295.984 47.224 295.153 46.8787 294.5 46.188C293.847 45.4973 293.52 44.6247 293.52 43.57C293.52 42.5247 293.837 41.6567 294.472 40.966C295.107 40.266 295.919 39.916 296.908 39.916C297.925 39.916 298.733 40.2473 299.33 40.91C299.937 41.5633 300.24 42.4827 300.24 43.668L300.226 43.808H294.836C294.855 44.48 295.079 45.0213 295.508 45.432C295.937 45.8427 296.451 46.048 297.048 46.048C297.869 46.048 298.513 45.6373 298.98 44.816L300.128 45.376C299.82 45.9547 299.391 46.4073 298.84 46.734C298.299 47.0607 297.683 47.224 296.992 47.224ZM294.934 42.744H298.868C298.831 42.268 298.635 41.876 298.28 41.568C297.935 41.2507 297.468 41.092 296.88 41.092C296.395 41.092 295.975 41.2413 295.62 41.54C295.275 41.8387 295.046 42.24 294.934 42.744Z" fill="#EC5147"/>
                    <path id="t =" d="M8.61328 20.224C7.49328 20.224 6.55995 19.8787 5.81328 19.188C5.08528 18.4973 4.71195 17.536 4.69328 16.304V8.632H2.28528V6.28H4.69328V2.08H7.26928V6.28H10.6293V8.632H7.26928V15.464C7.26928 16.3787 7.44661 17.004 7.80128 17.34C8.15595 17.6573 8.55728 17.816 9.00528 17.816C9.21061 17.816 9.40661 17.7973 9.59328 17.76C9.79861 17.704 9.98528 17.6387 10.1533 17.564L10.9653 19.86C10.2933 20.1027 9.50928 20.224 8.61328 20.224ZM31.8321 9.472H19.2321V7.344H31.8321V9.472ZM31.8321 14.792H19.2321V12.664H31.8321V14.792Z" fill="black"/>
                    <text id="time-text" x="45" y="20" fill="black">{Math.floor(t)}</text>
                </g>

                <g id="message arrows">
                    {#if t%1 < 0.33}
                        <path id="Arrow 2" d="M200.061 172.061C200.646 171.475 200.646 170.525 200.061 169.939L190.515 160.393C189.929 159.808 188.979 159.808 188.393 160.393C187.808 160.979 187.808 161.929 188.393 162.515L196.879 171L188.393 179.485C187.808 180.071 187.808 181.021 188.393 181.607C188.979 182.192 189.929 182.192 190.515 181.607L200.061 172.061ZM125 172.5H199V169.5H125V172.5Z" fill="#00A743"/>
                        <path id="Arrow 3" d="M28.9393 169.939C28.3536 170.525 28.3536 171.475 28.9393 172.061L38.4853 181.607C39.0711 182.192 40.0208 182.192 40.6066 181.607C41.1924 181.021 41.1924 180.071 40.6066 179.485L32.1213 171L40.6066 162.515C41.1924 161.929 41.1924 160.979 40.6066 160.393C40.0208 159.808 39.0711 159.808 38.4853 160.393L28.9393 169.939ZM81 169.5H30V172.5H81V169.5Z" fill="#00A743"/>
                        <path id="Arrow 4" d="M247.939 169.939C247.354 170.525 247.354 171.475 247.939 172.061L257.485 181.607C258.071 182.192 259.021 182.192 259.607 181.607C260.192 181.021 260.192 180.071 259.607 179.485L251.121 171L259.607 162.515C260.192 161.929 260.192 160.979 259.607 160.393C259.021 159.808 258.071 159.808 257.485 160.393L247.939 169.939ZM300 169.5H249V172.5H300V169.5Z" fill="#00A743"/>
                    {:else if t%1 < 0.66}
                        <path id="Arrow 5" d="M123.939 140.939C123.354 141.525 123.354 142.475 123.939 143.061L133.485 152.607C134.071 153.192 135.021 153.192 135.607 152.607C136.192 152.021 136.192 151.071 135.607 150.485L127.121 142L135.607 133.515C136.192 132.929 136.192 131.979 135.607 131.393C135.021 130.808 134.071 130.808 133.485 131.393L123.939 140.939ZM199 140.5H125V143.5H199V140.5Z" fill="#00AACF"/>
                        <path id="Arrow 6" d="M82.0607 143.061C82.6464 142.475 82.6464 141.525 82.0607 140.939L72.5147 131.393C71.9289 130.808 70.9792 130.808 70.3934 131.393C69.8076 131.979 69.8076 132.929 70.3934 133.515L78.8787 142L70.3934 150.485C69.8076 151.071 69.8076 152.021 70.3934 152.607C70.9792 153.192 71.9289 153.192 72.5147 152.607L82.0607 143.061ZM30 143.5L81 143.5L81 140.5L30 140.5L30 143.5Z" fill="#00AACF"/>
                        <path id="Arrow 7" d="M301.061 143.061C301.646 142.475 301.646 141.525 301.061 140.939L291.515 131.393C290.929 130.808 289.979 130.808 289.393 131.393C288.808 131.979 288.808 132.929 289.393 133.515L297.879 142L289.393 150.485C288.808 151.071 288.808 152.021 289.393 152.607C289.979 153.192 290.929 153.192 291.515 152.607L301.061 143.061ZM249 143.5L300 143.5L300 140.5L249 140.5L249 143.5Z" fill="#00AACF"/>
                    {/if}
                </g>


                <g id="edges">
                    {#each Array(3) as _, i}
                        {#each Array(3) as _, j}
                        {#if j < 2}
                            <line stroke="black"
                                x1={xstart + means[Math.floor(t)].xs[3*i + j]*scale} x2={xstart + means[Math.floor(t)].xs[3*i + j + 1]*scale}
                                y1={ystart + means[Math.floor(t)].ys[3*i + j]*scale} y2={ystart + means[Math.floor(t)].ys[3*i + j + 1]*scale} />
                        {/if}
                        {#if i < 2}
                            <line stroke="black"
                                x1={xstart + means[Math.floor(t)].xs[3*i + j]*scale} x2={xstart + means[Math.floor(t)].xs[3*i + j + 3]*scale}
                                y1={ystart + means[Math.floor(t)].ys[3*i + j]*scale} y2={ystart + means[Math.floor(t)].ys[3*i + j + 3]*scale} />
                        {/if}
                        {/each}
                    {/each}
                </g>

                <g id="marginal distributions">
                    {#each Array(9) as _, i}
                        <circle class="marg-mean" cx={xstart + direct_mu.get(i*2,0)*scale} cy={ystart + direct_mu.get(i*2+1,0)*scale} r=3/>
                        <!-- <circle class="marg-std" fill="url(#marg_cov_gradient)" cx={xstart + direct_mu.get(i*2,0)*scale} cy={ystart + direct_mu.get(i*2+1,0)*scale} r={direct_stds[2*i]*scale}/> -->
                        <circle class="marg-std" style="opacity: 1;" fill="none" cx={xstart + direct_mu.get(i*2,0)*scale} cy={ystart + direct_mu.get(i*2+1,0)*scale} r={direct_stds[2*i]*scale*frac_std}/>
                    {/each}
                </g>

                <g id="beliefs">
                    {#each Array(9) as _, i}
                        <circle class="belief-mean" cx={xstart + means[Math.floor(t)].xs[i]*scale} cy={ystart + means[Math.floor(t)].ys[i]*scale} r=3/>
                        <circle class="belief-std" fill="url(#belief_cov_gradient)" cx={xstart + means[Math.floor(t)].xs[i]*scale} cy={ystart + means[Math.floor(t)].ys[i]*scale} r={stds[Math.floor(t)][i]*scale*frac_std}/>
                        <!-- <circle class="belief-std" fill="none" cx={xstart + means[Math.floor(t)].xs[i]*scale} cy={ystart + means[Math.floor(t)].ys[i]*scale} r={stds[Math.floor(t)][i]*scale*frac_std}/> -->
                    {/each}
                </g>

                <g id="key">
                    <path id="Belief" d="M394.008 35V24.976H397.634C398.427 24.976 399.109 25.2373 399.678 25.76C400.247 26.2733 400.532 26.922 400.532 27.706C400.532 28.6953 400.079 29.3907 399.174 29.792V29.848C399.687 30.016 400.098 30.31 400.406 30.73C400.714 31.1407 400.868 31.612 400.868 32.144C400.868 32.9653 400.569 33.6467 399.972 34.188C399.393 34.7293 398.679 35 397.83 35H394.008ZM395.296 26.208V29.274H397.634C398.091 29.274 398.474 29.12 398.782 28.812C399.09 28.4947 399.244 28.1353 399.244 27.734C399.244 27.342 399.095 26.9873 398.796 26.67C398.497 26.362 398.129 26.208 397.69 26.208H395.296ZM395.296 30.478V33.768H397.886C398.353 33.768 398.749 33.6047 399.076 33.278C399.393 32.9513 399.552 32.564 399.552 32.116C399.552 31.6773 399.389 31.2947 399.062 30.968C398.735 30.6413 398.325 30.478 397.83 30.478H395.296ZM405.177 35.224C404.169 35.224 403.338 34.8787 402.685 34.188C402.031 33.4973 401.705 32.6247 401.705 31.57C401.705 30.5247 402.022 29.6567 402.657 28.966C403.291 28.266 404.103 27.916 405.093 27.916C406.11 27.916 406.917 28.2473 407.515 28.91C408.121 29.5633 408.425 30.4827 408.425 31.668L408.411 31.808H403.021C403.039 32.48 403.263 33.0213 403.693 33.432C404.122 33.8427 404.635 34.048 405.233 34.048C406.054 34.048 406.698 33.6373 407.165 32.816L408.312 33.376C408.005 33.9547 407.575 34.4073 407.025 34.734C406.483 35.0607 405.867 35.224 405.177 35.224ZM403.119 30.744H407.053C407.015 30.268 406.819 29.876 406.465 29.568C406.119 29.2507 405.653 29.092 405.065 29.092C404.579 29.092 404.159 29.2413 403.805 29.54C403.459 29.8387 403.231 30.24 403.119 30.744ZM410.89 24.976V35H409.602V24.976H410.89ZM414.126 25.774C414.126 26.026 414.037 26.2407 413.86 26.418C413.682 26.5953 413.468 26.684 413.216 26.684C412.964 26.684 412.749 26.5953 412.572 26.418C412.394 26.2407 412.306 26.026 412.306 25.774C412.306 25.522 412.394 25.3073 412.572 25.13C412.749 24.9527 412.964 24.864 413.216 24.864C413.468 24.864 413.682 24.9527 413.86 25.13C414.037 25.3073 414.126 25.522 414.126 25.774ZM413.86 28.14V35H412.572V28.14H413.86ZM418.548 35.224C417.54 35.224 416.709 34.8787 416.056 34.188C415.402 33.4973 415.076 32.6247 415.076 31.57C415.076 30.5247 415.393 29.6567 416.028 28.966C416.662 28.266 417.474 27.916 418.464 27.916C419.481 27.916 420.288 28.2473 420.886 28.91C421.492 29.5633 421.796 30.4827 421.796 31.668L421.782 31.808H416.392C416.41 32.48 416.634 33.0213 417.064 33.432C417.493 33.8427 418.006 34.048 418.604 34.048C419.425 34.048 420.069 33.6373 420.536 32.816L421.684 33.376C421.376 33.9547 420.946 34.4073 420.396 34.734C419.854 35.0607 419.238 35.224 418.548 35.224ZM416.49 30.744H420.424C420.386 30.268 420.19 29.876 419.836 29.568C419.49 29.2507 419.024 29.092 418.436 29.092C417.95 29.092 417.53 29.2413 417.176 29.54C416.83 29.8387 416.602 30.24 416.49 30.744ZM426.001 24.864C426.467 24.864 426.85 24.9433 427.149 25.102L426.799 26.236C426.575 26.124 426.323 26.068 426.043 26.068C425.725 26.068 425.464 26.18 425.259 26.404C425.063 26.6187 424.965 26.908 424.965 27.272V28.14H426.757V29.316H424.965V35H423.677V29.316H422.389V28.14H423.677V27.146C423.677 26.4647 423.891 25.914 424.321 25.494C424.759 25.074 425.319 24.864 426.001 24.864Z" fill="black"/>
                    <path id="True marginal distribution" d="M396.424 77.208V86H395.136V77.208H392.336V75.976H399.224V77.208H396.424ZM400.799 86H399.511V79.14H400.743V80.26H400.799C400.929 79.896 401.195 79.588 401.597 79.336C402.007 79.0747 402.409 78.944 402.801 78.944C403.174 78.944 403.491 79 403.753 79.112L403.361 80.358C403.202 80.2927 402.95 80.26 402.605 80.26C402.119 80.26 401.695 80.456 401.331 80.848C400.976 81.24 400.799 81.6973 400.799 82.22V86ZM410.617 86H409.385V85.048H409.329C409.133 85.384 408.829 85.664 408.419 85.888C408.017 86.112 407.597 86.224 407.159 86.224C406.319 86.224 405.67 85.986 405.213 85.51C404.765 85.0247 404.541 84.3387 404.541 83.452V79.14H405.829V83.368C405.857 84.488 406.421 85.048 407.523 85.048C408.036 85.048 408.465 84.8427 408.811 84.432C409.156 84.012 409.329 83.5127 409.329 82.934V79.14H410.617V86ZM415.196 86.224C414.188 86.224 413.357 85.8787 412.704 85.188C412.051 84.4973 411.724 83.6247 411.724 82.57C411.724 81.5247 412.041 80.6567 412.676 79.966C413.311 79.266 414.123 78.916 415.112 78.916C416.129 78.916 416.937 79.2473 417.534 79.91C418.141 80.5633 418.444 81.4827 418.444 82.668L418.43 82.808H413.04C413.059 83.48 413.283 84.0213 413.712 84.432C414.141 84.8427 414.655 85.048 415.252 85.048C416.073 85.048 416.717 84.6373 417.184 83.816L418.332 84.376C418.024 84.9547 417.595 85.4073 417.044 85.734C416.503 86.0607 415.887 86.224 415.196 86.224ZM413.138 81.744H417.072C417.035 81.268 416.839 80.876 416.484 80.568C416.139 80.2507 415.672 80.092 415.084 80.092C414.599 80.092 414.179 80.2413 413.824 80.54C413.479 80.8387 413.25 81.24 413.138 81.744ZM423.986 86H422.698V79.14H423.93V80.092H423.986C424.182 79.756 424.481 79.476 424.882 79.252C425.293 79.028 425.699 78.916 426.1 78.916C426.604 78.916 427.047 79.0327 427.43 79.266C427.813 79.4993 428.093 79.8213 428.27 80.232C428.839 79.3547 429.628 78.916 430.636 78.916C431.429 78.916 432.041 79.1587 432.47 79.644C432.899 80.1293 433.114 80.82 433.114 81.716V86H431.826V81.912C431.826 81.268 431.709 80.806 431.476 80.526C431.243 80.2367 430.851 80.092 430.3 80.092C429.805 80.092 429.39 80.302 429.054 80.722C428.718 81.142 428.55 81.6367 428.55 82.206V86H427.262V81.912C427.262 81.268 427.145 80.806 426.912 80.526C426.679 80.2367 426.287 80.092 425.736 80.092C425.241 80.092 424.826 80.302 424.49 80.722C424.154 81.142 423.986 81.6367 423.986 82.206V86ZM435.49 83.9C435.49 84.236 435.63 84.516 435.91 84.74C436.199 84.964 436.535 85.076 436.918 85.076C437.459 85.076 437.94 84.8753 438.36 84.474C438.789 84.0727 439.004 83.6013 439.004 83.06C438.602 82.7427 438.042 82.584 437.324 82.584C436.801 82.584 436.362 82.71 436.008 82.962C435.662 83.214 435.49 83.5267 435.49 83.9ZM437.156 78.916C438.108 78.916 438.859 79.1727 439.41 79.686C439.96 80.19 440.236 80.8853 440.236 81.772V86H439.004V85.048H438.948C438.416 85.832 437.706 86.224 436.82 86.224C436.064 86.224 435.429 86 434.916 85.552C434.412 85.104 434.16 84.544 434.16 83.872C434.16 83.1627 434.426 82.598 434.958 82.178C435.499 81.758 436.218 81.548 437.114 81.548C437.879 81.548 438.509 81.688 439.004 81.968V81.674C439.004 81.226 438.826 80.848 438.472 80.54C438.117 80.2227 437.702 80.064 437.226 80.064C436.507 80.064 435.938 80.3673 435.518 80.974L434.384 80.26C435.009 79.364 435.933 78.916 437.156 78.916ZM442.976 86H441.688V79.14H442.92V80.26H442.976C443.107 79.896 443.373 79.588 443.774 79.336C444.185 79.0747 444.586 78.944 444.978 78.944C445.352 78.944 445.669 79 445.93 79.112L445.538 80.358C445.38 80.2927 445.128 80.26 444.782 80.26C444.297 80.26 443.872 80.456 443.508 80.848C443.154 81.24 442.976 81.6973 442.976 82.22V86ZM449.499 85.048C450.133 85.048 450.651 84.8193 451.053 84.362C451.473 83.9047 451.683 83.3073 451.683 82.57C451.683 81.8513 451.473 81.2587 451.053 80.792C450.642 80.3253 450.124 80.092 449.499 80.092C448.883 80.092 448.365 80.3253 447.945 80.792C447.525 81.2587 447.315 81.8513 447.315 82.57C447.315 83.298 447.525 83.8907 447.945 84.348C448.365 84.8147 448.883 85.048 449.499 85.048ZM449.457 89.248C449.074 89.248 448.715 89.1967 448.379 89.094C448.043 89.0007 447.735 88.8653 447.455 88.688C447.184 88.5107 446.951 88.3007 446.755 88.058C446.559 87.8153 446.409 87.5447 446.307 87.246L447.525 86.742C447.665 87.1433 447.907 87.4653 448.253 87.708C448.598 87.9507 448.999 88.072 449.457 88.072C450.157 88.072 450.703 87.862 451.095 87.442C451.487 87.022 451.683 86.4433 451.683 85.706V85.048H451.627C451.384 85.412 451.053 85.7013 450.633 85.916C450.222 86.1213 449.774 86.224 449.289 86.224C448.393 86.224 447.623 85.874 446.979 85.174C446.344 84.4553 446.027 83.5873 446.027 82.57C446.027 81.5527 446.344 80.6893 446.979 79.98C447.623 79.2707 448.393 78.916 449.289 78.916C449.774 78.916 450.222 79.0233 450.633 79.238C451.053 79.4433 451.384 79.728 451.627 80.092H451.683V79.14H452.915V85.706C452.915 86.8073 452.602 87.6707 451.977 88.296C451.342 88.9307 450.502 89.248 449.457 89.248ZM456.151 76.774C456.151 77.026 456.063 77.2407 455.885 77.418C455.708 77.5953 455.493 77.684 455.241 77.684C454.989 77.684 454.775 77.5953 454.597 77.418C454.42 77.2407 454.331 77.026 454.331 76.774C454.331 76.522 454.42 76.3073 454.597 76.13C454.775 75.9527 454.989 75.864 455.241 75.864C455.493 75.864 455.708 75.9527 455.885 76.13C456.063 76.3073 456.151 76.522 456.151 76.774ZM455.885 79.14V86H454.597V79.14H455.885ZM457.561 79.14H458.793V80.092H458.849C459.045 79.756 459.344 79.476 459.745 79.252C460.156 79.028 460.581 78.916 461.019 78.916C461.859 78.916 462.503 79.1587 462.951 79.644C463.409 80.12 463.637 80.8013 463.637 81.688V86H462.349V81.772C462.321 80.652 461.757 80.092 460.655 80.092C460.142 80.092 459.713 80.302 459.367 80.722C459.022 81.1327 458.849 81.6273 458.849 82.206V86H457.561V79.14ZM466.019 83.9C466.019 84.236 466.159 84.516 466.439 84.74C466.728 84.964 467.064 85.076 467.447 85.076C467.988 85.076 468.469 84.8753 468.889 84.474C469.318 84.0727 469.533 83.6013 469.533 83.06C469.132 82.7427 468.572 82.584 467.853 82.584C467.33 82.584 466.892 82.71 466.537 82.962C466.192 83.214 466.019 83.5267 466.019 83.9ZM467.685 78.916C468.637 78.916 469.388 79.1727 469.939 79.686C470.49 80.19 470.765 80.8853 470.765 81.772V86H469.533V85.048H469.477C468.945 85.832 468.236 86.224 467.349 86.224C466.593 86.224 465.958 86 465.445 85.552C464.941 85.104 464.689 84.544 464.689 83.872C464.689 83.1627 464.955 82.598 465.487 82.178C466.028 81.758 466.747 81.548 467.643 81.548C468.408 81.548 469.038 81.688 469.533 81.968V81.674C469.533 81.226 469.356 80.848 469.001 80.54C468.646 80.2227 468.231 80.064 467.755 80.064C467.036 80.064 466.467 80.3673 466.047 80.974L464.913 80.26C465.538 79.364 466.462 78.916 467.685 78.916ZM473.506 75.976V86H472.218V75.976H473.506ZM395.864 102.048C396.499 102.048 397.017 101.819 397.418 101.362C397.838 100.905 398.048 100.307 398.048 99.57C398.048 98.8513 397.838 98.2587 397.418 97.792C397.007 97.3253 396.489 97.092 395.864 97.092C395.248 97.092 394.73 97.3253 394.31 97.792C393.89 98.2587 393.68 98.8513 393.68 99.57C393.68 100.298 393.89 100.891 394.31 101.348C394.73 101.815 395.248 102.048 395.864 102.048ZM395.654 103.224C394.758 103.224 393.988 102.869 393.344 102.16C392.709 101.441 392.392 100.578 392.392 99.57C392.392 98.562 392.709 97.6987 393.344 96.98C393.988 96.2707 394.758 95.916 395.654 95.916C396.158 95.916 396.615 96.0233 397.026 96.238C397.446 96.4527 397.768 96.7373 397.992 97.092H398.048L397.992 96.14V92.976H399.28V103H398.048V102.048H397.992C397.768 102.403 397.446 102.687 397.026 102.902C396.615 103.117 396.158 103.224 395.654 103.224ZM402.516 93.774C402.516 94.026 402.428 94.2407 402.25 94.418C402.073 94.5953 401.858 94.684 401.606 94.684C401.354 94.684 401.14 94.5953 400.962 94.418C400.785 94.2407 400.696 94.026 400.696 93.774C400.696 93.522 400.785 93.3073 400.962 93.13C401.14 92.9527 401.354 92.864 401.606 92.864C401.858 92.864 402.073 92.9527 402.25 93.13C402.428 93.3073 402.516 93.522 402.516 93.774ZM402.25 96.14V103H400.962V96.14H402.25ZM409.177 101.096C409.177 101.693 408.915 102.197 408.393 102.608C407.87 103.019 407.212 103.224 406.419 103.224C405.728 103.224 405.121 103.047 404.599 102.692C404.076 102.328 403.703 101.852 403.479 101.264L404.627 100.774C404.795 101.185 405.037 101.507 405.355 101.74C405.681 101.964 406.036 102.076 406.419 102.076C406.829 102.076 407.17 101.987 407.441 101.81C407.721 101.633 407.861 101.423 407.861 101.18C407.861 100.741 407.525 100.419 406.853 100.214L405.677 99.92C404.342 99.584 403.675 98.94 403.675 97.988C403.675 97.3627 403.927 96.8633 404.431 96.49C404.944 96.1073 405.597 95.916 406.391 95.916C406.997 95.916 407.543 96.0607 408.029 96.35C408.523 96.6393 408.869 97.0267 409.065 97.512L407.917 97.988C407.786 97.6987 407.571 97.4747 407.273 97.316C406.983 97.148 406.657 97.064 406.293 97.064C405.957 97.064 405.653 97.148 405.383 97.316C405.121 97.484 404.991 97.6893 404.991 97.932C404.991 98.324 405.359 98.604 406.097 98.772L407.133 99.038C408.495 99.374 409.177 100.06 409.177 101.096ZM412.945 103.112C412.385 103.112 411.919 102.939 411.545 102.594C411.181 102.249 410.995 101.768 410.985 101.152V97.316H409.781V96.14H410.985V94.04H412.273V96.14H413.953V97.316H412.273V100.732C412.273 101.189 412.362 101.502 412.539 101.67C412.717 101.829 412.917 101.908 413.141 101.908C413.244 101.908 413.342 101.899 413.435 101.88C413.538 101.852 413.631 101.819 413.715 101.782L414.121 102.93C413.785 103.051 413.393 103.112 412.945 103.112ZM416.467 103H415.179V96.14H416.411V97.26H416.467C416.597 96.896 416.863 96.588 417.265 96.336C417.675 96.0747 418.077 95.944 418.469 95.944C418.842 95.944 419.159 96 419.421 96.112L419.029 97.358C418.87 97.2927 418.618 97.26 418.273 97.26C417.787 97.26 417.363 97.456 416.999 97.848C416.644 98.24 416.467 98.6973 416.467 99.22V103ZM421.93 93.774C421.93 94.026 421.842 94.2407 421.664 94.418C421.487 94.5953 421.272 94.684 421.02 94.684C420.768 94.684 420.554 94.5953 420.376 94.418C420.199 94.2407 420.11 94.026 420.11 93.774C420.11 93.522 420.199 93.3073 420.376 93.13C420.554 92.9527 420.768 92.864 421.02 92.864C421.272 92.864 421.487 92.9527 421.664 93.13C421.842 93.3073 421.93 93.522 421.93 93.774ZM421.664 96.14V103H420.376V96.14H421.664ZM426.967 103.224C426.463 103.224 426.001 103.117 425.581 102.902C425.17 102.687 424.853 102.403 424.629 102.048H424.573V103H423.341V92.976H424.629V96.14L424.573 97.092H424.629C424.853 96.7373 425.17 96.4527 425.581 96.238C426.001 96.0233 426.463 95.916 426.967 95.916C427.872 95.916 428.637 96.2707 429.263 96.98C429.907 97.6987 430.229 98.562 430.229 99.57C430.229 100.587 429.907 101.451 429.263 102.16C428.637 102.869 427.872 103.224 426.967 103.224ZM426.757 102.048C427.373 102.048 427.891 101.815 428.311 101.348C428.731 100.891 428.941 100.298 428.941 99.57C428.941 98.8513 428.731 98.2587 428.311 97.792C427.891 97.3253 427.373 97.092 426.757 97.092C426.131 97.092 425.609 97.3253 425.189 97.792C424.778 98.2587 424.573 98.8513 424.573 99.57C424.573 100.298 424.778 100.895 425.189 101.362C425.609 101.819 426.131 102.048 426.757 102.048ZM437.359 103H436.127V102.048H436.071C435.875 102.384 435.571 102.664 435.161 102.888C434.759 103.112 434.339 103.224 433.901 103.224C433.061 103.224 432.412 102.986 431.955 102.51C431.507 102.025 431.283 101.339 431.283 100.452V96.14H432.571V100.368C432.599 101.488 433.163 102.048 434.265 102.048C434.778 102.048 435.207 101.843 435.553 101.432C435.898 101.012 436.071 100.513 436.071 99.934V96.14H437.359V103ZM441.711 103.112C441.151 103.112 440.684 102.939 440.311 102.594C439.947 102.249 439.76 101.768 439.751 101.152V97.316H438.547V96.14H439.751V94.04H441.039V96.14H442.719V97.316H441.039V100.732C441.039 101.189 441.128 101.502 441.305 101.67C441.482 101.829 441.683 101.908 441.907 101.908C442.01 101.908 442.108 101.899 442.201 101.88C442.304 101.852 442.397 101.819 442.481 101.782L442.887 102.93C442.551 103.051 442.159 103.112 441.711 103.112ZM445.679 93.774C445.679 94.026 445.59 94.2407 445.413 94.418C445.235 94.5953 445.021 94.684 444.769 94.684C444.517 94.684 444.302 94.5953 444.125 94.418C443.947 94.2407 443.859 94.026 443.859 93.774C443.859 93.522 443.947 93.3073 444.125 93.13C444.302 92.9527 444.517 92.864 444.769 92.864C445.021 92.864 445.235 92.9527 445.413 93.13C445.59 93.3073 445.679 93.522 445.679 93.774ZM445.413 96.14V103H444.125V96.14H445.413ZM446.628 99.57C446.628 98.5153 446.96 97.6427 447.622 96.952C448.294 96.2613 449.139 95.916 450.156 95.916C451.174 95.916 452.014 96.2613 452.676 96.952C453.348 97.6427 453.684 98.5153 453.684 99.57C453.684 100.634 453.348 101.507 452.676 102.188C452.014 102.879 451.174 103.224 450.156 103.224C449.139 103.224 448.294 102.879 447.622 102.188C446.96 101.497 446.628 100.625 446.628 99.57ZM447.916 99.57C447.916 100.307 448.131 100.905 448.56 101.362C448.99 101.819 449.522 102.048 450.156 102.048C450.791 102.048 451.323 101.819 451.752 101.362C452.182 100.905 452.396 100.307 452.396 99.57C452.396 98.842 452.182 98.2493 451.752 97.792C451.314 97.3253 450.782 97.092 450.156 97.092C449.531 97.092 448.999 97.3253 448.56 97.792C448.131 98.2493 447.916 98.842 447.916 99.57ZM454.718 96.14H455.95V97.092H456.006C456.202 96.756 456.5 96.476 456.902 96.252C457.312 96.028 457.737 95.916 458.176 95.916C459.016 95.916 459.66 96.1587 460.108 96.644C460.565 97.12 460.794 97.8013 460.794 98.688V103H459.506V98.772C459.478 97.652 458.913 97.092 457.812 97.092C457.298 97.092 456.869 97.302 456.524 97.722C456.178 98.1327 456.006 98.6273 456.006 99.206V103H454.718V96.14Z" fill="black"/>

                    <circle class="belief-mean" cx=365 cy=30 r=3/>
                    <circle class="belief-std" fill="url(#belief_cov_gradient)" cx=365 cy=30 r=17/>
                    <circle class="marg-mean" cx=365 cy=90 r=3/>
                    <!-- <circle class="marg-std" fill="url(#marg_cov_gradient)" cx=365 cy=90 r=17/> -->
                    <circle class="marg-std" fill="none" cx=365 cy=90 r=17/>
                </g>

                <defs>
                    <radialGradient id="belief_cov_gradient">
                        <stop offset="0.35" stop-color="#0095DD" stop-opacity="0.5" />
                        <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
                    </radialGradient>
                    <radialGradient id="marg_cov_gradient">
                        <stop offset="0.35" stop-color="rgb(0,140,0)" stop-opacity="0.5" />
                        <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
                    </radialGradient>
                </defs>
            </svg>
        </div>

        <span style="color: orange;">
            <span style="font-weight: bold;">Part 2:</span> Message level operation   
        </span>

        <div id="part2" class="sec-container">

            <div class="central">
                <button on:click={randomMessage}>
                    Random message
                </button>  
                <button on:click={oneSyncIter}> 
                    Synchronous iteration
                </button>
                <!-- <span>
                    Av distance to GT marginal means: {dist_to_MAP.toFixed(2)}
                </span> -->
            </div>


            <svg id="svg" width="800" height="720" viewBox="-100 -45 800 720" xmlns="http://www.w3.org/2000/svg"
                on:mousedown={mousedown_handler}
                on:mousemove={mousemove_handler}
                on:mouseup={mouseup_handler}
                on:click={click_handler}>

                <!-- <line stroke="black" x1={-100} x2={700} y1={-45} y2={675}></line>
                <circle fill="black" cx=700 cy=675 r=10></circle>
                <circle fill="black" cx=-100 cy=-45 r=10></circle> -->

                <defs>
                    <radialGradient id="belief_covariance_gradient">
                        <stop offset="0.35" stop-color="#0095DD" stop-opacity="0.5" />
                        <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
                    </radialGradient>
                    <radialGradient id="gt_cov_gradient">
                        <stop offset="0.35" stop-color="blue" stop-opacity="0.5" />
                        <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
                    </radialGradient>
                </defs>

                <!-- <text>
                    Average distance from belief means to true marginal means: {dist_to_MAP.toFixed(2)}
                </text> -->

                {#each factor_nodes as f}
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
                {/each}


                {#each var_nodes as n, i}

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

                {/each}

                {#each message_bubbles as b}
                    <circle
                        class="mess-bubble" r={5}
                        cx={linear_progress(b.x, $bubble_progress)}
                        cy={linear_progress(b.y, $bubble_progress)}
                        opacity={1 - 4 * ($bubble_progress - 0.5) * ($bubble_progress - 0.5)} />
                {/each}


            </svg>

            <div id="graph-panel">
                <svg id="reset-svg" width="42" height="43" viewBox="0 0 42 43" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                    <rect class="clickable" on:click={reset} x="0.196075" y="0.784302" width="41.7647" height="41.7647" fill="url(#reset_pattern)"/>
                    <defs>
                    <pattern id="reset_pattern" patternContentUnits="objectBoundingBox" width="1" height="1">
                        <use xlink:href="#imag0" transform="scale(0.0111111)"/>
                    </pattern>
                    <image id="imag0" width="90" height="90" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAABaCAYAAAA4qEECAAAABmJLR0QA/wD/AP+gvaeTAAAFp0lEQVR4nO2dXWgdRRiGnzSnSWxjaBFttaA1F6kXatXUnzRpSvGiqCCxKFVatOIPLaK1/uCFN0EURFEpKvS6EPDGglCN/aMoFixS24ogVlFqTZrWNtombZU0PV5852A47rc7e87uzpzNPDAkTDJn3nnPnt1vvpndAx6Px+PxeDwej8fjKA22BQTQCNxSKh3AIqAdmA3MLf1sAMaBs8AY8HOp/AR8DXwPXMpaeD2wAHgO+AT4CyjWWP4EtgMbgCszHIeTtABrgB3ARWo3VysXgV3AaqCQycgcoRV4ERgmPXO1chR4uaQhLv1VtLFCAdgEnCJ7gyvLMPAkcj0wob/Uznl6gMPYN7iyHAaWRGgvm+y00U3AZiQCiGPAGDAIvAE8CtyJRB5zS69ZKP1+LdAFrAVeB3aX2sbpawJ4DZgZoL+/4n+dpB34BvMBDwFvA0up7aJVAHqB94l3HdiPRD9lKk120ugVSIhlMsCdwErMz5dxaAQeBL401DKMfEKCTHbO6FXA30QPahC4PUNdvchkxuRUov3NGR4nOib+DXjAkr4GJHb/I0Kj00avItrkrVQXwybNVcA26tDoFcAFdIHnkaPdJRqQyUucWalV2gm/8I0C3dbURTNAHRjdRHgINwTcaE1dNFp04ZzRm0NEjZIvk60Z3YM+4zuP26eLaky2YnQBOBQiaJ0NUYZUa7IVozeFiNlqQ5AhtZicudGt6KnOo7gRJwdRq8mZG/1SiBBbM74okjA5U6Nb0DNig1kKyTtr0d/tLou6cscOgk3eaVNU3liAnhdYaVFX7thIsMlDpJO0zxUzYvzv3Ur9ADCZgBYPcsRqGbqlFnXljiUEmzxG8OqxpwLTU8fNSv1XyBqbJwJTo29Q6g8kJSTvmBq9SKn/MSkhecfU6IVK/ZGkhNQZDcTcW25qdJtSfyJOZzlgFrAFOFcqW4DLkuxAS4tekWQndcCH/N+DD5Ls4J+ADorI4ux0ImguMWrSMM7McLrTDMwJqJ9l0tjU6HGl3tXVlDS4XKkfM2lsarT2YlrneUQLCM6aNDY1+oxSf7Vh+zwwX6lP1OhflfoOw/Z5QJu0/WLS2NRobQaodZ5Hapod12p0p2H7PHCbUp/o7LiT6Z0mbUJmgkEe3JpkR2GJf5f32CVFL8FjP43hWcH01DEJfKH8rc/wNeoZbWPQXlK4uf9Zgt/VYfK9OFsARgge+4Y0OrwGfbvBPWl06Aj3ETzmCWBeWp1+rnS6O60OHWAvwWPenmana5RO87oafhf6eFen2XELsmFmumwL20PwWH9Hsnmp8oLSeRG5HTgvPIw+zo1ZCJiNfufpMfKR0WtD/+SOYJiDTgJtH14R2SJW73yEPr5nshTSCBwMEfNElmISZj36uA5gYc7QRfjtb8uyFpQAy9FvtZ4E7rAl7F1FVBHJjdxkS1gVLCb8UXBv2ZMmWa39AaKmTs/rwezFwHH0cezDgSzlQmTJPezIdvk0spzwI/kU8uwmJ+gl/DESF4CnrKnTWU/04y96rKlT6CP62RcDuBFntxEewhWRsdxvS2AU64g2+xjwkC2ByIxPm4yUywTwmC2BpvQR/nEsl11ke29iN3ruovJ04eyRXEkv4RfIqWUPcC/pTAQKSD5ZS3UGXficOydHcR1mjz8rl+NIXL6M2jZPNiFv9HvoKyNaCJdadJH2g7pnAm8CzxNvQ+U5ZODfIsv5PwAnkTCsvA+wFdl0OA+59aMDWa3vJl7S5xLwDvAqObgfp5PwiY2tcpAc3sPeiCzwnsS+wSeQLFyeF5VpBp5GwrysDR4BXiHDfLILNAOPAJ+R7qPnJ4BPkfg59eUn15mPfJS3Ibt/ajX3NPAxsu8itS0BcXDx60FmINm0qV8Pcj0ybZ7Df3cZjCNRyBlkW/ERZDPmIeA7/NeDeDwej8fj8Xg8Ho8Z/wJD/Fexs/jO8AAAAABJRU5ErkJggg=="/>
                    </defs>
                </svg>
                <MultiButtonGroup options={[{ id: 0, name: "Chain" }, { id: 1, name: "Loop" }, { id: 2, name: "Grid" }]} 
                    on:change={handleChangeGraph} labelTitle="" selected={value}/>
            </div>

        </div>

    </div>

    <figcaption id="caption">
        All problems are anchored by a variable node in the top left with a strong prior that sets the absolute position - this is necessary as all other factors only constrain relative position.
        All factors are binary constraints (i.e. they connect two variable nodes) and we do not draw the factor nodes but instead draw an edge connecting the two variable nodes.
        <b>Part 1:</b> Move the slider to progress through GBP message passing (MP). 
        <b>Part 2:</b> Send messages by clicking on a variable node or by pressing the random or synchronous message buttons at the top.
        Choose from 3 different graphs with increasing "loopiness": a chain, a loop and a grid.

    </figcaption>

</figure>
