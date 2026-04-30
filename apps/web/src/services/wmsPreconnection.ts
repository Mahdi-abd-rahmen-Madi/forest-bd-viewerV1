interface PreconnectionConfig {
    url: string;
    crossOrigin?: string;
    priority?: 'high' | 'low' | 'auto';
    timeout?: number;
}

interface ConnectionStatus {
    url: string;
    connected: boolean;
    lastUsed: number;
    requestCount: number;
    errorCount: number;
}

class WMSPreconnectionService {
    private connections = new Map<string, ConnectionStatus>();
    private preconnectElements = new Map<string, HTMLLinkElement>();
    private readonly defaultTimeout = 10000; // 10 seconds
    private readonly maxConnections = 6; // Browser limit
    private readonly connectionTTL = 300000; // 5 minutes

    constructor() {
        // Only initialize on client side
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            this.initializePreconnections();
            this.startCleanupTimer();
        }
    }

    /**
     * Initialize preconnections for common WMS endpoints
     */
    private initializePreconnections(): void {
        const commonEndpoints: PreconnectionConfig[] = [
            { url: '/geoserver', crossOrigin: 'anonymous', priority: 'high' },
            { url: '/geoserver/prod/wms', crossOrigin: 'anonymous', priority: 'high' },
            { url: '/geoserver/www/wms', crossOrigin: 'anonymous', priority: 'low' }
        ];

        commonEndpoints.forEach(config => {
            this.preconnect(config);
        });
    }

    /**
     * Create preconnection for a specific endpoint
     */
    preconnect(config: PreconnectionConfig): void {
        // Only run on client side
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        if (this.connections.size >= this.maxConnections) {
            this.cleanupOldConnections();
        }

        const url = config.url;
        const now = Date.now();

        // Update existing connection status
        if (this.connections.has(url)) {
            const status = this.connections.get(url)!;
            status.lastUsed = now;
            status.requestCount++;
            return;
        }

        // Create new preconnection
        const linkElement = document.createElement('link');
        linkElement.rel = 'preconnect';
        linkElement.href = url;
        
        if (config.crossOrigin) {
            linkElement.crossOrigin = config.crossOrigin;
        }

        // Add to document head
        document.head.appendChild(linkElement);

        // Track connection
        this.connections.set(url, {
            url,
            connected: false,
            lastUsed: now,
            requestCount: 1,
            errorCount: 0
        });

        this.preconnectElements.set(url, linkElement);

        // Monitor connection success/failure
        this.monitorConnection(url, linkElement, config.timeout || this.defaultTimeout);
    }

    /**
     * Monitor connection establishment
     */
    private monitorConnection(url: string, linkElement: HTMLLinkElement, timeout: number): void {
        const timeoutId = setTimeout(() => {
            const status = this.connections.get(url);
            if (status && !status.connected) {
                status.errorCount++;
                console.warn(`Preconnection timeout for ${url}`);
            }
        }, timeout);

        // Note: Browser doesn't provide direct connection success events for preconnect
        // We'll mark as connected when first request succeeds
        setTimeout(() => {
            const status = this.connections.get(url);
            if (status) {
                status.connected = true;
            }
            clearTimeout(timeoutId);
        }, 1000); // Assume success after 1 second
    }

    /**
     * Preconnect to WMS layer endpoint
     */
    preconnectWMSLayer(layerName: string, workspace: string = 'prod'): void {
        const url = `/geoserver/${workspace}/wms`;
        this.preconnect({
            url,
            crossOrigin: 'anonymous',
            priority: 'high'
        });
    }

    /**
     * Preconnect to multiple WMS layers
     */
    preconnectWMSLayers(layerNames: string[], workspace: string = 'prod'): void {
        layerNames.forEach(layerName => {
            this.preconnectWMSLayer(layerName, workspace);
        });
    }

    /**
     * Get connection status for monitoring
     */
    getConnectionStatus(url?: string): ConnectionStatus | Map<string, ConnectionStatus> | null {
        if (url) {
            return this.connections.get(url) || null;
        }
        return this.connections;
    }

    /**
     * Check if a connection is ready
     */
    isConnectionReady(url: string): boolean {
        const status = this.connections.get(url);
        return status?.connected || false;
    }

    /**
     * Mark connection as used (call this when making actual requests)
     */
    markConnectionUsed(url: string): void {
        const status = this.connections.get(url);
        if (status) {
            status.lastUsed = Date.now();
            status.requestCount++;
            status.connected = true;
        }
    }

    /**
     * Clean up old connections
     */
    private cleanupOldConnections(): void {
        const now = Date.now();
        const toDelete: string[] = [];

        this.connections.forEach((status, url) => {
            if (now - status.lastUsed > this.connectionTTL) {
                toDelete.push(url);
            }
        });

        toDelete.forEach(url => {
            this.removeConnection(url);
        });
    }

    /**
     * Remove a specific connection
     */
    private removeConnection(url: string): void {
        // Only run on client side
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        const linkElement = this.preconnectElements.get(url);
        if (linkElement && linkElement.parentNode) {
            linkElement.parentNode.removeChild(linkElement);
        }

        this.connections.delete(url);
        this.preconnectElements.delete(url);
    }

    /**
     * Start periodic cleanup timer
     */
    private startCleanupTimer(): void {
        // Only run on client side
        if (typeof window === 'undefined') {
            return;
        }

        setInterval(() => {
            this.cleanupOldConnections();
        }, 60000); // Clean up every minute
    }

    /**
     * Get performance statistics
     */
    getStats(): {
        totalConnections: number;
        connectedConnections: number;
        averageRequestCount: number;
        errorRate: number;
        connections: ConnectionStatus[];
    } {
        const connections = Array.from(this.connections.values());
        const connectedCount = connections.filter(c => c.connected).length;
        const totalRequests = connections.reduce((sum, c) => sum + c.requestCount, 0);
        const totalErrors = connections.reduce((sum, c) => sum + c.errorCount, 0);
        const totalConnectionRequests = connections.reduce((sum, c) => sum + c.requestCount, 0);

        return {
            totalConnections: connections.length,
            connectedConnections: connectedCount,
            averageRequestCount: totalConnectionRequests > 0 ? totalRequests / connections.length : 0,
            errorRate: totalConnectionRequests > 0 ? (totalErrors / totalConnectionRequests) * 100 : 0,
            connections: connections.sort((a, b) => b.lastUsed - a.lastUsed)
        };
    }

    /**
     * Preconnect based on layer configurations
     */
    preconnectFromLayerConfigs(layerConfigs: Array<{ layerName: string; workspace?: string }>): void {
        const uniqueUrls = new Set<string>();
        
        layerConfigs.forEach(config => {
            const workspace = config.workspace || 'prod';
            const url = `/geoserver/${workspace}/wms`;
            uniqueUrls.add(url);
        });

        uniqueUrls.forEach(url => {
            this.preconnect({
                url,
                crossOrigin: 'anonymous',
                priority: 'high'
            });
        });
    }

    /**
     * Cleanup all connections
     */
    cleanup(): void {
        this.connections.forEach((_, url) => {
            this.removeConnection(url);
        });
    }
}

// Global instance
export const wmsPreconnectionService = new WMSPreconnectionService();

export default WMSPreconnectionService;
