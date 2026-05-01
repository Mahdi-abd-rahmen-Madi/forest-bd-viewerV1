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
    layerName: string,
    lng: number,
    lat: number,
    map: mapboxgl.Map
): Promise<FeatureInfoResponse | null> => {
    console.log(`📦 getFeatureInfo: Starting DIRECT fetch for ${layerName}`);
    
    try {
        const point = map.project([lng, lat]);
        const bounds = map.getBounds();

        // Convert bounds to EPSG:3857
        // @ts-ignore
        const [minx, miny] = lngLatTo3857(bounds.getWest(), bounds.getSouth());
        // @ts-ignore
        const [maxx, maxy] = lngLatTo3857(bounds.getEast(), bounds.getNorth());

        const params = new URLSearchParams({
            service: 'WMS',
            version: '1.1.1',
            request: 'GetFeatureInfo',
            layers: `${WORKSPACE}:${layerName}`,
            query_layers: `${WORKSPACE}:${layerName}`,
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

        const url = `${GEOSERVER_URL}/${WORKSPACE}/wms?${params.toString()}`;

        console.log(`🌐 WMS Fetch: Starting DIRECT request to ${url}`);
        console.log(`📐 WMS Fetch: Map bounds - BBox: ${minx},${miny},${maxx},${maxy}`);
        console.log(`📍 WMS Fetch: Click point - X: ${point.x}, Y: ${point.y}`);
        console.log(`📏 WMS Fetch: Canvas size - Width: ${map.getCanvas().width}, Height: ${map.getCanvas().height}`);
        
        // Add timeout to fetch to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log(`⏰ WMS Fetch: Timeout triggered for ${layerName}, aborting request`);
            controller.abort();
        }, 8000); // 8 second timeout
        
        console.log(`📡 WMS Fetch: Sending DIRECT fetch request for ${layerName}`);
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: {
                'Accept': 'application/json, text/plain, */*'
            }
        });
        
        clearTimeout(timeoutId);
        console.log(`✅ WMS Fetch: Response received for ${layerName} - Status: ${response.status}`);
        
        if (!response.ok) {
            console.warn(`WMS HTTP error for ${layerName}: ${response.status} ${response.statusText}`);
            return null;
        }
        
        console.log(`� WMS Fetch: Parsing JSON response for ${layerName}`);
        const result = await response.json();
        console.log(`✅ WMS Fetch: JSON parsed successfully for ${layerName}`);
        
        // Check for WMS service exceptions
        if (result.type === 'ServiceExceptionReport' || result.ServiceException) {
            console.warn(`WMS Service Exception for ${layerName}:`, result);
            return null;
        }
        
        console.log(`🎉 WMS Fetch: Request completed successfully for ${layerName}`);
        return result;
        
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.warn(`⏰ WMS Fetch: Request timeout for ${layerName} after 8 seconds`);
            return null;
        }
        console.error(`❌ WMS Fetch: Error fetching ${layerName}:`, error);
        return null;
    }
};

// Query all layers in hierarchy: Region → Department → Commune → Forest
export const queryAllLayers = async (
    lng: number,
    lat: number,
    map: mapboxgl.Map
): Promise<{
    region: FeatureInfoResponse | null;
    department: FeatureInfoResponse | null;
    commune: FeatureInfoResponse | null;
    forest: FeatureInfoResponse | null;
}> => {
    console.log('🚀 queryAllLayers: Starting DIRECT batch query for all layers');
    
    // Use direct requests without cache for simplicity and debugging
    const requests = [
        getFeatureInfo('region', lng, lat, map),
        getFeatureInfo('department', lng, lat, map),
        getFeatureInfo('cummune', lng, lat, map),
        getFeatureInfo('forest', lng, lat, map)
    ];

    console.log('📦 queryAllLayers: Starting DIRECT batch processing...');
    const startTime = Date.now();
    
    const [region, department, commune, forest] = await Promise.all(requests);
    
    const endTime = Date.now();
    console.log(`⏱️ queryAllLayers: DIRECT batch processing completed in ${endTime - startTime}ms`);
    console.log('📊 queryAllLayers: Results:', { region, department, commune, forest });

    return { region, department, commune, forest };
};