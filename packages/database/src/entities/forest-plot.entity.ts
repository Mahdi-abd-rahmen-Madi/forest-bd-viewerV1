import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('forest_plots')
@Index(['codeRegion'])
@Index(['codeDepartement'])
@Index(['codeCommune'])
@Index(['codeRegion', 'codeDepartement']) // Composite index for regional queries
@Index(['codeDepartement', 'codeCommune']) // Composite index for departmental queries
export class ForestPlot {
    @PrimaryColumn()
    id!: string;

    @Column({ name: 'code_region', nullable: true })
    codeRegion!: string;

    @Column({ name: 'code_departement', nullable: true })
    codeDepartement!: string;

    @Column({ name: 'code_commune', nullable: true })
    codeCommune!: string;

    @Column({ name: 'lieu_dit', nullable: true })
    lieuDit?: string;

    @Column('geometry', {
        spatialFeatureType: 'MultiPolygon',
        srid: 4326,
        name: 'geom'  // explicitly match
    })
    @Index() // This will create a GIST index for the geometry column
    geom!: any;

    @Column('varchar', {
        array: true,
        nullable: true,
        name: 'essences'  // explicitly match
    })
    @Index() // GIN index for array queries
    essences?: string[];

    @Column('double precision', {
        nullable: true,
        name: 'surface_hectares'  // explicitly match
    })
    surfaceHectares?: number;

    @Column({
        nullable: true,
        name: 'type_foret'  // explicitly match
    })
    typeForet?: string;
}