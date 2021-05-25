<script>
    import * as m from 'ml-matrix';
    import { onMount } from "svelte";
    import { onInterval } from "../utils/util.js";
    import { tweened } from "svelte/motion";
    import { fade } from "svelte/transition";
    import * as easing from "svelte/easing";
    import anime from "animejs";
    import MultiButtonGroup from '../utils/MultiButtonGroup.svelte'
    import * as gbp from "../gbp/gbp_playground.js";

    let on = true;

    // svg
    let svg_width = 600;
    let svg_height = 600;

    // GBP parameters
    const prior_std = 100;
    const meas_params = {
        "linear" : {
            "noise_model_std": 50,
            "noise_std": 0,
        }
    };

    let n_mess = 0;

    // Local graph variables
    let graph;
    $: var_nodes = [];
    $: factor_nodes = [];
    const damping = 0.0;  // Only for grid
    const dropout = 0.;  // Only for grid

    // Message passing animation
    let highlight_id = null;
    $: message_bubbles = [];
    $: moving_beliefs = [];
    const bubble_progress = tweened(0);
    const move_belief_progress = tweened(0);
    const bubble_time = 100;  // ms
    const move_belief_time = 50;
    const highlight_time = 100;

    // UI
    let show_batch = true;

    // Visual appearance
    let factor_size = 20;
    let radius = 10;
    let mean_radius = 8;

    // Preset initializations
    const grid_prior = {"0":{"eta":[100,100],"lam":1},"1":{"eta":[0.024606250000000017,0.007181250000000011],"lam":0.0001},"2":{"eta":[0.05340625000000004,0.014781250000000003],"lam":0.0001},"3":{"eta":[0.005006250000000001,0.03498125],"lam":0.0001},"4":{"eta":[0.027306249999999997,0.03518125000000002],"lam":0.0001},"5":{"eta":[0.04500625,0.025081250000000006],"lam":0.0001},"6":{"eta":[0.015206250000000003,0.04338125000000001],"lam":0.0001},"7":{"eta":[0.034306250000000045,0.05538125],"lam":0.0001},"8":{"eta":[0.05020625000000001,0.04408125000000003],"lam":0.0001}};

    onMount(() => {
        load_priors(grid_prior);
    });

    onInterval(() => {
        update_local_vars();
    }, 1000 / 30);

    onInterval(() => {
        if (on) {
            randomMessage();
            n_mess++;
            // console.log(n_mess);
            if (n_mess == 200) {
                load_priors(grid_prior);
                n_mess = 0;
            }
        }
    }, 150);

    function update_local_vars() {
        var_nodes = graph.var_nodes;
        factor_nodes = graph.factor_nodes;
        graph.compute_MAP();
    }


    // Playground templates -----------------------------------------------------------

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

    function set_playground() {
        var_nodes = [];
        factor_nodes = [];
        graph = create_grid_playground();
        graph.update_beliefs();
    }

    function load_priors(priors) {
        set_playground();
        for (var i = 0; i < graph.var_nodes.length; i++) {
            const n = graph.var_nodes[i];
            n.prior.eta = new m.Matrix([[priors[n.id].eta[0]], [priors[n.id].eta[1]]]);
            n.prior.lam = new m.Matrix([[priors[n.id].lam, 0.], [0., priors[n.id].lam]]);
        }
        graph.update_beliefs();
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

            for (let i=0; i < node.adj_ids.length; i++) {
                const fid = node.adj_ids[i];
                move_belief[fid] = {start: graph.find_node(fid).last_energy, end: graph.find_node(fid).energy()};
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

    // Event handlers -----------------------------------------------------------

    function randomMessage(e) {
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

    // Utility functions --------------------------------------------------------

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

    #svg {
        width: 100%;
        height: auto;
        background-color: var(--gray-bg);
        /* border: 1px solid var(--gray); */
    }

    #wrapper {
        background-color: var(--gray-bg);
        display: grid;
        grid-template-rows: auto auto;
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
    .edge {
        stroke: black;
        stroke-width: 1;
        opacity: 0.8;
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

    .mess-bubble {
        stroke: var(--red);
        fill: var(--red);
    }

    #text {
        text-align: center;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
        font-family: monospace;
        text-decoration: none;
        /* line-height: 1.0em; */
        /* background-color: yellow; */
    }

    #play-slider {
        display: grid;
        grid-template-columns: 8% 92%;
    }

    .small_icon {
        cursor: pointer;
        width: 30px;
        height: 30px;
    }

</style>


<figure class="subgrid" id="figure">

    <div id="wrapper" class="interactive-container">

        <svg id="svg" width="690" height="690" viewBox="-53 -32 690 690" xmlns="http://www.w3.org/2000/svg">

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

            <ellipse class="gt-cov" fill="url(#gt_cov_gradient)" cx={-24} cy={-5} rx={25} ry={25}/>
            <circle class="gt-mean" cx={-24} cy={-5} r={6}/>
            <ellipse class="belief-cov" fill="url(#belief_covariance_gradient)" cx={-24} cy={52} rx={25} ry={25}/>
            <circle class="belief-mean" cx={-24} cy={52} r={6}/>
            <text fill="black" font-size="20px" x={6} y={59}>Belief</text>
            <text fill="black" font-size="20px" x={6} y={3}>True marginal</text>


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
                    <ellipse class="gt-cov" fill="url(#gt_cov_gradient)"
                        cx={n.MAP_ellipse.cx} cy={n.MAP_ellipse.cy} rx={n.MAP_ellipse.rx} ry={n.MAP_ellipse.ry}
                        transform="rotate({n.MAP_ellipse.angle}, {n.MAP_ellipse.cx}, {n.MAP_ellipse.cy})"/>
                    <circle class="gt-mean" cx={n.MAP_ellipse.cx} cy={n.MAP_ellipse.cy} r={mean_radius}/>
                    {#if moving_beliefs.map(x => x.id).includes(n.id)}
                        <line class="map-diff" x1={n.MAP_ellipse.cx} y1={n.MAP_ellipse.cy} 
                        x2={linear_progress(moving_beliefs.find(x => x.id == n.id).x, $move_belief_progress)} 
                        y2={linear_progress(moving_beliefs.find(x => x.id == n.id).y, $move_belief_progress)}/>
                    {:else}
                        <line class="map-diff" x1={n.MAP_ellipse.cx} y1={n.MAP_ellipse.cy} x2={n.belief_ellipse.cx} y2={n.belief_ellipse.cy}/>
                    {/if}
                {/if}

                {#if moving_beliefs.map(x => x.id).includes(n.id)}
                    <ellipse class="belief-cov" fill="url(#belief_covariance_gradient)"
                        cx={linear_progress(moving_beliefs.find(x => x.id == n.id).x, $move_belief_progress)} 
                        cy={linear_progress(moving_beliefs.find(x => x.id == n.id).y, $move_belief_progress)} 
                        rx={linear_progress(moving_beliefs.find(x => x.id == n.id).r, $move_belief_progress)} 
                        ry={linear_progress(moving_beliefs.find(x => x.id == n.id).r, $move_belief_progress)}/>
                    <circle class="belief-mean" r={mean_radius}
                        cx={linear_progress(moving_beliefs.find(x => x.id == n.id).x, $move_belief_progress)}
                        cy={linear_progress(moving_beliefs.find(x => x.id == n.id).y, $move_belief_progress)}/>
                {:else}
                    <g class="node_g" id={n.id} draggable="true">
                        <ellipse  class="belief-cov" id={"node_belief_cov_"+n.id} 
                            fill="url(#belief_covariance_gradient)"
                            cx={n.belief_ellipse.cx} cy={n.belief_ellipse.cy} rx={n.belief_ellipse.rx} ry={n.belief_ellipse.ry}
                            transform="rotate({n.belief_ellipse.angle}, {n.belief_ellipse.cx}, {n.belief_ellipse.cy})"/>
                        <circle class:belief-mean={highlight_id != n.id} class:highlight-mean={highlight_id == n.id} id={"node_belief_mean_"+n.id} 
                            cx={n.belief_ellipse.cx} cy={n.belief_ellipse.cy} r={mean_radius}/>
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

        <div id="play-slider">
        
            <div id="play-pause">
                {#if !on}
                    <svg class="small_icon" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg"
                        on:click={() => on = true}>
                        <rect width="90" height="90" fill="url(#pa0)"/>
                        <defs>
                        <pattern id="pa0" patternContentUnits="objectBoundingBox" width="1" height="1">
                        <use xlink:href="#ig0" transform="scale(0.0111111)"/>
                        </pattern>
                        <image id="ig0" width="90" height="90" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAABaCAYAAAA4qEECAAAABmJLR0QA/wD/AP+gvaeTAAACiUlEQVR4nO2du2pUURhGl4qRgIKNaKm1NvoA+hS2lr6C+AQqiJcynbWvkLyA6bVWMCm8FIKNIzoWw4YhYfCcOf9l732+BasM2XsVYb7JSQaEEEIIIYQQolN2gGfAMfAVeAlcST1RpzwFlif8ATwGdhPP1R3HnA5d/Aw8BM6lna4jNkVe9wNwP+uAvTAkdHEfuJ1zzPYZE3oJ/AXeAjcyDtsyY0MXfwGvgcvxR26TbUMXvwOPgAvRB2+NqaGLH4EHwJnY47eDVejiO+Bu6A0awTr0+iuUW4H3qB6v0EtgAewBV8NuUzGeoYs/WU39S0F3qpKI0MVZT/rI0MVZTvqM0MUDZjTpM0MvmdGkzw5d7H7SZwc+abeTPjvsJrub9NlB/+chnUz67JBDbX7SZwcc429Wk/6aSwlnsuNtY5OTPjvaFJua9NmxLGxi0mdHsvQAuGObx47sONZWO+mzw3hZ3aTPDuJtNZM+O0SUn0ie9NkBoj0E7pmUG0n2xbMMn/TZF850Abxi9TC+O9mXrcHnQ0JN/eG+nPj1PfCNAX9OcjbgIAKFtuBNxDfJ/vmY6QJ4AZyfXHEA2ZfNUi/vnNVgcVYT3Fm9qeSs3iZ1Vm/8B1j106nZcSzUL2ed1eMGzuoBGmf1SFiAesjR2W7+Ejc75Cb1ILqz1Uxma7LDFqubzNZkB652MluTGbnqyWxNRuAmJrM1kYGbmszWRAQuk/li0J2qxDOw/jHKGl6R94GbgfeoHuvA3Uxma6wCdzeZrZkauNvJbM22gbufzNaMDfyH1WS+nnHYlhn7SmI2k9maIYHfM8PJbM0RmwPPejJb84TTgfVhCg7ssHof4gj4gj4eRAghhBBCCCHa4x9lqG2ZWpUuLAAAAABJRU5ErkJggg=="/>
                        </defs>
                    </svg>
                {:else}
                    <svg class="small_icon" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg"
                        on:click={() => on = false}>
                        <rect width="90" height="90" fill="url(#pa1)"/>
                        <defs>
                        <pattern id="pa1" patternContentUnits="objectBoundingBox" width="1" height="1">
                        <use xlink:href="#ig1" transform="scale(0.0111111)"/>
                        </pattern>
                        <image id="ig1" width="90" height="90" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAABaCAYAAAA4qEECAAAABmJLR0QA/wD/AP+gvaeTAAABYElEQVR4nO3cMU7DUBAG4R8KnDuQIwZyKq5CSJXQcBDsHgoTicaJ5CyjhzOf5DKr3VHql0iSJEmSJOmcVZJtkn2SIcnXxDckeUvynKS7oX1KrJO8Z/qYqe/489ul71NilXlH/T6u8p/U2j5ltpl/1Ol7WvA+Zfa5/rDdgvcp0+f6w/ql7nNXNSjjYhWqdmpqn/uKIbrM0BBDQwwNMTTE0BBDQwwNMTTE0BBDQwwNMTTE0BBDQwwNMTTE0BBDQwwNMTTE0BBDQwwNMTTE0BBDQwwNMTTE0BBDQwwNMTTE0BBDQwwNMTTE0BBDQwwNMTTE0BBDQwwNMTTE0BBDQwwNMTTE0BBDQwwNMTSkMvRQMOOzYMZJU/tUhv5oZEblrLJ9KkO/NDKjclblPmW6jA+nzn018ZDkYcH7lFpn3nGHJI83sE+pLuMrtbucfx+0T/KaZJO//ee0to8kSZIkSdK/9w1v6ROP2rKdLQAAAABJRU5ErkJggg=="/>
                        </defs>
                    </svg>
                {/if}              
            </div>     
            <div>
                <div id="text">Messages sent: {n_mess}</div>
            </div>
        </div>


    </div>

    <figcaption id="caption">
        Gaussian Belief Propagation performs probabilistic inference iteratively and is convergent even when messages are passed randomly through the graph.
        Here GBP is applied to a geometric grid alignment problem.
        See an <a href="#gbp_intuition">interactive version</a> of this figure later in the article. 
    </figcaption>

</figure>
