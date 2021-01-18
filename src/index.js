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

import GaussianGM from "./diagrams/gaussian_gm.svelte";
const GaussianGMComponent = new GaussianGM({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#gaussian_gm')
});

// import CustomPlayground from "./diagrams/pose_graph2d.svelte";
// const PlaygroundTesaerComponent = new CustomPlayground({ // eslint-disable-line no-unused-vars
//   target: document.querySelector('#custom_playground')
// });

// import Robot from "./diagrams/robot2d.svelte";
// const RobotComponent = new Robot({ // eslint-disable-line no-unused-vars
//   target: document.querySelector('#robot')
// });


// import RobotNonlinearSim from "./diagrams/gbp2d_nonlinear.svelte";
// const RobotNonlinearSimComponent = new RobotNonlinearSim({ // eslint-disable-line no-unused-vars
//   target: document.querySelector('#RobotNonlinearSim')
// });

// import RobotRoomSim from "./diagrams/gbp2d_room.svelte";
// const RobotRoomSimComponent = new RobotRoomSim({ // eslint-disable-line no-unused-vars
//   target: document.querySelector('#RobotRoomSim')
// });
