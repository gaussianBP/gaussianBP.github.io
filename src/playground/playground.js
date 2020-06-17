import * as m from 'ml-matrix';
import * as gauss from '../gaussian';

let offset_distance_tolerance = 10;

export class FactorGraph {
  constructor() {
    this.last_node = null;
    this.var_nodes = [];
    this.factor_nodes = [];
  }

  add_var_node(x = 0, y = 0) {
    let var_node;
    if (this.last_node) {
      var_node = new VariableNode(1, this.last_node.id + 1, x, y);
    }
    else {
      var_node = new VariableNode(1, 0, x, y);
    }
    this.var_nodes.push(var_node);
    this.last_node = var_node;
  }

  add_factor_node(x = 0, y = 0) {
    let factor_node;
    if (this.last_node) {
      factor_node = new LinearFactor(1, this.last_node.id + 1, x, y);
    }
    else {
      factor_node = new LinearFactor(1, 0, x, y);
    }
    this.factor_nodes.push(factor_node);
    this.last_node = factor_node;
  }

  find_node(id) {
    id = parseInt(id);
    let var_node = this.var_nodes.filter(var_node => var_node.id == id)[0];
    let factor_node = this.factor_nodes.filter(factor_node => factor_node.id == id)[0];
    if (var_node) {
      return var_node;
    }
    else if (factor_node) {
      return factor_node;
    }
    else {
      return false;
    }
  }

  remove_node(id) {
    id = parseInt(id);
    if (this.var_nodes.map(var_node => var_node.id).includes(id)) {
      // Id corresponds to a var_node
      this.var_nodes = this.var_nodes.filter(var_node => var_node.id != id);
      this.update_node_id();
      return true;
    }
    else if (this.factor_nodes.map(factor_node => factor_node.id).includes(id)) {
      // Id corresponds to a factor_node
      this.factor_nodes = this.factor_nodes.filter(factor_node => factor_node.id != id);
      for (let i = 0; i < this.var_nodes.length; i++) {
        // Also remove this node from adj_factor_ids
        this.var_nodes[i].adj_factor_ids = this.var_nodes[i].adj_factor_ids.filter(factor_id => factor_id != id);
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
    let ids = this.var_nodes.map(var_node => var_node.id)
      .concat(this.factor_nodes.map(factor_node => factor_node.id));  // Collect all ids
    ids = ids.sort((a, b) => a - b);  // Sort all ids by ascending order
    if (ids) {
      this.last_node = this.find_node(ids[ids.length - 1]);
    }
    else {
      // If there is no node, remove last_node
      this.last_node = null;
    }
    let id_diff = new Array(ids[ids.length - 1]);  // Create array with length matching the largest id
    let running_sum;  // Use running sum to avoid nested loops
    for (let i = 0; i < ids.length; i++) {
      if (i != 0) {
        running_sum = running_sum + ids[i] - ids[i - 1] - 1;  // Accumulates the sum when ids are not consecutive
      }
      else {
        running_sum = ids[i];  // First node should always be 0, so the first id is the starting running_sum
      }
      id_diff[ids[i]] = running_sum;  // Only assign values to id indices that match existing nodes
    }
    for (let i = 0; i < this.var_nodes.length; i++) {
      // Update id for each var_node and adj_factor_ids according to id_diff
      this.var_nodes[i].id = this.var_nodes[i].id - id_diff[this.var_nodes[i].id];
      this.var_nodes[i].adj_factor_ids = this.var_nodes[i].adj_factor_ids.map(adj_factor_id => adj_factor_id - id_diff[adj_factor_id]);
    }
    for (let i = 0; i < this.factor_nodes.length; i++) {
      // Update id for each factor_node according to id_diff
      this.factor_nodes[i].id = this.factor_nodes[i].id - id_diff[this.factor_nodes[i].id];
    }
  }

  find_element(x, y) {
    for (let i = 0; i < this.var_nodes.length; i++) {
      if (Math.sqrt(Math.pow(this.var_nodes[i].x - x, 2) +
        Math.pow(this.var_nodes[i].y - y, 2)) <= offset_distance_tolerance) {
        console.log(this.var_nodes[i])
        return this.var_nodes[i];
      }
    }
    for (let i = 0; i < this.factor_nodes.length; i++) {
      if (Math.sqrt(Math.pow(this.factor_nodes[i].x - x, 2) +
        Math.pow(this.factor_nodes[i].y - y, 2)) <= offset_distance_tolerance) {
        console.log(this.factor_nodes[i])
        return this.factor_nodes[i];
      }
    }
  }

  add_connection(node1_id, node2_id) {
    node1_id = parseInt(node1_id);
    node2_id = parseInt(node2_id);
    let node1 = this.find_node(node1_id);
    let node2 = this.find_node(node2_id);
    if (node1.type == 'var_node' && node2.type == 'factor_node') {
      if (!node1.adj_factor_ids.includes(node2_id)) {  // If node2 is not already connected
        node1.adj_factor_ids.push(node2_id);
        return true;
      }
    }
    else if (node1.type == 'factor_node' && node2.type == 'var_node') {
      if (!node2.adj_factor_ids.includes(node1_id)) {  // If node1 is not already connected
        node2.adj_factor_ids.push(node1_id);
        return true;
      }
    }
    else {
      return false;
    }
  }

  pass_message(node1_id, node2_id) {
    // TODO: temporary implementation, need to integrate to gbp2d
    node1_id = parseInt(node1_id);
    node2_id = parseInt(node2_id);
    let node1 = this.find_node(node1_id);
    let node2 = this.find_node(node2_id);
    if (node1.type == 'var_node' && node2.type == 'factor_node') {
      if (node1.adj_factor_ids.includes(node2_id)) {  // If node2 is not already connected
        return true;
      }
    }
    else if (node1.type == 'factor_node' && node2.type == 'var_node') {
      if (node2.adj_factor_ids.includes(node1_id)) {  // If node2 is not already connected
        return true;
      }
    }
    else {
      return false;
    }
  }

  remove_connection(node1_id, node2_id) {
    node1_id = parseInt(node1_id);
    node2_id = parseInt(node2_id);
    let node1 = this.find_node(node1_id);
    let node2 = this.find_node(node2_id);
    if (node1.type == 'var_node' && node2.type == 'factor_node') {
      if (node1.adj_factor_ids.includes(node2_id)) {  // If node2 is not already connected
        node1.adj_factor_ids = node1.adj_factor_ids.filter(adj_factor_id => adj_factor_id != node2_id);
        return true;
      }
    }
    else if (node1.type == 'factor_node' && node2.type == 'var_node') {
      if (node2.adj_factor_ids.includes(node1_id)) {  // If node2 is not already connected
        node2.adj_factor_ids = node2.adj_factor_ids.filter(adj_factor_id => adj_factor_id != node1_id);
        return true;
      }
    }
    else {
      return false;
    }
  }

  check_connection() {
    // Check if all nodes are connected to neighbors
    // TODO: Check for global connection, i.e. all nodes are interconnected forming only one graph
    let adj_factor_ids = this.var_nodes.map(var_node => var_node.adj_factor_ids).flat();
    if (this.var_nodes.every(var_node =>  // Every variable node has adjacent factor nodes
      var_node.adj_factor_ids.length != 0) &&
      this.factor_nodes.every(factor_node =>
        adj_factor_ids.includes(factor_node.id))  // Factor nodes that are connected to variable nodes
    ) {
      return true;
    }
    else {
      return false;
    }
  }
}

export class VariableNode {
  constructor(dofs, id, x = 0, y = 0) {
    this.type = 'var_node';
    this.dofs = dofs;
    this.id = id;
    this.x = x;
    this.y = y;
    this.belief = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));
    this.prior = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));

    this.adj_factor_ids = [];
    this.el = null;
  }
}

export class LinearFactor {
  constructor(dofs, id, x = 0, y = 0) {
    this.type = 'factor_node';
    this.dofs = dofs;
    this.id = id;
    this.x = x;
    this.y = y;

    this.adj_beliefs = [];
    // To compute factor when factor is combination of many factor types (e.g. measurement and smoothness)
    this.jacs = [];
    this.meas = [];
    this.lambdas = [];
    this.factor = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));

    this.messages = [];
  }
}

export function createNewPlayground(n_var_nodes = 2, n_factor_nodes = 1) {
  let graph = new FactorGraph()
  for (let i = 0; i < n_var_nodes; i++) {
    graph.add_var_node(50 + 50 * i, 50);
  }
  for (let i = 0; i < n_factor_nodes; i++) {
    graph.add_factor_node(75 + 50 * i, 100);
  }
  for (let i = 0; i < n_var_nodes; i++) {
    for (let j = 0; j < n_factor_nodes; j++) {
      graph.add_connection(graph.var_nodes[i].id, graph.factor_nodes[j].id);
    }
  }
  console.log(graph);
  return graph
}