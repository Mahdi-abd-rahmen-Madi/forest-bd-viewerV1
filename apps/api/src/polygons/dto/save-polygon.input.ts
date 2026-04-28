import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

@InputType()
export class SavePolygonInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  geometry!: string; // GeoJSON MultiPolygon string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
