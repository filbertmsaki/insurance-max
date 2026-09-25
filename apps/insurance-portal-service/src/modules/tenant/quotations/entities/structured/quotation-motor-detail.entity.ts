import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuotationCoverNoteEntry } from './quotation-cover-note-entry.entity';
import { MotorVehicleVersion } from '../../../motor/entities/motor-vehicle-version.entity';

@Entity('quotation_motor_details')
@Index('UQ_qmd_entry_id', ['entry_id'], {
  unique: true,
})
@Index('IDX_qmd_registration_number', ['registration_number'])
@Index('IDX_qmd_chassis_number', ['chassis_number'])
@Index('IDX_qmd_engine_number', ['engine_number'])
export class QuotationMotorDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  entry_id: string;

  @Column({ type: 'uuid', nullable: true })
  motor_vehicle_version_id: string | null;

  @Column({ type: 'smallint' })
  motor_category: number;

  @Column({ type: 'smallint' })
  motor_type: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  registration_number: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  chassis_number: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  make: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  model: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  model_number: string | null;

  @Column({
    type: 'varchar',
    length: 100,
  })
  body_type: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  color: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  engine_number: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  engine_capacity: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  fuel_used: string;

  @Column({ type: 'smallint' })
  number_of_axles: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
  })
  axle_distance: string;

  @Column({ type: 'smallint' })
  sitting_capacity: number;

  @Column({ type: 'smallint' })
  year_of_manufacture: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  tare_weight: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  gross_weight: string;

  @Column({ type: 'smallint' })
  motor_usage: number;

  @Column({
    type: 'varchar',
    length: 200,
  })
  owner_name: string;

  @Column({ type: 'smallint' })
  owner_category: number;

  @Column({
    type: 'varchar',
    length: 300,
  })
  owner_address: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToOne(() => QuotationCoverNoteEntry, (entry) => entry.motor_detail, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entry_id' })
  entry: QuotationCoverNoteEntry;

  @ManyToOne(() => MotorVehicleVersion, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'motor_vehicle_version_id' })
  motor_vehicle_version: MotorVehicleVersion | null;
}
