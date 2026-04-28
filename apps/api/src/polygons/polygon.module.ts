import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolygonResolver } from './polygon.resolver';
import { PolygonService } from './polygon.service';
import { UserPolygon } from '@forest/database';

@Module({
  imports: [TypeOrmModule.forFeature([UserPolygon])],
  providers: [PolygonResolver, PolygonService],
  exports: [PolygonService],
})
export class PolygonModule {}
