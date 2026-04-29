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
      const geometry = JSON.parse(input.geometry);
      const areaInSquareMeters = turf.area(geometry);
      const areaHectares = areaInSquareMeters / 10000;

      const polygon = this.polygonRepository.create({
        userId,
        name: input.name,
        geometry: input.geometry, // Store as JSON string
        areaHectares,
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
        geometry: polygon.geometry,
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
}
