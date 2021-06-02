<script>
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import * as easing from "svelte/easing";
    import { tweened } from "svelte/motion";
    import * as m from 'ml-matrix';
    import * as gauss from '../utils/gaussian';
    import * as gbp from '../gbp/gbp_surface_fitting.js';
    import { onInterval } from '../utils/util.js';
	import ButtonGroup from '../utils/ButtonGroup.svelte'


    let display_batch = false;
    let visible_alert = false;

    let robust = true;

    // Measurement model std
    // let meas_std = 50;
    // let smoothness_std = 50;
    let meas_lam = 1.75e-3; 
    let meas_lam_check = meas_lam;
    let smoothness_lam = 1.5e-3;

    const waiting_mean = 350;
    const waiting_std = 40;

    // GBP variables
    const n_var_nodes = 10;
    const n_measurements = 8;
    let measurements = []

    let sweep_progress = 0;
    const bubble_progress = tweened(0);
    const move_belief_progress = tweened(0);
    const bubble_time = 100;  // ms
    const move_belief_time = 150;
    const highlight_time = 100;

    const width = 800;
    const height = 400;
    const node_radius = 12;
    const sqr_size = 16;
    const nodes_x_offset = width / (2 * n_var_nodes);
    const node_x_spacing = (width - nodes_x_offset*2) / (n_var_nodes - 1)

    let highlight_id = null;

    $: message_bubbles = [];
    $: moving_beliefs = [];
    $: hide_beliefs = [];

    let mp_schedule = 0;
    let lastTime = 0;
    var sync_on = false;
    var sweep_on = false;
    let GBP_sweep_done = false;
    const sweep_iter_time = bubble_time + move_belief_time + 10;

    let sweep;

    let speed = 0;
    const speed_labels = ["1/4x", "1/2x", "1x", "5x", "10x"];
    const iters_per_sec = [1, 2, 4, 20, 40];

    let dropout = 0.;
    let damping = 0.5;

    let n_iters = 0;
    // let iters_per_sec = 2.5;
    let dist = 0; // Average distance of belief means from MAP solution

    let graph = gbp.create1Dgraph(n_var_nodes, 1/Math.sqrt(smoothness_lam), robust, dropout, damping);
    genOutlierMeasurements(n_measurements, measurements);
    let beliefs = beliefs_show(graph.get_beliefs());
    let map = graph.computeMAP();

    function update_meas_factors() {
        for (var c=0; c<graph.factors.length; c++) {
            for (var i=1; i<graph.factors[c].lambdas.length; i++) {
                graph.factors[c].lambdas[i] = meas_lam;
                graph.factors[c].compute_factor();
            }
        }
    }

    function update_smoothness_factors() {
        for (var c=0; c<graph.factors.length; c++) {
            graph.factors[c].lambdas[0] = smoothness_lam;
            graph.factors[c].compute_factor();
        }
    }


    onInterval(() => {
        
        if (sync_on) {
            const now = Date.now();
            if ((now - lastTime) > 1000 / iters_per_sec[speed+2]) {
                graph.sync_iter();
                graph.compute_factors();
                beliefs = beliefs_show(graph.get_beliefs());
                n_iters++;

                lastTime = now;
            }
        }
        
        // if (display_batch) {
        //     map = graph.computeMAP();
        // }

        if (meas_lam != meas_lam_check) {
            update_meas_factors();
            map = graph.computeMAP();
            meas_lam_check = meas_lam;
        }

        if (graph.factors[0].lambdas[0] != smoothness_lam) {
            update_smoothness_factors();
            map = graph.computeMAP();
        }

    }, 1000 / 30);

    function sync_iter(e) {
        graph.sync_iter();
        graph.compute_factors();

        for (let i=0; i < graph.var_nodes.length; i++) {
            if (i > 0) { 
                create_message_bubble(i-1, i); 
                create_message_bubble(i, i-1); 
            }
            move_belief(i);
        }


        // beliefs = beliefs_show(graph.get_beliefs());
        n_iters++;
    }


    function print(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = width * (e.clientX - rect.x) / rect.width;
        const y = height * (e.clientY - rect.y) / rect.height;
    }

    function addMeasurement(e) {
        const send_mess_click = e.composedPath()[0].classList[0] == "node_g";
        
        if (!send_mess_click) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = width * (e.clientX - rect.x) / rect.width;
            const y = height * (e.clientY - rect.y) / rect.height;
            visible_alert = false;
            if (x > nodes_x_offset && x < width - nodes_x_offset && y > 0 && y < height) {
                var ix = (x - nodes_x_offset) / node_x_spacing;
                var x_lhs = nodes_x_offset + Math.floor(ix)*node_x_spacing;
                var x_rhs = nodes_x_offset + Math.ceil(ix)*node_x_spacing;
                graph.addLinearMeasurement(y, x, [Math.floor(ix), Math.ceil(ix)], x_lhs, x_rhs, 1/Math.sqrt(meas_lam));
                measurements.push({x: x, y: y})
                measurements = measurements;  // to tell svelte measurements has been updated
            }
            map = graph.computeMAP();
        }
    }

    function add_meas(x, y) {
        var ix = (x - nodes_x_offset) / node_x_spacing;
        var x_lhs = nodes_x_offset + Math.floor(ix)*node_x_spacing;
        var x_rhs = nodes_x_offset + Math.ceil(ix)*node_x_spacing;
        graph.addLinearMeasurement(y, x, [Math.floor(ix), Math.ceil(ix)], x_lhs, x_rhs, 1/Math.sqrt(meas_lam));
        measurements.push({x: x, y: y})
    }

    function genRandomMeasurements() {
        visible_alert = false;
        measurements = [];
        graph.factors = graph.factors.slice(0, 9);
        for (var i=0; i<n_measurements; i++) {
            var x = Math.random() * (width - 2 * nodes_x_offset) + nodes_x_offset;
            var y = Math.random() * (height - 3 * nodes_x_offset) + nodes_x_offset;
            add_meas(x, y);
        }
    }

    function genStepMeasurements() {
        measurements = [];
        graph.factors = graph.factors.slice(0, 9);
        const step = (width - 2*(nodes_x_offset + 10)) / (n_measurements-1);
        for (var i=0; i<n_measurements; i++) {
            let x = nodes_x_offset + 10 + i*step;
            let y;
            if (i >= n_measurements/2) {
                y = 290;
            } else {
                y = 60;
            }
            add_meas(x, y);
        }
    }

    function genOutlierMeasurements() {
        measurements = [];
        graph.factors = graph.factors.slice(0, 9);
        const n_meas = 10;
        const step = (width - 2*(nodes_x_offset + 10)) / (n_meas-1);
        for (var i=0; i<n_meas; i++) {
            let x = nodes_x_offset + 10 + i*step;
            // let y = 290 - (290-60)*i / (n_meas-1);
            let y = 200;
            add_meas(x, y);
        }
        add_meas(180, 20);
        add_meas(471, 380);
    }

	function newGraph(type="empty") {
        sync_on = false;
        sweep_on = false;
        n_iters = 0;
        graph = gbp.create1Dgraph(n_var_nodes, 1/Math.sqrt(smoothness_lam), robust, dropout, damping);
        if (type == "random") {
            genRandomMeasurements();
            map = graph.computeMAP();
        } else if (type == "step") {
            genStepMeasurements();
            map = graph.computeMAP();
        } else if (type == "outlier") {
            genOutlierMeasurements();
            map = graph.computeMAP();
        } else if (type == "empty") {
            measurements = [];
            display_batch = false;
        }
        beliefs = beliefs_show(graph.get_beliefs());
    }


    // User interaction functions

    function toggleGBP() {
        if (measurements.length == 0) {
            visible_alert = true;
            } else {
            sync_on = !sync_on;
        }
    }

    function toggleBatch(e) {
        if (measurements.length == 0) {
            visible_alert = true;
        } else {
            display_batch = !display_batch;
        }
    }

    function clear_message_bubbles() {
        message_bubbles = [];
        bubble_progress.set(0, { duration: 0 });
    }

    function clear_moving_beliefs() {
        moving_beliefs = [];
        hide_beliefs = [];
        move_belief_progress.set(0, { duration: 0 });
    }

    function highlight_node(id) {
        highlight_id = id;
        setTimeout( () => { highlight_id = null; }, highlight_time);
    }

    function beliefs_show(beliefs) {
        // Return mean and std of the belief. If belief is zeros then set to waiting state
        let show_means = [];
        let show_stds = [];
        for (let c=0; c<beliefs[0].length; c++) {
            if (beliefs[1][c] == 0) { 
                show_means.push(waiting_mean);
                show_stds.push(waiting_std);
            } else { 
                show_means.push(beliefs[0][c] / beliefs[1][c]);
                show_stds.push(Math.sqrt(1 / beliefs[1][c]));
            }
        }
        return [show_means, show_stds];
    }


    function create_message_bubble(id0, id1) {
        const message_bubble = { 
            x0: nodes_x_offset + id0*node_x_spacing,
            x1: nodes_x_offset + id1*node_x_spacing,
            y0: beliefs[0][id0], 
            y1: beliefs[0][id1], 
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
        // Belief has been updated in the graph, but not yet in the local variable beliefs
        if (graph.var_nodes[id].belief.eta.get(0,0) != 0) {
            // Set where it should move to and from
            const move_belief = {
                id: id,
                mean0: beliefs[0][id],
                mean1: graph.var_nodes[id].belief.getMean().get(0,0),
                std0: beliefs[1][id],
                std1: Math.sqrt(graph.var_nodes[id].belief.getCov().get(0,0)),
            }
            moving_beliefs.push(move_belief);
            
            // Set progress, so it moves after message bubble arrives
            move_belief_progress.set(1, {
                delay: bubble_time,
                duration: move_belief_time,
                easing: easing.sineOut,
            });
            setTimeout(() => {  // Hide the other belief display while it is moving
                hide_beliefs = moving_beliefs.map(x => x.id);
            }, bubble_time);

            setTimeout(() => {
                clear_moving_beliefs();
                beliefs = beliefs_show(graph.get_beliefs());
            }, bubble_time + move_belief_time);
        }
    }

    function send_adj_messages(id) {
        highlight_node(id);
        if (id > 0) {
            graph.send_mess_left(id);
            create_message_bubble(id, id-1);
            move_belief(id-1);
        }
        if (id < graph.var_nodes.length-1) {
            graph.send_mess_right(id);
            create_message_bubble(id, id+1);
            move_belief(id+1);
        }
    }

    function sendMessage(e) {
        const id = parseInt(e.composedPath().find((element) => element.classList[0] == "node_g").id);
        send_adj_messages(id);
    }

    function randomMessage(e) {
        clear_message_bubbles();
        clear_moving_beliefs();
        beliefs = beliefs_show(graph.get_beliefs());
        const mess_ix = Math.floor(Math.random() * (graph.var_nodes.length*2 - 2));
        if (mess_ix < graph.var_nodes.length-1) {
            const id = mess_ix;
            highlight_node(id);
            graph.send_mess_right(id);
            create_message_bubble(id, id+1);
            move_belief(id+1);
        } else {
            const id = 2*graph.var_nodes.length - 2 - mess_ix;
            highlight_node(id);
            graph.send_mess_left(id);
            create_message_bubble(id, id-1);
            move_belief(id-1);
        }
    }

    function doSweepStep() {
        const forward = graph.forward;
        const sweep_ix = graph.sweep_ix;

        graph.sweep_step();

        highlight_node(sweep_ix);
        if (forward) { 
            create_message_bubble(sweep_ix, sweep_ix + 1); 
            move_belief(sweep_ix + 1);
        } else { 
            create_message_bubble(sweep_ix, sweep_ix - 1); 
            move_belief(sweep_ix - 1);
        }

        // Update progress bar
        if (graph.forward) {
            sweep_progress = graph.sweep_ix / (2*graph.var_nodes.length - 2);
        } else {
            sweep_progress = 1 - graph.sweep_ix / (2*graph.var_nodes.length - 2);
        }
                
        if (graph.forward == 1 && graph.sweep_ix == 0) {
            clearInterval(sweep);
            sweep = null;
        }
    }

    function doSweep(e) {
        if (sweep == null) {
            sweep = setInterval(doSweepStep, sweep_iter_time);
        }
    }

	function handleChangeRobust(e){
        robust = e.detail.value;
        
        for (let i=0; i < graph.factors.length; i++) {
            graph.factors[i].huber = robust;
        }
	}

</script>

<style>

    #wrapper {
        display: grid;
        font-size: 14px;
        user-select: none;
        grid-column: page;  /* start and end the grid on the page */
        max-width: calc(100vw - 2em);
        row-gap: 5px;
        grid-template-columns: auto;
        grid-template-rows: auto auto auto;  /* three rows */
        grid-auto-flow: row;
        row-gap: 0px;
        width: 600px;
    }

    #caption {
        width: 650px;
        text-align: left;
    }

    @media (min-width: 1180px) {
        #wrapper {
            grid-template-columns: auto 400px;
            grid-template-rows: auto;  
            grid-auto-flow: column;
            grid-column-gap: 25px;
            width: 1025px;
            /* background-color: lightyellow; */
        }
        #control-panel {
            width: 400px;
        }
        #panel-container {
            grid-column: 2 / 3;
            grid-row: 1 / 3;
        }
        #caption {
            width: 100%;
            grid-column: page;
        }
    }
 
    #caption {
        text-align: left;
        grid-column: page;
    }

    #svg {
        width: 600px;
        height: 300px;
        background-color: #FCF7DE;
        border: 1px solid var(--gray);
    }

    #control-panel {
        width: 100%;
        height: auto;
        line-height: 1em;
        display: grid;
        grid-template-columns: auto;
        grid-template-rows: 100px 20px 60px 20px 60px;
        grid-row-end: auto;
        row-gap: 10px;
    }

    #panel2 {
        display: grid;
        grid-template-columns: auto 1fr;
        column-gap: 10px;
        width: 100%;
    }

    #panel2-container {
        width: 100%;
    }

    .meas {
        fill: var(--red);
    }

    /* .meas-line {
        stroke: var(--red);
        stroke-width: 3;
    } */

    .highlighted {
        fill: orange;
        stroke: orange;
        stroke-width: 6;
    }

    .belief-mean {
        fill: #0095DD;
    }

    .belief-std {
        stroke: #0095DD;
        stroke-width: 6;
    }

    .map-mean {
        fill: none;
        stroke: green;
        stroke-width: 3;
    }

    .map-std {
        stroke: green;
        stroke-width: 3;
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
        line-height: 1.4em;
        display: flex;
        align-items: center;
    }

    /* .slider-container {
        font-size: 14px;
    } */

    /* .full-width-slider {
        width: 100%;
    } */

    #precision-sliders {
        display: grid; 
        grid-template-columns: 1fr 1fr;
        grid-gap: 20px;
    }

    #center {
        display: flex;
        justify-content: center;
        align-items: center;
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
        background-color: var(--gray-bg);
    }

    /* .mp-button {
        background-color:  rgba(0, 0, 0, 0.1);
    } */

    #mp-buttons {
        display: grid; 
        grid-template-columns: 1fr 2fr;
        column-gap: 15px;
    }

    #progress {
        width: 100%;
    }

    .gbp-button {
        /* width: fit-content;
        height: fit-content; */
        float: left;
        outline: none;
        border: black;
    }

    #speed-slider-container {
        /* text-align: center; */
        vertical-align: middle;
        margin-top: 8px;
    }

    #double-panel {
        display: grid; 
        grid-template-columns: 1fr 1fr;
        grid-gap: 2px;
    }

    /* .node_g {
        cursor: pointer;
    } */

    .clickable {
        cursor: pointer;
    }

    .mess-bubble {
        stroke: var(--red);
        fill: var(--red);
    }

    .hidden {
        display: none;
    }

    #factor-graph {
        width: 100%
    }

    #buttons-svg {
        width: 100%;
        height: auto;
    }

    #play-pause {
        display: grid;
        grid-template-rows: 22px 60px;
        grid-row-gap: 0px;
    }

    #play-panel {
        display: grid; 
        grid-template-columns: auto 1fr;
    }

</style>

<svg style="display: none;" xmlns="http://www.w3.org/2000/svg">
    <symbol id="playIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path><path d="M0 0h24v24H0z" fill="none"></path></symbol>
    <symbol id="pauseIcon" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path><path d="M0 0h24v24H0z" fill="none"></path></symbol>
</svg>

<figure class="subgrid" id="figure">

    <div id="wrapper" class="interactive-container">

        <div id="svg-container">
            <svg id="svg" width="800" height="400" viewBox="0 0 800 400" on:click={addMeasurement} xmlns="http://www.w3.org/2000/svg">

                <!-- <line stroke="black" x1=0 x2=800 y1=0 y2=400></line> -->

                {#each measurements as meas, i}
                    <!-- <circle class="meas" cx={meas.x} cy={meas.y} r={node_radius}/> -->
                    <!-- <line class="meas-line" x1={meas.x} x2={meas.x} y1={meas.y + meas_std} y2={meas.y - meas_std}/> -->
                    <rect class="meas" x={meas.x-sqr_size/2} y={meas.y-sqr_size/2} width={sqr_size} height={sqr_size}/>
                {/each}

                {#each moving_beliefs as b}
                    <line class="belief-std"
                        x1={nodes_x_offset + b.id*node_x_spacing} x2={nodes_x_offset + b.id*node_x_spacing} 
                        y1={b.mean0 + b.std0 + ((b.mean1 - b.mean0) + (b.std1 - b.std0)) * $move_belief_progress} 
                        y2={b.mean0 - b.std0 + ((b.mean1 - b.mean0) - (b.std1 - b.std0)) * $move_belief_progress} />
                    <circle
                        class="belief-mean" r={node_radius}
                        cx={nodes_x_offset + b.id*node_x_spacing}
                        cy={b.mean0 + (b.mean1 - b.mean0) * $move_belief_progress} />
                {/each}

                {#each graph.var_nodes as _, i}
                    <line class:belief-std={highlight_id!=i} class:highlighted={highlight_id==i} 
                        class:hidden={hide_beliefs.includes(i)}
                        x1={nodes_x_offset + i*node_x_spacing} 
                        x2={nodes_x_offset + i*node_x_spacing} 
                        y1={beliefs[0][i] + beliefs[1][i]} 
                        y2={beliefs[0][i] - beliefs[1][i]}/>
                    <circle id="{i}" 
                        class:hidden={hide_beliefs.includes(i)}
                        class:belief-mean={highlight_id!=i} class:highlighted={highlight_id==i} 
                        cx={nodes_x_offset + i*node_x_spacing} cy={beliefs[0][i]} r={node_radius}/>

                    {#if display_batch}
                        <circle class="map-mean" cx={nodes_x_offset + i*node_x_spacing} cy={map[0].get(i, 0)} r={node_radius}/>
                        <line class="map-std" x1={nodes_x_offset + i*node_x_spacing} x2={nodes_x_offset + i*node_x_spacing} 
                            y1={map[0].get(i, 0) + Math.sqrt(map[1][i])} 
                            y2={map[0].get(i, 0) + node_radius}/>
                        <line class="map-std" x1={nodes_x_offset + i*node_x_spacing} x2={nodes_x_offset + i*node_x_spacing} 
                            y1={map[0].get(i, 0) - Math.sqrt(map[1][i])} 
                            y2={map[0].get(i, 0) - node_radius}/>
                    {/if}

                {/each}

                {#each message_bubbles as b}
                    <circle
                        class="mess-bubble" r={5}
                        cx={b.x0 + (b.x1 - b.x0) * $bubble_progress}
                        cy={b.y0 + (b.y1 - b.y0) * $bubble_progress}
                        opacity={1 - 4 * ($bubble_progress - 0.5) * ($bubble_progress - 0.5)} />
                {/each}

                <!-- <div class="center">
                    {#if visible_alert}
                    <p transition:fade id="alert">
                        Before starting add measurements!
                    </p>
                    {/if}
                </div> -->

            </svg>
        </div>


        <div id="panel2-container">
            <div id="panel2">
                <img id="pointer" src="images/pointer.svg" alt="pointer">

                <div class="hint bold-text" style="display: flex; align-items: center;">
                    Click on the canvas to add data factors.
                </div>
            </div>
        </div>


        <div id="panel-container" style="margin-top: 10px;">

        <div id="control-panel">


            <div id="double-panel">
                <!-- <div id="center">
                    <button class="mp-button" on:click={sync_iter}> 
                        1 iter
                    </button>
                </div> -->

                <div id="play-pause">
                    <span class="hint bold-text" >Run synchronous GBP: </span>

                    <div id="play-panel">
                        {#if sync_on}
                            <button class="gbp-button" on:click={toggleGBP}>
                                <svg class="icon" id="pause"><use xlink:href="#pauseIcon"></use></svg>
                            </button>
                        {:else}
                            <button class="gbp-button" on:click={toggleGBP}>
                                <svg class="icon" id="play"><use xlink:href="#playIcon"></use></svg>
                            </button>
                        {/if}                          
                        <span class="status">
                            Iteration {n_iters} <br> ({iters_per_sec[speed+2]} iters / s) 
                        </span>                    
                    </div>

                </div>            

                <div style="padding-left: 20px;">
                    <span class="hint bold-text" style="padding-left: 7px; padding-bottom: 10px;">Energy function: </span>
                    <ButtonGroup options={[{ id: 0, name: 'Squared' }, { id: 1, name: 'Huber' }]} labelTitle="" selected={robust} on:change={handleChangeRobust}/>
                </div>

                <!-- <div id="speed-slider-container" class="slider-container">
                    Speed: <span class="bold-text">{speed_labels[speed+2]}</span><br>
                    <input class="full-width-slider" type="range" min="-2" max="2" bind:value={speed} step="1"/>
                    <div class="status">
                        Iteration {n_iters}  ({iters_per_sec[speed+2]} iters / s) 
                    </div>
                </div>   -->
            </div>


            <span class="hint bold-text">
                Set the data factors:
            </span>



            <svg width="493" height="80" viewBox="0 0 493 80" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">

                <path id="Clear data factors" d="M414.406 53.3906C414.266 54.5938 413.82 55.5234 413.07 56.1797C412.326 56.8307 411.333 57.1562 410.094 57.1562C408.75 57.1562 407.672 56.6745 406.859 55.7109C406.052 54.7474 405.648 53.4583 405.648 51.8438V50.75C405.648 49.6927 405.836 48.763 406.211 47.9609C406.591 47.1589 407.128 46.5443 407.82 46.1172C408.513 45.6849 409.315 45.4688 410.227 45.4688C411.435 45.4688 412.404 45.8073 413.133 46.4844C413.862 47.1562 414.286 48.0885 414.406 49.2812H412.898C412.768 48.375 412.484 47.7188 412.047 47.3125C411.615 46.9062 411.008 46.7031 410.227 46.7031C409.268 46.7031 408.516 47.0573 407.969 47.7656C407.427 48.474 407.156 49.4818 407.156 50.7891V51.8906C407.156 53.125 407.414 54.1068 407.93 54.8359C408.445 55.5651 409.167 55.9297 410.094 55.9297C410.927 55.9297 411.565 55.7422 412.008 55.3672C412.456 54.987 412.753 54.3281 412.898 53.3906H414.406ZM417.805 57H416.359V45H417.805V57ZM423.633 57.1562C422.487 57.1562 421.555 56.7812 420.836 56.0312C420.117 55.276 419.758 54.2682 419.758 53.0078V52.7422C419.758 51.9036 419.917 51.1562 420.234 50.5C420.557 49.8385 421.005 49.3229 421.578 48.9531C422.156 48.5781 422.781 48.3906 423.453 48.3906C424.552 48.3906 425.406 48.7526 426.016 49.4766C426.625 50.2005 426.93 51.237 426.93 52.5859V53.1875H421.203C421.224 54.0208 421.466 54.6953 421.93 55.2109C422.398 55.7214 422.992 55.9766 423.711 55.9766C424.221 55.9766 424.654 55.8724 425.008 55.6641C425.362 55.4557 425.672 55.1797 425.938 54.8359L426.82 55.5234C426.112 56.612 425.049 57.1562 423.633 57.1562ZM423.453 49.5781C422.87 49.5781 422.38 49.7917 421.984 50.2188C421.589 50.6406 421.344 51.2344 421.25 52H425.484V51.8906C425.443 51.1562 425.245 50.5885 424.891 50.1875C424.536 49.7812 424.057 49.5781 423.453 49.5781ZM433.828 57C433.745 56.8333 433.677 56.5365 433.625 56.1094C432.953 56.8073 432.151 57.1562 431.219 57.1562C430.385 57.1562 429.701 56.9219 429.164 56.4531C428.633 55.9792 428.367 55.3802 428.367 54.6562C428.367 53.776 428.701 53.0938 429.367 52.6094C430.039 52.1198 430.982 51.875 432.195 51.875H433.602V51.2109C433.602 50.7057 433.451 50.3047 433.148 50.0078C432.846 49.7057 432.401 49.5547 431.812 49.5547C431.297 49.5547 430.865 49.6849 430.516 49.9453C430.167 50.2057 429.992 50.5208 429.992 50.8906H428.539C428.539 50.4688 428.688 50.0625 428.984 49.6719C429.286 49.276 429.693 48.9635 430.203 48.7344C430.719 48.5052 431.284 48.3906 431.898 48.3906C432.872 48.3906 433.635 48.6354 434.188 49.125C434.74 49.6094 435.026 50.2786 435.047 51.1328V55.0234C435.047 55.7995 435.146 56.4167 435.344 56.875V57H433.828ZM431.43 55.8984C431.883 55.8984 432.312 55.7812 432.719 55.5469C433.125 55.3125 433.419 55.0078 433.602 54.6328V52.8984H432.469C430.698 52.8984 429.812 53.4167 429.812 54.4531C429.812 54.9062 429.964 55.2604 430.266 55.5156C430.568 55.7708 430.956 55.8984 431.43 55.8984ZM441.398 49.8438C441.18 49.8073 440.943 49.7891 440.688 49.7891C439.74 49.7891 439.096 50.1927 438.758 51V57H437.312V48.5469H438.719L438.742 49.5234C439.216 48.7682 439.888 48.3906 440.758 48.3906C441.039 48.3906 441.253 48.4271 441.398 48.5V49.8438ZM446.352 52.7031C446.352 51.4062 446.659 50.3646 447.273 49.5781C447.888 48.7865 448.693 48.3906 449.688 48.3906C450.677 48.3906 451.461 48.7292 452.039 49.4062V45H453.484V57H452.156L452.086 56.0938C451.508 56.8021 450.703 57.1562 449.672 57.1562C448.693 57.1562 447.893 56.7552 447.273 55.9531C446.659 55.151 446.352 54.1042 446.352 52.8125V52.7031ZM447.797 52.8672C447.797 53.8255 447.995 54.5755 448.391 55.1172C448.786 55.6589 449.333 55.9297 450.031 55.9297C450.948 55.9297 451.617 55.5182 452.039 54.6953V50.8125C451.607 50.0156 450.943 49.6172 450.047 49.6172C449.339 49.6172 448.786 49.8906 448.391 50.4375C447.995 50.9844 447.797 51.7943 447.797 52.8672ZM460.953 57C460.87 56.8333 460.802 56.5365 460.75 56.1094C460.078 56.8073 459.276 57.1562 458.344 57.1562C457.51 57.1562 456.826 56.9219 456.289 56.4531C455.758 55.9792 455.492 55.3802 455.492 54.6562C455.492 53.776 455.826 53.0938 456.492 52.6094C457.164 52.1198 458.107 51.875 459.32 51.875H460.727V51.2109C460.727 50.7057 460.576 50.3047 460.273 50.0078C459.971 49.7057 459.526 49.5547 458.938 49.5547C458.422 49.5547 457.99 49.6849 457.641 49.9453C457.292 50.2057 457.117 50.5208 457.117 50.8906H455.664C455.664 50.4688 455.812 50.0625 456.109 49.6719C456.411 49.276 456.818 48.9635 457.328 48.7344C457.844 48.5052 458.409 48.3906 459.023 48.3906C459.997 48.3906 460.76 48.6354 461.312 49.125C461.865 49.6094 462.151 50.2786 462.172 51.1328V55.0234C462.172 55.7995 462.271 56.4167 462.469 56.875V57H460.953ZM458.555 55.8984C459.008 55.8984 459.438 55.7812 459.844 55.5469C460.25 55.3125 460.544 55.0078 460.727 54.6328V52.8984H459.594C457.823 52.8984 456.938 53.4167 456.938 54.4531C456.938 54.9062 457.089 55.2604 457.391 55.5156C457.693 55.7708 458.081 55.8984 458.555 55.8984ZM466.398 46.5V48.5469H467.977V49.6641H466.398V54.9062C466.398 55.2448 466.469 55.5 466.609 55.6719C466.75 55.8385 466.99 55.9219 467.328 55.9219C467.495 55.9219 467.724 55.8906 468.016 55.8281V57C467.635 57.1042 467.266 57.1562 466.906 57.1562C466.26 57.1562 465.773 56.9609 465.445 56.5703C465.117 56.1797 464.953 55.625 464.953 54.9062V49.6641H463.414V48.5469H464.953V46.5H466.398ZM474.891 57C474.807 56.8333 474.74 56.5365 474.688 56.1094C474.016 56.8073 473.214 57.1562 472.281 57.1562C471.448 57.1562 470.763 56.9219 470.227 56.4531C469.695 55.9792 469.43 55.3802 469.43 54.6562C469.43 53.776 469.763 53.0938 470.43 52.6094C471.102 52.1198 472.044 51.875 473.258 51.875H474.664V51.2109C474.664 50.7057 474.513 50.3047 474.211 50.0078C473.909 49.7057 473.464 49.5547 472.875 49.5547C472.359 49.5547 471.927 49.6849 471.578 49.9453C471.229 50.2057 471.055 50.5208 471.055 50.8906H469.602C469.602 50.4688 469.75 50.0625 470.047 49.6719C470.349 49.276 470.755 48.9635 471.266 48.7344C471.781 48.5052 472.346 48.3906 472.961 48.3906C473.935 48.3906 474.698 48.6354 475.25 49.125C475.802 49.6094 476.089 50.2786 476.109 51.1328V55.0234C476.109 55.7995 476.208 56.4167 476.406 56.875V57H474.891ZM472.492 55.8984C472.945 55.8984 473.375 55.7812 473.781 55.5469C474.188 55.3125 474.482 55.0078 474.664 54.6328V52.8984H473.531C471.76 52.8984 470.875 53.4167 470.875 54.4531C470.875 54.9062 471.026 55.2604 471.328 55.5156C471.63 55.7708 472.018 55.8984 472.492 55.8984ZM417.547 76V68.6641H416.211V67.5469H417.547V66.6797C417.547 65.7734 417.789 65.0729 418.273 64.5781C418.758 64.0833 419.443 63.8359 420.328 63.8359C420.661 63.8359 420.992 63.8802 421.32 63.9688L421.242 65.1406C420.997 65.0938 420.737 65.0703 420.461 65.0703C419.992 65.0703 419.63 65.2083 419.375 65.4844C419.12 65.7552 418.992 66.1458 418.992 66.6562V67.5469H420.797V68.6641H418.992V76H417.547ZM427.617 76C427.534 75.8333 427.466 75.5365 427.414 75.1094C426.742 75.8073 425.94 76.1562 425.008 76.1562C424.174 76.1562 423.49 75.9219 422.953 75.4531C422.422 74.9792 422.156 74.3802 422.156 73.6562C422.156 72.776 422.49 72.0938 423.156 71.6094C423.828 71.1198 424.771 70.875 425.984 70.875H427.391V70.2109C427.391 69.7057 427.24 69.3047 426.938 69.0078C426.635 68.7057 426.19 68.5547 425.602 68.5547C425.086 68.5547 424.654 68.6849 424.305 68.9453C423.956 69.2057 423.781 69.5208 423.781 69.8906H422.328C422.328 69.4688 422.477 69.0625 422.773 68.6719C423.076 68.276 423.482 67.9635 423.992 67.7344C424.508 67.5052 425.073 67.3906 425.688 67.3906C426.661 67.3906 427.424 67.6354 427.977 68.125C428.529 68.6094 428.815 69.2786 428.836 70.1328V74.0234C428.836 74.7995 428.935 75.4167 429.133 75.875V76H427.617ZM425.219 74.8984C425.672 74.8984 426.102 74.7812 426.508 74.5469C426.914 74.3125 427.208 74.0078 427.391 73.6328V71.8984H426.258C424.487 71.8984 423.602 72.4167 423.602 73.4531C423.602 73.9062 423.753 74.2604 424.055 74.5156C424.357 74.7708 424.745 74.8984 425.219 74.8984ZM434.492 74.9766C435.008 74.9766 435.458 74.8203 435.844 74.5078C436.229 74.1953 436.443 73.8047 436.484 73.3359H437.852C437.826 73.8203 437.659 74.2812 437.352 74.7188C437.044 75.1562 436.633 75.5052 436.117 75.7656C435.607 76.026 435.065 76.1562 434.492 76.1562C433.341 76.1562 432.424 75.7734 431.742 75.0078C431.065 74.237 430.727 73.1849 430.727 71.8516V71.6094C430.727 70.7865 430.878 70.0547 431.18 69.4141C431.482 68.7734 431.914 68.276 432.477 67.9219C433.044 67.5677 433.714 67.3906 434.484 67.3906C435.432 67.3906 436.219 67.6745 436.844 68.2422C437.474 68.8099 437.81 69.5469 437.852 70.4531H436.484C436.443 69.9062 436.234 69.4583 435.859 69.1094C435.49 68.7552 435.031 68.5781 434.484 68.5781C433.75 68.5781 433.18 68.8438 432.773 69.375C432.372 69.901 432.172 70.6641 432.172 71.6641V71.9375C432.172 72.9115 432.372 73.6615 432.773 74.1875C433.174 74.7135 433.747 74.9766 434.492 74.9766ZM441.438 65.5V67.5469H443.016V68.6641H441.438V73.9062C441.438 74.2448 441.508 74.5 441.648 74.6719C441.789 74.8385 442.029 74.9219 442.367 74.9219C442.534 74.9219 442.763 74.8906 443.055 74.8281V76C442.674 76.1042 442.305 76.1562 441.945 76.1562C441.299 76.1562 440.812 75.9609 440.484 75.5703C440.156 75.1797 439.992 74.625 439.992 73.9062V68.6641H438.453V67.5469H439.992V65.5H441.438ZM444.172 71.6953C444.172 70.8672 444.333 70.1224 444.656 69.4609C444.984 68.7995 445.438 68.2891 446.016 67.9297C446.599 67.5703 447.263 67.3906 448.008 67.3906C449.159 67.3906 450.089 67.7891 450.797 68.5859C451.51 69.3828 451.867 70.4427 451.867 71.7656V71.8672C451.867 72.6901 451.708 73.4297 451.391 74.0859C451.078 74.737 450.628 75.2448 450.039 75.6094C449.456 75.974 448.784 76.1562 448.023 76.1562C446.878 76.1562 445.948 75.7578 445.234 74.9609C444.526 74.1641 444.172 73.1094 444.172 71.7969V71.6953ZM445.625 71.8672C445.625 72.8047 445.841 73.5573 446.273 74.125C446.711 74.6927 447.294 74.9766 448.023 74.9766C448.758 74.9766 449.341 74.6901 449.773 74.1172C450.206 73.5391 450.422 72.7318 450.422 71.6953C450.422 70.7682 450.201 70.0182 449.758 69.4453C449.32 68.8672 448.737 68.5781 448.008 68.5781C447.294 68.5781 446.719 68.862 446.281 69.4297C445.844 69.9974 445.625 70.8099 445.625 71.8672ZM457.766 68.8438C457.547 68.8073 457.31 68.7891 457.055 68.7891C456.107 68.7891 455.464 69.1927 455.125 70V76H453.68V67.5469H455.086L455.109 68.5234C455.583 67.7682 456.255 67.3906 457.125 67.3906C457.406 67.3906 457.62 67.4271 457.766 67.5V68.8438ZM464.023 73.7578C464.023 73.3672 463.875 73.0651 463.578 72.8516C463.286 72.6328 462.773 72.4453 462.039 72.2891C461.31 72.1328 460.729 71.9453 460.297 71.7266C459.87 71.5078 459.552 71.2474 459.344 70.9453C459.141 70.6432 459.039 70.2839 459.039 69.8672C459.039 69.1745 459.331 68.5885 459.914 68.1094C460.503 67.6302 461.253 67.3906 462.164 67.3906C463.122 67.3906 463.898 67.638 464.492 68.1328C465.091 68.6276 465.391 69.2604 465.391 70.0312H463.938C463.938 69.6354 463.768 69.2943 463.43 69.0078C463.096 68.7214 462.674 68.5781 462.164 68.5781C461.638 68.5781 461.227 68.6927 460.93 68.9219C460.633 69.151 460.484 69.4505 460.484 69.8203C460.484 70.1693 460.622 70.4323 460.898 70.6094C461.174 70.7865 461.672 70.9557 462.391 71.1172C463.115 71.2786 463.701 71.4714 464.148 71.6953C464.596 71.9193 464.927 72.1901 465.141 72.5078C465.359 72.8203 465.469 73.2031 465.469 73.6562C465.469 74.4115 465.167 75.0182 464.562 75.4766C463.958 75.9297 463.174 76.1562 462.211 76.1562C461.534 76.1562 460.935 76.0365 460.414 75.7969C459.893 75.5573 459.484 75.224 459.188 74.7969C458.896 74.3646 458.75 73.8984 458.75 73.3984H460.195C460.221 73.8828 460.414 74.2682 460.773 74.5547C461.138 74.8359 461.617 74.9766 462.211 74.9766C462.758 74.9766 463.195 74.8672 463.523 74.6484C463.857 74.4245 464.023 74.1276 464.023 73.7578Z" fill="black"/>
                <path id="Random data factors" d="M285.703 52.3984H283.031V57H281.523V45.625H285.289C286.57 45.625 287.555 45.9167 288.242 46.5C288.935 47.0833 289.281 47.9323 289.281 49.0469C289.281 49.7552 289.089 50.3724 288.703 50.8984C288.323 51.4245 287.792 51.8177 287.109 52.0781L289.781 56.9062V57H288.172L285.703 52.3984ZM283.031 51.1719H285.336C286.081 51.1719 286.672 50.9792 287.109 50.5938C287.552 50.2083 287.773 49.6927 287.773 49.0469C287.773 48.3438 287.562 47.8047 287.141 47.4297C286.724 47.0547 286.12 46.8646 285.328 46.8594H283.031V51.1719ZM296.383 57C296.299 56.8333 296.232 56.5365 296.18 56.1094C295.508 56.8073 294.706 57.1562 293.773 57.1562C292.94 57.1562 292.255 56.9219 291.719 56.4531C291.188 55.9792 290.922 55.3802 290.922 54.6562C290.922 53.776 291.255 53.0938 291.922 52.6094C292.594 52.1198 293.536 51.875 294.75 51.875H296.156V51.2109C296.156 50.7057 296.005 50.3047 295.703 50.0078C295.401 49.7057 294.956 49.5547 294.367 49.5547C293.852 49.5547 293.419 49.6849 293.07 49.9453C292.721 50.2057 292.547 50.5208 292.547 50.8906H291.094C291.094 50.4688 291.242 50.0625 291.539 49.6719C291.841 49.276 292.247 48.9635 292.758 48.7344C293.273 48.5052 293.839 48.3906 294.453 48.3906C295.427 48.3906 296.19 48.6354 296.742 49.125C297.294 49.6094 297.581 50.2786 297.602 51.1328V55.0234C297.602 55.7995 297.701 56.4167 297.898 56.875V57H296.383ZM293.984 55.8984C294.438 55.8984 294.867 55.7812 295.273 55.5469C295.68 55.3125 295.974 55.0078 296.156 54.6328V52.8984H295.023C293.253 52.8984 292.367 53.4167 292.367 54.4531C292.367 54.9062 292.518 55.2604 292.82 55.5156C293.122 55.7708 293.51 55.8984 293.984 55.8984ZM301.234 48.5469L301.281 49.6094C301.927 48.7969 302.771 48.3906 303.812 48.3906C305.599 48.3906 306.5 49.3984 306.516 51.4141V57H305.07V51.4062C305.065 50.7969 304.924 50.3464 304.648 50.0547C304.378 49.763 303.953 49.6172 303.375 49.6172C302.906 49.6172 302.495 49.7422 302.141 49.9922C301.786 50.2422 301.51 50.5703 301.312 50.9766V57H299.867V48.5469H301.234ZM308.344 52.7031C308.344 51.4062 308.651 50.3646 309.266 49.5781C309.88 48.7865 310.685 48.3906 311.68 48.3906C312.669 48.3906 313.453 48.7292 314.031 49.4062V45H315.477V57H314.148L314.078 56.0938C313.5 56.8021 312.695 57.1562 311.664 57.1562C310.685 57.1562 309.885 56.7552 309.266 55.9531C308.651 55.151 308.344 54.1042 308.344 52.8125V52.7031ZM309.789 52.8672C309.789 53.8255 309.987 54.5755 310.383 55.1172C310.779 55.6589 311.326 55.9297 312.023 55.9297C312.94 55.9297 313.609 55.5182 314.031 54.6953V50.8125C313.599 50.0156 312.935 49.6172 312.039 49.6172C311.331 49.6172 310.779 49.8906 310.383 50.4375C309.987 50.9844 309.789 51.7943 309.789 52.8672ZM317.344 52.6953C317.344 51.8672 317.505 51.1224 317.828 50.4609C318.156 49.7995 318.609 49.2891 319.188 48.9297C319.771 48.5703 320.435 48.3906 321.18 48.3906C322.331 48.3906 323.26 48.7891 323.969 49.5859C324.682 50.3828 325.039 51.4427 325.039 52.7656V52.8672C325.039 53.6901 324.88 54.4297 324.562 55.0859C324.25 55.737 323.799 56.2448 323.211 56.6094C322.628 56.974 321.956 57.1562 321.195 57.1562C320.049 57.1562 319.12 56.7578 318.406 55.9609C317.698 55.1641 317.344 54.1094 317.344 52.7969V52.6953ZM318.797 52.8672C318.797 53.8047 319.013 54.5573 319.445 55.125C319.883 55.6927 320.466 55.9766 321.195 55.9766C321.93 55.9766 322.513 55.6901 322.945 55.1172C323.378 54.5391 323.594 53.7318 323.594 52.6953C323.594 51.7682 323.372 51.0182 322.93 50.4453C322.492 49.8672 321.909 49.5781 321.18 49.5781C320.466 49.5781 319.891 49.862 319.453 50.4297C319.016 50.9974 318.797 51.8099 318.797 52.8672ZM328.211 48.5469L328.25 49.4844C328.87 48.7552 329.706 48.3906 330.758 48.3906C331.94 48.3906 332.745 48.8438 333.172 49.75C333.453 49.3438 333.818 49.0156 334.266 48.7656C334.719 48.5156 335.253 48.3906 335.867 48.3906C337.721 48.3906 338.664 49.3724 338.695 51.3359V57H337.25V51.4219C337.25 50.8177 337.112 50.3672 336.836 50.0703C336.56 49.7682 336.096 49.6172 335.445 49.6172C334.909 49.6172 334.464 49.7786 334.109 50.1016C333.755 50.4193 333.549 50.849 333.492 51.3906V57H332.039V51.4609C332.039 50.2318 331.438 49.6172 330.234 49.6172C329.286 49.6172 328.638 50.0208 328.289 50.8281V57H326.844V48.5469H328.211ZM267.664 71.7031C267.664 70.4062 267.971 69.3646 268.586 68.5781C269.201 67.7865 270.005 67.3906 271 67.3906C271.99 67.3906 272.773 67.7292 273.352 68.4062V64H274.797V76H273.469L273.398 75.0938C272.82 75.8021 272.016 76.1562 270.984 76.1562C270.005 76.1562 269.206 75.7552 268.586 74.9531C267.971 74.151 267.664 73.1042 267.664 71.8125V71.7031ZM269.109 71.8672C269.109 72.8255 269.307 73.5755 269.703 74.1172C270.099 74.6589 270.646 74.9297 271.344 74.9297C272.26 74.9297 272.93 74.5182 273.352 73.6953V69.8125C272.919 69.0156 272.255 68.6172 271.359 68.6172C270.651 68.6172 270.099 68.8906 269.703 69.4375C269.307 69.9844 269.109 70.7943 269.109 71.8672ZM282.266 76C282.182 75.8333 282.115 75.5365 282.062 75.1094C281.391 75.8073 280.589 76.1562 279.656 76.1562C278.823 76.1562 278.138 75.9219 277.602 75.4531C277.07 74.9792 276.805 74.3802 276.805 73.6562C276.805 72.776 277.138 72.0938 277.805 71.6094C278.477 71.1198 279.419 70.875 280.633 70.875H282.039V70.2109C282.039 69.7057 281.888 69.3047 281.586 69.0078C281.284 68.7057 280.839 68.5547 280.25 68.5547C279.734 68.5547 279.302 68.6849 278.953 68.9453C278.604 69.2057 278.43 69.5208 278.43 69.8906H276.977C276.977 69.4688 277.125 69.0625 277.422 68.6719C277.724 68.276 278.13 67.9635 278.641 67.7344C279.156 67.5052 279.721 67.3906 280.336 67.3906C281.31 67.3906 282.073 67.6354 282.625 68.125C283.177 68.6094 283.464 69.2786 283.484 70.1328V74.0234C283.484 74.7995 283.583 75.4167 283.781 75.875V76H282.266ZM279.867 74.8984C280.32 74.8984 280.75 74.7812 281.156 74.5469C281.562 74.3125 281.857 74.0078 282.039 73.6328V71.8984H280.906C279.135 71.8984 278.25 72.4167 278.25 73.4531C278.25 73.9062 278.401 74.2604 278.703 74.5156C279.005 74.7708 279.393 74.8984 279.867 74.8984ZM287.711 65.5V67.5469H289.289V68.6641H287.711V73.9062C287.711 74.2448 287.781 74.5 287.922 74.6719C288.062 74.8385 288.302 74.9219 288.641 74.9219C288.807 74.9219 289.036 74.8906 289.328 74.8281V76C288.948 76.1042 288.578 76.1562 288.219 76.1562C287.573 76.1562 287.086 75.9609 286.758 75.5703C286.43 75.1797 286.266 74.625 286.266 73.9062V68.6641H284.727V67.5469H286.266V65.5H287.711ZM296.203 76C296.12 75.8333 296.052 75.5365 296 75.1094C295.328 75.8073 294.526 76.1562 293.594 76.1562C292.76 76.1562 292.076 75.9219 291.539 75.4531C291.008 74.9792 290.742 74.3802 290.742 73.6562C290.742 72.776 291.076 72.0938 291.742 71.6094C292.414 71.1198 293.357 70.875 294.57 70.875H295.977V70.2109C295.977 69.7057 295.826 69.3047 295.523 69.0078C295.221 68.7057 294.776 68.5547 294.188 68.5547C293.672 68.5547 293.24 68.6849 292.891 68.9453C292.542 69.2057 292.367 69.5208 292.367 69.8906H290.914C290.914 69.4688 291.062 69.0625 291.359 68.6719C291.661 68.276 292.068 67.9635 292.578 67.7344C293.094 67.5052 293.659 67.3906 294.273 67.3906C295.247 67.3906 296.01 67.6354 296.562 68.125C297.115 68.6094 297.401 69.2786 297.422 70.1328V74.0234C297.422 74.7995 297.521 75.4167 297.719 75.875V76H296.203ZM293.805 74.8984C294.258 74.8984 294.688 74.7812 295.094 74.5469C295.5 74.3125 295.794 74.0078 295.977 73.6328V71.8984H294.844C293.073 71.8984 292.188 72.4167 292.188 73.4531C292.188 73.9062 292.339 74.2604 292.641 74.5156C292.943 74.7708 293.331 74.8984 293.805 74.8984ZM304.367 76V68.6641H303.031V67.5469H304.367V66.6797C304.367 65.7734 304.609 65.0729 305.094 64.5781C305.578 64.0833 306.263 63.8359 307.148 63.8359C307.482 63.8359 307.812 63.8802 308.141 63.9688L308.062 65.1406C307.818 65.0938 307.557 65.0703 307.281 65.0703C306.812 65.0703 306.451 65.2083 306.195 65.4844C305.94 65.7552 305.812 66.1458 305.812 66.6562V67.5469H307.617V68.6641H305.812V76H304.367ZM314.438 76C314.354 75.8333 314.286 75.5365 314.234 75.1094C313.562 75.8073 312.76 76.1562 311.828 76.1562C310.995 76.1562 310.31 75.9219 309.773 75.4531C309.242 74.9792 308.977 74.3802 308.977 73.6562C308.977 72.776 309.31 72.0938 309.977 71.6094C310.648 71.1198 311.591 70.875 312.805 70.875H314.211V70.2109C314.211 69.7057 314.06 69.3047 313.758 69.0078C313.456 68.7057 313.01 68.5547 312.422 68.5547C311.906 68.5547 311.474 68.6849 311.125 68.9453C310.776 69.2057 310.602 69.5208 310.602 69.8906H309.148C309.148 69.4688 309.297 69.0625 309.594 68.6719C309.896 68.276 310.302 67.9635 310.812 67.7344C311.328 67.5052 311.893 67.3906 312.508 67.3906C313.482 67.3906 314.245 67.6354 314.797 68.125C315.349 68.6094 315.635 69.2786 315.656 70.1328V74.0234C315.656 74.7995 315.755 75.4167 315.953 75.875V76H314.438ZM312.039 74.8984C312.492 74.8984 312.922 74.7812 313.328 74.5469C313.734 74.3125 314.029 74.0078 314.211 73.6328V71.8984H313.078C311.307 71.8984 310.422 72.4167 310.422 73.4531C310.422 73.9062 310.573 74.2604 310.875 74.5156C311.177 74.7708 311.565 74.8984 312.039 74.8984ZM321.312 74.9766C321.828 74.9766 322.279 74.8203 322.664 74.5078C323.049 74.1953 323.263 73.8047 323.305 73.3359H324.672C324.646 73.8203 324.479 74.2812 324.172 74.7188C323.865 75.1562 323.453 75.5052 322.938 75.7656C322.427 76.026 321.885 76.1562 321.312 76.1562C320.161 76.1562 319.245 75.7734 318.562 75.0078C317.885 74.237 317.547 73.1849 317.547 71.8516V71.6094C317.547 70.7865 317.698 70.0547 318 69.4141C318.302 68.7734 318.734 68.276 319.297 67.9219C319.865 67.5677 320.534 67.3906 321.305 67.3906C322.253 67.3906 323.039 67.6745 323.664 68.2422C324.294 68.8099 324.63 69.5469 324.672 70.4531H323.305C323.263 69.9062 323.055 69.4583 322.68 69.1094C322.31 68.7552 321.852 68.5781 321.305 68.5781C320.57 68.5781 320 68.8438 319.594 69.375C319.193 69.901 318.992 70.6641 318.992 71.6641V71.9375C318.992 72.9115 319.193 73.6615 319.594 74.1875C319.995 74.7135 320.568 74.9766 321.312 74.9766ZM328.258 65.5V67.5469H329.836V68.6641H328.258V73.9062C328.258 74.2448 328.328 74.5 328.469 74.6719C328.609 74.8385 328.849 74.9219 329.188 74.9219C329.354 74.9219 329.583 74.8906 329.875 74.8281V76C329.495 76.1042 329.125 76.1562 328.766 76.1562C328.12 76.1562 327.633 75.9609 327.305 75.5703C326.977 75.1797 326.812 74.625 326.812 73.9062V68.6641H325.273V67.5469H326.812V65.5H328.258ZM330.992 71.6953C330.992 70.8672 331.154 70.1224 331.477 69.4609C331.805 68.7995 332.258 68.2891 332.836 67.9297C333.419 67.5703 334.083 67.3906 334.828 67.3906C335.979 67.3906 336.909 67.7891 337.617 68.5859C338.331 69.3828 338.688 70.4427 338.688 71.7656V71.8672C338.688 72.6901 338.529 73.4297 338.211 74.0859C337.898 74.737 337.448 75.2448 336.859 75.6094C336.276 75.974 335.604 76.1562 334.844 76.1562C333.698 76.1562 332.768 75.7578 332.055 74.9609C331.346 74.1641 330.992 73.1094 330.992 71.7969V71.6953ZM332.445 71.8672C332.445 72.8047 332.661 73.5573 333.094 74.125C333.531 74.6927 334.115 74.9766 334.844 74.9766C335.578 74.9766 336.161 74.6901 336.594 74.1172C337.026 73.5391 337.242 72.7318 337.242 71.6953C337.242 70.7682 337.021 70.0182 336.578 69.4453C336.141 68.8672 335.557 68.5781 334.828 68.5781C334.115 68.5781 333.539 68.862 333.102 69.4297C332.664 69.9974 332.445 70.8099 332.445 71.8672ZM344.586 68.8438C344.367 68.8073 344.13 68.7891 343.875 68.7891C342.927 68.7891 342.284 69.1927 341.945 70V76H340.5V67.5469H341.906L341.93 68.5234C342.404 67.7682 343.076 67.3906 343.945 67.3906C344.227 67.3906 344.44 67.4271 344.586 67.5V68.8438ZM350.844 73.7578C350.844 73.3672 350.695 73.0651 350.398 72.8516C350.107 72.6328 349.594 72.4453 348.859 72.2891C348.13 72.1328 347.549 71.9453 347.117 71.7266C346.69 71.5078 346.372 71.2474 346.164 70.9453C345.961 70.6432 345.859 70.2839 345.859 69.8672C345.859 69.1745 346.151 68.5885 346.734 68.1094C347.323 67.6302 348.073 67.3906 348.984 67.3906C349.943 67.3906 350.719 67.638 351.312 68.1328C351.911 68.6276 352.211 69.2604 352.211 70.0312H350.758C350.758 69.6354 350.589 69.2943 350.25 69.0078C349.917 68.7214 349.495 68.5781 348.984 68.5781C348.458 68.5781 348.047 68.6927 347.75 68.9219C347.453 69.151 347.305 69.4505 347.305 69.8203C347.305 70.1693 347.443 70.4323 347.719 70.6094C347.995 70.7865 348.492 70.9557 349.211 71.1172C349.935 71.2786 350.521 71.4714 350.969 71.6953C351.417 71.9193 351.747 72.1901 351.961 72.5078C352.18 72.8203 352.289 73.2031 352.289 73.6562C352.289 74.4115 351.987 75.0182 351.383 75.4766C350.779 75.9297 349.995 76.1562 349.031 76.1562C348.354 76.1562 347.755 76.0365 347.234 75.7969C346.714 75.5573 346.305 75.224 346.008 74.7969C345.716 74.3646 345.57 73.8984 345.57 73.3984H347.016C347.042 73.8828 347.234 74.2682 347.594 74.5547C347.958 74.8359 348.438 74.9766 349.031 74.9766C349.578 74.9766 350.016 74.8672 350.344 74.6484C350.677 74.4245 350.844 74.1276 350.844 73.7578Z" fill="black"/>
                <path id="Step data factors" d="M144.75 51.9297C143.464 51.5599 142.526 51.1068 141.938 50.5703C141.354 50.0286 141.062 49.362 141.062 48.5703C141.062 47.6745 141.419 46.9349 142.133 46.3516C142.852 45.763 143.784 45.4688 144.93 45.4688C145.711 45.4688 146.406 45.6198 147.016 45.9219C147.63 46.224 148.104 46.6406 148.438 47.1719C148.776 47.7031 148.945 48.2839 148.945 48.9141H147.438C147.438 48.2266 147.219 47.6875 146.781 47.2969C146.344 46.901 145.727 46.7031 144.93 46.7031C144.19 46.7031 143.612 46.8672 143.195 47.1953C142.784 47.5182 142.578 47.9688 142.578 48.5469C142.578 49.0104 142.773 49.4036 143.164 49.7266C143.56 50.0443 144.229 50.3359 145.172 50.6016C146.12 50.8672 146.859 51.1615 147.391 51.4844C147.927 51.8021 148.323 52.1745 148.578 52.6016C148.839 53.0286 148.969 53.5312 148.969 54.1094C148.969 55.0312 148.609 55.7708 147.891 56.3281C147.172 56.8802 146.211 57.1562 145.008 57.1562C144.227 57.1562 143.497 57.0078 142.82 56.7109C142.143 56.4089 141.62 55.9974 141.25 55.4766C140.885 54.9557 140.703 54.3646 140.703 53.7031H142.211C142.211 54.3906 142.464 54.9349 142.969 55.3359C143.479 55.7318 144.159 55.9297 145.008 55.9297C145.799 55.9297 146.406 55.7682 146.828 55.4453C147.25 55.1224 147.461 54.6823 147.461 54.125C147.461 53.5677 147.266 53.138 146.875 52.8359C146.484 52.5286 145.776 52.2266 144.75 51.9297ZM152.633 46.5V48.5469H154.211V49.6641H152.633V54.9062C152.633 55.2448 152.703 55.5 152.844 55.6719C152.984 55.8385 153.224 55.9219 153.562 55.9219C153.729 55.9219 153.958 55.8906 154.25 55.8281V57C153.87 57.1042 153.5 57.1562 153.141 57.1562C152.495 57.1562 152.008 56.9609 151.68 56.5703C151.352 56.1797 151.188 55.625 151.188 54.9062V49.6641H149.648V48.5469H151.188V46.5H152.633ZM159.414 57.1562C158.268 57.1562 157.336 56.7812 156.617 56.0312C155.898 55.276 155.539 54.2682 155.539 53.0078V52.7422C155.539 51.9036 155.698 51.1562 156.016 50.5C156.339 49.8385 156.786 49.3229 157.359 48.9531C157.938 48.5781 158.562 48.3906 159.234 48.3906C160.333 48.3906 161.188 48.7526 161.797 49.4766C162.406 50.2005 162.711 51.237 162.711 52.5859V53.1875H156.984C157.005 54.0208 157.247 54.6953 157.711 55.2109C158.18 55.7214 158.773 55.9766 159.492 55.9766C160.003 55.9766 160.435 55.8724 160.789 55.6641C161.143 55.4557 161.453 55.1797 161.719 54.8359L162.602 55.5234C161.893 56.612 160.831 57.1562 159.414 57.1562ZM159.234 49.5781C158.651 49.5781 158.161 49.7917 157.766 50.2188C157.37 50.6406 157.125 51.2344 157.031 52H161.266V51.8906C161.224 51.1562 161.026 50.5885 160.672 50.1875C160.318 49.7812 159.839 49.5781 159.234 49.5781ZM171.531 52.8672C171.531 54.1536 171.237 55.1901 170.648 55.9766C170.06 56.763 169.263 57.1562 168.258 57.1562C167.232 57.1562 166.424 56.8307 165.836 56.1797V60.25H164.391V48.5469H165.711L165.781 49.4844C166.37 48.7552 167.188 48.3906 168.234 48.3906C169.25 48.3906 170.052 48.7734 170.641 49.5391C171.234 50.3047 171.531 51.3698 171.531 52.7344V52.8672ZM170.086 52.7031C170.086 51.75 169.883 50.9974 169.477 50.4453C169.07 49.8932 168.513 49.6172 167.805 49.6172C166.93 49.6172 166.273 50.0052 165.836 50.7812V54.8203C166.268 55.5911 166.93 55.9766 167.82 55.9766C168.513 55.9766 169.062 55.7031 169.469 55.1562C169.88 54.6042 170.086 53.7865 170.086 52.7031ZM176.992 52.7031C176.992 51.4062 177.299 50.3646 177.914 49.5781C178.529 48.7865 179.333 48.3906 180.328 48.3906C181.318 48.3906 182.102 48.7292 182.68 49.4062V45H184.125V57H182.797L182.727 56.0938C182.148 56.8021 181.344 57.1562 180.312 57.1562C179.333 57.1562 178.534 56.7552 177.914 55.9531C177.299 55.151 176.992 54.1042 176.992 52.8125V52.7031ZM178.438 52.8672C178.438 53.8255 178.635 54.5755 179.031 55.1172C179.427 55.6589 179.974 55.9297 180.672 55.9297C181.589 55.9297 182.258 55.5182 182.68 54.6953V50.8125C182.247 50.0156 181.583 49.6172 180.688 49.6172C179.979 49.6172 179.427 49.8906 179.031 50.4375C178.635 50.9844 178.438 51.7943 178.438 52.8672ZM191.594 57C191.51 56.8333 191.443 56.5365 191.391 56.1094C190.719 56.8073 189.917 57.1562 188.984 57.1562C188.151 57.1562 187.466 56.9219 186.93 56.4531C186.398 55.9792 186.133 55.3802 186.133 54.6562C186.133 53.776 186.466 53.0938 187.133 52.6094C187.805 52.1198 188.747 51.875 189.961 51.875H191.367V51.2109C191.367 50.7057 191.216 50.3047 190.914 50.0078C190.612 49.7057 190.167 49.5547 189.578 49.5547C189.062 49.5547 188.63 49.6849 188.281 49.9453C187.932 50.2057 187.758 50.5208 187.758 50.8906H186.305C186.305 50.4688 186.453 50.0625 186.75 49.6719C187.052 49.276 187.458 48.9635 187.969 48.7344C188.484 48.5052 189.049 48.3906 189.664 48.3906C190.638 48.3906 191.401 48.6354 191.953 49.125C192.505 49.6094 192.792 50.2786 192.812 51.1328V55.0234C192.812 55.7995 192.911 56.4167 193.109 56.875V57H191.594ZM189.195 55.8984C189.648 55.8984 190.078 55.7812 190.484 55.5469C190.891 55.3125 191.185 55.0078 191.367 54.6328V52.8984H190.234C188.464 52.8984 187.578 53.4167 187.578 54.4531C187.578 54.9062 187.729 55.2604 188.031 55.5156C188.333 55.7708 188.721 55.8984 189.195 55.8984ZM197.039 46.5V48.5469H198.617V49.6641H197.039V54.9062C197.039 55.2448 197.109 55.5 197.25 55.6719C197.391 55.8385 197.63 55.9219 197.969 55.9219C198.135 55.9219 198.365 55.8906 198.656 55.8281V57C198.276 57.1042 197.906 57.1562 197.547 57.1562C196.901 57.1562 196.414 56.9609 196.086 56.5703C195.758 56.1797 195.594 55.625 195.594 54.9062V49.6641H194.055V48.5469H195.594V46.5H197.039ZM205.531 57C205.448 56.8333 205.38 56.5365 205.328 56.1094C204.656 56.8073 203.854 57.1562 202.922 57.1562C202.089 57.1562 201.404 56.9219 200.867 56.4531C200.336 55.9792 200.07 55.3802 200.07 54.6562C200.07 53.776 200.404 53.0938 201.07 52.6094C201.742 52.1198 202.685 51.875 203.898 51.875H205.305V51.2109C205.305 50.7057 205.154 50.3047 204.852 50.0078C204.549 49.7057 204.104 49.5547 203.516 49.5547C203 49.5547 202.568 49.6849 202.219 49.9453C201.87 50.2057 201.695 50.5208 201.695 50.8906H200.242C200.242 50.4688 200.391 50.0625 200.688 49.6719C200.99 49.276 201.396 48.9635 201.906 48.7344C202.422 48.5052 202.987 48.3906 203.602 48.3906C204.576 48.3906 205.339 48.6354 205.891 49.125C206.443 49.6094 206.729 50.2786 206.75 51.1328V55.0234C206.75 55.7995 206.849 56.4167 207.047 56.875V57H205.531ZM203.133 55.8984C203.586 55.8984 204.016 55.7812 204.422 55.5469C204.828 55.3125 205.122 55.0078 205.305 54.6328V52.8984H204.172C202.401 52.8984 201.516 53.4167 201.516 54.4531C201.516 54.9062 201.667 55.2604 201.969 55.5156C202.271 55.7708 202.659 55.8984 203.133 55.8984ZM150.547 76V68.6641H149.211V67.5469H150.547V66.6797C150.547 65.7734 150.789 65.0729 151.273 64.5781C151.758 64.0833 152.443 63.8359 153.328 63.8359C153.661 63.8359 153.992 63.8802 154.32 63.9688L154.242 65.1406C153.997 65.0938 153.737 65.0703 153.461 65.0703C152.992 65.0703 152.63 65.2083 152.375 65.4844C152.12 65.7552 151.992 66.1458 151.992 66.6562V67.5469H153.797V68.6641H151.992V76H150.547ZM160.617 76C160.534 75.8333 160.466 75.5365 160.414 75.1094C159.742 75.8073 158.94 76.1562 158.008 76.1562C157.174 76.1562 156.49 75.9219 155.953 75.4531C155.422 74.9792 155.156 74.3802 155.156 73.6562C155.156 72.776 155.49 72.0938 156.156 71.6094C156.828 71.1198 157.771 70.875 158.984 70.875H160.391V70.2109C160.391 69.7057 160.24 69.3047 159.938 69.0078C159.635 68.7057 159.19 68.5547 158.602 68.5547C158.086 68.5547 157.654 68.6849 157.305 68.9453C156.956 69.2057 156.781 69.5208 156.781 69.8906H155.328C155.328 69.4688 155.477 69.0625 155.773 68.6719C156.076 68.276 156.482 67.9635 156.992 67.7344C157.508 67.5052 158.073 67.3906 158.688 67.3906C159.661 67.3906 160.424 67.6354 160.977 68.125C161.529 68.6094 161.815 69.2786 161.836 70.1328V74.0234C161.836 74.7995 161.935 75.4167 162.133 75.875V76H160.617ZM158.219 74.8984C158.672 74.8984 159.102 74.7812 159.508 74.5469C159.914 74.3125 160.208 74.0078 160.391 73.6328V71.8984H159.258C157.487 71.8984 156.602 72.4167 156.602 73.4531C156.602 73.9062 156.753 74.2604 157.055 74.5156C157.357 74.7708 157.745 74.8984 158.219 74.8984ZM167.492 74.9766C168.008 74.9766 168.458 74.8203 168.844 74.5078C169.229 74.1953 169.443 73.8047 169.484 73.3359H170.852C170.826 73.8203 170.659 74.2812 170.352 74.7188C170.044 75.1562 169.633 75.5052 169.117 75.7656C168.607 76.026 168.065 76.1562 167.492 76.1562C166.341 76.1562 165.424 75.7734 164.742 75.0078C164.065 74.237 163.727 73.1849 163.727 71.8516V71.6094C163.727 70.7865 163.878 70.0547 164.18 69.4141C164.482 68.7734 164.914 68.276 165.477 67.9219C166.044 67.5677 166.714 67.3906 167.484 67.3906C168.432 67.3906 169.219 67.6745 169.844 68.2422C170.474 68.8099 170.81 69.5469 170.852 70.4531H169.484C169.443 69.9062 169.234 69.4583 168.859 69.1094C168.49 68.7552 168.031 68.5781 167.484 68.5781C166.75 68.5781 166.18 68.8438 165.773 69.375C165.372 69.901 165.172 70.6641 165.172 71.6641V71.9375C165.172 72.9115 165.372 73.6615 165.773 74.1875C166.174 74.7135 166.747 74.9766 167.492 74.9766ZM174.438 65.5V67.5469H176.016V68.6641H174.438V73.9062C174.438 74.2448 174.508 74.5 174.648 74.6719C174.789 74.8385 175.029 74.9219 175.367 74.9219C175.534 74.9219 175.763 74.8906 176.055 74.8281V76C175.674 76.1042 175.305 76.1562 174.945 76.1562C174.299 76.1562 173.812 75.9609 173.484 75.5703C173.156 75.1797 172.992 74.625 172.992 73.9062V68.6641H171.453V67.5469H172.992V65.5H174.438ZM177.172 71.6953C177.172 70.8672 177.333 70.1224 177.656 69.4609C177.984 68.7995 178.438 68.2891 179.016 67.9297C179.599 67.5703 180.263 67.3906 181.008 67.3906C182.159 67.3906 183.089 67.7891 183.797 68.5859C184.51 69.3828 184.867 70.4427 184.867 71.7656V71.8672C184.867 72.6901 184.708 73.4297 184.391 74.0859C184.078 74.737 183.628 75.2448 183.039 75.6094C182.456 75.974 181.784 76.1562 181.023 76.1562C179.878 76.1562 178.948 75.7578 178.234 74.9609C177.526 74.1641 177.172 73.1094 177.172 71.7969V71.6953ZM178.625 71.8672C178.625 72.8047 178.841 73.5573 179.273 74.125C179.711 74.6927 180.294 74.9766 181.023 74.9766C181.758 74.9766 182.341 74.6901 182.773 74.1172C183.206 73.5391 183.422 72.7318 183.422 71.6953C183.422 70.7682 183.201 70.0182 182.758 69.4453C182.32 68.8672 181.737 68.5781 181.008 68.5781C180.294 68.5781 179.719 68.862 179.281 69.4297C178.844 69.9974 178.625 70.8099 178.625 71.8672ZM190.766 68.8438C190.547 68.8073 190.31 68.7891 190.055 68.7891C189.107 68.7891 188.464 69.1927 188.125 70V76H186.68V67.5469H188.086L188.109 68.5234C188.583 67.7682 189.255 67.3906 190.125 67.3906C190.406 67.3906 190.62 67.4271 190.766 67.5V68.8438ZM197.023 73.7578C197.023 73.3672 196.875 73.0651 196.578 72.8516C196.286 72.6328 195.773 72.4453 195.039 72.2891C194.31 72.1328 193.729 71.9453 193.297 71.7266C192.87 71.5078 192.552 71.2474 192.344 70.9453C192.141 70.6432 192.039 70.2839 192.039 69.8672C192.039 69.1745 192.331 68.5885 192.914 68.1094C193.503 67.6302 194.253 67.3906 195.164 67.3906C196.122 67.3906 196.898 67.638 197.492 68.1328C198.091 68.6276 198.391 69.2604 198.391 70.0312H196.938C196.938 69.6354 196.768 69.2943 196.43 69.0078C196.096 68.7214 195.674 68.5781 195.164 68.5781C194.638 68.5781 194.227 68.6927 193.93 68.9219C193.633 69.151 193.484 69.4505 193.484 69.8203C193.484 70.1693 193.622 70.4323 193.898 70.6094C194.174 70.7865 194.672 70.9557 195.391 71.1172C196.115 71.2786 196.701 71.4714 197.148 71.6953C197.596 71.9193 197.927 72.1901 198.141 72.5078C198.359 72.8203 198.469 73.2031 198.469 73.6562C198.469 74.4115 198.167 75.0182 197.562 75.4766C196.958 75.9297 196.174 76.1562 195.211 76.1562C194.534 76.1562 193.935 76.0365 193.414 75.7969C192.893 75.5573 192.484 75.224 192.188 74.7969C191.896 74.3646 191.75 73.8984 191.75 73.3984H193.195C193.221 73.8828 193.414 74.2682 193.773 74.5547C194.138 74.8359 194.617 74.9766 195.211 74.9766C195.758 74.9766 196.195 74.8672 196.523 74.6484C196.857 74.4245 197.023 74.1276 197.023 73.7578Z" fill="black"/>
                <path id="Outlier data factors" d="M12.875 51.6797C12.875 52.7943 12.6875 53.7682 12.3125 54.6016C11.9375 55.4297 11.4062 56.0625 10.7188 56.5C10.0312 56.9375 9.22917 57.1562 8.3125 57.1562C7.41667 57.1562 6.6224 56.9375 5.92969 56.5C5.23698 56.0573 4.69792 55.4297 4.3125 54.6172C3.93229 53.7995 3.73698 52.8542 3.72656 51.7812V50.9609C3.72656 49.8672 3.91667 48.901 4.29688 48.0625C4.67708 47.224 5.21354 46.5833 5.90625 46.1406C6.60417 45.6927 7.40104 45.4688 8.29688 45.4688C9.20833 45.4688 10.0104 45.6901 10.7031 46.1328C11.401 46.5703 11.9375 47.2083 12.3125 48.0469C12.6875 48.8802 12.875 49.8516 12.875 50.9609V51.6797ZM11.3828 50.9453C11.3828 49.5964 11.112 48.5625 10.5703 47.8438C10.0286 47.1198 9.27083 46.7578 8.29688 46.7578C7.34896 46.7578 6.60156 47.1198 6.05469 47.8438C5.51302 48.5625 5.23438 49.5625 5.21875 50.8438V51.6797C5.21875 52.987 5.49219 54.0156 6.03906 54.7656C6.59115 55.5104 7.34896 55.8828 8.3125 55.8828C9.28125 55.8828 10.0312 55.5312 10.5625 54.8281C11.0938 54.1198 11.3672 53.1068 11.3828 51.7891V50.9453ZM20.1172 56.1641C19.5547 56.8255 18.7292 57.1562 17.6406 57.1562C16.7396 57.1562 16.0521 56.8958 15.5781 56.375C15.1094 55.849 14.8724 55.0729 14.8672 54.0469V48.5469H16.3125V54.0078C16.3125 55.2891 16.8333 55.9297 17.875 55.9297C18.9792 55.9297 19.7135 55.5182 20.0781 54.6953V48.5469H21.5234V57H20.1484L20.1172 56.1641ZM25.6875 46.5V48.5469H27.2656V49.6641H25.6875V54.9062C25.6875 55.2448 25.7578 55.5 25.8984 55.6719C26.0391 55.8385 26.2786 55.9219 26.6172 55.9219C26.7839 55.9219 27.013 55.8906 27.3047 55.8281V57C26.9245 57.1042 26.5547 57.1562 26.1953 57.1562C25.5495 57.1562 25.0625 56.9609 24.7344 56.5703C24.4062 56.1797 24.2422 55.625 24.2422 54.9062V49.6641H22.7031V48.5469H24.2422V46.5H25.6875ZM30.5312 57H29.0859V45H30.5312V57ZM34.4219 57H32.9766V48.5469H34.4219V57ZM32.8594 46.3047C32.8594 46.0703 32.9297 45.8724 33.0703 45.7109C33.2161 45.5495 33.4297 45.4688 33.7109 45.4688C33.9922 45.4688 34.2057 45.5495 34.3516 45.7109C34.4974 45.8724 34.5703 46.0703 34.5703 46.3047C34.5703 46.5391 34.4974 46.7344 34.3516 46.8906C34.2057 47.0469 33.9922 47.125 33.7109 47.125C33.4297 47.125 33.2161 47.0469 33.0703 46.8906C32.9297 46.7344 32.8594 46.5391 32.8594 46.3047ZM40.25 57.1562C39.1042 57.1562 38.1719 56.7812 37.4531 56.0312C36.7344 55.276 36.375 54.2682 36.375 53.0078V52.7422C36.375 51.9036 36.5339 51.1562 36.8516 50.5C37.1745 49.8385 37.6224 49.3229 38.1953 48.9531C38.7734 48.5781 39.3984 48.3906 40.0703 48.3906C41.1693 48.3906 42.0234 48.7526 42.6328 49.4766C43.2422 50.2005 43.5469 51.237 43.5469 52.5859V53.1875H37.8203C37.8411 54.0208 38.0833 54.6953 38.5469 55.2109C39.0156 55.7214 39.6094 55.9766 40.3281 55.9766C40.8385 55.9766 41.2708 55.8724 41.625 55.6641C41.9792 55.4557 42.2891 55.1797 42.5547 54.8359L43.4375 55.5234C42.7292 56.612 41.6667 57.1562 40.25 57.1562ZM40.0703 49.5781C39.487 49.5781 38.9974 49.7917 38.6016 50.2188C38.2057 50.6406 37.9609 51.2344 37.8672 52H42.1016V51.8906C42.0599 51.1562 41.862 50.5885 41.5078 50.1875C41.1536 49.7812 40.6745 49.5781 40.0703 49.5781ZM49.3125 49.8438C49.0938 49.8073 48.8568 49.7891 48.6016 49.7891C47.6536 49.7891 47.0104 50.1927 46.6719 51V57H45.2266V48.5469H46.6328L46.6562 49.5234C47.1302 48.7682 47.8021 48.3906 48.6719 48.3906C48.9531 48.3906 49.1667 48.4271 49.3125 48.5V49.8438ZM54.2656 52.7031C54.2656 51.4062 54.5729 50.3646 55.1875 49.5781C55.8021 48.7865 56.6068 48.3906 57.6016 48.3906C58.5911 48.3906 59.375 48.7292 59.9531 49.4062V45H61.3984V57H60.0703L60 56.0938C59.4219 56.8021 58.6172 57.1562 57.5859 57.1562C56.6068 57.1562 55.8073 56.7552 55.1875 55.9531C54.5729 55.151 54.2656 54.1042 54.2656 52.8125V52.7031ZM55.7109 52.8672C55.7109 53.8255 55.9089 54.5755 56.3047 55.1172C56.7005 55.6589 57.2474 55.9297 57.9453 55.9297C58.862 55.9297 59.5312 55.5182 59.9531 54.6953V50.8125C59.5208 50.0156 58.8568 49.6172 57.9609 49.6172C57.2526 49.6172 56.7005 49.8906 56.3047 50.4375C55.9089 50.9844 55.7109 51.7943 55.7109 52.8672ZM68.8672 57C68.7839 56.8333 68.7161 56.5365 68.6641 56.1094C67.9922 56.8073 67.1901 57.1562 66.2578 57.1562C65.4245 57.1562 64.7396 56.9219 64.2031 56.4531C63.6719 55.9792 63.4062 55.3802 63.4062 54.6562C63.4062 53.776 63.7396 53.0938 64.4062 52.6094C65.0781 52.1198 66.0208 51.875 67.2344 51.875H68.6406V51.2109C68.6406 50.7057 68.4896 50.3047 68.1875 50.0078C67.8854 49.7057 67.4401 49.5547 66.8516 49.5547C66.3359 49.5547 65.9036 49.6849 65.5547 49.9453C65.2057 50.2057 65.0312 50.5208 65.0312 50.8906H63.5781C63.5781 50.4688 63.7266 50.0625 64.0234 49.6719C64.3255 49.276 64.7318 48.9635 65.2422 48.7344C65.7578 48.5052 66.3229 48.3906 66.9375 48.3906C67.9115 48.3906 68.6745 48.6354 69.2266 49.125C69.7786 49.6094 70.0651 50.2786 70.0859 51.1328V55.0234C70.0859 55.7995 70.1849 56.4167 70.3828 56.875V57H68.8672ZM66.4688 55.8984C66.9219 55.8984 67.3516 55.7812 67.7578 55.5469C68.1641 55.3125 68.4583 55.0078 68.6406 54.6328V52.8984H67.5078C65.737 52.8984 64.8516 53.4167 64.8516 54.4531C64.8516 54.9062 65.0026 55.2604 65.3047 55.5156C65.6068 55.7708 65.9948 55.8984 66.4688 55.8984ZM74.3125 46.5V48.5469H75.8906V49.6641H74.3125V54.9062C74.3125 55.2448 74.3828 55.5 74.5234 55.6719C74.6641 55.8385 74.9036 55.9219 75.2422 55.9219C75.4089 55.9219 75.638 55.8906 75.9297 55.8281V57C75.5495 57.1042 75.1797 57.1562 74.8203 57.1562C74.1745 57.1562 73.6875 56.9609 73.3594 56.5703C73.0312 56.1797 72.8672 55.625 72.8672 54.9062V49.6641H71.3281V48.5469H72.8672V46.5H74.3125ZM82.8047 57C82.7214 56.8333 82.6536 56.5365 82.6016 56.1094C81.9297 56.8073 81.1276 57.1562 80.1953 57.1562C79.362 57.1562 78.6771 56.9219 78.1406 56.4531C77.6094 55.9792 77.3438 55.3802 77.3438 54.6562C77.3438 53.776 77.6771 53.0938 78.3438 52.6094C79.0156 52.1198 79.9583 51.875 81.1719 51.875H82.5781V51.2109C82.5781 50.7057 82.4271 50.3047 82.125 50.0078C81.8229 49.7057 81.3776 49.5547 80.7891 49.5547C80.2734 49.5547 79.8411 49.6849 79.4922 49.9453C79.1432 50.2057 78.9688 50.5208 78.9688 50.8906H77.5156C77.5156 50.4688 77.6641 50.0625 77.9609 49.6719C78.263 49.276 78.6693 48.9635 79.1797 48.7344C79.6953 48.5052 80.2604 48.3906 80.875 48.3906C81.849 48.3906 82.612 48.6354 83.1641 49.125C83.7161 49.6094 84.0026 50.2786 84.0234 51.1328V55.0234C84.0234 55.7995 84.1224 56.4167 84.3203 56.875V57H82.8047ZM80.4062 55.8984C80.8594 55.8984 81.2891 55.7812 81.6953 55.5469C82.1016 55.3125 82.3958 55.0078 82.5781 54.6328V52.8984H81.4453C79.6745 52.8984 78.7891 53.4167 78.7891 54.4531C78.7891 54.9062 78.9401 55.2604 79.2422 55.5156C79.5443 55.7708 79.9323 55.8984 80.4062 55.8984ZM20.5469 76V68.6641H19.2109V67.5469H20.5469V66.6797C20.5469 65.7734 20.7891 65.0729 21.2734 64.5781C21.7578 64.0833 22.4427 63.8359 23.3281 63.8359C23.6615 63.8359 23.9922 63.8802 24.3203 63.9688L24.2422 65.1406C23.9974 65.0938 23.737 65.0703 23.4609 65.0703C22.9922 65.0703 22.6302 65.2083 22.375 65.4844C22.1198 65.7552 21.9922 66.1458 21.9922 66.6562V67.5469H23.7969V68.6641H21.9922V76H20.5469ZM30.6172 76C30.5339 75.8333 30.4661 75.5365 30.4141 75.1094C29.7422 75.8073 28.9401 76.1562 28.0078 76.1562C27.1745 76.1562 26.4896 75.9219 25.9531 75.4531C25.4219 74.9792 25.1562 74.3802 25.1562 73.6562C25.1562 72.776 25.4896 72.0938 26.1562 71.6094C26.8281 71.1198 27.7708 70.875 28.9844 70.875H30.3906V70.2109C30.3906 69.7057 30.2396 69.3047 29.9375 69.0078C29.6354 68.7057 29.1901 68.5547 28.6016 68.5547C28.0859 68.5547 27.6536 68.6849 27.3047 68.9453C26.9557 69.2057 26.7812 69.5208 26.7812 69.8906H25.3281C25.3281 69.4688 25.4766 69.0625 25.7734 68.6719C26.0755 68.276 26.4818 67.9635 26.9922 67.7344C27.5078 67.5052 28.0729 67.3906 28.6875 67.3906C29.6615 67.3906 30.4245 67.6354 30.9766 68.125C31.5286 68.6094 31.8151 69.2786 31.8359 70.1328V74.0234C31.8359 74.7995 31.9349 75.4167 32.1328 75.875V76H30.6172ZM28.2188 74.8984C28.6719 74.8984 29.1016 74.7812 29.5078 74.5469C29.9141 74.3125 30.2083 74.0078 30.3906 73.6328V71.8984H29.2578C27.487 71.8984 26.6016 72.4167 26.6016 73.4531C26.6016 73.9062 26.7526 74.2604 27.0547 74.5156C27.3568 74.7708 27.7448 74.8984 28.2188 74.8984ZM37.4922 74.9766C38.0078 74.9766 38.4583 74.8203 38.8438 74.5078C39.2292 74.1953 39.4427 73.8047 39.4844 73.3359H40.8516C40.8255 73.8203 40.6589 74.2812 40.3516 74.7188C40.0443 75.1562 39.6328 75.5052 39.1172 75.7656C38.6068 76.026 38.0651 76.1562 37.4922 76.1562C36.3411 76.1562 35.4245 75.7734 34.7422 75.0078C34.0651 74.237 33.7266 73.1849 33.7266 71.8516V71.6094C33.7266 70.7865 33.8776 70.0547 34.1797 69.4141C34.4818 68.7734 34.9141 68.276 35.4766 67.9219C36.0443 67.5677 36.7135 67.3906 37.4844 67.3906C38.4323 67.3906 39.2188 67.6745 39.8438 68.2422C40.474 68.8099 40.8099 69.5469 40.8516 70.4531H39.4844C39.4427 69.9062 39.2344 69.4583 38.8594 69.1094C38.4896 68.7552 38.0312 68.5781 37.4844 68.5781C36.75 68.5781 36.1797 68.8438 35.7734 69.375C35.3724 69.901 35.1719 70.6641 35.1719 71.6641V71.9375C35.1719 72.9115 35.3724 73.6615 35.7734 74.1875C36.1745 74.7135 36.7474 74.9766 37.4922 74.9766ZM44.4375 65.5V67.5469H46.0156V68.6641H44.4375V73.9062C44.4375 74.2448 44.5078 74.5 44.6484 74.6719C44.7891 74.8385 45.0286 74.9219 45.3672 74.9219C45.5339 74.9219 45.763 74.8906 46.0547 74.8281V76C45.6745 76.1042 45.3047 76.1562 44.9453 76.1562C44.2995 76.1562 43.8125 75.9609 43.4844 75.5703C43.1562 75.1797 42.9922 74.625 42.9922 73.9062V68.6641H41.4531V67.5469H42.9922V65.5H44.4375ZM47.1719 71.6953C47.1719 70.8672 47.3333 70.1224 47.6562 69.4609C47.9844 68.7995 48.4375 68.2891 49.0156 67.9297C49.599 67.5703 50.263 67.3906 51.0078 67.3906C52.1589 67.3906 53.0885 67.7891 53.7969 68.5859C54.5104 69.3828 54.8672 70.4427 54.8672 71.7656V71.8672C54.8672 72.6901 54.7083 73.4297 54.3906 74.0859C54.0781 74.737 53.6276 75.2448 53.0391 75.6094C52.4557 75.974 51.7839 76.1562 51.0234 76.1562C49.8776 76.1562 48.9479 75.7578 48.2344 74.9609C47.526 74.1641 47.1719 73.1094 47.1719 71.7969V71.6953ZM48.625 71.8672C48.625 72.8047 48.8411 73.5573 49.2734 74.125C49.7109 74.6927 50.2943 74.9766 51.0234 74.9766C51.7578 74.9766 52.3411 74.6901 52.7734 74.1172C53.2057 73.5391 53.4219 72.7318 53.4219 71.6953C53.4219 70.7682 53.2005 70.0182 52.7578 69.4453C52.3203 68.8672 51.737 68.5781 51.0078 68.5781C50.2943 68.5781 49.7188 68.862 49.2812 69.4297C48.8438 69.9974 48.625 70.8099 48.625 71.8672ZM60.7656 68.8438C60.5469 68.8073 60.3099 68.7891 60.0547 68.7891C59.1068 68.7891 58.4635 69.1927 58.125 70V76H56.6797V67.5469H58.0859L58.1094 68.5234C58.5833 67.7682 59.2552 67.3906 60.125 67.3906C60.4062 67.3906 60.6198 67.4271 60.7656 67.5V68.8438ZM67.0234 73.7578C67.0234 73.3672 66.875 73.0651 66.5781 72.8516C66.2865 72.6328 65.7734 72.4453 65.0391 72.2891C64.3099 72.1328 63.7292 71.9453 63.2969 71.7266C62.8698 71.5078 62.5521 71.2474 62.3438 70.9453C62.1406 70.6432 62.0391 70.2839 62.0391 69.8672C62.0391 69.1745 62.3307 68.5885 62.9141 68.1094C63.5026 67.6302 64.2526 67.3906 65.1641 67.3906C66.1224 67.3906 66.8984 67.638 67.4922 68.1328C68.0911 68.6276 68.3906 69.2604 68.3906 70.0312H66.9375C66.9375 69.6354 66.7682 69.2943 66.4297 69.0078C66.0964 68.7214 65.6745 68.5781 65.1641 68.5781C64.638 68.5781 64.2266 68.6927 63.9297 68.9219C63.6328 69.151 63.4844 69.4505 63.4844 69.8203C63.4844 70.1693 63.6224 70.4323 63.8984 70.6094C64.1745 70.7865 64.6719 70.9557 65.3906 71.1172C66.1146 71.2786 66.7005 71.4714 67.1484 71.6953C67.5964 71.9193 67.9271 72.1901 68.1406 72.5078C68.3594 72.8203 68.4688 73.2031 68.4688 73.6562C68.4688 74.4115 68.1667 75.0182 67.5625 75.4766C66.9583 75.9297 66.1745 76.1562 65.2109 76.1562C64.5339 76.1562 63.9349 76.0365 63.4141 75.7969C62.8932 75.5573 62.4844 75.224 62.1875 74.7969C61.8958 74.3646 61.75 73.8984 61.75 73.3984H63.1953C63.2214 73.8828 63.4141 74.2682 63.7734 74.5547C64.138 74.8359 64.6172 74.9766 65.2109 74.9766C65.7578 74.9766 66.1953 74.8672 66.5234 74.6484C66.8568 74.4245 67.0234 74.1276 67.0234 73.7578Z" fill="black"/>
                <g id="step">
                <line id="Line 9" x1="153" y1="10" x2="170" y2="10" stroke="black" stroke-width="4"/>
                <line id="Line 11" x1="172" y1="35" x2="172" y2="8" stroke="black" stroke-width="4"/>
                <line id="Line 10" x1="174" y1="33" x2="191" y2="33" stroke="black" stroke-width="4"/>
                </g>
                <g id="outlier">
                <line id="Line 12" x1="23.0031" y1="33.2662" x2="63.0031" y2="10.2662" stroke="black" stroke-width="4"/>
                <g id="Rectangle 10">
                <rect x="27" y="16" width="4" height="4" fill="black"/>
                <rect x="27" y="16" width="4" height="4" fill="black"/>
                <rect x="27" y="16" width="4" height="4" fill="black"/>
                <rect x="27" y="16" width="4" height="4" fill="black"/>
                </g>
                <g id="Rectangle 11">
                <rect x="54" y="26" width="4" height="4" fill="black"/>
                <rect x="54" y="26" width="4" height="4" fill="black"/>
                <rect x="54" y="26" width="4" height="4" fill="black"/>
                <rect x="54" y="26" width="4" height="4" fill="black"/>
                </g>
                </g>
                <g id="random">
                <g id="Rectangle 12">
                <rect x="296" y="28" width="4" height="4" fill="black"/>
                <rect x="296" y="28" width="4" height="4" fill="black"/>
                <rect x="296" y="28" width="4" height="4" fill="black"/>
                <rect x="296" y="28" width="4" height="4" fill="black"/>
                </g>
                <g id="Rectangle 15">
                <rect x="306" y="22" width="4" height="4" fill="black"/>
                <rect x="306" y="22" width="4" height="4" fill="black"/>
                <rect x="306" y="22" width="4" height="4" fill="black"/>
                <rect x="306" y="22" width="4" height="4" fill="black"/>
                </g>
                <g id="Rectangle 16">
                <rect x="317" y="28" width="4" height="4" fill="black"/>
                <rect x="317" y="28" width="4" height="4" fill="black"/>
                <rect x="317" y="28" width="4" height="4" fill="black"/>
                <rect x="317" y="28" width="4" height="4" fill="black"/>
                </g>
                <g id="Rectangle 17">
                <rect x="321" y="14" width="4" height="4" fill="black"/>
                <rect x="321" y="14" width="4" height="4" fill="black"/>
                <rect x="321" y="14" width="4" height="4" fill="black"/>
                <rect x="321" y="14" width="4" height="4" fill="black"/>
                </g>
                <g id="Rectangle 13">
                <rect x="300" y="12" width="4" height="4" fill="black"/>
                <rect x="300" y="12" width="4" height="4" fill="black"/>
                <rect x="300" y="12" width="4" height="4" fill="black"/>
                <rect x="300" y="12" width="4" height="4" fill="black"/>
                </g>
                <g id="Rectangle 14">
                <rect x="292" y="17" width="4" height="4" fill="black"/>
                <rect x="292" y="17" width="4" height="4" fill="black"/>
                <rect x="292" y="17" width="4" height="4" fill="black"/>
                <rect x="292" y="17" width="4" height="4" fill="black"/>
                </g>
                </g>

                <rect id="step_rect" class="clickable" on:click={() => newGraph("step")} x="152" y="8" width="39" height="27" fill="#C4C4C4" opacity="0"/>
                <rect id="outlier_rect" class="clickable" on:click={() => newGraph("outlier")} x="22" y="8" width="42" height="27" fill="#C4C4C4" opacity="0"/>
                <rect id="rand_rect" class="clickable" on:click={() => newGraph("random")} x="290" y="8" width="39" height="27" fill="#C4C4C4" opacity="0"/>
                <rect id="Delete" class="clickable" on:click={() => newGraph("empty")} x="420" width="41.7647" height="41.7647" fill="url(#pon0)"/>

                <defs>
                    <pattern id="pon0" patternContentUnits="objectBoundingBox" width="1" height="1">
                    <use xlink:href="#ia0" transform="scale(0.0111111)"/>
                    </pattern>
                    <image id="ia0" width="90" height="90" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAABaCAYAAAA4qEECAAAABmJLR0QA/wD/AP+gvaeTAAAB9klEQVR4nO2cS24CMRBES1mEnDzMebJAuVBCbgGL0BIiw4SPu101rid5w+r5CQwDQwPGGGOMMcYYY4wxZo4NgAnA/rSm02MqSPi/AvgAcLhYnwDeOnrdioT/NUlK2Rkk/P+TpJKdQcL/VkkK2Rkk/O+VZIst4b8BsHtAMtYOfd/NZfynJyR7x342cqxthey+gWiPY+TR42Ju/VQItwpdGbtl5AOArwJnbBsKVxwjrY6L8/We6JsqnhVbyXWW1i/FjGNEwfEmmDfC7PYQjBtidGoC08aYXFJg2CCDQwk9NzpM5KDHhoeLHFRufNjIQUWA4SMHmSEc+YKsS2Dpy+osMp59fiZfgTX2qiIHbLFXGTlgib3qyEHv2ENEDnrFHipyUB17yMhBVeyhIwfZsR35jKzYNJFfeguYOnx0FOA3wwL88a4AX7AU4EvwAnpHHiI2S+RVx2aLvMrYrJFXFds/zhbg2w0K8A00BfiWsAJ8k2MBvm23AIaNMjikwrRBJpemMG6M0ekpmDfE7HYXChtRcFxE6W+/Sq5/aDGvo1I8I7bUvI7Kl2LrY0RqXofyYBSZeR3qo34k5nX0/u5Xyl9inNkCUv4SA/oWkPKXGDm5gJS/xBDVBaT8JcYCLyDlv8HvR7/v09pC65dldX9jjDHGGGOMMcaYMo5GWlFN6GAqrAAAAABJRU5ErkJggg=="/>
                </defs>
            </svg>

            <!-- <span class="hint bold-text">
                Or try different message passing schedules:
            </span>

            <div id="mp-buttons">
                <div id="center">
                    <button class="mp-button" on:click={randomMessage}> 
                        Random <br> message
                    </button>
                </div>
                <button class="mp-button full-width-button" on:click={doSweep}> 
                    Sweep <br>
                    <progress id="progress" value={sweep_progress}></progress>
                </button> 
            </div> -->


            <!-- <span class="hint bold-text">
                Balance the data and smoothing factors:
            </span>

            <div id="precision-sliders">
                <div class="slider-container">
                    Data precision: <br>
                    <input class="full-width-slider" type="range" min="{5e-5}" max="{0.0051}" bind:value={meas_lam} step="5e-5"/>
                    <div class="status">
                        ({parseInt(meas_lam / 5e-5)} units)
                    </div>
                </div>  

                <div class="slider-container">
                    Smoothness precision: <br>
                    <input class="full-width-slider" type="range" min="{5e-5}" max="{0.0051}" bind:value={smoothness_lam} step="5e-5"/>
                    <div class="status">
                        ({parseInt(smoothness_lam / 5e-5)} units)
                    </div>
                </div>                  
            </div> -->

            <span class="hint bold-text" style="margin-top: 10px;">
                Factor graph:
            </span>

            <div>
                <svg id="factor-graph" width="766" height="117" viewBox="0 0 766 117" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g id="graph">
                    <g id="edges">
                    <line id="Line 1" x1="13" y1="97.5" x2="410" y2="97.5" stroke="black"/>
                    <line id="Line 2" x1="13.738" y1="98.5742" x2="78.738" y2="58.5742" stroke="black"/>
                    <line id="Line 3" x1="144.746" y1="97.4305" x2="78.7456" y2="58.4305" stroke="black"/>
                    <line id="Line 4" x1="144.751" y1="96.5667" x2="210.751" y2="58.5667" stroke="black"/>
                    <line id="Line 5" x1="144.616" y1="96.6794" x2="210.616" y2="17.6794" stroke="black"/>
                    <line id="Line 6" x1="276.61" y1="98.3129" x2="211.61" y2="17.3129" stroke="black"/>
                    <line id="Line 7" x1="276.739" y1="98.4265" x2="209.739" y2="57.4265" stroke="black"/>
                    </g>
                    <g id="var nodes">
                    <circle id="Ellipse 1" cx="13.5" cy="96.5" r="13.5" fill="#0095DD"/>
                    <circle id="Ellipse 2" cx="145.5" cy="96.5" r="13.5" fill="#0095DD"/>
                    <circle id="Ellipse 3" cx="277.5" cy="96.5" r="13.5" fill="#0095DD"/>
                    <circle id="Ellipse 4" cx="409.5" cy="96.5" r="13.5" fill="#0095DD"/>
                    </g>
                    <g id="data factors">
                    <rect id="Rectangle 6" x="71" y="50" width="16" height="16" fill="#FF0000"/>
                    <rect id="Rectangle 2" x="203" y="50" width="16" height="16" fill="#FF0000"/>
                    <rect id="Rectangle 4" x="203" y="9" width="16" height="16" fill="#FF0000"/>
                    </g>
                    <g id="smooth factors">
                    <rect id="Rectangle 3" x="336" y="88" width="16" height="16" fill="#838383"/>
                    <rect id="Rectangle 7" x="203" y="89" width="16" height="16" fill="#838383"/>
                    <rect id="Rectangle 8" x="71" y="89" width="16" height="16" fill="#838383"/>
                    </g>
                    </g>
                    <g id="key">
                    <rect id="Rectangle 7_2" x="466" y="95" width="16" height="16" fill="#FF0000"/>
                    <circle id="Ellipse 5" cx="473.5" cy="17.5" r="13.5" fill="#0095DD"/>
                    <rect id="Rectangle 9" x="466" y="51" width="16" height="16" fill="#838383"/>
                    <path id="Variable node" d="M510.536 24.2646L516.63 6.67188H519.706L511.796 28H509.306L501.41 6.67188H504.472L510.536 24.2646ZM531.264 28C531.107 27.6875 530.98 27.1309 530.883 26.3301C529.623 27.6387 528.119 28.293 526.371 28.293C524.809 28.293 523.524 27.8535 522.519 26.9746C521.522 26.0859 521.024 24.9629 521.024 23.6055C521.024 21.9551 521.649 20.6758 522.899 19.7676C524.159 18.8496 525.927 18.3906 528.202 18.3906H530.839V17.1455C530.839 16.1982 530.556 15.4463 529.989 14.8896C529.423 14.3232 528.588 14.04 527.484 14.04C526.518 14.04 525.707 14.2842 525.053 14.7725C524.398 15.2607 524.071 15.8516 524.071 16.5449H521.347C521.347 15.7539 521.625 14.9922 522.182 14.2598C522.748 13.5176 523.51 12.9316 524.467 12.502C525.434 12.0723 526.493 11.8574 527.646 11.8574C529.472 11.8574 530.902 12.3164 531.938 13.2344C532.973 14.1426 533.51 15.3975 533.549 16.999V24.2939C533.549 25.749 533.734 26.9062 534.105 27.7656V28H531.264ZM526.767 25.9346C527.616 25.9346 528.422 25.7148 529.184 25.2754C529.945 24.8359 530.497 24.2646 530.839 23.5615V20.3096H528.715C525.395 20.3096 523.734 21.2812 523.734 23.2246C523.734 24.0742 524.018 24.7383 524.584 25.2168C525.15 25.6953 525.878 25.9346 526.767 25.9346ZM545.458 14.582C545.048 14.5137 544.604 14.4795 544.125 14.4795C542.348 14.4795 541.142 15.2363 540.507 16.75V28H537.797V12.1504H540.434L540.478 13.9814C541.366 12.5654 542.626 11.8574 544.257 11.8574C544.784 11.8574 545.185 11.9258 545.458 12.0625V14.582ZM550.907 28H548.197V12.1504H550.907V28ZM547.978 7.94629C547.978 7.50684 548.109 7.13574 548.373 6.83301C548.646 6.53027 549.047 6.37891 549.574 6.37891C550.102 6.37891 550.502 6.53027 550.775 6.83301C551.049 7.13574 551.186 7.50684 551.186 7.94629C551.186 8.38574 551.049 8.75195 550.775 9.04492C550.502 9.33789 550.102 9.48438 549.574 9.48438C549.047 9.48438 548.646 9.33789 548.373 9.04492C548.109 8.75195 547.978 8.38574 547.978 7.94629ZM565.043 28C564.887 27.6875 564.76 27.1309 564.662 26.3301C563.402 27.6387 561.898 28.293 560.15 28.293C558.588 28.293 557.304 27.8535 556.298 26.9746C555.302 26.0859 554.804 24.9629 554.804 23.6055C554.804 21.9551 555.429 20.6758 556.679 19.7676C557.938 18.8496 559.706 18.3906 561.981 18.3906H564.618V17.1455C564.618 16.1982 564.335 15.4463 563.769 14.8896C563.202 14.3232 562.367 14.04 561.264 14.04C560.297 14.04 559.486 14.2842 558.832 14.7725C558.178 15.2607 557.851 15.8516 557.851 16.5449H555.126C555.126 15.7539 555.404 14.9922 555.961 14.2598C556.527 13.5176 557.289 12.9316 558.246 12.502C559.213 12.0723 560.272 11.8574 561.425 11.8574C563.251 11.8574 564.682 12.3164 565.717 13.2344C566.752 14.1426 567.289 15.3975 567.328 16.999V24.2939C567.328 25.749 567.514 26.9062 567.885 27.7656V28H565.043ZM560.546 25.9346C561.396 25.9346 562.201 25.7148 562.963 25.2754C563.725 24.8359 564.276 24.2646 564.618 23.5615V20.3096H562.494C559.174 20.3096 557.514 21.2812 557.514 23.2246C557.514 24.0742 557.797 24.7383 558.363 25.2168C558.93 25.6953 559.657 25.9346 560.546 25.9346ZM584.994 20.251C584.994 22.6729 584.438 24.6211 583.324 26.0957C582.211 27.5605 580.717 28.293 578.842 28.293C576.84 28.293 575.292 27.585 574.198 26.1689L574.066 28H571.576V5.5H574.286V13.8936C575.38 12.5361 576.889 11.8574 578.812 11.8574C580.736 11.8574 582.245 12.585 583.339 14.04C584.442 15.4951 584.994 17.4873 584.994 20.0166V20.251ZM582.284 19.9434C582.284 18.0977 581.928 16.6719 581.215 15.666C580.502 14.6602 579.477 14.1572 578.139 14.1572C576.352 14.1572 575.067 14.9873 574.286 16.6475V23.5029C575.116 25.1631 576.41 25.9932 578.168 25.9932C579.467 25.9932 580.478 25.4902 581.2 24.4844C581.923 23.4785 582.284 21.9648 582.284 19.9434ZM591.366 28H588.656V5.5H591.366V28ZM602.294 28.293C600.146 28.293 598.397 27.5898 597.05 26.1836C595.702 24.7676 595.028 22.8779 595.028 20.5146V20.0166C595.028 18.4443 595.326 17.043 595.922 15.8125C596.527 14.5723 597.367 13.6055 598.441 12.9121C599.525 12.209 600.697 11.8574 601.957 11.8574C604.018 11.8574 605.619 12.5361 606.762 13.8936C607.904 15.251 608.476 17.1943 608.476 19.7236V20.8516H597.738C597.777 22.4141 598.231 23.6787 599.101 24.6455C599.979 25.6025 601.093 26.0811 602.44 26.0811C603.397 26.0811 604.208 25.8857 604.872 25.4951C605.536 25.1045 606.117 24.5869 606.615 23.9424L608.271 25.2314C606.942 27.2725 604.95 28.293 602.294 28.293ZM601.957 14.084C600.863 14.084 599.945 14.4844 599.203 15.2852C598.461 16.0762 598.002 17.1895 597.826 18.625H605.766V18.4199C605.688 17.043 605.316 15.9785 604.652 15.2266C603.988 14.4648 603.09 14.084 601.957 14.084ZM621.63 12.1504L621.718 14.1426C622.929 12.6191 624.511 11.8574 626.464 11.8574C629.813 11.8574 631.503 13.7471 631.532 17.5264V28H628.822V17.5117C628.812 16.3691 628.549 15.5244 628.031 14.9775C627.523 14.4307 626.728 14.1572 625.644 14.1572C624.765 14.1572 623.993 14.3916 623.329 14.8604C622.665 15.3291 622.147 15.9443 621.776 16.7061V28H619.066V12.1504H621.63ZM634.901 19.9287C634.901 18.376 635.204 16.9795 635.81 15.7393C636.425 14.499 637.274 13.542 638.358 12.8682C639.452 12.1943 640.697 11.8574 642.094 11.8574C644.252 11.8574 645.995 12.6045 647.323 14.0986C648.661 15.5928 649.33 17.5801 649.33 20.0605V20.251C649.33 21.7939 649.032 23.1807 648.437 24.4111C647.851 25.6318 647.006 26.584 645.902 27.2676C644.809 27.9512 643.549 28.293 642.123 28.293C639.975 28.293 638.231 27.5459 636.894 26.0518C635.565 24.5576 634.901 22.5801 634.901 20.1191V19.9287ZM637.626 20.251C637.626 22.0088 638.031 23.4199 638.842 24.4844C639.662 25.5488 640.756 26.0811 642.123 26.0811C643.5 26.0811 644.594 25.5439 645.404 24.4697C646.215 23.3857 646.62 21.8721 646.62 19.9287C646.62 18.1904 646.205 16.7842 645.375 15.71C644.555 14.626 643.461 14.084 642.094 14.084C640.756 14.084 639.677 14.6162 638.856 15.6807C638.036 16.7451 637.626 18.2686 637.626 20.251ZM652.069 19.9434C652.069 17.5117 652.646 15.5586 653.798 14.084C654.95 12.5996 656.459 11.8574 658.324 11.8574C660.18 11.8574 661.649 12.4922 662.733 13.7617V5.5H665.443V28H662.953L662.821 26.3008C661.737 27.6289 660.229 28.293 658.295 28.293C656.459 28.293 654.96 27.541 653.798 26.0371C652.646 24.5332 652.069 22.5703 652.069 20.1484V19.9434ZM654.779 20.251C654.779 22.0479 655.15 23.4541 655.893 24.4697C656.635 25.4854 657.66 25.9932 658.969 25.9932C660.688 25.9932 661.942 25.2217 662.733 23.6787V16.3984C661.923 14.9043 660.678 14.1572 658.998 14.1572C657.67 14.1572 656.635 14.6699 655.893 15.6953C655.15 16.7207 654.779 18.2393 654.779 20.251ZM676.239 28.293C674.091 28.293 672.343 27.5898 670.995 26.1836C669.647 24.7676 668.974 22.8779 668.974 20.5146V20.0166C668.974 18.4443 669.271 17.043 669.867 15.8125C670.473 14.5723 671.312 13.6055 672.387 12.9121C673.471 12.209 674.643 11.8574 675.902 11.8574C677.963 11.8574 679.564 12.5361 680.707 13.8936C681.85 15.251 682.421 17.1943 682.421 19.7236V20.8516H671.684C671.723 22.4141 672.177 23.6787 673.046 24.6455C673.925 25.6025 675.038 26.0811 676.386 26.0811C677.343 26.0811 678.153 25.8857 678.817 25.4951C679.481 25.1045 680.062 24.5869 680.561 23.9424L682.216 25.2314C680.888 27.2725 678.896 28.293 676.239 28.293ZM675.902 14.084C674.809 14.084 673.891 14.4844 673.148 15.2852C672.406 16.0762 671.947 17.1895 671.771 18.625H679.711V18.4199C679.633 17.043 679.262 15.9785 678.598 15.2266C677.934 14.4648 677.035 14.084 675.902 14.084Z" fill="black"/>
                    <path id="Smoothness factor" d="M509.76 61.4932C507.348 60.7998 505.59 59.9502 504.486 58.9443C503.393 57.9287 502.846 56.6787 502.846 55.1943C502.846 53.5146 503.515 52.1279 504.853 51.0342C506.2 49.9307 507.948 49.3789 510.097 49.3789C511.562 49.3789 512.865 49.6621 514.008 50.2285C515.16 50.7949 516.049 51.5762 516.674 52.5723C517.309 53.5684 517.626 54.6572 517.626 55.8389H514.799C514.799 54.5498 514.389 53.5391 513.568 52.8066C512.748 52.0645 511.591 51.6934 510.097 51.6934C508.71 51.6934 507.626 52.001 506.845 52.6162C506.073 53.2217 505.688 54.0664 505.688 55.1504C505.688 56.0195 506.054 56.7568 506.786 57.3623C507.528 57.958 508.783 58.5049 510.551 59.0029C512.328 59.501 513.715 60.0527 514.711 60.6582C515.717 61.2539 516.459 61.9521 516.938 62.7529C517.426 63.5537 517.67 64.4961 517.67 65.5801C517.67 67.3086 516.996 68.6953 515.648 69.7402C514.301 70.7754 512.499 71.293 510.243 71.293C508.778 71.293 507.411 71.0146 506.142 70.458C504.872 69.8916 503.891 69.1201 503.197 68.1436C502.514 67.167 502.172 66.0586 502.172 64.8184H504.999C504.999 66.1074 505.473 67.1279 506.42 67.8799C507.377 68.6221 508.651 68.9932 510.243 68.9932C511.728 68.9932 512.865 68.6904 513.656 68.085C514.447 67.4795 514.843 66.6543 514.843 65.6094C514.843 64.5645 514.477 63.7588 513.744 63.1924C513.012 62.6162 511.684 62.0498 509.76 61.4932ZM523.412 55.1504L523.485 56.9082C524.647 55.541 526.215 54.8574 528.188 54.8574C530.404 54.8574 531.913 55.707 532.714 57.4062C533.241 56.6445 533.925 56.0293 534.765 55.5605C535.614 55.0918 536.615 54.8574 537.768 54.8574C541.244 54.8574 543.012 56.6982 543.07 60.3799V71H540.36V60.541C540.36 59.4082 540.102 58.5635 539.584 58.0068C539.066 57.4404 538.197 57.1572 536.977 57.1572C535.971 57.1572 535.136 57.46 534.472 58.0654C533.808 58.6611 533.422 59.4668 533.314 60.4824V71H530.59V60.6143C530.59 58.3096 529.462 57.1572 527.206 57.1572C525.429 57.1572 524.213 57.9141 523.559 59.4277V71H520.849V55.1504H523.412ZM546.454 62.9287C546.454 61.376 546.757 59.9795 547.362 58.7393C547.978 57.499 548.827 56.542 549.911 55.8682C551.005 55.1943 552.25 54.8574 553.646 54.8574C555.805 54.8574 557.548 55.6045 558.876 57.0986C560.214 58.5928 560.883 60.5801 560.883 63.0605V63.251C560.883 64.7939 560.585 66.1807 559.989 67.4111C559.403 68.6318 558.559 69.584 557.455 70.2676C556.361 70.9512 555.102 71.293 553.676 71.293C551.527 71.293 549.784 70.5459 548.446 69.0518C547.118 67.5576 546.454 65.5801 546.454 63.1191V62.9287ZM549.179 63.251C549.179 65.0088 549.584 66.4199 550.395 67.4844C551.215 68.5488 552.309 69.0811 553.676 69.0811C555.053 69.0811 556.146 68.5439 556.957 67.4697C557.768 66.3857 558.173 64.8721 558.173 62.9287C558.173 61.1904 557.758 59.7842 556.928 58.71C556.107 57.626 555.014 57.084 553.646 57.084C552.309 57.084 551.229 57.6162 550.409 58.6807C549.589 59.7451 549.179 61.2686 549.179 63.251ZM563.563 62.9287C563.563 61.376 563.866 59.9795 564.472 58.7393C565.087 57.499 565.937 56.542 567.021 55.8682C568.114 55.1943 569.359 54.8574 570.756 54.8574C572.914 54.8574 574.657 55.6045 575.985 57.0986C577.323 58.5928 577.992 60.5801 577.992 63.0605V63.251C577.992 64.7939 577.694 66.1807 577.099 67.4111C576.513 68.6318 575.668 69.584 574.564 70.2676C573.471 70.9512 572.211 71.293 570.785 71.293C568.637 71.293 566.894 70.5459 565.556 69.0518C564.228 67.5576 563.563 65.5801 563.563 63.1191V62.9287ZM566.288 63.251C566.288 65.0088 566.693 66.4199 567.504 67.4844C568.324 68.5488 569.418 69.0811 570.785 69.0811C572.162 69.0811 573.256 68.5439 574.066 67.4697C574.877 66.3857 575.282 64.8721 575.282 62.9287C575.282 61.1904 574.867 59.7842 574.037 58.71C573.217 57.626 572.123 57.084 570.756 57.084C569.418 57.084 568.339 57.6162 567.519 58.6807C566.698 59.7451 566.288 61.2686 566.288 63.251ZM585.067 51.3125V55.1504H588.026V57.2451H585.067V67.0742C585.067 67.709 585.199 68.1875 585.463 68.5098C585.727 68.8223 586.176 68.9785 586.811 68.9785C587.123 68.9785 587.553 68.9199 588.1 68.8027V71C587.387 71.1953 586.693 71.293 586.02 71.293C584.809 71.293 583.896 70.9268 583.28 70.1943C582.665 69.4619 582.357 68.4219 582.357 67.0742V57.2451H579.472V55.1504H582.357V51.3125H585.067ZM593.915 57.0693C595.116 55.5947 596.679 54.8574 598.603 54.8574C601.952 54.8574 603.642 56.7471 603.671 60.5264V71H600.961V60.5117C600.951 59.3691 600.688 58.5244 600.17 57.9775C599.662 57.4307 598.866 57.1572 597.782 57.1572C596.903 57.1572 596.132 57.3916 595.468 57.8604C594.804 58.3291 594.286 58.9443 593.915 59.7061V71H591.205V48.5H593.915V57.0693ZM610.292 55.1504L610.38 57.1426C611.591 55.6191 613.173 54.8574 615.126 54.8574C618.476 54.8574 620.165 56.7471 620.194 60.5264V71H617.484V60.5117C617.475 59.3691 617.211 58.5244 616.693 57.9775C616.186 57.4307 615.39 57.1572 614.306 57.1572C613.427 57.1572 612.655 57.3916 611.991 57.8604C611.327 58.3291 610.81 58.9443 610.438 59.7061V71H607.729V55.1504H610.292ZM630.858 71.293C628.71 71.293 626.962 70.5898 625.614 69.1836C624.267 67.7676 623.593 65.8779 623.593 63.5146V63.0166C623.593 61.4443 623.891 60.043 624.486 58.8125C625.092 57.5723 625.932 56.6055 627.006 55.9121C628.09 55.209 629.262 54.8574 630.521 54.8574C632.582 54.8574 634.184 55.5361 635.326 56.8936C636.469 58.251 637.04 60.1943 637.04 62.7236V63.8516H626.303C626.342 65.4141 626.796 66.6787 627.665 67.6455C628.544 68.6025 629.657 69.0811 631.005 69.0811C631.962 69.0811 632.772 68.8857 633.437 68.4951C634.101 68.1045 634.682 67.5869 635.18 66.9424L636.835 68.2314C635.507 70.2725 633.515 71.293 630.858 71.293ZM630.521 57.084C629.428 57.084 628.51 57.4844 627.768 58.2852C627.025 59.0762 626.566 60.1895 626.391 61.625H634.33V61.4199C634.252 60.043 633.881 58.9785 633.217 58.2266C632.553 57.4648 631.654 57.084 630.521 57.084ZM649.418 66.7959C649.418 66.0635 649.14 65.4971 648.583 65.0967C648.036 64.6865 647.074 64.335 645.697 64.042C644.33 63.749 643.241 63.3975 642.431 62.9873C641.63 62.5771 641.034 62.0889 640.644 61.5225C640.263 60.9561 640.072 60.2822 640.072 59.501C640.072 58.2021 640.619 57.1035 641.713 56.2051C642.816 55.3066 644.223 54.8574 645.932 54.8574C647.729 54.8574 649.184 55.3213 650.297 56.249C651.42 57.1768 651.981 58.3633 651.981 59.8086H649.257C649.257 59.0664 648.939 58.4268 648.305 57.8896C647.68 57.3525 646.889 57.084 645.932 57.084C644.945 57.084 644.174 57.2988 643.617 57.7285C643.061 58.1582 642.782 58.7197 642.782 59.4131C642.782 60.0674 643.041 60.5605 643.559 60.8926C644.076 61.2246 645.009 61.542 646.356 61.8447C647.714 62.1475 648.812 62.5088 649.652 62.9287C650.492 63.3486 651.112 63.8564 651.513 64.4521C651.923 65.0381 652.128 65.7559 652.128 66.6055C652.128 68.0215 651.562 69.1592 650.429 70.0186C649.296 70.8682 647.826 71.293 646.02 71.293C644.75 71.293 643.627 71.0684 642.65 70.6191C641.674 70.1699 640.907 69.5449 640.351 68.7441C639.804 67.9336 639.53 67.0596 639.53 66.1221H642.24C642.289 67.0303 642.65 67.7529 643.324 68.29C644.008 68.8174 644.906 69.0811 646.02 69.0811C647.045 69.0811 647.865 68.876 648.48 68.4658C649.105 68.0459 649.418 67.4893 649.418 66.7959ZM664.887 66.7959C664.887 66.0635 664.608 65.4971 664.052 65.0967C663.505 64.6865 662.543 64.335 661.166 64.042C659.799 63.749 658.71 63.3975 657.899 62.9873C657.099 62.5771 656.503 62.0889 656.112 61.5225C655.731 60.9561 655.541 60.2822 655.541 59.501C655.541 58.2021 656.088 57.1035 657.182 56.2051C658.285 55.3066 659.691 54.8574 661.4 54.8574C663.197 54.8574 664.652 55.3213 665.766 56.249C666.889 57.1768 667.45 58.3633 667.45 59.8086H664.726C664.726 59.0664 664.408 58.4268 663.773 57.8896C663.148 57.3525 662.357 57.084 661.4 57.084C660.414 57.084 659.643 57.2988 659.086 57.7285C658.529 58.1582 658.251 58.7197 658.251 59.4131C658.251 60.0674 658.51 60.5605 659.027 60.8926C659.545 61.2246 660.478 61.542 661.825 61.8447C663.183 62.1475 664.281 62.5088 665.121 62.9287C665.961 63.3486 666.581 63.8564 666.981 64.4521C667.392 65.0381 667.597 65.7559 667.597 66.6055C667.597 68.0215 667.03 69.1592 665.897 70.0186C664.765 70.8682 663.295 71.293 661.488 71.293C660.219 71.293 659.096 71.0684 658.119 70.6191C657.143 70.1699 656.376 69.5449 655.819 68.7441C655.272 67.9336 654.999 67.0596 654.999 66.1221H657.709C657.758 67.0303 658.119 67.7529 658.793 68.29C659.477 68.8174 660.375 69.0811 661.488 69.0811C662.514 69.0811 663.334 68.876 663.949 68.4658C664.574 68.0459 664.887 67.4893 664.887 66.7959ZM679.901 71V57.2451H677.396V55.1504H679.901V53.5244C679.901 51.8252 680.355 50.5117 681.264 49.584C682.172 48.6562 683.456 48.1924 685.116 48.1924C685.741 48.1924 686.361 48.2754 686.977 48.4414L686.83 50.6387C686.371 50.5508 685.883 50.5068 685.365 50.5068C684.486 50.5068 683.808 50.7656 683.329 51.2832C682.851 51.791 682.611 52.5234 682.611 53.4805V55.1504H685.995V57.2451H682.611V71H679.901ZM698.783 71C698.627 70.6875 698.5 70.1309 698.402 69.3301C697.143 70.6387 695.639 71.293 693.891 71.293C692.328 71.293 691.044 70.8535 690.038 69.9746C689.042 69.0859 688.544 67.9629 688.544 66.6055C688.544 64.9551 689.169 63.6758 690.419 62.7676C691.679 61.8496 693.446 61.3906 695.722 61.3906H698.358V60.1455C698.358 59.1982 698.075 58.4463 697.509 57.8896C696.942 57.3232 696.107 57.04 695.004 57.04C694.037 57.04 693.227 57.2842 692.572 57.7725C691.918 58.2607 691.591 58.8516 691.591 59.5449H688.866C688.866 58.7539 689.145 57.9922 689.701 57.2598C690.268 56.5176 691.029 55.9316 691.986 55.502C692.953 55.0723 694.013 54.8574 695.165 54.8574C696.991 54.8574 698.422 55.3164 699.457 56.2344C700.492 57.1426 701.029 58.3975 701.068 59.999V67.2939C701.068 68.749 701.254 69.9062 701.625 70.7656V71H698.783ZM694.286 68.9346C695.136 68.9346 695.941 68.7148 696.703 68.2754C697.465 67.8359 698.017 67.2646 698.358 66.5615V63.3096H696.234C692.914 63.3096 691.254 64.2812 691.254 66.2246C691.254 67.0742 691.537 67.7383 692.104 68.2168C692.67 68.6953 693.397 68.9346 694.286 68.9346ZM711.674 69.0811C712.641 69.0811 713.485 68.7881 714.208 68.2021C714.931 67.6162 715.331 66.8838 715.409 66.0049H717.973C717.924 66.9131 717.611 67.7773 717.035 68.5977C716.459 69.418 715.688 70.0723 714.721 70.5605C713.764 71.0488 712.748 71.293 711.674 71.293C709.516 71.293 707.797 70.5752 706.518 69.1396C705.248 67.6943 704.613 65.7217 704.613 63.2217V62.7676C704.613 61.2246 704.896 59.8525 705.463 58.6514C706.029 57.4502 706.84 56.5176 707.895 55.8535C708.959 55.1895 710.214 54.8574 711.659 54.8574C713.437 54.8574 714.911 55.3896 716.083 56.4541C717.265 57.5186 717.895 58.9004 717.973 60.5996H715.409C715.331 59.5742 714.94 58.7344 714.237 58.0801C713.544 57.416 712.685 57.084 711.659 57.084C710.282 57.084 709.213 57.582 708.451 58.5781C707.699 59.5645 707.323 60.9951 707.323 62.8701V63.3828C707.323 65.209 707.699 66.6152 708.451 67.6016C709.203 68.5879 710.277 69.0811 711.674 69.0811ZM724.696 51.3125V55.1504H727.655V57.2451H724.696V67.0742C724.696 67.709 724.828 68.1875 725.092 68.5098C725.355 68.8223 725.805 68.9785 726.439 68.9785C726.752 68.9785 727.182 68.9199 727.729 68.8027V71C727.016 71.1953 726.322 71.293 725.648 71.293C724.438 71.293 723.524 70.9268 722.909 70.1943C722.294 69.4619 721.986 68.4219 721.986 67.0742V57.2451H719.101V55.1504H721.986V51.3125H724.696ZM729.823 62.9287C729.823 61.376 730.126 59.9795 730.731 58.7393C731.347 57.499 732.196 56.542 733.28 55.8682C734.374 55.1943 735.619 54.8574 737.016 54.8574C739.174 54.8574 740.917 55.6045 742.245 57.0986C743.583 58.5928 744.252 60.5801 744.252 63.0605V63.251C744.252 64.7939 743.954 66.1807 743.358 67.4111C742.772 68.6318 741.928 69.584 740.824 70.2676C739.73 70.9512 738.471 71.293 737.045 71.293C734.896 71.293 733.153 70.5459 731.815 69.0518C730.487 67.5576 729.823 65.5801 729.823 63.1191V62.9287ZM732.548 63.251C732.548 65.0088 732.953 66.4199 733.764 67.4844C734.584 68.5488 735.678 69.0811 737.045 69.0811C738.422 69.0811 739.516 68.5439 740.326 67.4697C741.137 66.3857 741.542 64.8721 741.542 62.9287C741.542 61.1904 741.127 59.7842 740.297 58.71C739.477 57.626 738.383 57.084 737.016 57.084C735.678 57.084 734.599 57.6162 733.778 58.6807C732.958 59.7451 732.548 61.2686 732.548 63.251ZM755.312 57.582C754.901 57.5137 754.457 57.4795 753.979 57.4795C752.201 57.4795 750.995 58.2363 750.36 59.75V71H747.65V55.1504H750.287L750.331 56.9814C751.22 55.5654 752.479 54.8574 754.11 54.8574C754.638 54.8574 755.038 54.9258 755.312 55.0625V57.582Z" fill="black"/>
                    <path id="Data factor" d="M503.476 112V90.6719H509.496C511.352 90.6719 512.992 91.082 514.418 91.9023C515.844 92.7227 516.942 93.8896 517.714 95.4033C518.495 96.917 518.891 98.6553 518.9 100.618V101.98C518.9 103.992 518.51 105.755 517.729 107.269C516.957 108.782 515.849 109.944 514.403 110.755C512.968 111.565 511.293 111.98 509.379 112H503.476ZM506.288 92.9863V109.7H509.247C511.415 109.7 513.1 109.026 514.301 107.679C515.512 106.331 516.117 104.412 516.117 101.922V100.677C516.117 98.2549 515.546 96.375 514.403 95.0371C513.271 93.6895 511.659 93.0059 509.569 92.9863H506.288ZM532.523 112C532.367 111.688 532.24 111.131 532.143 110.33C530.883 111.639 529.379 112.293 527.631 112.293C526.068 112.293 524.784 111.854 523.778 110.975C522.782 110.086 522.284 108.963 522.284 107.605C522.284 105.955 522.909 104.676 524.159 103.768C525.419 102.85 527.187 102.391 529.462 102.391H532.099V101.146C532.099 100.198 531.815 99.4463 531.249 98.8896C530.683 98.3232 529.848 98.04 528.744 98.04C527.777 98.04 526.967 98.2842 526.312 98.7725C525.658 99.2607 525.331 99.8516 525.331 100.545H522.606C522.606 99.7539 522.885 98.9922 523.441 98.2598C524.008 97.5176 524.77 96.9316 525.727 96.502C526.693 96.0723 527.753 95.8574 528.905 95.8574C530.731 95.8574 532.162 96.3164 533.197 97.2344C534.232 98.1426 534.77 99.3975 534.809 100.999V108.294C534.809 109.749 534.994 110.906 535.365 111.766V112H532.523ZM528.026 109.935C528.876 109.935 529.682 109.715 530.443 109.275C531.205 108.836 531.757 108.265 532.099 107.562V104.31H529.975C526.654 104.31 524.994 105.281 524.994 107.225C524.994 108.074 525.277 108.738 525.844 109.217C526.41 109.695 527.138 109.935 528.026 109.935ZM542.733 92.3125V96.1504H545.692V98.2451H542.733V108.074C542.733 108.709 542.865 109.188 543.129 109.51C543.393 109.822 543.842 109.979 544.477 109.979C544.789 109.979 545.219 109.92 545.766 109.803V112C545.053 112.195 544.359 112.293 543.686 112.293C542.475 112.293 541.562 111.927 540.946 111.194C540.331 110.462 540.023 109.422 540.023 108.074V98.2451H537.138V96.1504H540.023V92.3125H542.733ZM558.656 112C558.5 111.688 558.373 111.131 558.275 110.33C557.016 111.639 555.512 112.293 553.764 112.293C552.201 112.293 550.917 111.854 549.911 110.975C548.915 110.086 548.417 108.963 548.417 107.605C548.417 105.955 549.042 104.676 550.292 103.768C551.552 102.85 553.319 102.391 555.595 102.391H558.231V101.146C558.231 100.198 557.948 99.4463 557.382 98.8896C556.815 98.3232 555.98 98.04 554.877 98.04C553.91 98.04 553.1 98.2842 552.445 98.7725C551.791 99.2607 551.464 99.8516 551.464 100.545H548.739C548.739 99.7539 549.018 98.9922 549.574 98.2598C550.141 97.5176 550.902 96.9316 551.859 96.502C552.826 96.0723 553.886 95.8574 555.038 95.8574C556.864 95.8574 558.295 96.3164 559.33 97.2344C560.365 98.1426 560.902 99.3975 560.941 100.999V108.294C560.941 109.749 561.127 110.906 561.498 111.766V112H558.656ZM554.159 109.935C555.009 109.935 555.814 109.715 556.576 109.275C557.338 108.836 557.89 108.265 558.231 107.562V104.31H556.107C552.787 104.31 551.127 105.281 551.127 107.225C551.127 108.074 551.41 108.738 551.977 109.217C552.543 109.695 553.271 109.935 554.159 109.935ZM573.964 112V98.2451H571.459V96.1504H573.964V94.5244C573.964 92.8252 574.418 91.5117 575.326 90.584C576.234 89.6562 577.519 89.1924 579.179 89.1924C579.804 89.1924 580.424 89.2754 581.039 89.4414L580.893 91.6387C580.434 91.5508 579.945 91.5068 579.428 91.5068C578.549 91.5068 577.87 91.7656 577.392 92.2832C576.913 92.791 576.674 93.5234 576.674 94.4805V96.1504H580.058V98.2451H576.674V112H573.964ZM592.846 112C592.689 111.688 592.562 111.131 592.465 110.33C591.205 111.639 589.701 112.293 587.953 112.293C586.391 112.293 585.106 111.854 584.101 110.975C583.104 110.086 582.606 108.963 582.606 107.605C582.606 105.955 583.231 104.676 584.481 103.768C585.741 102.85 587.509 102.391 589.784 102.391H592.421V101.146C592.421 100.198 592.138 99.4463 591.571 98.8896C591.005 98.3232 590.17 98.04 589.066 98.04C588.1 98.04 587.289 98.2842 586.635 98.7725C585.98 99.2607 585.653 99.8516 585.653 100.545H582.929C582.929 99.7539 583.207 98.9922 583.764 98.2598C584.33 97.5176 585.092 96.9316 586.049 96.502C587.016 96.0723 588.075 95.8574 589.228 95.8574C591.054 95.8574 592.484 96.3164 593.52 97.2344C594.555 98.1426 595.092 99.3975 595.131 100.999V108.294C595.131 109.749 595.316 110.906 595.688 111.766V112H592.846ZM588.349 109.935C589.198 109.935 590.004 109.715 590.766 109.275C591.527 108.836 592.079 108.265 592.421 107.562V104.31H590.297C586.977 104.31 585.316 105.281 585.316 107.225C585.316 108.074 585.6 108.738 586.166 109.217C586.732 109.695 587.46 109.935 588.349 109.935ZM605.736 110.081C606.703 110.081 607.548 109.788 608.271 109.202C608.993 108.616 609.394 107.884 609.472 107.005H612.035C611.986 107.913 611.674 108.777 611.098 109.598C610.521 110.418 609.75 111.072 608.783 111.561C607.826 112.049 606.811 112.293 605.736 112.293C603.578 112.293 601.859 111.575 600.58 110.14C599.311 108.694 598.676 106.722 598.676 104.222V103.768C598.676 102.225 598.959 100.853 599.525 99.6514C600.092 98.4502 600.902 97.5176 601.957 96.8535C603.021 96.1895 604.276 95.8574 605.722 95.8574C607.499 95.8574 608.974 96.3896 610.146 97.4541C611.327 98.5186 611.957 99.9004 612.035 101.6H609.472C609.394 100.574 609.003 99.7344 608.3 99.0801C607.606 98.416 606.747 98.084 605.722 98.084C604.345 98.084 603.275 98.582 602.514 99.5781C601.762 100.564 601.386 101.995 601.386 103.87V104.383C601.386 106.209 601.762 107.615 602.514 108.602C603.266 109.588 604.34 110.081 605.736 110.081ZM618.759 92.3125V96.1504H621.718V98.2451H618.759V108.074C618.759 108.709 618.891 109.188 619.154 109.51C619.418 109.822 619.867 109.979 620.502 109.979C620.814 109.979 621.244 109.92 621.791 109.803V112C621.078 112.195 620.385 112.293 619.711 112.293C618.5 112.293 617.587 111.927 616.972 111.194C616.356 110.462 616.049 109.422 616.049 108.074V98.2451H613.163V96.1504H616.049V92.3125H618.759ZM623.886 103.929C623.886 102.376 624.188 100.979 624.794 99.7393C625.409 98.499 626.259 97.542 627.343 96.8682C628.437 96.1943 629.682 95.8574 631.078 95.8574C633.236 95.8574 634.979 96.6045 636.308 98.0986C637.646 99.5928 638.314 101.58 638.314 104.061V104.251C638.314 105.794 638.017 107.181 637.421 108.411C636.835 109.632 635.99 110.584 634.887 111.268C633.793 111.951 632.533 112.293 631.107 112.293C628.959 112.293 627.216 111.546 625.878 110.052C624.55 108.558 623.886 106.58 623.886 104.119V103.929ZM626.61 104.251C626.61 106.009 627.016 107.42 627.826 108.484C628.646 109.549 629.74 110.081 631.107 110.081C632.484 110.081 633.578 109.544 634.389 108.47C635.199 107.386 635.604 105.872 635.604 103.929C635.604 102.19 635.189 100.784 634.359 99.71C633.539 98.626 632.445 98.084 631.078 98.084C629.74 98.084 628.661 98.6162 627.841 99.6807C627.021 100.745 626.61 102.269 626.61 104.251ZM649.374 98.582C648.964 98.5137 648.52 98.4795 648.041 98.4795C646.264 98.4795 645.058 99.2363 644.423 100.75V112H641.713V96.1504H644.35L644.394 97.9814C645.282 96.5654 646.542 95.8574 648.173 95.8574C648.7 95.8574 649.101 95.9258 649.374 96.0625V98.582Z" fill="black"/>
                    </g>
                </svg>
            </div>

        </div>
        </div>

    </div>

    <figcaption id="caption">
        1D line fitting. 
        Create data factors by clicking on the canvas or use a preset data factor configuration with the outlier, step and random buttons. 
        Note the variable nodes start at the bottom of the canvas before they have received any messages.
    </figcaption>

</figure>

