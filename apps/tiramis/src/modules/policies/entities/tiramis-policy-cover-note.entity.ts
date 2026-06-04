import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisPolicyEntity } from './tiramis-policy.entity';

@Entity({ name: 'tiramis_policy_cover_notes' })
@Index(['coverNoteReferenceNumber'])
export class TiramisPolicyCoverNoteEntity extends BaseEntity {
  @Column({ name: 'policy_id' })
  policyId!: string;

  @ManyToOne(() => TiramisPolicyEntity, (policy) => policy.coverNotes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'policy_id' })
  policy!: TiramisPolicyEntity;

  @Column({ name: 'cover_note_reference_number', length: 50 })
  coverNoteReferenceNumber!: string;
}
