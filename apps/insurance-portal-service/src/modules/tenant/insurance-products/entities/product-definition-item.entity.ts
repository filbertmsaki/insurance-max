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
import { ProductDefinitionItemType } from '@insurance-max/contracts';
import { InsuranceProductVersion } from './insurance-product-version.entity';

@Entity('product_definition_items')
@Unique('UQ_product_definition_item_code', ['product_version_id', 'code'])
export class ProductDefinitionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  product_version_id: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 30 })
  item_type: ProductDefinitionItemType;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: true })
  is_mandatory: boolean;

  @Column({ type: 'integer', default: 100 })
  sort_order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(
    () => InsuranceProductVersion,
    (version) => version.definition_items,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'product_version_id' })
  product_version: InsuranceProductVersion;
}
