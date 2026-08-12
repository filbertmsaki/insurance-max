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

  @Column({ type: 'uuid', nullable: true })
  definition_id!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  obligation_reference!: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_user_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_role_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  active_return_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  active_levy_assessment_id!: string | null;

  @Column({ type: 'int', array: true, default: [] })
  warning_sent_days!: number[];

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  waived_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  waived_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  waiver_reason!: string | null;

  @Column({ type: 'int', default: 1 })
  state_version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
