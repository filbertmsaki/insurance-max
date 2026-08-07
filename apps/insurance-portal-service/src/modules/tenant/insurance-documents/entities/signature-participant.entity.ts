import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('signature_participants')
export class SignatureParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  signature_request_id: string;

  @Column({ type: 'varchar', length: 30 })
  participant_type: string;

  @Column({ type: 'uuid', nullable: true })
  participant_id: string | null;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'int', nullable: true })
  signing_order: number | null;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  access_token_hash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  signed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  declined_at: Date | null;

  @Column({ type: 'text', nullable: true })
  decline_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
