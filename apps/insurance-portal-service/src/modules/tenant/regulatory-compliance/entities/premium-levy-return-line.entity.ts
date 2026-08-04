import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PremiumLevyLineType } from '../enums/regulatory.enums';

@Entity('premium_levy_return_lines')
export class PremiumLevyReturnLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  levy_return_id: string;

  @Column({ type: 'enum', enum: PremiumLevyLineType })
  line_type: PremiumLevyLineType;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  amount: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  evidence_reference!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
