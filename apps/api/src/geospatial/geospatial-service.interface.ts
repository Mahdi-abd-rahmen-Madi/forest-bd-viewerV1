import { ForestPlot } from '@forest/database';

export interface SpatialAnalysisRequest {
  geometry: string; // GeoJSON string
  analysisType: 'intersection' | 'area' | 'species' | 'full';
}

export interface SpatialAnalysisResult {
  plotCount: number;
  totalForestArea: number;
  coveragePercentage: number;
  forestTypes: string[];
  speciesDistribution: Array<{
    species: string;
    areaHectares: number;
    percentage: number;
  }>;
}

export interface GeospatialQueryRequest {
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  administrativeFilters?: {
    codeRegion?: string;
    codeDepartement?: string;
    codeCommune?: string;
  };
  limit?: number;
  offset?: number;
}

export interface GeospatialQueryResult {
  plots: ForestPlot[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Geospatial Service Interface
 * 
 * This interface defines the contract for geospatial operations,
 * providing a clean boundary that could be extracted into a separate service.
 */
export interface IGeospatialService {
  /**
   * Analyze spatial intersection between geometry and forest plots
   */
  analyzeSpatialIntersection(request: SpatialAnalysisRequest): Promise<SpatialAnalysisResult>;

  /**
   * Query forest plots with spatial and administrative filtering
   */
  queryForestPlots(request: GeospatialQueryRequest): Promise<GeospatialQueryResult>;

  /**
   * Calculate area statistics for a given geometry
   */
  calculateAreaStats(geometry: string): Promise<{
    areaSquareMeters: number;
    areaHectares: number;
  }>;

  /**
   * Find intersecting forest plots for a geometry
   */
  findIntersectingPlots(geometry: string): Promise<ForestPlot[]>;
}
