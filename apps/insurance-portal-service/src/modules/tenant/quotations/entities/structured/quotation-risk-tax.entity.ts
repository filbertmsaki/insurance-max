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
import { QuotationEntryRisk } from './quotation-entry-risk.entity';

@Entity('quotation_risk_taxes')
@Index('IDX_qrt_risk_id', ['risk_id'])
@Index('UQ_qrt_risk_sequence', ['risk_id', 'sequence_no'], {
  unique: true,
})
export class QuotationRiskTax {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  risk_id: string;

  @Column({ type: 'int' })
  sequence_no: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  tax_code: string;

  @Column({
    type: 'varchar',
    length: 1,
    default: 'N',
  })
  is_tax_exempted: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  tax_exemption_type: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tax_exemption_reference: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
  })
  tax_rate: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  tax_amount: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(
    () => QuotationEntryRisk,
    (risk) => risk.taxes,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'risk_id' })
  risk: QuotationEntryRisk;
}
