import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { Quotation } from './quotation.entity';

@Entity('quotation_status_history')
@Index('IDX_qsh_quotation_id', ['quotation_id'])
export class QuotationStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_id: string;

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    enumName: 'quotation_status_enum',
  })
  old_status: QuotationStatus;

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    enumName: 'quotation_status_enum',
  })
  new_status: QuotationStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  changed_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Quotation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changed_by' })
  changer: User | null;
}
