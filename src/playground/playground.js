import * as m from 'ml-matrix';
import * as gauss from '../gaussian';

export class FactorGraph {
  constructor() {
    this.var_nodes = [];
    this.factor_nodes = [];
    this.var_nodes_ids = [];
    this.factor_nodes_ids = [];
  }

  add_var_node(x = 0, y = 0) {
    let next_var_id;
    if (this.var_nodes.length != 0) {
      // Increment last id by 1
      next_var_id = this.var_nodes[this.var_nodes.length - 1].var_id + 1;
    }
    else {
      next_var_id = 0; 
    }
    let new_var_node = new VariableNode(1, next_var_id);
    new_var_node.x = x;
    new_var_node.y = y;
    this.var_nodes.push(new_var_node);
    this.var_nodes_ids.push(next_var_id);
  }

  add_factor_node(x = 0, y = 0) {
    let next_factor_id;
    if (this.factor_nodes.length != 0) {
      // Increment last id by 1
      next_factor_id = this.factor_nodes[this.factor_nodes.length - 1].factor_id + 1;
    }
    else {
      next_factor_id = 0; 
    }
    let new_factor_node = new LinearFactor(1, next_factor_id);
    new_factor_node.x = x;
    new_factor_node.y = y;
    this.factor_nodes.push(new_factor_node);
    this.factor_nodes_ids.push(next_factor_id);
  }

  find_var_node(var_id) {
    return this.var_nodes.filter(var_node => var_node.var_id == var_id)[0];
  }

  find_factor_node(factor_id) {
    return this.factor_nodes.filter(factor_node => factor_node.factor_id == factor_id)[0];
  }

  add_node_connection(var_id, factor_id) {
    if (this.var_nodes_ids.includes(var_id) && this.factor_nodes_ids.includes(factor_id)) { // Check if ids are valid
      let var_node = this.find_var_node(var_id);
      if (! var_node.adj_factor_ids.includes(factor_id)) {
        var_node.adj_factor_ids.push(factor_id);  // Connect factor node to corresponding variable node
      }
    }
  }

  check_node_connection() {
    // Check if all nodes are connected to neighbors
    if (this.var_nodes.some(var_node =>  // Variable nodes with no adjacent factor node
          var_node.adj_factor_ids.length == 0) || // or
        this.factor_nodes_ids.every(id => 
          this.var_nodes.map(var_node => var_node.adj_factor_ids)  // Factor nodes that are connected to variable nodes
          .includes(id))  // Check against all factor nodes
        ) {
      return false;
        }
     else {
       return true
     }
  }
}

export class VariableNode {
  constructor(dofs, var_id, x = 0, y = 0) {
    this.dofs = dofs;
    this.var_id = var_id;
    this.x = x;
    this.y = y;
    this.belief = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));
    this.prior = new gauss.Gaussian(m.Matrix.zeros(dofs, 1), m.Matrix.zeros(dofs, dofs));

    this.adj_factor_ids = [];
  }
}

export class LinearFactor {
  constructor(dofs, factor_id, x = 0, y = 0) {
    this.dofs = dofs;
    this.factor_id = factor_id;
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
  for (let i = 0; i < n_var_nodes; i ++) {
    graph.add_var_node();
  }
  for (let i = 0; i < n_factor_nodes; i ++) {
    graph.add_factor_node();
  }
  for (let i = 0; i < n_var_nodes; i ++) {
    for (let j = 0; j < n_factor_nodes; j ++) {
      graph.add_node_connection(graph.var_nodes_ids[i], graph.factor_nodes_ids[j]);
    }
  }
  console.log(graph);
  return graph
}