<!-- 

TODO

 -->

<script>
    import { onMount } from 'svelte';
    import * as twgl from 'twgl.js';
	import ButtonGroup from '../utils/ButtonGroup.svelte'


    // Notes
    // Vertex shader code provides the clip space coordinates
    // gl_Position is a special variable a vertex shader is responsible for setting
    // gl_FragColor is a special variable a fragment shader is responsible for setting
    // When output is frameBuffer, samples are at in output pixel coordinates at centre of pixels (i.e. at [0.5, 0.5], etc..)
    // Belief buff State is [belief_eta, belief_lam, 0., 0.]
    // Message buff state is    [prior_eta, prior_lam, 0., 0.]
    //                          [mess_lhs_eta, mess_lhs_lam, mess_rhs_eta, mess_rhs_lam] 
    //                          [mess_above_eta, mess_above_lam, mess_below_eta, mess_below_lam]
    //                          [0., 0., 0., 0.]
    // Store everything in the covariance form so it is in range [0, 1]

    const vs_code = `
        attribute vec2 position;   // attribute recieves data from a bufferInfo. 2 triangles to form a rectangle [-1, 1]
        attribute vec2 texcoord;   // attribute recieves data from a bufferInfo. 2 triangles to form a rectangle [0, 1]

        varying vec2 v_texcoord;  // For varyings the values will be interpolated by the fragment shader

        void main () {
            gl_Position = vec4(position.xy * vec2(1, -1), 0, 1);  // Drawing in 2D, to point y axis down (canvas and clip have y axis in opposite directions)
            v_texcoord = texcoord; 
        }
    `

    const PREFIX = `
        precision highp float; 

        // UTILITY FUNCTIONS ---------------------------------------------------------------

        vec4 meanToRGBA(float mean) { return vec4(vec3(mean), 1.0); }
        float grey(vec4 colour) { return (colour.x + colour.y + colour.z) / 3.0; }
        vec4 greyscale(vec4 colour) { return vec4(vec3(grey(colour)), 1.); }

        vec2 zeroMessCovForm() { return vec2(0., 1.); }  // If covaraince == 1. then zero message flag
        vec2 infToCov(vec2 v) {  // To encode
            if ( all(equal(v, vec2(0.))) ) {  // If zero message
                return zeroMessCovForm();
            } else {
                return vec2(v.x/v.y, 1./v.y);
            }
        }
        vec2 covToInf(vec2 v) {  // To decode
            if ( all(equal(v, zeroMessCovForm())) ) {
                return vec2(0.);
            } else {
                return vec2(v.x/v.y, 1./v.y);
            }
        }

        void setOutput(vec2 mess) {
            gl_FragColor = vec4(mess, 0., 1.);
        }

        // TENSOR FUNCTIONS ----------------------------------------------------------------

        struct Tensor {
            vec2 size;
            vec2 gridSize;
        };

        vec2 XYtoUV(Tensor tensor, vec2 xy) {
            return xy / (tensor.size * tensor.gridSize);  // All element-wise
        }

        vec4 _read(Tensor tensor, sampler2D tex, vec2 xy) {
            return texture2D(tex, XYtoUV(tensor, xy));
        }

        // OUTPUT TENSOR FUNCTIONS ---------------------------

        uniform Tensor u_output;
        bool isPriorMess(vec2 xy) {  // If output is message buffer, check if at prior message
            return (mod(xy.x, u_output.gridSize.x) == 0.5);
        }

        // INPUT TENSOR FUNCTIONS ----------------------------

        uniform Tensor u_input;
        uniform sampler2D u_input_tex;
        vec4 u_input_read(vec2 xy) { 
            return _read(u_input, u_input_tex, xy); 
        }

        void direct_copy() {  // Copy input directly to output
            vec2 uv = gl_FragCoord.xy / (u_output.size * u_output.gridSize);  
            gl_FragColor = texture2D(u_input_tex, uv);
        }

        vec2 readInputMessInfForm(vec2 img_xy, int ix) {  // If input is message buffer
            vec2 mess_xy = vec2(floor(img_xy.x)*u_input.gridSize.x + 0.5 + float(ix), img_xy.y);

            vec4 v = u_input_read(mess_xy);
            return covToInf(v.xy);
        }
    `;

    const PROGRAMS = {
        vis_img: `
            varying vec2 v_texcoord; 

            void main() {
                gl_FragColor = greyscale(texture2D(u_input_tex, v_texcoord));
            }
        `,
        vis_mess: `
            varying vec2 v_texcoord;  // the texcoords passed in from the vertex shader
            void main() {
                gl_FragColor = texture2D(u_input_tex, v_texcoord);  
            }
        `,
        vis: `
            varying vec2 v_texcoord;  // the texcoords passed in from the vertex shader

            void main() {
                gl_FragColor = meanToRGBA(texture2D(u_input_tex, v_texcoord).x);  // Stored in cov form, so just access mean in first element
            }
        `,
        paint: `
            // Probably should be draw using triangles rather than using varying
            varying vec2 v_texcoord;  // the texcoords passed in from the vertex shader
            
            uniform vec2 u_mouse;  // in pixel coordinates
            uniform float u_radius;  // in pixels
            uniform float u_scaling;
            uniform vec4 u_color;

            void main() {
                vec2 diff = abs(u_mouse - gl_FragCoord.xy / u_scaling);
                if (length(diff) >= u_radius + 0.6) {
                    discard;
                }
                if (length(diff) <= u_radius - 0.6) {
                    discard;
                }
                gl_FragColor = u_color;
            }
        `,
        comp_mess: `
            uniform float u_smoothLam;
            uniform vec2 u_mouse;
            uniform float u_radius;

            uniform bool u_robust;
            uniform float u_prior_robust_thresh;
            uniform float u_smooth_robust_thresh;

            uniform float u_priorCov;

            // u_belief is passed as well as u_input which is previous messages
            uniform Tensor u_belief;
            uniform sampler2D u_belief_tex;
            vec2 readBeliefInfForm(vec2 xy) {  // Belief is first two components of vector
                return covToInf(_read(u_belief, u_belief_tex, xy).xy); 
            }
            float readBeliefMean(vec2 xy) {  // Belief is first two components of vector
                return _read(u_belief, u_belief_tex, xy).x; 
            }

            bool isLeftMess(vec2 xy) {
                return (mod(xy.x, u_output.gridSize.x) == 1.5);
            }
            bool isRightMess(vec2 xy) {
                return (mod(xy.x, u_output.gridSize.x) == 2.5);
            }
            bool isUpMess(vec2 xy) {
                return (mod(xy.x, u_output.gridSize.x) == 3.5);
            }
            bool isDownMess(vec2 xy) {
                return (mod(xy.x, u_output.gridSize.x) == 4.5);
            }

            void main() {
                vec2 xy = gl_FragCoord.xy;  // xy coordinates in output beliefBuf (img_xy)
                
                vec2 img_xy = floor(xy / u_output.gridSize) + vec2(0.5);
                vec2 diff = u_mouse - img_xy;
                
                if (length(diff) >= u_radius) {
                    direct_copy();
                }  else {

                    if (isPriorMess(xy)) {
                        float z = u_input_read(xy).z;
                        vec2 prior_mess = vec2(z / u_priorCov, 1./u_priorCov);
                        float res = abs(z - readBeliefMean(img_xy));  // residual
                        if (res > u_prior_robust_thresh && u_robust) {
                            prior_mess *= (2.0 * u_prior_robust_thresh / res - (u_prior_robust_thresh*u_prior_robust_thresh) / (res*res));
                        }
                        gl_FragColor = vec4(infToCov(prior_mess), z, 1.);

                    } else if (isLeftMess(xy)) {
                        vec2 img_xy_lhs = img_xy + vec2(-1., 0.);
                        vec2 other_mess_lhs = readBeliefInfForm(img_xy_lhs) - readInputMessInfForm(img_xy_lhs, 2);
                        vec2 mess_lhs = other_mess_lhs * u_smoothLam / (u_smoothLam + other_mess_lhs.y);
                        float res = abs(readBeliefMean(img_xy) - readBeliefMean(img_xy_lhs));
                        if (res > u_smooth_robust_thresh && u_robust) {
                            mess_lhs *= (2.0 * u_smooth_robust_thresh / res - (u_smooth_robust_thresh*u_smooth_robust_thresh) / (res*res));
                        }
                        if (img_xy_lhs.x < 0.) {  // Pixel on left border, so no message from lhs
                            mess_lhs = vec2(0.);
                        }
                        setOutput(infToCov(mess_lhs));                        

                    } else if (isRightMess(xy)) {
                        vec2 img_xy_rhs = img_xy + vec2(1., 0.);
                        vec2 other_mess_rhs = readBeliefInfForm(img_xy_rhs) - readInputMessInfForm(img_xy_rhs, 1);
                        vec2 mess_rhs = other_mess_rhs * u_smoothLam / (u_smoothLam + other_mess_rhs.y);
                        float res = abs(readBeliefMean(img_xy) - readBeliefMean(img_xy_rhs));
                        if (res > u_smooth_robust_thresh && u_robust) {
                            mess_rhs *= (2.0 * u_smooth_robust_thresh / res - (u_smooth_robust_thresh*u_smooth_robust_thresh) / (res*res));
                        }
                        if (img_xy_rhs.x > u_belief.size.x) {  // Pixel on right border, so no message from rhs
                            mess_rhs = vec2(0.);
                        }
                        setOutput(infToCov(mess_rhs));                        

                    } else if (isUpMess(xy)) {
                        vec2 img_xy_up = img_xy + vec2(0., -1.);
                        vec2 other_mess_up = readBeliefInfForm(img_xy_up) - readInputMessInfForm(img_xy_up, 4);
                        vec2 mess_up = other_mess_up * u_smoothLam / (u_smoothLam + other_mess_up.y);
                        float res = abs(readBeliefMean(img_xy) - readBeliefMean(img_xy_up));
                        if (res > u_smooth_robust_thresh && u_robust) {
                            mess_up *= (2.0 * u_smooth_robust_thresh / res - (u_smooth_robust_thresh*u_smooth_robust_thresh) / (res*res));
                        }
                        if (img_xy_up.y < 0.) {  // Pixel on top border, so no message from up
                            mess_up = vec2(0.);
                        }
                        setOutput(infToCov(mess_up));

                    } else if (isDownMess(xy)) {
                        vec2 img_xy_down = img_xy + vec2(0., 1);
                        vec2 other_mess_down = readBeliefInfForm(img_xy_down) - readInputMessInfForm(img_xy_down, 3);
                        vec2 mess_down = other_mess_down * u_smoothLam / (u_smoothLam + other_mess_down.y);
                        float res = abs(readBeliefMean(img_xy) - readBeliefMean(img_xy_down));
                        if (res > u_smooth_robust_thresh) {
                            mess_down *= (2.0 * u_smooth_robust_thresh / res - (u_smooth_robust_thresh*u_smooth_robust_thresh) / (res*res));
                        }
                        if (img_xy_down.y > u_belief.size.y) {  // Pixel on bottom border, so no message from down
                            mess_down = vec2(0.);
                        }
                        setOutput(infToCov(mess_down));

                    } else {
                        setOutput(zeroMessCovForm());
                    }
                }
            }
        `,
        update_belief: `

            void main() {
                // u_input is messageBuf, u_output is beliefBuf
                vec2 xy = gl_FragCoord.xy;  // xy coordinates in output beliefBuf (img_xy)
                vec2 newBelief = vec2(0.);
                for (int i=0; i<=4; ++i) {  // Take product of incoming messages
                    newBelief += readInputMessInfForm(xy, i);
                }                    
                setOutput(infToCov(newBelief));        
            }
        `,
        copy_state: `
            void main() {
                direct_copy();
            }
        `,
        init_priors_from_img: `
            uniform float u_priorCov;

            void main() {
                vec2 xy = gl_FragCoord.xy;  
                if (isPriorMess(xy)) {  // If prior pixel
                    vec2 uv = XYtoUV(u_output, xy);
                    float mean = grey(texture2D(u_input_tex, uv));  // Comes from image
                    vec2 prior_mess = vec2(mean, u_priorCov);
                    gl_FragColor = vec4(prior_mess, mean, 1.);
                    // setOutput(prior_mess);  // Store in covariance form
                } else {
                    setOutput(zeroMessCovForm());  // Set other messages to zero
                }
            }
        `,
    }
      


    const src = "./images/glasses2.png";

    let w, h;  // Image dimensions
    const scaling = 2;
    const width=600, height=600;  // Canvas size

    let canvas, gl;
    let mouse = { x:0., y:0. };  // Mouse position in canvas coordinates
    let original_img_tex;

    let priorLam = 1./0.003**2;
    let smoothLam = 1./0.002**2;
    let robust = true;
    const prior_robust_thresh = 1./255.;
    const smooth_robust_thresh = 2./255.;

    let radius_pix = 20;  // Radius of GBP around mouse in pixels

    let progs;

    let quadBufferInfo;
    let beliefBuf;
    let messageBufs = []; 
    let originalImgBuf;

    let lastTime = 0;

    let gbp_on = false;
    let clicked = false;

    let attention_on = false;

    let iter = 0;
    let iters_per_sec = 10;
    let lastIterTime = 0;



    onMount(() => {

        canvas = document.querySelector("#glCanvas");
        gl = canvas.getContext("webgl");

        var ext = gl.getExtension("OES_texture_float");
        if (!ext) {
            alert("this machine or browser does not support OES_texture_float");
        }   

        // Create programs
        progs = createPrograms();

        // Has attributes called normal, position and texcoord, with 3, 2 and 2 components
        // Has 6 elements for drawing two traingles over unit quad from [-1,1] in 2D
        quadBufferInfo = twgl.primitives.createXYQuadBufferInfo(gl);  

        // we're only using 1 texture so just make and bind it now
        original_img_tex = twgl.createTexture(
            gl, 
            {
                src: src, 
                minMag: gl.NEAREST,  // No interpolation, show pixels
            }, 
            function(err, original_img_tex, img) {
                startRendering(img);  // wait for the image to load because we need to know its size
            }
        );

    });

    function startRendering(img) {

        w = img.width, h = img.height;

        originalImgBuf = createTensor(w, h, 1);
        originalImgBuf.tex = original_img_tex;
        beliefBuf = createTensor(w, h, 1);
        let messageBuf1 = createTensor(w, h, 5);
        let messageBuf2 = createTensor(w, h, 5);
        messageBufs.push(messageBuf1);
        messageBufs.push(messageBuf2);

        requestAnimationFrame(render);
 
        // Read priors from image and update belief using priors
        runLayer('init_priors_from_img', messageBufs[0], {u_input: originalImgBuf, u_priorCov: 1/priorLam});  
        update_belief(0);
        draw();


        function render(time) {
            time *= 0.001;  // millisecondss to seconds
            lastTime = time;

            twgl.bindFramebufferInfo(gl);

            draw();

            if (gbp_on) {
                const interval = time - lastIterTime;
                if (interval > 1 / iters_per_sec) {
                    sync_iter(!attention_on);
                    lastIterTime = time;
                }
                if (attention_on) {
                    paintCircle();
                }
            }

            requestAnimationFrame(render);
        }
    }
    

    function createTensor(w, h, channels) {
        // Texture may need to be larger than wxh, then make grid larger and access grid carefully
        const gridW = channels;
        const gridH = 1;
        const texW = w * gridW, texH = h * gridH;      
        const attachments = [{ 
                minMag: gl.NEAREST,  // Do not interpolate between pixels when rendering to canvas
                type: gl.FLOAT,  // Requires OES_texture_float extension
            }];
        const fbi = twgl.createFramebufferInfo(gl, attachments, texW, texH);
        const tex = fbi.attachments[0];      
        return { _type: 'tensor', fbi, tex, w, h, gridW, gridH};
    }

    function createPrograms() {
        const res = {};
        for (const name in PROGRAMS) {
            const fs_code = PREFIX + PROGRAMS[name];
            res[name] = twgl.createProgramInfo(gl, [vs_code, fs_code]);
        }
        return res;
    }

    function setTensorUniforms(uniforms, name, tensor) {
        uniforms[name + '.size'] = [tensor.w, tensor.h];
        uniforms[name + '.gridSize'] = [tensor.gridW, tensor.gridH];
        if (name != 'u_output') {
            uniforms[name + '_tex'] = tensor.tex;
        }
    }

    function runLayer(programName, output, inputs) {
        inputs = inputs || {};
        const uniforms = {};
        for (const name in inputs) {
            const val = inputs[name];
            if (val._type == 'tensor') {
                setTensorUniforms(uniforms, name, val);
            } else {
                uniforms[name] = val;
            }
        }
        setTensorUniforms(uniforms, 'u_output', output);

        const program = progs[programName];
        twgl.bindFramebufferInfo(gl, output.fbi);
        gl.useProgram(program.program);
        twgl.setBuffersAndAttributes(gl, program, quadBufferInfo);
        twgl.setUniforms(program, uniforms);
        let type = gl.TRIANGLES; // gl.TRIANGLES means that each time the vertex shader is run 3 times, webgl will draw a traingle based on the 3 values for gl_Position
        twgl.drawBufferInfo(gl, quadBufferInfo, type); // Calls gl.drawElements or gl.drawArrays, whichever is appropriate
        return {programName, output}
    }

    // Operations ----------------------------------------------------

    function draw() {
        runLayer('vis', {}, {u_input: beliefBuf});  // null output frameBuffer so draws to canvas
    }

    function update_belief(mess_buff_ix) {
        runLayer('update_belief', beliefBuf, { u_input: messageBufs[mess_buff_ix] });
    }

    function compute_messages(all=false, old_mess_buff_ix, new_mess_buff_ix) {
        let radius = radius_pix;
        if (all) { radius = 10000; }
        const inputs = {
            u_input: messageBufs[old_mess_buff_ix], 
            u_belief: beliefBuf, 
            u_priorCov: 1/priorLam,
            u_smoothLam: smoothLam,
            u_mouse: canvasToPixelCoords(mouse.x, mouse.y),
            u_radius: radius,
            u_robust: robust,
            u_prior_robust_thresh: prior_robust_thresh,
            u_smooth_robust_thresh: smooth_robust_thresh,
        }
        runLayer('comp_mess', messageBufs[new_mess_buff_ix], inputs);
    }

    function sync_iter(all = false) {
        const old_mess_buff_ix = iter % 2, new_mess_buff_ix = (iter + 1) % 2;
        compute_messages(all, old_mess_buff_ix, new_mess_buff_ix);
        update_belief(new_mess_buff_ix);
        iter += 1;
    }

    function paintCircle() {
        var inputs = {
            u_mouse: canvasToPixelCoords(mouse.x, gl.canvas.height - mouse.y),  // in pixel coordinates
            u_radius: radius_pix,  // radius in pixels,
            u_scaling: scaling,
            u_color: [1.0, 0., 0.2, 0.9],
        };
        runLayer('paint', {}, inputs);
    }

    // Utility functions -----------------------------------------------------

    function canvasToPixelCoords(x_canvas, y_canvas) {
        const x = Math.floor(x_canvas / scaling);
        const y = Math.floor(y_canvas / scaling);
        return [x, y];
    }

    function benchmark() {
        console.log(Date.now());
        const stepN = 10000;
        const start = Date.now();
        for (let i = 0; i < stepN; ++i) 
            sync_iter(true);
        const total = (Date.now()-start) / stepN;
        const ops = {
            'update_belief': ()=>update_belief(0),
            'compute_messages': ()=>compute_messages(true, 0, 1),
            'paint_circle': ()=>paintCircle(),
            'draw': ()=>draw(),
        };
        const perOp = [];
        for (const name in ops) {
            const start = Date.now();
            let r;
            for (let i = 0; i < stepN; ++i) {
                r = ops[name]();
            }
            const dt = (Date.now()-start) / stepN;
            perOp.push(`${name}: ${dt.toFixed(4)} ms`);
        }
        return `${(total).toFixed(4)} ms/iter ${(1000.0 / total).toFixed(0)} iters/sec\n` + perOp.join(', ')+'\n\n';
    }

    function download_canvas(name) {
        draw();  // Must draw immediately before
        var link = document.createElement('a');
        link.download = name + '.png';
        link.href = canvas.toDataURL("img/png", 1)
        link.click();
        link.delete;
    }

    // Event handler functions ------------------------------------------------------

    function mousemove_handler(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        mouse.x = Math.min(Math.max(e.clientX - rect.x, 0), width);
        mouse.y = Math.min(Math.max(e.clientY - rect.y, 0), height);
    }

    function toggleGBP(e) {
        gbp_on = !gbp_on;
    }

	function handleChangeMP(e){
		attention_on = e.detail.value;
	}

	function handleChangeRobust(e){
		robust = e.detail.value;
	}

    function handle_click(e) {
        console.log(benchmark());
        clicked = true;
    }

</script>


<style>

    #glCanvas {
        /* border: 1px solid lightgrey; */
        image-rendering: pixelated;
        touch-action: none;
    }

    @media (min-width: 1000px) {
        #figure {
            grid-template-columns: 1fr 300px;
            grid-template-rows: auto auto;
        }
        /* #controls {
            grid-row: 1/2;
        } */
    }

    #controls {
        line-height: 1em;
        display: grid;
        grid-template-columns: 120px auto;
        grid-template-rows: auto 60px 80px 75px 1fr;
        row-gap: 20px;
        overflow: hidden;
    }


    @media (min-width: 1000px){
        #controls {
            grid-template-rows: auto 60px 80px 100px 1fr;
        }
    }

    #slider {
        width: 50%;
    }

    #switches {
        width: 100%;
        float: left;
    }

</style>


<figure class="subgrid" id="figure">
    <div id="wrapper" class="interactive-container">

        <canvas id="glCanvas" width="{width}" height="{height}" on:mouseenter={toggleGBP} 
            on:mouseleave={toggleGBP} on:mousemove={mousemove_handler} on:click={handle_click}></canvas>
        
        <div id="controls1">

            <div id="switches">
                <ButtonGroup options={[{ id: 0, name: 'All-to-all' }, { id: 1, name: 'Attention' }]} labelTitle="" selected={attention_on} on:change={handleChangeMP}/>
                <ButtonGroup options={[{ id: 0, name: 'Squared' }, { id: 1, name: 'Huber' }]} labelTitle="" selected={robust} on:change={handleChangeRobust}/>
            </div>

            <div id="sliders">
                <span>Iteration {iter}  Iters / s {iters_per_sec}</span>
                <input id="slider" type="range" min="0" max="20" bind:value={iters_per_sec} step="1"/>

                <br>
                <span>Prior lam {priorLam.toFixed(1)}</span>
                <input id="slider" type="range" min="{1/0.02**2}" max="{1/0.001**2}" bind:value={priorLam} step="1"/>

                <br>
                <span>Smoothness lam {smoothLam.toFixed(1)}</span>
                <input id="slider" type="range" min="{1/0.02**2}" max="{1/0.001**2}" bind:value={smoothLam} step="1"/>

                <br>
                <span>Attention radius (pixels) {radius_pix}</span>
                <input id="slider" type="range" min="{1}" max="{w/3}" bind:value={radius_pix} step="1"/>
            </div>

        </div>



    </div>
</figure>