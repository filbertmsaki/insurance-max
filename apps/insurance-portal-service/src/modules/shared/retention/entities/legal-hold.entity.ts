import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('legal_holds')
@Index('IDX_legal_hold_resource_active', ['resource_type', 'resource_id', 'active'])
export class LegalHold {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  company_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  hold_code: string;

  @Column({ type: 'varchar', length: 120 })
  resource_type: string;

  @Column({ type: 'varchar', length: 120 })
  resource_id: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  released_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  released_at: Date | null;
}
