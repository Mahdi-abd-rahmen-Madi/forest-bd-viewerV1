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
    // Import services dynamically to avoid circular dependencies
    const { wmsCache } = await import('./wmsCache');
    const { wmsPreconnectionService } = await import('./wmsPreconnection');
    
    // Ensure preconnection for this layer
    wmsPreconnectionService.preconnectWMSLayer(layerName);
    
    return wmsCache.getFeatureInfo(layerName, lng, lat, async () => {
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
            width: map.getCanvas().width.toString(),   // correct
            height: map.getCanvas().height.toString(), // correct
            x: Math.floor(point.x).toString(),
            y: Math.floor(point.y).toString(),
            info_format: 'application/json',
            feature_count: '1',
        });

        const url = `${GEOSERVER_URL}/${WORKSPACE}/wms?${params.toString()}`;

        try {
            // Mark connection as used for monitoring
            wmsPreconnectionService.markConnectionUsed(`${GEOSERVER_URL}/${WORKSPACE}/wms`);
            
            const response = await fetch(url);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${layerName}:`, error);
            return null;
        }
    });
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
    // Import services dynamically to avoid circular dependencies
    const { wmsCache } = await import('./wmsCache');
    const { wmsPreconnectionService } = await import('./wmsPreconnection');
    
    // Preconnect all layers at once for optimal performance
    const layerNames = ['region', 'department', 'cummune', 'forest'];
    wmsPreconnectionService.preconnectWMSLayers(layerNames);
    
    // Use batch processing for better performance
    const requests = [
        {
            layerName: 'region',
            lng,
            lat,
            fetchFunction: () => getFeatureInfo('region', lng, lat, map)
        },
        {
            layerName: 'department',
            lng,
            lat,
            fetchFunction: () => getFeatureInfo('department', lng, lat, map)
        },
        {
            layerName: 'cummune', // Note: keeping the typo to match existing code
            lng,
            lat,
            fetchFunction: () => getFeatureInfo('cummune', lng, lat, map)
        },
        {
            layerName: 'forest',
            lng,
            lat,
            fetchFunction: () => getFeatureInfo('forest', lng, lat, map)
        }
    ];

    const [region, department, commune, forest] = await wmsCache.batchGetFeatureInfo(requests);

    return { region, department, commune, forest };
};