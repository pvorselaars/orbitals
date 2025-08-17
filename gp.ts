import { getCache, saveCache, Cache } from "./cache.js";
import { vector3 } from "./tensor.js";

export type GpElement = {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  BSTAR: number;
  EPHEMERIS_TYPE: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  CLASSIFICATION_TYPE: "U" | "C" | "S";
}

export type Satellite = {
  name: string;
  id: string;
  epoch: number;
  n: number;
  a: number;
  s: number;
  m: number;
  raan: number;
  inclination: number;
  cosio: number;
  eccentricity: number;
  perigee: number;
  apogee: number;
  argp: number;
  position: vector3;
  velocity: vector3;
}

const minutesPerDay = 1440;
const secondsPerDay = minutesPerDay * 60;
const mu = 398600.4418; // Earth's gravitational parameter in km^3/s^2
const er = 6378.137; // Earth's equatorial radius in km
const J2 = 1.082616e-3;
const J4 = -1.65597e-6;
const k2 = 1/2*J2*er*er;
const k4 = -3/8*J4*er^3;

function kepler(M: number, e: number, eps = 1e-8): number {
  let E = M;
  let i = 0;
  let delta = 1.0;

  if (e > 0.8) E = Math.PI; // for high eccentricities, start with E = π

  while (Math.abs(delta) > eps && i < 100) {
    delta = (E - e*Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    i++;
  }

  return E;
}

export function sgp4Init(element: GpElement): Satellite {

  // Reconstruct original mean motion and semimajor axis
  const n0 = element.MEAN_MOTION * Math.PI * 2 / secondsPerDay; // convert rev/day to rad/s
  const a1 = Math.pow(mu / (n0 * n0), 1 / 3); // semi-major axis in km

  const inclination = element.INCLINATION * (Math.PI / 180);
  const cosio = Math.cos(inclination);
  const e = element.ECCENTRICITY;
  const d1 = (3/2)*(k2/(a1*a1))*((3*cosio*cosio-1)/Math.pow(1 - e, 3/2))

  const a0 = a1 * (1 - 1/3*d1 - d1*d1 - 134/81*d1*d1*d1);

  const q0 = a0*(1-e);

  const d0 = (3/2)*(k2/(a0*a0))*((3*cosio*cosio-1)/Math.pow(1 - e, 3/2))

  const n = n0 / (1 + d0);
  const a = a0 / (1 - d0);

  const apogee = a * (1 + e) - er;
  const perigee = a * (1 - e) - er;
  const s = 1.01222928;
  let s1 = s;
  let qoms2t = Math.pow((q0 - s1), 4);
  if (perigee > 98 && perigee < 156) {
    s1 = 20 / er + er;
  } else {
    s1 = a * (1 - e)  - s * er;
  }
  if (s1 != s) {
    qoms2t = Math.pow(2*s - s1 - q0, 4);
  }

  /* TODO: Calculate constants

  const xi = 1/(a - s);
  const b0 = Math.sqrt(1-e*e);
  const theta = cosio;
  const etha = a*e*xi;

  const C2 = 0;
  const C1 = element.BSTAR*C2;
  const C3 = 0;
  const C4 = 0;

  const D2 = 4*a*xi*C1*C1;
  const D3 = (4/3)*a*xi*xi*(17*a+s)*C1*C1*C1;
  const D4 = (2/3)*a*xi*xi*xi*(221*a+31*s)*C1*C1*C1*C1;

  */

  const ms = (new Date(element.EPOCH)).getTime();

  return {
    name: element.OBJECT_NAME,
    id: element.OBJECT_ID,
    epoch: ms,
    m: element.MEAN_ANOMALY * (Math.PI / 180),
    n: n,
    a: a,
    s: s,
    perigee: perigee,
    apogee: apogee,
    eccentricity: element.ECCENTRICITY,
    inclination: inclination,
    cosio: cosio,
    raan: element.RA_OF_ASC_NODE * (Math.PI / 180),
    argp: element.ARG_OF_PERICENTER * (Math.PI / 180),
    position: [0,0,0],
    velocity: [0,0,0]
  };
}

export function sgp4(satellite: Satellite, delta_t: number): Satellite{

  const a = satellite.a;
  const e = satellite.eccentricity;
  const m = satellite.m + satellite.n * delta_t;
  const E = kepler(m, e);

  // perifocal position
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const fac = Math.sqrt(1 - e * e);
  const rp_x = a * (cosE - e);
  const rp_y = a * fac * sinE;
  const rp_z = 0;

  const rp = [rp_x, rp_y, rp_z] as vector3;

  // perifocal velocity
  const p = a * (1 - e * e); 
  const rp_dot_x = -Math.sqrt(mu / p) * sinE;
  const rp_dot_y = Math.sqrt(mu / p) * fac * cosE;
  const vp = [rp_dot_x, rp_dot_y, 0] as vector3; 

  satellite.position = rp;
  satellite.velocity = vp;

  return satellite as Satellite;
}
