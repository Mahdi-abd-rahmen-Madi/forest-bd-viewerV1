import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPolygon, AnalysisStatus } from '@forest/database';
import { SavePolygonInput } from './dto/save-polygon.input';
import { GeospatialServiceClient } from '../geospatial/geospatial-service.client';
import * as turf from '@turf/turf';

@Injectable()
export class PolygonService {
  constructor(
    @InjectRepository(UserPolygon)
    private readonly polygonRepository: Repository<UserPolygon>,
    private readonly geospatialService: GeospatialServiceClient,
  ) { }

  async savePolygon(userId: string, input: SavePolygonInput): Promise<UserPolygon> {
    try {
      let geometry: any = input.geometry;
      
      // Handle both string and object inputs
      if (typeof geometry === 'string') {
        try {
          geometry = JSON.parse(geometry);
        } catch (error) { 
          throw new BadRequestException('Invalid geometry JSON format'); 
        }
      }
      
      // Validate geometry structure
      if (!geometry || !geometry.type || !geometry.coordinates) {
        throw new BadRequestException('Invalid geometry structure');
      }

      const areaInSquareMeters = turf.area(geometry);
      const areaHectares = areaInSquareMeters / 10000;

      // Convert Polygon to MultiPolygon to match database schema
      let processedGeometry: any;
      if (geometry.type === 'Polygon') {
        processedGeometry = {
          type: 'MultiPolygon',
          coordinates: [geometry.coordinates]
        };
      } else {
        processedGeometry = geometry;
      }

      const polygon = this.polygonRepository.create({
        userId,
        name: input.name,
        geometry: JSON.stringify(processedGeometry), // Store as JSON string
        areaHectares: input.areaHectares || areaHectares, // Use provided area or calculated
        status: AnalysisStatus.PENDING,
      });

      const savedPolygon = await this.polygonRepository.save(polygon);

      try {
        const analysisResults = await this.geospatialService.analyzeSpatialIntersection({
          geometry: input.geometry,
          analysisType: 'full'
        });
        savedPolygon.analysisResults = analysisResults;
        savedPolygon.status = AnalysisStatus.COMPLETED;
      } catch (error) {
        console.error('Spatial analysis failed:', error);
        savedPolygon.status = AnalysisStatus.FAILED;
        savedPolygon.analysisResults = null;
      }

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
      const analysisResults = await this.geospatialService.analyzeSpatialIntersection({
        geometry: polygon.geometry, // Already stored as JSON string
        analysisType: 'full'
      });
      polygon.analysisResults = analysisResults;
      polygon.status = AnalysisStatus.COMPLETED;
    } catch (error) {
      console.error('Spatial analysis failed:', error);
      polygon.status = AnalysisStatus.FAILED;
      polygon.analysisResults = null;
    }

    return await this.polygonRepository.save(polygon);
  }

  async deleteAllPolygons(userId: string): Promise<boolean> {
    const result = await this.polygonRepository.delete({
      userId,
    });

    return (result.affected || 0) > 0;
  }
}
