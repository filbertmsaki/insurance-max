import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TreatyParticipantRole } from '../enums/reinsurance.enums';

@Entity('reinsurance_counterparties')
export class ReinsuranceCounterparty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  counterparty_company_id: string;

  @Column({ type: 'varchar', length: 40 })
  role: TreatyParticipantRole;

  @Column({ type: 'varchar', length: 20, nullable: true })
  rating: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  rating_agency: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  home_territory: string | null;

  @Column({ type: 'varchar', length: 30, default: 'UNREGISTERED' })
  regulatory_status: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
