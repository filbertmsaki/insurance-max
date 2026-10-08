import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceCompanyPartner } from './insurance-company-partner.entity';

@Entity('insurance_company_partner_events')
@Index('IDX_insurance_partner_events_relationship_created', [
  'relationship_id',
  'created_at',
])
export class InsuranceCompanyPartnerEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  relationship_id: string;

  @Column({ type: 'uuid', nullable: true })
  actor_company_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  actor_user_id: string | null;

  @Column({ type: 'varchar', length: 40 })
  event_type: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  previous_status: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  new_status: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => InsuranceCompanyPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'relationship_id' })
  relationship: InsuranceCompanyPartner;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_company_id' })
  actor_company: Company | null;
}
