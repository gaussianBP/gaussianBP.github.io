import * as m from 'ml-matrix';
import * as gauss from '../gaussian';
import { getEllipse } from '../gaussian';

var offset_distance_tolerance = 10;

export class FactorGraph {
  constructor() {
    this.var_nodes = [];
    this.factor_nodes = [];
  }

  find_node(id) {
    id = parseInt(id);
    var var_node = this.var_nodes.filter(var_node => var_node.id == id)[0];
    var factor_node = this.factor_nodes.filter(factor_node => factor_node.id == id)[0];
    if (var_node) {
      return var_node;
    }
    else if (factor_node) {
      return factor_node;
    }
    else {
      return null;
    }
  }

  find_edge(node1_id, node2_id) {
    node1_id = parseInt(node1_id);
    node2_id = parseInt(node2_id);
    if (this.find_node(node1_id).adj_ids.includes(node2_id) &&
      this.find_node(node2_id).adj_ids.includes(node1_id)) {
      return true;
    }
    else {
      return false;
    }
  }

  find_factor_node(node1_id, node2_id) {
    node1_id = parseInt(node1_id);
    node2_id = parseInt(node2_id);
    if (node1_id == node2_id) {
      return null;
    }
    for (var i = 0; i < this.factor_nodes.length; i++) {
      if (this.find_edge(this.factor_nodes[i].id, node1_id) &&
        this.find_edge(this.factor_nodes[i].id, node2_id)) {
        return this.factor_nodes[i]
      }
    }
    return null;
  }

  find_element(x, y) {
    for (var i = 0; i < this.var_nodes.length; i++) {
      if (Math.sqrt(Math.pow(this.var_nodes[i].x - x, 2) +
        Math.pow(this.var_nodes[i].y - y, 2)) <= offset_distance_tolerance) {
        return this.var_nodes[i];
      }
    }
    for (var i = 0; i < this.factor_nodes.length; i++) {
      if (Math.sqrt(Math.pow(this.factor_nodes[i].x - x, 2) +
        Math.pow(this.factor_nodes[i].y - y, 2)) <= offset_distance_tolerance) {
        return this.factor_nodes[i];
      }
    }
  }

  remove_node(id) {
    var node = this.find_node(parseInt(id));
    if (node.type == 'var_node') {
      // Id corresponds to a var_node
      this.var_nodes = this.var_nodes.filter(var_node => var_node.id != node.id);
      // Also remove this node from adj_ids
      this.factor_nodes = this.factor_nodes.filter(factor_node => !factor_node.adj_ids.includes(node.id));
      this.update_node_id();
      return true;
    }
    else if (node.type == 'factor_node') {
      // Id corresponds to a factor_node
      this.factor_nodes = this.factor_nodes.filter(factor_node => factor_node.id != node.id);
      for (var i = 0; i < this.var_nodes.length; i++) {
        this.var_nodes[i].adj_ids = this.var_nodes[i].adj_ids.filter(adj_id => adj_id != node.id);
      }
      this.update_node_id();
      return true;
    }
    else {
      // Id has no match
      return false;
    }
  }

  update_node_id() {
    var ids = this.var_nodes.map(var_node => var_node.id)
      .concat(this.factor_nodes.map(factor_node => factor_node.id));  // Collect all ids
    ids = ids.sort((a, b) => a - b);  // Sort all ids by ascending order
    var id_diff = new Array(ids[ids.length - 1]);  // Create array with length matching the largest id
    var running_sum;  // Use running sum to avoid nested loops
    for (var i = 0; i < ids.length; i++) {
      if (i != 0) {
        running_sum = running_sum + ids[i] - ids[i - 1] - 1;  // Accumulates the sum when ids are not consecutive
      }
      else {
        running_sum = ids[i];  // First node should always be 0, so the first id is the starting running_sum
      }
      id_diff[ids[i]] = running_sum;  // Only assign values to id indices that match existing nodes
    }
    for (var i = 0; i < this.var_nodes.length; i++) {
      // Update id for each var_node according to id_diff
      this.var_nodes[i].id -= id_diff[this.var_nodes[i].id];
      for (var j = 0; j < this.var_nodes[i].adj_ids.length; j++) {
        this.var_nodes[i].adj_ids[j] -= id_diff[this.var_nodes[i].adj_ids[j]];
      }
    }
    for (var i = 0; i < this.factor_nodes.length; i++) {
      // Update id for each factor_node and adj_ids according to id_diff
      this.factor_nodes[i].id -= id_diff[this.factor_nodes[i].id];
      for (var j = 0; j < this.factor_nodes[i].adj_ids.length; j++) {
        this.factor_nodes[i].adj_ids[j] -= id_diff[this.factor_nodes[i].adj_ids[j]];
      }
    }
  }

  update_cov_ellipse() {
    for (var i = 0; i < this.var_nodes.length; i++) {
      var var_node = this.var_nodes[i]
      var values = var_node.belief.getCovEllipse();
      var_node.belief_ellipse.cx = var_node.belief.getMean().get(0, 0);
      var_node.belief_ellipse.cy = var_node.belief.getMean().get(1, 0);
      var_node.belief_ellipse.rx = Math.sqrt(values[0][0]);
      var_node.belief_ellipse.ry = Math.sqrt(values[0][1]);
      var_node.belief_ellipse.angle = values[1];
    }
  }

  update_factor_node_location() {
    for (var i = 0; i < this.factor_nodes.length; i++) {
      var factor_node = this.factor_nodes[i]
      var x = 0;
      var y = 0;
      for (var j = 0; j < factor_node.adj_ids.length; j++) {
        var adj_var_node = this.find_node(factor_node.adj_ids[j]);
        x += adj_var_node.x;
        y += adj_var_node.y;
      }
      x /= factor_node.adj_ids.length;
      y /= factor_node.adj_ids.length;
      factor_node.x = x;
      factor_node.y = y;
    }
  }

  pass_message(node1_id, node2_id) {
    // TODO: temporary implementation, need to integrate to gbp2d
    // FIXME: 
    var node1 = this.find_node(parseInt(node1_id));
    var node2 = this.find_node(parseInt(node2_id));
    if (node1.id == node2.id) {
      node1.pass_message(this);
    }
    else {
      var factor_node = this.find_factor_node(node1.id, node2.id);
      if (factor_node) {
        node1.send_message(this);
        factor_node.pass_message(this);
        node2.receive_message(this);
      }
      else {
        return false;
      }
    }
    return true
  }

  check_connection() {
    // Check if all nodes are connected to neighbors
    if (this.factor_nodes.every(factor_node => factor_node.adj_ids.length != 0) &&  // Every factor node has adjacent variable nodes
      this.var_nodes.every(var_node => var_node.adj_ids.length != 0))  // Every variable node is connected to some factor nodes
    {
      return true;
    }
    return false;
  }

  compute_error() {
    var total_error = 0;
    for (var i = 0; i < this.var_nodes.length; i++) {
      total_error += Math.sqrt(Math.pow(this.var_nodes[i].x - this.var_nodes[i].belief.getMean().get(0, 0), 2) +
        Math.pow(this.var_nodes[i].y - this.var_nodes[i].belief.getMean().get(1, 0), 2));
    }
    return total_error;
  }

  compute_MAP() {
    var total_dofs = 0;
    for (var i = 0; i < this.var_nodes.length; i ++) {
      total_dofs += this.var_nodes[i].dofs;
    }
    const bigEta = m.Matrix.zeros(total_dofs, 1);
    const bigLam = m.Matrix.zeros(total_dofs, total_dofs);
    const var_ids = this.var_nodes.map(var_node => var_node.id);

    // Add priors
    for (var i = 0; i < this.var_nodes.length; i ++) {
      new m.MatrixSubView(bigEta, i * 2, (i + 1) * 2 - 1, 0, 0).add(this.find_node(var_ids[i]).prior.eta);
      new m.MatrixSubView(bigLam, i * 2, (i + 1) * 2 - 1, i * 2, (i + 1) * 2 - 1).add(this.find_node(var_ids[i]).prior.lam);
    }

    // Add factors
    for (var i = 0; i < this.factor_nodes.length; i++) {
      const f_p1_eta = new m.Matrix(new m.MatrixSubView(this.factor_nodes[i].factor.eta, 0, 1, 0, 0));
      const f_p2_eta = new m.Matrix(new m.MatrixSubView(this.factor_nodes[i].factor.eta, 2, 3, 0, 0));
      const f_p1_lam = new m.Matrix(new m.MatrixSubView(this.factor_nodes[i].factor.lam, 0, 1, 0, 1));
      const f_p2_lam = new m.Matrix(new m.MatrixSubView(this.factor_nodes[i].factor.lam, 2, 3, 2, 3));
      const f_p1_p2_lam = new m.Matrix(new m.MatrixSubView(this.factor_nodes[i].factor.lam, 0, 1, 2, 3));
      const f_p2_p1_lam = new m.Matrix(new m.MatrixSubView(this.factor_nodes[i].factor.lam, 2, 3, 0, 1));

      var c_id1 = var_ids.indexOf(this.factor_nodes[i].adj_ids[0]) * 2;
      var c_id2 = var_ids.indexOf(this.factor_nodes[i].adj_ids[1]) * 2;
      new m.MatrixSubView(bigEta, c_id1, c_id1 + 1, 0, 0).add(f_p1_eta);
      new m.MatrixSubView(bigEta, c_id2, c_id2 + 1, 0, 0).add(f_p2_eta);
      new m.MatrixSubView(bigLam, c_id1, c_id1 + 1, c_id1, c_id1 + 1).add(f_p1_lam);
      new m.MatrixSubView(bigLam, c_id2, c_id2 + 1, c_id2, c_id2 + 1).add(f_p2_lam);
      new m.MatrixSubView(bigLam, c_id1, c_id1 + 1, c_id2, c_id2 + 1).add(f_p1_p2_lam);
      new m.MatrixSubView(bigLam, c_id2, c_id2 + 1, c_id1, c_id1 + 1).add(f_p2_p1_lam);
    }

    const bigCov = m.inverse(bigLam);
    const means = bigCov.mmul(bigEta);
    for (var i = 0; i < this.var_nodes.length; i ++) {
      var cov = new m.Matrix(new m.MatrixSubView(bigCov, 2 * i, 2 * i + 1, 2 * i, 2 * i + 1));
      var values = getEllipse(cov);
      this.var_nodes[i].MAP_ellipse.cx = means.get(2 * i, 0);
      this.var_nodes[i].MAP_ellipse.cy = means.get(2 * i + 1, 0);
      this.var_nodes[i].MAP_ellipse.rx = Math.sqrt(values[0][0]);
      this.var_nodes[i].MAP_ellipse.ry = Math.sqrt(values[0][1]);
      this.var_nodes[i].MAP_ellipse.angle = values[1];
    }
    return [means, bigCov];
  }

  compare_to_MAP() {
    var bp_means = [];
    for (var i = 0; i < this.var_nodes.length; i ++) {
      bp_means.push(this.var_nodes[i].belief.getMean().get(0,0));
      bp_means.push(this.var_nodes[i].belief.getMean().get(1,0));
    }

    const means = new m.Matrix([bp_means]);
    const map = this.compute_MAP()[0];
    return (map.sub(means.transpose())).norm();
  }

  node_distance(node1_id, node2_id) {
    var node1 = this.find_node(parseInt(node1_id));
    var node2 = this.find_node(parseInt(node2_id));
    return Math.sqrt(Math.pow(node1.x - node2.x, 2) +
      Math.pow(node1.y - node2.y, 2));
  }
}

export class VariableNode {
  constructor(dofs, id, x = 0, y = 0) {
    this.type = 'var_node';
    this.dofs = dofs;
    this.id = id;
    this.belief = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));
    this.prior = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));
    this.adj_ids = [];
    this.x = x;
    this.y = y;
    this.belief_ellipse = {
      cx: 0,
      cy: 0,
      rx: 0,
      ry: 0,
      angle: 0
    };
    this.MAP_ellipse = {
      cx: 0,
      cy: 0,
      rx: 0,
      ry: 0,
      angle: 0
    };
  }

  receive_message(graph, node_id = null) {
    node_id = parseInt(node_id);
    this.belief.eta = this.prior.eta.clone();
    this.belief.lam = this.prior.lam.clone();
    // console.log('var node', this.id, 'receive message');
    for (var i = 0; i < this.adj_ids.length; i++) {
      if (!node_id || node_id == this.adj_ids[i]) {
        var factor_node = graph.find_node(this.adj_ids[i]);
        var idx = factor_node.adj_ids.indexOf(this.id);
        this.belief.product(factor_node.messages[idx]);
      }
    }
  }

  send_message(graph, node_id = null) {
    node_id = parseInt(node_id);
    // console.log('var node', this.id, 'send message');
    for (var i = 0; i < this.adj_ids.length; i++) {
      if (!node_id || node_id == this.adj_ids[i]) {
        var factor_node = graph.find_node(this.adj_ids[i]);
        var idx = factor_node.adj_ids.indexOf(this.id);
        factor_node.adj_beliefs[idx] = this.belief;
      }
    }
  }

  pass_message(graph) {
    this.receive_message(graph);
    this.send_message(graph);
  }
}

export class LinearFactor {
  constructor(dofs, id, adj_ids) {
    this.type = 'factor_node';
    this.dofs = dofs;
    this.id = id;
    this.adj_ids = adj_ids;//.sort((a, b) => a - b);
    this.adj_var_dofs = [];
    this.adj_beliefs = [];

    // To compute factor when factor is combination of many factor types (e.g. measurement and smoothness)
    this.jacs = [];
    this.meas = [];
    this.meas_noise = [];
    this.lambdas = [];
    this.factor = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));
    this.incoming_id = null;
    this.messages = [];
    this.eta_damping = 0.;

    this.x = 0;
    this.y = 0;
  }

  compute_factor() {
    this.factor.eta = m.Matrix.zeros(this.dofs, 1);
    this.factor.lam = m.Matrix.zeros(this.dofs, this.dofs);
    for (var i = 0; i < this.jacs.length; i++) {
      this.factor.eta.add(this.jacs[i].transpose().mmul(this.meas[i]).mul(this.lambdas[i]));
      this.factor.lam.add(this.jacs[i].transpose().mmul(this.jacs[i]).mul(this.lambdas[i]));
    }
  }

  pass_message(graph) {
    for (var i = 0; i < this.adj_ids.length; i++) {
      var eta_factor = this.factor.eta.clone();
      var lam_factor = this.factor.lam.clone();

      // Take product with incoming messages, general for factor connected to arbitrary num var nodes
      var mess_start_dim = 0;
      for (var j = 0; j < this.adj_ids.length; j++) {
        if (i != j) {
          const eta_prod = m.Matrix.sub(this.adj_beliefs[j].eta, this.messages[j].eta);
          const lam_prod = m.Matrix.sub(this.adj_beliefs[j].lam, this.messages[j].lam);
          new m.MatrixSubView(eta_factor, mess_start_dim, mess_start_dim + this.adj_var_dofs[j] - 1, 0, 0).add(eta_prod);
          new m.MatrixSubView(lam_factor, mess_start_dim, mess_start_dim + this.adj_var_dofs[j] - 1, mess_start_dim, mess_start_dim + this.adj_var_dofs[j] - 1).add(lam_prod);
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

      const message = new gauss.Gaussian([[0], [0]], [[0, 0], [0, 0]]);
      const block = lono.mmul(m.inverse(lnono));
      message.eta = new m.Matrix(eo.sub(block.mmul(eno)));
      message.eta.mul(1 - this.eta_damping);
      message.eta.add(this.messages[i].eta.mul(this.eta_damping));
      message.lam = new m.Matrix(loo.sub(block.mmul(lnoo)));
      this.messages[i] = message;
    }
  }
}

export function print(content) {
  console.log(content);
}