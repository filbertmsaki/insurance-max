import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Company } from '../../platform/companies/entities/company.entity';

export enum TiramisCompanyLinkStatus {
  /** Linked to TIRAMIS, integration access not yet granted. */
  LINKED = 'LINKED',
  /** Integration access granted: TIRAMIS-backed business is available. */
  ACTIVE = 'ACTIVE',
  /** Access revoked: no new submissions or new business; history kept. */
  REVOKED = 'REVOKED',
}

/**
 * A company's link to the platform's TIRAMIS integration. Holds only company
 * identification; every technical setting is platform-level.
 */
@Entity({ name: 'tiramis_company_links' })
@Index('UQ_tiramis_company_links_company', ['companyId'], { unique: true })
@Index('IDX_tiramis_company_links_status', ['status'])
export class TiramisCompanyLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'company_name', type: 'varchar', length: 150 })
  companyName!: string;

  /** TIRA insurer company code; also the company's TIRA CompanyCode. */
  @Column({ name: 'insurer_company_code', type: 'varchar', length: 30 })
  insurerCompanyCode!: string;

  @Column({ name: 'insurer_company_name', type: 'varchar', length: 150 })
  insurerCompanyName!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: TiramisCompanyLinkStatus.LINKED,
  })
  status!: TiramisCompanyLinkStatus;

  @Column({ name: 'linked_at', type: 'timestamptz' })
  linkedAt!: Date;

  @Column({ name: 'linked_by', type: 'uuid', nullable: true })
  linkedBy?: string | null;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt?: Date | null;

  @Column({ name: 'activated_by', type: 'uuid', nullable: true })
  activatedBy?: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy?: string | null;

  @Column({ name: 'revoke_reason', type: 'text', nullable: true })
  revokeReason?: string | null;

  @Column({ name: 'restored_at', type: 'timestamptz', nullable: true })
  restoredAt?: Date | null;

  @Column({ name: 'restored_by', type: 'uuid', nullable: true })
  restoredBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;
}
