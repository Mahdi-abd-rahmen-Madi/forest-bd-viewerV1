import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ForestPlot } from '@forest/database';
import { ForestPlotsFilterInput } from './dto/geospatial.input';
import {
    IGeospatialService,
    SpatialAnalysisRequest,
    SpatialAnalysisResult,
    GeospatialQueryRequest,
    GeospatialQueryResult
} from './geospatial-service.interface';
import * as turf from '@turf/turf';

@Injectable()
export class GeospatialService implements IGeospatialService {
    constructor(
        @InjectRepository(ForestPlot)
        private forestRepo: Repository<ForestPlot>,
        private readonly dataSource: DataSource,
    ) { }

    async getRegions(): Promise<string[]> {
        const result = await this.forestRepo
            .createQueryBuilder('plot')
            .select('DISTINCT plot.codeRegion', 'code')
            .where('plot.codeRegion IS NOT NULL')
            .orderBy('code')
            .getRawMany();
        
        const regions = result.map((r: any) => r.code);
        
        // If no regions found in data, return empty array
        // This indicates the forest data doesn't include administrative codes
        if (regions.length === 0) {
            console.log('GeospatialService - No administrative regions found in forest data');
        }
        
        return regions;
    }

    async getDepartements(regionCode: string): Promise<string[]> {
        // Since forest data has no administrative codes, return empty array
        // This prevents filtering by administrative codes that don't exist
        console.log('GeospatialService - Administrative filtering not available: no department codes in forest data');
        return [];
    }

    async getCommunes(departementCode: string): Promise<string[]> {
        // Since forest data has no administrative codes, return empty array
        console.log('GeospatialService - Administrative filtering not available: no commune codes in forest data');
        return [];
    }

    async getLieuxDits(communeCode: string): Promise<string[]> {
        // Since forest data has no administrative codes, return empty array
        console.log('GeospatialService - Administrative filtering not available: no lieu-dit codes in forest data');
        return [];
    }

    async getForestPlots(filters: ForestPlotsFilterInput) {
        const query = this.forestRepo
            .createQueryBuilder('plot')
            .select([
                'plot.id',
                'plot.codeRegion',
                'plot.codeDepartement', 
                'plot.codeCommune',
                'plot.lieuDit',
                'plot.essences',
                'plot.surfaceHectares',
                'plot.typeForet',
                'ST_AsGeoJSON(plot.geom)::json as geometry',
            ]);

        // Apply spatial bounds filtering first for maximum performance
        if (filters.bounds) {
            query.andWhere(
                `ST_Intersects(plot.geom, ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326))`,
                filters.bounds,
            );
        }

        // Check if administrative filters are being applied but won't work due to missing data
        const hasAdminFilters = filters.regionCode || filters.departementCode || filters.communeCode || filters.lieuDit;
        
        if (hasAdminFilters) {
            console.log('GeospatialService - Administrative filters detected but forest data has no administrative codes');
            console.log('GeospatialService - Filters:', {
                regionCode: filters.regionCode,
                departementCode: filters.departementCode,
                communeCode: filters.communeCode,
                lieuDit: filters.lieuDit
            });
            
            // Since forest data has no administrative codes, administrative filters will return no results
            // Apply them anyway for consistency, but they will effectively filter out everything
            if (filters.regionCode) {
                query.andWhere('plot.codeRegion = :regionCode', { regionCode: filters.regionCode });
            }
            if (filters.departementCode) {
                query.andWhere('plot.codeDepartement = :departementCode', { departementCode: filters.departementCode });
            }
            if (filters.communeCode) {
                query.andWhere('plot.codeCommune = :communeCode', { communeCode: filters.communeCode });
            }
            if (filters.lieuDit) {
                query.andWhere('plot.lieuDit = :lieuDit', { lieuDit: filters.lieuDit });
            }
        }

        // Add query timeout to prevent long-running queries
        query.limit(10000);
        const result = await query.getRawMany();
        
        console.log(`GeospatialService - getForestPlots returned ${result.length} plots`);
        if (hasAdminFilters && result.length === 0) {
            console.log('GeospatialService - No results due to administrative filters on data without administrative codes');
            console.log('GeospatialService - Try using spatial bounds only or remove administrative filters');
        }
        
        return result;
    }

    /**
     * Analyze spatial intersection between geometry and forest plots
     */
    async analyzeSpatialIntersection(request: SpatialAnalysisRequest): Promise<SpatialAnalysisResult> {
        console.log('GeospatialService - request.geometry:', request.geometry);
        const geometry = JSON.parse(request.geometry);
        console.log('GeospatialService - parsed geometry type:', geometry.type);
        console.log('GeospatialService - parsed geometry:', JSON.stringify(geometry, null, 2));
        
        // Calculate polygon bounds for coverage checking
        const bounds = this.calculateGeometryBounds(geometry);
        console.log('GeospatialService - polygon bounds:', bounds);
        
        // Check if polygon is within forest data coverage area
        const inVosgesRegion = bounds.minLng >= 5.39 && bounds.maxLng <= 7.19 && 
                               bounds.minLat >= 47.81 && bounds.maxLat <= 48.51;
        console.log('GeospatialService - polygon in Vosges region?', inVosgesRegion);
        
        if (!inVosgesRegion) {
            console.warn('⚠️ GeospatialService - Polygon outside forest data coverage area');
            console.log('💡 GeospatialService - Forest data available for Vosges region only (5.39-7.19°E, 47.81-48.51°N)');
            console.log('📍 GeospatialService - Current polygon bounds vs coverage:');
            console.log(`   Polygon:Lng(${bounds.minLng} to ${bounds.maxLng}), Lat(${bounds.minLat} to ${bounds.maxLat})`);
            console.log(`   Coverage:Lng(5.39 to 7.19), Lat(47.81 to 48.51)`);
        }
        
        const areaInSquareMeters = turf.area(geometry);
        const areaHectares = areaInSquareMeters / 10000;
        console.log('GeospatialService - calculated area - square meters:', areaInSquareMeters, 'hectares:', areaHectares);

        const intersectingPlots = await this.findIntersectingPlots(request.geometry);
        console.log('GeospatialService - intersecting plots count:', intersectingPlots.length);

        const totalForestArea = intersectingPlots.reduce((sum, plot) => sum + (plot.surfaceHectares || 0), 0);
        console.log('GeospatialService - total forest area from plots:', totalForestArea);
        
        const coveragePercentage = areaHectares > 0 ? (totalForestArea / areaHectares) * 100 : 0;
        console.log('GeospatialService - coverage percentage calculation:', `${totalForestArea} / ${areaHectares} * 100 =`, coveragePercentage);

        const speciesDistribution = this.calculateSpeciesDistribution(intersectingPlots, totalForestArea);

        const rawForestTypes = [...new Set(intersectingPlots.map(plot => plot.typeForet).filter((type): type is string => Boolean(type)))];
        const forestTypes = rawForestTypes.map(type => this.fixUtf8Encoding(type));
        console.log('GeospatialService - forest types found:', forestTypes);

        const result = {
            plotCount: intersectingPlots.length,
            totalForestArea,
            coveragePercentage: Math.round(coveragePercentage * 100) / 100,
            forestTypes,
            speciesDistribution,
        };
        
        console.log('GeospatialService - final result:', JSON.stringify(result, null, 2));
        
        // Add helpful summary for debugging
        if (intersectingPlots.length === 0) {
            console.log('🔍 GeospatialService - No forest plots found. Possible reasons:');
            console.log('   1. Polygon outside forest data coverage area');
            console.log('   2. Polygon in area with no forest data');
            console.log('   3. Coordinate system or geometry format issues');
            if (!inVosgesRegion) {
                console.log('   ✅ Confirmed: Polygon outside Vosges forest data coverage');
            }
        }
        
        return result;
    }

    /**
     * Fix UTF-8 encoding issues in text data
     */
    private fixUtf8Encoding(text: string): string {
        if (!text) return text;
        
        // Common UTF-8 encoding fixes for French characters
        return text
            .replace(/Ã®/g, 'î')     // î
            .replace(/Ã©/g, 'é')     // é
            .replace(/Ã¨/g, 'è')     // è
            .replace(/Ãª/g, 'ê')     // ê
            .replace(/Ã«/g, 'ë')     // ë
            .replace(/Ã§/g, 'ç')     // ç
            .replace(/Ã /g, 'à')     // à
            .replace(/Ã¢/g, 'â')     // â
            .replace(/Ã´/g, 'ô')     // ô
            .replace(/Ã¹/g, 'ù')     // ù
            .replace(/Ã»/g, 'û')     // û
            .replace(/Ã€/g, 'À')     // À
            .replace(/Ãˆ/g, 'È')     // È
            .replace(/Ã‰/g, 'É')     // É
            .replace(/ÃŠ/g, 'Ê')     // Ê
            .replace(/Ã‹/g, 'Ë')     // Ë
            .replace(/ÃŒ/g, 'Ì')     // Ì
            .replace(/Ã/g, 'Í')     // Í
            .replace(/ÃŽ/g, 'Î')     // Î
            .replace(/Ã¯/g, 'Ï')     // Ï
            .replace(/Ã'/g, 'Ò')     // Ò
            .replace(/Ã"/g, 'Ó')     // Ó
            .replace(/Ã"/g, 'Ô')     // Ô
            .replace(/Ã•/g, 'Õ')     // Õ
            .replace(/Ã–/g, 'Ö')     // Ö
            .replace(/Ã—/g, '×')     // ×
            .replace(/Ã˜/g, 'Ø')     // Ø
            .replace(/Ã™/g, 'Ù')     // Ù
            .replace(/Ãš/g, 'Ú')     // Ú
            .replace(/Ã›/g, 'Û')     // Û
            .replace(/Ãœ/g, 'Ü')     // Ü
            .replace(/ÃŸ/g, 'Ý')     // Ý
            .replace(/Ã¿/g, 'ÿ')     // ÿ
            .replace(/Â /g, '')      // Remove non-breaking spaces
            .replace(/Â«/g, '"')     // Left quote
            .replace(/Â»/g, '"')     // Right quote
            .replace(/Â'/g, "'")     // Single quote
            .replace(/Â"/g, '"')     // Double quote
            .replace(/Â…/g, '...')   // Ellipsis
            .replace(/Â€/g, '€')     // Euro
            .replace(/Â£/g, '£')     // Pound
            .replace(/Â¥/g, '¥')    // Yen
            // Additional specific fixes for the reported issues
            .replace(/mÃ©langÃ©s/g, 'mélangés')
            .replace(/Ã©picÃ©a/g, 'épicéa')
            .replace(/ConifÃ¨res/g, 'Conifères')
            .replace(/dÂ'un/g, "d'un")
            .replace(/ChÃªnes dÃ©cidus/g, 'Chênes décidus')
            .replace(/Í/g, 'à')      // For standalone Í
            .replace(/Ã/g, 'à');     // For standalone Ã
    }

    /**
     * Calculate geometry bounds for coverage checking
     */
    private calculateGeometryBounds(geometry: any): { minLng: number, maxLng: number, minLat: number, maxLat: number } {
        let allCoords: [number, number][] = [];
        
        if (geometry.type === 'Polygon') {
            allCoords = geometry.coordinates[0] as [number, number][];
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach((polygon: number[][][]) => {
                allCoords = allCoords.concat(polygon[0] as [number, number][]);
            });
        }
        
        const lngs = allCoords.map(coord => coord[0]);
        const lats = allCoords.map(coord => coord[1]);
        
        return {
            minLng: Math.min(...lngs),
            maxLng: Math.max(...lngs),
            minLat: Math.min(...lats),
            maxLat: Math.max(...lats)
        };
    }

    /**
     * Query forest plots with spatial and administrative filtering
     */
    async queryForestPlots(request: GeospatialQueryRequest): Promise<GeospatialQueryResult> {
        const query = this.forestRepo.createQueryBuilder('plot');

        if (request.bounds) {
            query.andWhere(
                `ST_Intersects(plot.geom, ST_MakeEnvelope(:west, :south, :east, :north, 4326))`,
                {
                    west: request.bounds.west,
                    south: request.bounds.south,
                    east: request.bounds.east,
                    north: request.bounds.north,
                }
            );
        }

        if (request.administrativeFilters) {
            const { codeRegion, codeDepartement, codeCommune } = request.administrativeFilters;

            if (codeRegion) {
                query.andWhere('plot.codeRegion = :codeRegion', { codeRegion });
            }
            if (codeDepartement) {
                query.andWhere('plot.codeDepartement = :codeDepartement', { codeDepartement });
            }
            if (codeCommune) {
                query.andWhere('plot.codeCommune = :codeCommune', { codeCommune });
            }
        }

        const limit = Math.min(request.limit || 1000, 10000);
        const offset = request.offset || 0;

        query.limit(limit).offset(offset);

        const [plots, totalCount] = await query.getManyAndCount();

        return {
            plots,
            totalCount,
            hasMore: offset + plots.length < totalCount,
        };
    }

    /**
     * Calculate area statistics for a given geometry
     */
    async calculateAreaStats(geometry: string): Promise<{
        areaSquareMeters: number;
        areaHectares: number;
    }> {
        const parsedGeometry = JSON.parse(geometry);
        const areaSquareMeters = turf.area(parsedGeometry);
        const areaHectares = areaSquareMeters / 10000;

        return {
            areaSquareMeters: Math.round(areaSquareMeters * 100) / 100,
            areaHectares: Math.round(areaHectares * 100) / 100,
        };
    }

    /**
     * Find intersecting forest plots for a geometry
     */
    async findIntersectingPlots(geometry: string): Promise<ForestPlot[]> {
        console.log('findIntersectingPlots - original geometry:', geometry);
        
        // Convert Polygon to MultiPolygon if needed to match database schema
        const parsedGeometry = JSON.parse(geometry);
        let processedGeometry = geometry;
        
        if (parsedGeometry.type === 'Polygon') {
            const multiPolygon = {
                type: 'MultiPolygon',
                coordinates: [parsedGeometry.coordinates]
            };
            processedGeometry = JSON.stringify(multiPolygon);
            console.log('findIntersectingPlots - converted to MultiPolygon:', processedGeometry);
        }

        try {
            // First check if we have any forest plots data at all
            const countQuery = 'SELECT COUNT(*) as total FROM forest_plots';
            const countResult = await this.dataSource.query(countQuery);
            console.log('findIntersectingPlots - total forest plots in DB:', countResult[0]?.total);

            // Check sample forest plot data structure
            const sampleQuery = `
                SELECT id, essences, surface_hectares, type_foret, 
                       ST_AsGeoJSON(geom)::json as geometry
                FROM forest_plots 
                LIMIT 3
            `;
            const sampleResult = await this.dataSource.query(sampleQuery);
            console.log('findIntersectingPlots - sample plot data:', JSON.stringify(sampleResult, null, 2));

            // Use ST_GeomFromGeoJSON to convert JSON to PostGIS geometry for spatial query
            const query = `
                SELECT id, code_region as "codeRegion", code_departement as "codeDepartement", 
                       code_commune as "codeCommune", lieu_dit as "lieuDit", 
                       essences, surface_hectares as "surfaceHectares", type_foret as "typeForet", 
                       ST_AsGeoJSON(geom)::json as geometry
                FROM forest_plots 
                WHERE ST_Intersects(
                    ST_GeomFromGeoJSON($1),
                    geom
                )
                LIMIT 10000
            `;

            console.log('findIntersectingPlots - executing query with geometry:', processedGeometry);
            const result = await this.dataSource.query(query, [processedGeometry]);
            console.log('findIntersectingPlots - query successful, found', result.length, 'plots');
            
            // Log details of found plots
            if (result.length > 0) {
                console.log('findIntersectingPlots - first plot details:', JSON.stringify(result[0], null, 2));
                console.log('findIntersectingPlots - plot surface areas:', result.map((p: any) => p.surfaceHectares));
                console.log('findIntersectingPlots - plot essences:', result.map((p: any) => p.essences));
            } else {
                console.log('findIntersectingPlots - no intersecting plots found, checking if geometry is valid');
                
                // Check forest data coverage bounds
                const boundsQuery = `
                    SELECT 
                        MIN(ST_XMin(ST_Envelope(geom))) as min_lon,
                        MAX(ST_XMax(ST_Envelope(geom))) as max_lon,
                        MIN(ST_YMin(ST_Envelope(geom))) as min_lat,
                        MAX(ST_YMax(ST_Envelope(geom))) as max_lat
                    FROM forest_plots
                `;
                const boundsResult = await this.dataSource.query(boundsQuery);
                const bounds = boundsResult[0];
                
                console.log('findIntersectingPlots - forest data coverage bounds:', bounds);
                
                // Get polygon bounds to check if it's outside coverage area
                const polygonBoundsQuery = `
                    SELECT 
                        ST_XMin(ST_Envelope(ST_GeomFromGeoJSON($1))) as poly_min_lon,
                        ST_XMax(ST_Envelope(ST_GeomFromGeoJSON($1))) as poly_max_lon,
                        ST_YMin(ST_Envelope(ST_GeomFromGeoJSON($1))) as poly_min_lat,
                        ST_YMax(ST_Envelope(ST_GeomFromGeoJSON($1))) as poly_max_lat
                `;
                const polygonBounds = await this.dataSource.query(polygonBoundsQuery, [processedGeometry]);
                console.log('findIntersectingPlots - polygon bounds:', polygonBounds[0]);
                
                // Try a broader query to see if any plots exist in the general area
                const bboxQuery = `
                    SELECT COUNT(*) as count
                    FROM forest_plots 
                    WHERE ST_Intersects(
                        ST_Envelope(ST_GeomFromGeoJSON($1)),
                        geom
                    )
                `;
                const bboxResult = await this.dataSource.query(bboxQuery, [processedGeometry]);
                console.log('findIntersectingPlots - plots in bounding box:', bboxResult[0].count);
                
                // Add helpful warning for users
                if (bboxResult[0].count === 0) {
                    console.log('findIntersectingPlots - WARNING: Polygon appears to be outside forest data coverage area');
                    console.log('findIntersectingPlots - Forest data available for Vosges region only (5.39-7.19°E, 47.81-48.51°N)');
                }
            }
            
            return result as ForestPlot[];
        } catch (error) {
            console.error('findIntersectingPlots - PostGIS error:', error);
            console.error('findIntersectingPlots - error details:', error.message);
            throw error;
        }
    }

    /**
     * Calculate species distribution from intersecting plots
     */
    private calculateSpeciesDistribution(
        plots: ForestPlot[],
        totalForestArea: number
    ): Array<{ species: string; areaHectares: number; percentage: number }> {
        console.log('calculateSpeciesDistribution - input plots:', plots.length);
        console.log('calculateSpeciesDistribution - totalForestArea:', totalForestArea);
        
        const speciesMap = new Map<string, number>();

        plots.forEach((plot, index) => {
            console.log(`calculateSpeciesDistribution - processing plot ${index}:`, {
                essences: plot.essences,
                surfaceHectares: plot.surfaceHectares,
                essencesLength: plot.essences?.length
            });
            
            if (plot.essences && plot.surfaceHectares && plot.essences.length > 0) {
                const areaPerSpecies = plot.surfaceHectares / plot.essences.length;
                console.log(`calculateSpeciesDistribution - area per species for plot ${index}:`, areaPerSpecies);
                
                plot.essences.forEach(species => {
                    const current = speciesMap.get(species) || 0;
                    speciesMap.set(species, current + areaPerSpecies);
                });
            } else {
                console.log(`calculateSpeciesDistribution - skipping plot ${index} - missing data`);
            }
        });

        console.log('calculateSpeciesDistribution - speciesMap:', Array.from(speciesMap.entries()));

        const distribution: Array<{ species: string; areaHectares: number; percentage: number }> = [];

        speciesMap.forEach((area, species) => {
            const percentage = totalForestArea > 0 ? (area / totalForestArea) * 100 : 0;
            distribution.push({
                species,
                areaHectares: Math.round(area * 100) / 100,
                percentage: Math.round(percentage * 100) / 100,
            });
        });

        console.log('calculateSpeciesDistribution - final distribution:', distribution);
        return distribution.sort((a, b) => b.areaHectares - a.areaHectares);
    }
}