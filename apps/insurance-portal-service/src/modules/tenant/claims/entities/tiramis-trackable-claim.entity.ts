import { Column } from 'typeorm';

export abstract class TiramisTrackableClaimEntity {
  @Column({ type: 'uuid', nullable: true })
  tiramis_submission_tracking_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tiramis_status: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_transaction_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_request_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  tiramis_service_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_root_element: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tiramis_acknowledgement_status_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tiramis_acknowledgement_status_desc: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_final_response_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tiramis_final_response_status_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tiramis_final_response_status_desc: string | null;

  @Column({ type: 'text', nullable: true })
  tiramis_last_error_message: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  tiramis_last_synced_at: Date | null;
}
