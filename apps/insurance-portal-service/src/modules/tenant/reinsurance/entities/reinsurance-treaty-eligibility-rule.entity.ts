import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ReinsuranceTreaty } from './reinsurance-treaty.entity';

export const TreatyEligibilityRuleType = {
  CLASS_OF_BUSINESS: 'CLASS_OF_BUSINESS',
  TERRITORY: 'TERRITORY',
  SUM_INSURED_MAX: 'SUM_INSURED_MAX',
} as const;

export type TreatyEligibilityRuleType =
  (typeof TreatyEligibilityRuleType)[keyof typeof TreatyEligibilityRuleType];

@Entity('reinsurance_treaty_eligibility_rules')
export class ReinsuranceTreatyEligibilityRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  treaty_id: string;

  @Column({ type: 'varchar', length: 40 })
  rule_type: TreatyEligibilityRuleType;

  @Column({ type: 'varchar', length: 180 })
  rule_value: string;

  @Column({ type: 'boolean', default: true })
  is_exclusion: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => ReinsuranceTreaty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treaty_id' })
  treaty: ReinsuranceTreaty;
}
