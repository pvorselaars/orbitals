import { vector3, matrix3, multiply } from "./tensor.js";

type GpElement = {
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

type Satellite = {
  name: string;
  id: string;
  position: vector3;
  velocity: vector3;
}

type Cache<T> = {
  data: T;
  timestamp: number;
}

const CACHE_DURATION = 1000 * 60 * 60 * 24; // 1 day

const minutesPerDay = 1440;
const secondsPerDay = minutesPerDay * 60;
const mu = 398600.4418; // Earth's gravitational parameter in km^3/s^2

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

function perifocalToGeocentric(v: vector3, incl: number, raan: number, argp: number): vector3 {
  const [x, y, z] = v;

  const cosO = Math.cos(raan);
  const sinO = Math.sin(raan);
  const cosi = Math.cos(incl);
  const sini = Math.sin(incl);
  const cosw = Math.cos(argp);
  const sinw = Math.sin(argp);

  const mat = [
    [cosO * cosw - sinO * sinw * cosi, -cosO * sinw - sinO * cosw * cosi, sinO * sini],
    [sinO * cosw + cosO * sinw * cosi, -sinO * sinw + cosO * cosw * cosi, -cosO * sini],
    [sinw * sini, cosw * sini, cosi]
  ] as matrix3;

  return multiply(mat, v);
}

function sgp(element: GpElement): Satellite{

  // Calculate semimajor axis
  const mm = element.MEAN_MOTION * Math.PI * 2 / secondsPerDay; // convert rev/day to rad/s
  const a = Math.pow(mu / (mm * mm), 1 / 3); // semi-major axis in km

  // TODO: determine near-earth drag constants

  const mo = element.MEAN_ANOMALY * Math.PI / 180;
  const e = element.ECCENTRICITY;
  const E = kepler(mo, e); // eccentric anomaly in radians

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

  // ECI 
  const inclination = element.INCLINATION * Math.PI / 180;
  const raan = element.RA_OF_ASC_NODE * Math.PI / 180;
  const argp = element.ARG_OF_PERICENTER * Math.PI / 180;
  const r_eci = perifocalToGeocentric(rp, inclination, raan, argp);
  const v_eci = perifocalToGeocentric(vp, inclination, raan, argp);

  return { position: r_eci, velocity: v_eci, name: element.OBJECT_NAME, id: element.OBJECT_ID } as Satellite;
}

function getCache<T>(key: string) : T | null {
  const cached = localStorage.getItem(key);

  if (!cached) return null;

  const cache: Cache<T> = JSON.parse(cached);
  if (Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }
}

async function getGpData(): Promise<GpElement[]> {
  
  const cached = getCache<GpElement[]>('data');

  if (cached) return cached;

  // only stations for now
  const response = await fetch('https://celestrak.com/NORAD/elements/gp.php?GROUP=stations&FORMAT=json');

  if (!response.ok) throw new Error('Failed to fetch data');

  const data = await response.json() as GpElement[];

  localStorage.setItem('data', JSON.stringify({ data, timestamp: Date.now() }));
  
  return data;
}

export async function getPositions(): Promise<vector3[]> {

  const cached = getCache<Satellite[]>('satellites');

  if (cached) {
    const positions = cached.map(o => o.position);
    return positions;
  }

  const elements = await getGpData();
  const satellites = elements.map(e => sgp(e))
  const positions = satellites.map(o => o.position);

  localStorage.setItem('satellites', JSON.stringify({ data: satellites, timestamp: Date.now() }));

  return positions;
}