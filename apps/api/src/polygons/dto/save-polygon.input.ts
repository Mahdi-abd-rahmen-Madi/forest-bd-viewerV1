import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

@InputType()
export class SavePolygonInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field()
  @IsNotEmpty()
  geometry!: string; // GeoJSON string

  @Field(() => Number)
  @IsNumber()
  areaHectares!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
