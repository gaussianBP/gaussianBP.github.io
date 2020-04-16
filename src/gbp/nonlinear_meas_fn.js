// Non-linear measurement of bearing and distance between 2D points

import * as m from 'ml-matrix';

//   // Measurement function for nonlinear bearing and distance measurement
//   export function measFn(cam_coords, lmk_coords, offset=Math.PI/4) {
//       var d;
//       var theta;
//       if ((cam_coords instanceof m.Matrix) && (lmk_coords instanceof m.Matrix)) {
//           d = Math.sqrt(Math.pow(lmk_coords.get(0,0)-cam_coords.get(0,0), 2) + Math.pow(lmk_coords.get(1,0)-cam_coords.get(1,0), 2));
//           // var atan_arg = (lmk_coords.get(1,0)-cam_coords.get(1,0)) / (lmk_coords.get(0,0)-cam_coords.get(0,0)) - offset;
//           // console.log(atan_arg, offset, (lmk_coords.get(1,0)-cam_coords.get(1,0)) / (lmk_coords.get(0,0)-cam_coords.get(0,0)))
//           theta = Math.atan((lmk_coords.get(1,0)-cam_coords.get(1,0)) / (lmk_coords.get(0,0)-cam_coords.get(0,0)) - offset);
//       } else{
//           d = Math.sqrt(Math.pow(lmk_coords.x-cam_coords.x, 2) + Math.pow(lmk_coords.y-cam_coords.y, 2));
//           var atan_arg = (lmk_coords.y - cam_coords.y) / (lmk_coords.x - cam_coords.x) - offset;
//           console.log(atan_arg, offset, (lmk_coords.y - cam_coords.y) / (lmk_coords.x - cam_coords.x));
//           theta = Math.atan((lmk_coords.y - cam_coords.y) / (lmk_coords.x - cam_coords.x) - offset);
//       }
//       let measurement = new m.Matrix([[theta], [d]]);
//       return measurement;
//   }


//   // Jacobian function for nonlinear bearing and distance measurement
//   export function jacFn(cam_coords, lmk_coords, offset=Math.PI/4) {
//     var x1 = cam_coords.get(0,0);
//     var y1 = cam_coords.get(1,0);
//     var x2 = lmk_coords.get(0,0);
//     var y2 = lmk_coords.get(1,0);
//     var d = Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
//     var dx = x2 - x1;
//     var dy = y2 - y1;
//     // var denominator = Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2);
//     var j00 = dy / (Math.pow(dx,2) * ( 1 + Math.pow(dy/dx - offset, 2)));
//     var j01 = -1 / (dx * ( 1 + Math.pow(dy/dx - offset, 2)));
//     var j02 = -j00;
//     var j03 = -j01;
//     var j10 = -(x2-x1) / d;
//     var j11 = -(y2-y1) / d;
//     var j12 = (x2-x1) / d;
//     var j13 = (y2-y1) / d;

//     return new m.Matrix([[j00, j01, j02, j03], [j10, j11, j12, j13]]);
//   }

// export function jacFnFd(cam_coords, lmk_coords, offset=Math.PI/4) {
//   var delta = 0.00001;
//   var jac_fd = new m.Matrix([[0,0,0,0], [0,0,0,0]]);

//     const meas = measFn(cam_coords, lmk_coords, offset);

//   for(var c=0; c<2; c++) {
//     var new_cam_coords = cam_coords.clone();
//     var addition = m.Matrix.zeros(2, 1);
//     addition.set(c, 0, delta);
//     new_cam_coords.add(addition);
//     const new_meas = measFn(new_cam_coords, lmk_coords, offset);

//     jac_fd.set(0, c, (new_meas.get(0,0) - meas.get(0,0)) / delta);
//     jac_fd.set(1, c, (new_meas.get(1,0) - meas.get(1,0)) / delta);
//   }

//   for(var c=0; c<2; c++) {
//     var new_lmk_coords = lmk_coords.clone();
//     var addition = m.Matrix.zeros(2, 1);
//     addition.set(c, 0, delta);
//     new_lmk_coords.add(addition);
//     const new_meas = measFn(cam_coords, new_lmk_coords, offset);

//     jac_fd.set(0, c+2, (new_meas.get(0,0) - meas.get(0,0)) / delta);
//     jac_fd.set(1, c+2, (new_meas.get(1,0) - meas.get(1,0)) / delta);
//   }
//   return jac_fd;
// }


// export function checkJac(cam_coords, lmk_coords, offset=Math.PI/4) {
//     var jac = jacFn(cam_coords, lmk_coords, offset);
//     var jac_fd = jacFnFd(cam_coords, lmk_coords, offset);

//     var diff = m.Matrix.sub(jac, jac_fd)
//     console.log('Jacbian check av difference', diff.norm());
// }



// Measurement function for nonlinear bearing and distance measurement
export function measFnR(cam_coords, lmk_coords) {
    var d;
    var theta;
    if ((cam_coords instanceof m.Matrix) && (lmk_coords instanceof m.Matrix)) {
        d = Math.sqrt(Math.pow(lmk_coords.get(0,0)-cam_coords.get(0,0), 2) + Math.pow(lmk_coords.get(1,0)-cam_coords.get(1,0), 2));
        theta = Math.atan2(lmk_coords.get(1,0)-cam_coords.get(1,0), lmk_coords.get(0,0)-cam_coords.get(0,0));
    } else{
        d = Math.sqrt(Math.pow(lmk_coords.x-cam_coords.x, 2) + Math.pow(lmk_coords.y-cam_coords.y, 2));
        theta = Math.atan2(lmk_coords.y - cam_coords.y, lmk_coords.x - cam_coords.x);
    }
    let measurement = new m.Matrix([[theta], [d]]);
    return measurement;
}


// Jacobian function for nonlinear bearing and distance measurement
export function jacFnR(cam_coords, lmk_coords) {
	var x1 = cam_coords.get(0,0);
	var y1 = cam_coords.get(1,0);
	var x2 = lmk_coords.get(0,0);
	var y2 = lmk_coords.get(1,0);
 	var d = Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
	var denominator = Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2);
    var j00 = (y2-y1) / denominator;
    var j01 = -(x2-x1) / denominator;
    var j02 = -(y2-y1) / denominator;
    var j03 = (x2-x1) / denominator;
	var j10 = -(x2-x1) / d;
	var j11 = -(y2-y1) / d;
	var j12 = (x2-x1) / d;
	var j13 = (y2-y1) / d;

	return new m.Matrix([[j00, j01, j02, j03], [j10, j11, j12, j13]]);
}

export function measFnL(cam_coords, lmk_coords) {
    var d;
    var theta;
    if ((cam_coords instanceof m.Matrix) && (lmk_coords instanceof m.Matrix)) {
        d = Math.sqrt(Math.pow(lmk_coords.get(0,0)-cam_coords.get(0,0), 2) + Math.pow(lmk_coords.get(1,0)-cam_coords.get(1,0), 2));
        theta = Math.atan2(lmk_coords.get(1,0)-cam_coords.get(1,0), -lmk_coords.get(0,0)+cam_coords.get(0,0));
    } else{
        d = Math.sqrt(Math.pow(lmk_coords.x-cam_coords.x, 2) + Math.pow(lmk_coords.y-cam_coords.y, 2));
        theta = Math.atan2(lmk_coords.y - cam_coords.y, -lmk_coords.x + cam_coords.x);
    }
    let measurement = new m.Matrix([[theta], [d]]);
    return measurement;
}


// Jacobian function for nonlinear bearing and distance measurement
export function jacFnL(cam_coords, lmk_coords) {
    var x1 = cam_coords.get(0,0);
    var y1 = cam_coords.get(1,0);
    var x2 = lmk_coords.get(0,0);
    var y2 = lmk_coords.get(1,0);
    var d = Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
    var denominator = Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2);
    var j00 = -(y2-y1) / denominator;
    var j01 = (x2-x1) / denominator;
    var j02 = (y2-y1) / denominator;
    var j03 = -(x2-x1) / denominator;
    var j10 = -(x2-x1) / d;
    var j11 = -(y2-y1) / d;
    var j12 = (x2-x1) / d;
    var j13 = (y2-y1) / d;

    return new m.Matrix([[j00, j01, j02, j03], [j10, j11, j12, j13]]);
}

export function jacFnFd(cam_coords, lmk_coords, measFn) {
	var delta = 0.00001;
	var jac_fd = new m.Matrix([[0,0,0,0], [0,0,0,0]]);

    const meas = measFn(cam_coords, lmk_coords);

	for(var c=0; c<2; c++) {
		var new_cam_coords = cam_coords.clone();
		var addition = m.Matrix.zeros(2, 1);
		addition.set(c, 0, delta);
		new_cam_coords.add(addition);
    const new_meas = measFn(new_cam_coords, lmk_coords);

    jac_fd.set(0, c, (new_meas.get(0,0) - meas.get(0,0)) / delta);
    jac_fd.set(1, c, (new_meas.get(1,0) - meas.get(1,0)) / delta);
  }

	for(var c=0; c<2; c++) {
		var new_lmk_coords = lmk_coords.clone();
		var addition = m.Matrix.zeros(2, 1);
		addition.set(c, 0, delta);
		new_lmk_coords.add(addition);
    const new_meas = measFn(cam_coords, new_lmk_coords);

    jac_fd.set(0, c+2, (new_meas.get(0,0) - meas.get(0,0)) / delta);
    jac_fd.set(1, c+2, (new_meas.get(1,0) - meas.get(1,0)) / delta);
  }
  return jac_fd;
}


export function checkJac(cam_coords, lmk_coords, measFn, jacFn) {
    var jac = jacFn(cam_coords, lmk_coords);
    var jac_fd = jacFnFd(cam_coords, lmk_coords, measFn);

    var diff = m.Matrix.sub(jac, jac_fd)
    console.log('Jacbian check av difference', diff.norm());
}
