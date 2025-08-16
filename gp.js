const CACHE_DURATION = 1000 * 60 * 60 * 24;
function multiply(m, v) {
    const [x, y, z] = v;
    return [
        m[0][0] * x + m[0][1] * y + m[0][2] * z,
        m[1][0] * x + m[1][1] * y + m[1][2] * z,
        m[2][0] * x + m[2][1] * y + m[2][2] * z
    ];
}
function ortho(v) {
    const [x, y] = v;
    return [x, y];
}
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
function sgp(element) {
    const mm = element.MEAN_MOTION * Math.PI * 2 / secondsPerDay;
    const a = Math.pow(mu / (mm * mm), 1 / 3);
    const mo = element.MEAN_ANOMALY * Math.PI / 180;
    const e = element.ECCENTRICITY;
    const E = kepler(mo, e);
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
function getCache(key) {
    const cached = localStorage.getItem(key);
    if (!cached)
        return null;
    const cache = JSON.parse(cached);
    if (Date.now() - cache.timestamp < CACHE_DURATION) {
        return cache.data;
    }
}
async function getGpData() {
    const cached = getCache('data');
    if (cached)
        return cached;
    const response = await fetch('https://celestrak.com/NORAD/elements/gp.php?GROUP=stations&FORMAT=json');
    if (!response.ok)
        throw new Error('Failed to fetch data');
    const data = await response.json();
    localStorage.setItem('data', JSON.stringify({ data, timestamp: Date.now() }));
    return data;
}
export async function getPoints() {
    const cached = getCache('satellites');
    if (cached) {
        const positions = cached.flatMap(o => ortho(o.position));
        return new Float32Array(positions);
    }
    const elements = await getGpData();
    const objects = elements.map(e => sgp(e));
    const positions = objects.flatMap(o => ortho(o.position));
    localStorage.setItem('satellites', JSON.stringify({ data: objects, timestamp: Date.now() }));
    return new Float32Array(positions);
}
