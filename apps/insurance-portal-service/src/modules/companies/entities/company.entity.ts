import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
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
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ unique: true, length: 120 })
  slug: string;

  @Column({ default: 'active', length: 20 })
  status: string;

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

  @Column({ type: 'simple-json', nullable: true })
  address: CompanyAddress | null;

  @Column({ type: 'simple-json', nullable: true })
  settings: CompanySettings | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => CompanyUser, (membership) => membership.company)
  memberships: CompanyUser[];

  @OneToMany(() => Role, (role) => role.company)
  roles: Role[];
}
