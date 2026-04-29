import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForestPlot } from '@forest/database';
import { GeospatialService } from './geospatial.service';
import { GeospatialServiceClient } from './geospatial-service.client';
import { GeospatialResolver } from './geospatial.resolver';

@Module({
    imports: [TypeOrmModule.forFeature([ForestPlot])],
    providers: [GeospatialService, GeospatialServiceClient, GeospatialResolver],
    exports: [GeospatialServiceClient],
})
export class GeospatialModule { }