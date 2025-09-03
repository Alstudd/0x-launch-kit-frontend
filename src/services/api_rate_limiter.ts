interface RateLimitConfig {
    maxRequests: number;
    timeWindowMs: number;
    cacheDurationMs: number;
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

class ApiRateLimiter {
    private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
    private caches: Map<string, CacheEntry<any>> = new Map();

    private readonly defaultConfigs: Map<string, RateLimitConfig> = new Map([
        ['binance', { maxRequests: 10, timeWindowMs: 60000, cacheDurationMs: 300000 }],
        ['infura', { maxRequests: 5, timeWindowMs: 60000, cacheDurationMs: 120000 }],
        ['default', { maxRequests: 20, timeWindowMs: 60000, cacheDurationMs: 300000 }]
    ]);

    public canMakeRequest(apiName: string): boolean {
        const config = this.defaultConfigs.get(apiName) || this.defaultConfigs.get('default')!;
        const now = Date.now();
        const key = `${apiName}_${Math.floor(now / config.timeWindowMs)}`;
        
        const current = this.requestCounts.get(key);
        if (!current || now > current.resetTime) {
            this.requestCounts.set(key, { count: 1, resetTime: now + config.timeWindowMs });
            return true;
        }
        
        if (current.count < config.maxRequests) {
            current.count++;
            return true;
        }
        
        return false;
    }

    public getCachedData<T>(apiName: string, key: string): T | null {
        const config = this.defaultConfigs.get(apiName) || this.defaultConfigs.get('default')!;
        const cacheKey = `${apiName}_${key}`;
        const entry = this.caches.get(cacheKey);
        
        if (entry && Date.now() < entry.expiresAt) {
            return entry.data;
        }
        
        return null;
    }

    public cacheData<T>(apiName: string, key: string, data: T): void {
        const config = this.defaultConfigs.get(apiName) || this.defaultConfigs.get('default')!;
        const cacheKey = `${apiName}_${key}`;
        const now = Date.now();
        
        this.caches.set(cacheKey, {
            data,
            timestamp: now,
            expiresAt: now + config.cacheDurationMs
        });
    }

    public cleanupExpiredCache(): void {
        const now = Date.now();
        for (const [key, entry] of this.caches.entries()) {
            if (now > entry.expiresAt) {
                this.caches.delete(key);
            }
        }
    }

    public getWaitTime(apiName: string): number {
        const config = this.defaultConfigs.get(apiName) || this.defaultConfigs.get('default')!;
        const now = Date.now();
        const key = `${apiName}_${Math.floor(now / config.timeWindowMs)}`;
        
        const current = this.requestCounts.get(key);
        if (!current) return 0;
        
        return Math.max(0, current.resetTime - now);
    }
}

export const apiRateLimiter = new ApiRateLimiter();

setInterval(() => {
    apiRateLimiter.cleanupExpiredCache();
}, 60000);
