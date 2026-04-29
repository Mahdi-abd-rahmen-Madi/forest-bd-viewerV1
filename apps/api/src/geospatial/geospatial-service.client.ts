import { Injectable } from '@nestjs/common';
import { 
  IGeospatialService, 
  SpatialAnalysisRequest, 
  SpatialAnalysisResult, 
  GeospatialQueryRequest, 
  GeospatialQueryResult 
} from './geospatial-service.interface';
import { ForestPlot } from '@forest/database';
import { GeospatialService } from './geospatial.service';

/**
 * Geospatial Service Client
 * 
 * This client provides a clean abstraction layer over geospatial operations.
 * It acts as a service boundary that could be easily swapped with an external service
 * or moved to a separate microservice with minimal changes to consumers.
 */
@Injectable()
export class GeospatialServiceClient implements IGeospatialService {
  constructor(private readonly geospatialService: GeospatialService) {}

  /**
   * Analyze spatial intersection between geometry and forest plots
   */
  async analyzeSpatialIntersection(request: SpatialAnalysisRequest): Promise<SpatialAnalysisResult> {
    return this.geospatialService.analyzeSpatialIntersection(request);
  }

  /**
   * Query forest plots with spatial and administrative filtering
   */
  async queryForestPlots(request: GeospatialQueryRequest): Promise<GeospatialQueryResult> {
    return this.geospatialService.queryForestPlots(request);
  }

  /**
   * Calculate area statistics for a given geometry
   */
  async calculateAreaStats(geometry: string): Promise<{
    areaSquareMeters: number;
    areaHectares: number;
  }> {
    return this.geospatialService.calculateAreaStats(geometry);
  }

  /**
   * Find intersecting forest plots for a geometry
   */
  async findIntersectingPlots(geometry: string): Promise<ForestPlot[]> {
    return this.geospatialService.findIntersectingPlots(geometry);
  }
}
