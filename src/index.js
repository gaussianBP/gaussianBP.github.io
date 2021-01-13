// Hot reloading
import * as _unused from "raw-loader!./index.ejs";
// TODO: disable before publishing


import Spring from "./diagrams/spring.svelte";
const SpringComponent = new Spring({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#spring')
});


import SurfaceFitting from "./diagrams/surface_fitting.svelte";
const SurfaceFittingComponent = new SurfaceFitting({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#surface_fitting')
});


import Playground from "./diagrams/playground_tabs.svelte";
const PlaygroundComponent = new Playground({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#playground')
});

import CustomPlayground from "./diagrams/custom_playground.svelte";
const PlaygroundTesaerComponent = new CustomPlayground({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#custom_playground')
});


// import RobotNonlinearSim from "./diagrams/gbp2d_nonlinear.svelte";
// const RobotNonlinearSimComponent = new RobotNonlinearSim({ // eslint-disable-line no-unused-vars
//   target: document.querySelector('#RobotNonlinearSim')
// });

// import RobotRoomSim from "./diagrams/gbp2d_room.svelte";
// const RobotRoomSimComponent = new RobotRoomSim({ // eslint-disable-line no-unused-vars
//   target: document.querySelector('#RobotRoomSim')
// });
