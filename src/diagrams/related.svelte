<script>

    let comment1 = false;
    let comment2 = false;
    let comment3 = false;

</script>

<style>

    #wrapper {
        /* grid-column: page;
        max-width: calc(100vw - 2em); */
    }

    #caption {
        text-align: left;
        /* grid-column: page; */
    }

    .hidden {
        display: none;
    }

    .hoverable {
        cursor: pointer;
    }

    .parallel {
        color: #058219;
        fill: #058219;
    }

</style>


<figure class="subgrid" id="figure">

    <div id="wrapper" class="interactive-container">

        <svg width="780" height="370" viewBox="0 0 780 370" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text id="MAP Inference" fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="16" font-weight="bold" letter-spacing="0em"><tspan x="170" y="14.9688">MAP Inference</tspan></text>
            <text id="Marginal Inference" fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="16" font-weight="bold" letter-spacing="0em"><tspan x="469" y="14.9688">Marginal Inference</tspan></text>
            <g id="Gaussian elimination / LU decomposition QR decomposition Cholesky decomposition">
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="291.164" y="77.9434"> / </tspan><tspan x="170" y="92.9434">&#10;</tspan><tspan x="170" y="122.943">&#10;</tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="170" y="137.943"><a href="https://en.wikipedia.org/wiki/Cholesky_decomposition">Cholesky decomposition&#10;</a></tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="170" y="107.943"><a href="https://en.wikipedia.org/wiki/QR_decomposition">QR decomposition&#10;</a></tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="302.971" y="77.9434"><a href="https://en.wikipedia.org/wiki/LU_decomposition">LU  decomposition&#10;</a></tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="170" y="77.9434"><a href="https://en.wikipedia.org/wiki/Gaussian_elimination">Gaussian elimination</a></tspan></text>
            </g>
            <text id="Compute , then take Can use any of the decomposition methods on the left to invert ." fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="469" y="76.9434">Compute         , then take &#10;</tspan><tspan x="469" y="91.9434">&#10;</tspan><tspan x="469" y="106.943">Can use any of the decomposition </tspan><tspan x="469" y="121.943">methods on the left to invert     .</tspan></text>
            <g id="page1">
            <path id="Vector" d="M529.932 75.5845C529.435 76.4225 528.952 76.7066 528.27 76.7492C528.114 76.7634 528 76.7634 528 77.019C528 77.1043 528.071 77.1611 528.17 77.1611C528.426 77.1611 529.065 77.1327 529.321 77.1327C529.733 77.1327 530.187 77.1611 530.585 77.1611C530.67 77.1611 530.841 77.1611 530.841 76.8912C530.841 76.7634 530.727 76.7492 530.642 76.7492C530.315 76.7208 530.045 76.6071 530.045 76.2663C530.045 76.0674 530.13 75.9112 530.315 75.5987L531.395 73.8091H535.016C535.031 73.937 535.031 74.0506 535.045 74.1784C535.087 74.5477 535.258 76.0248 535.258 76.2947C535.258 76.7208 534.533 76.7492 534.306 76.7492C534.15 76.7492 533.994 76.7492 533.994 77.0048C533.994 77.1611 534.122 77.1611 534.207 77.1611C534.448 77.1611 534.732 77.1327 534.974 77.1327H535.783C536.65 77.1327 537.275 77.1611 537.289 77.1611C537.388 77.1611 537.544 77.1611 537.544 76.8912C537.544 76.7492 537.417 76.7492 537.204 76.7492C536.422 76.7492 536.408 76.6213 536.366 76.1953L535.499 67.3325C535.471 67.0484 535.414 67.02 535.258 67.02C535.116 67.02 535.031 67.0484 534.903 67.2615L529.932 75.5845ZM531.636 73.3972L534.491 68.625L534.974 73.3972H531.636Z" fill="black"/>
            <path id="Vector_2" d="M544.561 69.1473C544.713 69.1473 544.921 69.1473 544.921 68.9295C544.921 68.7117 544.713 68.7117 544.561 68.7117H539.136C538.984 68.7117 538.776 68.7117 538.776 68.9295C538.776 69.1473 538.984 69.1473 539.136 69.1473H544.561Z" fill="black"/>
            <path id="Vector_3" d="M548.741 65.2651C548.741 65.0095 548.722 65 548.466 65C548.078 65.3788 547.576 65.606 546.676 65.606V65.9185C546.932 65.9185 547.443 65.9185 547.993 65.6628V70.5203C547.993 70.8706 547.964 70.9843 547.065 70.9843H546.733V71.2967C547.121 71.2683 547.936 71.2683 548.362 71.2683C548.788 71.2683 549.612 71.2683 550 71.2967V70.9843H549.669C548.769 70.9843 548.741 70.8706 548.741 70.5203V65.2651Z" fill="black"/>
            </g>
            <g id="Gradient descent Conjugate gradient method Successive over relaxation Jacobi method Gauss-Seidel method">
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="173" y="217.943">&#10;</tspan><tspan x="173" y="247.943">&#10;</tspan><tspan x="173" y="277.943">&#10;</tspan><tspan x="173" y="337.943">&#10;</tspan></text>
            <text fill="#00BF1F" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="173" y="307.943">&#10;</tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="173" y="262.943"><a href="https://en.wikipedia.org/wiki/Conjugate_gradient_method">Conjugate gradient method&#10;</a></tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="173" y="292.943"><a href="https://en.wikipedia.org/wiki/Successive_over-relaxation">Successive over relaxation&#10;</a></tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="173" y="352.943"><a href="https://en.wikipedia.org/wiki/Gauss%E2%80%93Seidel_method">Gauss-Seidel method&#10;</a></tspan></text>
            <a href="https://en.wikipedia.org/wiki/Jacobi_method">
                <text fill="#058219" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="173" y="322.943">Jacobi method&#10;</tspan></text>
            </a>
            <a target="_" href="https://en.wikipedia.org/wiki/Gradient_descent#Solution_of_a_linear_system">
                <text fill="#058219" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="173" y="232.943">Gradient descent</tspan></text>
            </a>
            </g>
            <g id="Iterative methods">
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="16" letter-spacing="0em"><tspan x="126.375" y="232.969">  </tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="16" font-weight="bold" letter-spacing="0em"><tspan x="0" y="232.969">Iterative methods</tspan></text>
            </g>
            <g id="Gaussian Belief Propagation Expectation propagation (EP) Barfoot 2020">
            <text fill="#BFAC00" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="475" y="247.943">&#10;</tspan></text>
            <text fill="#00BF1F" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="475" y="307.943">&#10;</tspan></text>
            <text fill="#058219" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" font-weight="bold" letter-spacing="0em"><tspan x="475" y="232.943">Gaussian Belief Propagation&#10;</tspan></text>
            <text fill="#E56717" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="475" y="277.943">&#10;</tspan></text>
            <text fill="#058219" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="616.121" y="262.943"> (EP) &#10;</tspan></text>
            <a href="https://arxiv.org/abs/1412.4869">
                <text fill="#058219" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="475" y="262.943">Expectation propagation</tspan></text>
            </a>
            <a href="https://arxiv.org/abs/2010.08022">
                <text fill="#058219" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="475" y="292.943">Barfoot 2020&#10;</tspan></text>
            </a>
            </g>
            <g id="Node-wise parallel KL: variational inference">
            <text fill="#058219" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="1" y="19.9434">Node-wise parallel&#10;</tspan><tspan x="19.5098" y="34.9434"> </tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="82.8721" y="34.9434"> </tspan></text>
            <text fill="#E56717" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="16.3613" y="34.9434">:</tspan><tspan x="22.7344" y="34.9434">variational</tspan><tspan x="86.0967" y="34.9434">inference&#10;</tspan></text>
            <text fill="#E56717" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" font-weight="900" letter-spacing="0em"><tspan x="1" y="34.9434">KL</tspan></text>
            </g>
            <g id="Direct methods">
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="16" letter-spacing="0em"><tspan x="109.906" y="79.9688"> </tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="16" font-weight="bold" letter-spacing="0em"><tspan x="0" y="79.9688">Direct methods</tspan></text>
            </g>
            <text id="Computes an exact solution in a fixed number of steps." fill="black" fill-opacity="0.71" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="0" y="97.9434">Computes an exact </tspan><tspan x="0" y="112.943">solution in a fixed </tspan><tspan x="0" y="127.943">number of steps.</tspan></text>
            <text id="Solves for without inverting" fill="black" fill-opacity="0.71" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="170" y="34.9434">Solves for     without inverting </tspan></text>
            <text id="Solves for and diagonal elements of" fill="black" fill-opacity="0.71" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="469" y="34.9434">Solves for     and diagonal elements of </tspan></text>
            <g id="page1_2">
            <path id="Vector_4" d="M538.342 28.5122C537.815 28.6053 537.617 28.9778 537.617 29.2727C537.617 29.6452 537.93 29.7694 538.16 29.7694C538.654 29.7694 539 29.3659 539 28.9468C539 28.2949 538.21 28 537.519 28C536.514 28 535.955 28.9313 535.807 29.2262C535.428 28.0621 534.407 28 534.111 28C532.432 28 531.543 30.0333 531.543 30.3747C531.543 30.4368 531.609 30.5144 531.724 30.5144C531.856 30.5144 531.889 30.4213 531.922 30.3592C532.481 28.6364 533.584 28.3104 534.062 28.3104C534.802 28.3104 534.951 28.9623 534.951 29.3348C534.951 29.6763 534.852 30.0333 534.654 30.7783L534.095 32.9047C533.848 33.8359 533.37 34.6896 532.498 34.6896C532.416 34.6896 532.004 34.6896 531.658 34.4878C532.251 34.3792 532.383 33.9135 532.383 33.7273C532.383 33.4169 532.136 33.2306 531.823 33.2306C531.428 33.2306 531 33.5565 531 34.0532C531 34.7051 531.774 35 532.481 35C533.272 35 533.831 34.4102 534.177 33.7738C534.44 34.6896 535.263 35 535.872 35C537.551 35 538.44 32.9667 538.44 32.6253C538.44 32.5477 538.374 32.4856 538.276 32.4856C538.128 32.4856 538.111 32.5632 538.062 32.6874C537.617 34.0532 536.663 34.6896 535.922 34.6896C535.346 34.6896 535.033 34.286 535.033 33.6497C535.033 33.3082 535.099 33.0599 535.362 32.0355L535.938 29.9246C536.185 28.9933 536.745 28.3104 537.502 28.3104C537.535 28.3104 537.996 28.3104 538.342 28.5122Z" fill="black" fill-opacity="0.71"/>
            </g>
            <text id="Converges to the solution from an initial estimate over many steps." fill="black" fill-opacity="0.71" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="0" y="252.943">Converges to the </tspan><tspan x="0" y="267.943">solution from an initial </tspan><tspan x="0" y="282.943">estimate over many </tspan><tspan x="0" y="297.943">steps.</tspan></text>
            <g id="grid">
            <line id="Line 1" y1="53.5" x2="775" y2="53.5" stroke="#A6A6A6"/>
            <line id="Line 2" x1="148.5" y1="2.10174e-08" x2="148.5" y2="365" stroke="#A6A6A6"/>
            </g>
            <g id="comment2">
            <path id="Vector 2" d="M673 231C686 231.678 712 235.375 712 244.737C712 254.098 686 258.813 673 260" stroke="#A6A6A6" stroke-width="2"/>
            <circle class="hoverable" on:mouseover={() => (comment2=true)} on:mouseout={() => (comment2=false)} id="Ellipse 2" cx="711.5" cy="245.5" r="11.5" fill="#A6A6A6"/>
            <text class:hidden={!comment2} id="GBP can be seen as a special case of EP." fill="black" fill-opacity="0.6" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="12" letter-spacing="0em"><tspan x="669" y="210.102">GBP can be seen as </tspan><tspan x="669" y="224.102">a special case of EP.</tspan></text>
            </g>
            <g id="comment1">
            <path id="Vector 1" d="M271 321C294.167 316.5 360.811 312.486 390 276C416 243.5 448.167 234.833 470 230" stroke="#A6A6A6" stroke-width="2"/>
            <circle class="hoverable" on:mouseover={() => (comment1=true)} on:mouseout={() => (comment1=false)} id="Ellipse 1" cx="389.5" cy="275.5" r="11.5" fill="#A6A6A6"/>
            <text class:hidden={!comment1} id="Ignoring the covariance updates, and with a specific schedule, GBP is equivalent to the Jacobi and Gauss-Seidel methods." fill="black" fill-opacity="0.6" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="12" letter-spacing="0em"><tspan x="302" y="188.102">Ignoring the covariance updates, </tspan><tspan x="302" y="202.102">and with a specific schedule, </tspan><tspan x="302" y="216.102">GBP is equivalent to the Jacobi </tspan><tspan x="302" y="230.102">and Gauss-Seidel methods.</tspan></text>
            </g>
            <g id="comment3">
            <text class:hidden={!comment3} id="Barfoot&#226;&#128;&#153;s method involves extra communication edges and memory compared to GBP." fill="black" fill-opacity="0.6" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="12" letter-spacing="0em"><tspan x="614" y="286.102">Barfoot&#x2019;s method involves </tspan><tspan x="614" y="300.102">extra communication edges </tspan><tspan x="614" y="314.102">and memory compared to GBP.</tspan></text>
            <circle class="hoverable" on:mouseover={() => (comment3=true)} on:mouseout={() => (comment3=false)} id="Ellipse 2_2" cx="593.5" cy="287.5" r="11.5" fill="#A6A6A6"/>
            </g>
            <g id="page1_3">
            <path id="Vector_5" d="M239.342 28.5122C238.815 28.6053 238.617 28.9778 238.617 29.2727C238.617 29.6452 238.93 29.7694 239.16 29.7694C239.654 29.7694 240 29.3659 240 28.9468C240 28.2949 239.21 28 238.519 28C237.514 28 236.955 28.9313 236.807 29.2262C236.428 28.0621 235.407 28 235.111 28C233.432 28 232.543 30.0333 232.543 30.3747C232.543 30.4368 232.609 30.5144 232.724 30.5144C232.856 30.5144 232.889 30.4213 232.922 30.3592C233.481 28.6364 234.584 28.3104 235.062 28.3104C235.802 28.3104 235.951 28.9623 235.951 29.3348C235.951 29.6763 235.852 30.0333 235.654 30.7783L235.095 32.9047C234.848 33.8359 234.37 34.6896 233.498 34.6896C233.416 34.6896 233.004 34.6896 232.658 34.4878C233.251 34.3792 233.383 33.9135 233.383 33.7273C233.383 33.4169 233.136 33.2306 232.823 33.2306C232.428 33.2306 232 33.5565 232 34.0532C232 34.7051 232.774 35 233.481 35C234.272 35 234.831 34.4102 235.177 33.7738C235.44 34.6896 236.263 35 236.872 35C238.551 35 239.44 32.9667 239.44 32.6253C239.44 32.5477 239.374 32.4856 239.276 32.4856C239.128 32.4856 239.111 32.5632 239.062 32.6874C238.617 34.0532 237.663 34.6896 236.922 34.6896C236.346 34.6896 236.033 34.286 236.033 33.6497C236.033 33.3082 236.099 33.0599 236.362 32.0355L236.938 29.9246C237.185 28.9933 237.745 28.3104 238.502 28.3104C238.535 28.3104 238.996 28.3104 239.342 28.5122Z" fill="black" fill-opacity="0.71"/>
            </g>
            <g id="page1_4">
            <path id="Vector_6" d="M344.837 33.1461C344.364 33.9432 343.905 34.2134 343.257 34.2539C343.108 34.2674 343 34.2674 343 34.5106C343 34.5916 343.068 34.6457 343.162 34.6457C343.405 34.6457 344.013 34.6187 344.256 34.6187C344.648 34.6187 345.08 34.6457 345.459 34.6457C345.54 34.6457 345.702 34.6457 345.702 34.389C345.702 34.2674 345.594 34.2539 345.513 34.2539C345.202 34.2269 344.945 34.1188 344.945 33.7946C344.945 33.6054 345.026 33.4568 345.202 33.1596L346.229 31.4575H349.674C349.687 31.579 349.687 31.6871 349.701 31.8087C349.741 32.1599 349.903 33.5649 349.903 33.8216C349.903 34.2269 349.214 34.2539 348.998 34.2539C348.85 34.2539 348.701 34.2539 348.701 34.4971C348.701 34.6457 348.823 34.6457 348.904 34.6457C349.133 34.6457 349.403 34.6187 349.633 34.6187H350.403C351.227 34.6187 351.822 34.6457 351.835 34.6457C351.93 34.6457 352.078 34.6457 352.078 34.389C352.078 34.2539 351.957 34.2539 351.754 34.2539C351.011 34.2539 350.998 34.1323 350.957 33.727L350.133 25.2972C350.106 25.027 350.052 25 349.903 25C349.768 25 349.687 25.027 349.566 25.2297L344.837 33.1461ZM346.458 31.0657L349.174 26.5266L349.633 31.0657H346.458Z" fill="black" fill-opacity="0.71"/>
            </g>
            <g id="page1_5">
            <path id="Vector_7" d="M637.814 119.871C637.242 120.836 636.685 121.164 635.899 121.213C635.719 121.229 635.588 121.229 635.588 121.524C635.588 121.622 635.67 121.687 635.785 121.687C636.079 121.687 636.816 121.655 637.111 121.655C637.585 121.655 638.109 121.687 638.567 121.687C638.666 121.687 638.862 121.687 638.862 121.376C638.862 121.229 638.731 121.213 638.633 121.213C638.256 121.18 637.945 121.049 637.945 120.656C637.945 120.427 638.044 120.247 638.256 119.887L639.5 117.824H643.675C643.691 117.972 643.691 118.103 643.707 118.25C643.756 118.676 643.953 120.378 643.953 120.689C643.953 121.18 643.118 121.213 642.856 121.213C642.676 121.213 642.496 121.213 642.496 121.507C642.496 121.687 642.643 121.687 642.742 121.687C643.02 121.687 643.347 121.655 643.625 121.655H644.558C645.557 121.655 646.277 121.687 646.294 121.687C646.408 121.687 646.588 121.687 646.588 121.376C646.588 121.213 646.441 121.213 646.195 121.213C645.295 121.213 645.279 121.065 645.23 120.574L644.231 110.36C644.198 110.033 644.133 110 643.953 110C643.789 110 643.691 110.033 643.544 110.278L637.814 119.871ZM639.779 117.35L643.069 111.85L643.625 117.35H639.779Z" fill="black"/>
            </g>
            <g id="page1_6">
            <path id="Vector_8" d="M693.932 33.2875C693.435 34.1255 692.952 34.4096 692.27 34.4522C692.114 34.4664 692 34.4664 692 34.722C692 34.8072 692.071 34.8641 692.17 34.8641C692.426 34.8641 693.065 34.8356 693.321 34.8356C693.733 34.8356 694.187 34.8641 694.585 34.8641C694.67 34.8641 694.841 34.8641 694.841 34.5942C694.841 34.4664 694.727 34.4522 694.642 34.4522C694.315 34.4238 694.045 34.3101 694.045 33.9693C694.045 33.7704 694.13 33.6142 694.315 33.3017L695.395 31.5121H699.016C699.031 31.6399 699.031 31.7536 699.045 31.8814C699.087 32.2507 699.258 33.7278 699.258 33.9977C699.258 34.4238 698.533 34.4522 698.306 34.4522C698.15 34.4522 697.994 34.4522 697.994 34.7078C697.994 34.8641 698.122 34.8641 698.207 34.8641C698.448 34.8641 698.732 34.8356 698.974 34.8356H699.783C700.65 34.8356 701.275 34.8641 701.289 34.8641C701.388 34.8641 701.544 34.8641 701.544 34.5942C701.544 34.4522 701.417 34.4522 701.204 34.4522C700.422 34.4522 700.408 34.3243 700.366 33.8982L699.499 25.0355C699.471 24.7514 699.414 24.723 699.258 24.723C699.116 24.723 699.031 24.7514 698.903 24.9645L693.932 33.2875ZM695.636 31.1002L698.491 26.328L698.974 31.1002H695.636Z" fill="black" fill-opacity="0.71"/>
            <path id="Vector_9" d="M708.561 26.8503C708.713 26.8503 708.921 26.8503 708.921 26.6325C708.921 26.4147 708.713 26.4147 708.561 26.4147H703.136C702.984 26.4147 702.776 26.4147 702.776 26.6325C702.776 26.8503 702.984 26.8503 703.136 26.8503H708.561Z" fill="black" fill-opacity="0.71"/>
            <path id="Vector_10" d="M712.741 22.9681C712.741 22.7125 712.722 22.703 712.466 22.703C712.078 23.0817 711.576 23.309 710.676 23.309V23.6215C710.932 23.6215 711.443 23.6215 711.993 23.3658V28.2233C711.993 28.5736 711.964 28.6872 711.065 28.6872H710.733V28.9997C711.121 28.9713 711.936 28.9713 712.362 28.9713C712.788 28.9713 713.612 28.9713 714 28.9997V28.6872H713.669C712.769 28.6872 712.741 28.5736 712.741 28.2233V22.9681Z" fill="black" fill-opacity="0.71"/>
            </g>
            <g id="page1_7">
            <path id="Vector_11" d="M621.025 71.0552C620.593 71.1363 620.431 71.4605 620.431 71.7172C620.431 72.0414 620.687 72.1495 620.877 72.1495C621.282 72.1495 621.566 71.7982 621.566 71.4335C621.566 70.8661 620.917 70.6094 620.35 70.6094C619.526 70.6094 619.066 71.42 618.945 71.6766C618.634 70.6634 617.796 70.6094 617.553 70.6094C616.175 70.6094 615.446 72.3791 615.446 72.6763C615.446 72.7304 615.5 72.7979 615.594 72.7979C615.702 72.7979 615.73 72.7169 615.757 72.6628C616.216 71.1633 617.121 70.8796 617.513 70.8796C618.121 70.8796 618.242 71.447 618.242 71.7712C618.242 72.0684 618.161 72.3791 617.999 73.0276L617.54 74.8784C617.337 75.6889 616.945 76.4319 616.229 76.4319C616.162 76.4319 615.824 76.4319 615.54 76.2563C616.027 76.1617 616.135 75.7565 616.135 75.5944C616.135 75.3242 615.932 75.1621 615.675 75.1621C615.351 75.1621 615 75.4457 615 75.878C615 76.4454 615.635 76.7021 616.216 76.7021C616.864 76.7021 617.324 76.1888 617.607 75.6349C617.823 76.4319 618.499 76.7021 618.999 76.7021C620.377 76.7021 621.106 74.9324 621.106 74.6352C621.106 74.5676 621.052 74.5136 620.971 74.5136C620.85 74.5136 620.836 74.5812 620.796 74.6892C620.431 75.878 619.647 76.4319 619.039 76.4319C618.566 76.4319 618.31 76.0807 618.31 75.5268C618.31 75.2296 618.364 75.0135 618.58 74.1218L619.053 72.2846C619.255 71.474 619.715 70.8796 620.336 70.8796C620.363 70.8796 620.741 70.8796 621.025 71.0552Z" fill="black"/>
            <path id="Vector_12" d="M635.01 72.19C635.199 72.19 635.442 72.19 635.442 71.9468C635.442 71.6902 635.213 71.6902 635.01 71.6902H627.053C626.864 71.6902 626.621 71.6902 626.621 71.9333C626.621 72.19 626.85 72.19 627.053 72.19H635.01ZM635.01 74.7027C635.199 74.7027 635.442 74.7027 635.442 74.4596C635.442 74.2029 635.213 74.2029 635.01 74.2029H627.053C626.864 74.2029 626.621 74.2029 626.621 74.4461C626.621 74.7027 626.85 74.7027 627.053 74.7027H635.01Z" fill="black"/>
            <path id="Vector_13" d="M642.229 75.0675C641.756 75.8645 641.296 76.1347 640.648 76.1753C640.499 76.1888 640.391 76.1888 640.391 76.4319C640.391 76.513 640.459 76.567 640.553 76.567C640.797 76.567 641.404 76.54 641.648 76.54C642.039 76.54 642.472 76.567 642.85 76.567C642.931 76.567 643.093 76.567 643.093 76.3103C643.093 76.1888 642.985 76.1753 642.904 76.1753C642.593 76.1482 642.337 76.0402 642.337 75.7159C642.337 75.5268 642.418 75.3782 642.593 75.081L643.62 73.3788H647.065C647.078 73.5004 647.078 73.6085 647.092 73.7301C647.132 74.0813 647.295 75.4863 647.295 75.743C647.295 76.1482 646.606 76.1753 646.389 76.1753C646.241 76.1753 646.092 76.1753 646.092 76.4184C646.092 76.567 646.214 76.567 646.295 76.567C646.524 76.567 646.795 76.54 647.024 76.54H647.794C648.618 76.54 649.213 76.567 649.226 76.567C649.321 76.567 649.47 76.567 649.47 76.3103C649.47 76.1753 649.348 76.1753 649.145 76.1753C648.402 76.1753 648.389 76.0537 648.348 75.6484L647.524 67.2186C647.497 66.9484 647.443 66.9214 647.295 66.9214C647.159 66.9214 647.078 66.9484 646.957 67.151L642.229 75.0675ZM643.85 72.987L646.565 68.4479L647.024 72.987H643.85Z" fill="black"/>
            <path id="Vector_14" d="M656.143 68.9447C656.288 68.9447 656.486 68.9447 656.486 68.7376C656.486 68.5304 656.288 68.5304 656.143 68.5304H650.983C650.839 68.5304 650.641 68.5304 650.641 68.7376C650.641 68.9447 650.839 68.9447 650.983 68.9447H656.143Z" fill="black"/>
            <path id="Vector_15" d="M660.119 65.2522C660.119 65.009 660.101 65 659.858 65C659.488 65.3602 659.011 65.5764 658.155 65.5764V65.8736C658.399 65.8736 658.885 65.8736 659.407 65.6304V70.2506C659.407 70.5839 659.38 70.6919 658.525 70.6919H658.209V70.9891C658.579 70.9621 659.353 70.9621 659.759 70.9621C660.164 70.9621 660.947 70.9621 661.317 70.9891V70.6919H661.001C660.146 70.6919 660.119 70.5839 660.119 70.2506V65.2522Z" fill="black"/>
            <path id="Vector_16" d="M665.759 67.5293C665.773 67.4753 665.8 67.3942 665.8 67.3267C665.8 67.1916 665.664 67.1916 665.637 67.1916C665.624 67.1916 665.138 67.2321 664.894 67.2591C664.665 67.2726 664.462 67.2996 664.219 67.3131C663.895 67.3402 663.8 67.3537 663.8 67.5968C663.8 67.7319 663.935 67.7319 664.07 67.7319C664.759 67.7319 664.759 67.8535 664.759 67.9886C664.759 68.0832 664.651 68.4749 664.597 68.7181L664.273 70.015C664.138 70.5554 663.368 73.622 663.314 73.8652C663.246 74.2029 663.246 74.4326 663.246 74.6082C663.246 75.9861 664.016 76.7021 664.894 76.7021C666.461 76.7021 668.083 74.6892 668.083 72.7304C668.083 71.4875 667.38 70.6094 666.367 70.6094C665.664 70.6094 665.029 71.1903 664.773 71.4605L665.759 67.5293ZM664.908 76.4319C664.476 76.4319 664.003 76.1077 664.003 75.054C664.003 74.6082 664.043 74.3515 664.286 73.4059C664.327 73.2302 664.543 72.3656 664.597 72.19C664.624 72.0819 665.421 70.8796 666.34 70.8796C666.934 70.8796 667.204 71.474 667.204 72.1765C667.204 72.825 666.826 74.3515 666.489 75.054C666.151 75.7835 665.529 76.4319 664.908 76.4319Z" fill="black"/>
            </g>
            <text id="KL" fill="#E56717" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" font-weight="900" letter-spacing="0em"><tspan x="649" y="232.943">KL</tspan></text>
            <text id="KL_2" fill="#E56717" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" font-weight="900" letter-spacing="0em"><tspan x="649" y="263.943">KL</tspan></text>
            <text id="KL_3" fill="#E56717" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" font-weight="900" letter-spacing="0em"><tspan x="557" y="292.943">KL</tspan></text>
        </svg>

    </div>

    <figcaption id="caption">
        Map of related algorithms. Hover over the circles to show comments.
    </figcaption>

</figure>
