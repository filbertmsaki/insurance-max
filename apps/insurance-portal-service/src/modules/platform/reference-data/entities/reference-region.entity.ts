import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReferenceCountry } from './reference-country.entity';
import { ReferenceDistrict } from './reference-district.entity';

@Entity('reference_regions')
@Index('IDX_reference_regions_country', ['country_id'])
@Index('UQ_reference_regions_country_code', ['country_id', 'code'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index('UQ_reference_regions_country_name', ['country_id', 'name'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class ReferenceRegion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  country_id!: string;

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

  @ManyToOne(() => ReferenceCountry, (country) => country.regions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'country_id' })
  country!: ReferenceCountry;

  @OneToMany(() => ReferenceDistrict, (district) => district.region)
  districts!: ReferenceDistrict[];
}
