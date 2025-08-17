export class Cache<T>  {
    constructor(public data: T, public timestamp: number) {}

    invalid() : boolean {
        return Date.now() - this.timestamp > CACHE_DURATION
    };
}

export const CACHE_DURATION = 1000 * 60 * 60 * 24; // 1 day

export function getCacheData<T>(key: string) : T | null {
  const cached = getCache<T>(key);

  if (!cached) return null;

  if (!cached.invalid()){
    return cached.data;
  } else {
    return null
  }
}

export function getCache<T>(key: string) : Cache<T> | null {
  const cached = localStorage.getItem(key);

  if (!cached) return null;

  const cache = JSON.parse(cached) as { data: T; timestampe: number};

  return new Cache<T>(cache.data, cache.timestampe);
}

export function saveCache<T>(key: string, data: any) : Cache<T> {
  const t = Date.now();
  localStorage.setItem(key, JSON.stringify({ data, timestamp: t}));
  return new Cache<T>(data, t);
}