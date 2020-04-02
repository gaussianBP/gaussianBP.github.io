// Hot reloading
import * as _unused from "raw-loader!./index.ejs";
// TODO: disable before publishing

import Gbp1d from "./diagrams/gbp1d.svelte";
const Gbp1dComponent = new Gbp1d({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#gbp1d')
});

import RobotSim from "./diagrams/gbp2d.svelte";
const RobotSimComponent = new RobotSim({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#RobotSim')
});
