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
import { PartnerType } from '../enums/partner-type.enum';
import { PartnerRelationshipStatus } from '../enums/partner-relationship-status.enum';
import { InsuranceCompanyPartnerProductScope } from './insurance-company-partner-product-scope.entity';

@Entity('insurance_company_partners')
@Index('IDX_insurance_partner_insurer', ['insurer_company_id'])
@Index('IDX_insurance_partner_company', ['intermediary_company_id'])
export class InsuranceCompanyPartner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  insurer_company_id: string;

  @Column({ type: 'uuid' })
  intermediary_company_id: string;

  @Column({ type: 'uuid', nullable: true })
  requested_by_company_id!: string | null;

  @Column({ type: 'enum', enum: PartnerType })
  partner_type!: PartnerType;

  @Column({
    type: 'enum',
    enum: PartnerRelationshipStatus,
    default: PartnerRelationshipStatus.PENDING,
  })
  status!: PartnerRelationshipStatus;

  @Column({ type: 'varchar', length: 20, default: 'LEGACY' })
  scope_mode!: 'LEGACY' | 'RESTRICTED';

  @Column({ type: 'numeric', precision: 18, scale: 10, nullable: true })
  commission_rate!: string | null;

  @Column({ type: 'date', nullable: true })
  start_date!: Date | null;

  @Column({ type: 'date', nullable: true })
  end_date!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  agreement_reference!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  agreement_document_url!: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  suspension_reason!: string | null;

  @Column({ type: 'text', nullable: true })
  termination_reason!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insurer_company_id' })
  insurer_company: Company;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'intermediary_company_id' })
  intermediary_company: Company;

  @OneToMany(
    () => InsuranceCompanyPartnerProductScope,
    (scope) => scope.relationship,
  )
  product_scopes: InsuranceCompanyPartnerProductScope[];
}
