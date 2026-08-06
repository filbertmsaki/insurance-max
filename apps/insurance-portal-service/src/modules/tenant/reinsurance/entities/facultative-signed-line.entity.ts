import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { FacultativePlacement } from './facultative-placement.entity';

@Entity('facultative_signed_lines')
export class FacultativeSignedLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  placement_id: string;

  @Column({ type: 'uuid' })
  participant_company_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 10 })
  signed_share_percent: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  signed_amount: string;

  @Column({ type: 'timestamptz' })
  signed_at: Date;

  @Column({ type: 'uuid', nullable: true })
  signed_by: string | null;

  @ManyToOne(() => FacultativePlacement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'placement_id' })
  placement: FacultativePlacement;
}
