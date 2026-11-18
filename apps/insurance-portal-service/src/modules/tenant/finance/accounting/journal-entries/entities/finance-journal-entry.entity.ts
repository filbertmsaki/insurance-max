import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { FinanceJournalLine } from './finance-journal-line.entity';

@Entity('finance_journal_entries')
@Index('UQ_finance_journal_number_entity', ['company_id', 'journal_no'], {
  unique: true,
})
export class FinanceJournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 80 })
  journal_no: string;

  @Column({ type: 'date' })
  journal_date: string;

  @Column({ type: 'varchar', length: 50 })
  source_type: string;

  @Column({ type: 'uuid' })
  source_id: string;

  @Column({ type: 'varchar', length: 180 })
  source_event_id: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 3 })
  currency_code: string;

  @Column({ type: 'varchar', length: 30, default: 'POSTED' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  reversal_of_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  posted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  posted_at: Date | null;

  @Column({ type: 'varchar', length: 64 })
  entry_hash: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @OneToMany(() => FinanceJournalLine, (line) => line.journal_entry)
  lines: FinanceJournalLine[];
}
