export class Cache {
    data;
    timestamp;
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    invalid() {
        return Date.now() - this.timestamp > CACHE_DURATION;
    }
    ;
}
export const CACHE_DURATION = 1000 * 60 * 60 * 24;
export function getCacheData(key) {
    const cached = getCache(key);
    if (!cached)
        return null;
    if (!cached.invalid()) {
        return cached.data;
    }
    else {
        return null;
    }
}
export function getCache(key) {
    const cached = localStorage.getItem(key);
    if (!cached)
        return null;
    const cache = JSON.parse(cached);
    return new Cache(cache.data, cache.timestampe);
}
export function saveCache(key, data) {
    const t = Date.now();
    localStorage.setItem(key, JSON.stringify({ data, timestamp: t }));
    return new Cache(data, t);
}
