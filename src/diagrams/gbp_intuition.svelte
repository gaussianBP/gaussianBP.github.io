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

    const eq1 = `
        \\tilde{m}_{t} = m_{t}^\\beta \\tilde{m}_{t-1}^{(1 - \\beta)}
    `
    const eq2 = `
        \\log \\tilde{m}_{t} = \\beta \\, \\log m_{t} + (1 - \\beta) \\, \\log \\tilde{m}_{t-1}
    `
    const eq3 = `
        \\tilde{\\eta}_{t} = \\beta \\, \\eta_{t} + (1 - \\beta) \\, \\tilde{\\eta}_{t-1} 
        \\;\\;\\; \\text{and} \\;\\;\\;
        \\tilde{\\Lambda}_{t} = \\beta \, \\Lambda_{t} + (1 - \\beta) \, \\tilde{\\Lambda}_{t-1} 
    `


    let value = 2;

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

    // Local graph variables
    let graph;
    $: var_nodes = [];
    $: factor_nodes = [];
    const damping = 0.7;  // Only for grid
    const dropout = 0.;  // Only for grid

    // Drag and drop function
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
    let show_batch = true;

    // Visual appearance
    let factor_size = 20;
    let radius = 10;
    let mean_radius = 8;

    // Preset initializations
    const chain_prior = {"0":{"eta":[100,300],"lam":1},"1":{"eta":[0.01980625,0.022881250000000002],"lam":0.0001},"2":{"eta":[0.02830625,0.039581250000000005],"lam":0.0001},"3":{"eta":[0.04020625,0.021181250000000002],"lam":0.0001},"4":{"eta":[0.05270625,0.03848125],"lam":0.0001}};
    const grid_prior = {"0":{"eta":[100,100],"lam":1},"1":{"eta":[0.024606250000000017,0.007181250000000011],"lam":0.0001},"2":{"eta":[0.05340625000000004,0.014781250000000003],"lam":0.0001},"3":{"eta":[0.005006250000000001,0.03498125],"lam":0.0001},"4":{"eta":[0.027306249999999997,0.03518125000000002],"lam":0.0001},"5":{"eta":[0.04500625,0.025081250000000006],"lam":0.0001},"6":{"eta":[0.015206250000000003,0.04338125000000001],"lam":0.0001},"7":{"eta":[0.034306250000000045,0.05538125],"lam":0.0001},"8":{"eta":[0.05020625000000001,0.04408125000000003],"lam":0.0001}};
    const loop_prior = {"0":{"eta":[100,100],"lam":1},"1":{"eta":[0.02500625,0.01588125],"lam":0.0001},"2":{"eta":[0.04320625,0.0069812500000000005],"lam":0.0001},"3":{"eta":[0.05150625,0.024081250000000002],"lam":0.0001},"4":{"eta":[0.044306250000000005,0.04178125],"lam":0.0001},"5":{"eta":[0.03210625,0.054081250000000004],"lam":0.0001},"6":{"eta":[0.01150625,0.04208125],"lam":0.0001},"7":{"eta":[0.00770625,0.02388125],"lam":0.0001}};

    // Colormaps
    const inferno = ["#000004","#010005","#010106","#010108","#02010a","#02020c","#02020e","#030210","#040312","#040314","#050417","#060419","#07051b","#08051d","#09061f","#0a0722","#0b0724","#0c0826","#0d0829","#0e092b","#10092d","#110a30","#120a32","#140b34","#150b37","#160b39","#180c3c","#190c3e","#1b0c41","#1c0c43","#1e0c45","#1f0c48","#210c4a","#230c4c","#240c4f","#260c51","#280b53","#290b55","#2b0b57","#2d0b59","#2f0a5b","#310a5c","#320a5e","#340a5f","#360961","#380962","#390963","#3b0964","#3d0965","#3e0966","#400a67","#420a68","#440a68","#450a69","#470b6a","#490b6a","#4a0c6b","#4c0c6b","#4d0d6c","#4f0d6c","#510e6c","#520e6d","#540f6d","#550f6d","#57106e","#59106e","#5a116e","#5c126e","#5d126e","#5f136e","#61136e","#62146e","#64156e","#65156e","#67166e","#69166e","#6a176e","#6c186e","#6d186e","#6f196e","#71196e","#721a6e","#741a6e","#751b6e","#771c6d","#781c6d","#7a1d6d","#7c1d6d","#7d1e6d","#7f1e6c","#801f6c","#82206c","#84206b","#85216b","#87216b","#88226a","#8a226a","#8c2369","#8d2369","#8f2469","#902568","#922568","#932667","#952667","#972766","#982766","#9a2865","#9b2964","#9d2964","#9f2a63","#a02a63","#a22b62","#a32c61","#a52c60","#a62d60","#a82e5f","#a92e5e","#ab2f5e","#ad305d","#ae305c","#b0315b","#b1325a","#b3325a","#b43359","#b63458","#b73557","#b93556","#ba3655","#bc3754","#bd3853","#bf3952","#c03a51","#c13a50","#c33b4f","#c43c4e","#c63d4d","#c73e4c","#c83f4b","#ca404a","#cb4149","#cc4248","#ce4347","#cf4446","#d04545","#d24644","#d34743","#d44842","#d54a41","#d74b3f","#d84c3e","#d94d3d","#da4e3c","#db503b","#dd513a","#de5238","#df5337","#e05536","#e15635","#e25734","#e35933","#e45a31","#e55c30","#e65d2f","#e75e2e","#e8602d","#e9612b","#ea632a","#eb6429","#eb6628","#ec6726","#ed6925","#ee6a24","#ef6c23","#ef6e21","#f06f20","#f1711f","#f1731d","#f2741c","#f3761b","#f37819","#f47918","#f57b17","#f57d15","#f67e14","#f68013","#f78212","#f78410","#f8850f","#f8870e","#f8890c","#f98b0b","#f98c0a","#f98e09","#fa9008","#fa9207","#fa9407","#fb9606","#fb9706","#fb9906","#fb9b06","#fb9d07","#fc9f07","#fca108","#fca309","#fca50a","#fca60c","#fca80d","#fcaa0f","#fcac11","#fcae12","#fcb014","#fcb216","#fcb418","#fbb61a","#fbb81d","#fbba1f","#fbbc21","#fbbe23","#fac026","#fac228","#fac42a","#fac62d","#f9c72f","#f9c932","#f9cb35","#f8cd37","#f8cf3a","#f7d13d","#f7d340","#f6d543","#f6d746","#f5d949","#f5db4c","#f4dd4f","#f4df53","#f4e156","#f3e35a","#f3e55d","#f2e661","#f2e865","#f2ea69","#f1ec6d","#f1ed71","#f1ef75","#f1f179","#f2f27d","#f2f482","#f3f586","#f3f68a","#f4f88e","#f5f992","#f6fa96","#f8fb9a","#f9fc9d","#fafda1","#fcffa4"];
    // const magma = ["#000004","#010005","#010106","#010108","#020109","#02020b","#02020d","#03030f","#030312","#040414","#050416","#060518","#06051a","#07061c","#08071e","#090720","#0a0822","#0b0924","#0c0926","#0d0a29","#0e0b2b","#100b2d","#110c2f","#120d31","#130d34","#140e36","#150e38","#160f3b","#180f3d","#19103f","#1a1042","#1c1044","#1d1147","#1e1149","#20114b","#21114e","#221150","#241253","#251255","#271258","#29115a","#2a115c","#2c115f","#2d1161","#2f1163","#311165","#331067","#341069","#36106b","#38106c","#390f6e","#3b0f70","#3d0f71","#3f0f72","#400f74","#420f75","#440f76","#451077","#471078","#491078","#4a1079","#4c117a","#4e117b","#4f127b","#51127c","#52137c","#54137d","#56147d","#57157e","#59157e","#5a167e","#5c167f","#5d177f","#5f187f","#601880","#621980","#641a80","#651a80","#671b80","#681c81","#6a1c81","#6b1d81","#6d1d81","#6e1e81","#701f81","#721f81","#732081","#752181","#762181","#782281","#792282","#7b2382","#7c2382","#7e2482","#802582","#812581","#832681","#842681","#862781","#882781","#892881","#8b2981","#8c2981","#8e2a81","#902a81","#912b81","#932b80","#942c80","#962c80","#982d80","#992d80","#9b2e7f","#9c2e7f","#9e2f7f","#a02f7f","#a1307e","#a3307e","#a5317e","#a6317d","#a8327d","#aa337d","#ab337c","#ad347c","#ae347b","#b0357b","#b2357b","#b3367a","#b5367a","#b73779","#b83779","#ba3878","#bc3978","#bd3977","#bf3a77","#c03a76","#c23b75","#c43c75","#c53c74","#c73d73","#c83e73","#ca3e72","#cc3f71","#cd4071","#cf4070","#d0416f","#d2426f","#d3436e","#d5446d","#d6456c","#d8456c","#d9466b","#db476a","#dc4869","#de4968","#df4a68","#e04c67","#e24d66","#e34e65","#e44f64","#e55064","#e75263","#e85362","#e95462","#ea5661","#eb5760","#ec5860","#ed5a5f","#ee5b5e","#ef5d5e","#f05f5e","#f1605d","#f2625d","#f2645c","#f3655c","#f4675c","#f4695c","#f56b5c","#f66c5c","#f66e5c","#f7705c","#f7725c","#f8745c","#f8765c","#f9785d","#f9795d","#f97b5d","#fa7d5e","#fa7f5e","#fa815f","#fb835f","#fb8560","#fb8761","#fc8961","#fc8a62","#fc8c63","#fc8e64","#fc9065","#fd9266","#fd9467","#fd9668","#fd9869","#fd9a6a","#fd9b6b","#fe9d6c","#fe9f6d","#fea16e","#fea36f","#fea571","#fea772","#fea973","#feaa74","#feac76","#feae77","#feb078","#feb27a","#feb47b","#feb67c","#feb77e","#feb97f","#febb81","#febd82","#febf84","#fec185","#fec287","#fec488","#fec68a","#fec88c","#feca8d","#fecc8f","#fecd90","#fecf92","#fed194","#fed395","#fed597","#fed799","#fed89a","#fdda9c","#fddc9e","#fddea0","#fde0a1","#fde2a3","#fde3a5","#fde5a7","#fde7a9","#fde9aa","#fdebac","#fcecae","#fceeb0","#fcf0b2","#fcf2b4","#fcf4b6","#fcf6b8","#fcf7b9","#fcf9bb","#fcfbbd","#fcfdbf"];
    const energies = makeArr(0, 7, 50);


    onMount(() => {
        load_priors("grid", grid_prior);
    });

    onInterval(() => {
        update_local_vars();
    }, 1000 / 30);

    function update_local_vars() {
        var_nodes = graph.var_nodes;
        factor_nodes = graph.factor_nodes;
        graph.compute_MAP();
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

    function oneSyncIter(e) {
        graph.send_messages();
        graph.update_beliefs(null, false);

        // Animations
        for (var i = 0; i < graph.factor_nodes.length; i++) {
            create_message_bubble(graph.factor_nodes[i].adj_ids[0], graph.factor_nodes[i].adj_ids[1]);
            create_message_bubble(graph.factor_nodes[i].adj_ids[1], graph.factor_nodes[i].adj_ids[0]);
        }
        for (var i = 0; i < graph.var_nodes.length; i++) {
            move_belief(graph.var_nodes[i].id);
        }
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

    function get_factor_loc(f) {
        // Factor is located at average position of variable nodes
        const x = (graph.find_node(f.adj_ids[0]).x + graph.find_node(f.adj_ids[1]).x) / 2;
        const y = (graph.find_node(f.adj_ids[0]).y + graph.find_node(f.adj_ids[1]).y) / 2;
        return [x, y];
    }

    function linear_progress(x, p) {
        return x.start + (x.end - x.start)*p;
    }

    function scale1(x) {
        return Math.log(40*x + 1)
    }
    function scale2(x) {
        return Math.log(5*x + 1)
    }

    function get_color(energy, max_energy=7, scale=scale1, nshades=256) {
        const ix = Math.min(Math.round(scale(energy) / scale(max_energy) * nshades), nshades - 1);
        return inferno[ix];
    }

    function makeArr(startValue, stopValue, cardinality) {
        var arr = [];
        var step = (stopValue - startValue) / (cardinality - 1);
        for (var i = 0; i < cardinality; i++) {
            arr.push(startValue + (step * i));
        }
        return arr;
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
        grid-template-rows: auto auto auto;
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
        /* display: grid;
        grid-template-columns: 1fr 2fr 1fr; */
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

        <div class="central">
            <button on:click={randomMessage}>
                Random message
            </button>  
            <button on:click={oneSyncIter}> 
                Synchronous iteration
            </button>
        </div>

        <svg id="svg" width="800" height="720" viewBox="-100 -45 800 720" xmlns="http://www.w3.org/2000/svg" on:click={play_click_handler}>

            <defs>
                <radialGradient id="belief_covariance_gradient">
                    <stop offset="0.35" stop-color="#0095DD" stop-opacity="0.5" />
                    <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
                </radialGradient>
                <radialGradient id="gt_cov_gradient">
                    <stop offset="0.35" stop-color="blue" stop-opacity="0.5" />
                    <stop offset="1" stop-color="#D3D3D3" stop-opacity="0.25" />
                </radialGradient>
                <linearGradient id="colorbar_legend"  x1="0%" y1="100%" x2="0%" y2="0%">
                    {#each energies as e, i}
                        <stop offset="{i/50}" stop-color={get_color(e, 7, scale2)}/>
                    {/each}
                </linearGradient>
            </defs>


            <ellipse class="gt-cov" fill="url(#gt_cov_gradient)" cx={-73} cy={-12} rx={25} ry={25}/>
            <circle class="gt-mean" cx={-73} cy={-12} r={6}/>
            <ellipse class="belief-cov" fill="url(#belief_covariance_gradient)" cx={-73} cy={45} rx={25} ry={25}/>
            <circle class="belief-mean" cx={-73} cy={45} r={6}/>
            <text fill="black" font-size="20px" x={-44} y={52}>Belief</text>
            <text fill="black" font-size="20px" x={-44} y={-4}>True marginal</text>

            <rect stroke="black" fill="url(#colorbar_legend)" x={-98} y={460} width={25} height={200}/>
            <path transform="translate(-66, 540)" d="M13.0607 0.93934C12.4749 0.353553 11.5251 0.353553 10.9393 0.93934L1.3934 10.4853C0.807614 11.0711 0.807614 12.0208 1.3934 12.6066C1.97919 13.1924 2.92893 13.1924 3.51472 12.6066L12 4.12132L20.4853 12.6066C21.0711 13.1924 22.0208 13.1924 22.6066 12.6066C23.1924 12.0208 23.1924 11.0711 22.6066 10.4853L13.0607 0.93934ZM13.5 66L13.5 2L10.5 2L10.5 66L13.5 66Z" fill="black"/>
            <text fill="black" font-size="20px" x={-64} y={635}>Factor</text>
            <text fill="black" font-size="20px" x={-64} y={657}>Energy</text>

            {#each factor_nodes as f}
                {#if moving_beliefs.map(x => x.id).includes(f.adj_ids[0]) && moving_beliefs.map(x => x.id).includes(f.adj_ids[1])}
                    <line stroke-width="4"
                        stroke={get_color(linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[0])[f.id], $move_belief_progress))}
                        x1={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[0]).x, $move_belief_progress)} 
                        y1={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[0]).y, $move_belief_progress)}
                        x2={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[1]).x, $move_belief_progress)} 
                        y2={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[1]).y, $move_belief_progress)}/>                    
                {:else if moving_beliefs.map(x => x.id).includes(f.adj_ids[0])}
                    <line stroke-width="4"
                        stroke={get_color(linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[0])[f.id], $move_belief_progress))}
                        x1={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[0]).x, $move_belief_progress)} 
                        y1={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[0]).y, $move_belief_progress)}
                        x2={graph.find_node(f.adj_ids[1]).belief_ellipse.cx} 
                        y2={graph.find_node(f.adj_ids[1]).belief_ellipse.cy}/>
                {:else if moving_beliefs.map(x => x.id).includes(f.adj_ids[1])}
                    <line stroke-width="4"
                        stroke={get_color(linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[1])[f.id], $move_belief_progress))}
                        x2={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[1]).x, $move_belief_progress)} 
                        y2={linear_progress(moving_beliefs.find(x => x.id == f.adj_ids[1]).y, $move_belief_progress)}
                        x1={graph.find_node(f.adj_ids[0]).belief_ellipse.cx} y1={graph.find_node(f.adj_ids[0]).belief_ellipse.cy}/>
                {:else}
                    <line stroke={get_color(f.energy())} stroke-width="4"
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
                    <g class="node_g" id={n.id} cursor="pointer" draggable="true">
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

        <div id="graph-panel">
            <svg id="reset-svg" width="42" height="43" viewBox="0 0 42 43" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <rect class="clickable" on:click={reset} x="0.196075" y="0.784302" width="41.7647" height="41.7647" fill="url(#reset_pattern)"/>
                <defs>
                <pattern id="reset_pattern" patternContentUnits="objectBoundingBox" width="1" height="1">
                    <use xlink:href="#imag0" transform="scale(0.0111111)"/>
                </pattern>
                <image id="imag0" width="90" height="90" xlink:href="data:image/png;base64,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"/>
                </defs>
            </svg>
            
            <MultiButtonGroup options={[{ id: 0, name: "Chain" }, { id: 1, name: "Loop" }, { id: 2, name: "Grid" }]} 
                on:change={handleChangeGraph} labelTitle="" selected={value}/>

        </div>

    </div>

    <figcaption id="caption">
        Send messages by clicking on a variable node or by pressing the random or synchronous message buttons at the top.
        Choose from 3 different graphs with increasing "loopiness": chain, loop and grid.
        All problems are anchored by a variable node in the top left with a strong prior that sets the absolute position - this is necessary as all other factors only constrain relative position.
        All factors are binary constraints (i.e. they connect two variable nodes) and we do not draw the factor nodes but instead draw an edge connecting the two variable nodes whose colour represents the factor energy.
        We employ message damping for the grid 
        <d-footnote>
          Message damping is commonly used to speed up and improve chances of convergence in very loopy graphs, such as the grid problem. 
          Message damping both empirically <d-cite key="Murphy:etal:1999"></d-cite> and theoretically <d-cite key="su2015convergence"></d-cite> improves convergence without affecting the fixed points of GBP <d-cite key="Murphy:etal:1999"></d-cite>.
          The idea behind message damping is to use momentum to reduce chances of oscillation by replacing the message at time $t$ with a combination of the message at time $t$ and time $t-1$:
          <d-math block="">
            {eq1}
            ~,
          </d-math>
          which is a weighted sum in log-space:
          <d-math block="">
            {eq2}
            ~.
          </d-math>

          Standard BP is recovered when the damping parameter $\beta = 1$ and $\beta = 0$ corresponds to not updating the message and sending the message from the previous iteration.
          Message damping can be applied to both the variable-to-factor messages and factor-to-variable messages, however we find that applying it just to factor-to-variable messages is sufficient.
          For GBP, message damping corresponds to damping the information vector and precision matrix as a weighted sum: 
          <d-math block="">
            {eq3}
            ~.
          </d-math>
        </d-footnote>.
    </figcaption>

</figure>
