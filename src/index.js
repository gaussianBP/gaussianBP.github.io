// Hot reloading
import * as _unused from "raw-loader!./index.ejs";
// TODO: disable before publishing


import Teaser from "./diagrams/teaser.svelte";
const TeaserComponent = new Teaser({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#teaser')
});

import Huber from "./diagrams/huber.svelte";
const HuberComponent = new Huber({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#huber')
});

import Related from "./diagrams/related.svelte";
const RelatedComponent = new Related({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#related')
});

import Phases from "./diagrams/phases.svelte";
const PhasesComponent = new Phases({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#phases')
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

import GBPIntuition from "./diagrams/gbp_intuition.svelte";
const GBPIntuitionComponent = new GBPIntuition({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#gbp_intuition')
});

import BPEquations from "./diagrams/bp_eqns.svelte";
const BPEquationsComponent = new BPEquations({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#bp_equations')
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

import GBP1d from "./diagrams/gbp1d.svelte";
const GBP1dComponent = new GBP1d({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#gbp1d')
});

import GBP1dRobust from "./diagrams/gbp1d_robust.svelte";
const GBP1dRobustComponent = new GBP1dRobust({ // eslint-disable-line no-unused-vars
  target: document.querySelector('#gbp1d_robust')
});
