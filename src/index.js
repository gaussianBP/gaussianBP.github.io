// Hot reloading
import * as _unused from "raw-loader!./index.ejs";
// TODO: disable before publishing


// import Spring from "./diagrams/spring.svelte";
// const SpringComponent = new Spring({ // eslint-disable-line no-unused-vars
//   target: document.querySelector('#spring')
// });


// import SurfaceFitting from "./diagrams/surface_fitting.svelte";
// const SurfaceFittingComponent = new SurfaceFitting({ // eslint-disable-line no-unused-vars
//   target: document.querySelector('#surface_fitting')
// });

import Huber from "./diagrams/huber.svelte";
const HuberComponent = new Huber({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#huber')
});

import Playground from "./diagrams/playground_tabs.svelte";
const PlaygroundComponent = new Playground({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#playground')
});

import GaussianGM from "./diagrams/gaussian_gm.svelte";
const GaussianGMComponent = new GaussianGM({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#gaussian_gm')
});

import FactorGraph from "./diagrams/factor_graph.svelte";
const FactorGraphComponent = new FactorGraph({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#factor_graph')
});

import MessagePassing from "./diagrams/message_passing.svelte";
const MessagePassingComponent = new MessagePassing({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#message_passing')
});

import GBPEquations from "./diagrams/gbp_eqns.svelte";
const GBPEquationsComponent = new GBPEquations({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#gbp_equations')
});

import GaussianEquations from "./diagrams/gaussian_eqns.svelte";
const GaussianEquationsComponent = new GaussianEquations({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#gaussian_equations')
});

import PIEquations from "./diagrams/probinf_eqns.svelte";
const PIEquationsComponent = new PIEquations({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#probinf_eqns')
});

import AttentionGL from "./diagrams/attentiongl.svelte";
const AttentionGLComponent = new AttentionGL({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#attentiongl')
});

import FactorLinearisation from "./diagrams/factor_linearisation.svelte";
const FactorLinearisationComponent = new FactorLinearisation({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#factor_linearisation')
});

// import MargCond from "./diagrams/marg_cond.svelte";
// const MargCondComponent = new MargCond({ // eslint-disable-line no-unused-vars
//   target: document.querySelector('#marg_cond')
// });

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
