import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolygonResolver } from './polygon.resolver';
import { PolygonService } from './polygon.service';
import { UserPolygon } from '@forest/database';
import { GeospatialModule } from '../geospatial/geospatial.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserPolygon]), GeospatialModule],
  providers: [PolygonResolver, PolygonService],
  exports: [PolygonService],
})
export class PolygonModule { }
