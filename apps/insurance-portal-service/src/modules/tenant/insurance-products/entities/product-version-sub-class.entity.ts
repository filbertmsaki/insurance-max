import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { InsuranceProductVersion } from './insurance-product-version.entity';
import { InsuranceSubClass } from '../../insurance-sub-classes/entities/insurance-sub-class.entity';

@Entity('product_version_sub_classes')
@Unique('UQ_product_version_sub_class', ['product_version_id', 'sub_class_id'])
export class ProductVersionSubClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  product_version_id: string;

  @Column({ type: 'uuid' })
  sub_class_id: string;

  @Column({ type: 'varchar', length: 50 })
  code_snapshot: string;

  @Column({ type: 'varchar', length: 150 })
  name_snapshot: string;

  @Column({ type: 'text', nullable: true })
  description_snapshot: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tiramis_sub_class_code_snapshot: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cover_type_code_snapshot: string | null;

  @Column({ default: false })
  is_default: boolean;

  @Column({ type: 'integer', default: 100 })
  sort_order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => InsuranceProductVersion, (version) => version.sub_classes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_version_id' })
  product_version: InsuranceProductVersion;

  @ManyToOne(() => InsuranceSubClass, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sub_class_id' })
  sub_class: InsuranceSubClass;
}
