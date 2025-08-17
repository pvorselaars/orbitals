import { getCache, saveCache } from "./cache.js";
const minutesPerDay = 1440;
const secondsPerDay = minutesPerDay * 60;
const mu = 398600.4418;
const er = 6378.137;
const J2 = 1.082616e-3;
const J4 = -1.65597e-6;
const k2 = 1 / 2 * J2 * er * er;
const k4 = -3 / 8 * J4 * er ^ 3;
function kepler(M, e, eps = 1e-8) {
    let E = M;
    let i = 0;
    let delta = 1.0;
    if (e > 0.8)
        E = Math.PI;
    while (Math.abs(delta) > eps && i < 100) {
        delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= delta;
        i++;
    }
    return E;
}
function sgp4Init(element) {
    const n0 = element.MEAN_MOTION * Math.PI * 2 / secondsPerDay;
    const a1 = Math.pow(mu / (n0 * n0), 1 / 3);
    const inclination = element.INCLINATION * (Math.PI / 180);
    const cosio = Math.cos(inclination);
    const e = element.ECCENTRICITY;
    const d1 = (3 / 2) * (k2 / (a1 * a1)) * ((3 * cosio * cosio - 1) / Math.pow(1 - e, 3 / 2));
    const a0 = a1 * (1 - 1 / 3 * d1 - d1 * d1 - 134 / 81 * d1 * d1 * d1);
    const q0 = a0 * (1 - e);
    const d0 = (3 / 2) * (k2 / (a0 * a0)) * ((3 * cosio * cosio - 1) / Math.pow(1 - e, 3 / 2));
    const n = n0 / (1 + d0);
    const a = a0 / (1 - d0);
    const apogee = a * (1 + e) - er;
    const perigee = a * (1 - e) - er;
    const s = 1.01222928;
    let s1 = s;
    let qoms2t = Math.pow((q0 - s1), 4);
    if (perigee > 98 && perigee < 156) {
        s1 = 20 / er + er;
    }
    else {
        s1 = a * (1 - e) - s * er;
    }
    if (s1 != s) {
        qoms2t = Math.pow(2 * s - s1 - q0, 4);
    }
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
        position: [0, 0, 0],
        velocity: [0, 0, 0]
    };
}
export function sgp4(satellite, delta_t) {
    const a = satellite.a;
    const e = satellite.eccentricity;
    const m = satellite.m + satellite.n * delta_t;
    const E = kepler(m, e);
    const cosE = Math.cos(E);
    const sinE = Math.sin(E);
    const fac = Math.sqrt(1 - e * e);
    const rp_x = a * (cosE - e);
    const rp_y = a * fac * sinE;
    const rp_z = 0;
    const rp = [rp_x, rp_y, rp_z];
    const p = a * (1 - e * e);
    const rp_dot_x = -Math.sqrt(mu / p) * sinE;
    const rp_dot_y = Math.sqrt(mu / p) * fac * cosE;
    const vp = [rp_dot_x, rp_dot_y, 0];
    satellite.position = rp;
    satellite.velocity = vp;
    return satellite;
}
export async function getSatellites() {
    let cache = getCache('satellites');
    if (cache)
        return cache;
    const response = await fetch('https://celestrak.com/NORAD/elements/gp.php?GROUP=stations&FORMAT=json');
    if (!response.ok)
        throw new Error('Failed to fetch data');
    const elements = await response.json();
    const satellites = elements.map(e => sgp4Init(e));
    cache = saveCache('satellites', satellites);
    return cache;
}
