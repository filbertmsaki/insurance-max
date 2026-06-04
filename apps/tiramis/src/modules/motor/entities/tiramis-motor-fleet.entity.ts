import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { TiramisCoverNoteEntity } from '../../cover-notes/entities/tiramis-cover-note.entity';
import { TiramisMotorFleetItemEntity } from './tiramis-motor-fleet-item.entity';

@Entity({ name: 'tiramis_motor_fleets' })
export class TiramisMotorFleetEntity extends BaseEntity {
  @Column({ name: 'cover_note_id' })
  coverNoteId!: string;

  @ManyToOne(() => TiramisCoverNoteEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cover_note_id' })
  coverNote!: TiramisCoverNoteEntity;

  @Column({ name: 'fleet_id', length: 50 })
  fleetId!: string;

  @Column({ name: 'fleet_type', type: 'int', nullable: true })
  fleetType?: number | null;

  @Column({ name: 'fleet_size', type: 'int' })
  fleetSize!: number;

  @Column({
    name: 'comprehensive_insured',
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  comprehensiveInsured?: string | null;

  @OneToMany(() => TiramisMotorFleetItemEntity, (item) => item.motorFleet, {
    cascade: true,
  })
  items?: TiramisMotorFleetItemEntity[];
}
