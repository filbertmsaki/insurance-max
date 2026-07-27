import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { Role } from '../../roles/entities/role.entity';
import { CompanyUser } from './company-user.entity';

export interface CompanyAddress {
  street?: string;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
}

export interface CompanySettings {
  timezone?: string;
  currency?: string;
  date_format?: string;
  allow_self_registration?: boolean;
  [key: string]: unknown;
}

@Entity('companies')
@Index('UQ_companies_identifier_prefix', ['identifier_prefix'], {
  unique: true,
})
@Index('UQ_companies_name', ['name'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ unique: true, length: 120 })
  slug: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  identifier_prefix!: string | null;

  @Column({ default: 'active', length: 20 })
  status: string;

  @Column({
    type: 'enum',
    enum: CompanyType,
    name: 'company_type',
    default: CompanyType.INSURANCE_COMPANY,
  })
  company_type!: CompanyType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tira_license_number!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  tira_license_status!: string | null;

  @Column({ type: 'date', nullable: true })
  license_issued_at!: Date | null;

  @Column({ type: 'date', nullable: true })
  license_expires_at!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tin!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brela_registration_number!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  tira_company_code!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  tira_insurer_company_code!: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  tira_client_code!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tira_system_code!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  tira_system_name!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  regulatory_metadata!: Record<string, unknown> | null;

  @Column({
    type: 'varchar',
    name: 'contact_email',
    length: 100,
    nullable: true,
  })
  contact_email: string | null;

  @Column({
    type: 'varchar',
    name: 'contact_phone',
    length: 30,
    nullable: true,
  })
  contact_phone: string | null;

  @Column({ type: 'varchar', name: 'website', length: 255, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', name: 'logo_url', length: 500, nullable: true })
  logo_url: string | null;

  @Column({ type: 'jsonb', nullable: true })
  address: CompanyAddress | null;

  @Column({ type: 'jsonb', nullable: true })
  settings: CompanySettings | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => CompanyUser, (membership) => membership.company)
  memberships: CompanyUser[];

  @OneToMany(() => Role, (role) => role.company)
  roles: Role[];
}
