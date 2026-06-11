import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Permission } from '../../permissions/entities/permission.entity';
import { User } from '../../../tenant/users/entities/user.entity';

@Entity('roles')
@Index('IDX_role_company', ['company_id'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  @Column({ length: 100 })
  display_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({
    description: 'Owning company (UUID). Null = global role.',
    nullable: true,
    required: false,
  })
  @Column({ type: 'varchar', nullable: true })
  company_id: string | null;

  @ApiProperty({ default: false })
  @Column({ default: false })
  is_system_generated: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Company, (company) => company.roles, {
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  @ManyToMany(() => Permission, (permission) => permission.roles)
  @JoinTable({
    name: 'permission_role',
    joinColumn: { name: 'roles_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissions_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];
}
