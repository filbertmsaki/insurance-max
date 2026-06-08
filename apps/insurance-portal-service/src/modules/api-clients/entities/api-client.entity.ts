import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('api_clients')
@Index('UQ_api_clients_client_id', ['client_id'], { unique: true })
export class ApiClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  company_id: string | null;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100, unique: true })
  client_id: string;

  @Column({ length: 255, select: false })
  client_secret_hash: string;

  @Column({ type: 'simple-array', default: '' })
  scopes: string[];

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'timestamp', nullable: true })
  last_used_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
