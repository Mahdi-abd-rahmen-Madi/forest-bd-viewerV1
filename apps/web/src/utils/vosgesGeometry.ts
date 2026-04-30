// Vosges region bounding box where forest data is available
export const VOSGES_BOUNDS = {
    minLng: 5.39,
    maxLng: 7.19,
    minLat: 47.81,
    maxLat: 48.51
};

// Center of Vosges region for navigation
export const VOSGES_CENTER = {
    lng: 6.29,
    lat: 48.16,
    zoom: 9
};

// Generate a GeoJSON polygon for the Vosges region coverage area
export const getVosgesCoverageGeoJSON = () => {
    return {
        type: 'Feature' as const,
        geometry: {
            type: 'Polygon' as const,
            coordinates: [[
                [VOSGES_BOUNDS.minLng, VOSGES_BOUNDS.minLat],
                [VOSGES_BOUNDS.maxLng, VOSGES_BOUNDS.minLat],
                [VOSGES_BOUNDS.maxLng, VOSGES_BOUNDS.maxLat],
                [VOSGES_BOUNDS.minLng, VOSGES_BOUNDS.maxLat],
                [VOSGES_BOUNDS.minLng, VOSGES_BOUNDS.minLat]
            ]]
        },
        properties: {
            name: 'Vosges Forest Data Coverage',
            description: 'Area where forest analysis is available',
            coverage: true
        }
    };
};

// Check if coordinates are within Vosges region
export const isWithinVosgesRegion = (lng: number, lat: number): boolean => {
    return lng >= VOSGES_BOUNDS.minLng && 
           lng <= VOSGES_BOUNDS.maxLng && 
           lat >= VOSGES_BOUNDS.minLat && 
           lat <= VOSGES_BOUNDS.maxLat;
};
