import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisCoverNoteEntity } from './tiramis-cover-note.entity';

@Entity({ name: 'tiramis_policy_holders' })
export class TiramisPolicyHolderEntity extends BaseEntity {
  @Column({ name: 'cover_note_id' })
  coverNoteId!: string;

  @ManyToOne(
    () => TiramisCoverNoteEntity,
    (coverNote) => coverNote.policyHolders,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'cover_note_id' })
  coverNote!: TiramisCoverNoteEntity;

  @Column({ name: 'policy_holder_name', length: 100 })
  policyHolderName!: string;

  @Column({ name: 'policy_holder_birth_date', type: 'date', nullable: true })
  policyHolderBirthDate?: Date | null;

  @Column({ name: 'policy_holder_type', type: 'int' })
  policyHolderType!: number;

  @Column({ name: 'policy_holder_id_number', length: 50 })
  policyHolderIdNumber!: string;

  @Column({ name: 'policy_holder_id_type', type: 'int' })
  policyHolderIdType!: number;

  @Column({ length: 1, nullable: true })
  gender?: string | null;

  @Column({ name: 'country_code', length: 3 })
  countryCode!: string;

  @Column({ length: 50 })
  region!: string;

  @Column({ length: 50 })
  district!: string;

  @Column({ length: 50, nullable: true })
  street?: string | null;

  @Column({ name: 'phone_number', length: 50 })
  phoneNumber!: string;

  @Column({ length: 50, nullable: true })
  fax?: string | null;

  @Column({ name: 'postal_address', length: 100, nullable: true })
  postalAddress?: string | null;

  @Column({ name: 'email_address', length: 100, nullable: true })
  emailAddress?: string | null;
}
