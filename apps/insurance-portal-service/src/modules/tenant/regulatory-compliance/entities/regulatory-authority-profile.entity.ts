import { RegulatoryAuthorityType } from '@insurance-max/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('regulatory_authority_profiles')
export class RegulatoryAuthorityProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 50 })
  authority_code: string;

  @Column({ type: 'varchar', length: 200 })
  authority_name: string;

  @Column({ type: 'varchar', length: 50 })
  authority_type: RegulatoryAuthorityType;

  @Column({ type: 'varchar', length: 20 })
  jurisdiction_code: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  registration_reference!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  submission_channel!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  submission_endpoint!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_email!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contact_phone!: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
