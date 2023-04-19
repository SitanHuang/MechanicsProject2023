import Beam from './Beam.mjs'
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';

function assertApprox(a, b, prec=1000) {
  assert.deepEqual(Math.round(a * prec) / prec, Math.round(b * prec) / prec);
}

const engNot = (number, decimalPlaces = 2) => {
  if (number === 0) return "0"

  let exponent = Math.floor(Math.log10(Math.abs(number)) / 3) * 3;
  let coefficient = number / Math.pow(10, exponent);

  if (exponent < 3) {
    exponent = 0;
    coefficient = Math.round(number * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
  }

  return `${coefficient.toFixed(decimalPlaces)}${exponent === 0 ? "" : `e${exponent}`}`;
};

function toCSV(arr, keys) {
  let table = ''
  if (!arr.length) return table


  keys = keys || Object.keys(arr[0])

  table += keys.join(",") + '\n'

  arr.forEach(r => {
    table += keys.map(x => r[x]).join(",") + '\n'
  })

  return table
}

// ############### Configuration ###############
const L_beam = 22 * 12 // in
// psf * (corresponding area above beam) / L_beam * (1ft/12in)
const C_distr = (12 * L_beam) / L_beam / 12 // psf -> lb/in distribute dload

// 8.15in^2 * 0.284 lb/in^3 = lb/in
const D_beam = () => 8.15 * 0.284 // dead load of beam's weight in lb/in, obtained by specific weight * area
const D_applied = () => 20 * C_distr
const D_tot = (x) => D_beam(x) + D_applied(x)
const L_1 = () => 15 * C_distr // "Live Load" (roof live load)
const S = (x) => C_distr * (x <= (2 * L_beam / 3) ? 40 * (1 - x * 3 / 2 / L_beam * 0.75) : 10) // Snow load: (roof live load)
const W_1 = () => -30 * C_distr // UPWARDS!!!
const W_2 = (x) => C_distr * (x <= L_beam / 2 ? 35 : 20)
const W_tot = (x) => W_1(x) + W_2(x)


assertApprox(W_tot(0), W_1(0) + 35 * C_distr)
assertApprox(W_2(L_beam / 2), 35 * C_distr)
assertApprox(W_2(L_beam / 2 + 0.1), 20 * C_distr)
assertApprox(W_2(L_beam), 20 * C_distr)
assertApprox(S(0), 40 * C_distr)
assertApprox(S(L_beam), 10 * C_distr)
assertApprox(S(L_beam * 2 / 3), 10 * C_distr)

function findExtrema(grid, key) {
  let max = -Infinity;
  let maxLocation = null;
  let min = Infinity;
  let minLocation = null;

  for (let i = 0; i < grid.length; i++) {
    const element = grid[i];

    if (element[key] > max) {
      max = element[key];
      maxLocation = element.x;
    }

    if (element[key] < min) {
      min = element[key];
      minLocation = element.x;
    }
  }

  return [
    max,
    Math.round(maxLocation * 10) / 10,
    min,
    Math.round(minLocation * 10) / 10,
  ];
}

function findClosestToZero(grid, key) {
  let minDiff = Infinity;
  let closestPair = {};

  for (let i = 1; i < grid.length; i++) {
    const prev = grid[i - 1];
    const curr = grid[i];

    if (Math.sign(prev[key]) !== Math.sign(curr[key])) {
      const diff = Math.abs(prev[key]) + Math.abs(curr[key]);

      if (diff < minDiff) {
        minDiff = diff;
        closestPair.prev = prev;
        closestPair.curr = curr;
      }
    }
  }

  if (closestPair.prev === undefined) {
    throw new Error('No sign change found in the given grid and key.');
  }

  const interpolationFactor = Math.abs(closestPair.prev[key]) / (Math.abs(closestPair.prev[key]) + Math.abs(closestPair.curr[key]));
  const x = closestPair.prev.x + interpolationFactor * (closestPair.curr.x - closestPair.prev.x);

  return x;
}

let overallTable = 'File,Ay,By,min(V),max(V),min(M),max(M),min(Y),max(Y),x(v=0),x(m=0),x(v=min(V)),x(v=max(V)),x(m=min(M)),x(m=max(M))\n';

function calculateScenario(file, contLoad, changeInSupport=false) {
  let b = new Beam()
  b.units = 'US'

  b.length = L_beam // inch

  b.moment = 123.10554703476 // in^4
  b.modulus = 29e6 // psi

  b.anchorLeft = 'free'
  b.anchorRight = 'free'
  b.addPin(0)
  
  if (changeInSupport)
    b.addPin(L_beam - 8 * 12)

  b.addPin(L_beam) // same for roller except the upward wind


  b.contLoad = contLoad

  b.solve(L_beam * 10) // resolution: 10th of an inch

  // reactions:
  let Ay = b.soln.pin0;
  let By = changeInSupport ? b.soln.pin2 : b.soln.pin1;
  let Cy = changeInSupport ? b.soln.pin1 : b.soln.pin2;

  let ys = b.grid.map(x => x.y);

  let vIntercept = Math.round(10 * findClosestToZero(b.grid, 'v')) / 10;
  let mIntercept = Math.round(10 * findClosestToZero(b.grid, 'm')) / 10;

  let [ vmax, xvmax, vmin, xvmin ] = findExtrema(b.grid, 'v');
  let [ mmax, xmmax, mmin, xmmin ] = findExtrema(b.grid, 'm');

  overallTable += `${file},${engNot(Ay)},${engNot(By)},${engNot(vmin)},${engNot(vmax)},${engNot(mmin)},${engNot(mmax)},${engNot(Math.min(...ys))},${engNot(Math.max(...ys))},${vIntercept},${mIntercept},${xvmin},${xvmax},${xmmin},${xmmax}\n`;

  let text = `Ay: ${engNot(Ay)} lb, By: ${engNot(By)} lb,
    ${changeInSupport ? `Cy: ${engNot(Cy)} lb` : ''}
    V: ${engNot(vmin)} lb to ${engNot(vmax)} lb
    M: ${engNot(mmin)} lb to ${engNot(mmax)} lb
    Y: ${engNot(Math.min(...ys))} in to ${engNot(Math.max(...ys))} in`;
  console.log(`Processed scenario "${file}":
    ${text}`);

  fs.writeFileSync("csvs/" + file + ".csv", toCSV(b.grid))
  fs.writeFileSync("csvs/" + file + ".txt", text.replace(/ +/g, ' ').replace(/\n/g, ' '))
}

/*
D = dead load;
L = live load;
Lr = roof live load;
S = snow load;
W = wind load;

16 combos:

1. 1.4(D)
2. 1.2(D) + 1.6(L) + 0.5(Lr or S)
3. 1.2D + 1.6(Lr,. or S) + (L or 0.8W)
4. 1.2D + 1.6W + L + 0.5(Lr,. or S)
5. 1.2D + L + 0.2S
6. 0.9D + 1.6W
*/
calculateScenario("C1.00", (x) => 1.4 * D_tot(x));
    
calculateScenario("C2.10", (x) => 1.2 * D_tot(x) + 0.5 * S(x));
calculateScenario("C2.11", (x) => 1.2 * D_tot(x) + 0.5 * L_1(x));

calculateScenario("C3.11", (x) => 1.2 * D_tot(x) + 1.6 * L_1(x) + 0.8 * W_1(x)); // upwards wind
calculateScenario("C3.12", (x) => 1.2 * D_tot(x) + 1.6 * L_1(x) + 0.8 * W_2(x)); // downwards wind

calculateScenario("C3.21", (x) => 1.2 * D_tot(x) + 1.6 * S(x) + 0.8 * W_1(x)); // upwards wind
calculateScenario("C3.22", (x) => 1.2 * D_tot(x) + 1.6 * S(x) + 0.8 * W_2(x)); // downwards wind

calculateScenario("C4.11", (x) => 1.2 * D_tot(x) + 1.6 * W_1(x) + 0.5 * L_1(x)); // upwards wind
calculateScenario("C4.12", (x) => 1.2 * D_tot(x) + 1.6 * W_1(x) + 0.5 * S(x)); // upwards wind
calculateScenario("C4.21", (x) => 1.2 * D_tot(x) + 1.6 * W_2(x) + 0.5 * L_1(x)); // downwards wind
calculateScenario("C4.22", (x) => 1.2 * D_tot(x) + 1.6 * W_2(x) + 0.5 * S(x)); // downwards wind

calculateScenario("C5.00", (x) => 1.2 * D_tot(x) + 0.2 * S(x));

calculateScenario("C6.10", (x) => 0.9 * D_tot(x) + 1.6 * W_1(x)); // upwards wind
calculateScenario("C6.20", (x) => 0.9 * D_tot(x) + 1.6 * W_2(x)); // downwards wind

fs.writeFileSync("csvs/summary.csv", overallTable)

calculateScenario("C3.22.S", (x) => 1.2 * D_tot(x) + 1.6 * S(x) + 0.8 * W_2(x), true);
calculateScenario("C4.22.S", (x) => 1.2 * D_tot(x) + 1.6 * W_2(x) + 0.5 * S(x), true);