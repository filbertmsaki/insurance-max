# Insurance Max Monorepo

Insurance Max is a NestJS monorepo with two backend microservices:

- `insurance-portal-service` - the multi-tenant portal backend for companies, users, RBAC, branches, departments, and the insurance product engine.
- `tiramis` - the external integration backend for TIRA-style workflows such as cover notes, policies, claims, reinsurance, verification, and callback handling.

## Structure

- `apps/insurance-portal-service` - portal service entrypoint, database, modules, and seeds
- `apps/tiramis` - Tiramis service entrypoint, database, modules, and seeders
- `libs/shared-config` - shared configuration and database factories
- `libs/persistence` - shared base entity abstractions
- `libs/contracts` - reusable message patterns and integration contracts
- `libs/shared-kernel` - reusable technical helpers

## Database Table Attributes

### `insurance-portal-service`

| Table | Key attributes |
| --- | --- |
| `users` | `id`, `user_no`, `first_name`, `last_name`, `phone`, `email`, `password`, `status`, `user_type`, `is_email_verified`, `is_phone_verified`, `email_verification_token`, `email_verification_expires`, `failed_login_attempts`, `locked_until`, `last_login_at`, `last_login_ip`, `is_two_factor_enabled`, `two_factor_secret`, `two_factor_backup_codes`, `created_at`, `updated_at`, `deleted_at` |
| `companies` | `id`, `name`, `slug`, `status`, `contact_email`, `contact_phone`, `website`, `logo_url`, `address`, `settings`, `metadata`, `created_at`, `updated_at` |
| `company_users` | `id`, `company_id`, `user_id`, `status`, `is_default`, `last_accessed_at`, `created_at`, `updated_at` |
| `roles` | `id`, `name`, `display_name`, `description`, `company_id`, `is_system_generated`, `created_at`, `updated_at` |
| `permissions` | `id`, `name`, `display_name`, `description`, `is_system_generated`, `created_at`, `updated_at` |
| `branches` | `id`, `company_id`, `name`, `code`, `sale_point_code`, `sale_point_name`, `status`, `address`, `phone`, `email`, `manager_id`, `created_at`, `updated_at`, `deleted_at` |
| `departments` | `id`, `company_id`, `branch_id`, `name`, `code`, `description`, `status`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` |
| `insurance_categories` | `id`, `company_id`, `code`, `name`, `description`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` |
| `insurance_products` | `id`, `company_id`, `category_id`, `product_code`, `product_name`, `description`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` |
| `insurance_sub_classes` | `id`, `company_id`, `product_id`, `code`, `name`, `description`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` |
| `insurance_risks` | `id`, `company_id`, `product_id`, `sub_class_id`, `risk_code`, `risk_name`, `description`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` |
| `rating_factors` | `id`, `company_id`, `code`, `name`, `data_type`, `options`, `default_value`, `is_required`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` |
| `risk_required_factors` | `id`, `company_id`, `risk_id`, `factor_id`, `is_required`, `sort_order`, `created_by`, `updated_by`, `created_at`, `updated_at` |
| `risk_rating_rules` | `id`, `company_id`, `risk_id`, `rule_name`, `rate_type`, `percentage_rate`, `fixed_amount`, `per_unit_amount`, `per_unit_factor_code`, `minimum_amount`, `formula`, `priority`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` |
| `risk_rule_conditions` | `id`, `company_id`, `rule_id`, `factor_code`, `operator`, `value_from`, `value_to`, `logical_operator`, `created_by`, `updated_by`, `created_at`, `updated_at` |
| `user_sessions` | `id`, `user_id`, `refresh_token_hash`, `device_id`, `ip_address`, `user_agent`, `device_info`, `expires_at`, `revoked`, `revoked_at`, `created_at` |
| `devices` | `id`, `user_id`, `fingerprint`, `device_name`, `device_type`, `os`, `browser`, `trusted`, `trusted_at`, `last_used_at`, `created_at` |
| `otp_verifications` | `id`, `user_id`, `target`, `channel`, `purpose`, `otp_hash`, `attempts`, `is_verified`, `expires_at`, `verified_at`, `ip_address`, `created_at` |
| `api_clients` | `id`, `company_id`, `name`, `client_id`, `client_secret_hash`, `scopes`, `status`, `description`, `last_used_at`, `expires_at`, `created_at`, `updated_at` |
| `audit_logs` | `id`, `user_id`, `company_id`, `action`, `resource`, `resource_id`, `ip_address`, `user_agent`, `metadata`, `status`, `created_at` |

### `tiramis`

| Table | Key attributes |
| --- | --- |
| `tiramis_client_configurations` | `id`, `environment`, `company_code`, `insurer_company_code`, `sale_point_code`, `tran_company_code`, `portal_webhook_api_key_encrypted`, `portal_notification_events`, `is_active`, `created_at`, `updated_at` (company settings only; the TIRA client code/key, system code/name, certificates and URLs are platform-wide `TIRA_*` / `TIRAMIS_*` environment variables) |
| `tiramis_service_endpoints` | `id`, `environment`, `service_type`, `endpoint_url`, `http_method`, `content_type`, `is_active`, `created_at`, `updated_at` |
| `tiramis_response_codes` | `id`, `code`, `description`, `category`, `is_success`, `is_retryable`, `is_active`, `created_at`, `updated_at` |
| `tiramis_transactions` | `id`, `client_configuration_id`, `service_type`, `source_module`, `source_record_id`, `business_reference`, `status`, `original_request_id`, `current_request_id`, `successful_request_id`, `total_attempts`, `last_attempt_at`, `successful_at`, `last_error`, `created_at`, `updated_at` |
| `tiramis_submission_attempts` | `id`, `transaction_id`, `attempt_no`, `request_id`, `previous_request_id`, `root_element`, `resubmission_reason`, `status`, `request_xml`, `request_signature`, `acknowledgement_id`, `acknowledgement_status_code`, `acknowledgement_status_desc`, `acknowledgement_xml`, `ack_received_at`, `response_id`, `response_status_code`, `response_status_desc`, `response_xml`, `response_signature`, `final_response_received_at`, `response_acknowledgement_id`, `response_ack_status_code`, `response_ack_status_desc`, `response_ack_xml`, `response_ack_sent_at`, `sent_at`, `error_message`, `created_at`, `updated_at` |
| `tiramis_submission_events` | `id`, `transaction_id`, `attempt_id`, `event_type`, `request_id`, `status_code`, `status_desc`, `raw_payload`, `error_message`, `created_at`, `updated_at` |
| `tiramis_cover_notes` | `id`, `transaction_id`, `current_attempt_id`, `insurance_type`, `is_fleet`, `request_id`, `company_code`, `system_code`, `callback_url`, `insurer_company_code`, `tran_company_code`, `cover_note_type`, `cover_note_number`, `prev_cover_note_reference_number`, `cover_note_reference_number`, `sticker_number`, `sale_point_code`, `cover_note_start_date`, `cover_note_end_date`, `cover_note_desc`, `operative_clause`, `payment_mode`, `currency_code`, `exchange_rate`, `total_premium_excluding_tax`, `total_premium_including_tax`, `commission_paid`, `commission_rate`, `officer_name`, `officer_title`, `product_code`, `endorsement_type`, `endorsement_reason`, `endorsement_premium_earned`, `created_at`, `updated_at` |
| `tiramis_motor_fleets` | `id`, `cover_note_id`, `fleet_id`, `fleet_type`, `fleet_size`, `comprehensive_insured`, `created_at`, `updated_at` |
| `tiramis_policies` | `id`, `transaction_id`, `current_attempt_id`, `request_id`, `company_code`, `system_code`, `callback_url`, `insurer_company_code`, `policy_number`, `policy_reference_number`, `policy_operative_clause`, `special_conditions`, `exclusions`, `created_at`, `updated_at` |
| `tiramis_reinsurances` | `id`, `transaction_id`, `current_attempt_id`, `request_id`, `company_code`, `system_code`, `callback_url`, `insurer_company_code`, `cover_note_reference_number`, `premium_including_tax`, `currency_code`, `exchange_rate`, `authorizing_officer_name`, `authorizing_officer_title`, `reinsurance_category`, `created_at`, `updated_at` |
| `tiramis_claim_notifications` | `id`, `transaction_id`, `current_attempt_id`, `request_id`, `company_code`, `system_code`, `callback_url`, `insurer_company_code`, `tran_company_code`, `claim_notification_number`, `cover_note_reference_number`, `claim_report_date`, `claim_form_dully_filled`, `loss_date`, `loss_nature`, `loss_type`, `loss_location`, `officer_name`, `officer_title`, `created_at`, `updated_at` |
| `tiramis_verification_requests` | `id`, `transaction_id`, `current_attempt_id`, `request_id`, `verification_type`, `company_code`, `system_code`, `callback_url`, `created_at`, `updated_at` |
| `tiramis_verification_responses` | `id`, `verification_request_id`, `request_id`, `status_code`, `status_desc`, `raw_payload`, `created_at`, `updated_at` |

## Useful commands

```bash
npm install
npm run build
npm run build:insurance-portal-service
npm run start
npm run start:insurance-portal-service
npm run start:dev
npm run start:dev:insurance-portal-service
npm run test
npm run db:prepare:tiramis:e2e
npm run test:e2e          # disposable test databases, see docs/testing.md
npm run test:verify-clean
npm run test:tiramis:e2e
```

## Environment files

- `apps/insurance-portal-service/.env`
- `apps/insurance-portal-service/.env.example`
- `apps/tiramis/.env`
- `apps/tiramis/.env.example`

## Database migrations

```bash
npm run migration:run:tiramis
npm run migration:run:insurance-portal-service
npm run db:prepare:tiramis:e2e
```

`npm run test:tiramis:e2e` now runs the fresh database prep step first, so it will reset both service databases, rerun migrations, and reseed data before the E2E assertions execute.

If you want a fuller narrative description, see `docs/project-overview.md`.

Pricing-engine implementation notes are documented in `docs/pricing-engine.md`.

Pricing request and response examples are documented in `docs/pricing-api-examples.md`.
