import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserPolygon, ForestPlot } from '@forest/database';
type AnalysisStatus = 'pending' | 'completed' | 'failed';
import { SavePolygonInput } from './dto/save-polygon.input';
import * as turf from '@turf/turf';

@Injectable()
export class PolygonService {
  constructor(
    @InjectRepository(UserPolygon)
    private readonly polygonRepository: Repository<UserPolygon>,
    private readonly dataSource: DataSource,
  ) {}

  async savePolygon(userId: string, input: SavePolygonInput): Promise<UserPolygon> {
    try {
      // Parse and validate GeoJSON geometry
      const geometry = JSON.parse(input.geometry);
      
      // Calculate area in hectares using turf
      const areaInSquareMeters = turf.area(geometry);
      const areaHectares = areaInSquareMeters / 10000;

      // Create polygon entity
      const polygon = this.polygonRepository.create({
        userId,
        name: input.name,
        geometry,
        areaHectares,
        status: 'pending' as AnalysisStatus,
      });

      // Save polygon first
      const savedPolygon = await this.polygonRepository.save(polygon);

      // Perform spatial analysis asynchronously
      try {
        const analysisResults = await this.analyzePolygonGeometry(geometry);
        savedPolygon.analysisResults = analysisResults;
        savedPolygon.status = 'completed' as AnalysisStatus;
      } catch (error) {
        console.error('Spatial analysis failed:', error);
        savedPolygon.status = 'failed' as AnalysisStatus;
        savedPolygon.analysisResults = null;
      }

      // Update with analysis results
      return await this.polygonRepository.save(savedPolygon);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BadRequestException('Invalid geometry JSON format');
      }
      throw error;
    }
  }

  async getMyPolygons(userId: string): Promise<UserPolygon[]> {
    return await this.polygonRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async deletePolygon(userId: string, polygonId: string): Promise<boolean> {
    const result = await this.polygonRepository.delete({
      id: polygonId,
      userId,
    });

    return (result.affected || 0) > 0;
  }

  async reanalyzePolygon(userId: string, polygonId: string): Promise<UserPolygon> {
    const polygon = await this.polygonRepository.findOne({
      where: { id: polygonId, userId },
    });

    if (!polygon) {
      throw new NotFoundException('Polygon not found');
    }

    try {
      const analysisResults = await this.analyzePolygonGeometry(polygon.geometry);
      polygon.analysisResults = analysisResults;
      polygon.status = 'completed' as AnalysisStatus;
    } catch (error) {
      console.error('Spatial analysis failed:', error);
      polygon.status = 'failed' as AnalysisStatus;
      polygon.analysisResults = null;
    }

    return await this.polygonRepository.save(polygon);
  }

  private async analyzePolygonGeometry(geometry: any): Promise<any> {
    try {
      const areaInSquareMeters = turf.area(geometry);
      const areaHectares = areaInSquareMeters / 10000;

      // Use PostGIS spatial queries to find intersecting forest plots
      const intersectingPlots = await this.findIntersectingForestPlots(geometry);
      
      // Calculate forest coverage metrics
      const totalForestArea = intersectingPlots.reduce((sum, plot) => sum + (plot.surfaceHectares || 0), 0);
      const coveragePercentage = areaHectares > 0 ? (totalForestArea / areaHectares) * 100 : 0;

      // Analyze species distribution
      const speciesDistribution = this.calculateSpeciesDistribution(intersectingPlots, totalForestArea);
      
      // Identify forest types
      const forestTypes = [...new Set(intersectingPlots.map(plot => plot.typeForet).filter(Boolean))];

      return {
        plotCount: intersectingPlots.length,
        totalForestArea,
        coveragePercentage: Math.round(coveragePercentage * 100) / 100,
        forestTypes,
        speciesDistribution,
      };
    } catch (error) {
      console.error('Analysis error:', error);
      throw new Error('Failed to analyze polygon geometry');
    }
  }

  private async findIntersectingForestPlots(geometry: any): Promise<ForestPlot[]> {
    const geometryString = JSON.stringify(geometry);
    
    const query = `
      SELECT * FROM forest_plots 
      WHERE ST_Intersects(
        ST_GeomFromGeoJSON($1),
        geometry
      )
    `;
    
    const result = await this.dataSource.query(query, [geometryString]);
    return result as ForestPlot[];
  }

  private calculateSpeciesDistribution(
    plots: ForestPlot[], 
    totalForestArea: number
  ): Array<{ species: string; areaHectares: number; percentage: number }> {
    const speciesMap = new Map<string, number>();

    // Aggregate area by species from the essences array
    plots.forEach(plot => {
      if (plot.essences && plot.surfaceHectares && plot.essences.length > 0) {
        // Distribute area equally among all species in this plot
        const areaPerSpecies = plot.surfaceHectares / plot.essences.length;
        plot.essences.forEach(species => {
          const current = speciesMap.get(species) || 0;
          speciesMap.set(species, current + areaPerSpecies);
        });
      }
    });

    // Convert to distribution format
    const distribution: Array<{ species: string; areaHectares: number; percentage: number }> = [];
    
    speciesMap.forEach((area, species) => {
      const percentage = totalForestArea > 0 ? (area / totalForestArea) * 100 : 0;
      distribution.push({
        species,
        areaHectares: Math.round(area * 100) / 100,
        percentage: Math.round(percentage * 100) / 100,
      });
    });

    // Sort by area descending
    return distribution.sort((a, b) => b.areaHectares - a.areaHectares);
  }
}
