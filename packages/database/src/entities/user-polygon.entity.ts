import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Field, ObjectType, ID, registerEnumType } from '@nestjs/graphql';
import { User } from './user.entity';

export enum AnalysisStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

// Register enum for GraphQL
registerEnumType(AnalysisStatus, {
    name: 'AnalysisStatus',
    description: 'The analysis status of a polygon',
});

@ObjectType('UserPolygon')
@Entity('user_polygons')
@Index(['userId']) // Index for user-specific polygon queries
@Index(['status']) // Index for status-based queries
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

    @Field(() => String)
    @Column('geometry', {
        spatialFeatureType: 'MultiPolygon',
        srid: 4326,
        name: 'geometry'
    })
    @Index() // GIST index for spatial queries
    geometry!: any;

    // Custom getter to serialize PostGIS geometry to JSON for GraphQL
    @Field(() => String)
    get geometryJson(): string {
        if (!this.geometry) return '';
        // If it's already a string, return it
        if (typeof this.geometry === 'string') return this.geometry;
        // If it's a PostGIS geometry object, convert to JSON
        if (typeof this.geometry === 'object' && this.geometry.type && this.geometry.coordinates) {
            return JSON.stringify(this.geometry);
        }
        return '';
    }

    @Field(() => Number)
    @Column('double precision')
    areaHectares!: number;

    @Field(() => AnalysisResults, { nullable: true })
    @Column('jsonb', { nullable: true })
    analysisResults?: AnalysisResults | null;

    @Field(() => AnalysisStatus)
    @Column({
        type: 'enum',
        enum: AnalysisStatus,
        default: AnalysisStatus.PENDING
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

    @Field(() => Number, { nullable: true })
    coveragePercentage?: number;

    @Field(() => [SpeciesDistribution], { nullable: true })
    speciesDistribution?: SpeciesDistribution[];

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