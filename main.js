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


function calculateScenario(file, contLoad) {
  let b = new Beam()
  b.units = 'US'

  b.length = L_beam // inch

  // ybar = 6.1656441717791
  // Iyy = 15.448822916667
  b.moment = 123.10554703476 // in^4, TODO: confirm the Ixx in EI
  b.modulus = 29e6 // psi

  b.anchorLeft = 'free'
  b.anchorRight = 'free'
  b.addPin(0)
  b.addPin(L_beam) // same for roller except the upward wind

  b.contLoad = contLoad

  b.solve(L_beam * 10) // resolution: 10th of an inch

  // reactions:
  assert.deepEqual(b.grid.filter(x => x.x == 0 && Math.round(x.v * 1e3) / 1e3).length, 1);
  assert.deepEqual(b.grid.filter(x => x.x == L_beam && Math.round(x.v * 1e3) / 1e3).length, 1);
  let Ay = b.grid.filter(x => x.x == 0 && Math.round(x.v * 1e3) / 1e3)[0].v;
  let By = -b.grid.filter(x => x.x == L_beam && Math.round(x.v * 1e3) / 1e3)[0].v;

  let vs = b.grid.map(x => x.v);
  let ms = b.grid.map(x => x.m);
  let ys = b.grid.map(x => x.y);

  console.log(`Processed scenario "${file}":
    Ay: ${engNot(Ay)} lb, By: ${engNot(By)} lb,
    V: ${engNot(Math.min(...vs))} lb to ${engNot(Math.max(...vs))} lb
    M: ${engNot(Math.min(...ms))} lb to ${engNot(Math.max(...ms))} lb
    Y: ${engNot(Math.min(...ys))} in to ${engNot(Math.max(...ys))} in`);

  fs.writeFileSync("csvs/" + file + ".csv", toCSV(b.grid))
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
3. 1.2D + 1.6(L,. or S) + (L or 0.8W)
4. 1.2D + 1.6W + L + 0.5(L,. or S)
5. 1.2D + L + 0.2S
6. 0.9D + 1.6W
7. 0.9D
*/
calculateScenario("C1.00", (x) => 1.4 * D_tot(x));

calculateScenario("C2.10", (x) => 1.2 * D_tot(x) + 1.6 * L_1(x) + 0.5 * S(x));
// does L1 count as live roof load?
// calculateScenario("C2.2", (x) => 1.2 * D_tot(x) + 1.6 * L_1(x) + 0.5 * S(x));

calculateScenario("C3.11", (x) => 1.2 * D_tot(x) + 1.6 * L_1(x) + L_1(x));
calculateScenario("C3.12", (x) => 1.2 * D_tot(x) + 1.6 * L_1(x) + 0.8 * W_1(x)); // upwards wind
calculateScenario("C3.13", (x) => 1.2 * D_tot(x) + 1.6 * L_1(x) + 0.8 * W_2(x)); // downwards wind

calculateScenario("C3.21", (x) => 1.2 * D_tot(x) + 1.6 * S(x) + L_1(x));
calculateScenario("C3.22", (x) => 1.2 * D_tot(x) + 1.6 * S(x) + 0.8 * W_1(x)); // upwards wind
calculateScenario("C3.23", (x) => 1.2 * D_tot(x) + 1.6 * S(x) + 0.8 * W_2(x)); // downwards wind

calculateScenario("C4.11", (x) => 1.2 * D_tot(x) + 1.6 * W_1(x) + L_1(x) + 0.5 * L_1(x)); // upwards wind
calculateScenario("C4.12", (x) => 1.2 * D_tot(x) + 1.6 * W_1(x) + L_1(x) + 0.5 * S(x)); // upwards wind
calculateScenario("C4.21", (x) => 1.2 * D_tot(x) + 1.6 * W_2(x) + L_1(x) + 0.5 * L_1(x)); // downwards wind
calculateScenario("C4.22", (x) => 1.2 * D_tot(x) + 1.6 * W_2(x) + L_1(x) + 0.5 * S(x)); // downwards wind

calculateScenario("C5.00", (x) => 1.2 * D_tot(x) + L_1(x) + 0.2 * S(x));

calculateScenario("C6.10", (x) => 0.9 * D_tot(x) + 1.6 * W_1(x)); // upwards wind
calculateScenario("C6.20", (x) => 0.9 * D_tot(x) + 1.6 * W_2(x)); // downwards wind

calculateScenario("C7.00", (x) => 0.9 * D_tot(x));