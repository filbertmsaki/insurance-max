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
import { InsuranceProductVersion } from './insurance-product-version.entity';

@Entity('product_addon_definitions')
@Unique('UQ_product_addon_definition_code', ['product_version_id', 'code'])
export class ProductAddonDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  product_version_id: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tiramis_addon_code: string | null;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  is_optional: boolean;

  @Column({ default: false })
  is_default_selected: boolean;

  @Column({ default: false })
  allows_separate_sum_insured: boolean;

  @Column({ type: 'integer', nullable: true })
  maximum_quantity: number | null;

  @Column({ type: 'integer', default: 100 })
  sort_order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => InsuranceProductVersion, (version) => version.addons, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_version_id' })
  product_version: InsuranceProductVersion;
}
