import { BaseEntity } from '@insurance-max/persistence';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { TiramisCoverNoteEntity } from '../../cover-notes/entities/tiramis-cover-note.entity';
import { TiramisMotorDetailEntity } from './tiramis-motor-detail.entity';
import { TiramisMotorFleetEntity } from './tiramis-motor-fleet.entity';

@Entity({ name: 'tiramis_motor_fleet_items' })
export class TiramisMotorFleetItemEntity extends BaseEntity {
  @Column({ name: 'motor_fleet_id' })
  motorFleetId!: string;

  @ManyToOne(() => TiramisMotorFleetEntity, (fleet) => fleet.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'motor_fleet_id' })
  motorFleet!: TiramisMotorFleetEntity;

  @Column({ name: 'cover_note_id' })
  coverNoteId!: string;

  @ManyToOne(() => TiramisCoverNoteEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cover_note_id' })
  coverNote!: TiramisCoverNoteEntity;

  @Column({ name: 'fleet_entry', type: 'varchar', length: 50, nullable: true })
  fleetEntry?: string | null;

  @Column({ name: 'cover_note_number', length: 50 })
  coverNoteNumber!: string;

  @Column({
    name: 'prev_cover_note_reference_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  prevCoverNoteReferenceNumber?: string | null;

  @Column({ name: 'cover_note_desc', type: 'varchar', length: 1000, nullable: true })
  coverNoteDesc?: string | null;

  @Column({ name: 'operative_clause', type: 'varchar', length: 1000, nullable: true })
  operativeClause?: string | null;

  @Column({ name: 'endorsement_type', type: 'int', nullable: true })
  endorsementType?: number | null;

  @Column({ name: 'endorsement_reason', type: 'varchar', length: 1000, nullable: true })
  endorsementReason?: string | null;

  @Column({
    name: 'endorsement_premium_earned',
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  endorsementPremiumEarned?: string | null;

  @OneToMany(() => TiramisMotorDetailEntity, (detail) => detail.motorFleetItem, {
    cascade: true,
  })
  motorDetails?: TiramisMotorDetailEntity[];
}
