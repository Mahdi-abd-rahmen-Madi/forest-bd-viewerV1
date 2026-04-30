import { FeatureInfoResponse } from './wmsFeatureInfo';

interface CacheEntry {
    data: FeatureInfoResponse | null;
    timestamp: number;
    expiresAt: number;
}

interface PendingRequest {
    promise: Promise<FeatureInfoResponse | null>;
    resolve: (value: FeatureInfoResponse | null) => void;
    reject: (reason: any) => void;
}

class WMSCache {
    private cache = new Map<string, CacheEntry>();
    private pendingRequests = new Map<string, PendingRequest>();
    private readonly maxAge: number;
    private readonly maxCacheSize: number;
    private readonly gridSize: number; // Precision for coordinate grid

    constructor(options: {
        maxAge?: number; // in milliseconds
        maxCacheSize?: number;
        gridSize?: number; // degrees
    } = {}) {
        this.maxAge = options.maxAge || 5 * 60 * 1000; // 5 minutes default
        this.maxCacheSize = options.maxCacheSize || 1000;
        this.gridSize = options.gridSize || 0.001; // ~100m precision
    }

    /**
     * Generate cache key based on coordinates and layer name
     */
    private generateKey(layerName: string, lng: number, lat: number): string {
        // Snap coordinates to grid for better cache hits
        const gridLng = Math.floor(lng / this.gridSize) * this.gridSize;
        const gridLat = Math.floor(lat / this.gridSize) * this.gridSize;
        return `${layerName}:${gridLng.toFixed(6)}:${gridLat.toFixed(6)}`;
    }

    /**
     * Get cached feature info or create new request with deduplication
     */
    async getFeatureInfo(
        layerName: string,
        lng: number,
        lat: number,
        fetchFunction: () => Promise<FeatureInfoResponse | null>
    ): Promise<FeatureInfoResponse | null> {
        const key = this.generateKey(layerName, lng, lat);
        const now = Date.now();

        // Check cache first
        const cached = this.cache.get(key);
        if (cached && now < cached.expiresAt) {
            return cached.data;
        }

        // Check if there's already a pending request for this key
        const pending = this.pendingRequests.get(key);
        if (pending) {
            return pending.promise;
        }

        // Create new request
        let resolve: (value: FeatureInfoResponse | null) => void;
        let reject: (reason: any) => void;
        
        const promise = new Promise<FeatureInfoResponse | null>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        // Store pending request
        this.pendingRequests.set(key, {
            promise,
            resolve: resolve!,
            reject: reject!
        });

        try {
            const result = await fetchFunction();
            
            // Cache the result
            this.cache.set(key, {
                data: result,
                timestamp: now,
                expiresAt: now + this.maxAge
            });

            // Resolve pending requests
            resolve!(result);
            return result;
        } catch (error) {
            reject!(error);
            throw error;
        } finally {
            // Clean up pending request
            this.pendingRequests.delete(key);
            
            // Clean up old cache entries
            this.cleanup();
        }
    }

    /**
     * Batch multiple feature info requests
     */
    async batchGetFeatureInfo(
        requests: Array<{
            layerName: string;
            lng: number;
            lat: number;
            fetchFunction: () => Promise<FeatureInfoResponse | null>;
        }>
    ): Promise<Array<FeatureInfoResponse | null>> {
        const promises = requests.map(({ layerName, lng, lat, fetchFunction }) =>
            this.getFeatureInfo(layerName, lng, lat, fetchFunction)
        );
        
        return Promise.all(promises);
    }

    /**
     * Clean up expired cache entries and enforce size limit
     */
    private cleanup(): void {
        const now = Date.now();
        
        // Remove expired entries
        for (const [key, entry] of this.cache.entries()) {
            if (now >= entry.expiresAt) {
                this.cache.delete(key);
            }
        }

        // Enforce size limit (LRU eviction)
        if (this.cache.size > this.maxCacheSize) {
            const entries = Array.from(this.cache.entries())
                .sort(([, a], [, b]) => a.timestamp - b.timestamp);
            
            const toDelete = entries.slice(0, this.cache.size - this.maxCacheSize);
            toDelete.forEach(([key]) => this.cache.delete(key));
        }
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
        this.pendingRequests.clear();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            pendingRequests: this.pendingRequests.size,
            maxCacheSize: this.maxCacheSize,
            maxAge: this.maxAge,
            gridSize: this.gridSize
        };
    }

    /**
     * Preload cache for a given area (useful for common areas)
     */
    async preloadArea(
        layerNames: string[],
        bounds: { north: number; south: number; east: number; west: number },
        fetchFunction: (layerName: string, lng: number, lat: number) => Promise<FeatureInfoResponse | null>,
        resolution: number = 0.01 // Grid resolution for preloading
    ): Promise<void> {
        const promises: Promise<void>[] = [];
        
        for (const layerName of layerNames) {
            for (let lat = bounds.south; lat <= bounds.north; lat += resolution) {
                for (let lng = bounds.west; lng <= bounds.east; lng += resolution) {
                    const promise = this.getFeatureInfo(layerName, lng, lat, () =>
                        fetchFunction(layerName, lng, lat)
                    ).then(() => {}); // Convert to void promise
                    promises.push(promise);
                }
            }
        }
        
        await Promise.all(promises);
    }
}

// Global cache instance
export const wmsCache = new WMSCache({
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxCacheSize: 1000,
    gridSize: 0.001 // ~100m precision
});

export default WMSCache;
