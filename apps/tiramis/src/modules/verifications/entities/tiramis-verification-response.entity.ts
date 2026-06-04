import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';

import { TiramisVerificationRequestEntity } from './tiramis-verification-request.entity';

@Entity({ name: 'tiramis_verification_responses' })
@Index(['requestId'])
@Index(['responseStatusCode'])
export class TiramisVerificationResponseEntity extends BaseEntity {
  @Column({ name: 'verification_request_id' })
  verificationRequestId!: string;

  @OneToOne(
    () => TiramisVerificationRequestEntity,
    (request) => request.response,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'verification_request_id' })
  verificationRequest!: TiramisVerificationRequestEntity;

  @Column({ name: 'response_id', type: 'varchar', length: 50, nullable: true })
  responseId?: string | null;

  @Column({ name: 'request_id', length: 50 })
  requestId!: string;

  @Column({ name: 'response_status_code', type: 'varchar', length: 20, nullable: true })
  responseStatusCode?: string | null;

  @Column({ name: 'response_status_desc', type: 'varchar', length: 255, nullable: true })
  responseStatusDesc?: string | null;

  @Column({ name: 'raw_response_xml', type: 'text', nullable: true })
  rawResponseXml?: string | null;

  @Column({ name: 'response_signature', type: 'text', nullable: true })
  responseSignature?: string | null;

  @Column({ name: 'response_payload', type: 'text', nullable: true })
  responsePayload?: string | null;

  @Column({ name: 'responded_at', type: 'timestamp', nullable: true })
  respondedAt?: Date | null;
}
