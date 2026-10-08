import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InsuranceCompanyPartner } from './insurance-company-partner.entity';

export enum PartnerAmendmentStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

@Entity('insurance_company_partner_amendments')
@Index('IDX_partner_amendments_relationship_created', [
  'relationship_id',
  'created_at',
])
export class InsuranceCompanyPartnerAmendment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) relationship_id: string;
  @Column({ type: 'uuid' }) proposed_by_company_id: string;
  @Column({ type: 'uuid' }) proposed_by_user_id: string;
  @Column({ type: 'jsonb' }) proposed_terms: Record<string, unknown>;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({
    type: 'enum',
    enum: PartnerAmendmentStatus,
    default: PartnerAmendmentStatus.PENDING,
  })
  status: PartnerAmendmentStatus;
  @Column({ type: 'uuid', nullable: true }) responded_by_company_id:
    | string
    | null;
  @Column({ type: 'uuid', nullable: true }) responded_by_user_id: string | null;
  @Column({ type: 'text', nullable: true }) response_reason: string | null;
  @Column({ type: 'timestamptz', nullable: true }) responded_at: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) applied_at: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @ManyToOne(() => InsuranceCompanyPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'relationship_id' })
  relationship: InsuranceCompanyPartner;
}
