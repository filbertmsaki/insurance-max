import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vehicle_reference_attributes')
@Index(
  'UQ_vehicle_reference_attributes_kind_normalized_name',
  ['kind', 'normalized_name'],
  { unique: true, where: 'deleted_at IS NULL' },
)
@Index('IDX_vehicle_reference_attributes_kind_active', ['kind', 'is_active'])
export class VehicleReferenceAttribute {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 20 }) kind!:
    | 'body_type'
    | 'colour'
    | 'fuel_type';
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 120 }) normalized_name!: string;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;
  @Column({ type: 'varchar', length: 60, nullable: true }) source!:
    | string
    | null;
  @Column({ type: 'jsonb', nullable: true }) metadata!: Record<
    string,
    unknown
  > | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
