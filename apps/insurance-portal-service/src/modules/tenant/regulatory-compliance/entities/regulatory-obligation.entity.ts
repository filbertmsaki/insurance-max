import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { RegulatoryObligationStatus } from '../enums/regulatory.enums';

@Entity('regulatory_obligations')
export class RegulatoryObligation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  template_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  return_definition_id!: string | null;

  @Column({ length: 80 })
  code: string;

  @Column({ length: 160 })
  name: string;

  @Column({ type: 'date' })
  period_start: string;

  @Column({ type: 'date' })
  period_end: string;

  @Column({ type: 'timestamptz' })
  due_at: Date;

  @Column({
    type: 'enum',
    enum: RegulatoryObligationStatus,
    default: RegulatoryObligationStatus.UPCOMING,
  })
  status: RegulatoryObligationStatus;

  @Column({ type: 'uuid', nullable: true })
  return_id!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
