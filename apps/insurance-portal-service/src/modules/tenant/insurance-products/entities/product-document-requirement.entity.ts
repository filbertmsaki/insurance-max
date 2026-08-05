import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  ProductDocumentRequirementType,
  ProductRequirementAppliesTo,
} from '@insurance-max/contracts';
import { InsuranceProductVersion } from './insurance-product-version.entity';

@Entity('product_document_requirements')
@Unique('UQ_product_document_requirement_code', ['product_version_id', 'code'])
export class ProductDocumentRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  product_version_id: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 40 })
  requirement_type: ProductDocumentRequirementType;

  @Column({ type: 'varchar', length: 40 })
  applies_to: ProductRequirementAppliesTo;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  is_mandatory: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  accepted_mime_types: string[];

  @Column({ type: 'integer', nullable: true })
  maximum_file_size_mb: number | null;

  @Column({ type: 'integer', default: 100 })
  sort_order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(
    () => InsuranceProductVersion,
    (version) => version.document_requirements,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'product_version_id' })
  product_version: InsuranceProductVersion;
}
