import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { RegulatoryReturnStatus } from '../enums/regulatory.enums';

@Entity('regulatory_returns')
export class RegulatoryReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  definition_id: string;

  @Column({ type: 'uuid', nullable: true })
  obligation_id!: string | null;

  @Column({ length: 60, unique: true })
  return_no: string;

  @Column({
    type: 'enum',
    enum: RegulatoryReturnStatus,
    default: RegulatoryReturnStatus.DRAFT,
  })
  status: RegulatoryReturnStatus;

  @Column({ type: 'date' })
  period_start: string;

  @Column({ type: 'date' })
  period_end: string;

  @Column({ type: 'timestamptz', nullable: true })
  due_at!: Date | null;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'uuid', nullable: true })
  prepared_by!: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at!: Date | null;

  @Column({ length: 120, nullable: true })
  submission_reference!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
