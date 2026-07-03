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
import { Company } from '../../../platform/companies/entities/company.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { MotorFleetItem } from './motor-fleet-item.entity';

@Entity('motor_fleets')
@Index('IDX_motor_fleets_company_id', ['company_id'])
@Index('IDX_motor_fleets_company_customer_id', ['company_id', 'customer_id'])
@Index('IDX_motor_fleets_company_fleet_no', ['company_id', 'fleet_no'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class MotorFleet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid', nullable: true })
  quotation_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  policy_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  fleet_no: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  fleet_name: string | null;

  @Column({ type: 'int', default: 0 })
  total_vehicles: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_sum_insured: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_premium: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Quotation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation | null;

  @OneToMany(() => MotorFleetItem, (item) => item.fleet)
  items: MotorFleetItem[];
}
