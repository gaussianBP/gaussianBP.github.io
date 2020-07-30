// Hot reloading
import * as _unused from "raw-loader!./index.ejs";
// TODO: disable before publishing


import Spring from "./diagrams/spring.svelte";
const SpringComponent = new Spring({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#spring')
});

import GaussProduct from "./diagrams/gauss_product.svelte";
const GaussProdComponent = new GaussProduct({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#gaussprod')
});

import Gbp1d from "./diagrams/gbp1d.svelte";
const Gbp1dComponent = new Gbp1d({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#gbp1d')
});

// import RobotSim from "./diagrams/gbp2d_linear.svelte";
// const RobotSimComponent = new RobotSim({ // eslint-disable-line no-unused-vars
//   target: document.querySelector('#RobotSim')
// });

import Graph from "./diagrams/graph.svelte";
const GraphComponent = new Graph({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#Graph')
});

import RobotNonlinearSim from "./diagrams/gbp2d_nonlinear.svelte";
const RobotNonlinearSimComponent = new RobotNonlinearSim({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#RobotNonlinearSim')
});

import RobotRoomSim from "./diagrams/gbp2d_room.svelte";
const RobotRoomSimComponent = new RobotRoomSim({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#RobotRoomSim')
});
