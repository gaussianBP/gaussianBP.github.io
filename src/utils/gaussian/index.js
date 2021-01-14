import * as m from 'ml-matrix';

export class Gaussian {
    constructor(eta, lam) {
      // TODO: Consider saving the dimension
      if ((eta instanceof m.Matrix) && (lam instanceof m.Matrix)) {
        this.eta = eta;
        this.lam = lam;
      } else {
        this.eta = new m.Matrix([eta]).transpose();
        this.lam = new m.Matrix(lam);
      }
    }
  
    getCov() {
      return m.inverse(this.lam);
    }
  
    getMean() {
      const cov = this.getCov();
      return cov.mmul(this.eta);
    }
  
    // Take product of gaussian with other gaussian
    product(gaussian) {
      this.eta.add(gaussian.eta);
      this.lam.add(gaussian.lam);
    }
  
    getCovEllipse() {
      var cov = this.getCov();
      var e = new m.EigenvalueDecomposition(cov);
      var real = e.realEigenvalues;
  
      // Eigenvectors are always orthogonal
      var vectors = e.eigenvectorMatrix;
      var angle = Math.atan(vectors.get(1, 0) / vectors.get(0, 0))
      return [real, angle]
    }
}

export function getEllipse(cov) {
  var e = new m.EigenvalueDecomposition(cov);
  var real = e.realEigenvalues;

  // Eigenvectors are always orthogonal
  var vectors = e.eigenvectorMatrix;
  var angle = Math.atan(vectors.get(1, 0) / vectors.get(0, 0))
  return [real, angle]
}
