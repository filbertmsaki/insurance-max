import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../../../customers/entities/customer.entity';
import { CustomerVersion } from '../../../customers/entities/customer-version.entity';
import { Quotation } from '../quotation.entity';

@Entity('quotation_policy_holders')
@Index('UQ_qph_quotation_sequence', ['quotation_id', 'sequence_no'], {
  unique: true,
})
@Index('IDX_qph_customer_id', ['customer_id'])
@Index('IDX_qph_identity', ['policy_holder_id_type', 'policy_holder_id_number'])
export class QuotationPolicyHolder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_id: string;

  /**
   * Optional link to an existing internal customer.
   *
   * The submitted policyholder snapshot remains stored even when
   * it is linked to a customer record.
   */
  @Column({
    type: 'uuid',
    nullable: true,
  })
  customer_id: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  customer_version_id: string | null;

  @Column({ type: 'int' })
  sequence_no: number;

  @Column({
    type: 'varchar',
    length: 200,
  })
  policy_holder_name: string;

  @Column({ type: 'date' })
  policy_holder_birth_date: string;

  @Column({ type: 'smallint' })
  policy_holder_type: number;

  @Column({
    type: 'varchar',
    length: 100,
  })
  policy_holder_id_number: string;

  @Column({ type: 'smallint' })
  policy_holder_id_type: number;

  @Column({
    type: 'varchar',
    length: 1,
    nullable: true,
  })
  gender: string | null;

  @Column({
    type: 'varchar',
    length: 3,
  })
  country_code: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  region: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  district: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  street: string | null;

  @Column({
    type: 'varchar',
    length: 30,
  })
  policy_holder_phone_number: string;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  policy_holder_fax: string | null;

  @Column({
    type: 'varchar',
    length: 250,
    nullable: true,
  })
  postal_address: string | null;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  email_address: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Quotation, (quotation) => quotation.policy_holders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @ManyToOne(() => Customer, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => CustomerVersion, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'customer_version_id' })
  customer_version: CustomerVersion | null;
}
