import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('claim_sla_rules')
export class ClaimSlaRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  company_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  event_type: string;

  @Column({ type: 'int' })
  duration_hours: number;

  @Column({ type: 'int', default: 0 })
  warning_hours_before: number;

  @Column({ type: 'date' })
  effective_from: string;

  @Column({ type: 'date', nullable: true })
  effective_to: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
