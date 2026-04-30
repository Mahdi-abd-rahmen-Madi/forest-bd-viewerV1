// Type definitions for forest map application

export interface MapboxDrawCreateEvent {
    features: Array<{
        id: string;
        type: string;
        geometry: GeoJSON.Geometry;
        properties: Record<string, any>;
    }>;
}

export interface MapboxDrawModeChangeEvent {
    mode: string;
    previousMode: string;
}

export interface UpdateMapStateResponse {
    updateMapState: {
        lng: number;
        lat: number;
        zoom: number;
        filters: Record<string, any>;
        activeLayers: string[];
    };
}

export interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    lastLng?: number;
    lastLat?: number;
    lastZoom?: number;
    lastFilters?: Record<string, any>;
}

export interface SavedPolygon {
    id: string;
    name: string;
    areaHectares: number;
    status: string;
    createdAt: string;
    geometry: GeoJSON.Geometry | string;
    analysisResults?: {
        plotCount: number;
        totalForestArea: number;
        coveragePercentage: number;
        forestTypes: string[];
        speciesDistribution: Array<{
            species: string;
            areaHectares: number;
            percentage: number;
        }>;
    };
}

export interface MyPolygonsQueryResult {
    myPolygons: SavedPolygon[];
}

export type SelectHandlerCallback = (code: string) => void;

export interface RegionsQueryResult {
    regions: string[];
}

export interface DepartementsQueryResult {
    departements: string[];
}

export interface CommunesQueryResult {
    communes: string[];
}

export interface LieuxDitsQueryResult {
    lieuxDits: string[];
}

export interface FeatureQueryPopupProps {
    lng: number;
    lat: number;
    data: {
        region: any; // FeatureInfoResponse | null;
        department: any; // FeatureInfoResponse | null;
        commune: any; // FeatureInfoResponse | null;
        forest: any; // FeatureInfoResponse | null;
    };
    onClose: () => void;
    onSelectRegion?: SelectHandlerCallback;
    onSelectDepartment?: SelectHandlerCallback;
    onSelectCommune?: SelectHandlerCallback;
}

