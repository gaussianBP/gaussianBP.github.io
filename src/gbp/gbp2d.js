import * as m from 'ml-matrix';
import * as gauss from '../utils/gaussian';

export class FactorGraph {
  constructor() {
    this.pose_nodes = [];
    this.lmk_nodes = [];

    this.factors = [];
  }

  update_beliefs() {
    for(var c=0; c<this.pose_nodes.length; c++) {
      this.pose_nodes[c].update_belief();
    }
    for(var c=0; c<this.lmk_nodes.length; c++) {
      this.lmk_nodes[c].update_belief();
    }
 
  }

  send_messages() {
    for(var c=0; c<this.factors.length; c++) {
      this.factors[c].send_mess();
    }

  }

  sync_iter() {
    this.send_messages();
    this.update_beliefs();
  }

  energy() {
    let energy = 0.;
    for(var c=0; c<this.factors.length; c++) {
      energy += this.factors[c].energy();
    }
  }

  relinearise() {
    for (var c=0; c<this.factors.length; c++) {
      this.factors[c].compute_factor();
    }
  }


  computeMAP(n_landmarks, lmk_graph_ix) {
    var tot_dofs = 0;
    for(var c=0; c<this.pose_nodes.length; c++) {
      tot_dofs += this.pose_nodes[c].dofs;
    }
    for(var c=0; c<this.lmk_nodes.length; c++) {
      tot_dofs += this.lmk_nodes[c].dofs;
    }

    const bigEta = m.Matrix.zeros(tot_dofs, 1);
    const bigLam = m.Matrix.zeros(tot_dofs, tot_dofs);

    // Add priors
    var l_dofs = 2 * this.lmk_nodes.length;
    for(var c=0; c<this.pose_nodes.length; c++) {
      new m.MatrixSubView(bigEta, l_dofs+c*2, l_dofs+(c+1)*2-1, 0, 0).add(this.pose_nodes[c].prior.eta);
      new m.MatrixSubView(bigLam, l_dofs+c*2, l_dofs+(c+1)*2-1, l_dofs+c*2, l_dofs+(c+1)*2-1).add(this.pose_nodes[c].prior.lam);
    }
    for(var c=0; c<this.lmk_nodes.length; c++) {
      new m.MatrixSubView(bigEta, c*2, (c+1)*2-1, 0, 0).add(this.lmk_nodes[c].prior.eta);
      new m.MatrixSubView(bigLam, c*2, (c+1)*2-1, c*2, (c+1)*2-1).add(this.lmk_nodes[c].prior.lam);
    }

    // Add factors
    for(var c=0; c<this.factors.length; c++) {
      if (this.factors[c].adj_var_ids[1] < n_landmarks) {
        const f_pose_eta = new m.MatrixSubView(this.factors[c].factor.eta, 0, 1, 0, 0);
        const f_lmk_eta = new m.MatrixSubView(this.factors[c].factor.eta, 2, 3, 0, 0);
        const f_pose_lam = new m.MatrixSubView(this.factors[c].factor.lam, 0, 1, 0, 1);
        const f_lmk_lam = new m.MatrixSubView(this.factors[c].factor.lam, 2, 3, 2, 3);
        const f_pose_lmk_lam = new m.MatrixSubView(this.factors[c].factor.lam, 0, 1, 2, 3);
        const f_lmk_pose_lam = new m.MatrixSubView(this.factors[c].factor.lam, 2, 3, 0, 1);

        var c_id = this.lmk_nodes.length + this.factors[c].adj_var_ids[0] - n_landmarks;
        var l_id = lmk_graph_ix[this.factors[c].adj_var_ids[1]];
        new m.MatrixSubView(bigEta, c_id*2, (c_id+1)*2-1, 0, 0).add(f_pose_eta);
        new m.MatrixSubView(bigEta, l_id*2, (l_id+1)*2-1, 0, 0).add(f_lmk_eta);
        new m.MatrixSubView(bigLam, c_id*2, (c_id+1)*2-1, c_id*2, (c_id+1)*2-1).add(f_pose_lam);
        new m.MatrixSubView(bigLam, l_id*2, (l_id+1)*2-1, l_id*2, (l_id+1)*2-1).add(f_lmk_lam);
        new m.MatrixSubView(bigLam, c_id*2, (c_id+1)*2-1, l_id*2, (l_id+1)*2-1).add(f_pose_lmk_lam);
        new m.MatrixSubView(bigLam, l_id*2, (l_id+1)*2-1, c_id*2, (c_id+1)*2-1).add(f_lmk_pose_lam);
      } else {
        const f_p1_eta = new m.Matrix(new m.MatrixSubView(this.factors[c].factor.eta, 0, 1, 0, 0));
        const f_p2_eta = new m.Matrix(new m.MatrixSubView(this.factors[c].factor.eta, 2, 3, 0, 0));
        const f_p1_lam = new m.Matrix(new m.MatrixSubView(this.factors[c].factor.lam, 0, 1, 0, 1));
        const f_p2_lam = new m.Matrix(new m.MatrixSubView(this.factors[c].factor.lam, 2, 3, 2, 3));
        const f_p1_p2_lam = new m.Matrix(new m.MatrixSubView(this.factors[c].factor.lam, 0, 1, 2, 3));
        const f_p2_p1_lam = new m.Matrix(new m.MatrixSubView(this.factors[c].factor.lam, 2, 3, 0, 1));

        var c_id1 = this.lmk_nodes.length + this.factors[c].adj_var_ids[0] - n_landmarks;
        var c_id2 = this.lmk_nodes.length + this.factors[c].adj_var_ids[1] - n_landmarks;
        new m.MatrixSubView(bigEta, c_id1*2, (c_id1+1)*2-1, 0, 0).add(f_p1_eta);
        new m.MatrixSubView(bigEta, c_id2*2, (c_id2+1)*2-1, 0, 0).add(f_p2_eta);
        new m.MatrixSubView(bigLam, c_id1*2, (c_id1+1)*2-1, c_id1*2, (c_id1+1)*2-1).add(f_p1_lam);
        new m.MatrixSubView(bigLam, c_id2*2, (c_id2+1)*2-1, c_id2*2, (c_id2+1)*2-1).add(f_p2_lam);
        new m.MatrixSubView(bigLam, c_id1*2, (c_id1+1)*2-1, c_id2*2, (c_id2+1)*2-1).add(f_p1_p2_lam);
        new m.MatrixSubView(bigLam, c_id2*2, (c_id2+1)*2-1, c_id1*2, (c_id1+1)*2-1).add(f_p2_p1_lam);
      }
    }

    const bigCov = m.inverse(bigLam);
    const means = bigCov.mmul(bigEta);
    return [means, bigCov];
  }

  compare_to_MAP(n_landmarks, lmk_graph_ix) {
    var gbp_means = [];
    for(var c=0; c<this.lmk_nodes.length; c++) {
      gbp_means.push(this.lmk_nodes[c].belief.getMean().get(0,0));
      gbp_means.push(this.lmk_nodes[c].belief.getMean().get(1,0));
    }
    for(var c=0; c<this.pose_nodes.length; c++) {
      gbp_means.push(this.pose_nodes[c].belief.getMean().get(0,0));
      gbp_means.push(this.pose_nodes[c].belief.getMean().get(1,0));
    }

    const means = new m.Matrix([gbp_means]);
    const map = this.computeMAP(n_landmarks, lmk_graph_ix)[0];
    var av_diff = (map.sub(means.transpose())).norm();
    return av_diff;
  }

}

export class VariableNode {
  constructor(dofs, var_id) {
    this.dofs = dofs;
    this.var_id = var_id;
    this.belief = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));
    this.prior = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));

    this.adj_factors = [];
  }

  update_belief() {
    this.belief.eta = this.prior.eta.clone();
    this.belief.lam = this.prior.lam.clone();

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


export class NonLinearFactor {
  constructor(dofs, adj_var_ids, measFn, jacFn) {
    this.dofs = dofs;
    this.adj_var_ids = adj_var_ids;
    this.adj_beliefs = [];
    this.adj_var_dofs = [];

    this.meas;
    this.lambda;
    this.factor = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));
    this.linpoint;

    this.jacFn = jacFn;
    this.measFn = measFn;

    this.messages = [];

    this.eta_damping = 0.;
  }

  compute_factor() {
    const cam_coords = this.adj_beliefs[0].getMean();
    const lmk_coords = this.adj_beliefs[1].getMean();
    this.linpoint = new m.Matrix([[cam_coords.get(0,0)], [cam_coords.get(1,0)], [lmk_coords.get(0,0)], [lmk_coords.get(1,0)]]);
    let jac = this.jacFn(cam_coords, lmk_coords);

    const measurement = this.measFn(cam_coords, lmk_coords);
    const bracket = jac.mmul(this.linpoint).add(this.meas).sub(measurement);
    this.factor.eta = (jac.transpose().mmul(this.lambda)).mmul(bracket);
    this.factor.lam = (jac.transpose().mmul(this.lambda)).mmul(jac);
  }

  energy() {
    var res = this.meas_fn(cam_coords, lmk_coords).sub(this.meas);
    return 0.5 * res.mmul(this.lambda).mmul(res);
  }

  send_mess() {
    var start_dim = 0;
    
    for (var i=0; i<this.adj_var_ids.length; i++) {
      var eta_factor = this.factor.eta.clone();
      var lam_factor = this.factor.lam.clone();

      // Take product with incoming messages, general for factor connected to arbitrary num var nodes
      var mess_start_dim = 0;
      for (var j=0; j<this.adj_var_ids.length; j++) {
        if (!(i == j)) {
          const eta_prod = m.Matrix.sub(this.adj_beliefs[j].eta, this.messages[j].eta);
          const lam_prod = m.Matrix.sub(this.adj_beliefs[j].lam, this.messages[j].lam);
          new m.MatrixSubView(eta_factor, mess_start_dim, mess_start_dim + this.adj_var_dofs[j] -1, 0, 0).add(eta_prod);
          new m.MatrixSubView(lam_factor, mess_start_dim, mess_start_dim + this.adj_var_dofs[j] -1, mess_start_dim, mess_start_dim + this.adj_var_dofs[j] -1).add(lam_prod);
        }
        mess_start_dim += this.adj_var_dofs[j];
      }

      // For factor connecting 2 variable nodes
      if (i == 0) {
        var eo = new m.MatrixSubView(eta_factor, 0, 1, 0, 0);
        var eno = new m.MatrixSubView(eta_factor, 2, 3, 0, 0);
        var loo = new m.MatrixSubView(lam_factor, 0, 1, 0, 1);
        var lnono = new m.MatrixSubView(lam_factor, 2, 3, 2, 3);
        var lnoo = new m.MatrixSubView(lam_factor, 2, 3, 0, 1);
        var lono = new m.MatrixSubView(lam_factor, 0, 1, 2, 3);
      } else if (i == 1) {
        var eno = new m.MatrixSubView(eta_factor, 0, 1, 0, 0);
        var eo = new m.MatrixSubView(eta_factor, 2, 3, 0, 0);
        var lnono = new m.MatrixSubView(lam_factor, 0, 1, 0, 1);
        var loo = new m.MatrixSubView(lam_factor, 2, 3, 2, 3);
        var lono = new m.MatrixSubView(lam_factor, 2, 3, 0, 1);
        var lnoo = new m.MatrixSubView(lam_factor, 0, 1, 2, 3);
      }

      const mess = new gauss.Gaussian([[0],[0]], [[0,0],[0,0]]);
      const block = lono.mmul(m.inverse(lnono));
      mess.eta = new m.Matrix(eo.sub(block.mmul(eno)));
      mess.eta.mul(1-this.eta_damping);
      mess.eta.add(this.messages[i].eta.mul(this.eta_damping));
      mess.lam = new m.Matrix(loo.sub(block.mmul(lnoo)));
      this.messages[i] = mess;
    }

  }
}




export class LinearFactor {
  constructor(dofs, adj_var_ids) {
    this.dofs = dofs;
    this.adj_var_ids = adj_var_ids;
    this.adj_beliefs = [];
    this.adj_var_dofs = [];

    // To compute factor when factor is combination of many factor types (e.g. measurement and smoothness)
    this.jacs = [];
    this.meas = [];
    this.lambdas = [];
    this.factor = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));

    this.messages = [];

    this.eta_damping = 0.;
  }

  compute_factor() {
    this.factor.eta = m.Matrix.zeros(this.dofs, 1);
    this.factor.lam = m.Matrix.zeros(this.dofs, this.dofs);
    for (var i=0; i<this.jacs.length; i++) {
      this.factor.eta.add(this.jacs[i].transpose().mmul(this.meas[i]).mul(this.lambdas[i]));
      this.factor.lam.add(this.jacs[i].transpose().mmul(this.jacs[i]).mul(this.lambdas[i]));
    }
  }

  energy() {
    const cam_coords = this.adj_beliefs[0].getMean();
    const lmk_coords = this.adj_beliefs[1].getMean();
    linpoint = new m.Matrix([[cam_coords.get(0,0)], [cam_coords.get(1,0)], [lmk_coords.get(0,0)], [lmk_coords.get(1,0)]]);

    var res = this.jacs[0].mmul(linpoint).sub(this.meas[0]);
    return 0.5 * res.mmul(this.lambdas[0]).mmul(res);
  }

  send_mess() {
    var start_dim = 0;
    
    for (var i=0; i<this.adj_var_ids.length; i++) {
      var eta_factor = this.factor.eta.clone();
      var lam_factor = this.factor.lam.clone();

      // Take product with incoming messages, general for factor connected to arbitrary num var nodes
      var mess_start_dim = 0;
      for (var j=0; j<this.adj_var_ids.length; j++) {
        if (!(i == j)) {
          const eta_prod = m.Matrix.sub(this.adj_beliefs[j].eta, this.messages[j].eta);
          const lam_prod = m.Matrix.sub(this.adj_beliefs[j].lam, this.messages[j].lam);
          new m.MatrixSubView(eta_factor, mess_start_dim, mess_start_dim + this.adj_var_dofs[j] -1, 0, 0).add(eta_prod);
          new m.MatrixSubView(lam_factor, mess_start_dim, mess_start_dim + this.adj_var_dofs[j] -1, mess_start_dim, mess_start_dim + this.adj_var_dofs[j] -1).add(lam_prod);
        }
        mess_start_dim += this.adj_var_dofs[j];
      }

      // For factor connecting 2 variable nodes
      if (i == 0) {
        var eo = new m.MatrixSubView(eta_factor, 0, 1, 0, 0);
        var eno = new m.MatrixSubView(eta_factor, 2, 3, 0, 0);
        var loo = new m.MatrixSubView(lam_factor, 0, 1, 0, 1);
        var lnono = new m.MatrixSubView(lam_factor, 2, 3, 2, 3);
        var lnoo = new m.MatrixSubView(lam_factor, 2, 3, 0, 1);
        var lono = new m.MatrixSubView(lam_factor, 0, 1, 2, 3);
      } else if (i == 1) {
        var eno = new m.MatrixSubView(eta_factor, 0, 1, 0, 0);
        var eo = new m.MatrixSubView(eta_factor, 2, 3, 0, 0);
        var lnono = new m.MatrixSubView(lam_factor, 0, 1, 0, 1);
        var loo = new m.MatrixSubView(lam_factor, 2, 3, 2, 3);
        var lono = new m.MatrixSubView(lam_factor, 2, 3, 0, 1);
        var lnoo = new m.MatrixSubView(lam_factor, 0, 1, 2, 3);
      }

      const mess = new gauss.Gaussian([[0],[0]], [[0,0],[0,0]]);
      const block = lono.mmul(m.inverse(lnono));
      mess.eta = new m.Matrix(eo.sub(block.mmul(eno)));
      mess.eta.mul(1-this.eta_damping);
      mess.eta.add(this.messages[i].eta.mul(this.eta_damping));
      mess.lam = new m.Matrix(loo.sub(block.mmul(lnoo)));
      this.messages[i] = mess;
    }

  }
}

