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
        grid-template-rows: 14px 65px 14px 65px 60px;
        grid-row-end: auto;
        row-gap: 10px;
    }

    #panel2 {
        display: grid;
        grid-template-columns: auto 1fr;
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
        background-color: var(--gray-bg);
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
        display: none;
    }

    #factor-graph {
        width: 100%
    }

    #buttons-svg {
        width: 100%;
        height: auto;
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

       
        </div>
        </div>


        <div id="panel-container" style="margin-top: 10px;">

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

            <div style="width: 70%; margin-top: 10px;">

                <svg id="buttons-svg" width="335" height="86" viewBox="0 0 335 86" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                    <g id="buttons">
                        <rect id="Delete" class="clickable" on:click={clearMeasurements} x="141" y="1" width="41.7647" height="41.7647" fill="url(#p0)"/>
                        <path id="Clear data factors" d="M135.406 54.3906C135.266 55.5938 134.82 56.5234 134.07 57.1797C133.326 57.8307 132.333 58.1562 131.094 58.1562C129.75 58.1562 128.672 57.6745 127.859 56.7109C127.052 55.7474 126.648 54.4583 126.648 52.8438V51.75C126.648 50.6927 126.836 49.763 127.211 48.9609C127.591 48.1589 128.128 47.5443 128.82 47.1172C129.513 46.6849 130.315 46.4688 131.227 46.4688C132.435 46.4688 133.404 46.8073 134.133 47.4844C134.862 48.1562 135.286 49.0885 135.406 50.2812H133.898C133.768 49.375 133.484 48.7188 133.047 48.3125C132.615 47.9062 132.008 47.7031 131.227 47.7031C130.268 47.7031 129.516 48.0573 128.969 48.7656C128.427 49.474 128.156 50.4818 128.156 51.7891V52.8906C128.156 54.125 128.414 55.1068 128.93 55.8359C129.445 56.5651 130.167 56.9297 131.094 56.9297C131.927 56.9297 132.565 56.7422 133.008 56.3672C133.456 55.987 133.753 55.3281 133.898 54.3906H135.406ZM138.805 58H137.359V46H138.805V58ZM144.633 58.1562C143.487 58.1562 142.555 57.7812 141.836 57.0312C141.117 56.276 140.758 55.2682 140.758 54.0078V53.7422C140.758 52.9036 140.917 52.1562 141.234 51.5C141.557 50.8385 142.005 50.3229 142.578 49.9531C143.156 49.5781 143.781 49.3906 144.453 49.3906C145.552 49.3906 146.406 49.7526 147.016 50.4766C147.625 51.2005 147.93 52.237 147.93 53.5859V54.1875H142.203C142.224 55.0208 142.466 55.6953 142.93 56.2109C143.398 56.7214 143.992 56.9766 144.711 56.9766C145.221 56.9766 145.654 56.8724 146.008 56.6641C146.362 56.4557 146.672 56.1797 146.938 55.8359L147.82 56.5234C147.112 57.612 146.049 58.1562 144.633 58.1562ZM144.453 50.5781C143.87 50.5781 143.38 50.7917 142.984 51.2188C142.589 51.6406 142.344 52.2344 142.25 53H146.484V52.8906C146.443 52.1562 146.245 51.5885 145.891 51.1875C145.536 50.7812 145.057 50.5781 144.453 50.5781ZM154.828 58C154.745 57.8333 154.677 57.5365 154.625 57.1094C153.953 57.8073 153.151 58.1562 152.219 58.1562C151.385 58.1562 150.701 57.9219 150.164 57.4531C149.633 56.9792 149.367 56.3802 149.367 55.6562C149.367 54.776 149.701 54.0938 150.367 53.6094C151.039 53.1198 151.982 52.875 153.195 52.875H154.602V52.2109C154.602 51.7057 154.451 51.3047 154.148 51.0078C153.846 50.7057 153.401 50.5547 152.812 50.5547C152.297 50.5547 151.865 50.6849 151.516 50.9453C151.167 51.2057 150.992 51.5208 150.992 51.8906H149.539C149.539 51.4688 149.688 51.0625 149.984 50.6719C150.286 50.276 150.693 49.9635 151.203 49.7344C151.719 49.5052 152.284 49.3906 152.898 49.3906C153.872 49.3906 154.635 49.6354 155.188 50.125C155.74 50.6094 156.026 51.2786 156.047 52.1328V56.0234C156.047 56.7995 156.146 57.4167 156.344 57.875V58H154.828ZM152.43 56.8984C152.883 56.8984 153.312 56.7812 153.719 56.5469C154.125 56.3125 154.419 56.0078 154.602 55.6328V53.8984H153.469C151.698 53.8984 150.812 54.4167 150.812 55.4531C150.812 55.9062 150.964 56.2604 151.266 56.5156C151.568 56.7708 151.956 56.8984 152.43 56.8984ZM162.398 50.8438C162.18 50.8073 161.943 50.7891 161.688 50.7891C160.74 50.7891 160.096 51.1927 159.758 52V58H158.312V49.5469H159.719L159.742 50.5234C160.216 49.7682 160.888 49.3906 161.758 49.3906C162.039 49.3906 162.253 49.4271 162.398 49.5V50.8438ZM167.352 53.7031C167.352 52.4062 167.659 51.3646 168.273 50.5781C168.888 49.7865 169.693 49.3906 170.688 49.3906C171.677 49.3906 172.461 49.7292 173.039 50.4062V46H174.484V58H173.156L173.086 57.0938C172.508 57.8021 171.703 58.1562 170.672 58.1562C169.693 58.1562 168.893 57.7552 168.273 56.9531C167.659 56.151 167.352 55.1042 167.352 53.8125V53.7031ZM168.797 53.8672C168.797 54.8255 168.995 55.5755 169.391 56.1172C169.786 56.6589 170.333 56.9297 171.031 56.9297C171.948 56.9297 172.617 56.5182 173.039 55.6953V51.8125C172.607 51.0156 171.943 50.6172 171.047 50.6172C170.339 50.6172 169.786 50.8906 169.391 51.4375C168.995 51.9844 168.797 52.7943 168.797 53.8672ZM181.953 58C181.87 57.8333 181.802 57.5365 181.75 57.1094C181.078 57.8073 180.276 58.1562 179.344 58.1562C178.51 58.1562 177.826 57.9219 177.289 57.4531C176.758 56.9792 176.492 56.3802 176.492 55.6562C176.492 54.776 176.826 54.0938 177.492 53.6094C178.164 53.1198 179.107 52.875 180.32 52.875H181.727V52.2109C181.727 51.7057 181.576 51.3047 181.273 51.0078C180.971 50.7057 180.526 50.5547 179.938 50.5547C179.422 50.5547 178.99 50.6849 178.641 50.9453C178.292 51.2057 178.117 51.5208 178.117 51.8906H176.664C176.664 51.4688 176.812 51.0625 177.109 50.6719C177.411 50.276 177.818 49.9635 178.328 49.7344C178.844 49.5052 179.409 49.3906 180.023 49.3906C180.997 49.3906 181.76 49.6354 182.312 50.125C182.865 50.6094 183.151 51.2786 183.172 52.1328V56.0234C183.172 56.7995 183.271 57.4167 183.469 57.875V58H181.953ZM179.555 56.8984C180.008 56.8984 180.438 56.7812 180.844 56.5469C181.25 56.3125 181.544 56.0078 181.727 55.6328V53.8984H180.594C178.823 53.8984 177.938 54.4167 177.938 55.4531C177.938 55.9062 178.089 56.2604 178.391 56.5156C178.693 56.7708 179.081 56.8984 179.555 56.8984ZM187.398 47.5V49.5469H188.977V50.6641H187.398V55.9062C187.398 56.2448 187.469 56.5 187.609 56.6719C187.75 56.8385 187.99 56.9219 188.328 56.9219C188.495 56.9219 188.724 56.8906 189.016 56.8281V58C188.635 58.1042 188.266 58.1562 187.906 58.1562C187.26 58.1562 186.773 57.9609 186.445 57.5703C186.117 57.1797 185.953 56.625 185.953 55.9062V50.6641H184.414V49.5469H185.953V47.5H187.398ZM195.891 58C195.807 57.8333 195.74 57.5365 195.688 57.1094C195.016 57.8073 194.214 58.1562 193.281 58.1562C192.448 58.1562 191.763 57.9219 191.227 57.4531C190.695 56.9792 190.43 56.3802 190.43 55.6562C190.43 54.776 190.763 54.0938 191.43 53.6094C192.102 53.1198 193.044 52.875 194.258 52.875H195.664V52.2109C195.664 51.7057 195.513 51.3047 195.211 51.0078C194.909 50.7057 194.464 50.5547 193.875 50.5547C193.359 50.5547 192.927 50.6849 192.578 50.9453C192.229 51.2057 192.055 51.5208 192.055 51.8906H190.602C190.602 51.4688 190.75 51.0625 191.047 50.6719C191.349 50.276 191.755 49.9635 192.266 49.7344C192.781 49.5052 193.346 49.3906 193.961 49.3906C194.935 49.3906 195.698 49.6354 196.25 50.125C196.802 50.6094 197.089 51.2786 197.109 52.1328V56.0234C197.109 56.7995 197.208 57.4167 197.406 57.875V58H195.891ZM193.492 56.8984C193.945 56.8984 194.375 56.7812 194.781 56.5469C195.188 56.3125 195.482 56.0078 195.664 55.6328V53.8984H194.531C192.76 53.8984 191.875 54.4167 191.875 55.4531C191.875 55.9062 192.026 56.2604 192.328 56.5156C192.63 56.7708 193.018 56.8984 193.492 56.8984ZM138.547 77V69.6641H137.211V68.5469H138.547V67.6797C138.547 66.7734 138.789 66.0729 139.273 65.5781C139.758 65.0833 140.443 64.8359 141.328 64.8359C141.661 64.8359 141.992 64.8802 142.32 64.9688L142.242 66.1406C141.997 66.0938 141.737 66.0703 141.461 66.0703C140.992 66.0703 140.63 66.2083 140.375 66.4844C140.12 66.7552 139.992 67.1458 139.992 67.6562V68.5469H141.797V69.6641H139.992V77H138.547ZM148.617 77C148.534 76.8333 148.466 76.5365 148.414 76.1094C147.742 76.8073 146.94 77.1562 146.008 77.1562C145.174 77.1562 144.49 76.9219 143.953 76.4531C143.422 75.9792 143.156 75.3802 143.156 74.6562C143.156 73.776 143.49 73.0938 144.156 72.6094C144.828 72.1198 145.771 71.875 146.984 71.875H148.391V71.2109C148.391 70.7057 148.24 70.3047 147.938 70.0078C147.635 69.7057 147.19 69.5547 146.602 69.5547C146.086 69.5547 145.654 69.6849 145.305 69.9453C144.956 70.2057 144.781 70.5208 144.781 70.8906H143.328C143.328 70.4688 143.477 70.0625 143.773 69.6719C144.076 69.276 144.482 68.9635 144.992 68.7344C145.508 68.5052 146.073 68.3906 146.688 68.3906C147.661 68.3906 148.424 68.6354 148.977 69.125C149.529 69.6094 149.815 70.2786 149.836 71.1328V75.0234C149.836 75.7995 149.935 76.4167 150.133 76.875V77H148.617ZM146.219 75.8984C146.672 75.8984 147.102 75.7812 147.508 75.5469C147.914 75.3125 148.208 75.0078 148.391 74.6328V72.8984H147.258C145.487 72.8984 144.602 73.4167 144.602 74.4531C144.602 74.9062 144.753 75.2604 145.055 75.5156C145.357 75.7708 145.745 75.8984 146.219 75.8984ZM155.492 75.9766C156.008 75.9766 156.458 75.8203 156.844 75.5078C157.229 75.1953 157.443 74.8047 157.484 74.3359H158.852C158.826 74.8203 158.659 75.2812 158.352 75.7188C158.044 76.1562 157.633 76.5052 157.117 76.7656C156.607 77.026 156.065 77.1562 155.492 77.1562C154.341 77.1562 153.424 76.7734 152.742 76.0078C152.065 75.237 151.727 74.1849 151.727 72.8516V72.6094C151.727 71.7865 151.878 71.0547 152.18 70.4141C152.482 69.7734 152.914 69.276 153.477 68.9219C154.044 68.5677 154.714 68.3906 155.484 68.3906C156.432 68.3906 157.219 68.6745 157.844 69.2422C158.474 69.8099 158.81 70.5469 158.852 71.4531H157.484C157.443 70.9062 157.234 70.4583 156.859 70.1094C156.49 69.7552 156.031 69.5781 155.484 69.5781C154.75 69.5781 154.18 69.8438 153.773 70.375C153.372 70.901 153.172 71.6641 153.172 72.6641V72.9375C153.172 73.9115 153.372 74.6615 153.773 75.1875C154.174 75.7135 154.747 75.9766 155.492 75.9766ZM162.438 66.5V68.5469H164.016V69.6641H162.438V74.9062C162.438 75.2448 162.508 75.5 162.648 75.6719C162.789 75.8385 163.029 75.9219 163.367 75.9219C163.534 75.9219 163.763 75.8906 164.055 75.8281V77C163.674 77.1042 163.305 77.1562 162.945 77.1562C162.299 77.1562 161.812 76.9609 161.484 76.5703C161.156 76.1797 160.992 75.625 160.992 74.9062V69.6641H159.453V68.5469H160.992V66.5H162.438ZM165.172 72.6953C165.172 71.8672 165.333 71.1224 165.656 70.4609C165.984 69.7995 166.438 69.2891 167.016 68.9297C167.599 68.5703 168.263 68.3906 169.008 68.3906C170.159 68.3906 171.089 68.7891 171.797 69.5859C172.51 70.3828 172.867 71.4427 172.867 72.7656V72.8672C172.867 73.6901 172.708 74.4297 172.391 75.0859C172.078 75.737 171.628 76.2448 171.039 76.6094C170.456 76.974 169.784 77.1562 169.023 77.1562C167.878 77.1562 166.948 76.7578 166.234 75.9609C165.526 75.1641 165.172 74.1094 165.172 72.7969V72.6953ZM166.625 72.8672C166.625 73.8047 166.841 74.5573 167.273 75.125C167.711 75.6927 168.294 75.9766 169.023 75.9766C169.758 75.9766 170.341 75.6901 170.773 75.1172C171.206 74.5391 171.422 73.7318 171.422 72.6953C171.422 71.7682 171.201 71.0182 170.758 70.4453C170.32 69.8672 169.737 69.5781 169.008 69.5781C168.294 69.5781 167.719 69.862 167.281 70.4297C166.844 70.9974 166.625 71.8099 166.625 72.8672ZM178.766 69.8438C178.547 69.8073 178.31 69.7891 178.055 69.7891C177.107 69.7891 176.464 70.1927 176.125 71V77H174.68V68.5469H176.086L176.109 69.5234C176.583 68.7682 177.255 68.3906 178.125 68.3906C178.406 68.3906 178.62 68.4271 178.766 68.5V69.8438ZM185.023 74.7578C185.023 74.3672 184.875 74.0651 184.578 73.8516C184.286 73.6328 183.773 73.4453 183.039 73.2891C182.31 73.1328 181.729 72.9453 181.297 72.7266C180.87 72.5078 180.552 72.2474 180.344 71.9453C180.141 71.6432 180.039 71.2839 180.039 70.8672C180.039 70.1745 180.331 69.5885 180.914 69.1094C181.503 68.6302 182.253 68.3906 183.164 68.3906C184.122 68.3906 184.898 68.638 185.492 69.1328C186.091 69.6276 186.391 70.2604 186.391 71.0312H184.938C184.938 70.6354 184.768 70.2943 184.43 70.0078C184.096 69.7214 183.674 69.5781 183.164 69.5781C182.638 69.5781 182.227 69.6927 181.93 69.9219C181.633 70.151 181.484 70.4505 181.484 70.8203C181.484 71.1693 181.622 71.4323 181.898 71.6094C182.174 71.7865 182.672 71.9557 183.391 72.1172C184.115 72.2786 184.701 72.4714 185.148 72.6953C185.596 72.9193 185.927 73.1901 186.141 73.5078C186.359 73.8203 186.469 74.2031 186.469 74.6562C186.469 75.4115 186.167 76.0182 185.562 76.4766C184.958 76.9297 184.174 77.1562 183.211 77.1562C182.534 77.1562 181.935 77.0365 181.414 76.7969C180.893 76.5573 180.484 76.224 180.188 75.7969C179.896 75.3646 179.75 74.8984 179.75 74.3984H181.195C181.221 74.8828 181.414 75.2682 181.773 75.5547C182.138 75.8359 182.617 75.9766 183.211 75.9766C183.758 75.9766 184.195 75.8672 184.523 75.6484C184.857 75.4245 185.023 75.1276 185.023 74.7578Z" fill="black"/>
                        <path id="Toggle true marginals" d="M249.094 47.8594H245.438V58H243.945V47.8594H240.297V46.625H249.094V47.8594ZM249.391 53.6953C249.391 52.8672 249.552 52.1224 249.875 51.4609C250.203 50.7995 250.656 50.2891 251.234 49.9297C251.818 49.5703 252.482 49.3906 253.227 49.3906C254.378 49.3906 255.307 49.7891 256.016 50.5859C256.729 51.3828 257.086 52.4427 257.086 53.7656V53.8672C257.086 54.6901 256.927 55.4297 256.609 56.0859C256.297 56.737 255.846 57.2448 255.258 57.6094C254.674 57.974 254.003 58.1562 253.242 58.1562C252.096 58.1562 251.167 57.7578 250.453 56.9609C249.745 56.1641 249.391 55.1094 249.391 53.7969V53.6953ZM250.844 53.8672C250.844 54.8047 251.06 55.5573 251.492 56.125C251.93 56.6927 252.513 56.9766 253.242 56.9766C253.977 56.9766 254.56 56.6901 254.992 56.1172C255.424 55.5391 255.641 54.7318 255.641 53.6953C255.641 52.7682 255.419 52.0182 254.977 51.4453C254.539 50.8672 253.956 50.5781 253.227 50.5781C252.513 50.5781 251.938 50.862 251.5 51.4297C251.062 51.9974 250.844 52.8099 250.844 53.8672ZM258.555 53.7031C258.555 52.3854 258.859 51.3385 259.469 50.5625C260.078 49.7812 260.885 49.3906 261.891 49.3906C262.922 49.3906 263.727 49.7552 264.305 50.4844L264.375 49.5469H265.695V57.7969C265.695 58.8906 265.37 59.7526 264.719 60.3828C264.073 61.013 263.203 61.3281 262.109 61.3281C261.5 61.3281 260.904 61.1979 260.32 60.9375C259.737 60.6771 259.292 60.3203 258.984 59.8672L259.734 59C260.354 59.7656 261.112 60.1484 262.008 60.1484C262.711 60.1484 263.258 59.9505 263.648 59.5547C264.044 59.1589 264.242 58.6016 264.242 57.8828V57.1562C263.664 57.8229 262.875 58.1562 261.875 58.1562C260.885 58.1562 260.083 57.7578 259.469 56.9609C258.859 56.1641 258.555 55.0781 258.555 53.7031ZM260.008 53.8672C260.008 54.8203 260.203 55.5703 260.594 56.1172C260.984 56.6589 261.531 56.9297 262.234 56.9297C263.146 56.9297 263.815 56.5156 264.242 55.6875V51.8281C263.799 51.0208 263.135 50.6172 262.25 50.6172C261.547 50.6172 260.997 50.8906 260.602 51.4375C260.206 51.9844 260.008 52.7943 260.008 53.8672ZM267.539 53.7031C267.539 52.3854 267.844 51.3385 268.453 50.5625C269.062 49.7812 269.87 49.3906 270.875 49.3906C271.906 49.3906 272.711 49.7552 273.289 50.4844L273.359 49.5469H274.68V57.7969C274.68 58.8906 274.354 59.7526 273.703 60.3828C273.057 61.013 272.188 61.3281 271.094 61.3281C270.484 61.3281 269.888 61.1979 269.305 60.9375C268.721 60.6771 268.276 60.3203 267.969 59.8672L268.719 59C269.339 59.7656 270.096 60.1484 270.992 60.1484C271.695 60.1484 272.242 59.9505 272.633 59.5547C273.029 59.1589 273.227 58.6016 273.227 57.8828V57.1562C272.648 57.8229 271.859 58.1562 270.859 58.1562C269.87 58.1562 269.068 57.7578 268.453 56.9609C267.844 56.1641 267.539 55.0781 267.539 53.7031ZM268.992 53.8672C268.992 54.8203 269.188 55.5703 269.578 56.1172C269.969 56.6589 270.516 56.9297 271.219 56.9297C272.13 56.9297 272.799 56.5156 273.227 55.6875V51.8281C272.784 51.0208 272.12 50.6172 271.234 50.6172C270.531 50.6172 269.982 50.8906 269.586 51.4375C269.19 51.9844 268.992 52.7943 268.992 53.8672ZM278.438 58H276.992V46H278.438V58ZM284.266 58.1562C283.12 58.1562 282.188 57.7812 281.469 57.0312C280.75 56.276 280.391 55.2682 280.391 54.0078V53.7422C280.391 52.9036 280.549 52.1562 280.867 51.5C281.19 50.8385 281.638 50.3229 282.211 49.9531C282.789 49.5781 283.414 49.3906 284.086 49.3906C285.185 49.3906 286.039 49.7526 286.648 50.4766C287.258 51.2005 287.562 52.237 287.562 53.5859V54.1875H281.836C281.857 55.0208 282.099 55.6953 282.562 56.2109C283.031 56.7214 283.625 56.9766 284.344 56.9766C284.854 56.9766 285.286 56.8724 285.641 56.6641C285.995 56.4557 286.305 56.1797 286.57 55.8359L287.453 56.5234C286.745 57.612 285.682 58.1562 284.266 58.1562ZM284.086 50.5781C283.503 50.5781 283.013 50.7917 282.617 51.2188C282.221 51.6406 281.977 52.2344 281.883 53H286.117V52.8906C286.076 52.1562 285.878 51.5885 285.523 51.1875C285.169 50.7812 284.69 50.5781 284.086 50.5781ZM295.172 47.5V49.5469H296.75V50.6641H295.172V55.9062C295.172 56.2448 295.242 56.5 295.383 56.6719C295.523 56.8385 295.763 56.9219 296.102 56.9219C296.268 56.9219 296.497 56.8906 296.789 56.8281V58C296.409 58.1042 296.039 58.1562 295.68 58.1562C295.034 58.1562 294.547 57.9609 294.219 57.5703C293.891 57.1797 293.727 56.625 293.727 55.9062V50.6641H292.188V49.5469H293.727V47.5H295.172ZM302.531 50.8438C302.312 50.8073 302.076 50.7891 301.82 50.7891C300.872 50.7891 300.229 51.1927 299.891 52V58H298.445V49.5469H299.852L299.875 50.5234C300.349 49.7682 301.021 49.3906 301.891 49.3906C302.172 49.3906 302.385 49.4271 302.531 49.5V50.8438ZM309.086 57.1641C308.523 57.8255 307.698 58.1562 306.609 58.1562C305.708 58.1562 305.021 57.8958 304.547 57.375C304.078 56.849 303.841 56.0729 303.836 55.0469V49.5469H305.281V55.0078C305.281 56.2891 305.802 56.9297 306.844 56.9297C307.948 56.9297 308.682 56.5182 309.047 55.6953V49.5469H310.492V58H309.117L309.086 57.1641ZM316.203 58.1562C315.057 58.1562 314.125 57.7812 313.406 57.0312C312.688 56.276 312.328 55.2682 312.328 54.0078V53.7422C312.328 52.9036 312.487 52.1562 312.805 51.5C313.128 50.8385 313.576 50.3229 314.148 49.9531C314.727 49.5781 315.352 49.3906 316.023 49.3906C317.122 49.3906 317.977 49.7526 318.586 50.4766C319.195 51.2005 319.5 52.237 319.5 53.5859V54.1875H313.773C313.794 55.0208 314.036 55.6953 314.5 56.2109C314.969 56.7214 315.562 56.9766 316.281 56.9766C316.792 56.9766 317.224 56.8724 317.578 56.6641C317.932 56.4557 318.242 56.1797 318.508 55.8359L319.391 56.5234C318.682 57.612 317.62 58.1562 316.203 58.1562ZM316.023 50.5781C315.44 50.5781 314.951 50.7917 314.555 51.2188C314.159 51.6406 313.914 52.2344 313.82 53H318.055V52.8906C318.013 52.1562 317.815 51.5885 317.461 51.1875C317.107 50.7812 316.628 50.5781 316.023 50.5781ZM247.18 68.5469L247.219 69.4844C247.839 68.7552 248.674 68.3906 249.727 68.3906C250.909 68.3906 251.714 68.8438 252.141 69.75C252.422 69.3438 252.786 69.0156 253.234 68.7656C253.688 68.5156 254.221 68.3906 254.836 68.3906C256.69 68.3906 257.633 69.3724 257.664 71.3359V77H256.219V71.4219C256.219 70.8177 256.081 70.3672 255.805 70.0703C255.529 69.7682 255.065 69.6172 254.414 69.6172C253.878 69.6172 253.432 69.7786 253.078 70.1016C252.724 70.4193 252.518 70.849 252.461 71.3906V77H251.008V71.4609C251.008 70.2318 250.406 69.6172 249.203 69.6172C248.255 69.6172 247.607 70.0208 247.258 70.8281V77H245.812V68.5469H247.18ZM265.07 77C264.987 76.8333 264.919 76.5365 264.867 76.1094C264.195 76.8073 263.393 77.1562 262.461 77.1562C261.628 77.1562 260.943 76.9219 260.406 76.4531C259.875 75.9792 259.609 75.3802 259.609 74.6562C259.609 73.776 259.943 73.0938 260.609 72.6094C261.281 72.1198 262.224 71.875 263.438 71.875H264.844V71.2109C264.844 70.7057 264.693 70.3047 264.391 70.0078C264.089 69.7057 263.643 69.5547 263.055 69.5547C262.539 69.5547 262.107 69.6849 261.758 69.9453C261.409 70.2057 261.234 70.5208 261.234 70.8906H259.781C259.781 70.4688 259.93 70.0625 260.227 69.6719C260.529 69.276 260.935 68.9635 261.445 68.7344C261.961 68.5052 262.526 68.3906 263.141 68.3906C264.115 68.3906 264.878 68.6354 265.43 69.125C265.982 69.6094 266.268 70.2786 266.289 71.1328V75.0234C266.289 75.7995 266.388 76.4167 266.586 76.875V77H265.07ZM262.672 75.8984C263.125 75.8984 263.555 75.7812 263.961 75.5469C264.367 75.3125 264.661 75.0078 264.844 74.6328V72.8984H263.711C261.94 72.8984 261.055 73.4167 261.055 74.4531C261.055 74.9062 261.206 75.2604 261.508 75.5156C261.81 75.7708 262.198 75.8984 262.672 75.8984ZM272.641 69.8438C272.422 69.8073 272.185 69.7891 271.93 69.7891C270.982 69.7891 270.339 70.1927 270 71V77H268.555V68.5469H269.961L269.984 69.5234C270.458 68.7682 271.13 68.3906 272 68.3906C272.281 68.3906 272.495 68.4271 272.641 68.5V69.8438ZM273.477 72.7031C273.477 71.3854 273.781 70.3385 274.391 69.5625C275 68.7812 275.807 68.3906 276.812 68.3906C277.844 68.3906 278.648 68.7552 279.227 69.4844L279.297 68.5469H280.617V76.7969C280.617 77.8906 280.292 78.7526 279.641 79.3828C278.995 80.013 278.125 80.3281 277.031 80.3281C276.422 80.3281 275.826 80.1979 275.242 79.9375C274.659 79.6771 274.214 79.3203 273.906 78.8672L274.656 78C275.276 78.7656 276.034 79.1484 276.93 79.1484C277.633 79.1484 278.18 78.9505 278.57 78.5547C278.966 78.1589 279.164 77.6016 279.164 76.8828V76.1562C278.586 76.8229 277.797 77.1562 276.797 77.1562C275.807 77.1562 275.005 76.7578 274.391 75.9609C273.781 75.1641 273.477 74.0781 273.477 72.7031ZM274.93 72.8672C274.93 73.8203 275.125 74.5703 275.516 75.1172C275.906 75.6589 276.453 75.9297 277.156 75.9297C278.068 75.9297 278.737 75.5156 279.164 74.6875V70.8281C278.721 70.0208 278.057 69.6172 277.172 69.6172C276.469 69.6172 275.919 69.8906 275.523 70.4375C275.128 70.9844 274.93 71.7943 274.93 72.8672ZM284.375 77H282.93V68.5469H284.375V77ZM282.812 66.3047C282.812 66.0703 282.883 65.8724 283.023 65.7109C283.169 65.5495 283.383 65.4688 283.664 65.4688C283.945 65.4688 284.159 65.5495 284.305 65.7109C284.451 65.8724 284.523 66.0703 284.523 66.3047C284.523 66.5391 284.451 66.7344 284.305 66.8906C284.159 67.0469 283.945 67.125 283.664 67.125C283.383 67.125 283.169 67.0469 283.023 66.8906C282.883 66.7344 282.812 66.5391 282.812 66.3047ZM288.062 68.5469L288.109 69.6094C288.755 68.7969 289.599 68.3906 290.641 68.3906C292.427 68.3906 293.328 69.3984 293.344 71.4141V77H291.898V71.4062C291.893 70.7969 291.753 70.3464 291.477 70.0547C291.206 69.763 290.781 69.6172 290.203 69.6172C289.734 69.6172 289.323 69.7422 288.969 69.9922C288.615 70.2422 288.339 70.5703 288.141 70.9766V77H286.695V68.5469H288.062ZM300.742 77C300.659 76.8333 300.591 76.5365 300.539 76.1094C299.867 76.8073 299.065 77.1562 298.133 77.1562C297.299 77.1562 296.615 76.9219 296.078 76.4531C295.547 75.9792 295.281 75.3802 295.281 74.6562C295.281 73.776 295.615 73.0938 296.281 72.6094C296.953 72.1198 297.896 71.875 299.109 71.875H300.516V71.2109C300.516 70.7057 300.365 70.3047 300.062 70.0078C299.76 69.7057 299.315 69.5547 298.727 69.5547C298.211 69.5547 297.779 69.6849 297.43 69.9453C297.081 70.2057 296.906 70.5208 296.906 70.8906H295.453C295.453 70.4688 295.602 70.0625 295.898 69.6719C296.201 69.276 296.607 68.9635 297.117 68.7344C297.633 68.5052 298.198 68.3906 298.812 68.3906C299.786 68.3906 300.549 68.6354 301.102 69.125C301.654 69.6094 301.94 70.2786 301.961 71.1328V75.0234C301.961 75.7995 302.06 76.4167 302.258 76.875V77H300.742ZM298.344 75.8984C298.797 75.8984 299.227 75.7812 299.633 75.5469C300.039 75.3125 300.333 75.0078 300.516 74.6328V72.8984H299.383C297.612 72.8984 296.727 73.4167 296.727 74.4531C296.727 74.9062 296.878 75.2604 297.18 75.5156C297.482 75.7708 297.87 75.8984 298.344 75.8984ZM305.797 77H304.352V65H305.797V77ZM313.039 74.7578C313.039 74.3672 312.891 74.0651 312.594 73.8516C312.302 73.6328 311.789 73.4453 311.055 73.2891C310.326 73.1328 309.745 72.9453 309.312 72.7266C308.885 72.5078 308.568 72.2474 308.359 71.9453C308.156 71.6432 308.055 71.2839 308.055 70.8672C308.055 70.1745 308.346 69.5885 308.93 69.1094C309.518 68.6302 310.268 68.3906 311.18 68.3906C312.138 68.3906 312.914 68.638 313.508 69.1328C314.107 69.6276 314.406 70.2604 314.406 71.0312H312.953C312.953 70.6354 312.784 70.2943 312.445 70.0078C312.112 69.7214 311.69 69.5781 311.18 69.5781C310.654 69.5781 310.242 69.6927 309.945 69.9219C309.648 70.151 309.5 70.4505 309.5 70.8203C309.5 71.1693 309.638 71.4323 309.914 71.6094C310.19 71.7865 310.688 71.9557 311.406 72.1172C312.13 72.2786 312.716 72.4714 313.164 72.6953C313.612 72.9193 313.943 73.1901 314.156 73.5078C314.375 73.8203 314.484 74.2031 314.484 74.6562C314.484 75.4115 314.182 76.0182 313.578 76.4766C312.974 76.9297 312.19 77.1562 311.227 77.1562C310.549 77.1562 309.951 77.0365 309.43 76.7969C308.909 76.5573 308.5 76.224 308.203 75.7969C307.911 75.3646 307.766 74.8984 307.766 74.3984H309.211C309.237 74.8828 309.43 75.2682 309.789 75.5547C310.154 75.8359 310.633 75.9766 311.227 75.9766C311.773 75.9766 312.211 75.8672 312.539 75.6484C312.872 75.4245 313.039 75.1276 313.039 74.7578Z" fill="black"/>
                    </g>
                    <path id="Random data factors" d="M19.7031 53.3984H17.0312V58H15.5234V46.625H19.2891C20.5703 46.625 21.5547 46.9167 22.2422 47.5C22.9349 48.0833 23.2812 48.9323 23.2812 50.0469C23.2812 50.7552 23.0885 51.3724 22.7031 51.8984C22.3229 52.4245 21.7917 52.8177 21.1094 53.0781L23.7812 57.9062V58H22.1719L19.7031 53.3984ZM17.0312 52.1719H19.3359C20.0807 52.1719 20.6719 51.9792 21.1094 51.5938C21.5521 51.2083 21.7734 50.6927 21.7734 50.0469C21.7734 49.3438 21.5625 48.8047 21.1406 48.4297C20.724 48.0547 20.1198 47.8646 19.3281 47.8594H17.0312V52.1719ZM30.3828 58C30.2995 57.8333 30.2318 57.5365 30.1797 57.1094C29.5078 57.8073 28.7057 58.1562 27.7734 58.1562C26.9401 58.1562 26.2552 57.9219 25.7188 57.4531C25.1875 56.9792 24.9219 56.3802 24.9219 55.6562C24.9219 54.776 25.2552 54.0938 25.9219 53.6094C26.5938 53.1198 27.5365 52.875 28.75 52.875H30.1562V52.2109C30.1562 51.7057 30.0052 51.3047 29.7031 51.0078C29.401 50.7057 28.9557 50.5547 28.3672 50.5547C27.8516 50.5547 27.4193 50.6849 27.0703 50.9453C26.7214 51.2057 26.5469 51.5208 26.5469 51.8906H25.0938C25.0938 51.4688 25.2422 51.0625 25.5391 50.6719C25.8411 50.276 26.2474 49.9635 26.7578 49.7344C27.2734 49.5052 27.8385 49.3906 28.4531 49.3906C29.4271 49.3906 30.1901 49.6354 30.7422 50.125C31.2943 50.6094 31.5807 51.2786 31.6016 52.1328V56.0234C31.6016 56.7995 31.7005 57.4167 31.8984 57.875V58H30.3828ZM27.9844 56.8984C28.4375 56.8984 28.8672 56.7812 29.2734 56.5469C29.6797 56.3125 29.974 56.0078 30.1562 55.6328V53.8984H29.0234C27.2526 53.8984 26.3672 54.4167 26.3672 55.4531C26.3672 55.9062 26.5182 56.2604 26.8203 56.5156C27.1224 56.7708 27.5104 56.8984 27.9844 56.8984ZM35.2344 49.5469L35.2812 50.6094C35.9271 49.7969 36.7708 49.3906 37.8125 49.3906C39.599 49.3906 40.5 50.3984 40.5156 52.4141V58H39.0703V52.4062C39.0651 51.7969 38.9245 51.3464 38.6484 51.0547C38.3776 50.763 37.9531 50.6172 37.375 50.6172C36.9062 50.6172 36.4948 50.7422 36.1406 50.9922C35.7865 51.2422 35.5104 51.5703 35.3125 51.9766V58H33.8672V49.5469H35.2344ZM42.3438 53.7031C42.3438 52.4062 42.651 51.3646 43.2656 50.5781C43.8802 49.7865 44.6849 49.3906 45.6797 49.3906C46.6693 49.3906 47.4531 49.7292 48.0312 50.4062V46H49.4766V58H48.1484L48.0781 57.0938C47.5 57.8021 46.6953 58.1562 45.6641 58.1562C44.6849 58.1562 43.8854 57.7552 43.2656 56.9531C42.651 56.151 42.3438 55.1042 42.3438 53.8125V53.7031ZM43.7891 53.8672C43.7891 54.8255 43.987 55.5755 44.3828 56.1172C44.7786 56.6589 45.3255 56.9297 46.0234 56.9297C46.9401 56.9297 47.6094 56.5182 48.0312 55.6953V51.8125C47.599 51.0156 46.9349 50.6172 46.0391 50.6172C45.3307 50.6172 44.7786 50.8906 44.3828 51.4375C43.987 51.9844 43.7891 52.7943 43.7891 53.8672ZM51.3438 53.6953C51.3438 52.8672 51.5052 52.1224 51.8281 51.4609C52.1562 50.7995 52.6094 50.2891 53.1875 49.9297C53.7708 49.5703 54.4349 49.3906 55.1797 49.3906C56.3307 49.3906 57.2604 49.7891 57.9688 50.5859C58.6823 51.3828 59.0391 52.4427 59.0391 53.7656V53.8672C59.0391 54.6901 58.8802 55.4297 58.5625 56.0859C58.25 56.737 57.7995 57.2448 57.2109 57.6094C56.6276 57.974 55.9557 58.1562 55.1953 58.1562C54.0495 58.1562 53.1198 57.7578 52.4062 56.9609C51.6979 56.1641 51.3438 55.1094 51.3438 53.7969V53.6953ZM52.7969 53.8672C52.7969 54.8047 53.013 55.5573 53.4453 56.125C53.8828 56.6927 54.4661 56.9766 55.1953 56.9766C55.9297 56.9766 56.513 56.6901 56.9453 56.1172C57.3776 55.5391 57.5938 54.7318 57.5938 53.6953C57.5938 52.7682 57.3724 52.0182 56.9297 51.4453C56.4922 50.8672 55.9089 50.5781 55.1797 50.5781C54.4661 50.5781 53.8906 50.862 53.4531 51.4297C53.0156 51.9974 52.7969 52.8099 52.7969 53.8672ZM62.2109 49.5469L62.25 50.4844C62.8698 49.7552 63.7057 49.3906 64.7578 49.3906C65.9401 49.3906 66.7448 49.8438 67.1719 50.75C67.4531 50.3438 67.8177 50.0156 68.2656 49.7656C68.7188 49.5156 69.2526 49.3906 69.8672 49.3906C71.7214 49.3906 72.6641 50.3724 72.6953 52.3359V58H71.25V52.4219C71.25 51.8177 71.112 51.3672 70.8359 51.0703C70.5599 50.7682 70.0964 50.6172 69.4453 50.6172C68.9089 50.6172 68.4635 50.7786 68.1094 51.1016C67.7552 51.4193 67.5495 51.849 67.4922 52.3906V58H66.0391V52.4609C66.0391 51.2318 65.4375 50.6172 64.2344 50.6172C63.2865 50.6172 62.638 51.0208 62.2891 51.8281V58H60.8438V49.5469H62.2109ZM1.66406 72.7031C1.66406 71.4062 1.97135 70.3646 2.58594 69.5781C3.20052 68.7865 4.00521 68.3906 5 68.3906C5.98958 68.3906 6.77344 68.7292 7.35156 69.4062V65H8.79688V77H7.46875L7.39844 76.0938C6.82031 76.8021 6.01562 77.1562 4.98438 77.1562C4.00521 77.1562 3.20573 76.7552 2.58594 75.9531C1.97135 75.151 1.66406 74.1042 1.66406 72.8125V72.7031ZM3.10938 72.8672C3.10938 73.8255 3.30729 74.5755 3.70312 75.1172C4.09896 75.6589 4.64583 75.9297 5.34375 75.9297C6.26042 75.9297 6.92969 75.5182 7.35156 74.6953V70.8125C6.91927 70.0156 6.25521 69.6172 5.35938 69.6172C4.65104 69.6172 4.09896 69.8906 3.70312 70.4375C3.30729 70.9844 3.10938 71.7943 3.10938 72.8672ZM16.2656 77C16.1823 76.8333 16.1146 76.5365 16.0625 76.1094C15.3906 76.8073 14.5885 77.1562 13.6562 77.1562C12.8229 77.1562 12.138 76.9219 11.6016 76.4531C11.0703 75.9792 10.8047 75.3802 10.8047 74.6562C10.8047 73.776 11.138 73.0938 11.8047 72.6094C12.4766 72.1198 13.4193 71.875 14.6328 71.875H16.0391V71.2109C16.0391 70.7057 15.888 70.3047 15.5859 70.0078C15.2839 69.7057 14.8385 69.5547 14.25 69.5547C13.7344 69.5547 13.3021 69.6849 12.9531 69.9453C12.6042 70.2057 12.4297 70.5208 12.4297 70.8906H10.9766C10.9766 70.4688 11.125 70.0625 11.4219 69.6719C11.724 69.276 12.1302 68.9635 12.6406 68.7344C13.1562 68.5052 13.7214 68.3906 14.3359 68.3906C15.3099 68.3906 16.0729 68.6354 16.625 69.125C17.1771 69.6094 17.4635 70.2786 17.4844 71.1328V75.0234C17.4844 75.7995 17.5833 76.4167 17.7812 76.875V77H16.2656ZM13.8672 75.8984C14.3203 75.8984 14.75 75.7812 15.1562 75.5469C15.5625 75.3125 15.8568 75.0078 16.0391 74.6328V72.8984H14.9062C13.1354 72.8984 12.25 73.4167 12.25 74.4531C12.25 74.9062 12.401 75.2604 12.7031 75.5156C13.0052 75.7708 13.3932 75.8984 13.8672 75.8984ZM21.7109 66.5V68.5469H23.2891V69.6641H21.7109V74.9062C21.7109 75.2448 21.7812 75.5 21.9219 75.6719C22.0625 75.8385 22.3021 75.9219 22.6406 75.9219C22.8073 75.9219 23.0365 75.8906 23.3281 75.8281V77C22.9479 77.1042 22.5781 77.1562 22.2188 77.1562C21.5729 77.1562 21.0859 76.9609 20.7578 76.5703C20.4297 76.1797 20.2656 75.625 20.2656 74.9062V69.6641H18.7266V68.5469H20.2656V66.5H21.7109ZM30.2031 77C30.1198 76.8333 30.0521 76.5365 30 76.1094C29.3281 76.8073 28.526 77.1562 27.5938 77.1562C26.7604 77.1562 26.0755 76.9219 25.5391 76.4531C25.0078 75.9792 24.7422 75.3802 24.7422 74.6562C24.7422 73.776 25.0755 73.0938 25.7422 72.6094C26.4141 72.1198 27.3568 71.875 28.5703 71.875H29.9766V71.2109C29.9766 70.7057 29.8255 70.3047 29.5234 70.0078C29.2214 69.7057 28.776 69.5547 28.1875 69.5547C27.6719 69.5547 27.2396 69.6849 26.8906 69.9453C26.5417 70.2057 26.3672 70.5208 26.3672 70.8906H24.9141C24.9141 70.4688 25.0625 70.0625 25.3594 69.6719C25.6615 69.276 26.0677 68.9635 26.5781 68.7344C27.0938 68.5052 27.6589 68.3906 28.2734 68.3906C29.2474 68.3906 30.0104 68.6354 30.5625 69.125C31.1146 69.6094 31.401 70.2786 31.4219 71.1328V75.0234C31.4219 75.7995 31.5208 76.4167 31.7188 76.875V77H30.2031ZM27.8047 75.8984C28.2578 75.8984 28.6875 75.7812 29.0938 75.5469C29.5 75.3125 29.7943 75.0078 29.9766 74.6328V72.8984H28.8438C27.0729 72.8984 26.1875 73.4167 26.1875 74.4531C26.1875 74.9062 26.3385 75.2604 26.6406 75.5156C26.9427 75.7708 27.3307 75.8984 27.8047 75.8984ZM38.3672 77V69.6641H37.0312V68.5469H38.3672V67.6797C38.3672 66.7734 38.6094 66.0729 39.0938 65.5781C39.5781 65.0833 40.263 64.8359 41.1484 64.8359C41.4818 64.8359 41.8125 64.8802 42.1406 64.9688L42.0625 66.1406C41.8177 66.0938 41.5573 66.0703 41.2812 66.0703C40.8125 66.0703 40.4505 66.2083 40.1953 66.4844C39.9401 66.7552 39.8125 67.1458 39.8125 67.6562V68.5469H41.6172V69.6641H39.8125V77H38.3672ZM48.4375 77C48.3542 76.8333 48.2865 76.5365 48.2344 76.1094C47.5625 76.8073 46.7604 77.1562 45.8281 77.1562C44.9948 77.1562 44.3099 76.9219 43.7734 76.4531C43.2422 75.9792 42.9766 75.3802 42.9766 74.6562C42.9766 73.776 43.3099 73.0938 43.9766 72.6094C44.6484 72.1198 45.5911 71.875 46.8047 71.875H48.2109V71.2109C48.2109 70.7057 48.0599 70.3047 47.7578 70.0078C47.4557 69.7057 47.0104 69.5547 46.4219 69.5547C45.9062 69.5547 45.474 69.6849 45.125 69.9453C44.776 70.2057 44.6016 70.5208 44.6016 70.8906H43.1484C43.1484 70.4688 43.2969 70.0625 43.5938 69.6719C43.8958 69.276 44.3021 68.9635 44.8125 68.7344C45.3281 68.5052 45.8932 68.3906 46.5078 68.3906C47.4818 68.3906 48.2448 68.6354 48.7969 69.125C49.349 69.6094 49.6354 70.2786 49.6562 71.1328V75.0234C49.6562 75.7995 49.7552 76.4167 49.9531 76.875V77H48.4375ZM46.0391 75.8984C46.4922 75.8984 46.9219 75.7812 47.3281 75.5469C47.7344 75.3125 48.0286 75.0078 48.2109 74.6328V72.8984H47.0781C45.3073 72.8984 44.4219 73.4167 44.4219 74.4531C44.4219 74.9062 44.5729 75.2604 44.875 75.5156C45.1771 75.7708 45.5651 75.8984 46.0391 75.8984ZM55.3125 75.9766C55.8281 75.9766 56.2786 75.8203 56.6641 75.5078C57.0495 75.1953 57.263 74.8047 57.3047 74.3359H58.6719C58.6458 74.8203 58.4792 75.2812 58.1719 75.7188C57.8646 76.1562 57.4531 76.5052 56.9375 76.7656C56.4271 77.026 55.8854 77.1562 55.3125 77.1562C54.1615 77.1562 53.2448 76.7734 52.5625 76.0078C51.8854 75.237 51.5469 74.1849 51.5469 72.8516V72.6094C51.5469 71.7865 51.6979 71.0547 52 70.4141C52.3021 69.7734 52.7344 69.276 53.2969 68.9219C53.8646 68.5677 54.5339 68.3906 55.3047 68.3906C56.2526 68.3906 57.0391 68.6745 57.6641 69.2422C58.2943 69.8099 58.6302 70.5469 58.6719 71.4531H57.3047C57.263 70.9062 57.0547 70.4583 56.6797 70.1094C56.3099 69.7552 55.8516 69.5781 55.3047 69.5781C54.5703 69.5781 54 69.8438 53.5938 70.375C53.1927 70.901 52.9922 71.6641 52.9922 72.6641V72.9375C52.9922 73.9115 53.1927 74.6615 53.5938 75.1875C53.9948 75.7135 54.5677 75.9766 55.3125 75.9766ZM62.2578 66.5V68.5469H63.8359V69.6641H62.2578V74.9062C62.2578 75.2448 62.3281 75.5 62.4688 75.6719C62.6094 75.8385 62.849 75.9219 63.1875 75.9219C63.3542 75.9219 63.5833 75.8906 63.875 75.8281V77C63.4948 77.1042 63.125 77.1562 62.7656 77.1562C62.1198 77.1562 61.6328 76.9609 61.3047 76.5703C60.9766 76.1797 60.8125 75.625 60.8125 74.9062V69.6641H59.2734V68.5469H60.8125V66.5H62.2578ZM64.9922 72.6953C64.9922 71.8672 65.1536 71.1224 65.4766 70.4609C65.8047 69.7995 66.2578 69.2891 66.8359 68.9297C67.4193 68.5703 68.0833 68.3906 68.8281 68.3906C69.9792 68.3906 70.9089 68.7891 71.6172 69.5859C72.3307 70.3828 72.6875 71.4427 72.6875 72.7656V72.8672C72.6875 73.6901 72.5286 74.4297 72.2109 75.0859C71.8984 75.737 71.4479 76.2448 70.8594 76.6094C70.276 76.974 69.6042 77.1562 68.8438 77.1562C67.6979 77.1562 66.7682 76.7578 66.0547 75.9609C65.3464 75.1641 64.9922 74.1094 64.9922 72.7969V72.6953ZM66.4453 72.8672C66.4453 73.8047 66.6615 74.5573 67.0938 75.125C67.5312 75.6927 68.1146 75.9766 68.8438 75.9766C69.5781 75.9766 70.1615 75.6901 70.5938 75.1172C71.026 74.5391 71.2422 73.7318 71.2422 72.6953C71.2422 71.7682 71.0208 71.0182 70.5781 70.4453C70.1406 69.8672 69.5573 69.5781 68.8281 69.5781C68.1146 69.5781 67.5391 69.862 67.1016 70.4297C66.6641 70.9974 66.4453 71.8099 66.4453 72.8672ZM78.5859 69.8438C78.3672 69.8073 78.1302 69.7891 77.875 69.7891C76.9271 69.7891 76.2839 70.1927 75.9453 71V77H74.5V68.5469H75.9062L75.9297 69.5234C76.4036 68.7682 77.0755 68.3906 77.9453 68.3906C78.2266 68.3906 78.4401 68.4271 78.5859 68.5V69.8438ZM84.8438 74.7578C84.8438 74.3672 84.6953 74.0651 84.3984 73.8516C84.1068 73.6328 83.5938 73.4453 82.8594 73.2891C82.1302 73.1328 81.5495 72.9453 81.1172 72.7266C80.6901 72.5078 80.3724 72.2474 80.1641 71.9453C79.9609 71.6432 79.8594 71.2839 79.8594 70.8672C79.8594 70.1745 80.151 69.5885 80.7344 69.1094C81.3229 68.6302 82.0729 68.3906 82.9844 68.3906C83.9427 68.3906 84.7188 68.638 85.3125 69.1328C85.9115 69.6276 86.2109 70.2604 86.2109 71.0312H84.7578C84.7578 70.6354 84.5885 70.2943 84.25 70.0078C83.9167 69.7214 83.4948 69.5781 82.9844 69.5781C82.4583 69.5781 82.0469 69.6927 81.75 69.9219C81.4531 70.151 81.3047 70.4505 81.3047 70.8203C81.3047 71.1693 81.4427 71.4323 81.7188 71.6094C81.9948 71.7865 82.4922 71.9557 83.2109 72.1172C83.9349 72.2786 84.5208 72.4714 84.9688 72.6953C85.4167 72.9193 85.7474 73.1901 85.9609 73.5078C86.1797 73.8203 86.2891 74.2031 86.2891 74.6562C86.2891 75.4115 85.987 76.0182 85.3828 76.4766C84.7786 76.9297 83.9948 77.1562 83.0312 77.1562C82.3542 77.1562 81.7552 77.0365 81.2344 76.7969C80.7135 76.5573 80.3047 76.224 80.0078 75.7969C79.7161 75.3646 79.5703 74.8984 79.5703 74.3984H81.0156C81.0417 74.8828 81.2344 75.2682 81.5938 75.5547C81.9583 75.8359 82.4375 75.9766 83.0312 75.9766C83.5781 75.9766 84.0156 75.8672 84.3438 75.6484C84.6771 75.4245 84.8438 75.1276 84.8438 74.7578Z" fill="black"/>
                    <g id="random">
                    <g id="Rectangle 12">
                    <rect x="30" y="29" width="4" height="4" fill="black"/>
                    <rect x="30" y="29" width="4" height="4" fill="black"/>
                    <rect x="30" y="29" width="4" height="4" fill="black"/>
                    <rect x="30" y="29" width="4" height="4" fill="black"/>
                    </g>
                    <g id="Rectangle 15">
                    <rect x="40" y="23" width="4" height="4" fill="black"/>
                    <rect x="40" y="23" width="4" height="4" fill="black"/>
                    <rect x="40" y="23" width="4" height="4" fill="black"/>
                    <rect x="40" y="23" width="4" height="4" fill="black"/>
                    </g>
                    <g id="Rectangle 16">
                    <rect x="51" y="29" width="4" height="4" fill="black"/>
                    <rect x="51" y="29" width="4" height="4" fill="black"/>
                    <rect x="51" y="29" width="4" height="4" fill="black"/>
                    <rect x="51" y="29" width="4" height="4" fill="black"/>
                    </g>
                    <g id="Rectangle 17">
                    <rect x="55" y="15" width="4" height="4" fill="black"/>
                    <rect x="55" y="15" width="4" height="4" fill="black"/>
                    <rect x="55" y="15" width="4" height="4" fill="black"/>
                    <rect x="55" y="15" width="4" height="4" fill="black"/>
                    </g>
                    <g id="Rectangle 13">
                    <rect x="34" y="13" width="4" height="4" fill="black"/>
                    <rect x="34" y="13" width="4" height="4" fill="black"/>
                    <rect x="34" y="13" width="4" height="4" fill="black"/>
                    <rect x="34" y="13" width="4" height="4" fill="black"/>
                    </g>
                    <g id="Rectangle 14">
                    <rect x="26" y="18" width="4" height="4" fill="black"/>
                    <rect x="26" y="18" width="4" height="4" fill="black"/>
                    <rect x="26" y="18" width="4" height="4" fill="black"/>
                    <rect x="26" y="18" width="4" height="4" fill="black"/>
                    </g>
                    </g>

                    <g id="true marg marker" class="clickable" on:click={toggleBatch}>
                        <line id="Line 8" x1="279.75" y1="3" x2="279.75" y2="43" stroke="#008000" stroke-width="4"/>
                        <circle id="Ellipse 6" cx="279.5" cy="22.5" r="10.75" fill="white" stroke="#008000" stroke-width="4"/>
                    </g>

                    <rect class="clickable" on:click={newRandMeasurements} id="rand_rect" x="24" y="9" width="39" height="27" fill="#C4C4C4" opacity="0"/>

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
        </div>

    </div>

    <figcaption id="caption">
        1D line fitting. 
        Experiment with different message passing schedules. 
        Use the synchronous, random and sweep schedules or click on a variable node to send messages to its neighbours.
        Note the variable nodes start at the bottom of the canvas before they have received any messages.
    </figcaption>

</figure>

