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
import { ReferenceRegion } from './reference-region.entity';

@Entity('reference_countries')
@Index('UQ_reference_countries_iso3', ['iso3_code'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index('UQ_reference_countries_name', ['name'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class ReferenceCountry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  iso2_code!: string | null;

  @Column({ type: 'varchar', length: 3 })
  iso3_code!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_code!: string | null;

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

  @OneToMany(() => ReferenceRegion, (region) => region.country)
  regions!: ReferenceRegion[];
}
