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
            .orderBy('code')
            .getRawMany();
        return result.map((r: any) => r.code);
    }

    async getDepartements(regionCode: string): Promise<string[]> {
        const result = await this.forestRepo
            .createQueryBuilder('plot')
            .select('DISTINCT plot.codeDepartement', 'code')
            .where('plot.codeRegion = :regionCode', { regionCode })
            .orderBy('code')
            .getRawMany();
        return result.map((r: any) => r.code);
    }

    async getCommunes(departementCode: string): Promise<string[]> {
        const result = await this.forestRepo
            .createQueryBuilder('plot')
            .select('DISTINCT plot.codeCommune', 'code')
            .where('plot.codeDepartement = :departementCode', { departementCode })
            .orderBy('code')
            .getRawMany();
        return result.map((r: any) => r.code);
    }

    async getLieuxDits(communeCode: string): Promise<string[]> {
        const result = await this.forestRepo
            .createQueryBuilder('plot')
            .select('DISTINCT plot.lieuDit', 'lieu')
            .where('plot.codeCommune = :communeCode', { communeCode })
            .andWhere('plot.lieuDit IS NOT NULL')
            .orderBy('lieu')
            .getRawMany();
        return result.map((r: any) => r.lieu).filter(Boolean);
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

        // Then apply administrative filters
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

        // Add query timeout to prevent long-running queries
        query.limit(10000);
        return query.getRawMany();
    }

    /**
     * Analyze spatial intersection between geometry and forest plots
     */
    async analyzeSpatialIntersection(request: SpatialAnalysisRequest): Promise<SpatialAnalysisResult> {
        const geometry = JSON.parse(request.geometry);
        const areaInSquareMeters = turf.area(geometry);
        const areaHectares = areaInSquareMeters / 10000;

        const intersectingPlots = await this.findIntersectingPlots(request.geometry);

        const totalForestArea = intersectingPlots.reduce((sum, plot) => sum + (plot.surfaceHectares || 0), 0);
        const coveragePercentage = areaHectares > 0 ? (totalForestArea / areaHectares) * 100 : 0;

        const speciesDistribution = this.calculateSpeciesDistribution(intersectingPlots, totalForestArea);

        const forestTypes = [...new Set(intersectingPlots.map(plot => plot.typeForet).filter((type): type is string => Boolean(type)))];

        return {
            plotCount: intersectingPlots.length,
            totalForestArea,
            coveragePercentage: Math.round(coveragePercentage * 100) / 100,
            forestTypes,
            speciesDistribution,
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
        const geometryString = geometry;

        // Optimized query with LIMIT for performance and security
        const query = `
            SELECT id, code_region, code_departement, code_commune, lieu_dit, 
                   essences, surface_hectares, type_foret, ST_AsGeoJSON(geom)::json as geometry
            FROM forest_plots 
            WHERE ST_Intersects(
                ST_GeomFromGeoJSON($1),
                geom
            )
            LIMIT 10000
        `;

        const result = await this.dataSource.query(query, [geometryString]);
        return result as ForestPlot[];
    }

    /**
     * Calculate species distribution from intersecting plots
     */
    private calculateSpeciesDistribution(
        plots: ForestPlot[],
        totalForestArea: number
    ): Array<{ species: string; areaHectares: number; percentage: number }> {
        const speciesMap = new Map<string, number>();

        plots.forEach(plot => {
            if (plot.essences && plot.surfaceHectares && plot.essences.length > 0) {
                const areaPerSpecies = plot.surfaceHectares / plot.essences.length;
                plot.essences.forEach(species => {
                    const current = speciesMap.get(species) || 0;
                    speciesMap.set(species, current + areaPerSpecies);
                });
            }
        });

        const distribution: Array<{ species: string; areaHectares: number; percentage: number }> = [];

        speciesMap.forEach((area, species) => {
            const percentage = totalForestArea > 0 ? (area / totalForestArea) * 100 : 0;
            distribution.push({
                species,
                areaHectares: Math.round(area * 100) / 100,
                percentage: Math.round(percentage * 100) / 100,
            });
        });

        return distribution.sort((a, b) => b.areaHectares - a.areaHectares);
    }
}