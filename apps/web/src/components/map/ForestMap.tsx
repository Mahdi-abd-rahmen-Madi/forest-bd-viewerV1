'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { wmsPreconnectionService } from '@/services/wmsPreconnection';
import { area } from '@turf/area';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { useQuery, useMutation } from '@apollo/client/react';
import { useMapStore } from '@/store/mapStore';
import { useAuthStore } from '@/store/authStore';
import { UPDATE_MAP_STATE } from '@/graphql/auth';
import { GET_MY_POLYGONS, SAVE_POLYGON_MUTATION } from '@/graphql/polygons';
import { queryAllLayers } from '@/services/wmsFeatureInfo';
import { WMS_LAYERS, getWMSTileUrl, getVectorTileUrl, WMSLayerConfig } from '@/services/wmsLayers';
import { useViewportForestData } from '@/hooks/useViewportForestData';
import { MapboxDrawCreateEvent, MapboxDrawModeChangeEvent, UpdateMapStateResponse, MyPolygonsQueryResult, FeatureQueryPopupProps, SelectHandlerCallback, User } from '@/types';

import { FilterPanel } from './FilterPanel';
import { SavePolygonModal } from './SavePolygonModal';
import { PolygonResultsPanel } from './PolygonResultsPanel';
import { SavedPolygonsList } from './SavedPolygonsList';
import { LayerControlPanel } from './LayerControlPanel';
import { FeatureQueryPopup } from './FeatureQueryPopup';
import { ForestCoverageOverlay } from './ForestCoverageOverlay';
import { getVosgesCoverageGeoJSON, VOSGES_CENTER, FOREST_REGIONS, getRegionByCode } from '@/utils/forestCoverageGeometry';

import { Layers, LogOut, Map as MapIcon, MapPin, Info, Satellite, Mountain, Sun, Moon } from 'lucide-react';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// Base layer configurations
const BASE_LAYERS = {
    satellite: {
        url: 'mapbox://styles/mapbox/satellite-v9',
        label: 'Satellite',
        icon: Satellite
    },
    streets: {
        url: 'mapbox://styles/mapbox/streets-v12',
        label: 'Streets',
        icon: MapIcon
    },
    terrain: {
        url: 'mapbox://styles/mapbox/outdoors-v12',
        label: 'Terrain',
        icon: Mountain
    },
    light: {
        url: 'mapbox://styles/mapbox/light-v11',
        label: 'Light',
        icon: Sun
    },
    dark: {
        url: 'mapbox://styles/mapbox/dark-v11',
        label: 'Dark',
        icon: Moon
    }
};

// Hardcoded regions for navigation
const REGIONS = [
    { code: 'NORMANDIE', name: 'Normandie', lat: 49.1829, lng: 0.3700, zoom: 7 },
    { code: 'PAYS_DE_LA_LOIRE', name: 'Pays de la Loire', lat: 47.7633, lng: -0.3297, zoom: 7 },
    { code: 'CENTRE_VAL_DE_LOIRE', name: 'Centre-Val de Loire', lat: 47.7516, lng: 1.6751, zoom: 7 }
];

export function ForestMap() {
    const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [showResults, setShowResults] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(5);
    const [wmsLayers, setWmsLayers] = useState<WMSLayerConfig[]>(WMS_LAYERS);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isQuerying, setIsQuerying] = useState(false);
    const [baseLayer, setBaseLayer] = useState<keyof typeof BASE_LAYERS>('satellite');
    const [queryPopup, setQueryPopup] = useState<{
        visible: boolean;
        lng: number;
        lat: number;
        data: any;
    } | null>(null);
    const [showForestPlots, setShowForestPlots] = useState(true);
    const [showCoverageOverlay, setShowCoverageOverlay] = useState(false);
    const [showVosgesOutline, setShowVosgesOutline] = useState(true);
    const [highlightedPolygonId, setHighlightedPolygonId] = useState<string | null>(null);
    const [showSavedPolygons, setShowSavedPolygons] = useState(true);

    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const draw = useRef<MapboxDraw | null>(null);

    const { lng, lat, zoom, filters, showCadastre, setViewState, setFilters, setShowCadastre } = useMapStore();
    const { user, logout, updateUser } = useAuthStore();

    const { data: savedPolygonsData, refetch: refetchPolygons } = useQuery<MyPolygonsQueryResult>(GET_MY_POLYGONS);
    const [updateMapState] = useMutation(UPDATE_MAP_STATE);
    const [savePolygon] = useMutation(SAVE_POLYGON_MUTATION);

    // Viewport-based forest data loading
    const { plots: viewportPlots, isLoading: viewportLoading, error: viewportError, cacheSize } = useViewportForestData(map.current, {
        filters: {
            regionCode: filters.regionCode,
            departementCode: filters.departementCode,
            communeCode: filters.communeCode,
            lieuDit: filters.lieuDit,
        },
        maxCacheAge: 3 * 60 * 1000, // 3 minutes for better cache freshness
        bufferSize: 0.05 // Smaller buffer for more precise viewport loading
    });

    // Initialize WMS preconnections
    useEffect(() => {
        // Preconnect to WMS layers based on current configuration
        wmsPreconnectionService.preconnectWMSLayers(['region', 'department', 'cummune', 'forest']);
        
        // Preconnect to additional WMS endpoints
        wmsPreconnectionService.preconnectFromLayerConfigs([
            { layerName: 'region' },
            { layerName: 'department' },
            { layerName: 'cummune' },
            { layerName: 'forest' }
        ]);
    }, []);

    // Add Vosges coverage outline layer
    const addVosgesCoverageLayer = (mapInstance: mapboxgl.Map) => {
        // Clean up existing Vosges layer
        if (mapInstance.getLayer('vosges-coverage-fill')) {
            mapInstance.removeLayer('vosges-coverage-fill');
        }
        if (mapInstance.getLayer('vosges-coverage-outline')) {
            mapInstance.removeLayer('vosges-coverage-outline');
        }
        if (mapInstance.getSource('vosges-coverage')) {
            mapInstance.removeSource('vosges-coverage');
        }

        // Add Vosges coverage source
        const vosgesGeoJSON = getVosgesCoverageGeoJSON();
        if (vosgesGeoJSON) {
            mapInstance.addSource('vosges-coverage', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [vosgesGeoJSON]
                }
            });
        }

        // Add Vosges coverage layers only if source was created
        if (vosgesGeoJSON) {
            // Add fill layer for Vosges coverage area
            mapInstance.addLayer({
                id: 'vosges-coverage-fill',
                type: 'fill',
                source: 'vosges-coverage',
                paint: {
                    'fill-color': '#3b82f6',
                    'fill-opacity': 0.1
                },
                layout: {
                    'visibility': showVosgesOutline ? 'visible' : 'none'
                }
            });

            // Add outline layer for Vosges coverage area
            mapInstance.addLayer({
                id: 'vosges-coverage-outline',
                type: 'line',
                source: 'vosges-coverage',
                paint: {
                    'line-color': '#3b82f6',
                    'line-width': 2,
                    'line-opacity': 0.8,
                    'line-dasharray': [5, 5]
                },
                layout: {
                    'visibility': showVosgesOutline ? 'visible' : 'none'
                }
            });
        }
    };

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current) return;

        const initialLng = user?.lastLng ?? lng;
        const initialLat = user?.lastLat ?? lat;
        const initialZoom = user?.lastZoom ?? zoom;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: BASE_LAYERS.satellite.url,
            center: [initialLng, initialLat],
            zoom: initialZoom,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

        // Initialize Mapbox Draw
        draw.current = new MapboxDraw({
            displayControlsDefault: false,
            controls: { polygon: true, trash: true },
            defaultMode: 'simple_select'
        });
        map.current.addControl(draw.current, 'top-right');

        // Track zoom for layer visibility
        const updateZoom = () => {
            const newZoom = map.current!.getZoom();
            setCurrentZoom(newZoom);
            updateWMSLayerVisibility(newZoom);
        };

        map.current.on('load', () => {
            setMapLoaded(true);
            addWMSLayers(map.current!);
            addForestPlotsLayer(map.current!);
            addVosgesCoverageLayer(map.current!);
            updateZoom();
        });

        map.current.on('zoom', updateZoom);

        // Handle polygon creation
        map.current.on('draw.create', (e: MapboxDrawCreateEvent) => {
            const geometry = e.features[0].geometry;
            setDrawnGeometry(geometry);
            setShowSaveModal(true);
            setIsDrawing(false);
        });

        // Handle draw mode changes
        map.current.on('draw.modechange', (e: MapboxDrawModeChangeEvent) => {
            setIsDrawing(e.mode === 'draw_polygon');
        });

        // Save map state on move
        map.current.on('moveend', () => {
            const center = map.current!.getCenter();
            const newZoom = map.current!.getZoom();
            setViewState(center.lng, center.lat, newZoom);

            if (user) {
                updateMapState({
                    variables: {
                        input: {
                            lng: center.lng,
                            lat: center.lat,
                            zoom: newZoom,
                            filters,
                            activeLayers: wmsLayers.filter(l => l.visible).map(l => l.id),
                        },
                    },
                }).then((result) => {
                    if (result.data) {
                        const data = result.data as { updateMapState: UpdateMapStateResponse['updateMapState'] };
                        updateUser({
                            lastLng: data.updateMapState.lng,
                            lastLat: data.updateMapState.lat,
                            lastZoom: data.updateMapState.zoom,
                            lastFilters: data.updateMapState.filters
                        } as Partial<User>);
                    }
                }).catch(console.error);
            }
        });

        // Feature query on click (skip if drawing)
        const handleMapClick = async (e: mapboxgl.MapMouseEvent) => {
            console.log('🖱️ Map clicked at:', e.lngLat);
            
            if (draw.current?.getMode() === 'draw_polygon') {
                console.log('❌ Skipping click - in drawing mode');
                return;
            }

            const selected = draw.current?.getSelected();
            // @ts-ignore
            if (selected?.features?.length > 0) {
                console.log('❌ Skipping click - features selected');
                return;
            }

            console.log('🔍 Starting layer query...');
            setIsQuerying(true);
            const { lng, lat } = e.lngLat;
            
            try {
                // Add timeout to prevent hanging - give more time for debugging
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        console.log('⏰ Query timeout triggered!');
                        reject(new Error('Query timeout after 15 seconds'));
                    }, 15000);
                });
                
                console.log('📡 Calling queryAllLayers...');
                const data = await Promise.race([
                    queryAllLayers(lng, lat, map.current!),
                    timeoutPromise
                ]) as any;
                
                console.log('✅ Query completed successfully:', data);
                setIsQuerying(false);

                if (data?.region || data?.department || data?.commune || data?.forest || 
                    data?.pluZoning || data?.pluPrescriptions || data?.pciParcels) {
                    console.log('📍 Showing popup with data');
                    setQueryPopup({ visible: true, lng, lat, data });
                } else {
                    console.log('📭 No data found for this location');
                }
            } catch (error) {
                console.error('❌ Error querying layers:', error);
                setIsQuerying(false);
                
                // Optionally show user feedback about the error
                if (error instanceof Error && error.message.includes('timeout')) {
                    console.warn('⏰ Layer query timed out - possible network or server issue');
                } else {
                    console.warn('🔌 Layer query failed - check network connection');
                }
            }
        };

        map.current.on('click', handleMapClick);

        return () => {
            map.current?.remove();
        };
    }, [user?.id]);

    // Handle base layer change
    const handleBaseLayerChange = (layerKey: keyof typeof BASE_LAYERS) => {
        if (!map.current) return;

        setBaseLayer(layerKey);
        map.current.setStyle(BASE_LAYERS[layerKey].url);

        // Re-add WMS layers after style change
        map.current.once('style.load', () => {
            addWMSLayers(map.current!);
            addForestPlotsLayer(map.current!);
            addVosgesCoverageLayer(map.current!);
            if (savedPolygonsData?.myPolygons) {
                displaySavedPolygonsOnMap(map.current!, savedPolygonsData.myPolygons, false);
            }
        });
    };

    // Add WMS layers
    const addWMSLayers = (mapInstance: mapboxgl.Map) => {
        // Clean up existing layers first
        wmsLayers.forEach((layer) => {
            const sourceId = `wms-${layer.id}`;
            const layerId = `wms-layer-${layer.id}`;
            const vectorSourceId = `vector-${layer.id}`;

            if (mapInstance.getLayer(layerId)) {
                mapInstance.removeLayer(layerId);
            }
            if (mapInstance.getSource(sourceId)) {
                mapInstance.removeSource(sourceId);
            }
            if (mapInstance.getSource(vectorSourceId)) {
                mapInstance.removeSource(vectorSourceId);
            }
            
            // Clean up PCI vector tile layers
            if (layer.id === 'pci-parcels') {
                const pciLayers = [
                    'parcelle', 'parcels', 'pci_parcelle', 'pci_parcelles',
                    'cadastral_parcels', 'parcelles', 'PARCELLE'
                ];
                pciLayers.forEach(sourceLayer => {
                    const pciLayerId = `pci-${sourceLayer}`;
                    if (mapInstance.getLayer(pciLayerId)) {
                        mapInstance.removeLayer(pciLayerId);
                    }
                });
            }
        });

        // Add all WMS layers
        wmsLayers.forEach((layer) => {
            if (layer.vectorTile && layer.id === 'pci-parcels') {
                // Add PCI vector tile source
                mapInstance.addSource('pci-parcels-source', {
                    type: 'vector',
                    tiles: [getVectorTileUrl(layer)],
                    minzoom: layer.minZoom,
                    maxzoom: layer.maxZoom,
                    attribution: '© IGN'
                });

                // Add multiple layer variants for robustness
                const pciLayers = [
                    'parcelle', 'parcels', 'pci_parcelle', 'pci_parcelles',
                    'cadastral_parcels', 'parcelles', 'PARCELLE'
                ];

                pciLayers.forEach(sourceLayer => {
                    mapInstance.addLayer({
                        id: `pci-${sourceLayer}`,
                        type: 'line',
                        source: 'pci-parcels-source',
                        'source-layer': sourceLayer,
                        paint: {
                            'line-color': layer.color || '#D82626',
                            'line-width': 1
                        },
                        layout: { visibility: layer.visible ? 'visible' : 'none' }
                    });
                });
            } else {
                // Add regular WMS layer
                const sourceId = `wms-${layer.id}`;
                const layerId = `wms-layer-${layer.id}`;

                mapInstance.addSource(sourceId, {
                    type: 'raster',
                    tiles: [getWMSTileUrl(layer)],
                    tileSize: 256,
                    scheme: 'xyz',
                });

                mapInstance.addLayer({
                    id: layerId,
                    type: 'raster',
                    source: sourceId,
                    paint: { 'raster-opacity': layer.visible ? layer.opacity : 0 },
                    layout: { visibility: layer.visible ? 'visible' : 'none' },
                });
            }
        });
        updateWMSLayerVisibility(map.current!.getZoom());
    };

    // Add forest plots layer for viewport-based data
    const addForestPlotsLayer = (mapInstance: mapboxgl.Map) => {
        // Clean up existing forest plots layer
        if (mapInstance.getLayer('forest-plots-fill')) {
            mapInstance.removeLayer('forest-plots-fill');
        }
        if (mapInstance.getLayer('forest-plots-outline')) {
            mapInstance.removeLayer('forest-plots-outline');
        }
        if (mapInstance.getSource('forest-plots')) {
            mapInstance.removeSource('forest-plots');
        }

        // Add empty source initially
        mapInstance.addSource('forest-plots', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        // Add fill layer for forest plots
        mapInstance.addLayer({
            id: 'forest-plots-fill',
            type: 'fill',
            source: 'forest-plots',
            paint: {
                'fill-color': '#228B22',
                'fill-opacity': 0.3
            },
            layout: {
                'visibility': showForestPlots ? 'visible' : 'none'
            }
        });

        // Add outline layer for forest plots
        mapInstance.addLayer({
            id: 'forest-plots-outline',
            type: 'line',
            source: 'forest-plots',
            paint: {
                'line-color': '#006400',
                'line-width': 1,
                'line-opacity': 0.8
            },
            layout: {
                'visibility': showForestPlots ? 'visible' : 'none'
            }
        });
    };

    // Update forest plots layer with new data
    const updateForestPlotsLayer = useCallback(() => {
        if (!map.current || !mapLoaded || viewportPlots.length === 0) return;

        const currentZoom = map.current.getZoom();
        let features = viewportPlots.map(plot => ({
            type: 'Feature' as const,
            id: plot.id,
            geometry: plot.geometry,
            properties: {
                id: plot.id,
                codeRegion: plot.codeRegion,
                codeDepartement: plot.codeDepartement,
                codeCommune: plot.codeCommune,
                lieuDit: plot.lieuDit,
                essences: plot.essences,
                surfaceHectares: plot.surfaceHectares,
                typeForet: plot.typeForet
            }
        }));

        // Performance optimization: strict feature limits at all zoom levels
        if (currentZoom < 14) {
            // Much stricter limits for better performance
            let maxFeatures;
            if (currentZoom < 12) {
                maxFeatures = 0; // No plots below zoom 12
            } else if (currentZoom < 13) {
                maxFeatures = 50; // Very limited at zoom 12-13
            } else {
                maxFeatures = 200; // Moderate limit at zoom 13-14
            }
            
            if (features.length > maxFeatures) {
                // Sample features evenly across dataset
                const step = Math.ceil(features.length / maxFeatures);
                features = features.filter((_, index) => index % step === 0).slice(0, maxFeatures);
            }
        } else {
            // Even at high zoom, limit to prevent browser crashes
            const maxFeatures = 1000;
            if (features.length > maxFeatures) {
                const step = Math.ceil(features.length / maxFeatures);
                features = features.filter((_, index) => index % step === 0).slice(0, maxFeatures);
            }
        }

        const geojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features
        };

        if (map.current.getSource('forest-plots')) {
            (map.current.getSource('forest-plots') as mapboxgl.GeoJSONSource).setData(geojson);
        }
    }, [viewportPlots, mapLoaded]);

    // Initialize cadastre state based on layer visibility
    useEffect(() => {
        const pluZoningVisible = wmsLayers.find(l => l.id === 'plu-zoning')?.visible || false;
        const pluPrescriptionsVisible = wmsLayers.find(l => l.id === 'plu-prescriptions')?.visible || false;
        const pciParcelsVisible = wmsLayers.find(l => l.id === 'pci-parcels')?.visible || false;
        const allCadastreLayersVisible = pluZoningVisible && pluPrescriptionsVisible && pciParcelsVisible;
        
        setShowCadastre(allCadastreLayersVisible);
    }, [wmsLayers, setShowCadastre]);

    // Update forest plots when data changes
    useEffect(() => {
        updateForestPlotsLayer();
    }, [updateForestPlotsLayer]);

    // Toggle forest plots visibility
    const toggleForestPlots = () => {
        setShowForestPlots(!showForestPlots);
        if (map.current) {
            const visibility = !showForestPlots ? 'visible' : 'none';
            if (map.current.getLayer('forest-plots-fill')) {
                map.current.setLayoutProperty('forest-plots-fill', 'visibility', visibility);
            }
            if (map.current.getLayer('forest-plots-outline')) {
                map.current.setLayoutProperty('forest-plots-outline', 'visibility', visibility);
            }
        }
    };

    const updateWMSLayerVisibility = (zoom: number) => {
        if (!map.current) return;
        wmsLayers.forEach((layer) => {
            if (layer.vectorTile && layer.id === 'pci-parcels') {
                // Handle PCI vector tile layers
                const pciLayers = [
                    'parcelle', 'parcels', 'pci_parcelle', 'pci_parcelles',
                    'cadastral_parcels', 'parcelles', 'PARCELLE'
                ];
                const shouldBeVisible = layer.visible && zoom >= layer.minZoom && zoom <= layer.maxZoom;
                
                pciLayers.forEach(sourceLayer => {
                    const pciLayerId = `pci-${sourceLayer}`;
                    if (map.current!.getLayer(pciLayerId)) {
                        map.current!.setLayoutProperty(pciLayerId, 'visibility', shouldBeVisible ? 'visible' : 'none');
                    }
                });
            } else {
                // Handle regular WMS layers
                const layerId = `wms-layer-${layer.id}`;
                if (map.current!.getLayer(layerId)) {
                    const shouldBeVisible = layer.visible && zoom >= layer.minZoom && zoom <= layer.maxZoom;
                    map.current!.setLayoutProperty(layerId, 'visibility', shouldBeVisible ? 'visible' : 'none');
                }
            }
        });

        // Handle forest plots visibility based on zoom
        if (map.current.getLayer('forest-plots-fill') && map.current.getLayer('forest-plots-outline')) {
            // Only show forest plots at zoom levels 12+ for better performance
            const forestPlotMinZoom = 12;
            const shouldBeVisible = showForestPlots && zoom >= forestPlotMinZoom;
            map.current.setLayoutProperty('forest-plots-fill', 'visibility', shouldBeVisible ? 'visible' : 'none');
            map.current.setLayoutProperty('forest-plots-outline', 'visibility', shouldBeVisible ? 'visible' : 'none');
        }
    };

    const handleToggleLayer = (layerId: string) => {
        const updatedLayers = wmsLayers.map((l) => l.id === layerId ? { ...l, visible: !l.visible } : l);
        setWmsLayers(updatedLayers);
        if (map.current) {
            const layer = updatedLayers.find(l => l.id === layerId);
            if (!layer) return;
            
            if (layer.vectorTile && layer.id === 'pci-parcels') {
                // Handle PCI vector tile layers
                const pciLayers = [
                    'parcelle', 'parcels', 'pci_parcelle', 'pci_parcelles',
                    'cadastral_parcels', 'parcelles', 'PARCELLE'
                ];
                const shouldBeVisible = layer.visible && currentZoom >= layer.minZoom && currentZoom <= layer.maxZoom;
                
                pciLayers.forEach(sourceLayer => {
                    const pciLayerId = `pci-${sourceLayer}`;
                    if (map.current!.getLayer(pciLayerId)) {
                        map.current!.setLayoutProperty(pciLayerId, 'visibility', shouldBeVisible ? 'visible' : 'none');
                    }
                });
            } else {
                // Handle regular WMS layers
                const mapLayerId = `wms-layer-${layerId}`;
                if (map.current!.getLayer(mapLayerId)) {
                    const shouldBeVisible = layer.visible && currentZoom >= layer.minZoom && currentZoom <= layer.maxZoom;
                    map.current!.setLayoutProperty(mapLayerId, 'visibility', shouldBeVisible ? 'visible' : 'none');
                }
            }
        }
        
        // Update cadastre button state based on individual layer states
        const pluZoningVisible = updatedLayers.find(l => l.id === 'plu-zoning')?.visible || false;
        const pluPrescriptionsVisible = updatedLayers.find(l => l.id === 'plu-prescriptions')?.visible || false;
        const pciParcelsVisible = updatedLayers.find(l => l.id === 'pci-parcels')?.visible || false;
        const allCadastreLayersVisible = pluZoningVisible && pluPrescriptionsVisible && pciParcelsVisible;
        
        setShowCadastre(allCadastreLayersVisible);
    };

    const handleToggleCadastre = () => {
        const newCadastreState = !showCadastre;
        setShowCadastre(newCadastreState);
        
        // Toggle PLU and PCI layers based on cadastre state
        const updatedLayers = wmsLayers.map(layer => {
            if (layer.id === 'plu-zoning' || layer.id === 'plu-prescriptions' || layer.id === 'pci-parcels') {
                return { ...layer, visible: newCadastreState };
            }
            return layer;
        });
        setWmsLayers(updatedLayers);
        
        // Update map layers if map is loaded
        if (map.current) {
            updatedLayers.forEach(layer => {
                if (layer.id === 'plu-zoning' || layer.id === 'plu-prescriptions') {
                    // Handle WMS layers
                    const layerId = `wms-layer-${layer.id}`;
                    if (map.current!.getLayer(layerId)) {
                        const shouldBeVisible = newCadastreState && currentZoom >= layer.minZoom && currentZoom <= layer.maxZoom;
                        map.current!.setLayoutProperty(layerId, 'visibility', shouldBeVisible ? 'visible' : 'none');
                    }
                } else if (layer.id === 'pci-parcels') {
                    // Handle vector tile layers
                    const pciLayers = [
                        'parcelle', 'parcels', 'pci_parcelle', 'pci_parcelles',
                        'cadastral_parcels', 'parcelles', 'PARCELLE'
                    ];
                    const shouldBeVisible = newCadastreState && currentZoom >= layer.minZoom && currentZoom <= layer.maxZoom;
                    
                    pciLayers.forEach(sourceLayer => {
                        const pciLayerId = `pci-${sourceLayer}`;
                        if (map.current!.getLayer(pciLayerId)) {
                            map.current!.setLayoutProperty(pciLayerId, 'visibility', shouldBeVisible ? 'visible' : 'none');
                        }
                    });
                }
            });
        }
    };

    // Start drawing mode
    const handleDrawStart = () => {
        if (!draw.current) return;
        draw.current.changeMode('draw_polygon');
        setIsDrawing(true);
    };

    // Handle polygon save
    const handleSavePolygon = async (name: string) => {
        if (!drawnGeometry) return;

        try {
            // Calculate area using turf.js directly on main thread
            const areaInSquareMeters = area(drawnGeometry);
            const areaHectares = areaInSquareMeters / 10000;
            
            // DEBUG: Log polygon coordinates and bounds
            console.log('🎯 Frontend - Saving polygon with coordinates:', JSON.stringify(drawnGeometry, null, 2));
            
            // Calculate bounds for debugging
            const bounds = {
                minLng: Math.min(...drawnGeometry.coordinates[0].map((coord: number[]) => coord[0])),
                maxLng: Math.max(...drawnGeometry.coordinates[0].map((coord: number[]) => coord[0])),
                minLat: Math.min(...drawnGeometry.coordinates[0].map((coord: number[]) => coord[1])),
                maxLat: Math.max(...drawnGeometry.coordinates[0].map((coord: number[]) => coord[1]))
            };
            console.log('📍 Frontend - Polygon bounds:', bounds);
            console.log('📏 Frontend - Calculated area:', areaHectares, 'hectares');
            
            // Check if polygon is in expected forest data region (Vosges)
            const inVosgesRegion = bounds.minLng >= 5.39 && bounds.maxLng <= 7.19 && 
                                   bounds.minLat >= 47.81 && bounds.maxLat <= 48.51;
            console.log('🌲 Frontend - In Vosges region?', inVosgesRegion);
            
            if (!inVosgesRegion) {
                console.warn('⚠️ Frontend - Polygon outside forest data coverage area');
                console.log('💡 Frontend - Forest data available for Vosges region only (5.39-7.19°E, 47.81-48.51°N)');
            }
            
            const { data } = await savePolygon({
                variables: {
                    input: {
                        name: name.trim(),
                        geometry: JSON.stringify(drawnGeometry),
                        areaHectares: Math.round(areaHectares * 100) / 100
                    }
                }
            });

            // @ts-ignore
            setAnalysisResult(data.savePolygon);
            setShowResults(true);
            setShowSaveModal(false);

            draw.current?.deleteAll();
            setDrawnGeometry(null);
            refetchPolygons();
        } catch (error) {
            console.error('Error saving polygon:', error);
            alert('Failed to save polygon. Please try again.');
        }
    };

    // Handle region navigation
    const handleRegionNavigate = (lat: number, lng: number, zoom: number) => {
        if (!map.current) return;
        map.current.flyTo({
            center: [lng, lat],
            zoom: zoom,
            essential: true
        });
    };

    // Handle navigation to specific region
    const handleNavigateToRegion = (regionCode: string) => {
        if (!map.current) return;
        const region = getRegionByCode(regionCode);
        if (!region) return;
        
        map.current.flyTo({
            center: [region.center.lng, region.center.lat],
            zoom: region.center.zoom,
            essential: true
        });
    };

    // Handle navigation to Vosges region (legacy)
    const handleNavigateToVosges = () => {
        handleNavigateToRegion('GRAND_EST');
    };

    // Handle fly to polygon
    const handleFlyToPolygon = (polygon: any) => {
        if (!map.current || !polygon.geometry) {
            return;
        }

        let geometry = polygon.geometry;
        
        if (typeof geometry === 'string') {
            try { 
                geometry = JSON.parse(geometry); 
            } catch (error) { 
                return; 
            }
        }

        if (!geometry?.coordinates || !Array.isArray(geometry.coordinates)) {
            return;
        }

        // Calculate bounds from polygon coordinates
        let coords: number[][] = [];
        
        // Handle different geometry structures
        if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates[0])) {
            coords = geometry.coordinates[0]; // First ring of polygon
        } else if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates[0][0])) {
            coords = geometry.coordinates[0][0]; // First ring of first polygon
        } else if (Array.isArray(geometry.coordinates)) {
            // Fallback: try to get first valid coordinate array
            coords = geometry.coordinates[0] || geometry.coordinates;
        }
        
        if (!coords || coords.length === 0) {
            return;
        }
        
        // Validate coordinates
        const validCoords = coords.filter(coord => 
            Array.isArray(coord) && 
            coord.length >= 2 && 
            typeof coord[0] === 'number' && 
            typeof coord[1] === 'number' &&
            !isNaN(coord[0]) && 
            !isNaN(coord[1])
        );
        
        if (validCoords.length === 0) {
            return;
        }
        
        const lngs = validCoords.map((coord: number[]) => coord[0]);
        const lats = validCoords.map((coord: number[]) => coord[1]);
        
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        
        // Calculate center
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;
        
        // Validate center coordinates
        if (isNaN(centerLng) || isNaN(centerLat)) {
            return;
        }
        
        // Calculate appropriate zoom based on polygon size
        const lngDiff = maxLng - minLng;
        const latDiff = maxLat - minLat;
        const maxDiff = Math.max(lngDiff, latDiff);
        
        // Adjust zoom based on polygon size - smaller polygons need higher zoom
        let zoom = 14; // Default zoom
        if (maxDiff > 0.5) zoom = 10;
        else if (maxDiff > 0.2) zoom = 11;
        else if (maxDiff > 0.1) zoom = 12;
        else if (maxDiff > 0.05) zoom = 13;
        else if (maxDiff < 0.01) zoom = 15;
        
        map.current.flyTo({
            center: [centerLng, centerLat],
            zoom: zoom,
            essential: true
        });
    };

    // Toggle Vosges outline visibility
    const toggleVosgesOutline = () => {
        setShowVosgesOutline(!showVosgesOutline);
        if (map.current) {
            const visibility = showVosgesOutline ? 'none' : 'visible';
            if (map.current.getLayer('vosges-coverage-fill')) {
                map.current.setLayoutProperty('vosges-coverage-fill', 'visibility', visibility);
            }
            if (map.current.getLayer('vosges-coverage-outline')) {
                map.current.setLayoutProperty('vosges-coverage-outline', 'visibility', visibility);
            }
        }
    };

    // Handle polygon highlight (show/hide individual polygon)
    const handleHighlightPolygon = (polygon: any) => {
        if (!showSavedPolygons) {
            // If polygons are hidden, show all polygons
            setShowSavedPolygons(true);
            setHighlightedPolygonId(null);
        } else if (highlightedPolygonId === polygon.id) {
            // If the same polygon is clicked again, hide all polygons
            setHighlightedPolygonId(null);
            setShowSavedPolygons(false);
        } else {
            // Highlight the new polygon and ensure polygons are shown
            setHighlightedPolygonId(polygon.id);
            setShowSavedPolygons(true);
        }
    };

    // Display saved polygons
    useEffect(() => {
        if (!map.current || !savedPolygonsData?.myPolygons || !mapLoaded) return;

        const timer = setTimeout(() => {
            displaySavedPolygonsOnMap(map.current!, savedPolygonsData.myPolygons, false);
        }, 500);

        return () => clearTimeout(timer);
    }, [savedPolygonsData, mapLoaded, highlightedPolygonId, showSavedPolygons]);

    const displaySavedPolygonsOnMap = (mapInstance: mapboxgl.Map, polygons: any[], fitBounds: boolean = false) => {
        if (!mapInstance.isStyleLoaded()) {
            setTimeout(() => displaySavedPolygonsOnMap(mapInstance, polygons, fitBounds), 200);
            return;
        }

        // Clean up existing
        if (mapInstance.getLayer('saved-polygons-fill')) mapInstance.removeLayer('saved-polygons-fill');
        if (mapInstance.getLayer('saved-polygons-outline')) mapInstance.removeLayer('saved-polygons-outline');
        if (mapInstance.getSource('saved-polygons')) mapInstance.removeSource('saved-polygons');

        if (polygons.length === 0) return;

        // Don't show any polygons if showSavedPolygons is false
        if (!showSavedPolygons) return;

        // Filter polygons based on highlighted state
        let filteredPolygons = polygons;
        
        if (highlightedPolygonId) {
            // Show only the highlighted polygon
            filteredPolygons = polygons.filter(p => p.id === highlightedPolygonId);
        }

        const validPolygons = filteredPolygons.map((p) => {
            let geometry = p.geometry;
            if (typeof geometry === 'string') {
                try { geometry = JSON.parse(geometry); } catch { return null; }
            }
            if (!geometry?.coordinates || !Array.isArray(geometry.coordinates)) return null;
            return { ...p, geometry };
        }).filter(Boolean);

        if (validPolygons.length === 0) return;

        const geojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection' as const,
            features: validPolygons.map((p) => ({
                type: 'Feature' as const,
                id: p.id,
                geometry: p.geometry,
                properties: { name: p.name, area: p.areaHectares, status: p.status },
            })),
        };

        try {
            mapInstance.addSource('saved-polygons', { type: 'geojson', data: geojson });
            mapInstance.addLayer({
                id: 'saved-polygons-fill',
                type: 'fill',
                source: 'saved-polygons',
                paint: { 'fill-color': '#0b4a59', 'fill-opacity': 0.2 },
            });
            mapInstance.addLayer({
                id: 'saved-polygons-outline',
                type: 'line',
                source: 'saved-polygons',
                paint: { 'line-color': '#0b4a59', 'line-width': 2, 'line-dasharray': [2, 2] },
            });
        } catch (error) {
            console.error('Error adding polygons:', error);
        }
    };

    const handleLogout = () => {
        logout();
        window.location.href = '/auth';
    };

    return (
        <div className="relative w-full h-screen overflow-hidden">
            {/* Base Layer Control - Top Left */}
            <div className="absolute bottom-4 right-4 z-10">
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2">
                    <div className="text-xs font-semibold text-gray-500 mb-2 px-1">Base Map</div>
                    <div className="flex flex-col gap-1">
                        {(Object.keys(BASE_LAYERS) as Array<keyof typeof BASE_LAYERS>).map((key) => {
                            const { label, icon: Icon } = BASE_LAYERS[key];
                            return (
                                <button
                                    key={key}
                                    onClick={() => handleBaseLayerChange(key)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                        baseLayer === key
                                            ? 'bg-[#0b4a59] text-white'
                                            : 'hover:bg-gray-100 text-gray-700'
                                    }`}
                                >
                                    <Icon size={16} />
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

            <FilterPanel onRegionSelect={handleRegionNavigate} />

            <LayerControlPanel
                layers={wmsLayers}
                onToggleLayer={handleToggleLayer}
                currentZoom={currentZoom}
                onDrawStart={handleDrawStart}
                isDrawing={isDrawing}
                showCadastre={showCadastre}
                onToggleCadastre={handleToggleCadastre}
            />

            <SavedPolygonsList 
                onSelectPolygon={(p) => {
                    setAnalysisResult(p);
                    setShowResults(true);
                }}
                onHighlightPolygon={handleHighlightPolygon}
                onFlyToPolygon={handleFlyToPolygon}
                selectedPolygonId={highlightedPolygonId}
            />

            {/* Save Polygon Modal */}
            {showSaveModal && drawnGeometry && (
                <SavePolygonModal
                    geometry={drawnGeometry}
                    onClose={() => {
                        setShowSaveModal(false);
                        setDrawnGeometry(null);
                        draw.current?.deleteAll();
                    }}
                    onSaved={handleSavePolygon}
                />
            )}

            {/* Analysis Results Panel */}
            {showResults && analysisResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <PolygonResultsPanel
                        result={analysisResult}
                        onClose={() => setShowResults(false)}
                    />
                </div>
            )}

            {/* Feature Query Popup */}
            {queryPopup?.visible && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                    style={{ zIndex: 50 }}
                >
                    <div className="pointer-events-auto">
                        <FeatureQueryPopup
                            lng={queryPopup.lng}
                            lat={queryPopup.lat}
                            data={queryPopup.data}
                            onClose={() => setQueryPopup(null)}
                            onSelectRegion={(code: string) => {
                                setFilters({ regionCode: code });
                                setQueryPopup(null);
                            }}
                            onSelectDepartment={(code: string) => {
                                setFilters({ ...filters, departementCode: code });
                                setQueryPopup(null);
                            }}
                            onSelectCommune={(code: string) => {
                                setFilters({ ...filters, communeCode: code });
                                setQueryPopup(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Forest Coverage Info Overlay */}
            <ForestCoverageOverlay
                visible={showCoverageOverlay}
                onClose={() => setShowCoverageOverlay(false)}
                onNavigateToRegion={handleNavigateToRegion}
            />

            {/* Query Loading Indicator */}
            {isQuerying && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-white rounded-lg shadow-lg px-4 py-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-4 h-4 border-2 border-[#0b4a59] border-t-transparent rounded-full animate-spin" />
                        Querying layers...
                    </div>
                </div>
            )}

            {/* Viewport Forest Data Status */}
            {showForestPlots && (viewportLoading || viewportError) && (
                <div className="absolute bottom-20 left-4 z-40 bg-white rounded-lg shadow-lg px-3 py-2 max-w-xs">
                    {viewportLoading && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                            Loading forest plots...
                        </div>
                    )}
                    {viewportError && (
                        <div className="flex items-center gap-2 text-xs text-red-600">
                            <div className="w-3 h-3 bg-red-500 rounded-full" />
                            Error: {viewportError}
                        </div>
                    )}
                    {viewportPlots.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                            {viewportPlots.length} plots loaded (Cache: {cacheSize})
                        </div>
                    )}
                </div>
            )}

            {/* Controls positioned after Forest Explorer panel */}
            <div className="absolute top-4 left-[380px] z-10 flex flex-col gap-2">
                {/* Coverage Info Button */}
                <button
                    onClick={() => setShowCoverageOverlay(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg shadow-lg border border-green-500 hover:bg-green-600 transition-all text-sm"
                >
                    <Info size={18} />
                    <span className="font-medium">Coverage Info</span>
                </button>

                {/* Second row - Vosges Navigation and Logout */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowCoverageOverlay(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg shadow-lg border border-green-500 hover:bg-green-600 transition-all text-sm"
                    >
                        <MapPin size={18} />
                        <span className="font-medium">Explore Forest Regions</span>
                    </button>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-2 bg-white text-red-600 rounded-lg shadow-lg border border-gray-200 hover:bg-red-50 transition-all text-sm"
                    >
                        <LogOut size={18} />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </div>

                </div>
    );
}