import * as m from 'ml-matrix';
import * as gauss from '../utils/gaussian';


export class FactorGraph {
  constructor() {
    this.var_nodes = [];
    this.factors = [];

    this.sweep_ix = 0;
    this.forward = 1;
    this.past_first_meas = 0;
  }

  get_beliefs() {
    let belief_etas = [];
    let belief_lams = [];
    for(var c=0; c<this.var_nodes.length; c++) {
      belief_etas.push(this.var_nodes[c].belief.eta.get(0,0))
      belief_lams.push(this.var_nodes[c].belief.lam.get(0,0))
    }
    return [belief_etas, belief_lams];
  }

  update_beliefs() {
    for(var c=0; c<this.var_nodes.length; c++) {
      this.var_nodes[c].update_belief();
    }
  }

  send_messages() {
    for(var c=0; c<this.factors.length; c++) {
      this.factors[c].send_both_mess();
    }
  }

  compute_factors() {
    for(var c=0; c<this.factors.length; c++) {
      this.factors[c].compute_factor();
    }
  }

  count_meas() {
    let n_meas = 0;
    for(var c=0; c<this.factors.length; c++) {
      n_meas += this.factors[c].meas.length-1;
    }
    return n_meas;
  }

  sync_iter() {
    this.send_messages();
    this.update_beliefs();
  }

  addLinearMeasurement(meas, x_meas, adj_var_ids,
                    x_var_lhs, x_var_rhs, meas_std) {
    var gamma = (x_meas - x_var_lhs) / (x_var_rhs - x_var_lhs);
    const meas_jac = new m.Matrix([[1 - gamma, gamma]]);

    this.factors[adj_var_ids[0]].jacs.push(meas_jac);
    this.factors[adj_var_ids[0]].meas.push(meas);
    this.factors[adj_var_ids[0]].x_meas.push(x_meas);
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
      var ix = this.factors[c].adj_var_ids[0];
      bigEta.set(ix, 0, bigEta.get(ix, 0) + this.factors[c].factor.eta.get(0, 0));
      bigEta.set(ix+1, 0, bigEta.get(ix+1, 0) + this.factors[c].factor.eta.get(1, 0));
      bigLam.set(ix, ix, bigLam.get(ix, ix) + this.factors[c].factor.lam.get(0, 0));
      bigLam.set(ix+1, ix, bigLam.get(ix+1, ix) + this.factors[c].factor.lam.get(1, 0));
      bigLam.set(ix, ix+1, bigLam.get(ix, ix+1) + this.factors[c].factor.lam.get(0, 1));
      bigLam.set(ix+1, ix+1, bigLam.get(ix+1, ix+1) + this.factors[c].factor.lam.get(1, 1));
    }

    // console.log(bigEta, bigLam);

    const Cov = m.inverse(bigLam);
    const Means = Cov.mmul(bigEta);

    // console.log(Means, Cov);

    // for(var c=0; c<this.var_nodes.length; c++) {
    //   this.var_nodes[c].MAP_mean = Means.get(c, 0);
    //   this.var_nodes[c].MAP_std = Math.sqrt(Cov.get(c, c));
    // }
    return [Means, Cov.diag()];
  }

  compare_to_MAP() {
    var gbp_means = [];
    for(var c=0; c<this.var_nodes.length; c++) {
      gbp_means.push(this.var_nodes[c].belief.getMean().get(0,0));
    }

    const means = new m.Matrix([gbp_means]);
    const map = this.computeMAP();
    var av_diff = (map.sub(means.transpose())).norm();
    return av_diff;
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

  send_mess_left(id) {
    if (id > 0) { 
      this.factors[id-1].send_mess(0); 
      if (this.factors[id-1].messages[0].eta.get(0,0) != 0) {
        this.var_nodes[id-1].update_belief(); 
      }
    }
  }

  send_mess_right(id) {  
    if (id < this.var_nodes.length-1) { 
      this.factors[id].send_mess(1); 
      if (this.factors[id].messages[1].eta.get(0,0) != 0) {
        this.var_nodes[id+1].update_belief(); 
      }
    }
  }


}

export class VariableNode {
  constructor(id) {
    this.var_id = id;
    this.belief = new gauss.Gaussian(m.Matrix.zeros(1, 1), m.Matrix.zeros(1, 1));
    this.dofs = 1;

    this.MAP_mean = null;
    this.MAP_std = null;

    this.adj_factors = [];
  }

  update_belief() {
    this.belief.eta = m.Matrix.zeros(this.dofs, 1);
    this.belief.lam = m.Matrix.zeros(this.dofs, this.dofs);

    // Take product of incoming messages
    for(var c=0; c<this.adj_factors.length; c++) {
      var ix = this.adj_factors[c].adj_var_ids.indexOf(this.var_id);
      this.belief.product(this.adj_factors[c].messages[ix])
    }

    // Send new belief to adjacent factors
    for(var c=0; c<this.adj_factors.length; c++) {
      var ix = this.adj_factors[c].adj_var_ids.indexOf(this.var_id);
      this.adj_factors[c].adj_beliefs[ix] = this.belief;
    }
  }
}


export class LinearFactor {
  constructor(dofs, adj_var_ids) {
    this.dofs = dofs;
    this.adj_var_ids = adj_var_ids;
    this.adj_beliefs = [];

    // To compute factor when factor is combination of many factor types (e.g. measurement and smoothness)
    this.jacs = [];
    this.meas = [];
    this.x_meas = [];
    this.lambdas = [];
    this.factor = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));

    this.messages = [new gauss.Gaussian(m.Matrix.zeros(1, 1), m.Matrix.zeros(1, 1)),
                     new gauss.Gaussian(m.Matrix.zeros(1, 1), m.Matrix.zeros(1, 1))];

    this.huber = false;
    this.robust_threshold = 0.8;
    this.robust = false;

    this.dropout = 0;
    this.damping = 0;
  }

  compute_factor() {
    this.factor.eta = m.Matrix.zeros(this.dofs, 1);
    this.factor.lam = m.Matrix.zeros(this.dofs, this.dofs);

    for (var i=0; i<this.jacs.length; i++) {
      let lam = this.lambdas[i]
      if (this.huber && this.adj_beliefs[0].lam.get(0, 0)!=0 && this.adj_beliefs[1].lam.get(0, 0)!=0 ) {
        const means = this.adj_beliefs.map(x => x.getMean().get(0,0));
        const stacked_means = new m.Matrix([[means[0]], [means[1]]]);
        const res = Math.abs(this.jacs[i].mmul(stacked_means).get(0,0) - this.meas[i]);
        const thresh = this.robust_threshold / Math.sqrt(lam)
        if (Math.abs(res) > thresh) {
          lam = 2 * this.robust_threshold * Math.sqrt(lam) / res - this.robust_threshold*this.robust_threshold / (res * res);
          // console.log("robust factor between", this.adj_var_ids[0], this.adj_var_ids[1]);
          this.robust = true;
        } else {
          this.robust = false;
        }
      }
      // console.log(this.adj_var_ids[0], this.adj_var_ids[1], i, lam);
      this.factor.eta.add(this.jacs[i].transpose().mul(lam * this.meas[i]));
      this.factor.lam.add(this.jacs[i].transpose().mmul(this.jacs[i]).mul(lam));
    }
  }

  // Only for bipartite factors where the adjacent vars have 1 dof
  send_mess(ix) {
    if (Math.random() >  this.dropout) {  // Send previous message

      if (ix) {
        const mess1 = new gauss.Gaussian([[0]], [[0]]);
        if (!(this.adj_beliefs[0].lam.get(0, 0)==0 && this.lambdas.length==1)) {  // If message has absolute information
          mess1.eta = new m.Matrix([[this.factor.eta.get(1, 0) - 
            this.factor.lam.get(1, 0) * (this.factor.eta.get(0, 0) + this.adj_beliefs[0].eta.get(0, 0) - this.messages[0].eta.get(0, 0)) / 
            (this.factor.lam.get(0, 0) + this.adj_beliefs[0].lam.get(0, 0) - this.messages[0].lam.get(0, 0))]]);
          mess1.lam = new m.Matrix([[this.factor.lam.get(1, 1) - 
            this.factor.lam.get(1, 0) * this.factor.lam.get(0, 1) / 
            (this.factor.lam.get(0, 0) + this.adj_beliefs[0].lam.get(0, 0) - this.messages[0].lam.get(0, 0))]]);
        }
        this.messages[1] = mess1;
      } else {
        const mess0 = new gauss.Gaussian([[0]], [[0]]);
        if (!(this.adj_beliefs[1].lam.get(0, 0)==0 && this.lambdas.length==1)) {  // If message has absolute information
          mess0.eta = new m.Matrix([[this.factor.eta.get(0, 0) - 
              this.factor.lam.get(0, 1) * (this.factor.eta.get(1, 0) + this.adj_beliefs[1].eta.get(0, 0) - this.messages[1].eta.get(0, 0)) / 
              (this.factor.lam.get(1, 1) + this.adj_beliefs[1].lam.get(0, 0) - this.messages[1].lam.get(0, 0))]]);
          mess0.lam = new m.Matrix([[this.factor.lam.get(0, 0) - 
              this.factor.lam.get(0, 1) * this.factor.lam.get(1, 0) / 
              (this.factor.lam.get(1, 1) + this.adj_beliefs[1].lam.get(0, 0) - this.messages[1].lam.get(0, 0))]]);
        }
        this.messages[0] = mess0;
      }
    }

  }

  send_both_mess(){
    const old_mess0 = this.messages[0];
    this.send_mess(0);
    const new_mess0 = this.messages[0];
    this.messages[0] = old_mess0;
    this.send_mess(1);
    this.messages[0] = new_mess0;
  }
}


export function create1Dgraph(n_var_nodes, smoothness_std, huber = false, dropout = 0.0, damping = 0.0) {

  const graph = new FactorGraph()

  // Create variable nodes
  for(var i=0; i<n_var_nodes; i++) {
    const var_node = new VariableNode(i);
    graph.var_nodes.push(var_node);
  }

  // Create smoothness factors
  const smoothness_jac = new m.Matrix([[-1, 1]]);
  for(var i=0; i<(n_var_nodes-1); i++) {
    const new_factor = new LinearFactor(2, [i, i+1], );
    new_factor.huber = huber;
    new_factor.dropout = dropout;
    new_factor.damping = damping;
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
