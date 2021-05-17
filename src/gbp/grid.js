
import * as m from 'ml-matrix';
import * as r from "random";
import * as gbp from "../gbp/gbp_playground.js";

export function gen_beliefs() {

    // const seedrandom = require('seedrandom');
    // r.use(seedrandom('foobar'));

    let graph = new gbp.FactorGraph();
    let means = {};
    let covs = {}

    let grid_size = 3;
    let n_iters = 20;
    const width = 600;
    
    let prior_std = 100;
    let meas_params = {
        "linear" : {
            "noise_model_std": 50,
            "noise_std": 0,
        }
    };

    const damping = 0.7;  // Only for grid
    const dropout = 0.;  // Only for grid

    const x0 = 100;
    const inc = (width - 2*x0) / (grid_size-1);

    for (var i=0; i<grid_size; i++) {
        for (var j=0; j<grid_size; j++) {
            graph.add_var_node(x0 + j*inc, x0 + i*inc, prior_std, grid_size*i+j);
            if (i!=0 && j!=0) {
                graph.var_nodes[i*grid_size + j].prior.eta = graph.var_nodes[i*grid_size + j].prior.lam.mmul(new m.Matrix(
                [[x0 + j*inc], [x0 + i*inc]]));              
            }
        }
    }
    for (var i=0; i<grid_size; i++) {
        for (var j=0; j<grid_size; j++) {
            if (j < 2) {
                graph.add_factor_node(grid_size*i + j, grid_size*i + j + 1, "linear", meas_params); // factor with node below
            }
            if (i < 2) {
                graph.add_factor_node(grid_size*i + j, grid_size*i + j + grid_size, "linear", meas_params); // factor with node on rhs
            }
        }
    }
    for (var i=0; i<graph.factor_nodes.length; i++) {
        graph.factor_nodes[i].damping = damping;
        graph.factor_nodes[i].dropout = dropout;
    }
    
    const grid_prior = {"0":{"eta":[100,100],"lam":1},"1":{"eta":[0.024606250000000017,0.007181250000000011],"lam":0.0001},"2":{"eta":[0.05340625000000004,0.014781250000000003],"lam":0.0001},"3":{"eta":[0.005006250000000001,0.03498125],"lam":0.0001},"4":{"eta":[0.027306249999999997,0.03518125000000002],"lam":0.0001},"5":{"eta":[0.04500625,0.025081250000000006],"lam":0.0001},"6":{"eta":[0.015206250000000003,0.04338125000000001],"lam":0.0001},"7":{"eta":[0.034306250000000045,0.05538125],"lam":0.0001},"8":{"eta":[0.05020625000000001,0.04408125000000003],"lam":0.0001}};
    for (var i = 0; i < graph.var_nodes.length; i++) {
        const n = graph.var_nodes[i];
        n.prior.eta = new m.Matrix([[grid_prior[n.id].eta[0]], [grid_prior[n.id].eta[1]]]);
        n.prior.lam = new m.Matrix([[grid_prior[n.id].lam, 0.], [0., grid_prior[n.id].lam]]);
    }
    graph.update_beliefs();

    let map = graph.compute_MAP();
    let direct_mu = map[0];
    let direct_stds = map[1].diag().map(x => Math.sqrt(x));
    
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
