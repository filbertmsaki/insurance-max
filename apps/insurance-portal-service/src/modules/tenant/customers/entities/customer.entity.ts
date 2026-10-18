import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { CustomerAddress } from './customer-address.entity';
import { CustomerContact } from './customer-contact.entity';
import { CustomerDocument } from './customer-document.entity';
import { CustomerIdentifier } from './customer-identifier.entity';
import { CustomerAuditLog } from './customer-audit-log.entity';
import { CustomerVersion } from './customer-version.entity';
import { InsuredAsset } from './insured-asset.entity';
import { CustomerDocumentType } from '../enums/customer-document-type.enum';
import { CustomerGender } from '../enums/customer-gender.enum';
import { CustomerPolicyHolderType } from '../enums/customer-policy-holder-type.enum';
import { CustomerStatus } from '../enums/customer-status.enum';
import { CustomerType } from '../enums/customer-type.enum';

@Entity('customers')
@Index('IDX_customers_company_id', ['company_id'])
@Index('IDX_customers_company_customer_no', ['company_id', 'customer_no'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index('IDX_customers_company_status', ['company_id', 'status'])
@Index('IDX_customers_company_customer_type', ['company_id', 'customer_type'])
@Index('UQ_customers_user_id', ['user_id'], {
  unique: true,
  where: 'user_id IS NOT NULL AND deleted_at IS NULL',
})
// Trigram expression index for the wizard search (migration 1794600000000).
@Index('IDX_customers_search_trgm', { synchronize: false })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ length: 30 })
  customer_no: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  display_name: string | null;

  @Column({ type: 'enum', enum: CustomerType, enumName: 'customer_type_enum' })
  customer_type: CustomerType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  first_name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  middle_name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  last_name: string | null;

  @Column({
    type: 'enum',
    enum: CustomerGender,
    enumName: 'customer_gender_enum',
    nullable: true,
  })
  gender: CustomerGender | null;

  @Column({ type: 'date', nullable: true })
  date_of_birth: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nationality: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  company_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  registration_no: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  incorporation_certificate_no: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tin: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  vrn: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  identity_fingerprint: string | null;

  @Column({
    type: 'smallint',
    nullable: true,
  })
  policy_holder_type: CustomerPolicyHolderType | null;

  @Column({ type: 'smallint', nullable: true })
  id_type: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  id_number: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nida_no: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  voter_no: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  passport_no: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  driving_license_no: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  zanid_no: string | null;

  @Column({ type: 'varchar', length: 30 })
  phone: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  alternate_phone: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  fax: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 3 })
  country_code: string;

  @Column({ type: 'varchar', length: 50 })
  region: string;

  @Column({ type: 'varchar', length: 50 })
  district: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ward: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  street: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  postal_address: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
  latitude: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
  longitude: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contact_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contact_role: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  contact_phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contact_email: string | null;

  @Column({
    type: 'enum',
    enum: CustomerDocumentType,
    enumName: 'customer_document_type_enum',
    nullable: true,
  })
  document_type: CustomerDocumentType | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  document_no: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  document_file_name: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  document_file_url: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  document_mime_type: string | null;

  @Column({ default: false })
  document_verified: boolean;

  @Column({ type: 'uuid', nullable: true })
  document_verified_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  document_verified_at: Date | null;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    enumName: 'customer_status_enum',
    default: CustomerStatus.ACTIVE,
  })
  status: CustomerStatus;

  @Column({ type: 'uuid', nullable: true })
  merged_into_customer_id: string | null;

  @Column({ type: 'varchar', length: 30, default: 'MANUAL' })
  data_source: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'document_verified_by' })
  document_verified_by_user: User | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'merged_into_customer_id' })
  merged_into_customer: Customer | null;

  @OneToMany(() => CustomerIdentifier, (identifier) => identifier.customer)
  identifiers: CustomerIdentifier[];

  @OneToMany(() => CustomerAddress, (address) => address.customer)
  addresses: CustomerAddress[];

  @OneToMany(() => CustomerContact, (contact) => contact.customer)
  contacts: CustomerContact[];

  @OneToMany(() => CustomerDocument, (document) => document.customer)
  documents: CustomerDocument[];

  @OneToMany(() => CustomerVersion, (version) => version.customer)
  versions: CustomerVersion[];

  @OneToMany(() => CustomerAuditLog, (auditLog) => auditLog.customer)
  audit_logs: CustomerAuditLog[];

  @OneToMany(() => InsuredAsset, (asset) => asset.customer)
  insured_assets: InsuredAsset[];

  @OneToMany(() => InsuredAsset, (asset) => asset.owner_customer)
  owned_insured_assets: InsuredAsset[];
}
