
import * as m from 'ml-matrix';
import * as r from "random";
import * as gbp from "../gbp/gbp_playground.js";

export function gen_beliefs() {

    const seedrandom = require('seedrandom');
    r.use(seedrandom('foobar'));

    let graph = new gbp.FactorGraph();
    let means = {};
    let covs = {}

    let grid_size = 3;
    let n_iters = 20;
    
    let prior_std = 0.6;
    let anchor_prior_std = 0.0001;
    let meas_params = {
        "linear" : {
            "noise_model_std": 0.65,
            "noise_std": 0,
        }
    }
    
    const init_noise = r.normal(0, 0.25);
    
    for (var i=0; i<grid_size; i++) {
        for (var j=0; j<grid_size; j++) {
            graph.add_var_node(i, j, prior_std, 3*i+j, 0, anchor_prior_std);
            if (i!=0 && j!=0) {
                graph.var_nodes[i*grid_size + j].prior.eta = graph.var_nodes[i*grid_size + j].prior.lam.mmul(new m.Matrix(
                [[i], [j]]));              
            }
        }
    }
    
    for (var i=0; i<grid_size; i++) {
        for (var j=0; j<grid_size; j++) {
            if (j < 2) {
                graph.add_factor_node(3*i + j, 3*i + j + 1, "linear", meas_params); // factor with node below
            }
            if (i < 2) {
                graph.add_factor_node(3*i + j, 3*i + j + 3, "linear", meas_params); // factor with node on rhs
            }
        }
    }
    
    let map = graph.compute_MAP();
    let direct_mu = map[0];
    let direct_stds = map[1].diag().map(x => Math.sqrt(x));

    graph.update_beliefs();
    for (var i=0; i<grid_size; i++) {
        for (var j=0; j<grid_size; j++) {
            if (!(i==0 && j==0)) {
                graph.var_nodes[i*grid_size + j].belief.eta = graph.var_nodes[i*grid_size + j].belief.lam.mmul(new m.Matrix([[i + init_noise()], [j + init_noise()]]));     
            }
        }
    }
    
    for (let i=0; i < n_iters; ++i) {
        let bp_means = {xs: [], ys: []};
        let bp_covs = [];
        for (let j = 0; j < graph.var_nodes.length; j++) {
            bp_means.xs.push(graph.var_nodes[j].belief.getMean().get(0,0));
            bp_means.ys.push(graph.var_nodes[j].belief.getMean().get(1,0));
            bp_covs.push(Math.sqrt(graph.var_nodes[j].belief.getCov().get(0,0)));
        }
        means[i] = bp_means;
        covs[i] = bp_covs;
        graph.sync_iter();
    }
    
    return [means, covs, direct_mu, direct_stds];
}
