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

</style>


<figure class="subgrid" id="figure">

    <div id="wrapper" class="interactive-container">

        <svg width="780" height="370" viewBox="0 0 780 370" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text id="MAP Inference" fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="16" font-weight="bold" letter-spacing="0em"><tspan x="170" y="14.9688">MAP Inference</tspan></text>
            <text id="Marginal Inference" fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="16" font-weight="bold" letter-spacing="0em"><tspan x="469" y="14.9688">Marginal Inference</tspan></text>
            <g id="Gaussian elimination / LU decomposition QR decomposition Cholesky decomposition">
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="295.164" y="77.9434"> / </tspan><tspan x="170" y="92.9434">&#10;</tspan><tspan x="170" y="122.943">&#10;</tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="170" y="137.943"><a target="_" href="https://en.wikipedia.org/wiki/Cholesky_decomposition">Cholesky decomposition&#10;</a></tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="170" y="107.943"><a target="_" href="https://en.wikipedia.org/wiki/QR_decomposition">QR decomposition&#10;</a></tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="302.971" y="77.9434"><a target="_" href="https://en.wikipedia.org/wiki/LU_decomposition">LU  decomposition&#10;</a></tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="170" y="77.9434"><a target="_" href="https://en.wikipedia.org/wiki/Gaussian_elimination">Gaussian elimination</a></tspan></text>
            </g>
            <text id="Compute , then take . Can use any of the decomposition methods for MAP inference to invert ." fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="469" y="76.9434">Compute         , then take                   .&#10;</tspan><tspan x="469" y="91.9434">&#10;</tspan><tspan x="469" y="106.943">Can use any of the decomposition </tspan><tspan x="469" y="121.943">methods for MAP inference to invert     .</tspan></text>            <g id="Gradient descent Conjugate gradient method Successive over relaxation Jacobi method Gauss-Seidel method">
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="173" y="217.943">&#10;</tspan><tspan x="173" y="247.943">&#10;</tspan><tspan x="173" y="277.943">&#10;</tspan><tspan x="173" y="337.943">&#10;</tspan></text>
            <text fill="#00BF1F" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="173" y="307.943">&#10;</tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="173" y="262.943"><a target="_" href="https://en.wikipedia.org/wiki/Conjugate_gradient_method">Conjugate gradient method&#10;</a></tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="173" y="292.943"><a target="_" href="https://en.wikipedia.org/wiki/Successive_over-relaxation">Successive over relaxation&#10;</a></tspan></text>
            <text fill="black" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="173" y="352.943"><a target="_" href="https://en.wikipedia.org/wiki/Gauss%E2%80%93Seidel_method">Gauss-Seidel method&#10;</a></tspan></text>
            <a target="_" href="https://en.wikipedia.org/wiki/Jacobi_method">
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
            <text fill="#058219" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="618.121" y="262.943"> (EP) &#10;</tspan></text>
            <a target="_" href="https://en.wikipedia.org/wiki/Expectation_propagation">
                <text fill="#058219" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="475" y="262.943">Expectation propagation</tspan></text>
            </a>
            <a target="_" href="https://arxiv.org/abs/2010.08022">
                <text fill="#058219" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em" text-decoration="underline"><tspan x="475" y="292.943">Barfoot 2020&#10;</tspan></text>
            </a>
            </g>
            <g id="Local method KL: variational inference">
                <text fill="#058219" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="1" y="19.9434">Local method&#10;</tspan><tspan x="19.5098" y="34.9434"> </tspan></text>
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
            <text id="Converges to the solution from an initial estimate over many steps." fill="black" fill-opacity="0.71" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" letter-spacing="0em"><tspan x="0" y="252.943">Converges to the </tspan><tspan x="0" y="267.943">solution from an initial </tspan><tspan x="0" y="282.943">estimate over many </tspan><tspan x="0" y="297.943">steps.</tspan></text>
            <g id="grid">
            <line id="Line 1" y1="53.5" x2="775" y2="53.5" stroke="#A6A6A6"/>
            <line id="Line 2" x1="148.5" y1="2.10174e-08" x2="148.5" y2="365" stroke="#A6A6A6"/>
            </g>
            <g id="comment1">
            <path id="Vector 1" d="M271 321C294.167 316.5 360.811 312.486 390 276C416 243.5 448.167 234.833 470 230" stroke="#A6A6A6" stroke-width="2"/>
            <path id="Vector 3" d="M332.5 309.5C323.5 315.5 304.6 331.4 301 347" stroke="#A6A6A6" stroke-width="2"/>
            <circle class="hoverable" on:mouseover={() => (comment1=true)} on:mouseout={() => (comment1=false)} id="Ellipse 1" cx="389.5" cy="275.5" r="11.5" fill="#A6A6A6"/>
            <text class:hidden={!comment1} id="Ignoring the covariance updates, and with a specific schedule, GBP is equivalent to the Jacobi and Gauss-Seidel methods." fill="black" fill-opacity="0.6" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="12" letter-spacing="0em"><tspan x="302" y="188.102">Ignoring the covariance updates, </tspan><tspan x="302" y="202.102">and with a specific schedule, </tspan><tspan x="302" y="216.102">GBP is equivalent to the Jacobi </tspan><tspan x="302" y="230.102">and Gauss-Seidel methods.</tspan></text>
            </g>
            <g id="comment2">
                <path id="Vector 2" d="M673 229C686 229.678 723.5 213.139 723.5 222.5C723.5 231.861 686 256.813 673 258" stroke="#A6A6A6" stroke-width="2"/>
                <path class="hoverable" on:mouseover={() => (comment2=true)} on:mouseout={() => (comment2=false)} id="Ellipse 2" d="M732 220.5C732 226.851 726.851 232 720.5 232C714.149 232 709 226.851 709 220.5C709 214.149 714.149 209 720.5 209C726.851 209 732 214.149 732 220.5Z" fill="#A6A6A6"/>
                <text class:hidden={!comment2} id="EP is only fully local when the approximating distribution is fully factorized. In this case, EP is exactly equivalent to GBP." fill="black" fill-opacity="0.6" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="12" letter-spacing="0em"><tspan x="584" y="161.102">EP is only fully local when the </tspan><tspan x="584" y="175.102">approximating distribution is fully </tspan><tspan x="584" y="189.102">factorized. In this case, EP is </tspan><tspan x="584" y="203.102">exactly equivalent to GBP.</tspan></text>
            </g>
            <g id="comment3">
                <text class:hidden={!comment3} id="Barfoot&#226;&#128;&#153;s method involves extra communication edges and memory compared to GBP and so is not fully local." fill="black" fill-opacity="0.6" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="12" letter-spacing="0em"><tspan x="396" y="325.102">Barfoot&#x2019;s method involves </tspan><tspan x="396" y="339.102">extra communication edges </tspan><tspan x="396" y="353.102">and memory compared to GBP </tspan><tspan x="396" y="367.102">and so is not fully local.</tspan></text>
                <path id="Vector 4" d="M471 239.5C462 242 430.5 275.2 430.5 290C430.5 304.8 462 288 471 290" stroke="#A6A6A6" stroke-width="2"/>
                <circle class="hoverable" on:mouseover={() => (comment3=true)} on:mouseout={() => (comment3=false)} id="Ellipse 2_2" cx="430.5" cy="295.5" r="11.5" fill="#A6A6A6"/>
            </g>

            <g id="math">
            <g id="lam0">
            <path id="Vector" d="M347.458 25.7837C347.377 25.5135 347.309 25.5 347.161 25.5C347.039 25.5 346.958 25.527 346.891 25.7432L344.27 33.8488C344.013 34.6323 343.459 34.7404 343 34.7539V35.1457C343.581 35.1187 343.608 35.1187 344.189 35.1187C344.554 35.1187 345.216 35.1187 345.553 35.1457V34.7539C344.864 34.7404 344.608 34.3621 344.608 34.0649C344.608 34.0109 344.608 33.9704 344.675 33.7677L346.783 27.2697L348.998 34.1054C349.066 34.2946 349.066 34.3216 349.066 34.3486C349.066 34.7539 348.363 34.7539 348.025 34.7539V35.1457C348.336 35.1187 349.376 35.1187 349.755 35.1187C350.146 35.1187 350.984 35.1187 351.335 35.1457V34.7539C350.606 34.7539 350.349 34.7539 350.187 34.2405L347.458 25.7837Z" fill="black" fill-opacity="0.71"/>
            </g>
            <g id="lam1">
            <path id="Vector_2" d="M688.993 111.313C688.902 111.015 688.826 111 688.66 111C688.524 111 688.433 111.03 688.357 111.268L685.422 120.214C685.135 121.079 684.514 121.198 684 121.213V121.646C684.651 121.616 684.681 121.616 685.331 121.616C685.74 121.616 686.481 121.616 686.86 121.646V121.213C686.088 121.198 685.8 120.781 685.8 120.453C685.8 120.393 685.8 120.349 685.876 120.125L688.236 112.953L690.718 120.498C690.793 120.706 690.793 120.736 690.793 120.766C690.793 121.213 690.007 121.213 689.628 121.213V121.646C689.976 121.616 691.141 121.616 691.565 121.616C692.004 121.616 692.942 121.616 693.335 121.646V121.213C692.518 121.213 692.231 121.213 692.049 120.647L688.993 111.313Z" fill="black"/>
            </g>
            <g id="mu0">
            <path id="Vector_3" d="M233.567 34.6604C233.905 34.9711 234.405 35.0927 234.864 35.0927C235.729 35.0927 236.323 34.5118 236.634 34.093C236.769 34.809 237.336 35.0927 237.809 35.0927C238.214 35.0927 238.539 34.8495 238.782 34.3632C238.998 33.9039 239.187 33.0798 239.187 33.0258C239.187 32.9582 239.133 32.9042 239.052 32.9042C238.93 32.9042 238.917 32.9717 238.863 33.1744C238.66 33.9714 238.403 34.8225 237.85 34.8225C237.458 34.8225 237.431 34.4713 237.431 34.2011C237.431 33.8904 237.552 33.404 237.647 32.9988L238.025 31.5398C238.079 31.2831 238.228 30.6752 238.295 30.432C238.376 30.1078 238.525 29.5269 238.525 29.4728C238.525 29.2702 238.363 29.1351 238.16 29.1351C238.039 29.1351 237.755 29.1891 237.647 29.5944L236.701 33.35C236.634 33.6202 236.634 33.6472 236.458 33.8634C236.296 34.093 235.769 34.8225 234.918 34.8225C234.161 34.8225 233.918 34.2686 233.918 33.6337C233.918 33.2419 234.04 32.7691 234.094 32.5394L234.702 30.1078C234.769 29.8511 234.877 29.4188 234.877 29.3377C234.877 29.1216 234.702 29 234.526 29C234.405 29 234.107 29.0405 233.999 29.4728L232.041 37.2947C232.027 37.3623 232 37.4433 232 37.5244C232 37.727 232.162 37.8621 232.365 37.8621C232.757 37.8621 232.838 37.5514 232.932 37.1732L233.567 34.6604Z" fill="black" fill-opacity="0.71"/>
            </g>
            <g id="mu1">
            <path id="Vector_4" d="M532.567 34.6604C532.905 34.9711 533.405 35.0927 533.864 35.0927C534.729 35.0927 535.323 34.5118 535.634 34.093C535.769 34.809 536.336 35.0927 536.809 35.0927C537.214 35.0927 537.539 34.8495 537.782 34.3632C537.998 33.9039 538.187 33.0798 538.187 33.0258C538.187 32.9582 538.133 32.9042 538.052 32.9042C537.93 32.9042 537.917 32.9717 537.863 33.1744C537.66 33.9714 537.403 34.8225 536.85 34.8225C536.458 34.8225 536.431 34.4713 536.431 34.2011C536.431 33.8904 536.552 33.404 536.647 32.9988L537.025 31.5398C537.079 31.2831 537.228 30.6752 537.295 30.432C537.376 30.1078 537.525 29.5269 537.525 29.4728C537.525 29.2702 537.363 29.1351 537.16 29.1351C537.039 29.1351 536.755 29.1891 536.647 29.5944L535.701 33.35C535.634 33.6202 535.634 33.6472 535.458 33.8634C535.296 34.093 534.769 34.8225 533.918 34.8225C533.161 34.8225 532.918 34.2686 532.918 33.6337C532.918 33.2419 533.04 32.7691 533.094 32.5394L533.702 30.1078C533.769 29.8511 533.877 29.4188 533.877 29.3377C533.877 29.1216 533.702 29 533.526 29C533.405 29 533.107 29.0405 532.999 29.4728L531.041 37.2947C531.027 37.3623 531 37.4433 531 37.5244C531 37.727 531.162 37.8621 531.365 37.8621C531.757 37.8621 531.838 37.5514 531.932 37.1732L532.567 34.6604Z" fill="black" fill-opacity="0.71"/>
            </g>
            <g id="lam inv 1">
            <path id="Vector_5" d="M697.458 25.2051C697.377 24.9349 697.309 24.9214 697.161 24.9214C697.039 24.9214 696.958 24.9484 696.891 25.1645L694.27 33.2701C694.013 34.0537 693.459 34.1617 693 34.1753V34.567C693.581 34.54 693.608 34.54 694.189 34.54C694.554 34.54 695.216 34.54 695.553 34.567V34.1753C694.864 34.1617 694.608 33.7835 694.608 33.4863C694.608 33.4322 694.608 33.3917 694.675 33.1891L696.783 26.6911L698.998 33.5268C699.066 33.7159 699.066 33.743 699.066 33.77C699.066 34.1753 698.363 34.1753 698.025 34.1753V34.567C698.336 34.54 699.376 34.54 699.755 34.54C700.146 34.54 700.984 34.54 701.335 34.567V34.1753C700.606 34.1753 700.349 34.1753 700.187 33.6619L697.458 25.2051Z" fill="black" fill-opacity="0.71"/>
            <path id="Vector_6" d="M708.058 26.9447C708.202 26.9447 708.4 26.9447 708.4 26.7376C708.4 26.5304 708.202 26.5304 708.058 26.5304H702.897C702.753 26.5304 702.555 26.5304 702.555 26.7376C702.555 26.9447 702.753 26.9447 702.897 26.9447H708.058Z" fill="black" fill-opacity="0.71"/>
            <path id="Vector_7" d="M712.033 23.2522C712.033 23.009 712.015 23 711.772 23C711.403 23.3602 710.925 23.5764 710.07 23.5764V23.8736C710.313 23.8736 710.799 23.8736 711.322 23.6304V28.2506C711.322 28.5839 711.295 28.6919 710.439 28.6919H710.124V28.9891C710.493 28.9621 711.268 28.9621 711.673 28.9621C712.078 28.9621 712.862 28.9621 713.231 28.9891V28.6919H712.916C712.06 28.6919 712.033 28.5839 712.033 28.2506V23.2522Z" fill="black" fill-opacity="0.71"/>
            </g>
            <g id="lam inv">
            <path id="Vector_8" d="M535.458 67.2051C535.377 66.9349 535.309 66.9214 535.161 66.9214C535.039 66.9214 534.958 66.9484 534.891 67.1645L532.27 75.2701C532.013 76.0537 531.459 76.1617 531 76.1753V76.567C531.581 76.54 531.608 76.54 532.189 76.54C532.554 76.54 533.216 76.54 533.553 76.567V76.1753C532.864 76.1617 532.608 75.7835 532.608 75.4863C532.608 75.4322 532.608 75.3917 532.675 75.1891L534.783 68.6911L536.998 75.5268C537.066 75.7159 537.066 75.743 537.066 75.77C537.066 76.1753 536.363 76.1753 536.025 76.1753V76.567C536.336 76.54 537.376 76.54 537.755 76.54C538.146 76.54 538.984 76.54 539.335 76.567V76.1753C538.606 76.1753 538.349 76.1753 538.187 75.6619L535.458 67.2051Z" fill="black"/>
            <path id="Vector_9" d="M546.058 68.9447C546.202 68.9447 546.4 68.9447 546.4 68.7376C546.4 68.5304 546.202 68.5304 546.058 68.5304H540.897C540.753 68.5304 540.555 68.5304 540.555 68.7376C540.555 68.9447 540.753 68.9447 540.897 68.9447H546.058Z" fill="black"/>
            <path id="Vector_10" d="M550.033 65.2522C550.033 65.009 550.015 65 549.772 65C549.403 65.3602 548.925 65.5764 548.07 65.5764V65.8736C548.313 65.8736 548.799 65.8736 549.322 65.6304V70.2506C549.322 70.5839 549.295 70.6919 548.439 70.6919H548.124V70.9891C548.493 70.9621 549.268 70.9621 549.673 70.9621C550.078 70.9621 550.862 70.9621 551.231 70.9891V70.6919H550.916C550.06 70.6919 550.033 70.5839 550.033 70.2506V65.2522Z" fill="black"/>
            </g>
            <g id="mu = lam inv eta">
            <path id="Vector_11" d="M616.567 76.2698C616.905 76.5805 617.405 76.7021 617.864 76.7021C618.729 76.7021 619.323 76.1212 619.634 75.7024C619.769 76.4184 620.336 76.7021 620.809 76.7021C621.214 76.7021 621.539 76.4589 621.782 75.9726C621.998 75.5133 622.187 74.6892 622.187 74.6352C622.187 74.5676 622.133 74.5136 622.052 74.5136C621.93 74.5136 621.917 74.5812 621.863 74.7838C621.66 75.5808 621.403 76.4319 620.85 76.4319C620.458 76.4319 620.431 76.0807 620.431 75.8105C620.431 75.4998 620.552 75.0135 620.647 74.6082L621.025 73.1492C621.079 72.8925 621.228 72.2846 621.295 72.0414C621.376 71.7172 621.525 71.1363 621.525 71.0822C621.525 70.8796 621.363 70.7445 621.16 70.7445C621.039 70.7445 620.755 70.7985 620.647 71.2038L619.701 74.9594C619.634 75.2296 619.634 75.2566 619.458 75.4728C619.296 75.7024 618.769 76.4319 617.918 76.4319C617.161 76.4319 616.918 75.878 616.918 75.2431C616.918 74.8513 617.04 74.3785 617.094 74.1489L617.702 71.7172C617.769 71.4605 617.877 71.0282 617.877 70.9471C617.877 70.731 617.702 70.6094 617.526 70.6094C617.405 70.6094 617.107 70.6499 616.999 71.0822L615.041 78.9041C615.027 78.9717 615 79.0527 615 79.1338C615 79.3364 615.162 79.4715 615.365 79.4715C615.757 79.4715 615.838 79.1608 615.932 78.7826L616.567 76.2698Z" fill="black"/>
            <path id="Vector_12" d="M635.452 72.19C635.641 72.19 635.884 72.19 635.884 71.9468C635.884 71.6902 635.654 71.6902 635.452 71.6902H627.495C627.306 71.6902 627.062 71.6902 627.062 71.9333C627.062 72.19 627.292 72.19 627.495 72.19H635.452ZM635.452 74.7027C635.641 74.7027 635.884 74.7027 635.884 74.4596C635.884 74.2029 635.654 74.2029 635.452 74.2029H627.495C627.306 74.2029 627.062 74.2029 627.062 74.4461C627.062 74.7027 627.292 74.7027 627.495 74.7027H635.452Z" fill="black"/>
            <path id="Vector_13" d="M645.251 67.2051C645.169 66.9349 645.102 66.9214 644.953 66.9214C644.832 66.9214 644.751 66.9484 644.683 67.1645L642.062 75.2701C641.806 76.0537 641.252 76.1617 640.792 76.1753V76.567C641.373 76.54 641.4 76.54 641.981 76.54C642.346 76.54 643.008 76.54 643.346 76.567V76.1753C642.657 76.1617 642.4 75.7835 642.4 75.4863C642.4 75.4322 642.4 75.3917 642.468 75.1891L644.575 68.6911L646.791 75.5268C646.858 75.7159 646.858 75.743 646.858 75.77C646.858 76.1753 646.156 76.1753 645.818 76.1753V76.567C646.129 76.54 647.169 76.54 647.547 76.54C647.939 76.54 648.776 76.54 649.128 76.567V76.1753C648.398 76.1753 648.142 76.1753 647.979 75.6619L645.251 67.2051Z" fill="black"/>
            <path id="Vector_14" d="M655.85 68.9447C655.994 68.9447 656.192 68.9447 656.192 68.7376C656.192 68.5304 655.994 68.5304 655.85 68.5304H650.69C650.546 68.5304 650.347 68.5304 650.347 68.7376C650.347 68.9447 650.546 68.9447 650.69 68.9447H655.85Z" fill="black"/>
            <path id="Vector_15" d="M659.826 65.2522C659.826 65.009 659.808 65 659.564 65C659.195 65.3602 658.718 65.5764 657.862 65.5764V65.8736C658.105 65.8736 658.592 65.8736 659.114 65.6304V70.2506C659.114 70.5839 659.087 70.6919 658.231 70.6919H657.916V70.9891C658.286 70.9621 659.06 70.9621 659.465 70.9621C659.871 70.9621 660.654 70.9621 661.023 70.9891V70.6919H660.708C659.853 70.6919 659.826 70.5839 659.826 70.2506V65.2522Z" fill="black"/>
            <path id="Vector_16" d="M668.762 72.8249C668.83 72.5548 668.87 72.3926 668.87 72.0279C668.87 71.2173 668.397 70.6094 667.371 70.6094C666.168 70.6094 665.533 71.4605 665.29 71.7982C665.25 71.0282 664.696 70.6094 664.101 70.6094C663.71 70.6094 663.399 70.7985 663.142 71.3119C662.899 71.7982 662.71 72.6223 662.71 72.6763C662.71 72.7304 662.764 72.7979 662.859 72.7979C662.967 72.7979 662.98 72.7844 663.061 72.4737C663.264 71.6766 663.52 70.8796 664.061 70.8796C664.372 70.8796 664.48 71.0957 664.48 71.501C664.48 71.7982 664.345 72.3251 664.25 72.7439L663.872 74.2029C663.818 74.4596 663.669 75.0675 663.602 75.3107C663.507 75.6619 663.358 76.2968 663.358 76.3644C663.358 76.5535 663.507 76.7021 663.71 76.7021C663.872 76.7021 664.061 76.6211 664.169 76.4184C664.196 76.3509 664.318 75.878 664.385 75.6079L664.682 74.392L665.128 72.6088C665.155 72.5277 665.493 71.8523 665.993 71.42C666.344 71.0957 666.803 70.8796 667.33 70.8796C667.87 70.8796 668.06 71.2849 668.06 71.8252C668.06 72.217 668.006 72.4332 667.938 72.6898L666.371 78.9041C666.357 78.9717 666.33 79.0527 666.33 79.1338C666.33 79.3364 666.493 79.4715 666.695 79.4715C666.817 79.4715 667.1 79.4175 667.209 79.0122L668.762 72.8249Z" fill="black"/>
            </g>
            </g>

            <text id="KL" fill="#E56717" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" font-weight="900" letter-spacing="0em"><tspan x="649" y="232.943">KL</tspan></text>
            <text id="KL_2" fill="#E56717" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" font-weight="900" letter-spacing="0em"><tspan x="649" y="263.943">KL</tspan></text>
            <text id="KL_3" fill="#E56717" xml:space="preserve" style="white-space: pre" font-family="Roboto" font-size="13" font-weight="900" letter-spacing="0em"><tspan x="557" y="292.943">KL</tspan></text>
        </svg>

    </div>

    <figcaption id="caption">
            Gaussian inference methods. Hover over the circles to show comments. 
            <span style="color: #058219;">Green methods are local</span>, by which we mean that they can be implemented as a distributed message passing algorithm in which all nodes compute messages on every iteration and each node communicates only with a small local neighbourhood.
            That does not mean to say that the other methods are entirely centralised; many of the methods are somewhat parallel or have modified versions that are more strongly parallel (e.g. parallel conjugate gradient).  
            <br>
            The <span style="color: #E56717; font-weight: 900;">KL</span> symbol indicates a variational inference method, i.e. approximate inference via solving an optimization problem. 
            <br>
            Note that the figure is not a comprehensive list - for example we have excluded sampling based inference methods. 
            [References: Expectation propagation <d-cite key="minka2013ep"></d-cite>, Barfoot 2020 <d-cite key="barfoot2020fundamental"></d-cite>]
        <!-- There are some methods in between that can recover specific blocks of $A^{-1}$ <d-cite key="kaess2009covariance"></d-cite> -->
    </figcaption>

</figure>
