import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleModel } from './vehicle-model.entity';

@Entity('vehicle_makes')
@Index('UQ_vehicle_makes_normalized_name', ['normalized_name'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class VehicleMake {
  @PrimaryGeneratedColumn('uuid') id!: string;
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
  @OneToMany(() => VehicleModel, (model) => model.make) models!: VehicleModel[];
}
