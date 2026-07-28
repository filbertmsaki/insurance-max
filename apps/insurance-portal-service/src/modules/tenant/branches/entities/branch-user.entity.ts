import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { CompanyUser } from '../../../platform/companies/entities/company-user.entity';

@Entity('branch_users')
@Unique('UQ_branch_users_branch_company_user', ['branch_id', 'company_user_id'])
@Index('IDX_branch_users_branch_id', ['branch_id'])
@Index('IDX_branch_users_company_user_id', ['company_user_id'])
export class BranchUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  branch_id: string;

  @Column({ type: 'varchar' })
  company_user_id: string;

  @Column({ default: false })
  is_primary: boolean;

  @Column({ default: false })
  is_active_branch: boolean;

  @Column({ type: 'uuid', nullable: true })
  assigned_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  activated_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  activated_by: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Branch, (branch) => branch.branch_users, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => CompanyUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_user_id' })
  company_user: CompanyUser;
}
