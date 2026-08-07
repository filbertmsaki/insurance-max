import { RegulatoryObligationStatus } from '@insurance-max/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('regulatory_obligation_instances')
export class RegulatoryObligationInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  definition_id: string;

  @Column({ type: 'varchar', length: 100 })
  obligation_reference: string;

  @Column({ type: 'date' })
  period_start: string;

  @Column({ type: 'date' })
  period_end: string;

  @Column({ type: 'timestamptz' })
  due_at: Date;

  @Column({ type: 'varchar', length: 50, default: 'UPCOMING' })
  status: RegulatoryObligationStatus;

  @Column({ type: 'uuid', nullable: true })
  assigned_user_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_role_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  active_return_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  active_levy_assessment_id!: string | null;

  @Column({ type: 'int', array: true, default: () => 'ARRAY[]::integer[]' })
  warning_sent_days: number[];

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  waived_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  waived_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  waiver_reason!: string | null;

  @Column({ type: 'int', default: 1 })
  state_version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
