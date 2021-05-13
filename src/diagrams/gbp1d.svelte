<script>
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import * as easing from "svelte/easing";
    import { tweened } from "svelte/motion";
    import * as m from 'ml-matrix';
    import * as gauss from '../utils/gaussian';
    import * as gbp from '../gbp/gbp_surface_fitting.js';
    import { onInterval } from '../utils/util.js';


    let display_batch = false;
    let visible_alert = false;

    // Measurement model std
    let meas_std = 50;
    let smoothness_std = 50;
    let meas_lam = 1 / (meas_std * meas_std);
    let meas_lam_check = meas_lam;
    let smoothness_lam = 1 / (smoothness_std * smoothness_std);

    const waiting_mean = 350;
    const waiting_std = 40;

    // GBP variables
    const n_var_nodes = 10;
    const n_measurements = 8;
    let measurements = []

    let sweep_progress = 0;
    const bubble_progress = tweened(0);
    const move_belief_progress = tweened(0);
    const bubble_time = 400;  // ms
    const move_belief_time = 500;
    const highlight_time = 300;

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

    let n_iters = 0;
    // let iters_per_sec = 2.5;
    let dist = 0; // Average distance of belief means from MAP solution

    let graph = gbp.create1Dgraph(n_var_nodes, smoothness_std);
    genRandomMeasurements(n_measurements, measurements);
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
                beliefs = beliefs_show(graph.get_beliefs());
                n_iters++;

                lastTime = now;
            }

        }
        
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
                graph.addLinearMeasurement(y, x, [Math.floor(ix), Math.ceil(ix)], x_lhs, x_rhs, meas_std);
                measurements.push({x: x, y: y})
                measurements = measurements;  // to tell svelte measurements has been updated
            }
            map = graph.computeMAP();
        }
    }

    function genRandomMeasurements() {
        visible_alert = false;
        measurements = [];
        graph.factors = graph.factors.slice(0, 9);
        for (var i=0; i<n_measurements; i++) {
            var x = Math.random() * (width - 2 * nodes_x_offset) + nodes_x_offset;
            var y = Math.random() * (height - 3 * nodes_x_offset) + nodes_x_offset;
            var ix = (x - nodes_x_offset) / node_x_spacing;
            var x_lhs = nodes_x_offset + Math.floor(ix)*node_x_spacing;
            var x_rhs = nodes_x_offset + Math.ceil(ix)*node_x_spacing;
            graph.addLinearMeasurement(y, x, [Math.floor(ix), Math.ceil(ix)], x_lhs, x_rhs, meas_std);
            measurements.push({x: x, y: y})
        }
    }

	function newRandMeasurements() {
        sync_on = false;
        sweep_on = false;
        n_iters = 0;
        graph = gbp.create1Dgraph(n_var_nodes, smoothness_std);
        genRandomMeasurements(n_measurements, measurements);
        beliefs = beliefs_show(graph.get_beliefs());
        map = graph.computeMAP();
    }

	function clearMeasurements() {
        measurements = [];
        graph.factors = graph.factors.slice(0, 9);
        sync_on = false;
        sweep_on = false;
        display_batch = false;
        n_iters = 0;
        graph = gbp.create1Dgraph(n_var_nodes, smoothness_std);
        beliefs = beliefs_show(graph.get_beliefs());
    }

  // User interaction functions
  function toggleSweepGBP() {
    if (measurements.length == 0) {
        visible_alert = true;
    } else {
      if (sweep_on){
        sweep_on = false;
      } else {
        sweep_on = true;
        iters_per_sec = 2.5;
        sync_on = false;
      }
    }
  }

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
        row-gap: 10px;
        width: 600px;
    }

    @media (min-width: 1300px) {
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
    }
 
    #caption {
        text-align: left;
        grid-column: page;
    }

    #svg {
        width: 600px;
        height: 300px;
        background-color: var(--gray-bg);
        border: 1px solid var(--gray);
    }

    #control-panel {
        width: 100%;
        height: 100%;
        line-height: 1em;
        display: grid;
        grid-template-columns: auto;
        grid-template-rows: 14px 65px 14px 65px 9px 20px 60px 18px 60px;
        grid-row-end: auto;
        row-gap: 10px;
    }

    #panel2 {
        display: grid;
        grid-template-columns: auto 1.25fr 1fr;
        column-gap: 10px;
        /* background-color: paleturquoise; */
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
    }

    .slider-container {
        font-size: 14px;
    }

    .full-width-slider {
        width: 100%;
    }

    .full-width-button {
        width: 90%;
    }

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
    }

    .mp-button {
        border: 1px solid green; /* Green border */
        background-color:  rgba(0, 0, 0, 0.1);
    }

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

    #play-pause-reset-speed {
        display: grid; 
        grid-template-columns: 1fr 1fr 2.4fr;
        grid-gap: 2px;
    }

    .node_g {
        cursor: pointer;
    }

    .clickable {
        cursor: pointer;
    }

    .mess-bubble {
        stroke: var(--red);
        fill: var(--red);
    }

    .hidden {
        /* stroke: black; */
        display: none;
    }

    #factor-graph {
        width: 100%
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
                    <rect class="meas" x={meas.x-sqr_size/2} y={meas.y-sqr_size/2} width={sqr_size} height={sqr_size}/>
                    <!-- <line class="meas-line" x1={meas.x} x2={meas.x} y1={meas.y + meas_std} y2={meas.y - meas_std}/> -->
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
                    <circle on:click={sendMessage} id="{i}" 
                        class:hidden={hide_beliefs.includes(i)}
                        class="node_g" class:belief-mean={highlight_id!=i} class:highlighted={highlight_id==i} 
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

            <div class="hint bold-text">
                Click on the canvas to add data factors. <br> Click on a variable node to send messages to its neighbours.
            </div>

            <svg width="335" height="86" viewBox="0 0 335 86" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <g id="buttons">
                    <rect id="gt box" class="clickable" on:click={toggleBatch} x="260" y="7" width="40" height="27" fill="#C4C4C4" opacity="0"/>
                    <path id="GT" class="clickable" on:click={toggleBatch} d="M278.779 28.3047C277.988 29.252 276.87 29.9893 275.425 30.5166C273.979 31.0342 272.378 31.293 270.62 31.293C268.774 31.293 267.153 30.8926 265.757 30.0918C264.37 29.2812 263.296 28.1094 262.534 26.5762C261.782 25.043 261.396 23.2412 261.377 21.1709V19.7207C261.377 17.5918 261.733 15.751 262.446 14.1982C263.169 12.6357 264.204 11.4443 265.552 10.624C266.909 9.79395 268.496 9.37891 270.312 9.37891C272.842 9.37891 274.819 9.98438 276.245 11.1953C277.671 12.3965 278.516 14.1494 278.779 16.4541H274.502C274.307 15.2334 273.872 14.3398 273.198 13.7734C272.534 13.207 271.616 12.9238 270.444 12.9238C268.95 12.9238 267.812 13.4854 267.031 14.6084C266.25 15.7314 265.854 17.4014 265.845 19.6182V20.9805C265.845 23.2168 266.27 24.9062 267.119 26.0488C267.969 27.1914 269.214 27.7627 270.854 27.7627C272.505 27.7627 273.682 27.4111 274.385 26.708V23.0312H270.386V19.7939H278.779V28.3047ZM298.408 13.2314H291.875V31H287.48V13.2314H281.035V9.67188H298.408V13.2314Z" fill="black"/>
                    <rect id="Delete" class="clickable" on:click={clearMeasurements} x="141" y="1" width="41.7647" height="41.7647" fill="url(#p0)"/>
                    <rect id="Reset" class="clickable" on:click={newRandMeasurements} x="22.1961" y="0.784302" width="41.7647" height="41.7647" fill="url(#p1)"/>
                    <path id="Clear data factors" d="M135.406 54.3906C135.266 55.5938 134.82 56.5234 134.07 57.1797C133.326 57.8307 132.333 58.1562 131.094 58.1562C129.75 58.1562 128.672 57.6745 127.859 56.7109C127.052 55.7474 126.648 54.4583 126.648 52.8438V51.75C126.648 50.6927 126.836 49.763 127.211 48.9609C127.591 48.1589 128.128 47.5443 128.82 47.1172C129.513 46.6849 130.315 46.4688 131.227 46.4688C132.435 46.4688 133.404 46.8073 134.133 47.4844C134.862 48.1562 135.286 49.0885 135.406 50.2812H133.898C133.768 49.375 133.484 48.7188 133.047 48.3125C132.615 47.9062 132.008 47.7031 131.227 47.7031C130.268 47.7031 129.516 48.0573 128.969 48.7656C128.427 49.474 128.156 50.4818 128.156 51.7891V52.8906C128.156 54.125 128.414 55.1068 128.93 55.8359C129.445 56.5651 130.167 56.9297 131.094 56.9297C131.927 56.9297 132.565 56.7422 133.008 56.3672C133.456 55.987 133.753 55.3281 133.898 54.3906H135.406ZM138.805 58H137.359V46H138.805V58ZM144.633 58.1562C143.487 58.1562 142.555 57.7812 141.836 57.0312C141.117 56.276 140.758 55.2682 140.758 54.0078V53.7422C140.758 52.9036 140.917 52.1562 141.234 51.5C141.557 50.8385 142.005 50.3229 142.578 49.9531C143.156 49.5781 143.781 49.3906 144.453 49.3906C145.552 49.3906 146.406 49.7526 147.016 50.4766C147.625 51.2005 147.93 52.237 147.93 53.5859V54.1875H142.203C142.224 55.0208 142.466 55.6953 142.93 56.2109C143.398 56.7214 143.992 56.9766 144.711 56.9766C145.221 56.9766 145.654 56.8724 146.008 56.6641C146.362 56.4557 146.672 56.1797 146.938 55.8359L147.82 56.5234C147.112 57.612 146.049 58.1562 144.633 58.1562ZM144.453 50.5781C143.87 50.5781 143.38 50.7917 142.984 51.2188C142.589 51.6406 142.344 52.2344 142.25 53H146.484V52.8906C146.443 52.1562 146.245 51.5885 145.891 51.1875C145.536 50.7812 145.057 50.5781 144.453 50.5781ZM154.828 58C154.745 57.8333 154.677 57.5365 154.625 57.1094C153.953 57.8073 153.151 58.1562 152.219 58.1562C151.385 58.1562 150.701 57.9219 150.164 57.4531C149.633 56.9792 149.367 56.3802 149.367 55.6562C149.367 54.776 149.701 54.0938 150.367 53.6094C151.039 53.1198 151.982 52.875 153.195 52.875H154.602V52.2109C154.602 51.7057 154.451 51.3047 154.148 51.0078C153.846 50.7057 153.401 50.5547 152.812 50.5547C152.297 50.5547 151.865 50.6849 151.516 50.9453C151.167 51.2057 150.992 51.5208 150.992 51.8906H149.539C149.539 51.4688 149.688 51.0625 149.984 50.6719C150.286 50.276 150.693 49.9635 151.203 49.7344C151.719 49.5052 152.284 49.3906 152.898 49.3906C153.872 49.3906 154.635 49.6354 155.188 50.125C155.74 50.6094 156.026 51.2786 156.047 52.1328V56.0234C156.047 56.7995 156.146 57.4167 156.344 57.875V58H154.828ZM152.43 56.8984C152.883 56.8984 153.312 56.7812 153.719 56.5469C154.125 56.3125 154.419 56.0078 154.602 55.6328V53.8984H153.469C151.698 53.8984 150.812 54.4167 150.812 55.4531C150.812 55.9062 150.964 56.2604 151.266 56.5156C151.568 56.7708 151.956 56.8984 152.43 56.8984ZM162.398 50.8438C162.18 50.8073 161.943 50.7891 161.688 50.7891C160.74 50.7891 160.096 51.1927 159.758 52V58H158.312V49.5469H159.719L159.742 50.5234C160.216 49.7682 160.888 49.3906 161.758 49.3906C162.039 49.3906 162.253 49.4271 162.398 49.5V50.8438ZM167.352 53.7031C167.352 52.4062 167.659 51.3646 168.273 50.5781C168.888 49.7865 169.693 49.3906 170.688 49.3906C171.677 49.3906 172.461 49.7292 173.039 50.4062V46H174.484V58H173.156L173.086 57.0938C172.508 57.8021 171.703 58.1562 170.672 58.1562C169.693 58.1562 168.893 57.7552 168.273 56.9531C167.659 56.151 167.352 55.1042 167.352 53.8125V53.7031ZM168.797 53.8672C168.797 54.8255 168.995 55.5755 169.391 56.1172C169.786 56.6589 170.333 56.9297 171.031 56.9297C171.948 56.9297 172.617 56.5182 173.039 55.6953V51.8125C172.607 51.0156 171.943 50.6172 171.047 50.6172C170.339 50.6172 169.786 50.8906 169.391 51.4375C168.995 51.9844 168.797 52.7943 168.797 53.8672ZM181.953 58C181.87 57.8333 181.802 57.5365 181.75 57.1094C181.078 57.8073 180.276 58.1562 179.344 58.1562C178.51 58.1562 177.826 57.9219 177.289 57.4531C176.758 56.9792 176.492 56.3802 176.492 55.6562C176.492 54.776 176.826 54.0938 177.492 53.6094C178.164 53.1198 179.107 52.875 180.32 52.875H181.727V52.2109C181.727 51.7057 181.576 51.3047 181.273 51.0078C180.971 50.7057 180.526 50.5547 179.938 50.5547C179.422 50.5547 178.99 50.6849 178.641 50.9453C178.292 51.2057 178.117 51.5208 178.117 51.8906H176.664C176.664 51.4688 176.812 51.0625 177.109 50.6719C177.411 50.276 177.818 49.9635 178.328 49.7344C178.844 49.5052 179.409 49.3906 180.023 49.3906C180.997 49.3906 181.76 49.6354 182.312 50.125C182.865 50.6094 183.151 51.2786 183.172 52.1328V56.0234C183.172 56.7995 183.271 57.4167 183.469 57.875V58H181.953ZM179.555 56.8984C180.008 56.8984 180.438 56.7812 180.844 56.5469C181.25 56.3125 181.544 56.0078 181.727 55.6328V53.8984H180.594C178.823 53.8984 177.938 54.4167 177.938 55.4531C177.938 55.9062 178.089 56.2604 178.391 56.5156C178.693 56.7708 179.081 56.8984 179.555 56.8984ZM187.398 47.5V49.5469H188.977V50.6641H187.398V55.9062C187.398 56.2448 187.469 56.5 187.609 56.6719C187.75 56.8385 187.99 56.9219 188.328 56.9219C188.495 56.9219 188.724 56.8906 189.016 56.8281V58C188.635 58.1042 188.266 58.1562 187.906 58.1562C187.26 58.1562 186.773 57.9609 186.445 57.5703C186.117 57.1797 185.953 56.625 185.953 55.9062V50.6641H184.414V49.5469H185.953V47.5H187.398ZM195.891 58C195.807 57.8333 195.74 57.5365 195.688 57.1094C195.016 57.8073 194.214 58.1562 193.281 58.1562C192.448 58.1562 191.763 57.9219 191.227 57.4531C190.695 56.9792 190.43 56.3802 190.43 55.6562C190.43 54.776 190.763 54.0938 191.43 53.6094C192.102 53.1198 193.044 52.875 194.258 52.875H195.664V52.2109C195.664 51.7057 195.513 51.3047 195.211 51.0078C194.909 50.7057 194.464 50.5547 193.875 50.5547C193.359 50.5547 192.927 50.6849 192.578 50.9453C192.229 51.2057 192.055 51.5208 192.055 51.8906H190.602C190.602 51.4688 190.75 51.0625 191.047 50.6719C191.349 50.276 191.755 49.9635 192.266 49.7344C192.781 49.5052 193.346 49.3906 193.961 49.3906C194.935 49.3906 195.698 49.6354 196.25 50.125C196.802 50.6094 197.089 51.2786 197.109 52.1328V56.0234C197.109 56.7995 197.208 57.4167 197.406 57.875V58H195.891ZM193.492 56.8984C193.945 56.8984 194.375 56.7812 194.781 56.5469C195.188 56.3125 195.482 56.0078 195.664 55.6328V53.8984H194.531C192.76 53.8984 191.875 54.4167 191.875 55.4531C191.875 55.9062 192.026 56.2604 192.328 56.5156C192.63 56.7708 193.018 56.8984 193.492 56.8984ZM138.547 77V69.6641H137.211V68.5469H138.547V67.6797C138.547 66.7734 138.789 66.0729 139.273 65.5781C139.758 65.0833 140.443 64.8359 141.328 64.8359C141.661 64.8359 141.992 64.8802 142.32 64.9688L142.242 66.1406C141.997 66.0938 141.737 66.0703 141.461 66.0703C140.992 66.0703 140.63 66.2083 140.375 66.4844C140.12 66.7552 139.992 67.1458 139.992 67.6562V68.5469H141.797V69.6641H139.992V77H138.547ZM148.617 77C148.534 76.8333 148.466 76.5365 148.414 76.1094C147.742 76.8073 146.94 77.1562 146.008 77.1562C145.174 77.1562 144.49 76.9219 143.953 76.4531C143.422 75.9792 143.156 75.3802 143.156 74.6562C143.156 73.776 143.49 73.0938 144.156 72.6094C144.828 72.1198 145.771 71.875 146.984 71.875H148.391V71.2109C148.391 70.7057 148.24 70.3047 147.938 70.0078C147.635 69.7057 147.19 69.5547 146.602 69.5547C146.086 69.5547 145.654 69.6849 145.305 69.9453C144.956 70.2057 144.781 70.5208 144.781 70.8906H143.328C143.328 70.4688 143.477 70.0625 143.773 69.6719C144.076 69.276 144.482 68.9635 144.992 68.7344C145.508 68.5052 146.073 68.3906 146.688 68.3906C147.661 68.3906 148.424 68.6354 148.977 69.125C149.529 69.6094 149.815 70.2786 149.836 71.1328V75.0234C149.836 75.7995 149.935 76.4167 150.133 76.875V77H148.617ZM146.219 75.8984C146.672 75.8984 147.102 75.7812 147.508 75.5469C147.914 75.3125 148.208 75.0078 148.391 74.6328V72.8984H147.258C145.487 72.8984 144.602 73.4167 144.602 74.4531C144.602 74.9062 144.753 75.2604 145.055 75.5156C145.357 75.7708 145.745 75.8984 146.219 75.8984ZM155.492 75.9766C156.008 75.9766 156.458 75.8203 156.844 75.5078C157.229 75.1953 157.443 74.8047 157.484 74.3359H158.852C158.826 74.8203 158.659 75.2812 158.352 75.7188C158.044 76.1562 157.633 76.5052 157.117 76.7656C156.607 77.026 156.065 77.1562 155.492 77.1562C154.341 77.1562 153.424 76.7734 152.742 76.0078C152.065 75.237 151.727 74.1849 151.727 72.8516V72.6094C151.727 71.7865 151.878 71.0547 152.18 70.4141C152.482 69.7734 152.914 69.276 153.477 68.9219C154.044 68.5677 154.714 68.3906 155.484 68.3906C156.432 68.3906 157.219 68.6745 157.844 69.2422C158.474 69.8099 158.81 70.5469 158.852 71.4531H157.484C157.443 70.9062 157.234 70.4583 156.859 70.1094C156.49 69.7552 156.031 69.5781 155.484 69.5781C154.75 69.5781 154.18 69.8438 153.773 70.375C153.372 70.901 153.172 71.6641 153.172 72.6641V72.9375C153.172 73.9115 153.372 74.6615 153.773 75.1875C154.174 75.7135 154.747 75.9766 155.492 75.9766ZM162.438 66.5V68.5469H164.016V69.6641H162.438V74.9062C162.438 75.2448 162.508 75.5 162.648 75.6719C162.789 75.8385 163.029 75.9219 163.367 75.9219C163.534 75.9219 163.763 75.8906 164.055 75.8281V77C163.674 77.1042 163.305 77.1562 162.945 77.1562C162.299 77.1562 161.812 76.9609 161.484 76.5703C161.156 76.1797 160.992 75.625 160.992 74.9062V69.6641H159.453V68.5469H160.992V66.5H162.438ZM165.172 72.6953C165.172 71.8672 165.333 71.1224 165.656 70.4609C165.984 69.7995 166.438 69.2891 167.016 68.9297C167.599 68.5703 168.263 68.3906 169.008 68.3906C170.159 68.3906 171.089 68.7891 171.797 69.5859C172.51 70.3828 172.867 71.4427 172.867 72.7656V72.8672C172.867 73.6901 172.708 74.4297 172.391 75.0859C172.078 75.737 171.628 76.2448 171.039 76.6094C170.456 76.974 169.784 77.1562 169.023 77.1562C167.878 77.1562 166.948 76.7578 166.234 75.9609C165.526 75.1641 165.172 74.1094 165.172 72.7969V72.6953ZM166.625 72.8672C166.625 73.8047 166.841 74.5573 167.273 75.125C167.711 75.6927 168.294 75.9766 169.023 75.9766C169.758 75.9766 170.341 75.6901 170.773 75.1172C171.206 74.5391 171.422 73.7318 171.422 72.6953C171.422 71.7682 171.201 71.0182 170.758 70.4453C170.32 69.8672 169.737 69.5781 169.008 69.5781C168.294 69.5781 167.719 69.862 167.281 70.4297C166.844 70.9974 166.625 71.8099 166.625 72.8672ZM178.766 69.8438C178.547 69.8073 178.31 69.7891 178.055 69.7891C177.107 69.7891 176.464 70.1927 176.125 71V77H174.68V68.5469H176.086L176.109 69.5234C176.583 68.7682 177.255 68.3906 178.125 68.3906C178.406 68.3906 178.62 68.4271 178.766 68.5V69.8438ZM185.023 74.7578C185.023 74.3672 184.875 74.0651 184.578 73.8516C184.286 73.6328 183.773 73.4453 183.039 73.2891C182.31 73.1328 181.729 72.9453 181.297 72.7266C180.87 72.5078 180.552 72.2474 180.344 71.9453C180.141 71.6432 180.039 71.2839 180.039 70.8672C180.039 70.1745 180.331 69.5885 180.914 69.1094C181.503 68.6302 182.253 68.3906 183.164 68.3906C184.122 68.3906 184.898 68.638 185.492 69.1328C186.091 69.6276 186.391 70.2604 186.391 71.0312H184.938C184.938 70.6354 184.768 70.2943 184.43 70.0078C184.096 69.7214 183.674 69.5781 183.164 69.5781C182.638 69.5781 182.227 69.6927 181.93 69.9219C181.633 70.151 181.484 70.4505 181.484 70.8203C181.484 71.1693 181.622 71.4323 181.898 71.6094C182.174 71.7865 182.672 71.9557 183.391 72.1172C184.115 72.2786 184.701 72.4714 185.148 72.6953C185.596 72.9193 185.927 73.1901 186.141 73.5078C186.359 73.8203 186.469 74.2031 186.469 74.6562C186.469 75.4115 186.167 76.0182 185.562 76.4766C184.958 76.9297 184.174 77.1562 183.211 77.1562C182.534 77.1562 181.935 77.0365 181.414 76.7969C180.893 76.5573 180.484 76.224 180.188 75.7969C179.896 75.3646 179.75 74.8984 179.75 74.3984H181.195C181.221 74.8828 181.414 75.2682 181.773 75.5547C182.138 75.8359 182.617 75.9766 183.211 75.9766C183.758 75.9766 184.195 75.8672 184.523 75.6484C184.857 75.4245 185.023 75.1276 185.023 74.7578Z" fill="black"/>
                    <path id="Toggle ground truth marginals" d="M238.047 47.8594H234.391V58H232.898V47.8594H229.25V46.625H238.047V47.8594ZM238.344 53.6953C238.344 52.8672 238.505 52.1224 238.828 51.4609C239.156 50.7995 239.609 50.2891 240.188 49.9297C240.771 49.5703 241.435 49.3906 242.18 49.3906C243.331 49.3906 244.26 49.7891 244.969 50.5859C245.682 51.3828 246.039 52.4427 246.039 53.7656V53.8672C246.039 54.6901 245.88 55.4297 245.562 56.0859C245.25 56.737 244.799 57.2448 244.211 57.6094C243.628 57.974 242.956 58.1562 242.195 58.1562C241.049 58.1562 240.12 57.7578 239.406 56.9609C238.698 56.1641 238.344 55.1094 238.344 53.7969V53.6953ZM239.797 53.8672C239.797 54.8047 240.013 55.5573 240.445 56.125C240.883 56.6927 241.466 56.9766 242.195 56.9766C242.93 56.9766 243.513 56.6901 243.945 56.1172C244.378 55.5391 244.594 54.7318 244.594 53.6953C244.594 52.7682 244.372 52.0182 243.93 51.4453C243.492 50.8672 242.909 50.5781 242.18 50.5781C241.466 50.5781 240.891 50.862 240.453 51.4297C240.016 51.9974 239.797 52.8099 239.797 53.8672ZM247.508 53.7031C247.508 52.3854 247.812 51.3385 248.422 50.5625C249.031 49.7812 249.839 49.3906 250.844 49.3906C251.875 49.3906 252.68 49.7552 253.258 50.4844L253.328 49.5469H254.648V57.7969C254.648 58.8906 254.323 59.7526 253.672 60.3828C253.026 61.013 252.156 61.3281 251.062 61.3281C250.453 61.3281 249.857 61.1979 249.273 60.9375C248.69 60.6771 248.245 60.3203 247.938 59.8672L248.688 59C249.307 59.7656 250.065 60.1484 250.961 60.1484C251.664 60.1484 252.211 59.9505 252.602 59.5547C252.997 59.1589 253.195 58.6016 253.195 57.8828V57.1562C252.617 57.8229 251.828 58.1562 250.828 58.1562C249.839 58.1562 249.036 57.7578 248.422 56.9609C247.812 56.1641 247.508 55.0781 247.508 53.7031ZM248.961 53.8672C248.961 54.8203 249.156 55.5703 249.547 56.1172C249.938 56.6589 250.484 56.9297 251.188 56.9297C252.099 56.9297 252.768 56.5156 253.195 55.6875V51.8281C252.753 51.0208 252.089 50.6172 251.203 50.6172C250.5 50.6172 249.951 50.8906 249.555 51.4375C249.159 51.9844 248.961 52.7943 248.961 53.8672ZM256.492 53.7031C256.492 52.3854 256.797 51.3385 257.406 50.5625C258.016 49.7812 258.823 49.3906 259.828 49.3906C260.859 49.3906 261.664 49.7552 262.242 50.4844L262.312 49.5469H263.633V57.7969C263.633 58.8906 263.307 59.7526 262.656 60.3828C262.01 61.013 261.141 61.3281 260.047 61.3281C259.438 61.3281 258.841 61.1979 258.258 60.9375C257.674 60.6771 257.229 60.3203 256.922 59.8672L257.672 59C258.292 59.7656 259.049 60.1484 259.945 60.1484C260.648 60.1484 261.195 59.9505 261.586 59.5547C261.982 59.1589 262.18 58.6016 262.18 57.8828V57.1562C261.602 57.8229 260.812 58.1562 259.812 58.1562C258.823 58.1562 258.021 57.7578 257.406 56.9609C256.797 56.1641 256.492 55.0781 256.492 53.7031ZM257.945 53.8672C257.945 54.8203 258.141 55.5703 258.531 56.1172C258.922 56.6589 259.469 56.9297 260.172 56.9297C261.083 56.9297 261.753 56.5156 262.18 55.6875V51.8281C261.737 51.0208 261.073 50.6172 260.188 50.6172C259.484 50.6172 258.935 50.8906 258.539 51.4375C258.143 51.9844 257.945 52.7943 257.945 53.8672ZM267.391 58H265.945V46H267.391V58ZM273.219 58.1562C272.073 58.1562 271.141 57.7812 270.422 57.0312C269.703 56.276 269.344 55.2682 269.344 54.0078V53.7422C269.344 52.9036 269.503 52.1562 269.82 51.5C270.143 50.8385 270.591 50.3229 271.164 49.9531C271.742 49.5781 272.367 49.3906 273.039 49.3906C274.138 49.3906 274.992 49.7526 275.602 50.4766C276.211 51.2005 276.516 52.237 276.516 53.5859V54.1875H270.789C270.81 55.0208 271.052 55.6953 271.516 56.2109C271.984 56.7214 272.578 56.9766 273.297 56.9766C273.807 56.9766 274.24 56.8724 274.594 56.6641C274.948 56.4557 275.258 56.1797 275.523 55.8359L276.406 56.5234C275.698 57.612 274.635 58.1562 273.219 58.1562ZM273.039 50.5781C272.456 50.5781 271.966 50.7917 271.57 51.2188C271.174 51.6406 270.93 52.2344 270.836 53H275.07V52.8906C275.029 52.1562 274.831 51.5885 274.477 51.1875C274.122 50.7812 273.643 50.5781 273.039 50.5781ZM281.82 53.7031C281.82 52.3854 282.125 51.3385 282.734 50.5625C283.344 49.7812 284.151 49.3906 285.156 49.3906C286.188 49.3906 286.992 49.7552 287.57 50.4844L287.641 49.5469H288.961V57.7969C288.961 58.8906 288.635 59.7526 287.984 60.3828C287.339 61.013 286.469 61.3281 285.375 61.3281C284.766 61.3281 284.169 61.1979 283.586 60.9375C283.003 60.6771 282.557 60.3203 282.25 59.8672L283 59C283.62 59.7656 284.378 60.1484 285.273 60.1484C285.977 60.1484 286.523 59.9505 286.914 59.5547C287.31 59.1589 287.508 58.6016 287.508 57.8828V57.1562C286.93 57.8229 286.141 58.1562 285.141 58.1562C284.151 58.1562 283.349 57.7578 282.734 56.9609C282.125 56.1641 281.82 55.0781 281.82 53.7031ZM283.273 53.8672C283.273 54.8203 283.469 55.5703 283.859 56.1172C284.25 56.6589 284.797 56.9297 285.5 56.9297C286.411 56.9297 287.081 56.5156 287.508 55.6875V51.8281C287.065 51.0208 286.401 50.6172 285.516 50.6172C284.812 50.6172 284.263 50.8906 283.867 51.4375C283.471 51.9844 283.273 52.7943 283.273 53.8672ZM295.234 50.8438C295.016 50.8073 294.779 50.7891 294.523 50.7891C293.576 50.7891 292.932 51.1927 292.594 52V58H291.148V49.5469H292.555L292.578 50.5234C293.052 49.7682 293.724 49.3906 294.594 49.3906C294.875 49.3906 295.089 49.4271 295.234 49.5V50.8438ZM296.031 53.6953C296.031 52.8672 296.193 52.1224 296.516 51.4609C296.844 50.7995 297.297 50.2891 297.875 49.9297C298.458 49.5703 299.122 49.3906 299.867 49.3906C301.018 49.3906 301.948 49.7891 302.656 50.5859C303.37 51.3828 303.727 52.4427 303.727 53.7656V53.8672C303.727 54.6901 303.568 55.4297 303.25 56.0859C302.938 56.737 302.487 57.2448 301.898 57.6094C301.315 57.974 300.643 58.1562 299.883 58.1562C298.737 58.1562 297.807 57.7578 297.094 56.9609C296.385 56.1641 296.031 55.1094 296.031 53.7969V53.6953ZM297.484 53.8672C297.484 54.8047 297.701 55.5573 298.133 56.125C298.57 56.6927 299.154 56.9766 299.883 56.9766C300.617 56.9766 301.201 56.6901 301.633 56.1172C302.065 55.5391 302.281 54.7318 302.281 53.6953C302.281 52.7682 302.06 52.0182 301.617 51.4453C301.18 50.8672 300.596 50.5781 299.867 50.5781C299.154 50.5781 298.578 50.862 298.141 51.4297C297.703 51.9974 297.484 52.8099 297.484 53.8672ZM310.758 57.1641C310.195 57.8255 309.37 58.1562 308.281 58.1562C307.38 58.1562 306.693 57.8958 306.219 57.375C305.75 56.849 305.513 56.0729 305.508 55.0469V49.5469H306.953V55.0078C306.953 56.2891 307.474 56.9297 308.516 56.9297C309.62 56.9297 310.354 56.5182 310.719 55.6953V49.5469H312.164V58H310.789L310.758 57.1641ZM315.734 49.5469L315.781 50.6094C316.427 49.7969 317.271 49.3906 318.312 49.3906C320.099 49.3906 321 50.3984 321.016 52.4141V58H319.57V52.4062C319.565 51.7969 319.424 51.3464 319.148 51.0547C318.878 50.763 318.453 50.6172 317.875 50.6172C317.406 50.6172 316.995 50.7422 316.641 50.9922C316.286 51.2422 316.01 51.5703 315.812 51.9766V58H314.367V49.5469H315.734ZM322.844 53.7031C322.844 52.4062 323.151 51.3646 323.766 50.5781C324.38 49.7865 325.185 49.3906 326.18 49.3906C327.169 49.3906 327.953 49.7292 328.531 50.4062V46H329.977V58H328.648L328.578 57.0938C328 57.8021 327.195 58.1562 326.164 58.1562C325.185 58.1562 324.385 57.7552 323.766 56.9531C323.151 56.151 322.844 55.1042 322.844 53.8125V53.7031ZM324.289 53.8672C324.289 54.8255 324.487 55.5755 324.883 56.1172C325.279 56.6589 325.826 56.9297 326.523 56.9297C327.44 56.9297 328.109 56.5182 328.531 55.6953V51.8125C328.099 51.0156 327.435 50.6172 326.539 50.6172C325.831 50.6172 325.279 50.8906 324.883 51.4375C324.487 51.9844 324.289 52.7943 324.289 53.8672ZM229.031 66.5V68.5469H230.609V69.6641H229.031V74.9062C229.031 75.2448 229.102 75.5 229.242 75.6719C229.383 75.8385 229.622 75.9219 229.961 75.9219C230.128 75.9219 230.357 75.8906 230.648 75.8281V77C230.268 77.1042 229.898 77.1562 229.539 77.1562C228.893 77.1562 228.406 76.9609 228.078 76.5703C227.75 76.1797 227.586 75.625 227.586 74.9062V69.6641H226.047V68.5469H227.586V66.5H229.031ZM236.391 69.8438C236.172 69.8073 235.935 69.7891 235.68 69.7891C234.732 69.7891 234.089 70.1927 233.75 71V77H232.305V68.5469H233.711L233.734 69.5234C234.208 68.7682 234.88 68.3906 235.75 68.3906C236.031 68.3906 236.245 68.4271 236.391 68.5V69.8438ZM242.945 76.1641C242.383 76.8255 241.557 77.1562 240.469 77.1562C239.568 77.1562 238.88 76.8958 238.406 76.375C237.938 75.849 237.701 75.0729 237.695 74.0469V68.5469H239.141V74.0078C239.141 75.2891 239.661 75.9297 240.703 75.9297C241.807 75.9297 242.542 75.5182 242.906 74.6953V68.5469H244.352V77H242.977L242.945 76.1641ZM248.516 66.5V68.5469H250.094V69.6641H248.516V74.9062C248.516 75.2448 248.586 75.5 248.727 75.6719C248.867 75.8385 249.107 75.9219 249.445 75.9219C249.612 75.9219 249.841 75.8906 250.133 75.8281V77C249.753 77.1042 249.383 77.1562 249.023 77.1562C248.378 77.1562 247.891 76.9609 247.562 76.5703C247.234 76.1797 247.07 75.625 247.07 74.9062V69.6641H245.531V68.5469H247.07V66.5H248.516ZM253.234 69.5703C253.875 68.7839 254.708 68.3906 255.734 68.3906C257.521 68.3906 258.422 69.3984 258.438 71.4141V77H256.992V71.4062C256.987 70.7969 256.846 70.3464 256.57 70.0547C256.299 69.763 255.875 69.6172 255.297 69.6172C254.828 69.6172 254.417 69.7422 254.062 69.9922C253.708 70.2422 253.432 70.5703 253.234 70.9766V77H251.789V65H253.234V69.5703ZM265.93 68.5469L265.969 69.4844C266.589 68.7552 267.424 68.3906 268.477 68.3906C269.659 68.3906 270.464 68.8438 270.891 69.75C271.172 69.3438 271.536 69.0156 271.984 68.7656C272.438 68.5156 272.971 68.3906 273.586 68.3906C275.44 68.3906 276.383 69.3724 276.414 71.3359V77H274.969V71.4219C274.969 70.8177 274.831 70.3672 274.555 70.0703C274.279 69.7682 273.815 69.6172 273.164 69.6172C272.628 69.6172 272.182 69.7786 271.828 70.1016C271.474 70.4193 271.268 70.849 271.211 71.3906V77H269.758V71.4609C269.758 70.2318 269.156 69.6172 267.953 69.6172C267.005 69.6172 266.357 70.0208 266.008 70.8281V77H264.562V68.5469H265.93ZM283.82 77C283.737 76.8333 283.669 76.5365 283.617 76.1094C282.945 76.8073 282.143 77.1562 281.211 77.1562C280.378 77.1562 279.693 76.9219 279.156 76.4531C278.625 75.9792 278.359 75.3802 278.359 74.6562C278.359 73.776 278.693 73.0938 279.359 72.6094C280.031 72.1198 280.974 71.875 282.188 71.875H283.594V71.2109C283.594 70.7057 283.443 70.3047 283.141 70.0078C282.839 69.7057 282.393 69.5547 281.805 69.5547C281.289 69.5547 280.857 69.6849 280.508 69.9453C280.159 70.2057 279.984 70.5208 279.984 70.8906H278.531C278.531 70.4688 278.68 70.0625 278.977 69.6719C279.279 69.276 279.685 68.9635 280.195 68.7344C280.711 68.5052 281.276 68.3906 281.891 68.3906C282.865 68.3906 283.628 68.6354 284.18 69.125C284.732 69.6094 285.018 70.2786 285.039 71.1328V75.0234C285.039 75.7995 285.138 76.4167 285.336 76.875V77H283.82ZM281.422 75.8984C281.875 75.8984 282.305 75.7812 282.711 75.5469C283.117 75.3125 283.411 75.0078 283.594 74.6328V72.8984H282.461C280.69 72.8984 279.805 73.4167 279.805 74.4531C279.805 74.9062 279.956 75.2604 280.258 75.5156C280.56 75.7708 280.948 75.8984 281.422 75.8984ZM291.391 69.8438C291.172 69.8073 290.935 69.7891 290.68 69.7891C289.732 69.7891 289.089 70.1927 288.75 71V77H287.305V68.5469H288.711L288.734 69.5234C289.208 68.7682 289.88 68.3906 290.75 68.3906C291.031 68.3906 291.245 68.4271 291.391 68.5V69.8438ZM292.227 72.7031C292.227 71.3854 292.531 70.3385 293.141 69.5625C293.75 68.7812 294.557 68.3906 295.562 68.3906C296.594 68.3906 297.398 68.7552 297.977 69.4844L298.047 68.5469H299.367V76.7969C299.367 77.8906 299.042 78.7526 298.391 79.3828C297.745 80.013 296.875 80.3281 295.781 80.3281C295.172 80.3281 294.576 80.1979 293.992 79.9375C293.409 79.6771 292.964 79.3203 292.656 78.8672L293.406 78C294.026 78.7656 294.784 79.1484 295.68 79.1484C296.383 79.1484 296.93 78.9505 297.32 78.5547C297.716 78.1589 297.914 77.6016 297.914 76.8828V76.1562C297.336 76.8229 296.547 77.1562 295.547 77.1562C294.557 77.1562 293.755 76.7578 293.141 75.9609C292.531 75.1641 292.227 74.0781 292.227 72.7031ZM293.68 72.8672C293.68 73.8203 293.875 74.5703 294.266 75.1172C294.656 75.6589 295.203 75.9297 295.906 75.9297C296.818 75.9297 297.487 75.5156 297.914 74.6875V70.8281C297.471 70.0208 296.807 69.6172 295.922 69.6172C295.219 69.6172 294.669 69.8906 294.273 70.4375C293.878 70.9844 293.68 71.7943 293.68 72.8672ZM303.125 77H301.68V68.5469H303.125V77ZM301.562 66.3047C301.562 66.0703 301.633 65.8724 301.773 65.7109C301.919 65.5495 302.133 65.4688 302.414 65.4688C302.695 65.4688 302.909 65.5495 303.055 65.7109C303.201 65.8724 303.273 66.0703 303.273 66.3047C303.273 66.5391 303.201 66.7344 303.055 66.8906C302.909 67.0469 302.695 67.125 302.414 67.125C302.133 67.125 301.919 67.0469 301.773 66.8906C301.633 66.7344 301.562 66.5391 301.562 66.3047ZM306.812 68.5469L306.859 69.6094C307.505 68.7969 308.349 68.3906 309.391 68.3906C311.177 68.3906 312.078 69.3984 312.094 71.4141V77H310.648V71.4062C310.643 70.7969 310.503 70.3464 310.227 70.0547C309.956 69.763 309.531 69.6172 308.953 69.6172C308.484 69.6172 308.073 69.7422 307.719 69.9922C307.365 70.2422 307.089 70.5703 306.891 70.9766V77H305.445V68.5469H306.812ZM319.492 77C319.409 76.8333 319.341 76.5365 319.289 76.1094C318.617 76.8073 317.815 77.1562 316.883 77.1562C316.049 77.1562 315.365 76.9219 314.828 76.4531C314.297 75.9792 314.031 75.3802 314.031 74.6562C314.031 73.776 314.365 73.0938 315.031 72.6094C315.703 72.1198 316.646 71.875 317.859 71.875H319.266V71.2109C319.266 70.7057 319.115 70.3047 318.812 70.0078C318.51 69.7057 318.065 69.5547 317.477 69.5547C316.961 69.5547 316.529 69.6849 316.18 69.9453C315.831 70.2057 315.656 70.5208 315.656 70.8906H314.203C314.203 70.4688 314.352 70.0625 314.648 69.6719C314.951 69.276 315.357 68.9635 315.867 68.7344C316.383 68.5052 316.948 68.3906 317.562 68.3906C318.536 68.3906 319.299 68.6354 319.852 69.125C320.404 69.6094 320.69 70.2786 320.711 71.1328V75.0234C320.711 75.7995 320.81 76.4167 321.008 76.875V77H319.492ZM317.094 75.8984C317.547 75.8984 317.977 75.7812 318.383 75.5469C318.789 75.3125 319.083 75.0078 319.266 74.6328V72.8984H318.133C316.362 72.8984 315.477 73.4167 315.477 74.4531C315.477 74.9062 315.628 75.2604 315.93 75.5156C316.232 75.7708 316.62 75.8984 317.094 75.8984ZM324.547 77H323.102V65H324.547V77ZM331.789 74.7578C331.789 74.3672 331.641 74.0651 331.344 73.8516C331.052 73.6328 330.539 73.4453 329.805 73.2891C329.076 73.1328 328.495 72.9453 328.062 72.7266C327.635 72.5078 327.318 72.2474 327.109 71.9453C326.906 71.6432 326.805 71.2839 326.805 70.8672C326.805 70.1745 327.096 69.5885 327.68 69.1094C328.268 68.6302 329.018 68.3906 329.93 68.3906C330.888 68.3906 331.664 68.638 332.258 69.1328C332.857 69.6276 333.156 70.2604 333.156 71.0312H331.703C331.703 70.6354 331.534 70.2943 331.195 70.0078C330.862 69.7214 330.44 69.5781 329.93 69.5781C329.404 69.5781 328.992 69.6927 328.695 69.9219C328.398 70.151 328.25 70.4505 328.25 70.8203C328.25 71.1693 328.388 71.4323 328.664 71.6094C328.94 71.7865 329.438 71.9557 330.156 72.1172C330.88 72.2786 331.466 72.4714 331.914 72.6953C332.362 72.9193 332.693 73.1901 332.906 73.5078C333.125 73.8203 333.234 74.2031 333.234 74.6562C333.234 75.4115 332.932 76.0182 332.328 76.4766C331.724 76.9297 330.94 77.1562 329.977 77.1562C329.299 77.1562 328.701 77.0365 328.18 76.7969C327.659 76.5573 327.25 76.224 326.953 75.7969C326.661 75.3646 326.516 74.8984 326.516 74.3984H327.961C327.987 74.8828 328.18 75.2682 328.539 75.5547C328.904 75.8359 329.383 75.9766 329.977 75.9766C330.523 75.9766 330.961 75.8672 331.289 75.6484C331.622 75.4245 331.789 75.1276 331.789 74.7578Z" fill="black"/>
                    <path id="Reset data factors" d="M10.0156 53.3984H7.34375V58H5.83594V46.625H9.60156C10.8828 46.625 11.8672 46.9167 12.5547 47.5C13.2474 48.0833 13.5938 48.9323 13.5938 50.0469C13.5938 50.7552 13.401 51.3724 13.0156 51.8984C12.6354 52.4245 12.1042 52.8177 11.4219 53.0781L14.0938 57.9062V58H12.4844L10.0156 53.3984ZM7.34375 52.1719H9.64844C10.3932 52.1719 10.9844 51.9792 11.4219 51.5938C11.8646 51.2083 12.0859 50.6927 12.0859 50.0469C12.0859 49.3438 11.875 48.8047 11.4531 48.4297C11.0365 48.0547 10.4323 47.8646 9.64062 47.8594H7.34375V52.1719ZM18.9844 58.1562C17.8385 58.1562 16.9062 57.7812 16.1875 57.0312C15.4688 56.276 15.1094 55.2682 15.1094 54.0078V53.7422C15.1094 52.9036 15.2682 52.1562 15.5859 51.5C15.9089 50.8385 16.3568 50.3229 16.9297 49.9531C17.5078 49.5781 18.1328 49.3906 18.8047 49.3906C19.9036 49.3906 20.7578 49.7526 21.3672 50.4766C21.9766 51.2005 22.2812 52.237 22.2812 53.5859V54.1875H16.5547C16.5755 55.0208 16.8177 55.6953 17.2812 56.2109C17.75 56.7214 18.3438 56.9766 19.0625 56.9766C19.5729 56.9766 20.0052 56.8724 20.3594 56.6641C20.7135 56.4557 21.0234 56.1797 21.2891 55.8359L22.1719 56.5234C21.4635 57.612 20.401 58.1562 18.9844 58.1562ZM18.8047 50.5781C18.2214 50.5781 17.7318 50.7917 17.3359 51.2188C16.9401 51.6406 16.6953 52.2344 16.6016 53H20.8359V52.8906C20.7943 52.1562 20.5964 51.5885 20.2422 51.1875C19.888 50.7812 19.4089 50.5781 18.8047 50.5781ZM28.8828 55.7578C28.8828 55.3672 28.7344 55.0651 28.4375 54.8516C28.1458 54.6328 27.6328 54.4453 26.8984 54.2891C26.1693 54.1328 25.5885 53.9453 25.1562 53.7266C24.7292 53.5078 24.4115 53.2474 24.2031 52.9453C24 52.6432 23.8984 52.2839 23.8984 51.8672C23.8984 51.1745 24.1901 50.5885 24.7734 50.1094C25.362 49.6302 26.112 49.3906 27.0234 49.3906C27.9818 49.3906 28.7578 49.638 29.3516 50.1328C29.9505 50.6276 30.25 51.2604 30.25 52.0312H28.7969C28.7969 51.6354 28.6276 51.2943 28.2891 51.0078C27.9557 50.7214 27.5339 50.5781 27.0234 50.5781C26.4974 50.5781 26.0859 50.6927 25.7891 50.9219C25.4922 51.151 25.3438 51.4505 25.3438 51.8203C25.3438 52.1693 25.4818 52.4323 25.7578 52.6094C26.0339 52.7865 26.5312 52.9557 27.25 53.1172C27.974 53.2786 28.5599 53.4714 29.0078 53.6953C29.4557 53.9193 29.7865 54.1901 30 54.5078C30.2188 54.8203 30.3281 55.2031 30.3281 55.6562C30.3281 56.4115 30.026 57.0182 29.4219 57.4766C28.8177 57.9297 28.0339 58.1562 27.0703 58.1562C26.3932 58.1562 25.7943 58.0365 25.2734 57.7969C24.7526 57.5573 24.3438 57.224 24.0469 56.7969C23.7552 56.3646 23.6094 55.8984 23.6094 55.3984H25.0547C25.0807 55.8828 25.2734 56.2682 25.6328 56.5547C25.9974 56.8359 26.4766 56.9766 27.0703 56.9766C27.6172 56.9766 28.0547 56.8672 28.3828 56.6484C28.7161 56.4245 28.8828 56.1276 28.8828 55.7578ZM35.7188 58.1562C34.5729 58.1562 33.6406 57.7812 32.9219 57.0312C32.2031 56.276 31.8438 55.2682 31.8438 54.0078V53.7422C31.8438 52.9036 32.0026 52.1562 32.3203 51.5C32.6432 50.8385 33.0911 50.3229 33.6641 49.9531C34.2422 49.5781 34.8672 49.3906 35.5391 49.3906C36.638 49.3906 37.4922 49.7526 38.1016 50.4766C38.7109 51.2005 39.0156 52.237 39.0156 53.5859V54.1875H33.2891C33.3099 55.0208 33.5521 55.6953 34.0156 56.2109C34.4844 56.7214 35.0781 56.9766 35.7969 56.9766C36.3073 56.9766 36.7396 56.8724 37.0938 56.6641C37.4479 56.4557 37.7578 56.1797 38.0234 55.8359L38.9062 56.5234C38.1979 57.612 37.1354 58.1562 35.7188 58.1562ZM35.5391 50.5781C34.9557 50.5781 34.4661 50.7917 34.0703 51.2188C33.6745 51.6406 33.4297 52.2344 33.3359 53H37.5703V52.8906C37.5286 52.1562 37.3307 51.5885 36.9766 51.1875C36.6224 50.7812 36.1432 50.5781 35.5391 50.5781ZM42.6562 47.5V49.5469H44.2344V50.6641H42.6562V55.9062C42.6562 56.2448 42.7266 56.5 42.8672 56.6719C43.0078 56.8385 43.2474 56.9219 43.5859 56.9219C43.7526 56.9219 43.9818 56.8906 44.2734 56.8281V58C43.8932 58.1042 43.5234 58.1562 43.1641 58.1562C42.5182 58.1562 42.0312 57.9609 41.7031 57.5703C41.375 57.1797 41.2109 56.625 41.2109 55.9062V50.6641H39.6719V49.5469H41.2109V47.5H42.6562ZM49.5469 53.7031C49.5469 52.4062 49.8542 51.3646 50.4688 50.5781C51.0833 49.7865 51.888 49.3906 52.8828 49.3906C53.8724 49.3906 54.6562 49.7292 55.2344 50.4062V46H56.6797V58H55.3516L55.2812 57.0938C54.7031 57.8021 53.8984 58.1562 52.8672 58.1562C51.888 58.1562 51.0885 57.7552 50.4688 56.9531C49.8542 56.151 49.5469 55.1042 49.5469 53.8125V53.7031ZM50.9922 53.8672C50.9922 54.8255 51.1901 55.5755 51.5859 56.1172C51.9818 56.6589 52.5286 56.9297 53.2266 56.9297C54.1432 56.9297 54.8125 56.5182 55.2344 55.6953V51.8125C54.8021 51.0156 54.138 50.6172 53.2422 50.6172C52.5339 50.6172 51.9818 50.8906 51.5859 51.4375C51.1901 51.9844 50.9922 52.7943 50.9922 53.8672ZM64.1484 58C64.0651 57.8333 63.9974 57.5365 63.9453 57.1094C63.2734 57.8073 62.4714 58.1562 61.5391 58.1562C60.7057 58.1562 60.0208 57.9219 59.4844 57.4531C58.9531 56.9792 58.6875 56.3802 58.6875 55.6562C58.6875 54.776 59.0208 54.0938 59.6875 53.6094C60.3594 53.1198 61.3021 52.875 62.5156 52.875H63.9219V52.2109C63.9219 51.7057 63.7708 51.3047 63.4688 51.0078C63.1667 50.7057 62.7214 50.5547 62.1328 50.5547C61.6172 50.5547 61.1849 50.6849 60.8359 50.9453C60.487 51.2057 60.3125 51.5208 60.3125 51.8906H58.8594C58.8594 51.4688 59.0078 51.0625 59.3047 50.6719C59.6068 50.276 60.013 49.9635 60.5234 49.7344C61.0391 49.5052 61.6042 49.3906 62.2188 49.3906C63.1927 49.3906 63.9557 49.6354 64.5078 50.125C65.0599 50.6094 65.3464 51.2786 65.3672 52.1328V56.0234C65.3672 56.7995 65.4661 57.4167 65.6641 57.875V58H64.1484ZM61.75 56.8984C62.2031 56.8984 62.6328 56.7812 63.0391 56.5469C63.4453 56.3125 63.7396 56.0078 63.9219 55.6328V53.8984H62.7891C61.0182 53.8984 60.1328 54.4167 60.1328 55.4531C60.1328 55.9062 60.2839 56.2604 60.5859 56.5156C60.888 56.7708 61.276 56.8984 61.75 56.8984ZM69.5938 47.5V49.5469H71.1719V50.6641H69.5938V55.9062C69.5938 56.2448 69.6641 56.5 69.8047 56.6719C69.9453 56.8385 70.1849 56.9219 70.5234 56.9219C70.6901 56.9219 70.9193 56.8906 71.2109 56.8281V58C70.8307 58.1042 70.4609 58.1562 70.1016 58.1562C69.4557 58.1562 68.9688 57.9609 68.6406 57.5703C68.3125 57.1797 68.1484 56.625 68.1484 55.9062V50.6641H66.6094V49.5469H68.1484V47.5H69.5938ZM78.0859 58C78.0026 57.8333 77.9349 57.5365 77.8828 57.1094C77.2109 57.8073 76.4089 58.1562 75.4766 58.1562C74.6432 58.1562 73.9583 57.9219 73.4219 57.4531C72.8906 56.9792 72.625 56.3802 72.625 55.6562C72.625 54.776 72.9583 54.0938 73.625 53.6094C74.2969 53.1198 75.2396 52.875 76.4531 52.875H77.8594V52.2109C77.8594 51.7057 77.7083 51.3047 77.4062 51.0078C77.1042 50.7057 76.6589 50.5547 76.0703 50.5547C75.5547 50.5547 75.1224 50.6849 74.7734 50.9453C74.4245 51.2057 74.25 51.5208 74.25 51.8906H72.7969C72.7969 51.4688 72.9453 51.0625 73.2422 50.6719C73.5443 50.276 73.9505 49.9635 74.4609 49.7344C74.9766 49.5052 75.5417 49.3906 76.1562 49.3906C77.1302 49.3906 77.8932 49.6354 78.4453 50.125C78.9974 50.6094 79.2839 51.2786 79.3047 52.1328V56.0234C79.3047 56.7995 79.4036 57.4167 79.6016 57.875V58H78.0859ZM75.6875 56.8984C76.1406 56.8984 76.5703 56.7812 76.9766 56.5469C77.3828 56.3125 77.6771 56.0078 77.8594 55.6328V53.8984H76.7266C74.9557 53.8984 74.0703 54.4167 74.0703 55.4531C74.0703 55.9062 74.2214 56.2604 74.5234 56.5156C74.8255 56.7708 75.2135 56.8984 75.6875 56.8984ZM19.0469 77V69.6641H17.7109V68.5469H19.0469V67.6797C19.0469 66.7734 19.2891 66.0729 19.7734 65.5781C20.2578 65.0833 20.9427 64.8359 21.8281 64.8359C22.1615 64.8359 22.4922 64.8802 22.8203 64.9688L22.7422 66.1406C22.4974 66.0938 22.237 66.0703 21.9609 66.0703C21.4922 66.0703 21.1302 66.2083 20.875 66.4844C20.6198 66.7552 20.4922 67.1458 20.4922 67.6562V68.5469H22.2969V69.6641H20.4922V77H19.0469ZM29.1172 77C29.0339 76.8333 28.9661 76.5365 28.9141 76.1094C28.2422 76.8073 27.4401 77.1562 26.5078 77.1562C25.6745 77.1562 24.9896 76.9219 24.4531 76.4531C23.9219 75.9792 23.6562 75.3802 23.6562 74.6562C23.6562 73.776 23.9896 73.0938 24.6562 72.6094C25.3281 72.1198 26.2708 71.875 27.4844 71.875H28.8906V71.2109C28.8906 70.7057 28.7396 70.3047 28.4375 70.0078C28.1354 69.7057 27.6901 69.5547 27.1016 69.5547C26.5859 69.5547 26.1536 69.6849 25.8047 69.9453C25.4557 70.2057 25.2812 70.5208 25.2812 70.8906H23.8281C23.8281 70.4688 23.9766 70.0625 24.2734 69.6719C24.5755 69.276 24.9818 68.9635 25.4922 68.7344C26.0078 68.5052 26.5729 68.3906 27.1875 68.3906C28.1615 68.3906 28.9245 68.6354 29.4766 69.125C30.0286 69.6094 30.3151 70.2786 30.3359 71.1328V75.0234C30.3359 75.7995 30.4349 76.4167 30.6328 76.875V77H29.1172ZM26.7188 75.8984C27.1719 75.8984 27.6016 75.7812 28.0078 75.5469C28.4141 75.3125 28.7083 75.0078 28.8906 74.6328V72.8984H27.7578C25.987 72.8984 25.1016 73.4167 25.1016 74.4531C25.1016 74.9062 25.2526 75.2604 25.5547 75.5156C25.8568 75.7708 26.2448 75.8984 26.7188 75.8984ZM35.9922 75.9766C36.5078 75.9766 36.9583 75.8203 37.3438 75.5078C37.7292 75.1953 37.9427 74.8047 37.9844 74.3359H39.3516C39.3255 74.8203 39.1589 75.2812 38.8516 75.7188C38.5443 76.1562 38.1328 76.5052 37.6172 76.7656C37.1068 77.026 36.5651 77.1562 35.9922 77.1562C34.8411 77.1562 33.9245 76.7734 33.2422 76.0078C32.5651 75.237 32.2266 74.1849 32.2266 72.8516V72.6094C32.2266 71.7865 32.3776 71.0547 32.6797 70.4141C32.9818 69.7734 33.4141 69.276 33.9766 68.9219C34.5443 68.5677 35.2135 68.3906 35.9844 68.3906C36.9323 68.3906 37.7188 68.6745 38.3438 69.2422C38.974 69.8099 39.3099 70.5469 39.3516 71.4531H37.9844C37.9427 70.9062 37.7344 70.4583 37.3594 70.1094C36.9896 69.7552 36.5312 69.5781 35.9844 69.5781C35.25 69.5781 34.6797 69.8438 34.2734 70.375C33.8724 70.901 33.6719 71.6641 33.6719 72.6641V72.9375C33.6719 73.9115 33.8724 74.6615 34.2734 75.1875C34.6745 75.7135 35.2474 75.9766 35.9922 75.9766ZM42.9375 66.5V68.5469H44.5156V69.6641H42.9375V74.9062C42.9375 75.2448 43.0078 75.5 43.1484 75.6719C43.2891 75.8385 43.5286 75.9219 43.8672 75.9219C44.0339 75.9219 44.263 75.8906 44.5547 75.8281V77C44.1745 77.1042 43.8047 77.1562 43.4453 77.1562C42.7995 77.1562 42.3125 76.9609 41.9844 76.5703C41.6562 76.1797 41.4922 75.625 41.4922 74.9062V69.6641H39.9531V68.5469H41.4922V66.5H42.9375ZM45.6719 72.6953C45.6719 71.8672 45.8333 71.1224 46.1562 70.4609C46.4844 69.7995 46.9375 69.2891 47.5156 68.9297C48.099 68.5703 48.763 68.3906 49.5078 68.3906C50.6589 68.3906 51.5885 68.7891 52.2969 69.5859C53.0104 70.3828 53.3672 71.4427 53.3672 72.7656V72.8672C53.3672 73.6901 53.2083 74.4297 52.8906 75.0859C52.5781 75.737 52.1276 76.2448 51.5391 76.6094C50.9557 76.974 50.2839 77.1562 49.5234 77.1562C48.3776 77.1562 47.4479 76.7578 46.7344 75.9609C46.026 75.1641 45.6719 74.1094 45.6719 72.7969V72.6953ZM47.125 72.8672C47.125 73.8047 47.3411 74.5573 47.7734 75.125C48.2109 75.6927 48.7943 75.9766 49.5234 75.9766C50.2578 75.9766 50.8411 75.6901 51.2734 75.1172C51.7057 74.5391 51.9219 73.7318 51.9219 72.6953C51.9219 71.7682 51.7005 71.0182 51.2578 70.4453C50.8203 69.8672 50.237 69.5781 49.5078 69.5781C48.7943 69.5781 48.2188 69.862 47.7812 70.4297C47.3438 70.9974 47.125 71.8099 47.125 72.8672ZM59.2656 69.8438C59.0469 69.8073 58.8099 69.7891 58.5547 69.7891C57.6068 69.7891 56.9635 70.1927 56.625 71V77H55.1797V68.5469H56.5859L56.6094 69.5234C57.0833 68.7682 57.7552 68.3906 58.625 68.3906C58.9062 68.3906 59.1198 68.4271 59.2656 68.5V69.8438ZM65.5234 74.7578C65.5234 74.3672 65.375 74.0651 65.0781 73.8516C64.7865 73.6328 64.2734 73.4453 63.5391 73.2891C62.8099 73.1328 62.2292 72.9453 61.7969 72.7266C61.3698 72.5078 61.0521 72.2474 60.8438 71.9453C60.6406 71.6432 60.5391 71.2839 60.5391 70.8672C60.5391 70.1745 60.8307 69.5885 61.4141 69.1094C62.0026 68.6302 62.7526 68.3906 63.6641 68.3906C64.6224 68.3906 65.3984 68.638 65.9922 69.1328C66.5911 69.6276 66.8906 70.2604 66.8906 71.0312H65.4375C65.4375 70.6354 65.2682 70.2943 64.9297 70.0078C64.5964 69.7214 64.1745 69.5781 63.6641 69.5781C63.138 69.5781 62.7266 69.6927 62.4297 69.9219C62.1328 70.151 61.9844 70.4505 61.9844 70.8203C61.9844 71.1693 62.1224 71.4323 62.3984 71.6094C62.6745 71.7865 63.1719 71.9557 63.8906 72.1172C64.6146 72.2786 65.2005 72.4714 65.6484 72.6953C66.0964 72.9193 66.4271 73.1901 66.6406 73.5078C66.8594 73.8203 66.9688 74.2031 66.9688 74.6562C66.9688 75.4115 66.6667 76.0182 66.0625 76.4766C65.4583 76.9297 64.6745 77.1562 63.7109 77.1562C63.0339 77.1562 62.4349 77.0365 61.9141 76.7969C61.3932 76.5573 60.9844 76.224 60.6875 75.7969C60.3958 75.3646 60.25 74.8984 60.25 74.3984H61.6953C61.7214 74.8828 61.9141 75.2682 62.2734 75.5547C62.638 75.8359 63.1172 75.9766 63.7109 75.9766C64.2578 75.9766 64.6953 75.8672 65.0234 75.6484C65.3568 75.4245 65.5234 75.1276 65.5234 74.7578Z" fill="black"/>
                </g>

                <defs>
                    <pattern id="p0" patternContentUnits="objectBoundingBox" width="1" height="1">
                    <use xlink:href="#image000" transform="scale(0.0111111)"/>
                    </pattern>
                    <pattern id="p1" patternContentUnits="objectBoundingBox" width="1" height="1">
                    <use xlink:href="#image111" transform="scale(0.0111111)"/>
                    </pattern>
                    <image id="image000" width="90" height="90" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAABaCAYAAAA4qEECAAAABmJLR0QA/wD/AP+gvaeTAAAB9klEQVR4nO2cS24CMRBES1mEnDzMebJAuVBCbgGL0BIiw4SPu101rid5w+r5CQwDQwPGGGOMMcYYY4wxZo4NgAnA/rSm02MqSPi/AvgAcLhYnwDeOnrdioT/NUlK2Rkk/P+TpJKdQcL/VkkK2Rkk/O+VZIst4b8BsHtAMtYOfd/NZfynJyR7x342cqxthey+gWiPY+TR42Ju/VQItwpdGbtl5AOArwJnbBsKVxwjrY6L8/We6JsqnhVbyXWW1i/FjGNEwfEmmDfC7PYQjBtidGoC08aYXFJg2CCDQwk9NzpM5KDHhoeLHFRufNjIQUWA4SMHmSEc+YKsS2Dpy+osMp59fiZfgTX2qiIHbLFXGTlgib3qyEHv2ENEDnrFHipyUB17yMhBVeyhIwfZsR35jKzYNJFfeguYOnx0FOA3wwL88a4AX7AU4EvwAnpHHiI2S+RVx2aLvMrYrJFXFds/zhbg2w0K8A00BfiWsAJ8k2MBvm23AIaNMjikwrRBJpemMG6M0ekpmDfE7HYXChtRcFxE6W+/Sq5/aDGvo1I8I7bUvI7Kl2LrY0RqXofyYBSZeR3qo34k5nX0/u5Xyl9inNkCUv4SA/oWkPKXGDm5gJS/xBDVBaT8JcYCLyDlv8HvR7/v09pC65dldX9jjDHGGGOMMcaYMo5GWlFN6GAqrAAAAABJRU5ErkJggg=="/>
                    <image id="image111" width="90" height="90" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAABaCAYAAAA4qEECAAAABmJLR0QA/wD/AP+gvaeTAAAFp0lEQVR4nO2dXWgdRRiGnzSnSWxjaBFttaA1F6kXatXUnzRpSvGiqCCxKFVatOIPLaK1/uCFN0EURFEpKvS6EPDGglCN/aMoFixS24ogVlFqTZrWNtombZU0PV5852A47rc7e87uzpzNPDAkTDJn3nnPnt1vvpndAx6Px+PxeDwej8fjKA22BQTQCNxSKh3AIqAdmA3MLf1sAMaBs8AY8HOp/AR8DXwPXMpaeD2wAHgO+AT4CyjWWP4EtgMbgCszHIeTtABrgB3ARWo3VysXgV3AaqCQycgcoRV4ERgmPXO1chR4uaQhLv1VtLFCAdgEnCJ7gyvLMPAkcj0wob/Uznl6gMPYN7iyHAaWRGgvm+y00U3AZiQCiGPAGDAIvAE8CtyJRB5zS69ZKP1+LdAFrAVeB3aX2sbpawJ4DZgZoL+/4n+dpB34BvMBDwFvA0up7aJVAHqB94l3HdiPRD9lKk120ugVSIhlMsCdwErMz5dxaAQeBL401DKMfEKCTHbO6FXA30QPahC4PUNdvchkxuRUov3NGR4nOib+DXjAkr4GJHb/I0Kj00avItrkrVQXwybNVcA26tDoFcAFdIHnkaPdJRqQyUucWalV2gm/8I0C3dbURTNAHRjdRHgINwTcaE1dNFp04ZzRm0NEjZIvk60Z3YM+4zuP26eLaky2YnQBOBQiaJ0NUYZUa7IVozeFiNlqQ5AhtZicudGt6KnOo7gRJwdRq8mZG/1SiBBbM74okjA5U6Nb0DNig1kKyTtr0d/tLou6cscOgk3eaVNU3liAnhdYaVFX7thIsMlDpJO0zxUzYvzv3Ur9ADCZgBYPcsRqGbqlFnXljiUEmzxG8OqxpwLTU8fNSv1XyBqbJwJTo29Q6g8kJSTvmBq9SKn/MSkhecfU6IVK/ZGkhNQZDcTcW25qdJtSfyJOZzlgFrAFOFcqW4DLkuxAS4tekWQndcCH/N+DD5Ls4J+ADorI4ux0ImguMWrSMM7McLrTDMwJqJ9l0tjU6HGl3tXVlDS4XKkfM2lsarT2YlrneUQLCM6aNDY1+oxSf7Vh+zwwX6lP1OhflfoOw/Z5QJu0/WLS2NRobQaodZ5Hapod12p0p2H7PHCbUp/o7LiT6Z0mbUJmgkEe3JpkR2GJf5f32CVFL8FjP43hWcH01DEJfKH8rc/wNeoZbWPQXlK4uf9Zgt/VYfK9OFsARgge+4Y0OrwGfbvBPWl06Aj3ETzmCWBeWp1+rnS6O60OHWAvwWPenmana5RO87oafhf6eFen2XELsmFmumwL20PwWH9Hsnmp8oLSeRG5HTgvPIw+zo1ZCJiNfufpMfKR0WtD/+SOYJiDTgJtH14R2SJW73yEPr5nshTSCBwMEfNElmISZj36uA5gYc7QRfjtb8uyFpQAy9FvtZ4E7rAl7F1FVBHJjdxkS1gVLCb8UXBv2ZMmWa39AaKmTs/rwezFwHH0cezDgSzlQmTJPezIdvk0spzwI/kU8uwmJ+gl/DESF4CnrKnTWU/04y96rKlT6CP62RcDuBFntxEewhWRsdxvS2AU64g2+xjwkC2ByIxPm4yUywTwmC2BpvQR/nEsl11ke29iN3ruovJ04eyRXEkv4RfIqWUPcC/pTAQKSD5ZS3UGXficOydHcR1mjz8rl+NIXL6M2jZPNiFv9HvoKyNaCJdadJH2g7pnAm8CzxNvQ+U5ZODfIsv5PwAnkTCsvA+wFdl0OA+59aMDWa3vJl7S5xLwDvAqObgfp5PwiY2tcpAc3sPeiCzwnsS+wSeQLFyeF5VpBp5GwrysDR4BXiHDfLILNAOPAJ+R7qPnJ4BPkfg59eUn15mPfJS3Ibt/ajX3NPAxsu8itS0BcXDx60FmINm0qV8Pcj0ybZ7Df3cZjCNRyBlkW/ERZDPmIeA7/NeDeDwej8fj8Xg8Ho8Z/wJD/Fexs/jO8AAAAABJRU5ErkJggg=="/>
                </defs>
            </svg>
        
        </div>
        </div>


        <div id="panel-container">

        <div id="control-panel">

            <span class="hint bold-text">
                Do GBP synchronous updates:
            </span>

            <div id="play-pause-reset-speed">
                <div id="center">
                    <button class="mp-button" on:click={sync_iter}> 
                        1 iter
                    </button>
                </div>

                <div id="play-pause-reset">
                    {#if sync_on}
                        <button class="gbp-button" on:click={toggleGBP}>
                            <svg class="icon" id="pause"><use xlink:href="#pauseIcon"></use></svg>
                        </button>
                    {:else}
                        <button class="gbp-button" on:click={toggleGBP}>
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
            </div>



            <div></div>

            <span class="hint bold-text">
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
            </div>

            <span class="hint bold-text">
                Factor graph:
            </span>

            <div>
                <svg id="factor-graph" width="766" height="117" viewBox="0 0 766 117" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g id="Frame 1">
                    <rect width="766" height="117" fill="white"/>
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
                    </g>
                </svg>
            </div>

        </div>
        </div>

    </div>

    <figcaption id="caption">
        1D line fitting. 
        Create your data factors and experiment with different message passing schedules. 
        Use the synchronous, random and sweep schedules or create your own by clicking on variable nodes to send messages.
        Note the variable nodes start at the bottom of the canvas before they have received any messages.
    </figcaption>

</figure>

