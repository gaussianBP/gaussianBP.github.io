import * as m from 'ml-matrix';
import * as gauss from '../gaussian';

export class FactorGraph {
  constructor() {
    this.var_nodes = [];
    this.factors = [];

    this.sweep_ix = 0;
    this.forward = 1;
    this.past_first_meas = 0;
  }

  find_node(id) {
    id = parseInt(id);
    var var_node = this.var_nodes.filter(var_node => var_node.id == id)[0];
    if (var_node) {
      return var_node;
    }
    else {
      return null;
    }
  }

  update_beliefs() {
    for(var c=0; c<this.var_nodes.length; c++) {
      this.var_nodes[c].update_belief();
    }
  }

  send_messages() {
    for(var c=0; c<this.factors.length; c++) {
      if (this.factors[c].type == "binary") {
        this.factors[c].send_both_mess();
      }
    }

  }

  sync_iter() {
    this.send_messages();
    for(var c=0; c<this.factors.length; c++) {
      if (this.factors[c].type == "binary") {
        console.log("binary factor message", this.factors[c].messages);
      } else {
        console.log("unary factor message", this.factors[c].message);
      }
    }
    this.update_beliefs();
  }

  addLinearMeasurement(meas, x_meas, adj_var_ids,
                    x_var_lhs, x_var_rhs, meas_std) {
    var gamma = (x_meas - x_var_lhs) / (x_var_rhs - x_var_lhs);
    const meas_jac = new m.Matrix([[1 - gamma, gamma]]);

    this.factors[adj_var_ids[0]].jacs.push(meas_jac);
    this.factors[adj_var_ids[0]].meas.push(meas);
    this.factors[adj_var_ids[0]].lambdas.push(1 / Math.pow(meas_std, 2));
    this.factors[adj_var_ids[0]].compute_factor();
  }

  computeMAP() {
    var tot_dofs = 0;
    for(var c=0; c<this.var_nodes.length; c++) {
      tot_dofs += this.var_nodes[c].dofs;
    }

    const bigEta = m.Matrix.zeros(tot_dofs, 1);
    const bigLam = m.Matrix.zeros(tot_dofs, tot_dofs);

    for(var c=0; c<this.factors.length; c++) {
      if (this.factors[c].type == "binary") {
        var ix = this.factors[c].adj_var_ids[0];
        bigEta.set(ix, 0, bigEta.get(ix, 0) + this.factors[c].factor.eta.get(0, 0));
        bigEta.set(ix+1, 0, bigEta.get(ix+1, 0) + this.factors[c].factor.eta.get(1, 0));
        bigLam.set(ix, ix, bigLam.get(ix, ix) + this.factors[c].factor.lam.get(0, 0));
        bigLam.set(ix+1, ix, bigLam.get(ix+1, ix) + this.factors[c].factor.lam.get(1, 0));
        bigLam.set(ix, ix+1, bigLam.get(ix, ix+1) + this.factors[c].factor.lam.get(0, 1));
        bigLam.set(ix+1, ix+1, bigLam.get(ix+1, ix+1) + this.factors[c].factor.lam.get(1, 1));
      }
      else if (this.factors[c].type == "unary") {
        var ix = this.factors[c].adj_var_id; 
        bigEta.set(ix, 0, bigEta.get(ix, 0) + this.factors[c].message.eta.get(0, 0));
        bigLam.set(ix, ix, bigLam.get(ix, ix) + this.factors[c].message.lam.get(0, 0));
      }
    }

    const Cov = m.inverse(bigLam);
    const Means = Cov.mmul(bigEta);

    for(var c=0; c<this.var_nodes.length; c++) {
      this.var_nodes[c].MAP_mean = Means.get(c, 0);
      this.var_nodes[c].MAP_std = Math.sqrt(Cov.get(c, c));
    }
  }

  compare_to_MAP() {
    var gbp_means = [];
    for(var c=0; c<this.var_nodes.length; c++) {
      gbp_means.push(this.var_nodes[c].belief.getMean().get(0,0));
    }

    const means = new m.Matrix([gbp_means]);
    const map = this.computeMAP()[0];
    var av_diff = (map.sub(means.transpose())).norm();
    return av_diff;
  }

  compute_energy() {
    var energies = [];
    for(var c=0; c<this.factors.length; c++) {
      energies.push(this.factors[c].get_energy());
    }
    return energies;
  }

  sweep_step() {
    // Prepare for next step
    var next_ix = 0;
    var next_forward = this.forward;
    if (this.forward) {
      next_ix = this.sweep_ix + 1;
      if (this.sweep_ix == this.var_nodes.length - 2) {
        next_forward = 0;
      } 
    } else {
      next_ix = this.sweep_ix - 1;
      if (this.sweep_ix == 1) {
        next_forward = 1;
      }
    }

    if (this.forward) {
      if (this.factors[this.sweep_ix].meas.length > 1) {
        this.past_first_meas = 1;
      }
      this.factors[this.sweep_ix].send_mess(this.forward);
    } else {
      this.factors[next_ix].send_mess(this.forward);
    }
    if (this.past_first_meas) {
      this.var_nodes[next_ix].update_belief();
    }

    this.sweep_ix = next_ix;
    this.forward = next_forward;
  }
}

export class VariableNode {
  constructor(id, x, prior_std = 100) {
    this.type = 'var_node';
    this.dofs = 1;
    this.id = id;
    const prior_lam = 1 / (prior_std * prior_std);
    this.belief = new gauss.Gaussian(new m.Matrix([[prior_lam * x]]), new m.Matrix([[prior_lam]]));
    this.prior = new gauss.Gaussian(new m.Matrix([[prior_lam * x]]), new m.Matrix([[prior_lam]]));
    this.MAP_mean = 0;
    this.MAP_std = 0;
    this.gt = x;

    this.belief_path = null;

    this.adj_factors = [];
  }

  update_path(gauss_max_width, gauss_width_stds, STEP, map_y) {
    var mean = this.belief.getMean().get(0, 0);
    var std = Math.sqrt(this.belief.getCov().get(0, 0));
    var width = Math.min(gauss_width_stds * std, gauss_max_width);
    const xs = d3.range(mean - width, mean + width, STEP);
    const ys = xs.map(x => Math.exp(-.5 * (x-mean) * (x-mean) / (std * std)));
    
    const pts = d3.zip(xs,ys);
    this.belief_path = d3.line()
      .x(d => d[0])
      .y(d => map_y(d[1]))(pts);
  }

  update_belief() {
    // Start with prior
    this.belief.eta = this.prior.eta.clone();
    this.belief.lam = this.prior.lam.clone();

    // Take product of incoming messages
    for(var c=0; c<this.adj_factors.length; c++) {
      if (this.adj_factors[c].type == "binary") {
        var ix = this.adj_factors[c].adj_var_ids.indexOf(this.var_id);
        if (ix != -1) {
          this.belief.product(this.adj_factors[c].messages[ix])
        }
      }
      else if (this.adj_factors[c].type == "unary") {
        this.belief.product(this.adj_factors[c].message)
      }
    }

    // Send new belief to adjacent factors
    for(var c=0; c<this.adj_factors.length; c++) {
      if (this.adj_factors[c].type == "binary") {
        var ix = this.adj_factors[c].adj_var_ids.indexOf(this.var_id);
        this.adj_factors[c].adj_beliefs[ix] = this.belief;
      }
      else if (this.adj_factors[c].type == "unary") {
        this.adj_factors[c].adj_belief = this.belief;
      }
    }

  }
}

export class UnaryFactor {
  constructor(mean, std, adj_var_id) {
    this.type = "unary";
    this.mean = mean;
    this.std = std;
    this.adj_belief = null;
    this.adj_var_id = adj_var_id;

    this.message = null;
    this.update_message();
  }

  update_message() {
    var lam = 1 / (this.std * this.std);
    this.message = new gauss.Gaussian([[this.mean * lam]], [[lam]]);
  }

  get_energy() {
    var mean = this.adj_belief.eta.get(0, 0) / this.adj_belief.lam.get(0, 0);
    return 0.5 * (mean - this.mean) * (mean - this.mean) / (this.std * this.std);
  }
}

export class LinearFactor {
  constructor(dofs, adj_var_ids) {
    this.type = "binary";
    this.dofs = dofs;
    this.adj_var_ids = adj_var_ids;
    this.adj_beliefs = [];

    // To compute factor when factor is combination of many factor types (e.g. measurement and smoothness)
    this.jacs = [];
    this.meas = [];
    this.lambdas = [];
    this.factor = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));

    this.messages = [];
  }

  compute_factor() {
    this.factor.eta = m.Matrix.zeros(this.dofs, 1);
    this.factor.lam = m.Matrix.zeros(this.dofs, this.dofs);
    for (var i=0; i<this.jacs.length; i++) {
      this.factor.eta.add(this.jacs[i].transpose().mul(this.lambdas[i] * this.meas[i]));
      this.factor.lam.add(this.jacs[i].transpose().mmul(this.jacs[i]).mul(this.lambdas[i]));
    }
  }

  get_energy() {
    var mean0 = this.adj_beliefs[0].eta.get(0, 0) / this.adj_beliefs[0].lam.get(0, 0);
    var mean1 = this.adj_beliefs[1].eta.get(0, 0) / this.adj_beliefs[1].lam.get(0, 0);
    var energy = 0;

    for (var i=0; i<this.jacs.length; i++) {
      const pred_meas = this.jacs[i].mmul(new m.Matrix([[mean0], [mean1]])).get(0, 0);
      energy += 0.5 * (pred_meas - this.meas[i]) * (pred_meas - this.meas[i]) * this.lambdas[i];
    }
    return energy;
  }

  // Only for bipartite factors where the adjacent vars have 1 dof
  send_mess(ix) {
    if (ix) {
      const mess1 = new gauss.Gaussian([[0]], [[0]]);
      mess1.eta = new m.Matrix([[this.factor.eta.get(1, 0) - 
          this.factor.lam.get(1, 0) * (this.factor.eta.get(0, 0) + this.adj_beliefs[0].eta.get(0, 0) - this.messages[0].eta.get(0, 0)) / 
          (this.factor.lam.get(0, 0) + this.adj_beliefs[0].lam.get(0, 0) - this.messages[0].lam.get(0, 0))]]);
      mess1.lam = new m.Matrix([[this.factor.lam.get(1, 1) - 
          this.factor.lam.get(1, 0) * this.factor.lam.get(0, 1) / 
          (this.factor.lam.get(0, 0) + this.adj_beliefs[0].lam.get(0, 0) - this.messages[0].lam.get(0, 0))]]);
      this.messages[1] = mess1;
    } else {
      const mess0 = new gauss.Gaussian([[0]], [[0]]);
      mess0.eta = new m.Matrix([[this.factor.eta.get(0, 0) - 
          this.factor.lam.get(0, 1) * (this.factor.eta.get(1, 0) + this.adj_beliefs[1].eta.get(0, 0) - this.messages[1].eta.get(0, 0)) / 
          (this.factor.lam.get(1, 1) + this.adj_beliefs[1].lam.get(0, 0) - this.messages[1].lam.get(0, 0))]]);
      mess0.lam = new m.Matrix([[this.factor.lam.get(0, 0) - 
          this.factor.lam.get(0, 1) * this.factor.lam.get(1, 0) / 
          (this.factor.lam.get(1, 1) + this.adj_beliefs[1].lam.get(0, 0) - this.messages[1].lam.get(0, 0))]]);
      this.messages[0] = mess0;
    }
  }

  send_both_mess(){
    this.send_mess(0);
    this.send_mess(1);
  }
}


export function create1Dgraph(n_var_nodes, smoothness_std) {

  const graph = new FactorGraph()

  // Create variable nodes
  for(var i=0; i<n_var_nodes; i++) {
    const new_var_node = new VariableNode(1, i);
    graph.var_nodes.push(new_var_node);
  }

  // Create smoothness factors
  const smoothness_jac = new m.Matrix([[-1, 1]]);
  for(var i=0; i<(n_var_nodes-1); i++) {
    const new_factor = new LinearFactor(2, [i, i+1], );
    new_factor.jacs.push(smoothness_jac);
    new_factor.meas.push(0.);
    new_factor.lambdas.push(1 / Math.pow(smoothness_std, 2));

    new_factor.adj_beliefs.push(graph.var_nodes[i].belief);
    new_factor.adj_beliefs.push(graph.var_nodes[i+1].belief);
    new_factor.messages.push(new gauss.Gaussian([[0]], [[0]]));
    new_factor.messages.push(new gauss.Gaussian([[0]], [[0]]));
    new_factor.compute_factor();
    graph.factors.push(new_factor);
    graph.var_nodes[i].adj_factors.push(new_factor);
    graph.var_nodes[i+1].adj_factors.push(new_factor);
  }

  return graph;
}
