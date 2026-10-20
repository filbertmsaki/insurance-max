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
import { VehicleMake } from './vehicle-make.entity';

@Entity('vehicle_models')
@Index(
  'UQ_vehicle_models_make_normalized_name',
  ['make_id', 'normalized_name'],
  { unique: true, where: 'deleted_at IS NULL' },
)
export class VehicleModel {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) make_id!: string;
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
  @ManyToOne(() => VehicleMake, (make) => make.models, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'make_id' })
  make!: VehicleMake;
}
