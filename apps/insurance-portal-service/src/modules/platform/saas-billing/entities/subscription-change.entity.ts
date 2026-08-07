import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { SubscriptionChangeType } from '../enums/saas-billing.enums';

@Entity('subscription_changes')
export class SubscriptionChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  subscription_id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'enum', enum: SubscriptionChangeType })
  change_type: SubscriptionChangeType;

  @Column({ type: 'uuid', nullable: true })
  old_plan_version_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  new_plan_version_id!: string | null;

  @Column({ type: 'timestamptz' })
  effective_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  change_summary!: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  changed_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
