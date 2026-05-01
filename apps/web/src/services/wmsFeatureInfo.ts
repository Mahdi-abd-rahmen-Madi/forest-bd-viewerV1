import { WMSLayerConfig } from './wmsLayers';

const GEOSERVER_URL = '/geoserver';
const WORKSPACE = 'prod';

export interface FeatureInfoResponse {
    type: string;
    features: Array<{
        type: string;
        id: string;
        geometry: any;
        properties: Record<string, any>;
    }>;
    totalFeatures: number;
    numberReturned: number;
    timeStamp: string;
    crs: any;
}

function lngLatTo3857(lng: number, lat: number): [number, number] {
    const x = (lng * 20037508.34) / 180;
    let y =
        Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) /
        (Math.PI / 180);
    y = (y * 20037508.34) / 180;
    return [x, y];
}

export const getFeatureInfo = async (
    layerConfig: WMSLayerConfig,
    lng: number,
    lat: number,
    map: mapboxgl.Map
): Promise<FeatureInfoResponse | null> => {
    console.log(`📦 getFeatureInfo: Starting DIRECT fetch for ${layerConfig.id}`);
    
    try {
        const point = map.project([lng, lat]);
        const bounds = map.getBounds();

        // Convert bounds to EPSG:3857
        // @ts-ignore
        const [minx, miny] = lngLatTo3857(bounds.getWest(), bounds.getSouth());
        // @ts-ignore
        const [maxx, maxy] = lngLatTo3857(bounds.getEast(), bounds.getNorth());

        let baseUrl: string;
        let layers: string;
        
        if (layerConfig.external && layerConfig.externalUrl && !layerConfig.vectorTile) {
            // External WMS layer
            baseUrl = layerConfig.externalUrl;
            layers = layerConfig.layerName;
        } else {
            // Internal GeoServer WMS layer
            baseUrl = `${GEOSERVER_URL}/${WORKSPACE}/wms`;
            layers = `${WORKSPACE}:${layerConfig.layerName}`;
        }

        const params = new URLSearchParams({
            service: 'WMS',
            version: '1.1.1',
            request: 'GetFeatureInfo',
            layers: layers,
            query_layers: layers,
            styles: '',
            format: 'image/png',
            transparent: 'true',
            srs: 'EPSG:3857',
            bbox: `${minx},${miny},${maxx},${maxy}`,
            width: map.getCanvas().width.toString(),
            height: map.getCanvas().height.toString(),
            x: Math.floor(point.x).toString(),
            y: Math.floor(point.y).toString(),
            info_format: 'application/json',
            feature_count: '1',
        });
        
        // For external French geoportal, use uppercase parameters
        if (layerConfig.external && layerConfig.externalUrl && !layerConfig.vectorTile) {
            params.set('SERVICE', 'WMS');
            params.set('VERSION', '1.3.0');
            params.set('REQUEST', 'GetFeatureInfo');
            params.set('LAYERS', layerConfig.layerName);
            params.set('QUERY_LAYERS', layerConfig.layerName);
            params.set('STYLES', '');
            params.set('FORMAT', 'image/png');
            params.set('TRANSPARENT', 'true');
            params.set('CRS', 'EPSG:3857');
            params.set('BBOX', `${minx},${miny},${maxx},${maxy}`);
            params.set('WIDTH', map.getCanvas().width.toString());
            params.set('HEIGHT', map.getCanvas().height.toString());
            params.set('INFO_FORMAT', 'application/json');
            params.set('FEATURE_COUNT', '1');
            params.set('I', Math.floor(point.x).toString());
            params.set('J', Math.floor(point.y).toString());
            params.delete('x');
            params.delete('y');
            params.delete('info_format');
            params.delete('feature_count');
        }

        const url = `${baseUrl}?${params.toString()}`;

        console.log(`🌐 WMS Fetch: Starting DIRECT request to ${url}`);
        console.log(`📐 WMS Fetch: Map bounds - BBox: ${minx},${miny},${maxx},${maxy}`);
        console.log(`📍 WMS Fetch: Click point - X: ${point.x}, Y: ${point.y}`);
        console.log(`📏 WMS Fetch: Canvas size - Width: ${map.getCanvas().width}, Height: ${map.getCanvas().height}`);
        
        // Add timeout to fetch to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log(`⏰ WMS Fetch: Timeout triggered for ${layerConfig.id}, aborting request`);
            controller.abort();
        }, 8000); // 8 second timeout
        
        console.log(`📡 WMS Fetch: Sending DIRECT fetch request for ${layerConfig.id}`);
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: {
                'Accept': 'application/json, text/plain, */*'
            }
        });
        
        clearTimeout(timeoutId);
        console.log(`✅ WMS Fetch: Response received for ${layerConfig.id} - Status: ${response.status}`);
        
        if (!response.ok) {
            console.warn(`WMS HTTP error for ${layerConfig.id}: ${response.status} ${response.statusText}`);
            return null;
        }
        
        console.log(`📄 WMS Fetch: Parsing JSON response for ${layerConfig.id}`);
        const result = await response.json();
        console.log(`✅ WMS Fetch: JSON parsed successfully for ${layerConfig.id}`);
        
        // Check for WMS service exceptions
        if (result.type === 'ServiceExceptionReport' || result.ServiceException) {
            console.warn(`WMS Service Exception for ${layerConfig.id}:`, result);
            return null;
        }
        
        console.log(`🎉 WMS Fetch: Request completed successfully for ${layerConfig.id}`);
        return result;
        
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.warn(`⏰ WMS Fetch: Request timeout for ${layerConfig.id} after 8 seconds`);
            return null;
        }
        console.error(`❌ WMS Fetch: Error fetching ${layerConfig.id}:`, error);
        return null;
    }
};

// Query vector tile features at a specific point
export const getVectorTileFeatures = async (
    layerConfig: WMSLayerConfig,
    lng: number,
    lat: number,
    map: mapboxgl.Map
): Promise<any[] | null> => {
    console.log(`📦 getVectorTileFeatures: Starting query for ${layerConfig.id}`);
    
    if (layerConfig.id !== 'pci-parcels') {
        console.warn(`getVectorTileFeatures: Unsupported layer ${layerConfig.id}`);
        return null;
    }
    
    try {
        // Get all PCI vector tile layers
        const pciLayers = [
            'parcelle', 'parcels', 'pci_parcelle', 'pci_parcelles',
            'cadastral_parcels', 'parcelles', 'PARCELLE'
        ];
        
        const allFeatures: any[] = [];
        
        for (const sourceLayer of pciLayers) {
            const layerId = `pci-${sourceLayer}`;
            if (map.getLayer(layerId)) {
                const features = map.queryRenderedFeatures(
                    map.project([lng, lat]),
                    { layers: [layerId] }
                );
                
                if (features && features.length > 0) {
                    console.log(`✅ Found ${features.length} features in ${sourceLayer}`);
                    allFeatures.push(...features);
                }
            }
        }
        
        if (allFeatures.length > 0) {
            console.log(`🎉 getVectorTileFeatures: Found ${allFeatures.length} total PCI features`);
            return allFeatures;
        } else {
            console.log(`📭 getVectorTileFeatures: No PCI features found`);
            return null;
        }
        
    } catch (error) {
        console.error(`❌ getVectorTileFeatures: Error querying ${layerConfig.id}:`, error);
        return null;
    }
};

// Query all layers in hierarchy: Region → Department → Commune → Forest + PLU + PCI
export const queryAllLayers = async (
    lng: number,
    lat: number,
    map: mapboxgl.Map
): Promise<{
    region: FeatureInfoResponse | null;
    department: FeatureInfoResponse | null;
    commune: FeatureInfoResponse | null;
    forest: FeatureInfoResponse | null;
    pluZoning: FeatureInfoResponse | null;
    pluPrescriptions: FeatureInfoResponse | null;
    pciParcels: any[] | null; // Vector tiles return different format
}> => {
    console.log('🚀 queryAllLayers: Starting DIRECT batch query for all layers');
    
    // Get layer configurations
    const { WMS_LAYERS } = await import('./wmsLayers');
    
    // Find layer configurations
    const regionConfig = WMS_LAYERS.find(l => l.id === 'region');
    const departmentConfig = WMS_LAYERS.find(l => l.id === 'department');
    const communeConfig = WMS_LAYERS.find(l => l.id === 'commune');
    const forestConfig = WMS_LAYERS.find(l => l.id === 'forest');
    const pluZoningConfig = WMS_LAYERS.find(l => l.id === 'plu-zoning');
    const pluPrescriptionsConfig = WMS_LAYERS.find(l => l.id === 'plu-prescriptions');
    const pciParcelsConfig = WMS_LAYERS.find(l => l.id === 'pci-parcels');
    
    // Use direct requests without cache for simplicity and debugging
    // Separate WMS and vector tile queries to avoid type conflicts
    const wmsRequests = [
        regionConfig ? getFeatureInfo(regionConfig, lng, lat, map) : Promise.resolve(null),
        departmentConfig ? getFeatureInfo(departmentConfig, lng, lat, map) : Promise.resolve(null),
        communeConfig ? getFeatureInfo(communeConfig, lng, lat, map) : Promise.resolve(null),
        forestConfig ? getFeatureInfo(forestConfig, lng, lat, map) : Promise.resolve(null),
        pluZoningConfig ? getFeatureInfo(pluZoningConfig, lng, lat, map) : Promise.resolve(null),
        pluPrescriptionsConfig ? getFeatureInfo(pluPrescriptionsConfig, lng, lat, map) : Promise.resolve(null)
    ];
    
    const vectorRequests = [
        pciParcelsConfig ? getVectorTileFeatures(pciParcelsConfig, lng, lat, map) : Promise.resolve(null)
    ];

    console.log('📦 queryAllLayers: Starting DIRECT batch processing...');
    const startTime = Date.now();
    
    const [region, department, commune, forest, pluZoning, pluPrescriptions] = await Promise.all(wmsRequests);
    const [pciParcels] = await Promise.all(vectorRequests);
    
    const endTime = Date.now();
    console.log(`⏱️ queryAllLayers: DIRECT batch processing completed in ${endTime - startTime}ms`);
    console.log('📊 queryAllLayers: Results:', { region, department, commune, forest, pluZoning, pluPrescriptions, pciParcels });

    return { region, department, commune, forest, pluZoning, pluPrescriptions, pciParcels };
};