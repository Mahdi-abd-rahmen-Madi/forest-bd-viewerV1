import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Field, ObjectType, ID } from '@nestjs/graphql';
import { User } from './user.entity';

// Import GraphQL JSON scalar
const { GraphQLJSON } = require('graphql-type-json');

export type AnalysisStatus = 'pending' | 'completed' | 'failed';

// Register enum for GraphQL - call this after imports
const { registerEnumType } = require('@nestjs/graphql');
registerEnumType('AnalysisStatus', {
  name: 'AnalysisStatus',
  description: 'The analysis status of a polygon',
});

@ObjectType('UserPolygon')
@Entity('user_polygons')
export class UserPolygon {
    @Field(() => ID)
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Field()
    @Column()
    userId!: string;

    @Field(() => User, { nullable: true })
    @ManyToOne(() => User, user => user.id)
    @JoinColumn({ name: 'user_id' })
    user?: User;

    @Field()
    @Column()
    name!: string;

    @Field(() => String) // Represent geometry as string
    @Column('geometry', { spatialFeatureType: 'MultiPolygon', srid: 4326 })
    geometry!: any;

    @Field(() => Number)
    @Column('double precision')
    areaHectares!: number;

    @Field(() => AnalysisResults, { nullable: true })
    @Column('jsonb', { nullable: true })
    analysisResults?: {
        plotCount?: number;
        speciesDistribution?: Array<{
            species: string;
            areaHectares: number;
            percentage: number;
        }>;
        forestTypes?: string[];
        totalForestArea?: number;
    } | null;

    @Field(() => String)
    @Column({
        type: 'enum',
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    })
    status!: AnalysisStatus;

    @Field(() => Date)
    @CreateDateColumn()
    createdAt!: Date;
}

@ObjectType('AnalysisResults')
export class AnalysisResults {
    @Field(() => Number, { nullable: true })
    plotCount?: number;

    @Field(() => [SpeciesDistribution], { nullable: true })
    speciesDistribution?: Array<{
        species: string;
        areaHectares: number;
        percentage: number;
    }>;

    @Field(() => [String], { nullable: true })
    forestTypes?: string[];

    @Field(() => Number, { nullable: true })
    totalForestArea?: number;
}

@ObjectType('SpeciesDistribution')
export class SpeciesDistribution {
    @Field()
    species!: string;

    @Field()
    areaHectares!: number;

    @Field()
    percentage!: number;
}