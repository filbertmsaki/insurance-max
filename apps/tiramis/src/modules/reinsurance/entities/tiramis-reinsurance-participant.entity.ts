import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisReinsuranceEntity } from './tiramis-reinsurance.entity';

@Entity({ name: 'tiramis_reinsurance_participants' })
export class TiramisReinsuranceParticipantEntity extends BaseEntity {
  @Column({ name: 'reinsurance_id' })
  reinsuranceId!: string;

  @ManyToOne(
    () => TiramisReinsuranceEntity,
    (reinsurance) => reinsurance.participants,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'reinsurance_id' })
  reinsurance!: TiramisReinsuranceEntity;

  @Column({ name: 'participant_code', length: 50 })
  participantCode!: string;

  @Column({ name: 'participant_type', type: 'int' })
  participantType!: number;

  @Column({ name: 'reinsurance_form', type: 'int' })
  reinsuranceForm!: number;

  @Column({ name: 'reinsurance_type', type: 'int' })
  reinsuranceType!: number;

  @Column({
    name: 're_broker_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  reBrokerCode?: string | null;

  @Column({
    name: 'brokerage_commission',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  brokerageCommission!: string;

  @Column({
    name: 'reinsurance_commission',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  reinsuranceCommission!: string;

  @Column({
    name: 'premium_share',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  premiumShare!: string;

  @Column({ name: 'participation_date' })
  participationDate!: Date;
}
