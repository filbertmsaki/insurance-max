import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { SecurityPolicyStatus } from '@insurance-max/contracts';

@Entity('security_policy_profiles')
@Index('IDX_security_policy_company_status', ['company_id', 'status'])
@Index(
  'UQ_security_policy_profile_version',
  ['company_id', 'profile_code', 'version_number'],
  {
    unique: true,
  },
)
export class SecurityPolicyProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  company_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  profile_code: string;

  @Column({ type: 'varchar', length: 160 })
  profile_name: string;

  @Column({ type: 'integer', default: 1 })
  version_number: number;

  @Column({
    type: 'varchar',
    length: 30,
    default: SecurityPolicyStatus.DRAFT,
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  policy: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  effective_from: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  effective_to: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;
}
