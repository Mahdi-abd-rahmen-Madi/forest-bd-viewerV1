import { useEffect, useState, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useQuery } from '@apollo/client/react';
import { GET_FOREST_PLOTS } from '@/graphql/geospatial';

interface ForestPlot {
    id: string;
    codeRegion: string;
    codeDepartement: string;
    codeCommune: string;
    lieuDit?: string;
    geometry: any;
    essences: string[];
    surfaceHectares?: number;
    typeForet?: string;
}

interface ViewportCache {
    bounds: mapboxgl.LngLatBounds;
    zoom: number;
    plots: ForestPlot[];
    timestamp: number;
}

interface UseViewportForestDataOptions {
    filters?: {
        regionCode?: string;
        departementCode?: string;
        communeCode?: string;
        lieuDit?: string;
    };
    maxCacheAge?: number; // in milliseconds
    bufferSize?: number; // degrees to extend viewport for preloading
}

export const useViewportForestData = (
    map: mapboxgl.Map | null,
    options: UseViewportForestDataOptions = {}
) => {
    const {
        filters = {},
        maxCacheAge = 5 * 60 * 1000, // 5 minutes
        bufferSize = 0.1 // 0.1 degrees buffer
    } = options;

    const [viewportPlots, setViewportPlots] = useState<ForestPlot[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const cacheRef = useRef<Map<string, ViewportCache>>(new Map());
    const lastViewportRef = useRef<string>('');
    const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // Generate cache key from bounds and filters
    const generateCacheKey = useCallback((bounds: mapboxgl.LngLatBounds, zoom: number): string => {
        const west = bounds.getWest();
        const south = bounds.getSouth();
        const east = bounds.getEast();
        const north = bounds.getNorth();
        const filterKey = JSON.stringify(filters);
        return `${west.toFixed(4)}-${south.toFixed(4)}-${east.toFixed(4)}-${north.toFixed(4)}-${zoom}-${filterKey}`;
    }, [filters]);

    // Check if plot is within viewport bounds
    const isPlotInViewport = useCallback((plot: ForestPlot, bounds: mapboxgl.LngLatBounds): boolean => {
        if (!plot.geometry || !plot.geometry.coordinates) return false;
        
        const coords = plot.geometry.coordinates;
        // Handle MultiPolygon geometry
        for (const polygon of coords) {
            for (const ring of polygon) {
                for (const [lng, lat] of ring) {
                    if (lng >= bounds.getWest() && lng <= bounds.getEast() &&
                        lat >= bounds.getSouth() && lat <= bounds.getNorth()) {
                        return true;
                    }
                }
            }
        }
        return false;
    }, []);

    // Filter cached plots by viewport
    const filterCachedPlots = useCallback((allPlots: ForestPlot[], bounds: mapboxgl.LngLatBounds): ForestPlot[] => {
        return allPlots.filter(plot => isPlotInViewport(plot, bounds));
    }, [isPlotInViewport]);

    // Load forest plots with caching
    const { data: fullData, loading: fullLoading, error: fullError } = useQuery(GET_FOREST_PLOTS, {
        variables: { filters },
        skip: !filters.regionCode && !filters.departementCode && !filters.communeCode && !filters.lieuDit,
        fetchPolicy: 'cache-first',
        nextFetchPolicy: 'cache-only'
    }) as { data?: { forestPlots: ForestPlot[] }; loading: boolean; error?: any };

    // Main viewport filtering logic with debouncing
    const updateViewportPlots = useCallback(() => {
        if (!map || fullLoading) return;

        const bounds = map.getBounds();
        if (!bounds) return;
        
        const zoom = map.getZoom();
        const currentKey = generateCacheKey(bounds, zoom);

        // Skip if viewport hasn't changed significantly
        if (currentKey === lastViewportRef.current) {
            return;
        }

        // Clear existing debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Debounce the viewport update
        debounceTimerRef.current = setTimeout(() => {
            const now = Date.now();
            const cached = cacheRef.current.get(currentKey);

            // Check if we have valid cache
            if (cached && (now - cached.timestamp) < maxCacheAge) {
                setViewportPlots(cached.plots);
                lastViewportRef.current = currentKey;
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                // If we have full data, filter it client-side
                if (fullData?.forestPlots) {
                    const filtered = filterCachedPlots(fullData.forestPlots, bounds);
                    
                    // Cache the result
                    cacheRef.current.set(currentKey, {
                        bounds: new mapboxgl.LngLatBounds(bounds.getSouthWest(), bounds.getNorthEast()),
                        zoom,
                        plots: filtered,
                        timestamp: now
                    });

                    setViewportPlots(filtered);
                    lastViewportRef.current = currentKey;
                } else {
                    // Fallback: query with bounds if no cached full data
                    // This would require extending the GraphQL schema
                    setViewportPlots([]);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error occurred');
            } finally {
                setIsLoading(false);
            }

            // Clean old cache entries (keep only 10 most recent)
            if (cacheRef.current.size > 10) {
                const entries = Array.from(cacheRef.current.entries())
                    .sort(([, a], [, b]) => b.timestamp - a.timestamp);
                cacheRef.current = new Map(entries.slice(0, 10));
            }
        }, 300); // 300ms debounce
    }, [map, fullData, fullLoading, generateCacheKey, maxCacheAge, filterCachedPlots]);

    // Set up map event listeners
    useEffect(() => {
        if (!map) return;

        const handleMoveEnd = () => updateViewportPlots();
        const handleZoomEnd = () => updateViewportPlots();

        map.on('moveend', handleMoveEnd);
        map.on('zoomend', handleZoomEnd);

        // Initial load
        updateViewportPlots();

        return () => {
            map.off('moveend', handleMoveEnd);
            map.off('zoomend', handleMoveEnd);
            
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [map, updateViewportPlots]);

    // Cleanup cache on unmount
    useEffect(() => {
        return () => {
            cacheRef.current.clear();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return {
        plots: viewportPlots,
        isLoading,
        error: error || fullError?.message,
        cacheSize: cacheRef.current.size,
        clearCache: () => {
            cacheRef.current.clear();
            lastViewportRef.current = '';
        }
    };
};
