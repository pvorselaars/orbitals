import { multiply } from "./tensor.js";
import { getCache, saveCache } from "./cache.js";
const minutesPerDay = 1440;
const secondsPerDay = minutesPerDay * 60;
const mu = 398600.4418;
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
function perifocalToGeocentric(v, incl, raan, argp) {
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
    ];
    return multiply(mat, v);
}
export function sgp(element, delta_t) {
    const mm = element.MEAN_MOTION * Math.PI * 2 / secondsPerDay;
    const a = Math.pow(mu / (mm * mm), 1 / 3);
    const m0 = element.MEAN_ANOMALY * Math.PI / 180;
    const m = m0 + mm * delta_t;
    const e = element.ECCENTRICITY;
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
    const inclination = element.INCLINATION * Math.PI / 180;
    const raan = element.RA_OF_ASC_NODE * Math.PI / 180;
    const argp = element.ARG_OF_PERICENTER * Math.PI / 180;
    const r_eci = perifocalToGeocentric(rp, inclination, raan, argp);
    const v_eci = perifocalToGeocentric(vp, inclination, raan, argp);
    return { position: r_eci, velocity: v_eci, name: element.OBJECT_NAME, id: element.OBJECT_ID };
}
export async function getElements() {
    let cache = getCache('elements');
    if (cache)
        return cache;
    const response = await fetch('https://celestrak.com/NORAD/elements/gp.php?GROUP=stations&FORMAT=json');
    if (!response.ok)
        throw new Error('Failed to fetch data');
    const data = await response.json();
    cache = saveCache('elements', data);
    return cache;
}
