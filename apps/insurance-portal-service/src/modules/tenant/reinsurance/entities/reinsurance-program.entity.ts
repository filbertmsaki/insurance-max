import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReinsuranceDirection } from '@insurance-max/contracts';

@Entity('reinsurance_programs')
export class ReinsuranceProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 180 })
  program_name: string;

  @Column({ type: 'int' })
  program_year: number;

  @Column({ type: 'varchar', length: 20, default: ReinsuranceDirection.OUTWARD })
  direction: ReinsuranceDirection;

  @Column({ type: 'varchar', length: 30, default: 'DRAFT' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
