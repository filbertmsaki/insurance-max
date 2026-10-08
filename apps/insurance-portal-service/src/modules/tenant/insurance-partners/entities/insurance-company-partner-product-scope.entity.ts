import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { InsuranceCompanyPartner } from './insurance-company-partner.entity';
import { PartnerOperation } from '../enums/partner-operation.enum';

@Entity('insurance_company_partner_product_scopes')
@Unique('UQ_insurance_partner_product_scope', ['relationship_id', 'product_id'])
@Index('IDX_insurance_partner_product_scopes_product', ['product_id'])
@Check(
  'CHK_insurance_partner_product_scopes_operations',
  `"allowed_operations" <@ ARRAY['QUOTE','SUBMIT','VIEW_QUOTATION','VIEW_POLICY','REQUEST_ENDORSEMENT','REQUEST_RENEWAL','REQUEST_CANCELLATION','NOTIFY_CLAIM','VIEW_CLAIM','VIEW_PAYMENT','VIEW_COMMISSION']::varchar[]`,
)
export class InsuranceCompanyPartnerProductScope {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  relationship_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'varchar', array: true, default: () => "'{}'" })
  allowed_operations: PartnerOperation[];

  @Column({ type: 'uuid', array: true, nullable: true })
  branch_ids: string[] | null;

  @Column({ type: 'numeric', precision: 18, scale: 10, nullable: true })
  commission_rate: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => InsuranceCompanyPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'relationship_id' })
  relationship: InsuranceCompanyPartner;

  @ManyToOne(() => InsuranceProduct, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct;
}
