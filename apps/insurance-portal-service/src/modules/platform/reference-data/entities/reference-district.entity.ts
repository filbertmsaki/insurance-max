import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReferenceRegion } from './reference-region.entity';

@Entity('reference_districts')
@Index('IDX_reference_districts_region', ['region_id'])
@Index('UQ_reference_districts_region_code', ['region_id', 'code'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index('UQ_reference_districts_region_name', ['region_id', 'name'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class ReferenceDistrict {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  region_id!: string;

  @Column({ type: 'varchar', length: 80 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;

  @ManyToOne(() => ReferenceRegion, (region) => region.districts, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'region_id' })
  region!: ReferenceRegion;
}
