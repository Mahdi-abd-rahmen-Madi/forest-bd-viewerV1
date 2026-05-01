// Forest data coverage regions with bounding boxes and navigation centers

export interface ForestRegion {
    code: string;
    name: string;
    bounds: {
        minLng: number;
        maxLng: number;
        minLat: number;
        maxLat: number;
    };
    center: {
        lng: number;
        lat: number;
        zoom: number;
    };
    departments: string[];
}

// All regions with forest data coverage
export const FOREST_REGIONS: ForestRegion[] = [
    {
        code: 'NORMANDIE',
        name: 'Normandie',
        bounds: {
            minLng: -1.74,
            maxLng: 1.47,
            minLat: 48.23,
            maxLat: 50.09
        },
        center: {
            lng: 0.37,
            lat: 49.18,
            zoom: 7
        },
        departments: ['D014', 'D027', 'D050', 'D061', 'D076']
    },
    {
        code: 'CENTRE_VAL_DE_LOIRE',
        name: 'Centre-Val de Loire',
        bounds: {
            minLng: 0.14,
            maxLng: 3.12,
            minLat: 46.81,
            maxLat: 48.78
        },
        center: {
            lng: 1.68,
            lat: 47.75,
            zoom: 7
        },
        departments: ['D018', 'D028', 'D036', 'D037', 'D045']
    },
    {
        code: 'GRAND_EST',
        name: 'Grand Est',
        bounds: {
            minLng: 3.40,
            maxLng: 8.23,
            minLat: 47.81,
            maxLat: 50.09
        },
        center: {
            lng: 5.82,
            lat: 48.95,
            zoom: 7
        },
        departments: ['D088']
    },
    {
        code: 'NOUVELLE_AQUITAINE',
        name: 'Nouvelle-Aquitaine',
        bounds: {
            minLng: -1.79,
            maxLng: 1.23,
            minLat: 43.18,
            maxLat: 45.61
        },
        center: {
            lng: -0.28,
            lat: 44.40,
            zoom: 7
        },
        departments: ['D040']
    }
];

// Legacy Vosges region (for backward compatibility)
export const VOSGES_BOUNDS = {
    minLng: 5.39,
    maxLng: 7.19,
    minLat: 47.81,
    maxLat: 48.51
};

export const VOSGES_CENTER = {
    lng: 6.29,
    lat: 48.16,
    zoom: 9
};

// Combined bounds for all forest data coverage
export const ALL_FOREST_BOUNDS = {
    minLng: -1.79,
    maxLng: 8.23,
    minLat: 43.18,
    maxLat: 50.09
};

// Center of all forest coverage for navigation
export const ALL_FOREST_CENTER = {
    lng: 3.22,
    lat: 46.64,
    zoom: 6
};

// Get region by code
export const getRegionByCode = (code: string): ForestRegion | undefined => {
    return FOREST_REGIONS.find(region => region.code === code);
};

// Get all departments across all regions
export const getAllDepartments = (): string[] => {
    return FOREST_REGIONS.flatMap(region => region.departments);
};

// Check if coordinates are within any forest region
export const isWithinForestCoverage = (lng: number, lat: number): boolean => {
    return FOREST_REGIONS.some(region => 
        lng >= region.bounds.minLng && 
        lng <= region.bounds.maxLng && 
        lat >= region.bounds.minLat && 
        lat <= region.bounds.maxLat
    );
};

// Check if coordinates are within a specific region
export const isWithinRegion = (lng: number, lat: number, regionCode: string): boolean => {
    const region = getRegionByCode(regionCode);
    if (!region) return false;
    
    return lng >= region.bounds.minLng && 
           lng <= region.bounds.maxLng && 
           lat >= region.bounds.minLat && 
           lat <= region.bounds.maxLat;
};

// Legacy function for backward compatibility
export const isWithinVosgesRegion = (lng: number, lat: number): boolean => {
    return isWithinRegion(lng, lat, 'GRAND_EST') && 
           lng >= VOSGES_BOUNDS.minLng && 
           lng <= VOSGES_BOUNDS.maxLng && 
           lat >= VOSGES_BOUNDS.minLat && 
           lat <= VOSGES_BOUNDS.maxLat;
};

// Generate a GeoJSON polygon for a region's coverage area
export const getRegionCoverageGeoJSON = (regionCode: string) => {
    const region = getRegionByCode(regionCode);
    if (!region) return null;
    
    return {
        type: 'Feature' as const,
        geometry: {
            type: 'Polygon' as const,
            coordinates: [[
                [region.bounds.minLng, region.bounds.minLat],
                [region.bounds.maxLng, region.bounds.minLat],
                [region.bounds.maxLng, region.bounds.maxLat],
                [region.bounds.minLng, region.bounds.maxLat],
                [region.bounds.minLng, region.bounds.minLat]
            ]]
        },
        properties: {
            name: `${region.name} Forest Data Coverage`,
            description: 'Area where forest analysis is available',
            region: region.code,
            coverage: true
        }
    };
};

// Legacy function for backward compatibility
export const getVosgesCoverageGeoJSON = () => {
    return getRegionCoverageGeoJSON('GRAND_EST');
};
