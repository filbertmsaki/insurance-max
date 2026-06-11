import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { User } from '../../../tenant/users/entities/user.entity';

@Entity('permissions')
@Index('UQ_permission_name', ['name'], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  display_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ default: false })
  @Column({ default: false })
  is_system_generated: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];

  @ManyToMany(() => User, (user) => user.permissions)
  users: User[];
}
