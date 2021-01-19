import * as m from 'ml-matrix';
import * as gauss from '../utils/gaussian';
import * as gbp from "../gbp/gbp_playground.js";

graph = new gbp.FactorGraph();


let grid_size = 3;

let prior_std = 1;
let meas_params = {
    "linear" : {
        "noise_model_std": 2,
        "noise_std": 0,
    }
}

for (var i=0; i<grid_size; i++) {
    for (var j=0; j<grid_size; j++) {
        graph.add_var_node(i, j, prior_std);
    }
}

for (var i=0; i<grid_size; i++) {
    for (var j=0; j<grid_size; j++) {
        if (j == grid_size-1) {
            graph.add_factor_node(3*i + j, 3*i + j + 3, "linear", meas_params); // factor with node below
        } else if (i == grid_size - 1) {
            graph.add_factor_node(3*i + j, 3*i + j + 1, "linear", meas_params); // factor with node on rhs
        } else {
            graph.add_factor_node(3*i + j, 3*i + j + 1, "linear", meas_params); // factor with node on rhs
            graph.add_factor_node(3*i + j, 3*i + j + 3, "linear", meas_params); // factor with node below
        }
    }
}

console.log(graph);
