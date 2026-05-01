const GEOSERVER_URL = '/geoserver'; // Proxy through Next.js
const WORKSPACE = process.env.NEXT_PUBLIC_GEOSERVER_WORKSPACE || 'prod';

export interface WMSLayerConfig {
    id: string;
    name: string;
    layerName: string;
    minZoom: number;
    maxZoom: number;
    opacity: number;
    visible: boolean;
    color?: string;
    description: string;
    external?: boolean;
    externalUrl?: string;
    vectorTile?: boolean;
}

export const WMS_LAYERS: WMSLayerConfig[] = [
    {
        id: 'region',
        name: 'Region',
        layerName: 'region',
        minZoom: 0,
        maxZoom: 8,
        opacity: 0.6,
        visible: true,
        color: '#8B0000',
        description: 'Administrative regions',
    },
    {
        id: 'department',
        name: 'Department',
        layerName: 'department',
        minZoom: 8,
        maxZoom: 10,
        opacity: 0.6,
        visible: true,
        color: '#FF8C00',
        description: 'Departments',
    },
    {
        id: 'commune',
        name: 'Commune',
        layerName: 'cummune', // Note: keeping typo as server only has this name
        minZoom: 10,
        maxZoom: 13,
        opacity: 0.5,
        visible: true,
        color: '#32CD32',
        description: 'Communes',
    },
    {
        id: 'forest',
        name: 'Forest (BD Forêt)',
        layerName: 'forest',
        minZoom: 0,
        maxZoom: 22,
        opacity: 0.9,
        visible: true,
        color: 'rgb(102,255,0)',
        description: 'Forest inventory data',
    },
    {
        id: 'cadastre',
        name: 'Cadastre (Unavailable)',
        layerName: 'cadastre', // Layer doesn't exist on server
        minZoom: 15,
        maxZoom: 22,
        opacity: 0.8,
        visible: false,
        color: '#8B4513',
        description: 'Land parcels (zoom > 15) - Layer not available on server',
    },
    {
        id: 'plu-zoning',
        name: 'PLU Zoning Sectors',
        layerName: 'zone_secteur',
        minZoom: 8,
        maxZoom: 20,
        opacity: 0.7,
        visible: true, // Set to true for testing
        color: '#10b981',
        description: 'Urban planning zoning sectors (external WMS)',
        external: true,
        externalUrl: 'https://data.geopf.fr/wms-v/ows'
    },
    {
        id: 'plu-prescriptions',
        name: 'PLU Prescriptions',
        layerName: 'prescription',
        minZoom: 10,
        maxZoom: 20,
        opacity: 0.7,
        visible: true, // Set to true for testing
        color: '#059669',
        description: 'Planning prescriptions and regulations (external WMS)',
        external: true,
        externalUrl: 'https://data.geopf.fr/wms-v/ows'
    },
    {
        id: 'pci-parcels',
        name: 'PCI Parcels (Cadastral)',
        layerName: 'pci-parcels',
        minZoom: 14,
        maxZoom: 20,
        opacity: 0.8,
        visible: true, // Set to true for testing
        color: '#D82626',
        description: 'Cadastral parcels from IGN (vector tiles)',
        vectorTile: true,
        external: true
    },
];

export const buildWMSUrl = (layerName: string): string => {
    return `${GEOSERVER_URL}/${WORKSPACE}/wms`;
};

export const getWMSTileUrl = (layerConfig: WMSLayerConfig): string => {
    if (layerConfig.external && layerConfig.externalUrl && !layerConfig.vectorTile) {
        // External WMS layer - use proper parameter casing for French geoportal
        return `${layerConfig.externalUrl}?` +
            `SERVICE=WMS&` +
            `VERSION=1.3.0&` +
            `REQUEST=GetMap&` +
            `LAYERS=${layerConfig.layerName}&` +
            `STYLES=&` +
            `FORMAT=image/png&` +
            `TRANSPARENT=true&` +
            `CRS=EPSG:3857&` +
            `BBOX={bbox-epsg-3857}&` +
            `WIDTH=256&` +
            `HEIGHT=256`;
    }
    // Internal GeoServer WMS layer
    return `${GEOSERVER_URL}/${WORKSPACE}/wms?` +
        `service=WMS&` +
        `version=1.1.0&` +
        `request=GetMap&` +
        `layers=${WORKSPACE}:${layerConfig.layerName}&` +
        `styles=&` +
        `format=image/png&` +
        `transparent=true&` +
        `srs=EPSG:3857&` +
        `bbox={bbox-epsg-3857}&` +
        `width=256&` +
        `height=256`;
};

export const getVectorTileUrl = (layerConfig: WMSLayerConfig): string => {
    if (layerConfig.id === 'pci-parcels') {
        return 'https://data.geopf.fr/tms/1.0.0/PCI/{z}/{x}/{y}.pbf';
    }
    return '';
};

// Validate if a layer is likely to work based on known issues
export const validateLayer = (layerConfig: WMSLayerConfig): { isValid: boolean; issues: string[] } => {
    const issues: string[] = [];
    
    // Check for cadastre layer (known to be unavailable)
    if (layerConfig.id === 'cadastre') {
        issues.push('Layer is not available on server');
    }
    
    // Check for empty layer name (except for vector tiles)
    if (!layerConfig.vectorTile && (!layerConfig.layerName || layerConfig.layerName.trim() === '')) {
        issues.push('Layer name is empty');
    }
    
    // Check for suspicious characters in layer name (except for vector tiles)
    if (!layerConfig.vectorTile && layerConfig.layerName && !/^[a-zA-Z0-9_-]+$/.test(layerConfig.layerName)) {
        issues.push('Layer name contains invalid characters');
    }
    
    // Check for external URL on external layers
    if (layerConfig.external && !layerConfig.externalUrl && !layerConfig.vectorTile) {
        issues.push('External layer missing URL');
    }
    
    return {
        isValid: issues.length === 0,
        issues
    };
};

// Get only working layers for critical operations
export const getWorkingLayers = (): WMSLayerConfig[] => {
    return WMS_LAYERS.filter(layer => {
        const validation = validateLayer(layer);
        return validation.isValid;
    });
};