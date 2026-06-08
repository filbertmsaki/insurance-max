import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { FactorDataType } from '@insurance-max/portal-shared/enums/factor-data-type.enum';
import { Company } from '../../companies/entities/company.entity';

@Entity('rating_factors')
@Unique('UQ_rating_factors_company_code', ['company_id', 'code'])
@Unique('UQ_rating_factors_company_name', ['company_id', 'name'])
@Index('IDX_rating_factors_company_id', ['company_id'])
@Index('IDX_rating_factors_is_active', ['is_active'])
export class RatingFactor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ length: 100 })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({
    type: 'varchar',
    enum: FactorDataType,
    default: FactorDataType.NUMBER,
  })
  data_type: FactorDataType;

  @Column({
    type: 'simple-json',
    nullable: true,
    comment: 'Available options for SELECT/MULTI_SELECT types',
  })
  options: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  default_value: string | null;

  @Column({ default: false })
  is_required: boolean;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'varchar', nullable: true })
  created_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}
