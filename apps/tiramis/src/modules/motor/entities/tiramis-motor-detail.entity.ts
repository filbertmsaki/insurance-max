import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisCoverNoteEntity } from '../../cover-notes/entities/tiramis-cover-note.entity';
import { TiramisMotorFleetItemEntity } from './tiramis-motor-fleet-item.entity';

@Entity({ name: 'tiramis_motor_details' })
@Index(['registrationNumber'])
@Index(['chassisNumber'])
export class TiramisMotorDetailEntity extends BaseEntity {
  @Column({ name: 'cover_note_id' })
  coverNoteId!: string;

  @ManyToOne(() => TiramisCoverNoteEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cover_note_id' })
  coverNote!: TiramisCoverNoteEntity;

  @Column({ name: 'motor_fleet_item_id', type: 'uuid', nullable: true })
  motorFleetItemId?: string | null;

  @ManyToOne(() => TiramisMotorFleetItemEntity, (item) => item.motorDetails, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'motor_fleet_item_id' })
  motorFleetItem?: TiramisMotorFleetItemEntity | null;

  @Column({ name: 'motor_category', type: 'int', nullable: true })
  motorCategory?: number | null;

  @Column({ name: 'motor_type', type: 'int', nullable: true })
  motorType?: number | null;

  @Column({
    name: 'registration_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  registrationNumber?: string | null;

  @Column({ name: 'chassis_number', length: 100 })
  chassisNumber!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  make?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string | null;

  @Column({
    name: 'model_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  modelNumber?: string | null;

  @Column({ name: 'body_type', type: 'varchar', length: 100, nullable: true })
  bodyType?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color?: string | null;

  @Column({
    name: 'engine_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  engineNumber?: string | null;

  @Column({
    name: 'engine_capacity',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  engineCapacity?: string | null;

  @Column({ name: 'fuel_used', type: 'varchar', length: 50, nullable: true })
  fuelUsed?: string | null;

  @Column({ name: 'number_of_axles', type: 'int', nullable: true })
  numberOfAxles?: number | null;

  @Column({
    name: 'axle_distance',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  axleDistance?: string | null;

  @Column({ name: 'sitting_capacity', type: 'int', nullable: true })
  sittingCapacity?: number | null;

  @Column({ name: 'year_of_manufacture', type: 'int', nullable: true })
  yearOfManufacture?: number | null;

  @Column({
    name: 'tare_weight',
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  tareWeight?: string | null;

  @Column({
    name: 'gross_weight',
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  grossWeight?: string | null;

  @Column({ name: 'motor_usage', type: 'int', nullable: true })
  motorUsage?: number | null;

  @Column({ name: 'owner_name', type: 'varchar', length: 150, nullable: true })
  ownerName?: string | null;

  @Column({ name: 'owner_category', type: 'int', nullable: true })
  ownerCategory?: number | null;

  @Column({
    name: 'owner_address',
    type: 'varchar',
    length: 250,
    nullable: true,
  })
  ownerAddress?: string | null;
}
