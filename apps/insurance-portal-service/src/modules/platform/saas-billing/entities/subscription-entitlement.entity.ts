import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { EntitlementValueType } from '../enums/saas-billing.enums';

@Entity('subscription_entitlements')
export class SubscriptionEntitlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  subscription_id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ length: 100 })
  feature_code: string;

  @Column({ type: 'enum', enum: EntitlementValueType })
  value_type: EntitlementValueType;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ length: 30, default: 'PLAN' })
  source: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  effective_from: Date;

  @Column({ type: 'timestamptz', nullable: true })
  effective_to!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
