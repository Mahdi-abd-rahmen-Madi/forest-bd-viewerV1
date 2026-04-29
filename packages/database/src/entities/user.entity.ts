import { OneToMany, Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Field, ObjectType, ID } from '@nestjs/graphql';
import { UserPolygon } from './user-polygon.entity';

@ObjectType('User')
@Entity('users')

export class User {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Field()
  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  lastName?: string;

  // Last map view state
  @Field({ nullable: true })
  @Column('double precision', { nullable: true })
  lastLng?: number;

  @Field({ nullable: true })
  @Column('double precision', { nullable: true })
  lastLat?: number;

  @Field({ nullable: true })
  @Column('double precision', { nullable: true })
  lastZoom?: number;

  @Field(() => [String], { nullable: true })
  @Column('jsonb', { nullable: true })
  lastFilters?: Record<string, any>;

  @Field()
  @CreateDateColumn()
  createdAt!: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt!: Date;

  /*  @OneToMany(() => UserPolygon, polygon => polygon.user)
    polygons?: UserPolygon[];*/
}