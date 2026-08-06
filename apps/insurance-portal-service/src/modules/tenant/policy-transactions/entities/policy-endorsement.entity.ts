import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EndorsementType } from './endorsement-type.entity';
import { PolicyTransaction } from './policy-transaction.entity';

@Entity('policy_endorsements')
export class PolicyEndorsement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  policy_transaction_id: string;

  @Column({ type: 'uuid', nullable: true })
  endorsement_type_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  endorsement_type_code: string;

  @Column({ type: 'varchar', length: 150 })
  endorsement_type_name: string;

  @Column({ type: 'int', nullable: true })
  tira_endorsement_type: number | null;

  @Column({ type: 'varchar', length: 100 })
  previous_cover_note_reference: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  replacement_cover_note_reference: string | null;

  @Column({ type: 'boolean', default: true })
  requires_new_cover_note: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @OneToOne(() => PolicyTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_transaction_id' })
  policy_transaction: PolicyTransaction;

  @ManyToOne(() => EndorsementType, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'endorsement_type_id' })
  endorsement_type: EndorsementType | null;
}
