import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineMigration1786736437722 implements MigrationInterface {
  name = 'BaselineMigration1786736437722';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "tiramis_submission_tracking" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "request_type" character varying(80) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'PENDING', "schema_version" character varying(100) NOT NULL DEFAULT 'insurance-max.tiramis.submission.v1', "contract_version" character varying(20) NOT NULL DEFAULT '1.0', "workflow_revision" integer, "correlation_id" uuid, "causation_id" uuid, "canonical_status" character varying(60) NOT NULL DEFAULT 'CREATED', "resource_version" integer NOT NULL DEFAULT '1', "source_service" character varying(100) NOT NULL DEFAULT 'insurance-portal-service', "source_company_id" uuid, "source_user_id" uuid, "source_module" character varying(100), "source_record_id" character varying(150), "policy_id" character varying(150), "quotation_id" character varying(150), "business_reference" character varying(150), "business_fingerprint" character varying(255), "idempotency_key" character varying(255), "duplicate_of_tracking_id" uuid, "duplicate_prevention_reason" text, "duplicate_checked_at" TIMESTAMP WITH TIME ZONE, "resubmission_count" integer NOT NULL DEFAULT '0', "force_resubmitted" boolean NOT NULL DEFAULT false, "force_resubmit" boolean NOT NULL DEFAULT false, "return_existing" boolean NOT NULL DEFAULT false, "tiramis_transaction_id" uuid, "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "acknowledgement_status_code" character varying(20), "acknowledgement_status_desc" character varying(255), "last_error_message" text, "request_payload" jsonb, "envelope" jsonb, "payload_hash" character varying(64), "context_hash" character varying(64), "envelope_hash" character varying(64), "latest_event_sequence" integer NOT NULL DEFAULT '0', "latest_event_id" uuid, "reconciliation_required" boolean NOT NULL DEFAULT false, "reconciliation_reason" text, "last_reconciled_at" TIMESTAMP WITH TIME ZONE, "legacy_portal_submission_id" uuid, "tiramis_response_payload" jsonb, "submitted_at" TIMESTAMP WITH TIME ZONE, "acknowledged_at" TIMESTAMP WITH TIME ZONE, "failed_at" TIMESTAMP WITH TIME ZONE, "final_response_id" character varying(100), "final_response_status_code" character varying(20), "final_response_status_desc" character varying(255), "final_response_received_at" TIMESTAMP WITH TIME ZONE, "final_response_payload" jsonb, "last_synced_at" TIMESTAMP WITH TIME ZONE, "sync_attempts" integer NOT NULL DEFAULT '0', "business_record_synced_at" TIMESTAMP WITH TIME ZONE, "business_record_sync_error" text, "business_record_sync_attempts" integer NOT NULL DEFAULT '0', "is_retryable" boolean NOT NULL DEFAULT false, "retry_attempts" integer NOT NULL DEFAULT '0', "max_retry_attempts" integer NOT NULL DEFAULT '3', "next_retry_at" TIMESTAMP WITH TIME ZONE, "last_retry_at" TIMESTAMP WITH TIME ZONE, "retry_lock_id" character varying(120), "retry_locked_at" TIMESTAMP WITH TIME ZONE, "retry_error_message" text, "retry_strategy" character varying(40) DEFAULT 'EXPONENTIAL_BACKOFF', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_dfa9fa0a4c431d8e3a5c69a5b50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9ef2adfd1ec2cf03b853d827ee" ON "tiramis_submission_tracking" ("correlation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e44d013ae76322e15e409e1682" ON "tiramis_submission_tracking" ("canonical_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_87cf0ce5fe19aa818e9f981e0f" ON "tiramis_submission_tracking" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7f34a16825336290c51be1a9d9" ON "tiramis_submission_tracking" ("tiramis_request_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a66089d44f52084f7a272a064e" ON "tiramis_submission_tracking" ("tiramis_transaction_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dc01abe1be2aeda70d09bc9865" ON "tiramis_submission_tracking" ("retry_lock_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dda15935ea15d62b4706557af7" ON "tiramis_submission_tracking" ("next_retry_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_545c88f16d7be52d5185008549" ON "tiramis_submission_tracking" ("is_retryable") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c408eca454c38a059bab4bd3b2" ON "tiramis_submission_tracking" ("duplicate_of_tracking_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2f8146548fd3c3bb8fdd033cf1" ON "tiramis_submission_tracking" ("idempotency_key") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_31d3e713ccc9a8180ae27ce13f" ON "tiramis_submission_tracking" ("source_record_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_42c09d8e6672dc7d55cc3730ae" ON "tiramis_submission_tracking" ("source_company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c9b0430a762bec34a996529675" ON "tiramis_submission_tracking" ("business_fingerprint") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6f2de86d260058b732210972f6" ON "tiramis_submission_tracking" ("business_reference") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_22f92c66c9ba233fc2bdcda026" ON "tiramis_submission_tracking" ("request_type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_no" character varying(30) NOT NULL, "first_name" character varying(50) NOT NULL, "last_name" character varying(50) NOT NULL, "phone" character varying(20) NOT NULL, "email" character varying(100) NOT NULL, "password" character varying(255), "status" character varying(20) NOT NULL DEFAULT 'active', "user_type" character varying(20) NOT NULL DEFAULT 'CUSTOMER', "officer_title" character varying(120) NOT NULL DEFAULT 'Underwriter', "is_email_verified" boolean NOT NULL DEFAULT false, "is_phone_verified" boolean NOT NULL DEFAULT false, "email_verification_token" character varying(255), "email_verification_expires" TIMESTAMP, "failed_login_attempts" integer NOT NULL DEFAULT '0', "locked_until" TIMESTAMP, "last_login_at" TIMESTAMP, "last_login_ip" character varying(45), "is_two_factor_enabled" boolean NOT NULL DEFAULT false, "two_factor_secret" text, "two_factor_backup_codes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "authorization_version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_e5f6813966537a78538a896d74b" UNIQUE ("user_no"), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "display_name" character varying(100) NOT NULL, "description" text, "is_system_generated" boolean NOT NULL DEFAULT false, "assignment_scope" character varying(20) NOT NULL DEFAULT 'tenant', "assignable_to_company_role" boolean NOT NULL DEFAULT false, "assignable_to_platform_role" boolean NOT NULL DEFAULT false, "is_deprecated" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_permission_name" ON "permissions" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(50) NOT NULL, "display_name" character varying(100) NOT NULL, "description" text, "company_id" uuid, "is_system_generated" boolean NOT NULL DEFAULT false, "scope" character varying(30) NOT NULL DEFAULT 'tenant', "is_administrative" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_roles_company_name" ON "roles" ("company_id", "name") WHERE "company_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_roles_global_name" ON "roles" ("name") WHERE "company_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_roles_scope_company" ON "roles" ("scope", "company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_role_company" ON "roles" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "company_user_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_user_id" uuid NOT NULL, "role_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_company_user_roles_membership_role" UNIQUE ("company_user_id", "role_id"), CONSTRAINT "PK_745cfc55c7335ce3f01b5da5189" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "company_user_permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_user_id" uuid NOT NULL, "permission_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_company_user_permissions_membership_permission" UNIQUE ("company_user_id", "permission_id"), CONSTRAINT "PK_d30fb64106f894e6b1152f4eb5d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "company_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "user_id" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'active', "is_default" boolean NOT NULL DEFAULT false, "last_accessed_at" TIMESTAMP, "authorization_version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_company_users_company_user" UNIQUE ("company_id", "user_id"), CONSTRAINT "PK_fcd31773e604355d8a473de888c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."companies_company_type_enum" AS ENUM('INSURANCE_COMPANY', 'REINSURANCE_COMPANY', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'SERVICE_PROVIDER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "slug" character varying(120) NOT NULL, "identifier_prefix" character varying(20), "status" character varying(20) NOT NULL DEFAULT 'active', "company_type" "public"."companies_company_type_enum" NOT NULL DEFAULT 'INSURANCE_COMPANY', "tira_license_number" character varying(100), "tira_license_status" character varying(30), "license_issued_at" date, "license_expires_at" date, "tin" character varying(100), "brela_registration_number" character varying(100), "tira_company_code" character varying(30), "tira_insurer_company_code" character varying(30), "tira_client_code" character varying(60), "tira_system_code" character varying(100), "tira_system_name" character varying(150), "operating_timezone" character varying(100) NOT NULL DEFAULT 'Africa/Dar_es_Salaam', "default_currency" character varying(3) NOT NULL DEFAULT 'TZS', "tira_integration_enabled" boolean NOT NULL DEFAULT false, "regulatory_metadata" jsonb, "contact_email" character varying(100), "contact_phone" character varying(30), "website" character varying(255), "logo_url" character varying(500), "address" jsonb, "settings" jsonb, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_b28b07d25e4324eee577de5496d" UNIQUE ("slug"), CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_companies_name" ON "companies" ("name") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_companies_identifier_prefix" ON "companies" ("identifier_prefix") `,
    );
    await queryRunner.query(
      `CREATE TABLE "branch_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "company_user_id" uuid NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "is_active_branch" boolean NOT NULL DEFAULT false, "assigned_by" uuid, "activated_at" TIMESTAMP, "activated_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_branch_users_branch_company_user" UNIQUE ("branch_id", "company_user_id"), CONSTRAINT "PK_165d04e1f7360e289b9afa2ee96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_users_company_user_id" ON "branch_users" ("company_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_users_branch_id" ON "branch_users" ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "company_features" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "feature_key" character varying(100) NOT NULL, "display_name" character varying(150) NOT NULL, "description" text, "is_enabled" boolean NOT NULL DEFAULT true, "metadata" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_company_features_company_key" UNIQUE ("company_id", "feature_key"), CONSTRAINT "PK_0313635ef7228bbca878f35ec2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_company_features_company_id" ON "company_features" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "branch_features" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "company_feature_id" uuid NOT NULL, "is_enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_branch_features_branch_feature" UNIQUE ("branch_id", "company_feature_id"), CONSTRAINT "PK_97e9c5f34b989f3a7c15dde32cf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "code" character varying(50) NOT NULL, "sale_point_code" character varying(100), "sale_point_name" character varying(150), "is_head_office" boolean NOT NULL DEFAULT false, "status" character varying(20) NOT NULL DEFAULT 'active', "address" text, "phone" character varying(30), "email" character varying(100), "manager_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_branches_company_code" UNIQUE ("company_id", "code"), CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branches_status" ON "branches" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branches_company_id" ON "branches" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tiramis_sale_points" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "branch_code" character varying(50), "branch_name" character varying(120), "sale_point_code" character varying(50) NOT NULL, "sale_point_name" character varying(120), "is_default" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_tiramis_sale_points_company_sale_point" UNIQUE ("company_id", "sale_point_code"), CONSTRAINT "PK_6b2cdf0ba1f57fd88aeed6ab53a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_sale_points_sale_point_code" ON "tiramis_sale_points" ("sale_point_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_sale_points_branch_id" ON "tiramis_sale_points" ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_sale_points_company_id" ON "tiramis_sale_points" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tiramis_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(100) NOT NULL, "correlation_id" character varying(150), "event_key" character varying(180), "dedupe_key" character varying(255), "channel" character varying(40) NOT NULL DEFAULT 'IN_APP', "delivery_status" character varying(40) NOT NULL DEFAULT 'PENDING', "delivery_attempts" integer NOT NULL DEFAULT '0', "last_delivery_attempt_at" TIMESTAMP WITH TIME ZONE, "delivered_at" TIMESTAMP WITH TIME ZONE, "delivery_error_message" text, "severity" character varying(30) NOT NULL DEFAULT 'WARNING', "title" character varying(255) NOT NULL, "message" text NOT NULL, "request_type" character varying(80), "source_company_id" uuid, "source_user_id" uuid, "source_module" character varying(100), "source_record_id" character varying(150), "business_reference" character varying(150), "local_tracking_id" uuid, "tiramis_transaction_id" uuid, "tiramis_request_id" character varying(100), "status" character varying(80), "error_message" text, "is_read" boolean NOT NULL DEFAULT false, "read_at" TIMESTAMP WITH TIME ZONE, "read_by_user_id" uuid, "dismissed_at" TIMESTAMP WITH TIME ZONE, "dismissed_by_user_id" uuid, "expires_at" TIMESTAMP WITH TIME ZONE, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f124c350e0bf2003986bd7c0dca" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_239dae46f7ccee665b466dadb5" ON "tiramis_notifications" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_63a278be9de80a2038d26f1816" ON "tiramis_notifications" ("is_read") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b0a40f07f8b5f84b69bea17db8" ON "tiramis_notifications" ("local_tracking_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_51b42a7add6bcc3dd6619321df" ON "tiramis_notifications" ("business_reference") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9751d6b9f5875135eb9023d96a" ON "tiramis_notifications" ("source_record_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b3f28c61c3417d220a279219dc" ON "tiramis_notifications" ("source_module") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3b53010f93bb915f08ac223e0c" ON "tiramis_notifications" ("source_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e2722912fd72b62d3b446023d6" ON "tiramis_notifications" ("source_company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3803f6fc072e1d2f3af11b6e87" ON "tiramis_notifications" ("severity") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_033ea7c1f6d324492b3e4446f0" ON "tiramis_notifications" ("type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tiramis_lookups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_code" character varying(80) NOT NULL, "code" character varying(50) NOT NULL, "label" character varying(150) NOT NULL, "description" text, "metadata" jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_dca82ff8dd24231b27d82924955" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tiramis_lookups_group_code" ON "tiramis_lookups" ("group_code", "code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tiramis_company_configurations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "environment" character varying(20) NOT NULL DEFAULT 'test', "company_code" character varying(30) NOT NULL, "company_name" character varying(150), "insurer_company_code" character varying(30), "insurer_company_name" character varying(150), "client_code" character varying(60), "client_key" character varying(255), "service_api_key_encrypted" text, "system_code" character varying(100), "system_name" character varying(150), "base_url" character varying(500), "source_service" character varying(100), "callback_url" character varying(500), "is_active" boolean NOT NULL DEFAULT true, "validation_status" character varying(30) NOT NULL DEFAULT 'NOT_VALIDATED', "validated_at" TIMESTAMP WITH TIME ZONE, "validation_message" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_tiramis_company_config_company_environment" UNIQUE ("company_id", "environment"), CONSTRAINT "PK_ab9a3fd9705afb304069361d104" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_company_config_company_code" ON "tiramis_company_configurations" ("company_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_company_config_environment" ON "tiramis_company_configurations" ("environment") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_company_config_company_id" ON "tiramis_company_configurations" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "department_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "company_user_id" uuid NOT NULL, "department_id" uuid NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "is_active_department" boolean NOT NULL DEFAULT false, "assigned_by" uuid, "activated_at" TIMESTAMP WITH TIME ZONE, "activated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_department_users_membership_department" UNIQUE ("company_user_id", "department_id"), CONSTRAINT "PK_9e73e356e01f8c809defeedd703" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da192729d410e929026a7aef25" ON "department_users" ("department_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8c0ba27e413a41a5fb0ddff584" ON "department_users" ("company_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0ae0cd2276d8973121d191da62" ON "department_users" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "departments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "name" character varying(120) NOT NULL, "code" character varying(50) NOT NULL, "description" text, "status" character varying(20) NOT NULL DEFAULT 'active', "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_departments_company_name" UNIQUE ("company_id", "name"), CONSTRAINT "UQ_departments_company_code" UNIQUE ("company_id", "code"), CONSTRAINT "PK_839517a681a86bb84cbcc6a1e9d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_departments_status" ON "departments" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_departments_branch_id" ON "departments" ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_departments_company_id" ON "departments" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "address_type" character varying(40) NOT NULL, "country_code" character varying(3) NOT NULL, "country" character varying(100), "region" character varying(100) NOT NULL, "district" character varying(100) NOT NULL, "ward" character varying(100), "street" character varying(150), "postal_address" character varying(150), "latitude" numeric(10,6), "longitude" numeric(10,6), "is_primary" boolean NOT NULL DEFAULT false, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_336bda7b0a0cd04241f719fc834" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "contact_type" character varying(30) NOT NULL, "label" character varying(80), "contact_name" character varying(150), "contact_role" character varying(100), "value" character varying(180) NOT NULL, "normalized_value" character varying(180) NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "is_verified" boolean NOT NULL DEFAULT false, "verified_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_bde619dbcb45a3e4d542e137bd3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "document_type" character varying(50) NOT NULL, "document_number" character varying(150), "storage_document_id" uuid, "original_file_name" character varying(255), "mime_type" character varying(100), "checksum" character varying(64), "status" character varying(30) NOT NULL DEFAULT 'PENDING', "issued_at" date, "expires_at" date, "verified_by" uuid, "verified_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_ccc82daa515b50e68a76f343417" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_identifiers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "identifier_type" character varying(50) NOT NULL, "identifier_value" character varying(150) NOT NULL, "normalized_value" character varying(150) NOT NULL, "fingerprint" character varying(64) NOT NULL, "country_code" character varying(3), "is_primary" boolean NOT NULL DEFAULT false, "is_verified" boolean NOT NULL DEFAULT false, "verified_by" uuid, "verified_at" TIMESTAMP WITH TIME ZONE, "issued_at" date, "expires_at" date, "source" character varying(30) NOT NULL DEFAULT 'MANUAL', "metadata" jsonb, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_5f5aa4e0a3c26bdd7b19c41f08e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "UQ_customer_identifier_company_type_value" ON "customer_identifiers" ("company_id", "identifier_type", "fingerprint") `,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_kyc_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "kyc_version" integer NOT NULL, "status" character varying(30) NOT NULL, "customer_snapshot" jsonb NOT NULL, "customer_snapshot_hash" character varying(64) NOT NULL, "submission_notes" text, "rejection_reason" text, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_52f5244c7c70c2bce9e8e0f0f20" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "insured_assets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "asset_number" character varying(50) NOT NULL, "asset_type" character varying(40) NOT NULL, "customer_id" uuid NOT NULL, "owner_customer_id" uuid NOT NULL, "display_name" character varying(180) NOT NULL, "ownership_type" character varying(30) NOT NULL DEFAULT 'OWNED', "declared_value" numeric(20,4) NOT NULL DEFAULT '0', "currency_code" character varying(10) NOT NULL DEFAULT 'TZS', "status" character varying(30) NOT NULL DEFAULT 'ACTIVE', "data_source" character varying(30) NOT NULL DEFAULT 'MANUAL', "verification_status" character varying(30) NOT NULL DEFAULT 'NOT_VERIFIED', "verification_reference" character varying(100), "snapshot_version" integer NOT NULL DEFAULT '1', "current_snapshot" jsonb, "current_snapshot_hash" character varying(64), "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_251c9302ae8e24ebaef097a4ff5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_type_enum" AS ENUM('INDIVIDUAL', 'CORPORATE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_gender_enum" AS ENUM('M', 'F')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_kyc_status_enum" AS ENUM('PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'REQUIRES_UPDATE', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_document_type_enum" AS ENUM('NIDA', 'VOTER_ID', 'PASSPORT', 'DRIVING_LICENSE', 'ZANID', 'TIN_CERTIFICATE', 'VRN_CERTIFICATE', 'BUSINESS_REGISTRATION', 'INCORPORATION_CERTIFICATE', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'BLACKLISTED', 'MERGED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_no" character varying(30) NOT NULL, "display_name" character varying(180), "customer_type" "public"."customer_type_enum" NOT NULL, "first_name" character varying(50), "middle_name" character varying(50), "last_name" character varying(50), "gender" "public"."customer_gender_enum", "date_of_birth" date, "nationality" character varying(100), "company_name" character varying(150), "registration_no" character varying(100), "incorporation_certificate_no" character varying(100), "tin" character varying(100), "vrn" character varying(100), "identity_fingerprint" character varying(64), "policy_holder_type" smallint, "id_type" smallint, "id_number" character varying(50), "nida_no" character varying(50), "voter_no" character varying(50), "passport_no" character varying(50), "driving_license_no" character varying(50), "zanid_no" character varying(50), "phone" character varying(30) NOT NULL, "alternate_phone" character varying(30), "fax" character varying(30), "email" character varying(100), "country" character varying(100), "country_code" character varying(3) NOT NULL, "region" character varying(50) NOT NULL, "district" character varying(50) NOT NULL, "ward" character varying(50), "street" character varying(50), "postal_address" character varying(50), "latitude" numeric(10,6), "longitude" numeric(10,6), "contact_name" character varying(100), "contact_role" character varying(100), "contact_phone" character varying(30), "contact_email" character varying(100), "kyc_status" "public"."customer_kyc_status_enum" NOT NULL DEFAULT 'PENDING', "kyc_version" integer NOT NULL DEFAULT '0', "kyc_verified_by" uuid, "kyc_verified_at" TIMESTAMP WITH TIME ZONE, "kyc_expires_at" TIMESTAMP WITH TIME ZONE, "kyc_rejection_reason" text, "document_type" "public"."customer_document_type_enum", "document_no" character varying(50), "document_file_name" character varying(255), "document_file_url" character varying(500), "document_mime_type" character varying(100), "document_verified" boolean NOT NULL DEFAULT false, "document_verified_by" uuid, "document_verified_at" TIMESTAMP WITH TIME ZONE, "status" "public"."customer_status_enum" NOT NULL DEFAULT 'ACTIVE', "merged_into_customer_id" uuid, "data_source" character varying(30) NOT NULL DEFAULT 'MANUAL', "metadata" jsonb, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_company_customer_type" ON "customers" ("company_id", "customer_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_company_status" ON "customers" ("company_id", "status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_customers_company_customer_no" ON "customers" ("company_id", "customer_no") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_company_id" ON "customers" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "motor_vehicle_ownerships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "motor_vehicle_id" uuid NOT NULL, "insured_asset_id" uuid NOT NULL, "owner_customer_id" uuid NOT NULL, "ownership_type" character varying(30) NOT NULL DEFAULT 'OWNED', "effective_from" date NOT NULL DEFAULT ('now'::text)::date, "effective_to" date, "change_reason" text, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8def8df2641e69fc1417c67813e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "motor_vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "insured_asset_id" uuid, "registration_no" character varying(50), "registration_no_normalized" character varying(50), "chassis_no" character varying(50), "chassis_no_normalized" character varying(100), "engine_no" character varying(50), "make" character varying(100), "model" character varying(100), "body_type" character varying(100), "color" character varying(50), "manufacture_year" smallint, "usage_type" character varying(100), "vehicle_category" character varying(100), "seating_capacity" integer, "tonnage" numeric(12,2), "cubic_capacity" integer, "fuel_type" character varying(50), "model_no" character varying(100), "number_of_axles" smallint, "axle_distance" numeric(10,2), "tare_weight" numeric(12,2), "gross_weight" numeric(12,2), "motor_category" smallint, "motor_type" smallint, "motor_usage" smallint, "owner_name" character varying(150), "owner_category" smallint, "owner_address" character varying(255), "vehicle_value" numeric(18,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "snapshot_version" integer NOT NULL DEFAULT '1', "metadata" jsonb, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_dce0fb31b4b74b23784dc1a5a46" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_motor_vehicles_company_engine_no" ON "motor_vehicles" ("company_id", "engine_no") WHERE deleted_at IS NULL AND engine_no IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_motor_vehicles_company_chassis_no" ON "motor_vehicles" ("company_id", "chassis_no") WHERE deleted_at IS NULL AND chassis_no IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_motor_vehicles_company_registration_no" ON "motor_vehicles" ("company_id", "registration_no") WHERE deleted_at IS NULL AND registration_no IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_motor_vehicles_company_customer_id" ON "motor_vehicles" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_motor_vehicles_company_id" ON "motor_vehicles" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "insurance_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "code" character varying(50) NOT NULL, "name" character varying(150) NOT NULL, "description" text, "business_line" character varying(20) NOT NULL DEFAULT 'NON_MOTOR', "is_active" boolean NOT NULL DEFAULT true, "tiramis_category_code" character varying(50), "sort_order" integer NOT NULL DEFAULT '100', "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_insurance_categories_company_name" UNIQUE ("company_id", "name"), CONSTRAINT "UQ_insurance_categories_company_code" UNIQUE ("company_id", "code"), CONSTRAINT "PK_9e9d526e40b7a3adbc887cea078" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_categories_business_line" ON "insurance_categories" ("company_id", "business_line") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_categories_is_active" ON "insurance_categories" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_categories_company_id" ON "insurance_categories" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product_definition_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_version_id" uuid NOT NULL, "code" character varying(50) NOT NULL, "item_type" character varying(30) NOT NULL, "title" character varying(180) NOT NULL, "description" text NOT NULL, "is_mandatory" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '100', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_product_definition_item_code" UNIQUE ("product_version_id", "code"), CONSTRAINT "PK_e518943a72f50fb7a7ec8b37dbf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_addon_definitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_version_id" uuid NOT NULL, "code" character varying(50) NOT NULL, "tiramis_addon_code" character varying(50), "name" character varying(180) NOT NULL, "description" text, "is_optional" boolean NOT NULL DEFAULT true, "is_default_selected" boolean NOT NULL DEFAULT false, "allows_separate_sum_insured" boolean NOT NULL DEFAULT false, "maximum_quantity" integer, "sort_order" integer NOT NULL DEFAULT '100', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_product_addon_definition_code" UNIQUE ("product_version_id", "code"), CONSTRAINT "PK_502dbb7e5d33d017624d98fbed5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_document_requirements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_version_id" uuid NOT NULL, "code" character varying(50) NOT NULL, "requirement_type" character varying(40) NOT NULL, "applies_to" character varying(40) NOT NULL, "name" character varying(180) NOT NULL, "description" text, "is_mandatory" boolean NOT NULL DEFAULT true, "accepted_mime_types" jsonb NOT NULL DEFAULT '[]', "maximum_file_size_mb" integer, "sort_order" integer NOT NULL DEFAULT '100', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_product_document_requirement_code" UNIQUE ("product_version_id", "code"), CONSTRAINT "PK_01715cc5bd69f78ba99876088fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "insurance_sub_classes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_id" uuid NOT NULL, "code" character varying(50) NOT NULL, "name" character varying(150) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "tiramis_sub_class_code" character varying(50), "cover_type_code" character varying(50), "sort_order" integer NOT NULL DEFAULT '100', "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_insurance_sub_classes_company_product_name" UNIQUE ("company_id", "product_id", "name"), CONSTRAINT "UQ_insurance_sub_classes_company_product_code" UNIQUE ("company_id", "product_id", "code"), CONSTRAINT "PK_aa616f43d088dd82838d8f592ba" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_sub_classes_is_active" ON "insurance_sub_classes" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_sub_classes_product_id" ON "insurance_sub_classes" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_sub_classes_company_id" ON "insurance_sub_classes" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product_version_sub_classes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_version_id" uuid NOT NULL, "sub_class_id" uuid NOT NULL, "code_snapshot" character varying(50) NOT NULL, "name_snapshot" character varying(150) NOT NULL, "description_snapshot" text, "tiramis_sub_class_code_snapshot" character varying(50), "cover_type_code_snapshot" character varying(50), "is_default" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '100', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_product_version_sub_class" UNIQUE ("product_version_id", "sub_class_id"), CONSTRAINT "PK_e29725442dd5ffd4ff9861e138c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "insurance_product_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_id" uuid NOT NULL, "version_number" integer NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "review_status" character varying(30) NOT NULL DEFAULT 'DRAFT', "product_name" character varying(150) NOT NULL, "description" text, "business_line" character varying(20) NOT NULL, "supports_fleet" boolean NOT NULL DEFAULT false, "tiramis_product_code" character varying(50), "cover_note_type" integer NOT NULL DEFAULT '1', "default_cover_duration_days" integer NOT NULL DEFAULT '365', "currency_code" character varying(3) NOT NULL DEFAULT 'TZS', "cover_note_description" text, "operative_clause" text, "policy_operative_clause" text, "special_conditions" text, "exclusions" text, "allows_cover_text_override" boolean NOT NULL DEFAULT false, "effective_from" date, "effective_to" date, "is_submission_ready" boolean NOT NULL DEFAULT false, "definition_hash" character varying(64), "review_comments" text, "submitted_for_review_by" uuid, "submitted_for_review_at" TIMESTAMP WITH TIME ZONE, "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "published_by" uuid, "published_at" TIMESTAMP WITH TIME ZONE, "retired_by" uuid, "retired_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_insurance_product_version_number" UNIQUE ("product_id", "version_number"), CONSTRAINT "PK_d81b6350db9bac998556fe4f831" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_versions_product_status" ON "insurance_product_versions" ("product_id", "status", "effective_from", "effective_to") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_versions_company" ON "insurance_product_versions" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "insurance_products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "category_id" uuid NOT NULL, "product_code" character varying(50) NOT NULL, "product_name" character varying(150) NOT NULL, "description" text, "business_line" character varying(20) NOT NULL DEFAULT 'NON_MOTOR', "supports_fleet" boolean NOT NULL DEFAULT false, "tiramis_product_code" character varying(50), "is_active" boolean NOT NULL DEFAULT true, "lifecycle_status" character varying(30) NOT NULL DEFAULT 'DRAFT', "latest_version_number" integer NOT NULL DEFAULT '0', "current_version_id" uuid, "code_locked_at" TIMESTAMP WITH TIME ZONE, "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_insurance_products_company_category_name" UNIQUE ("company_id", "category_id", "product_name"), CONSTRAINT "UQ_insurance_products_company_code" UNIQUE ("company_id", "product_code"), CONSTRAINT "PK_36ac5b506fcc1644ddf95580824" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_products_supports_fleet" ON "insurance_products" ("company_id", "supports_fleet") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_products_business_line" ON "insurance_products" ("company_id", "business_line") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_products_is_active" ON "insurance_products" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_products_category_id" ON "insurance_products" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_products_company_id" ON "insurance_products" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quotation_id" uuid NOT NULL, "previous_quotation_status" character varying(30), "new_quotation_status" character varying(30), "previous_approval_status" character varying(30), "new_approval_status" character varying(30), "previous_payment_status" character varying(30), "new_payment_status" character varying(30), "previous_tira_status" character varying(30), "new_tira_status" character varying(30), "transition_type" character varying(80), "reason" text, "comments" text, "changed_by" uuid, "changed_by_type" character varying(40), "source" character varying(40), "channel" character varying(40), "request_id" character varying(100), "payment_transaction_id" character varying(100), "tira_request_id" character varying(100), "tira_response_id" character varying(100), "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_67afaf2667003902abdba878532" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qsh_quotation_id" ON "quotation_status_history" ("quotation_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_entry_addon_taxes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "addon_id" uuid NOT NULL, "sequence_no" integer NOT NULL, "tax_code" character varying(50) NOT NULL, "is_tax_exempted" character varying(1) NOT NULL DEFAULT 'N', "tax_exemption_type" character varying(50), "tax_exemption_reference" character varying(100), "tax_rate" numeric(18,10) NOT NULL, "tax_amount" numeric(20,4) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f35c9d9a35c28560d2bf04f9542" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_qeat_addon_sequence" ON "quotation_entry_addon_taxes" ("addon_id", "sequence_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qeat_addon_id" ON "quotation_entry_addon_taxes" ("addon_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_entry_addons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entry_id" uuid NOT NULL, "sequence_no" integer NOT NULL, "addon_reference" character varying(100) NOT NULL, "addon_desc" character varying(500) NOT NULL, "addon_amount" numeric(20,4) NOT NULL, "addon_premium_rate" numeric(18,10) NOT NULL, "premium_excluding_tax" numeric(20,4) NOT NULL, "premium_excluding_tax_equivalent" numeric(20,4) NOT NULL, "premium_including_tax" numeric(20,4) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cb4ff97fc97d258712cd30ce836" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qea_reference" ON "quotation_entry_addons" ("addon_reference") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qea_entry_id" ON "quotation_entry_addons" ("entry_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_qea_entry_sequence" ON "quotation_entry_addons" ("entry_id", "sequence_no") `,
    );
    await queryRunner.query(
      `CREATE TABLE "insurance_risks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_id" uuid NOT NULL, "sub_class_id" uuid, "risk_code" character varying(50) NOT NULL, "risk_name" character varying(600) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "lifecycle_status" character varying(30) NOT NULL DEFAULT 'ACTIVE', "tiramis_risk_code" character varying(50), "code_locked_at" TIMESTAMP WITH TIME ZONE, "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_insurance_risks_company_product_name" UNIQUE ("company_id", "product_id", "risk_name"), CONSTRAINT "UQ_insurance_risks_company_code" UNIQUE ("company_id", "risk_code"), CONSTRAINT "PK_b8dacfa9cb9ce1c47583953fc22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_risks_is_active" ON "insurance_risks" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_risks_sub_class_id" ON "insurance_risks" ("sub_class_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_risks_product_id" ON "insurance_risks" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_risks_company_id" ON "insurance_risks" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_risk_discounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "risk_id" uuid NOT NULL, "sequence_no" integer NOT NULL, "discount_type" smallint NOT NULL, "discount_rate" numeric(18,10) NOT NULL, "discount_amount" numeric(20,4) NOT NULL, "request_reason_code" character varying(50), "request_comment" character varying(500), "effective_from" date, "effective_to" date, "requested_by" character varying(100), "requested_at" TIMESTAMP WITH TIME ZONE, "max_permitted_rate" numeric(18,10), "max_permitted_amount" numeric(20,4), "approval_required" boolean NOT NULL DEFAULT false, "approval_status" character varying(20) NOT NULL DEFAULT 'NOT_REQUIRED', "approved_rate" numeric(18,10), "approved_amount" numeric(20,4), "approved_by" character varying(100), "approval_date" TIMESTAMP WITH TIME ZONE, "rejection_reason" character varying(500), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a37be711ef678138bd67aa72e8c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_qrd_risk_sequence" ON "quotation_risk_discounts" ("risk_id", "sequence_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qrd_risk_id" ON "quotation_risk_discounts" ("risk_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_risk_premium_overrides" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "risk_id" uuid NOT NULL, "sequence_no" integer NOT NULL, "original_calculated_premium" numeric(20,4) NOT NULL, "proposed_premium" numeric(20,4) NOT NULL, "difference_amount" numeric(20,4) NOT NULL, "difference_percentage" numeric(18,10), "override_reason" character varying(150) NOT NULL, "supporting_notes" text, "requested_by" uuid, "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL, "approval_status" character varying(20) NOT NULL DEFAULT 'PENDING', "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8da4259ad354e340e3da11e8008" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_qrpo_risk_sequence" ON "quotation_risk_premium_overrides" ("risk_id", "sequence_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qrpo_risk_id" ON "quotation_risk_premium_overrides" ("risk_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_risk_taxes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "risk_id" uuid NOT NULL, "sequence_no" integer NOT NULL, "tax_code" character varying(50) NOT NULL, "is_tax_exempted" character varying(1) NOT NULL DEFAULT 'N', "tax_exemption_type" character varying(50), "tax_exemption_reference" character varying(100), "tax_rate" numeric(18,10) NOT NULL, "tax_amount" numeric(20,4) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_53b399eb47aed462d167931ac2d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_qrt_risk_sequence" ON "quotation_risk_taxes" ("risk_id", "sequence_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qrt_risk_id" ON "quotation_risk_taxes" ("risk_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_entry_risks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entry_id" uuid NOT NULL, "insurance_risk_id" uuid, "sequence_no" integer NOT NULL, "risk_code" character varying(50) NOT NULL, "pricing_quote_id" character varying(30), "pricing_result_hash" character varying(64), "pricing_snapshot" jsonb, "sum_insured" numeric(20,4) NOT NULL, "sum_insured_equivalent" numeric(20,4) NOT NULL, "premium_rate" numeric(18,10) NOT NULL, "premium_before_discount" numeric(20,4) NOT NULL, "premium_after_discount" numeric(20,4) NOT NULL, "premium_excluding_tax_equivalent" numeric(20,4) NOT NULL, "premium_including_tax" numeric(20,4) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e367077d13b212642f897ae2ad1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qer_insurance_risk_id" ON "quotation_entry_risks" ("insurance_risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qer_risk_code" ON "quotation_entry_risks" ("risk_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qer_entry_id" ON "quotation_entry_risks" ("entry_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_qer_entry_sequence" ON "quotation_entry_risks" ("entry_id", "sequence_no") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_motor_details" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entry_id" uuid NOT NULL, "motor_category" smallint NOT NULL, "motor_type" smallint NOT NULL, "registration_number" character varying(50) NOT NULL, "chassis_number" character varying(100) NOT NULL, "make" character varying(100) NOT NULL, "model" character varying(100) NOT NULL, "model_number" character varying(100), "body_type" character varying(100) NOT NULL, "color" character varying(50) NOT NULL, "engine_number" character varying(100) NOT NULL, "engine_capacity" character varying(50) NOT NULL, "fuel_used" character varying(50) NOT NULL, "number_of_axles" smallint NOT NULL, "axle_distance" numeric(10,2) NOT NULL, "sitting_capacity" smallint NOT NULL, "year_of_manufacture" smallint NOT NULL, "tare_weight" numeric(12,2) NOT NULL, "gross_weight" numeric(12,2) NOT NULL, "motor_usage" smallint NOT NULL, "owner_name" character varying(200) NOT NULL, "owner_category" smallint NOT NULL, "owner_address" character varying(300) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_37cffb80ef7baad58b32e41946" UNIQUE ("entry_id"), CONSTRAINT "PK_2d1baa50db0c5307247aae17b60" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qmd_engine_number" ON "quotation_motor_details" ("engine_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qmd_chassis_number" ON "quotation_motor_details" ("chassis_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qmd_registration_number" ON "quotation_motor_details" ("registration_number") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_qmd_entry_id" ON "quotation_motor_details" ("entry_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_subject_matters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entry_id" uuid NOT NULL, "sequence_no" integer NOT NULL, "subject_matter_reference" character varying(100) NOT NULL, "subject_matter_desc" character varying(500) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2909412a0cc865b3e7cfd82046b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qsm_reference" ON "quotation_subject_matters" ("subject_matter_reference") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qsm_entry_id" ON "quotation_subject_matters" ("entry_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_qsm_entry_sequence" ON "quotation_subject_matters" ("entry_id", "sequence_no") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quotation_entry_type_enum" AS ENUM('STANDARD', 'FLEET_ITEM')`,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_cover_note_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cover_note_id" uuid NOT NULL, "entry_type" "public"."quotation_entry_type_enum" NOT NULL, "entry_number" integer NOT NULL, "fleet_entry" integer, "cover_note_number" character varying(100) NOT NULL, "prev_cover_note_reference_number" character varying(100), "cover_note_desc" character varying(500) NOT NULL, "operative_clause" character varying(500) NOT NULL, "endorsement_type" smallint, "endorsement_reason" character varying(500), "endorsement_premium_earned" numeric(18,2), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_182c83df7faef00aca2f51f53e0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qcne_cover_note_id" ON "quotation_cover_note_entries" ("cover_note_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_qcne_cover_note_number" ON "quotation_cover_note_entries" ("cover_note_number") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_qcne_cover_note_entry_number" ON "quotation_cover_note_entries" ("cover_note_id", "entry_number") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_cover_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quotation_id" uuid NOT NULL, "cover_note_type" smallint NOT NULL, "sale_point_code" character varying(50) NOT NULL, "cover_note_start_date" TIMESTAMP WITH TIME ZONE NOT NULL, "cover_note_end_date" TIMESTAMP WITH TIME ZONE NOT NULL, "payment_mode" smallint NOT NULL, "currency_code" character varying(10) NOT NULL, "exchange_rate" numeric(18,10) NOT NULL DEFAULT '1', "exchange_rate_snapshot" jsonb, "total_premium_excluding_tax" numeric(20,4) NOT NULL DEFAULT '0', "total_premium_including_tax" numeric(20,4) NOT NULL DEFAULT '0', "commission_paid" numeric(20,4) NOT NULL DEFAULT '0', "commission_rate" numeric(18,10) NOT NULL DEFAULT '0', "officer_name" character varying(150) NOT NULL, "officer_title" character varying(150) NOT NULL, "product_code" character varying(50) NOT NULL, "fleet_id" character varying(100), "fleet_type" smallint, "fleet_size" integer, "comprehensive_insured" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_678dc3f2c5872c18981f8e6ad0" UNIQUE ("quotation_id"), CONSTRAINT "PK_86103d8ea727146a36b4b52e6a3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qcn_dates" ON "quotation_cover_notes" ("cover_note_start_date", "cover_note_end_date") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quotation_cover_notes_fleet_id" ON "quotation_cover_notes" ("fleet_id") WHERE fleet_id IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quotation_cover_notes_quotation_id" ON "quotation_cover_notes" ("quotation_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_policy_holders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quotation_id" uuid NOT NULL, "customer_id" uuid, "sequence_no" integer NOT NULL, "policy_holder_name" character varying(200) NOT NULL, "policy_holder_birth_date" date NOT NULL, "policy_holder_type" smallint NOT NULL, "policy_holder_id_number" character varying(100) NOT NULL, "policy_holder_id_type" smallint NOT NULL, "gender" character varying(1), "country_code" character varying(3) NOT NULL, "region" character varying(100) NOT NULL, "district" character varying(100) NOT NULL, "street" character varying(100), "policy_holder_phone_number" character varying(30) NOT NULL, "policy_holder_fax" character varying(30), "postal_address" character varying(250), "email_address" character varying(150), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_714ede6643b47134dc5007f2d52" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qph_identity" ON "quotation_policy_holders" ("policy_holder_id_type", "policy_holder_id_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qph_customer_id" ON "quotation_policy_holders" ("customer_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_qph_quotation_sequence" ON "quotation_policy_holders" ("quotation_id", "sequence_no") `,
    );
    await queryRunner.query(
      `CREATE TABLE "quotation_risk_assets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quotation_id" uuid NOT NULL, "quotation_risk_id" uuid NOT NULL, "insured_asset_id" uuid NOT NULL, "asset_type" character varying(40) NOT NULL, "asset_snapshot" jsonb NOT NULL, "asset_snapshot_hash" character varying(64) NOT NULL, "asset_snapshot_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_33a03d7c87447626fe0214cb93a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_quotation_risk_assets_risk" ON "quotation_risk_assets" ("quotation_risk_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quotation_type_enum" AS ENUM('MOTOR', 'NON_MOTOR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quotation_flow_enum" AS ENUM('NON_MOTOR', 'MOTOR_SINGLE', 'MOTOR_FLEET')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quotation_channel_type_enum" AS ENUM('DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API')`,
    );
    await queryRunner.query(
      `CREATE TABLE "quotations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "branch_id" uuid, "department_id" uuid, "created_by" uuid, "updated_by" uuid, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "customer_id" uuid, "category_id" uuid NOT NULL, "product_id" uuid NOT NULL, "sub_class_id" uuid, "product_version_id" uuid, "product_definition_hash" character varying(64), "product_definition_snapshot" jsonb, "quotation_no" character varying(30) NOT NULL, "quotation_type" "public"."quotation_type_enum" NOT NULL, "quotation_flow" "public"."quotation_flow_enum" NOT NULL DEFAULT 'NON_MOTOR', "is_fleet" boolean NOT NULL DEFAULT false, "channel_type" "public"."quotation_channel_type_enum" NOT NULL, "quotation_status" character varying(30) NOT NULL DEFAULT 'DRAFT', "requires_approval" boolean NOT NULL DEFAULT false, "requires_payment" boolean NOT NULL DEFAULT false, "quotation_stage" character varying(40) NOT NULL DEFAULT 'DRAFT', "approval_status_v2" character varying(40) NOT NULL DEFAULT 'NOT_REQUIRED', "payment_status_v2" character varying(40) NOT NULL DEFAULT 'NOT_REQUIRED', "submission_status_v2" character varying(40) NOT NULL DEFAULT 'NOT_READY', "workflow_revision" integer NOT NULL DEFAULT '1', "state_version" integer NOT NULL DEFAULT '1', "finalization_snapshot" jsonb, "customer_snapshot" jsonb, "customer_snapshot_hash" character varying(64), "customer_kyc_version" integer, "customer_snapshot_at" TIMESTAMP WITH TIME ZONE, "finalization_hash" character varying(64), "workflow_gate_hash" character varying(64), "workflow_completed_at" TIMESTAMP WITH TIME ZONE, "approval_status" character varying(30) NOT NULL DEFAULT 'NOT_REQUIRED', "payment_status" character varying(30) NOT NULL DEFAULT 'NOT_REQUIRED', "tira_status" character varying(30) NOT NULL DEFAULT 'NOT_SUBMITTED', "approval_submitted_by" uuid, "approval_submitted_at" TIMESTAMP WITH TIME ZONE, "approval_decided_by" uuid, "approval_decided_at" TIMESTAMP WITH TIME ZONE, "approval_comments" text, "approval_reason" text, "payment_request_reference" character varying(100), "payment_requested_at" TIMESTAMP WITH TIME ZONE, "payment_completed_at" TIMESTAMP WITH TIME ZONE, "payment_failure_reason" text, "tira_request_id" character varying(100), "tira_response_id" character varying(100), "tira_response_code" character varying(50), "tira_response_description" character varying(255), "tira_error_details" jsonb, "rejection_reason" text, "cancellation_reason" text, "current_wizard_step" character varying(50), "draft_payload" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6c00eb8ba181f28c21ffba7ecb1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_quotations_company_quotation_no" ON "quotations" ("company_id", "quotation_no") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_workflow_gate_hash" ON "quotations" ("workflow_gate_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_finalization_hash" ON "quotations" ("finalization_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_flow" ON "quotations" ("company_id", "quotation_flow") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_product_id" ON "quotations" ("company_id", "product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_customer_id" ON "quotations" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_submission_status_v2" ON "quotations" ("company_id", "submission_status_v2") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_payment_status_v2" ON "quotations" ("company_id", "payment_status_v2") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_approval_status_v2" ON "quotations" ("company_id", "approval_status_v2") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_stage_v2" ON "quotations" ("company_id", "quotation_stage") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_tira_status" ON "quotations" ("company_id", "tira_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_payment_status" ON "quotations" ("company_id", "payment_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_approval_status" ON "quotations" ("company_id", "approval_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_status" ON "quotations" ("company_id", "quotation_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotations_company_id" ON "quotations" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "cover_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "branch_id" uuid, "sale_point_id" uuid, "customer_id" uuid NOT NULL, "quotation_id" uuid NOT NULL, "quotation_entry_id" uuid NOT NULL, "policy_id" uuid, "insured_asset_id" uuid, "tiramis_tracking_id" uuid NOT NULL, "tiramis_transaction_id" character varying(100) NOT NULL, "tiramis_request_id" character varying(100) NOT NULL, "response_id" character varying(100), "cover_note_number" character varying(100) NOT NULL, "cover_note_reference_number" character varying(100), "sticker_number" character varying(100), "entry_type" character varying(40) NOT NULL, "fleet_entry" integer, "status" character varying(40) NOT NULL DEFAULT 'PENDING_SUBMISSION', "regulatory_sync_status" character varying(40) NOT NULL DEFAULT 'PENDING', "product_id" uuid NOT NULL, "product_version_id" uuid, "product_code" character varying(50) NOT NULL, "product_definition_hash" character varying(64), "customer_snapshot" jsonb NOT NULL, "customer_snapshot_hash" character varying(64) NOT NULL, "asset_snapshot" jsonb NOT NULL, "asset_snapshot_hash" character varying(64) NOT NULL, "pricing_snapshot" jsonb NOT NULL, "pricing_result_hash" character varying(64) NOT NULL, "distribution_snapshot" jsonb, "distribution_snapshot_hash" character varying(64), "start_date" date NOT NULL, "end_date" date NOT NULL, "currency_code" character varying(3) NOT NULL, "sum_insured" numeric(20,4) NOT NULL DEFAULT '0', "premium_excluding_tax" numeric(20,4) NOT NULL DEFAULT '0', "premium_including_tax" numeric(20,4) NOT NULL DEFAULT '0', "commission_amount" numeric(20,4) NOT NULL DEFAULT '0', "commission_rate" numeric(18,10) NOT NULL DEFAULT '0', "final_response_status_code" character varying(30), "final_response_status_desc" text, "final_response_payload" jsonb, "final_response_payload_hash" character varying(64), "signature_verified" boolean NOT NULL DEFAULT false, "issued_at" TIMESTAMP WITH TIME ZONE, "rejected_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_c5e98c9304a18fde2f74bec3244" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cover_note_customer" ON "cover_notes" ("company_id", "customer_id", "status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_cover_note_regulatory_reference" ON "cover_notes" ("insurer_company_id", "cover_note_reference_number") WHERE cover_note_reference_number IS NOT NULL AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_cover_note_quotation_entry" ON "cover_notes" ("quotation_entry_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_cover_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "policy_id" uuid NOT NULL, "cover_note_id" uuid NOT NULL, "sequence_number" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_policy_cover_note_sequence" UNIQUE ("policy_id", "sequence_number"), CONSTRAINT "UQ_policy_cover_note" UNIQUE ("policy_id", "cover_note_id"), CONSTRAINT "PK_06fa902f1f1a2a283e44de08579" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "rating_factors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "code" character varying(100) NOT NULL, "name" character varying(150) NOT NULL, "data_type" character varying NOT NULL DEFAULT 'NUMBER', "unit" character varying, "options" text, "default_value" character varying(255), "is_required" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "validation_rules" jsonb, "is_system" boolean NOT NULL DEFAULT false, "code_locked_at" TIMESTAMP WITH TIME ZONE, "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_rating_factors_company_name" UNIQUE ("company_id", "name"), CONSTRAINT "UQ_rating_factors_company_code" UNIQUE ("company_id", "code"), CONSTRAINT "PK_43ec32f6253a45bf42ecb05a026" PRIMARY KEY ("id")); COMMENT ON COLUMN "rating_factors"."options" IS 'Available options for SELECT/MULTI_SELECT types'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rating_factors_is_active" ON "rating_factors" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rating_factors_company_id" ON "rating_factors" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "subject_matter_factor_values" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subject_matter_id" uuid NOT NULL, "factor_id" uuid NOT NULL, "value_text" text, "value_number" numeric(18,6), "value_date" date, "value_boolean" boolean, "value_json" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_aa8e0eced8d509e48e214fa13e3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_smfv_factor_id" ON "subject_matter_factor_values" ("factor_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_smfv_subject_matter_id" ON "subject_matter_factor_values" ("subject_matter_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "subject_matters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "owner_customer_id" uuid, "insured_asset_id" uuid, "subject_type" character varying(100), "subject_category" character varying(100), "subject_code" character varying(100) NOT NULL, "description" text, "location" text, "country" character varying(100), "country_code" character varying(3), "region" character varying(100), "district" character varying(100), "ward" character varying(100), "latitude" numeric(10,6), "longitude" numeric(10,6), "value" numeric(18,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "snapshot_version" integer NOT NULL DEFAULT '1', "metadata" jsonb, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_82f9f3ba7a60d6b51e715bc0838" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_subject_matters_company_subject_code" ON "subject_matters" ("company_id", "subject_code") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_subject_matters_company_customer_id" ON "subject_matters" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_subject_matters_company_id" ON "subject_matters" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_risks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policy_id" uuid NOT NULL, "quotation_entry_risk_id" uuid, "risk_id" uuid NOT NULL, "subject_matter_id" uuid, "motor_vehicle_id" uuid, "sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "rate" numeric(18,6) NOT NULL DEFAULT '0', "basic_premium" numeric(18,2) NOT NULL DEFAULT '0', "discount_amount" numeric(18,2) NOT NULL DEFAULT '0', "tax_amount" numeric(18,2) NOT NULL DEFAULT '0', "charges_amount" numeric(18,2) NOT NULL DEFAULT '0', "commission_amount" numeric(18,2) NOT NULL DEFAULT '0', "total_premium" numeric(18,2) NOT NULL DEFAULT '0', "net_premium" numeric(18,2) NOT NULL DEFAULT '0', "reinsurance_required" boolean NOT NULL DEFAULT false, "retention_amount" numeric(18,2) NOT NULL DEFAULT '0', "ceded_sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "ceded_premium" numeric(18,2) NOT NULL DEFAULT '0', "reinsurance_status" character varying(20) NOT NULL DEFAULT 'NOT_REQUIRED', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e97e5de2938bd7a642de8b1059f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_risks_risk_id" ON "policy_risks" ("risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_risks_policy_id" ON "policy_risks" ("policy_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."policy_premium_item_type_enum" AS ENUM('BASIC_PREMIUM', 'DISCOUNT', 'TAX', 'LEVY', 'CHARGE', 'COMMISSION', 'FEE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."policy_calculation_base_enum" AS ENUM('BASIC_PREMIUM', 'NET_PREMIUM', 'GROSS_PREMIUM')`,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_premium_breakdowns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policy_id" uuid NOT NULL, "policy_risk_id" uuid, "item_type" "public"."policy_premium_item_type_enum" NOT NULL, "item_code" character varying(50) NOT NULL, "item_name" character varying(150) NOT NULL, "rate" numeric(18,6) NOT NULL DEFAULT '0', "amount" numeric(18,2) NOT NULL DEFAULT '0', "calculation_base" "public"."policy_calculation_base_enum" NOT NULL DEFAULT 'BASIC_PREMIUM', "calculation_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_493d761c9550899224a48dc997f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ppb_policy_risk_id" ON "policy_premium_breakdowns" ("policy_risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ppb_policy_id" ON "policy_premium_breakdowns" ("policy_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policy_id" uuid NOT NULL, "old_status" character varying(20) NOT NULL, "new_status" character varying(20) NOT NULL, "reason" text, "changed_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_fd3cc5ad5a97d4fca1d972b0119" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_psh_policy_id" ON "policy_status_history" ("policy_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_transaction_changes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "policy_transaction_id" uuid NOT NULL, "category" character varying(50) NOT NULL, "operation" character varying(20) NOT NULL, "field_path" character varying(300) NOT NULL, "resource_id" uuid, "old_value" jsonb, "new_value" jsonb, "is_material" boolean NOT NULL DEFAULT true, "requires_repricing" boolean NOT NULL DEFAULT false, "requires_regulatory_submission" boolean NOT NULL DEFAULT true, "change_hash" character varying(64) NOT NULL, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6500368b41624ea9104489f7810" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_transaction_changes_transaction" ON "policy_transaction_changes" ("policy_transaction_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_transaction_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "policy_transaction_id" uuid NOT NULL, "event_type" character varying(100) NOT NULL, "actor_type" character varying(30) NOT NULL DEFAULT 'SYSTEM', "actor_id" character varying(100), "from_stage" character varying(40), "to_stage" character varying(40), "reason" text, "metadata" jsonb, "source_event_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_policy_transaction_source_event" UNIQUE ("source_event_id", "event_type"), CONSTRAINT "PK_5c65933b15e987971124b4c8dcc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_transaction_events_transaction" ON "policy_transaction_events" ("policy_transaction_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "transaction_no" character varying(80) NOT NULL, "transaction_type" character varying(30) NOT NULL, "stage" character varying(40) NOT NULL DEFAULT 'DRAFT', "approval_status" character varying(40) NOT NULL DEFAULT 'NOT_EVALUATED', "payment_status" character varying(40) NOT NULL DEFAULT 'NOT_EVALUATED', "submission_status" character varying(40) NOT NULL DEFAULT 'NOT_READY', "source_policy_id" uuid NOT NULL, "source_policy_version_id" uuid NOT NULL, "source_policy_version_no" integer NOT NULL, "source_policy_snapshot" jsonb NOT NULL, "source_policy_snapshot_hash" character varying(64) NOT NULL, "effective_date" date NOT NULL, "reason" text NOT NULL, "requested_by" uuid NOT NULL, "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completed_by" uuid, "completed_at" TIMESTAMP WITH TIME ZONE, "approval_required" boolean NOT NULL DEFAULT false, "payment_required" boolean NOT NULL DEFAULT false, "premium_effect" character varying(20) NOT NULL DEFAULT 'NONE', "additional_premium" numeric(20,4) NOT NULL DEFAULT '0', "return_premium" numeric(20,4) NOT NULL DEFAULT '0', "net_premium_difference" numeric(20,4) NOT NULL DEFAULT '0', "tax_difference" numeric(20,4) NOT NULL DEFAULT '0', "commission_difference" numeric(20,4) NOT NULL DEFAULT '0', "currency_code" character varying(3) NOT NULL, "pricing_snapshot" jsonb, "pricing_snapshot_hash" character varying(64), "proposed_policy_snapshot" jsonb, "proposed_policy_snapshot_hash" character varying(64), "active_approval_request_id" uuid, "active_invoice_id" uuid, "active_refund_id" uuid, "tiramis_tracking_id" uuid, "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "regulatory_response" jsonb, "regulatory_response_hash" character varying(64), "target_policy_id" uuid, "target_policy_version_id" uuid, "state_version" integer NOT NULL DEFAULT '1', "idempotency_key" character varying(180), "last_command" character varying(80), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cancelled_by" uuid, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancellation_reason" text, CONSTRAINT "UQ_policy_transaction_idempotency" UNIQUE ("company_id", "idempotency_key"), CONSTRAINT "UQ_policy_transaction_no" UNIQUE ("company_id", "transaction_no"), CONSTRAINT "PK_ba766c9faa6db6a5b59d146e21b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_transactions_company_type_stage" ON "policy_transactions" ("company_id", "transaction_type", "stage") `,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "policy_id" uuid NOT NULL, "version_number" integer NOT NULL, "version_type" character varying(30) NOT NULL DEFAULT 'NEW_BUSINESS', "status" character varying(30) NOT NULL, "effective_from" date NOT NULL, "effective_to" date NOT NULL, "policy_snapshot" jsonb NOT NULL, "policy_snapshot_hash" character varying(64) NOT NULL, "pricing_snapshot" jsonb NOT NULL, "pricing_result_hash" character varying(64) NOT NULL, "customer_snapshot" jsonb NOT NULL, "customer_snapshot_hash" character varying(64) NOT NULL, "asset_manifest" jsonb NOT NULL, "asset_manifest_hash" character varying(64) NOT NULL, "tiramis_tracking_id" uuid, "policy_transaction_id" uuid, "supersedes_version_id" uuid, "superseded_at" TIMESTAMP WITH TIME ZONE, "is_current" boolean NOT NULL DEFAULT false, "regulatory_reference" character varying(100), "effective_transaction_date" date, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_policy_version" UNIQUE ("policy_id", "version_number"), CONSTRAINT "PK_125d2970fc66a316f84af16812e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."policy_channel_type_enum" AS ENUM('DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API')`,
    );
    await queryRunner.query(
      `CREATE TABLE "policies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "branch_id" uuid, "department_id" uuid, "created_by" uuid, "customer_id" uuid NOT NULL, "quotation_id" uuid, "source_quotation_revision" integer, "source_finalization_hash" character varying(64), "proposal_id" uuid, "category_id" uuid NOT NULL, "product_id" uuid NOT NULL, "product_version_id" uuid, "product_definition_hash" character varying(64), "sub_class_id" uuid, "policy_no" character varying(50) NOT NULL, "cover_note_no" character varying(50), "external_policy_no" character varying(50), "channel_type" "public"."policy_channel_type_enum" NOT NULL, "policy_status" character varying(20) NOT NULL DEFAULT 'DRAFT', "policy_reference_number" character varying(100), "regulatory_sync_status" character varying(40) NOT NULL DEFAULT 'PENDING', "source_cover_note_count" integer NOT NULL DEFAULT '0', "issued_by_system" boolean NOT NULL DEFAULT false, "start_date" date NOT NULL, "end_date" date NOT NULL, "issue_date" date NOT NULL, "activated_at" TIMESTAMP WITH TIME ZONE, "rejected_at" TIMESTAMP WITH TIME ZONE, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "customer_snapshot" jsonb, "customer_snapshot_hash" character varying(64), "pricing_snapshot" jsonb, "pricing_result_hash" character varying(64), "distribution_snapshot" jsonb, "distribution_snapshot_hash" character varying(64), "sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "basic_premium" numeric(18,2) NOT NULL DEFAULT '0', "total_discount" numeric(18,2) NOT NULL DEFAULT '0', "total_tax" numeric(18,2) NOT NULL DEFAULT '0', "total_charges" numeric(18,2) NOT NULL DEFAULT '0', "total_commission" numeric(18,2) NOT NULL DEFAULT '0', "total_premium" numeric(18,2) NOT NULL DEFAULT '0', "net_premium" numeric(18,2) NOT NULL DEFAULT '0', "reinsurance_required" boolean NOT NULL DEFAULT false, "reinsurance_status" character varying(20) NOT NULL DEFAULT 'NOT_REQUIRED', "retention_amount" numeric(18,2) NOT NULL DEFAULT '0', "ceded_sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "ceded_premium" numeric(18,2) NOT NULL DEFAULT '0', "tira_status" character varying(20) NOT NULL DEFAULT 'PENDING', "tira_portal_transaction_id" character varying(100), "tiramis_transaction_id" character varying(100), "tiramis_submission_tracking_id" uuid, "current_version_no" integer NOT NULL DEFAULT '1', "renewed_from_policy_id" uuid, "renewed_to_policy_id" uuid, "active_version_id" uuid, "pending_transaction_id" uuid, "last_endorsement_date" date, "cancellation_effective_date" date, "renewal_status" character varying(40) NOT NULL DEFAULT 'NOT_STARTED', "tiramis_status" character varying(50), "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "tiramis_payload" jsonb, "regulatory_response_payload" jsonb, "regulatory_response_hash" character varying(64), "state_version" integer NOT NULL DEFAULT '1', "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_603e09f183df0108d8695c57e28" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_policies_issued_quotation_revision" ON "policies" ("company_id", "quotation_id", "source_quotation_revision") WHERE quotation_id IS NOT NULL AND source_quotation_revision IS NOT NULL AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_policies_company_policy_no" ON "policies" ("company_id", "policy_no") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policies_company_product_id" ON "policies" ("company_id", "product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policies_company_customer_id" ON "policies" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policies_company_status" ON "policies" ("company_id", "policy_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policies_company_id" ON "policies" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tiramis_business_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "department_id" uuid, "created_by" uuid, "source_module" character varying(80) NOT NULL, "request_type" character varying(80) NOT NULL, "business_reference" character varying(150) NOT NULL, "policy_id" uuid, "customer_id" uuid, "motor_vehicle_id" uuid, "status" character varying(40) NOT NULL DEFAULT 'DRAFT', "payload" jsonb NOT NULL DEFAULT '{}', "metadata" jsonb, "tiramis_submission_tracking_id" uuid, "tiramis_status" character varying(50), "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_cde4fbd4dc2874a8b583f625d4a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_business_records_status" ON "tiramis_business_records" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_business_records_reference" ON "tiramis_business_records" ("business_reference") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_business_records_source" ON "tiramis_business_records" ("source_module", "request_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_business_records_company" ON "tiramis_business_records" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tiramis_audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying(100) NOT NULL, "correlation_id" character varying(150), "event_key" character varying(180), "severity" character varying(30) NOT NULL DEFAULT 'INFO', "request_type" character varying(80), "source_service" character varying(100) NOT NULL DEFAULT 'insurance-portal-service', "source_company_id" uuid, "source_user_id" uuid, "actor_user_type" character varying(50), "actor_email" character varying(150), "source_module" character varying(100), "source_record_id" character varying(150), "business_reference" character varying(150), "local_tracking_id" uuid, "tiramis_transaction_id" uuid, "tiramis_request_id" character varying(100), "status_before" character varying(80), "status_after" character varying(80), "success" boolean NOT NULL DEFAULT true, "error_message" text, "ip_address" character varying(100), "user_agent" text, "http_method" character varying(20), "endpoint" character varying(255), "duration_ms" integer, "metadata" jsonb, "request_payload_snapshot" jsonb, "response_payload_snapshot" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ec77462b3a1f09c735c76a4b3b1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9aff4afbd1d6e01a227ecbe464" ON "tiramis_audit_logs" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5b91c967178cb6aef40f987c1b" ON "tiramis_audit_logs" ("local_tracking_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e92727e34143e69e71c53ee36f" ON "tiramis_audit_logs" ("business_reference") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_79e96c137a1e1c40d4b9866ee6" ON "tiramis_audit_logs" ("source_record_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f0048839860255c7aaf6694ee8" ON "tiramis_audit_logs" ("source_module") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9aa1bdb26a6e0dcb6051d234d9" ON "tiramis_audit_logs" ("source_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7d5dcd533ef38bd3bdb3c062d8" ON "tiramis_audit_logs" ("source_company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e55f92a76dad312ad399f6947f" ON "tiramis_audit_logs" ("request_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_804c9d19bef1fa5df45047acfc" ON "tiramis_audit_logs" ("action") `,
    );
    await queryRunner.query(
      `CREATE TABLE "work_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "work_item_no" character varying(100), "branch_id" uuid, "domain" character varying(50) NOT NULL, "resource_type" character varying(80) NOT NULL, "resource_id" uuid NOT NULL, "work_item_type" character varying(80), "assignment_type" character varying(20) NOT NULL DEFAULT 'USER', "assigned_team" character varying(100), "queue_code" character varying(100), "source_module" character varying(80), "source_record_id" uuid, "source_record_version" integer, "idempotency_key" character varying(180), "title" character varying(180) NOT NULL, "description" text, "priority" character varying(20) NOT NULL DEFAULT 'MEDIUM', "status" character varying(20) NOT NULL DEFAULT 'OPEN', "sla_status" character varying(30) NOT NULL DEFAULT 'ON_TRACK', "assigned_user_id" uuid, "assigned_role" character varying(100), "deep_link" character varying(255), "due_at" TIMESTAMP WITH TIME ZONE, "dedupe_key" character varying(180), "metadata" jsonb, "created_by" uuid, "claimed_at" TIMESTAMP WITH TIME ZONE, "started_at" TIMESTAMP WITH TIME ZONE, "completed_by" uuid, "completed_at" TIMESTAMP WITH TIME ZONE, "cancelled_by" uuid, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancellation_reason" text, "delegated_by" uuid, "delegated_at" TIMESTAMP WITH TIME ZONE, "warning_sent_at" TIMESTAMP WITH TIME ZONE, "escalated_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_afbfa01728533c866eafaf6f160" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_work_items_company_status" ON "work_items" ("company_id", "status", "due_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "work_item_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "work_item_id" uuid NOT NULL, "event_type" character varying(30) NOT NULL, "actor_id" uuid, "actor_type" character varying(30) NOT NULL DEFAULT 'USER', "comment" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fefa3ff72ea36f6ed7e325a1965" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tenant_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "notification_no" character varying(100), "branch_id" uuid, "recipient_user_id" uuid, "recipient_role" character varying(100), "type" character varying(50) NOT NULL, "channel" character varying(20) NOT NULL DEFAULT 'IN_APP', "priority" character varying(20) NOT NULL DEFAULT 'NORMAL', "severity" character varying(20) NOT NULL DEFAULT 'INFO', "status" character varying(30) NOT NULL DEFAULT 'CREATED', "title" character varying(180) NOT NULL, "message" text NOT NULL, "resource_type" character varying(80), "resource_id" uuid, "action_url" character varying(255), "deep_link" character varying(255), "idempotency_key" character varying(180), "metadata" jsonb, "read_at" TIMESTAMP WITH TIME ZONE, "dismissed_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_af51a126a42071668e0f9374b23" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tenant_notification_user" ON "tenant_notifications" ("company_id", "recipient_user_id", "read_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_preferences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "user_id" uuid NOT NULL, "event_code" character varying(120) NOT NULL, "channel" character varying(20) NOT NULL, "mode" character varying(20) NOT NULL DEFAULT 'INHERIT', "quiet_hours_from" character varying(5), "quiet_hours_to" character varying(5), "marketing_consent" boolean NOT NULL DEFAULT false, "transactional_required" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "portal_tira_submission_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_id" uuid NOT NULL, "company_id" uuid NOT NULL, "tiramis_transaction_id" character varying(100), "request_id" character varying(100) NOT NULL, "response_id" character varying(100), "event_type" character varying(100) NOT NULL, "status_code" character varying(50), "status_description" character varying(255), "error_message" text, "payload" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ffff990a5b7e6b6acf71a019ea3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptse_created_at" ON "portal_tira_submission_events" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptse_event_type" ON "portal_tira_submission_events" ("event_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptse_request_id" ON "portal_tira_submission_events" ("request_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptse_submission_id" ON "portal_tira_submission_events" ("submission_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."portal_tira_submission_status_enum" AS ENUM('DRAFT', 'VALIDATED', 'SUBMITTED_TO_TIRAMIS', 'SENT_TO_TIRA', 'ACK_SUCCESS', 'ACK_FAILED', 'WAITING_FINAL_RESPONSE', 'FINAL_SUCCESS', 'FINAL_FAILED', 'FINAL_CALLBACK_OVERDUE', 'COMPLETED', 'FAILED', 'CALLBACK_REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "portal_tira_submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "policy_id" uuid, "quotation_id" uuid, "source_module" character varying(80), "source_record_id" character varying(100), "business_reference" character varying(100), "request_type" character varying(50), "service_type" character varying(50), "root_element" character varying(100), "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "tiramis_response_id" character varying(100), "status" "public"."portal_tira_submission_status_enum" NOT NULL DEFAULT 'DRAFT', "status_code" character varying(50), "status_description" character varying(255), "cover_note_reference_number" character varying(100), "policy_reference_number" character varying(100), "sticker_number" character varying(100), "last_error" text, "last_payload" jsonb, "submitted_at" TIMESTAMP WITH TIME ZONE, "last_event_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_2034496dabffacd4572985d81fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_business_reference" ON "portal_tira_submissions" ("business_reference") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_transaction_id" ON "portal_tira_submissions" ("tiramis_transaction_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_request_id" ON "portal_tira_submissions" ("tiramis_request_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_status" ON "portal_tira_submissions" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_quotation_id" ON "portal_tira_submissions" ("quotation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_policy_id" ON "portal_tira_submissions" ("policy_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_company_id" ON "portal_tira_submissions" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "pricing_rate_books" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_id" uuid NOT NULL, "code" character varying(50) NOT NULL, "version" character varying(30) NOT NULL, "name" character varying(150), "currency_code" character varying(10), "status" character varying NOT NULL DEFAULT 'DRAFT', "effective_from" date NOT NULL, "effective_to" date, "product_version_id" uuid, "product_definition_hash" character varying(64), "definition_hash" character varying(64), "calculation_version" character varying(30) NOT NULL DEFAULT '7.1', "rounding_mode" character varying(20) NOT NULL DEFAULT 'HALF_UP', "rounding_increment" numeric(20,4) NOT NULL DEFAULT '1', "proration_method" character varying(30) NOT NULL DEFAULT 'NONE', "metadata" jsonb, "created_by" character varying, "reviewed_by" character varying, "reviewed_at" TIMESTAMP WITH TIME ZONE, "approved_by" character varying, "approved_at" TIMESTAMP WITH TIME ZONE, "published_by" character varying, "published_at" TIMESTAMP WITH TIME ZONE, "updated_by" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_pricing_rate_books_company_code_version" UNIQUE ("company_id", "code", "version"), CONSTRAINT "PK_4876b236ac55a5849340a69d6eb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pricing_rate_books_status" ON "pricing_rate_books" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pricing_rate_books_company_product" ON "pricing_rate_books" ("company_id", "product_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "risk_rating_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "risk_id" uuid NOT NULL, "rate_book_id" uuid, "rule_name" character varying(150) NOT NULL, "rate_type" character varying NOT NULL DEFAULT 'PERCENTAGE', "percentage_rate" numeric(18,10), "fixed_amount" numeric(20,4), "per_unit_amount" numeric(20,4), "per_unit_factor_code" character varying(100), "minimum_amount" numeric(20,4), "maximum_amount" numeric(20,4), "max_discount_rate" numeric(18,10), "max_discount_amount" numeric(20,4), "discount_approval_threshold_rate" numeric(18,10), "discount_approval_threshold_amount" numeric(20,4), "max_loading_rate" numeric(18,10), "max_loading_amount" numeric(20,4), "loading_approval_threshold_rate" numeric(18,10), "loading_approval_threshold_amount" numeric(20,4), "adjustment_effective_from" date, "adjustment_effective_to" date, "formula" text, "priority" integer NOT NULL DEFAULT '1', "rule_version" integer NOT NULL DEFAULT '1', "specificity_score" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_e08043838a735aaec300b1313d0" PRIMARY KEY ("id")); COMMENT ON COLUMN "risk_rating_rules"."percentage_rate" IS 'Rate as a decimal fraction (e.g. 0.035 means 3.5%)'; COMMENT ON COLUMN "risk_rating_rules"."per_unit_factor_code" IS 'Factor code used as unit for per-unit rate types'; COMMENT ON COLUMN "risk_rating_rules"."max_discount_rate" IS 'Maximum aggregate discount rate allowed as a decimal fraction'; COMMENT ON COLUMN "risk_rating_rules"."discount_approval_threshold_rate" IS 'Approval threshold for discount rate as a decimal fraction; requests above this require approval'; COMMENT ON COLUMN "risk_rating_rules"."max_loading_rate" IS 'Maximum aggregate loading rate allowed as a decimal fraction'; COMMENT ON COLUMN "risk_rating_rules"."loading_approval_threshold_rate" IS 'Approval threshold for loading rate as a decimal fraction; requests above this require approval'; COMMENT ON COLUMN "risk_rating_rules"."formula" IS 'Legacy structured shorthand text used only for migration into supported calculator strategies'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_risk_rating_rules_company_risk_book_name" ON "risk_rating_rules" ("company_id", "risk_id", "rate_book_id", "rule_name") WHERE "rate_book_id" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_risk_rating_rules_company_risk_name_legacy" ON "risk_rating_rules" ("company_id", "risk_id", "rule_name") WHERE "rate_book_id" IS NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risk_rating_rules_is_active" ON "risk_rating_rules" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risk_rating_rules_risk_id" ON "risk_rating_rules" ("risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risk_rating_rules_company_id" ON "risk_rating_rules" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "risk_rule_conditions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "rule_id" uuid NOT NULL, "factor_code" character varying(100) NOT NULL, "operator" character varying NOT NULL DEFAULT 'EQUALS', "value_from" character varying(255), "value_to" character varying(255), "logical_operator" character varying NOT NULL DEFAULT 'AND', "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_risk_rule_conditions_rule_factor_op_from_to" UNIQUE ("company_id", "rule_id", "factor_code", "operator", "value_from", "value_to"), CONSTRAINT "PK_6b136f3afbbcb5095ca76d1f39c" PRIMARY KEY ("id")); COMMENT ON COLUMN "risk_rule_conditions"."factor_code" IS 'References RatingFactor.code'; COMMENT ON COLUMN "risk_rule_conditions"."logical_operator" IS 'Logical operator combining this condition with the next'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risk_rule_conditions_rule_id" ON "risk_rule_conditions" ("rule_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risk_rule_conditions_company_id" ON "risk_rule_conditions" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "risk_required_factors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "risk_id" uuid NOT NULL, "factor_id" uuid NOT NULL, "is_required" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "rate_book_id" uuid, "factor_snapshot" jsonb, "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_491a07199b8634c137480ede4de" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risk_required_factors_factor_id" ON "risk_required_factors" ("factor_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risk_required_factors_risk_id" ON "risk_required_factors" ("risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risk_required_factors_company_id" ON "risk_required_factors" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_required_factor_legacy" ON "risk_required_factors" ("company_id", "risk_id", "factor_id") WHERE "rate_book_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_required_factor_rate_book" ON "risk_required_factors" ("company_id", "rate_book_id", "risk_id", "factor_id") WHERE "rate_book_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_schedules_status_enum" AS ENUM('ACTIVE', 'PAUSED', 'DISABLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_schedules_format_enum" AS ENUM('CSV', 'XLSX', 'PDF', 'JSON')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_schedules_delivery_channel_enum" AS ENUM('DOWNLOAD', 'EMAIL', 'SECURE_PORTAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_schedules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "definition_id" uuid NOT NULL, "created_by" uuid, "name" character varying(160) NOT NULL, "status" "public"."report_schedules_status_enum" NOT NULL DEFAULT 'ACTIVE', "cron_expression" character varying(120) NOT NULL, "timezone" character varying(60) NOT NULL DEFAULT 'Africa/Dar_es_Salaam', "format" "public"."report_schedules_format_enum" NOT NULL, "recipient_emails" jsonb NOT NULL DEFAULT '[]', "filters" jsonb, "next_run_at" TIMESTAMP WITH TIME ZONE, "last_run_at" TIMESTAMP WITH TIME ZONE, "last_job_id" uuid, "metadata" jsonb, "report_code" character varying(100), "parameter_payload" jsonb, "parameter_hash" character varying(64), "frequency" character varying(40), "delivery_channel" "public"."report_schedules_delivery_channel_enum" NOT NULL DEFAULT 'DOWNLOAD', "retention_days" integer, "failure_count" integer NOT NULL DEFAULT '0', "last_failure_at" TIMESTAMP WITH TIME ZONE, "last_failure_reason" text, "verified_smtp_at" TIMESTAMP WITH TIME ZONE, "run_as_user_id" uuid, "last_delivery_attempt_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_603f9cdaaf4c1193d7399c1e79c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_jobs_status_enum" AS ENUM('QUEUED', 'PENDING', 'VALIDATING', 'RUNNING', 'GENERATING_ARTIFACT', 'COMPLETED', 'PARTIALLY_DELIVERED', 'FAILED', 'CANCELLED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_jobs_format_enum" AS ENUM('CSV', 'XLSX', 'PDF', 'JSON')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_jobs_delivery_status_enum" AS ENUM('PENDING', 'DELIVERED', 'FAILED', 'SKIPPED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "schedule_id" uuid, "definition_id" uuid NOT NULL, "requested_by" uuid, "status" "public"."report_jobs_status_enum" NOT NULL DEFAULT 'PENDING', "format" "public"."report_jobs_format_enum" NOT NULL, "execution_key" character varying(120) NOT NULL, "filters" jsonb, "delivery_status" "public"."report_jobs_delivery_status_enum" NOT NULL DEFAULT 'PENDING', "claimed_at" TIMESTAMP WITH TIME ZONE, "claimed_by" character varying(80), "started_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "failed_at" TIMESTAMP WITH TIME ZONE, "error_message" text, "delivery_error" text, "artifact_id" uuid, "attempts" integer NOT NULL DEFAULT '0', "metadata" jsonb, "job_no" character varying(100), "report_code" character varying(100), "parameter_payload" jsonb, "parameter_hash" character varying(64), "source_cutoff_at" TIMESTAMP WITH TIME ZONE, "execution_context" jsonb, "progress_percent" integer NOT NULL DEFAULT '0', "row_count" bigint, "failure_code" character varying(80), "safe_error_message" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d7bd989edbb0f0171f7d0fd270f" UNIQUE ("execution_key"), CONSTRAINT "PK_0c1416b1e9ba757ceae79b598e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_delivery_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "report_job_id" uuid NOT NULL, "artifact_id" uuid, "channel" character varying(40) NOT NULL, "recipient" character varying(255), "attempt_no" integer NOT NULL DEFAULT '1', "status" character varying(40) NOT NULL, "failure_code" character varying(80), "failure_message" text, "attempted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completed_at" TIMESTAMP WITH TIME ZONE, "metadata" jsonb, CONSTRAINT "PK_d61d7eb26891dc2712df12a0f42" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_definitions_default_format_enum" AS ENUM('CSV', 'XLSX', 'PDF', 'JSON')`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_definitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(80) NOT NULL, "name" character varying(160) NOT NULL, "description" text, "generator_key" character varying(80) NOT NULL, "default_format" "public"."report_definitions_default_format_enum" NOT NULL, "supported_formats" jsonb NOT NULL DEFAULT '[]', "enabled" boolean NOT NULL DEFAULT true, "feature_code" character varying(100), "usage_metric_code" character varying(100), "max_rows" integer, "default_filters" jsonb, "metadata" jsonb, "category" character varying(40), "version" integer NOT NULL DEFAULT '1', "sensitivity" character varying(40) NOT NULL DEFAULT 'INTERNAL', "permission" character varying(150), "maximum_rows" integer, "asynchronous_only" boolean NOT NULL DEFAULT false, "parameters" jsonb NOT NULL DEFAULT '[]', "definition_hash" character varying(64), "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_db2158da24366b3936126554959" UNIQUE ("code"), CONSTRAINT "PK_fa3c447eb43b86f206b4f54f033" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_artifacts_format_enum" AS ENUM('CSV', 'XLSX', 'PDF', 'JSON')`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_artifacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "job_id" uuid NOT NULL, "definition_id" uuid NOT NULL, "format" "public"."report_artifacts_format_enum" NOT NULL, "file_name" character varying(180) NOT NULL, "mime_type" character varying(120) NOT NULL, "content" text, "size_bytes" bigint NOT NULL DEFAULT '0', "checksum" character varying(120), "expires_at" TIMESTAMP WITH TIME ZONE, "metadata" jsonb, "report_code" character varying(100), "storage_key" character varying(255), "file_hash" character varying(64), "retention_until" TIMESTAMP WITH TIME ZONE, "deleted_at" TIMESTAMP WITH TIME ZONE, "download_count" bigint NOT NULL DEFAULT '0', "last_downloaded_at" TIMESTAMP WITH TIME ZONE, "tenant_scope_hash" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_63380a81380056ff15b91fccf9f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_access_audit_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "user_id" uuid, "report_code" character varying(100), "artifact_id" uuid, "access_type" character varying(60) NOT NULL, "purpose" text, "ip_address" character varying(64), "user_agent" character varying(500), "result" character varying(30) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_604be1cc78a247b7c49bc0b314b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_treaty_sections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "treaty_id" uuid NOT NULL, "section_no" character varying(30) NOT NULL, "section_name" character varying(180) NOT NULL, "category_id" uuid, "product_id" uuid, "sub_class_id" uuid, "retention_amount" numeric(20,2) NOT NULL DEFAULT '0', "cession_limit" numeric(20,2) NOT NULL DEFAULT '0', "treaty_limit" numeric(20,2) NOT NULL DEFAULT '0', "line_count" numeric(12,4) NOT NULL DEFAULT '0', "rate_on_line" numeric(18,10) NOT NULL DEFAULT '0', "minimum_premium" numeric(20,2) NOT NULL DEFAULT '0', "maximum_premium" numeric(20,2) NOT NULL DEFAULT '0', "ceding_commission_rate" numeric(18,10) NOT NULL DEFAULT '0', "brokerage_rate" numeric(18,10) NOT NULL DEFAULT '0', "profit_commission_rate" numeric(18,10) NOT NULL DEFAULT '0', "event_limit" numeric(20,2) NOT NULL DEFAULT '0', "aggregate_limit" numeric(20,2) NOT NULL DEFAULT '0', "reinsurance_category" integer NOT NULL DEFAULT '1', "reinsurance_form" integer NOT NULL DEFAULT '1', "reinsurance_type" integer NOT NULL DEFAULT '1', "status" character varying(30) NOT NULL DEFAULT 'ACTIVE', "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_741292565d0d56bb264c57ee77f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_treaty_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "treaty_id" uuid NOT NULL, "treaty_section_id" uuid, "participant_company_id" uuid NOT NULL, "reinsurance_broker_company_id" uuid, "participant_code" character varying(50) NOT NULL, "re_broker_code" character varying(50), "participant_role" character varying(40) NOT NULL, "share_percent" numeric(18,10) NOT NULL, "signed_line_percent" numeric(18,10) NOT NULL DEFAULT '0', "capacity_amount" numeric(20,2) NOT NULL DEFAULT '0', "brokerage_commission_rate" numeric(18,10) NOT NULL DEFAULT '0', "reinsurance_commission_rate" numeric(18,10) NOT NULL DEFAULT '0', "participation_date" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_from" date, "effective_to" date, "status" character varying(30) NOT NULL DEFAULT 'INVITED', "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_2cf1ba07ee376f36abe22c07858" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_treaties" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "treaty_no" character varying(60) NOT NULL, "treaty_name" character varying(180) NOT NULL, "treaty_type" character varying(40) NOT NULL, "treaty_form" character varying(60) NOT NULL, "effective_from" date NOT NULL, "effective_to" date NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "total_capacity" numeric(20,2) NOT NULL DEFAULT '0', "company_retention" numeric(20,2) NOT NULL DEFAULT '0', "aggregate_limit" numeric(20,2) NOT NULL DEFAULT '0', "minimum_deposit_premium" numeric(20,2) NOT NULL DEFAULT '0', "reinstatement_count" integer NOT NULL DEFAULT '0', "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "agreement_reference" character varying(120), "agreement_document_url" character varying(500), "created_by" uuid, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "activated_by" uuid, "activated_at" TIMESTAMP WITH TIME ZONE, "rejected_by" uuid, "rejected_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "suspended_by" uuid, "suspended_at" TIMESTAMP WITH TIME ZONE, "suspension_reason" text, "metadata" jsonb, "program_id" uuid, "direction" character varying(20) NOT NULL DEFAULT 'OUTWARD', "territory" character varying(30), "regulatory_status" character varying(30) NOT NULL DEFAULT 'UNREGISTERED', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_fde60b7155867d8302c7a0569f8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reinsurance_treaty_company" ON "reinsurance_treaties" ("company_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_treaty_eligibility_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "treaty_id" uuid NOT NULL, "rule_type" character varying(40) NOT NULL, "rule_value" character varying(180) NOT NULL, "is_exclusion" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_072f039be85f570bb6b3ede86a3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_settlement_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "settlement_id" uuid NOT NULL, "premium_account_id" uuid, "claim_recovery_id" uuid, "resource_type" character varying(50) NOT NULL, "resource_id" uuid NOT NULL, "amount" numeric(20,2) NOT NULL, "description" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e7588ebaedf8c83c97b2d105148" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_settlements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "counterparty_company_id" uuid NOT NULL, "settlement_no" character varying(60) NOT NULL, "settlement_type" character varying(40) NOT NULL, "period_from" date, "period_to" date, "currency" character varying(10) NOT NULL, "gross_amount" numeric(20,2) NOT NULL DEFAULT '0', "deduction_amount" numeric(20,2) NOT NULL DEFAULT '0', "net_amount" numeric(20,2) NOT NULL DEFAULT '0', "paid_amount" numeric(20,2) NOT NULL DEFAULT '0', "balance_amount" numeric(20,2) NOT NULL DEFAULT '0', "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "payment_method" character varying(50), "payment_reference" character varying(150), "created_by" uuid, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "finance_journal_entry_id" uuid, "finance_event_id" character varying(150), "settled_by" uuid, "settled_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_bfa12db35df897ccba079e06fce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_claim_recoveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "claim_id" uuid NOT NULL, "cession_id" uuid NOT NULL, "cession_participant_id" uuid NOT NULL, "participant_company_id" uuid NOT NULL, "recovery_no" character varying(60) NOT NULL, "currency" character varying(10) NOT NULL, "gross_claim_amount" numeric(20,2) NOT NULL, "participant_share_percent" numeric(18,10) NOT NULL, "expected_recovery" numeric(20,2) NOT NULL, "admitted_recovery" numeric(20,2) NOT NULL DEFAULT '0', "received_recovery" numeric(20,2) NOT NULL DEFAULT '0', "outstanding_recovery" numeric(20,2) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'EXPECTED', "created_by" uuid, "admitted_by" uuid, "admitted_at" TIMESTAMP WITH TIME ZONE, "remarks" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4ec79f07eacc2b8fb2a606ccd09" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_recovery_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "claim_recovery_id" uuid NOT NULL, "amount" numeric(20,2) NOT NULL, "currency_code" character varying(10) NOT NULL, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL, "reference" character varying(150), "recorded_by" uuid, "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3e77d0f44cd2a6687ce153b7b77" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_reconciliation_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "counterparty_company_id" uuid NOT NULL, "resource_type" character varying(50) NOT NULL, "resource_id" uuid NOT NULL, "expected_amount" numeric(20,2) NOT NULL, "reported_amount" numeric(20,2) NOT NULL, "variance_amount" numeric(20,2) NOT NULL, "currency" character varying(10) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'OPEN', "reason" text, "resolution" text, "assigned_user_id" uuid, "resolved_by" uuid, "resolved_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e3661773d8161fa48f893dc7cc2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_programs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "program_name" character varying(180) NOT NULL, "program_year" integer NOT NULL, "direction" character varying(20) NOT NULL DEFAULT 'OUTWARD', "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4ba9892582fa227685ac22d3c3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_premium_account_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "premium_account_id" uuid NOT NULL, "cession_id" uuid NOT NULL, "cession_participant_id" uuid NOT NULL, "policy_id" uuid NOT NULL, "gross_ceded_premium" numeric(20,2) NOT NULL, "reinsurance_commission" numeric(20,2) NOT NULL DEFAULT '0', "brokerage_commission" numeric(20,2) NOT NULL DEFAULT '0', "tax_amount" numeric(20,2) NOT NULL DEFAULT '0', "net_premium_due" numeric(20,2) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_08234169cf87d087768f4bf5be6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_premium_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "treaty_id" uuid, "participant_company_id" uuid NOT NULL, "reinsurance_broker_company_id" uuid, "account_no" character varying(60) NOT NULL, "period_from" date NOT NULL, "period_to" date NOT NULL, "currency" character varying(10) NOT NULL, "gross_ceded_premium" numeric(20,2) NOT NULL DEFAULT '0', "reinsurance_commission" numeric(20,2) NOT NULL DEFAULT '0', "brokerage_commission" numeric(20,2) NOT NULL DEFAULT '0', "tax_amount" numeric(20,2) NOT NULL DEFAULT '0', "other_adjustments" numeric(20,2) NOT NULL DEFAULT '0', "net_premium_due" numeric(20,2) NOT NULL DEFAULT '0', "paid_amount" numeric(20,2) NOT NULL DEFAULT '0', "outstanding_amount" numeric(20,2) NOT NULL DEFAULT '0', "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_ec7aa76d86e4ab7965a96852e5a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_cession_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "cession_id" uuid NOT NULL, "participant_company_id" uuid NOT NULL, "reinsurance_broker_company_id" uuid, "source_treaty_participant_id" uuid, "source_facultative_offer_id" uuid, "participant_code" character varying(50) NOT NULL, "participant_type" integer NOT NULL DEFAULT '1', "reinsurance_form" integer NOT NULL DEFAULT '1', "reinsurance_type" integer NOT NULL DEFAULT '1', "re_broker_code" character varying(50), "brokerage_commission" numeric(18,2) NOT NULL DEFAULT '0', "reinsurance_commission" numeric(18,2) NOT NULL DEFAULT '0', "premium_share" numeric(18,10) NOT NULL, "sum_insured_share" numeric(20,2) NOT NULL, "ceded_premium_share" numeric(20,2) NOT NULL, "participation_date" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_08173f6c4d6e89219a8bc13e55c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_cessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "policy_id" uuid NOT NULL, "policy_risk_id" uuid, "treaty_id" uuid, "treaty_section_id" uuid, "facultative_placement_id" uuid, "cession_no" character varying(60) NOT NULL, "cession_type" character varying(30) NOT NULL, "effective_from" date NOT NULL, "effective_to" date NOT NULL, "currency" character varying(10) NOT NULL, "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1', "gross_sum_insured" numeric(20,2) NOT NULL, "gross_premium" numeric(20,2) NOT NULL, "retention_amount" numeric(20,2) NOT NULL, "retained_premium" numeric(20,2) NOT NULL, "ceded_sum_insured" numeric(20,2) NOT NULL, "ceded_premium" numeric(20,2) NOT NULL, "ceded_share_percent" numeric(18,10) NOT NULL, "reinsurance_category" integer NOT NULL DEFAULT '1', "authorizing_officer_name" character varying(150), "authorizing_officer_title" character varying(100), "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "created_by" uuid, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "applied_by" uuid, "applied_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a1643cefd22f424fef93dc832b1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_declarations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "policy_id" uuid NOT NULL, "cession_id" uuid NOT NULL, "declaration_no" character varying(60) NOT NULL, "cover_note_reference_number" character varying(100) NOT NULL, "premium_including_tax" numeric(20,2) NOT NULL, "currency_code" character varying(10) NOT NULL, "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1', "authorizing_officer_name" character varying(150) NOT NULL, "authorizing_officer_title" character varying(100) NOT NULL, "reinsurance_category" integer NOT NULL, "participants" jsonb NOT NULL DEFAULT '[]', "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "tiramis_submission_tracking_id" uuid, "tiramis_status" character varying(50), "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "tiramis_payload" jsonb, "created_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4e45088cf3a52f80c0000277380" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_counterparties" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "counterparty_company_id" uuid NOT NULL, "role" character varying(40) NOT NULL, "rating" character varying(20), "rating_agency" character varying(60), "home_territory" character varying(30), "regulatory_status" character varying(30) NOT NULL DEFAULT 'UNREGISTERED', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f96a406b0c5a15daa863ae6e995" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_bordereau_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bordereau_id" uuid NOT NULL, "cession_id" uuid, "cession_participant_id" uuid, "policy_id" uuid, "claim_id" uuid, "claim_recovery_id" uuid, "reference_number" character varying(120) NOT NULL, "gross_sum_insured" numeric(20,2) NOT NULL DEFAULT '0', "ceded_sum_insured" numeric(20,2) NOT NULL DEFAULT '0', "gross_premium" numeric(20,2) NOT NULL DEFAULT '0', "ceded_premium" numeric(20,2) NOT NULL DEFAULT '0', "commission_amount" numeric(20,2) NOT NULL DEFAULT '0', "brokerage_amount" numeric(20,2) NOT NULL DEFAULT '0', "claim_amount" numeric(20,2) NOT NULL DEFAULT '0', "recovery_amount" numeric(20,2) NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4cce764f501fbcc2734b3d131f7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reinsurance_bordereaux" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "treaty_id" uuid, "participant_company_id" uuid, "bordereau_no" character varying(60) NOT NULL, "bordereau_type" character varying(30) NOT NULL, "period_from" date NOT NULL, "period_to" date NOT NULL, "currency" character varying(10) NOT NULL, "gross_sum_insured" numeric(20,2) NOT NULL DEFAULT '0', "ceded_sum_insured" numeric(20,2) NOT NULL DEFAULT '0', "gross_premium" numeric(20,2) NOT NULL DEFAULT '0', "ceded_premium" numeric(20,2) NOT NULL DEFAULT '0', "commission_amount" numeric(20,2) NOT NULL DEFAULT '0', "brokerage_amount" numeric(20,2) NOT NULL DEFAULT '0', "claim_amount" numeric(20,2) NOT NULL DEFAULT '0', "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_c0a6cdc0b24c93c13b66af2bc6a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "facultative_placement_offers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "placement_id" uuid NOT NULL, "reinsurer_company_id" uuid NOT NULL, "reinsurance_broker_company_id" uuid, "offer_no" character varying(60) NOT NULL, "participant_code" character varying(50), "re_broker_code" character varying(50), "offered_share_percent" numeric(18,10) NOT NULL, "offered_amount" numeric(20,2) NOT NULL, "offered_premium" numeric(20,2) NOT NULL, "quoted_share_percent" numeric(18,10) NOT NULL DEFAULT '0', "quoted_amount" numeric(20,2) NOT NULL DEFAULT '0', "quoted_premium" numeric(20,2) NOT NULL DEFAULT '0', "accepted_share_percent" numeric(18,10) NOT NULL DEFAULT '0', "accepted_amount" numeric(20,2) NOT NULL DEFAULT '0', "accepted_premium" numeric(20,2) NOT NULL DEFAULT '0', "brokerage_commission_rate" numeric(18,10) NOT NULL DEFAULT '0', "reinsurance_commission_rate" numeric(18,10) NOT NULL DEFAULT '0', "terms" text, "conditions" text, "exclusions" text, "status" character varying(30) NOT NULL DEFAULT 'INVITED', "invited_by" uuid, "responded_by" uuid, "responded_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_f1e96c5db1e97e7ca5fa24ee5f0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "facultative_placements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "policy_id" uuid NOT NULL, "policy_risk_id" uuid, "placement_no" character varying(60) NOT NULL, "placement_reference" character varying(120), "risk_description" text NOT NULL, "gross_sum_insured" numeric(20,2) NOT NULL, "company_retention" numeric(20,2) NOT NULL, "amount_to_place" numeric(20,2) NOT NULL, "gross_premium" numeric(20,2) NOT NULL, "premium_to_place" numeric(20,2) NOT NULL, "currency" character varying(10) NOT NULL, "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1', "target_share_percent" numeric(18,10) NOT NULL DEFAULT '100', "accepted_share_percent" numeric(18,10) NOT NULL DEFAULT '0', "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "submission_deadline" TIMESTAMP WITH TIME ZONE, "notes" text, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_28ea48f6138921ad84082fb4874" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "facultative_signed_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "placement_id" uuid NOT NULL, "participant_company_id" uuid NOT NULL, "signed_share_percent" numeric(18,10) NOT NULL, "signed_amount" numeric(20,2) NOT NULL, "signed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "signed_by" uuid, CONSTRAINT "PK_33d4fcbfcce2e9e6ed42560d562" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_submission_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "return_id" uuid, "levy_return_id" uuid, "event_type" character varying(60) NOT NULL, "event_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actor_id" uuid, "notes" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5c86b74d58db99b3c8b0b28a22a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."regulatory_returns_status_enum" AS ENUM('DRAFT', 'CALCULATED', 'GENERATED', 'VALIDATION_FAILED', 'SUBMITTED_FOR_APPROVAL', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SUBMISSION_PROCESSING', 'SUBMITTED', 'ACKNOWLEDGED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'CANCELLED', 'REOPENED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_returns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "definition_id" uuid NOT NULL, "obligation_id" uuid, "return_no" character varying(60) NOT NULL, "status" "public"."regulatory_returns_status_enum" NOT NULL DEFAULT 'DRAFT', "period_start" date NOT NULL, "period_end" date NOT NULL, "due_at" TIMESTAMP WITH TIME ZONE, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "prepared_by" uuid, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "submitted_at" TIMESTAMP WITH TIME ZONE, "submission_reference" character varying(120), "data" jsonb, "metadata" jsonb, "obligation_instance_id" uuid, "return_code" character varying(100), "version_number" integer NOT NULL DEFAULT '1', "report_definition_code" character varying(100), "report_definition_version" integer, "currency_code" character varying(3), "parameters" jsonb NOT NULL DEFAULT '{}', "parameters_hash" character varying(64), "source_cutoff_at" TIMESTAMP WITH TIME ZONE, "source_projection_sequence" bigint, "return_snapshot" jsonb, "return_snapshot_hash" character varying(64), "validation_results" jsonb, "reconciliation_status" character varying(40) NOT NULL DEFAULT 'NOT_CHECKED', "reconciliation_summary" jsonb, "report_job_id" uuid, "artifact_id" uuid, "prepared_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "submitted_for_review_by" uuid, "submitted_for_review_at" TIMESTAMP WITH TIME ZONE, "rejected_by" uuid, "rejected_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "supersedes_return_id" uuid, "state_version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_4412d11fac4b3b9007c2413b0bf" UNIQUE ("return_no"), CONSTRAINT "PK_5828632ed498154c8a171c42980" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_return_submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "regulatory_return_id" uuid NOT NULL, "submission_no" character varying(100) NOT NULL, "submission_channel" character varying(50) NOT NULL, "submission_reference" character varying(150), "status" character varying(40) NOT NULL DEFAULT 'SUBMISSION_PROCESSING', "submitted_payload_hash" character varying(64) NOT NULL, "acknowledgement_reference" character varying(150), "acknowledgement_code" character varying(50), "acknowledgement_message" text, "submitted_by" uuid NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "acknowledged_at" TIMESTAMP WITH TIME ZONE, "rejected_at" TIMESTAMP WITH TIME ZONE, "evidence_document_id" uuid, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_390ce5808f54fb9c525d91f1581" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."regulatory_return_definitions_frequency_enum" AS ENUM('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'EVENT_DRIVEN', 'AD_HOC')`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_return_definitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(80) NOT NULL, "name" character varying(160) NOT NULL, "generator_key" character varying(80) NOT NULL, "applicable_company_types" jsonb NOT NULL DEFAULT '[]', "frequency" "public"."regulatory_return_definitions_frequency_enum" NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "is_premium_levy" boolean NOT NULL DEFAULT false, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_cd80ee18124563fdcb3824143ea" UNIQUE ("code"), CONSTRAINT "PK_e2bd5ba25d4f49aebdbddf7c785" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_return_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "return_id" uuid NOT NULL, "company_id" uuid NOT NULL, "file_name" character varying(160) NOT NULL, "evidence_type" character varying(120), "storage_path" character varying(255), "mime_type" character varying(120), "uploaded_by" uuid, "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "metadata" jsonb, CONSTRAINT "PK_db43e1e1cee8b3899c6d0b716f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."regulatory_obligations_status_enum" AS ENUM('UPCOMING', 'DUE', 'IN_PROGRESS', 'PREPARATION_IN_PROGRESS', 'SUBMITTED_FOR_APPROVAL', 'PENDING_REVIEW', 'APPROVED', 'SUBMITTED', 'ACKNOWLEDGED', 'ACCEPTED', 'REJECTED', 'OVERDUE', 'WAIVED', 'NOT_APPLICABLE', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_obligations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "template_id" uuid, "return_definition_id" uuid, "code" character varying(80) NOT NULL, "name" character varying(160) NOT NULL, "period_start" date NOT NULL, "period_end" date NOT NULL, "due_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."regulatory_obligations_status_enum" NOT NULL DEFAULT 'UPCOMING', "return_id" uuid, "metadata" jsonb, "definition_id" uuid, "obligation_reference" character varying(100), "assigned_user_id" uuid, "assigned_role_id" uuid, "active_return_id" uuid, "active_levy_assessment_id" uuid, "warning_sent_days" integer array NOT NULL DEFAULT '{}', "completed_at" TIMESTAMP WITH TIME ZONE, "waived_by" uuid, "waived_at" TIMESTAMP WITH TIME ZONE, "waiver_reason" text, "state_version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6bf47954a342a7f43f30b676997" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."regulatory_obligation_templates_frequency_enum" AS ENUM('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'EVENT_DRIVEN', 'AD_HOC')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."regulatory_obligation_templates_due_rule_type_enum" AS ENUM('PERIOD_END_OFFSET', 'EVENT_OFFSET', 'FIXED_DATE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."regulatory_obligation_templates_offset_unit_enum" AS ENUM('CALENDAR_DAYS', 'WORKING_DAYS', 'MONTHS')`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_obligation_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(80) NOT NULL, "name" character varying(160) NOT NULL, "obligation_type" character varying(50) NOT NULL, "applicable_company_types" jsonb NOT NULL DEFAULT '[]', "frequency" "public"."regulatory_obligation_templates_frequency_enum" NOT NULL, "due_rule_type" "public"."regulatory_obligation_templates_due_rule_type_enum" NOT NULL, "offset_unit" "public"."regulatory_obligation_templates_offset_unit_enum", "offset_value" integer, "fixed_month" integer, "fixed_day" integer, "effective_from" date, "effective_to" date, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a1c8c68d775b8080d8d50fe5c2e" UNIQUE ("code"), CONSTRAINT "PK_e556fdbb8d54c32f1ea8fde0283" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_obligation_instances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "definition_id" uuid NOT NULL, "obligation_reference" character varying(100) NOT NULL, "period_start" date NOT NULL, "period_end" date NOT NULL, "due_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'UPCOMING', "assigned_user_id" uuid, "assigned_role_id" uuid, "active_return_id" uuid, "active_levy_assessment_id" uuid, "warning_sent_days" integer array NOT NULL DEFAULT '{}', "completed_at" TIMESTAMP WITH TIME ZONE, "waived_by" uuid, "waived_at" TIMESTAMP WITH TIME ZONE, "waiver_reason" text, "state_version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_68bbb19d299fd72b274ae5d0ab3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_obligation_definitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "authority_profile_id" uuid NOT NULL, "obligation_code" character varying(80) NOT NULL, "obligation_name" character varying(250) NOT NULL, "obligation_type" character varying(40) NOT NULL, "frequency" character varying(40) NOT NULL, "effective_from" date NOT NULL, "effective_to" date, "due_date_rule" jsonb NOT NULL, "warning_days" integer array NOT NULL DEFAULT '{30,14,7,1}', "report_code" character varying(100), "requires_approval" boolean NOT NULL DEFAULT true, "requires_submission_evidence" boolean NOT NULL DEFAULT true, "requires_reconciliation" boolean NOT NULL DEFAULT true, "active" boolean NOT NULL DEFAULT true, "version_number" integer NOT NULL DEFAULT '1', "definition_snapshot" jsonb NOT NULL, "definition_snapshot_hash" character varying(64) NOT NULL, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bda1012b8c7e9f6eeb5fa692caf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_levy_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "authority_profile_id" uuid NOT NULL, "levy_code" character varying(80) NOT NULL, "levy_name" character varying(200) NOT NULL, "basis_type" character varying(50) NOT NULL, "rate_type" character varying(30) NOT NULL, "rate_value" numeric(18,10) NOT NULL, "minimum_amount" numeric(20,4), "maximum_amount" numeric(20,4), "currency_code" character varying(3), "effective_from" date NOT NULL, "effective_to" date, "calculation_configuration" jsonb NOT NULL, "version_number" integer NOT NULL DEFAULT '1', "rule_snapshot" jsonb NOT NULL, "rule_snapshot_hash" character varying(64) NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_977ad4119512b1514e438b4f486" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_ledger_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "source_type" character varying(80) NOT NULL, "source_id" uuid NOT NULL, "source_event_key" character varying(180) NOT NULL, "entry_type" character varying(40) NOT NULL, "authority_profile_id" uuid, "obligation_instance_id" uuid, "regulatory_return_id" uuid, "levy_assessment_id" uuid, "period_start" date, "period_end" date, "currency_code" character varying(3), "debit_amount" numeric(20,4) NOT NULL DEFAULT '0', "credit_amount" numeric(20,4) NOT NULL DEFAULT '0', "running_balance" numeric(20,4), "entry_snapshot" jsonb NOT NULL DEFAULT '{}', "entry_snapshot_hash" character varying(64) NOT NULL, "reversal_of_entry_id" uuid, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_11806561f8fbfd76e75d946bc6f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_levy_assessments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "obligation_instance_id" uuid, "levy_rule_id" uuid NOT NULL, "assessment_no" character varying(100) NOT NULL, "period_start" date NOT NULL, "period_end" date NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'DRAFT', "basis_amount" numeric(20,4) NOT NULL, "rate_value" numeric(18,10) NOT NULL, "assessed_amount" numeric(20,4) NOT NULL, "paid_amount" numeric(20,4) NOT NULL DEFAULT '0', "outstanding_amount" numeric(20,4) NOT NULL, "currency_code" character varying(3) NOT NULL, "source_report_code" character varying(100), "source_report_job_id" uuid, "calculation_snapshot" jsonb NOT NULL, "calculation_snapshot_hash" character varying(64) NOT NULL, "active_invoice_id" uuid, "finance_payment_reference" character varying(150), "reconciliation_status" character varying(40) NOT NULL DEFAULT 'NOT_CHECKED', "prepared_by" uuid NOT NULL, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "state_version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_62782101b63b65e4b79233629f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "regulatory_authority_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "authority_code" character varying(50) NOT NULL, "authority_name" character varying(200) NOT NULL, "authority_type" character varying(50) NOT NULL, "jurisdiction_code" character varying(20) NOT NULL, "registration_reference" character varying(100), "submission_channel" character varying(50), "submission_endpoint" character varying(500), "contact_email" character varying(255), "contact_phone" character varying(50), "active" boolean NOT NULL DEFAULT true, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d0218aaeba1fad04a2810e4d83c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."premium_levy_returns_status_enum" AS ENUM('DRAFT', 'CALCULATED', 'SUBMITTED', 'STATEMENT_RECEIVED', 'CONFIRMED', 'CONTROL_NUMBER_RECEIVED', 'PAID', 'REJECTED', 'REOPENED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "premium_levy_returns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "regulatory_return_id" uuid, "levy_no" character varying(60) NOT NULL, "status" "public"."premium_levy_returns_status_enum" NOT NULL DEFAULT 'DRAFT', "period_start" date NOT NULL, "period_end" date NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "levy_rate" numeric(18,10) NOT NULL DEFAULT '0', "gross_premium" numeric(20,2) NOT NULL DEFAULT '0', "adjustments_amount" numeric(20,2) NOT NULL DEFAULT '0', "levy_amount" numeric(20,2) NOT NULL DEFAULT '0', "billed_amount" numeric(20,2) NOT NULL DEFAULT '0', "paid_amount" numeric(20,2) NOT NULL DEFAULT '0', "statement_received_at" TIMESTAMP WITH TIME ZONE, "statement_due_at" TIMESTAMP WITH TIME ZONE, "control_number" character varying(80), "control_number_received_at" TIMESTAMP WITH TIME ZONE, "payment_due_at" TIMESTAMP WITH TIME ZONE, "paid_at" TIMESTAMP WITH TIME ZONE, "prepared_by" uuid, "confirmed_by" uuid, "notes" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_7d8da86c6e8744b73a20fae42fe" UNIQUE ("levy_no"), CONSTRAINT "PK_ad40c5ea43c6a8a7bcfa6998ef0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_performance_snapshots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "product_id" uuid NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "snapshot_date" date NOT NULL, "period_start" date NOT NULL, "period_end" date NOT NULL, "gross_written_premium" numeric(20,2) NOT NULL DEFAULT '0', "earned_premium" numeric(20,2) NOT NULL DEFAULT '0', "premium_collected" numeric(20,2) NOT NULL DEFAULT '0', "claims_incurred" numeric(20,2) NOT NULL DEFAULT '0', "claims_paid" numeric(20,2) NOT NULL DEFAULT '0', "outstanding_reserve" numeric(20,2) NOT NULL DEFAULT '0', "ceded_premium" numeric(20,2) NOT NULL DEFAULT '0', "commissions" numeric(20,2) NOT NULL DEFAULT '0', "policies_count" integer NOT NULL DEFAULT '0', "claims_count" integer NOT NULL DEFAULT '0', "loss_ratio" numeric(18,6), "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_af191619f0e9332445d95a4e48d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."premium_levy_return_lines_line_type_enum" AS ENUM('GROSS_WRITTEN_PREMIUM', 'REINSURANCE_PREMIUM_RECEIVED', 'FOREIGN_FACULTATIVE_DEDUCTION', 'MINIMUM_DEPOSIT_PREMIUM', 'ADJUSTMENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "premium_levy_return_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "levy_return_id" uuid NOT NULL, "line_type" "public"."premium_levy_return_lines_line_type_enum" NOT NULL, "description" text, "amount" numeric(20,2) NOT NULL DEFAULT '0', "evidence_reference" character varying(160), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0c256bb5e54ec51b9450abc4380" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."premium_ledger_entries_entry_type_enum" AS ENUM('NEW_POLICY', 'RENEWAL', 'ENDORSEMENT_DEBIT', 'ENDORSEMENT_CREDIT', 'CANCELLATION_CREDIT', 'CANCELLATION_CHARGE', 'REVERSAL', 'MANUAL_ADJUSTMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."premium_ledger_entries_status_enum" AS ENUM('POSTED', 'REVERSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "premium_ledger_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "policy_id" uuid, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "entry_type" "public"."premium_ledger_entries_entry_type_enum" NOT NULL, "status" "public"."premium_ledger_entries_status_enum" NOT NULL DEFAULT 'POSTED', "transaction_date" date NOT NULL, "period_year" integer NOT NULL, "period_month" integer NOT NULL, "gross_written_premium" numeric(20,2) NOT NULL DEFAULT '0', "net_written_premium" numeric(20,2) NOT NULL DEFAULT '0', "tax_amount" numeric(20,2) NOT NULL DEFAULT '0', "commission_amount" numeric(20,2) NOT NULL DEFAULT '0', "brokerage_amount" numeric(20,2) NOT NULL DEFAULT '0', "source_type" character varying(80), "source_id" uuid, "narrative" text, "created_by" uuid, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9b477b9f858f75f8424fa6ad05f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."company_regulatory_profiles_levy_frequency_enum" AS ENUM('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'EVENT_DRIVEN', 'AD_HOC')`,
    );
    await queryRunner.query(
      `CREATE TABLE "company_regulatory_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "financial_year_start_month" integer NOT NULL DEFAULT '1', "regulator_name" character varying(120) NOT NULL DEFAULT 'TIRA', "regulator_code" character varying(40), "timezone" character varying(60) NOT NULL DEFAULT 'Africa/Dar_es_Salaam', "levy_frequency" "public"."company_regulatory_profiles_levy_frequency_enum" NOT NULL DEFAULT 'MONTHLY', "levy_rate" numeric(18,10) NOT NULL, "metadata" jsonb, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_bd32da27153944d13f958352d0f" UNIQUE ("company_id"), CONSTRAINT "PK_75d5d0a0abf913c3fef5a8f98e5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_charge_category_enum" AS ENUM('TAX', 'LEVY', 'FEE', 'POLICY_FEE', 'STAMP_DUTY', 'ADMINISTRATION_FEE', 'PRODUCT_CHARGE', 'RISK_CHARGE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_tax_type_enum" AS ENUM('PERCENTAGE', 'FIXED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_tax_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "category_id" uuid, "product_id" uuid, "risk_id" uuid, "tax_name" character varying(150) NOT NULL, "tax_code" character varying(50) NOT NULL, "charge_category" "public"."product_charge_category_enum" NOT NULL DEFAULT 'TAX', "tax_type" "public"."product_tax_type_enum" NOT NULL, "tax_rate" numeric(18,10), "tax_amount" numeric(20,4), "is_taxable" boolean NOT NULL DEFAULT false, "minimum_charge_amount" numeric(20,4), "maximum_charge_amount" numeric(20,4), "calculation_base" character varying(30) NOT NULL DEFAULT 'BASIC_PREMIUM', "effective_from" date NOT NULL, "effective_to" date NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_589f117a7fcee077c43d1404168" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptr_status" ON "product_tax_rules" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptr_risk_id" ON "product_tax_rules" ("risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptr_product_id" ON "product_tax_rules" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptr_category_id" ON "product_tax_rules" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptr_company_id" ON "product_tax_rules" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product_distribution_document_requirements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_id" uuid NOT NULL, "risk_id" uuid, "document_type" character varying(80) NOT NULL, "document_name" character varying(150) NOT NULL, "is_required" boolean NOT NULL DEFAULT false, "is_required_before_quote" boolean NOT NULL DEFAULT false, "is_required_before_policy" boolean NOT NULL DEFAULT false, "is_required_before_claim" boolean NOT NULL DEFAULT false, "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b95065acae5edb2320200cd4506" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pddr_status" ON "product_distribution_document_requirements" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pddr_risk_id" ON "product_distribution_document_requirements" ("risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pddr_product_id" ON "product_distribution_document_requirements" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pddr_company_id" ON "product_distribution_document_requirements" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product_distribution_channels" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "category_id" uuid, "product_id" uuid NOT NULL, "sub_class_id" uuid, "channel_type" character varying(20) NOT NULL, "can_quote" boolean NOT NULL DEFAULT false, "can_bind" boolean NOT NULL DEFAULT false, "can_issue_policy" boolean NOT NULL DEFAULT false, "can_collect_premium" boolean NOT NULL DEFAULT false, "requires_underwriting" boolean NOT NULL DEFAULT false, "requires_insurer_approval" boolean NOT NULL DEFAULT false, "effective_from" date NOT NULL, "effective_to" date NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "metadata" jsonb, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_21938b8ba528e6311f4a38150df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pdc_channel_type" ON "product_distribution_channels" ("channel_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pdc_status" ON "product_distribution_channels" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pdc_product_id" ON "product_distribution_channels" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pdc_intermediary_company_id" ON "product_distribution_channels" ("intermediary_company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pdc_insurer_company_id" ON "product_distribution_channels" ("insurer_company_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_commission_type_enum" AS ENUM('PERCENTAGE', 'FIXED', 'TIERED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_commission_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "category_id" uuid, "product_id" uuid NOT NULL, "risk_id" uuid, "channel_type" character varying(20) NOT NULL, "commission_type" "public"."product_commission_type_enum" NOT NULL, "commission_rate" numeric(18,10), "commission_amount" numeric(20,4), "minimum_commission" numeric(20,4), "maximum_commission" numeric(20,4), "calculation_base" character varying(30) NOT NULL DEFAULT 'GROSS_PREMIUM', "effective_from" date NOT NULL, "effective_to" date NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_fa17289088a551cb76c5ded4417" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pcr_status" ON "product_commission_rules" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pcr_risk_id" ON "product_commission_rules" ("risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pcr_product_id" ON "product_commission_rules" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pcr_intermediary_company_id" ON "product_commission_rules" ("intermediary_company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pcr_insurer_company_id" ON "product_commission_rules" ("insurer_company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_product_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "company_user_id" uuid NOT NULL, "product_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" character varying NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_user_product_access_company_user_product" UNIQUE ("company_id", "company_user_id", "product_id"), CONSTRAINT "PK_2b6e2d9b8f3b07335af556a17c0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_product_access_product_id" ON "user_product_access" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_product_access_company_user_id" ON "user_product_access" ("company_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_product_access_company_id" ON "user_product_access" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "department_product_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "department_id" uuid NOT NULL, "product_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" character varying NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_dept_product_access_company_dept_product" UNIQUE ("company_id", "department_id", "product_id"), CONSTRAINT "PK_6f863211ed90c0051c77f164bc1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dept_product_access_product_id" ON "department_product_access" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dept_product_access_department_id" ON "department_product_access" ("department_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dept_product_access_company_id" ON "department_product_access" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "branch_product_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "product_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" character varying NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_branch_product_access_company_branch_product" UNIQUE ("company_id", "branch_id", "product_id"), CONSTRAINT "PK_00f392c54b0912c9a1960e923d4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_product_access_product_id" ON "branch_product_access" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_product_access_branch_id" ON "branch_product_access" ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_product_access_company_id" ON "branch_product_access" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product_addon_rate_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "rate_book_id" uuid NOT NULL, "product_version_id" uuid NOT NULL, "addon_definition_id" uuid NOT NULL, "rule_code" character varying(50) NOT NULL, "pricing_type" character varying(30) NOT NULL, "percentage_rate" numeric(18,10), "fixed_amount" numeric(20,4), "per_unit_amount" numeric(20,4), "per_unit_factor_code" character varying(100), "minimum_amount" numeric(20,4), "maximum_amount" numeric(20,4), "effective_from" date, "effective_to" date, "priority" integer NOT NULL DEFAULT '100', "is_active" boolean NOT NULL DEFAULT true, "addon_snapshot" jsonb NOT NULL, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_addon_rate_rule_code" UNIQUE ("rate_book_id", "rule_code"), CONSTRAINT "PK_7d2c77581deb5001851b437bfe3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_addon_rate_rules_resolution" ON "product_addon_rate_rules" ("company_id", "rate_book_id", "addon_definition_id", "is_active", "priority") `,
    );
    await queryRunner.query(
      `CREATE TABLE "pricing_quotes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "pricing_quote_id" character varying(30) NOT NULL, "sequence_no" bigint NOT NULL, "quote_scope" character varying NOT NULL, "calculation_status" character varying NOT NULL DEFAULT 'CALCULATED', "calculated_by" uuid, "product_id" uuid, "risk_id" uuid, "quotation_type" character varying(50), "currency_code" character varying(10), "rate_book_id" uuid, "rate_book_version" character varying(30), "matched_rule_id" uuid, "matched_rule_version" integer, "base_premium" numeric(20,4) NOT NULL DEFAULT '0', "minimum_premium_adjustment" numeric(20,4) NOT NULL DEFAULT '0', "maximum_premium_adjustment" numeric(20,4) NOT NULL DEFAULT '0', "gross_premium" numeric(20,4) NOT NULL DEFAULT '0', "final_premium" numeric(20,4) NOT NULL DEFAULT '0', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "calculated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "input_signature" character varying(64) NOT NULL, "product_version_id" uuid, "product_definition_hash" character varying(64), "rate_book_definition_hash" character varying(64), "result_hash" character varying(64), "rate_book_snapshot" jsonb, "pricing_result_snapshot" jsonb, "input_payload" jsonb NOT NULL, "factor_payload" jsonb, "result_payload" jsonb NOT NULL, "warning_messages" jsonb, "context_payload" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_b14202f5c0af5732eadc353f52d" UNIQUE ("sequence_no"), CONSTRAINT "PK_167d93ffe460bac19974ff996c9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_pricing_quotes_pricing_quote_id" ON "pricing_quotes" ("pricing_quote_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pricing_quotes_company_risk_id" ON "pricing_quotes" ("company_id", "risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pricing_quotes_company_product_id" ON "pricing_quotes" ("company_id", "product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pricing_quotes_company_id" ON "pricing_quotes" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_cancellations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "policy_transaction_id" uuid NOT NULL, "reason_type" character varying(50) NOT NULL, "cancellation_method" character varying(40) NOT NULL, "requested_effective_date" date NOT NULL, "approved_effective_date" date, "policy_days" integer NOT NULL, "days_on_risk" integer NOT NULL, "remaining_days" integer NOT NULL, "gross_written_premium" numeric(20,4) NOT NULL, "earned_premium" numeric(20,4) NOT NULL, "unearned_premium" numeric(20,4) NOT NULL, "cancellation_charge" numeric(20,4) NOT NULL DEFAULT '0', "refund_amount" numeric(20,4) NOT NULL DEFAULT '0', "amount_due" numeric(20,4) NOT NULL DEFAULT '0', "tira_endorsement_type" integer, "previous_cover_note_reference" character varying(100), "cancellation_cover_note_reference" character varying(100), "rule_snapshot" jsonb, "rule_snapshot_hash" character varying(64), "claims_review_required" boolean NOT NULL DEFAULT false, "claims_review_status" character varying(30) NOT NULL DEFAULT 'NOT_REQUIRED', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_36720ec14d42a354bbbd398548" UNIQUE ("policy_transaction_id"), CONSTRAINT "PK_e5f55f60c4980843e66b142baa3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "endorsement_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "code" character varying(50) NOT NULL, "name" character varying(150) NOT NULL, "tira_endorsement_type" integer, "requires_new_cover_note" boolean NOT NULL DEFAULT true, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_endorsement_type_code" UNIQUE ("company_id", "code"), CONSTRAINT "PK_aa3415a30ab028dd39144747fc0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_endorsement_types_company_active" ON "endorsement_types" ("company_id", "is_active") `,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_endorsements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "policy_transaction_id" uuid NOT NULL, "endorsement_type_id" uuid, "endorsement_type_code" character varying(50) NOT NULL, "endorsement_type_name" character varying(150) NOT NULL, "tira_endorsement_type" integer, "previous_cover_note_reference" character varying(100) NOT NULL, "replacement_cover_note_reference" character varying(100), "requires_new_cover_note" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_2122c18281389a970ae738bd76" UNIQUE ("policy_transaction_id"), CONSTRAINT "PK_c80273f35f70da2e8eb92cfd2e0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_renewals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "policy_transaction_id" uuid NOT NULL, "renewal_no" character varying(80) NOT NULL, "renewal_status" character varying(40) NOT NULL DEFAULT 'ELIGIBLE', "renewal_start_date" date NOT NULL, "renewal_end_date" date NOT NULL, "offer_expires_at" TIMESTAMP WITH TIME ZONE, "source_cover_note_reference" character varying(100) NOT NULL, "renewal_quotation_id" uuid, "renewed_policy_id" uuid, "customer_accepted_at" TIMESTAMP WITH TIME ZONE, "customer_declined_at" TIMESTAMP WITH TIME ZONE, "decline_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_policy_renewal_no" UNIQUE ("company_id", "renewal_no"), CONSTRAINT "REL_da6e467ce7f308f39a4ddf3d23" UNIQUE ("policy_transaction_id"), CONSTRAINT "PK_7336e3b1ebee5e7b7617d1ee93a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoice_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoice_id" uuid NOT NULL, "item_type" character varying(50) NOT NULL, "item_name" character varying(150) NOT NULL, "description" text, "quantity" numeric(18,2) NOT NULL DEFAULT '0', "unit_amount" numeric(18,2) NOT NULL DEFAULT '0', "total_amount" numeric(18,2) NOT NULL DEFAULT '0', "source_line_type" character varying(50), "source_line_id" character varying(100), "line_snapshot" jsonb, "line_hash" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_53b99f9e0e2945e69de1a12b75a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoice_items_invoice_id" ON "invoice_items" ("invoice_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "customer_id" uuid NOT NULL, "quotation_id" uuid, "policy_id" uuid, "endorsement_id" uuid, "cancellation_id" uuid, "renewal_id" uuid, "branch_id" uuid, "sale_point_id" uuid, "invoice_no" character varying(50) NOT NULL, "invoice_type" character varying(30) NOT NULL, "source_type" character varying(40) NOT NULL DEFAULT 'MANUAL', "source_record_id" uuid, "source_revision" integer, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "gross_amount" numeric(18,2) NOT NULL DEFAULT '0', "discount_amount" numeric(18,2) NOT NULL DEFAULT '0', "tax_amount" numeric(18,2) NOT NULL DEFAULT '0', "charges_amount" numeric(18,2) NOT NULL DEFAULT '0', "total_amount" numeric(18,2) NOT NULL DEFAULT '0', "paid_amount" numeric(18,2) NOT NULL DEFAULT '0', "allocated_amount" numeric(20,4) NOT NULL DEFAULT '0', "refunded_amount" numeric(20,4) NOT NULL DEFAULT '0', "written_off_amount" numeric(20,4) NOT NULL DEFAULT '0', "balance_amount" numeric(18,2) NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'DRAFT', "pricing_result_hash" character varying(64), "source_snapshot" jsonb, "source_snapshot_hash" character varying(64), "balance_revision" integer NOT NULL DEFAULT '1', "balance_hash" character varying(64), "state_version" integer NOT NULL DEFAULT '1', "notes" text, "due_date" date, "created_by" uuid, "updated_by" uuid, "posted_by" uuid, "posted_at" TIMESTAMP WITH TIME ZONE, "issued_by" uuid, "issued_at" TIMESTAMP WITH TIME ZONE, "voided_by" uuid, "voided_at" TIMESTAMP WITH TIME ZONE, "void_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_invoices_company_invoice_no" ON "invoices" ("company_id", "invoice_no") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_company_customer_id" ON "invoices" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_company_status" ON "invoices" ("company_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_company_id" ON "invoices" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "portal_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "user_id" uuid NOT NULL, "actor_type" character varying(30) NOT NULL, "customer_id" uuid, "intermediary_company_id" uuid, "status" character varying(30) NOT NULL DEFAULT 'INVITED', "activated_at" TIMESTAMP WITH TIME ZONE, "suspended_by" uuid, "suspended_at" TIMESTAMP WITH TIME ZONE, "suspension_reason" text, "closed_by" uuid, "closed_at" TIMESTAMP WITH TIME ZONE, "accepted_terms_at" TIMESTAMP WITH TIME ZONE, "accepted_privacy_at" TIMESTAMP WITH TIME ZONE, "last_accessed_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "metadata" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_c06ed8450a5c1814fb44285e507" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_portal_accounts_company_user" ON "portal_accounts" ("company_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "portal_payment_proofs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "request_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "amount" numeric(20,2) NOT NULL, "currency" character varying(10) NOT NULL, "payment_reference" character varying(150), "payment_date" date NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'PENDING_REVIEW', "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "review_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_abd9f800717618cb6123c891a6c" UNIQUE ("request_id"), CONSTRAINT "REL_abd9f800717618cb6123c891a6" UNIQUE ("request_id"), CONSTRAINT "PK_e6d472f93d9e7a60145f6098b4b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "portal_request_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "request_id" uuid NOT NULL, "uploaded_by" uuid NOT NULL, "document_type" character varying(80) NOT NULL, "original_file_name" character varying(255) NOT NULL, "stored_file_name" character varying(255) NOT NULL, "storage_key" character varying(500) NOT NULL, "mime_type" character varying(120) NOT NULL, "file_size" bigint NOT NULL, "checksum" character varying(128) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_fffe86124ccd64e25c928a9c40d" UNIQUE ("storage_key"), CONSTRAINT "PK_0329b940439abeebe87f475f8e2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "portal_service_request_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "request_id" uuid NOT NULL, "old_status" character varying(40), "new_status" character varying(40) NOT NULL, "message" text, "changed_by" uuid NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a013a397b7d89e89c03c73672a2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "portal_service_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "portal_account_id" uuid NOT NULL, "request_no" character varying(60) NOT NULL, "request_type" character varying(50) NOT NULL, "target_type" character varying(50), "target_id" uuid, "policy_id" uuid, "quotation_id" uuid, "invoice_id" uuid, "status" character varying(40) NOT NULL DEFAULT 'DRAFT', "subject" character varying(180) NOT NULL, "description" text NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "assigned_to" uuid, "assigned_at" TIMESTAMP WITH TIME ZONE, "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "decision_reason" text, "completed_by" uuid, "completed_at" TIMESTAMP WITH TIME ZONE, "operational_resource_type" character varying(40), "operational_resource_id" uuid, "operational_created_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid NOT NULL, "updated_by" uuid, "active_dedupe_key" character varying(250), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_add6e25f6c184e50bfd931fe4d8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_portal_requests_company_status" ON "portal_service_requests" ("company_id", "status", "request_type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "portal_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "user_id" uuid NOT NULL, "type" character varying(80) NOT NULL, "severity" character varying(20) NOT NULL DEFAULT 'INFO', "title" character varying(180) NOT NULL, "message" text NOT NULL, "resource_type" character varying(80), "resource_id" uuid, "action_url" character varying(500), "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_84b9fa5d1665a127ff9e7bb4008" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_portal_notifications_user" ON "portal_notifications" ("company_id", "user_id", "read_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "portal_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "actor_type" character varying(30) NOT NULL, "customer_id" uuid, "intermediary_company_id" uuid, "email" character varying(150) NOT NULL, "phone" character varying(30), "first_name" character varying(80), "last_name" character varying(80), "token_hash" character varying(128) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'PENDING', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "invited_by" uuid NOT NULL, "accepted_by" uuid, "accepted_at" TIMESTAMP WITH TIME ZONE, "revoked_by" uuid, "revoked_at" TIMESTAMP WITH TIME ZONE, "revocation_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d995a44d17e45f6bf9f5ed6bfbc" UNIQUE ("token_hash"), CONSTRAINT "PK_0e042c82439f64a25152e73b065" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_portal_invitations_company_email" ON "portal_invitations" ("company_id", "email", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "non_motor_policy_details" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policy_id" uuid NOT NULL, "policy_risk_id" uuid NOT NULL, "subject_matter_id" uuid NOT NULL, "cover_description" text, "risk_location" text, "insured_value" numeric(18,2), "limit_of_liability" numeric(18,2), "tiramis_payload" jsonb, "tiramis_submission_tracking_id" uuid, "tiramis_status" character varying(50), "tiramis_transaction_id" uuid, "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_17d206dc938819de97923780ac3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_nmpd_subject_matter_id" ON "non_motor_policy_details" ("subject_matter_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_nmpd_policy_risk_id" ON "non_motor_policy_details" ("policy_risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_nmpd_policy_id" ON "non_motor_policy_details" ("policy_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "motor_policy_details" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policy_id" uuid NOT NULL, "policy_risk_id" uuid NOT NULL, "motor_vehicle_id" uuid NOT NULL, "cover_type" character varying(100), "usage_type" character varying(100), "certificate_no" character varying(100), "sticker_no" character varying(100), "tiramis_submission_tracking_id" uuid, "tiramis_status" character varying(50), "tiramis_transaction_id" uuid, "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e08bb7c9dd8a6260af7102222e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mpd_motor_vehicle_id" ON "motor_policy_details" ("motor_vehicle_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mpd_policy_risk_id" ON "motor_policy_details" ("policy_risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mpd_policy_id" ON "motor_policy_details" ("policy_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "motor_fleet_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fleet_id" uuid NOT NULL, "motor_vehicle_id" uuid NOT NULL, "quotation_entry_risk_id" uuid, "policy_risk_id" uuid, "risk_client_ref" character varying(80), "sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "premium" numeric(18,2) NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_7aff1b8dc46652c7a8714869bf9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mfi_quotation_entry_risk_id" ON "motor_fleet_items" ("quotation_entry_risk_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mfi_motor_vehicle_id" ON "motor_fleet_items" ("motor_vehicle_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mfi_fleet_id" ON "motor_fleet_items" ("fleet_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "motor_fleet_memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "fleet_id" uuid NOT NULL, "motor_vehicle_id" uuid NOT NULL, "insured_asset_id" uuid NOT NULL, "effective_from" date NOT NULL DEFAULT ('now'::text)::date, "effective_to" date, "status" character varying(30) NOT NULL DEFAULT 'ACTIVE', "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e34f3bf94648197abf94aa2eaae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "motor_fleets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "quotation_id" uuid, "policy_id" uuid, "fleet_no" character varying(50) NOT NULL, "fleet_name" character varying(150), "total_vehicles" integer NOT NULL DEFAULT '0', "derived_vehicle_count" integer NOT NULL DEFAULT '0', "total_sum_insured" numeric(18,2) NOT NULL DEFAULT '0', "total_premium" numeric(18,2) NOT NULL DEFAULT '0', "snapshot_version" integer NOT NULL DEFAULT '1', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "tiramis_payload" jsonb, "tiramis_submission_tracking_id" uuid, "tiramis_status" character varying(50), "tiramis_transaction_id" uuid, "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_7b5c3eefa1efb46e971120af811" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_motor_fleets_company_fleet_no" ON "motor_fleets" ("company_id", "fleet_no") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_motor_fleets_company_customer_id" ON "motor_fleets" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_motor_fleets_company_id" ON "motor_fleets" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."insurance_company_partners_partner_type_enum" AS ENUM('REINSURANCE_COMPANY', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'SERVICE_PROVIDER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."insurance_company_partners_status_enum" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "insurance_company_partners" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid NOT NULL, "partner_type" "public"."insurance_company_partners_partner_type_enum" NOT NULL, "status" "public"."insurance_company_partners_status_enum" NOT NULL DEFAULT 'PENDING', "commission_rate" numeric(18,10), "start_date" date, "end_date" date, "agreement_reference" character varying(100), "agreement_document_url" character varying(500), "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "suspension_reason" text, "termination_reason" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_87d2e2dcedc2eb84c163f73ff41" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_current_agency_one_insurer" ON "insurance_company_partners" ("intermediary_company_id") WHERE partner_type = 'AGENCY' AND deleted_at IS NULL AND status IN ('PENDING', 'ACTIVE', 'SUSPENDED')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_partner_company" ON "insurance_company_partners" ("intermediary_company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_partner_insurer" ON "insurance_company_partners" ("insurer_company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "signature_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "request_no" character varying(100) NOT NULL, "document_id" uuid NOT NULL, "document_version_id" uuid NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "signature_provider" character varying(50) NOT NULL, "provider_request_id" character varying(150), "signing_order_required" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP WITH TIME ZONE, "completion_document_version_id" uuid, "evidence_document_id" uuid, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_1b2cf564737105656c49d56f1d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "signature_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "signature_request_id" uuid NOT NULL, "participant_type" character varying(30) NOT NULL, "participant_id" uuid, "name" character varying(200) NOT NULL, "email" character varying(255), "phone" character varying(50), "signing_order" integer, "status" character varying(30) NOT NULL DEFAULT 'PENDING', "access_token_hash" character varying(64), "signed_at" TIMESTAMP WITH TIME ZONE, "declined_at" TIMESTAMP WITH TIME ZONE, "decline_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4547fc6853629c3f4f8cc3e5d8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "signature_evidence" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "signature_request_id" uuid NOT NULL, "participant_id" uuid NOT NULL, "evidence_type" character varying(30) NOT NULL, "ip_address" inet, "user_agent" text, "payload" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5f15b82ad49a56bf75f28f0d5a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "signature_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "signature_request_id" uuid NOT NULL, "event_type" character varying(40) NOT NULL, "actor_id" uuid, "actor_type" character varying(30) NOT NULL, "notes" text, "payload" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d993f8da8c3ac67228e91f79c45" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "document_id" uuid NOT NULL, "version_number" integer NOT NULL, "status" character varying(30) NOT NULL, "storage_provider" character varying(40) NOT NULL, "storage_bucket" character varying(150), "storage_key" character varying(500) NOT NULL, "original_file_name" character varying(255), "safe_file_name" character varying(255) NOT NULL, "declared_mime_type" character varying(100), "detected_mime_type" character varying(100) NOT NULL, "detected_extension" character varying(20), "file_size" bigint NOT NULL, "sha256_hash" character varying(64) NOT NULL, "encryption_key_reference" character varying(200), "source_snapshot" jsonb, "source_snapshot_hash" character varying(64), "template_code" character varying(100), "template_version" integer, "generator_version" character varying(50), "page_count" integer, "scan_status" character varying(30) NOT NULL DEFAULT 'PENDING', "scan_provider" character varying(50), "scan_reference" character varying(150), "scanned_at" TIMESTAMP WITH TIME ZONE, "scan_result" jsonb, "uploaded_by" uuid, "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL, "supersedes_version_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_baf26dab035c6d6fc433f9dc6a2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_document_versions_document" ON "document_versions" ("document_id", "version_number") `,
    );
    await queryRunner.query(
      `CREATE TABLE "document_access_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "document_id" uuid NOT NULL, "document_version_id" uuid, "actor_type" character varying(30) NOT NULL, "actor_id" uuid, "action" character varying(30) NOT NULL, "access_channel" character varying(30) NOT NULL, "purpose" character varying(500), "ip_address" inet, "user_agent" text, "result" character varying(30) NOT NULL, "failure_reason" character varying(200), "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_5000ec9ff8ff1dc81401dd1f9b7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "document_id" uuid NOT NULL, "link_type" character varying(40) NOT NULL, "linked_record_type" character varying(60) NOT NULL, "linked_record_id" uuid NOT NULL, "customer_visible" boolean NOT NULL DEFAULT false, "intermediary_visible" boolean NOT NULL DEFAULT false, "label" character varying(180), "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_462367301c7f0a30fc3fbaa4ea9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_upload_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "requested_by_type" character varying(30) NOT NULL, "requested_by_id" uuid NOT NULL, "resource_type" character varying(50) NOT NULL, "resource_id" uuid NOT NULL, "document_type" character varying(80) NOT NULL, "classification" character varying(30) NOT NULL, "maximum_bytes" bigint NOT NULL, "allowed_mime_types" jsonb NOT NULL, "customer_visible" boolean NOT NULL DEFAULT false, "intermediary_visible" boolean NOT NULL DEFAULT false, "link_type" character varying(40), "link_label" character varying(180), "status" character varying(30) NOT NULL DEFAULT 'PENDING', "upload_token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "document_id" uuid, "document_version_id" uuid, "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_288ea64fc94e2896791f71b1506" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "document_no" character varying(100), "owner_type" character varying(60) NOT NULL, "owner_id" uuid, "title" character varying(255), "document_type" character varying(80), "classification" character varying(30) NOT NULL DEFAULT 'INTERNAL', "source_type" character varying(30), "storage_key" character varying(500) NOT NULL, "checksum" character varying(128) NOT NULL, "content_type" character varying(150), "file_name" character varying(255) NOT NULL, "file_size" bigint, "status" character varying(30) NOT NULL DEFAULT 'UPLOAD_PENDING', "current_version_id" uuid, "customer_visible" boolean NOT NULL DEFAULT false, "intermediary_visible" boolean NOT NULL DEFAULT false, "public_verification_enabled" boolean NOT NULL DEFAULT false, "public_verification_code" character varying(120), "retention_policy_code" character varying(80), "retention_until" TIMESTAMP WITH TIME ZONE, "legal_hold" boolean NOT NULL DEFAULT false, "legal_hold_reason" text, "uploaded_by" uuid, "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "verified_by" uuid, "verified_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "created_by" uuid, "archived_at" TIMESTAMP WITH TIME ZONE, "deleted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_owner" ON "documents" ("company_id", "owner_type", "owner_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "document_template_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "template_id" uuid NOT NULL, "version_number" integer NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "template_content" text NOT NULL, "stylesheet_content" text, "header_content" text, "footer_content" text, "variable_schema" jsonb NOT NULL, "sample_data" jsonb, "template_hash" character varying(64) NOT NULL, "created_by" uuid NOT NULL, "approved_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "approved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e2f292922cd262d6f568c632e73" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid, "template_code" character varying(100) NOT NULL, "template_name" character varying(200) NOT NULL, "document_type" character varying(80) NOT NULL, "engine" character varying(30) NOT NULL, "scope" character varying(30) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "active_version_id" uuid, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0372838b7b7cd3571aef80466d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_security_scans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "document_version_id" uuid NOT NULL, "scan_type" character varying(40) NOT NULL, "provider" character varying(50) NOT NULL, "status" character varying(30) NOT NULL, "result_code" character varying(80), "result_message" text, "details" jsonb, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ac2b318dfb236d29e64f81c0572" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "communication_threads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "thread_no" character varying(100) NOT NULL, "thread_type" character varying(40) NOT NULL DEFAULT 'GENERAL', "subject" character varying(255) NOT NULL, "resource_type" character varying(80), "resource_id" uuid, "customer_visible" boolean NOT NULL DEFAULT false, "intermediary_visible" boolean NOT NULL DEFAULT false, "closed_at" TIMESTAMP WITH TIME ZONE, "closed_by" uuid, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b5ec5e48b918b685482e538fdf7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "communication_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "thread_id" uuid NOT NULL, "direction" character varying(20) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'SENT', "channel" character varying(20) NOT NULL DEFAULT 'IN_APP', "subject" character varying(255), "body_text" text, "body_html" text, "sender_type" character varying(30), "sender_id" uuid, "recipient_type" character varying(30), "recipient_id" uuid, "provider" character varying(50), "provider_message_id" character varying(150), "internal_only" boolean NOT NULL DEFAULT false, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9aad48c5013416feccdfb1f4352" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "complaints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "claim_id" uuid, "policy_id" uuid, "customer_id" uuid NOT NULL, "complaint_no" character varying(80) NOT NULL, "category" character varying(100) NOT NULL, "subject" character varying(180) NOT NULL, "description" text NOT NULL, "priority" character varying(20) NOT NULL DEFAULT 'MEDIUM', "status" character varying(30) NOT NULL DEFAULT 'OPEN', "reported_channel" character varying(100) NOT NULL, "assigned_user_id" uuid, "acknowledged_by" uuid, "acknowledged_at" TIMESTAMP WITH TIME ZONE, "resolution" text, "resolved_by" uuid, "resolved_at" TIMESTAMP WITH TIME ZONE, "escalated_by" uuid, "escalated_at" TIMESTAMP WITH TIME ZONE, "escalation_reason" text, "closed_by" uuid, "closed_at" TIMESTAMP WITH TIME ZONE, "closure_reason" text, "reopened_by" uuid, "reopened_at" TIMESTAMP WITH TIME ZONE, "cancelled_by" uuid, "cancelled_at" TIMESTAMP WITH TIME ZONE, "complainant_type" character varying(40) NOT NULL DEFAULT 'CUSTOMER', "complainant_snapshot" jsonb, "source_channel" character varying(40) NOT NULL DEFAULT 'INTERNAL', "source_reference" character varying(150), "invoice_id" uuid, "payment_id" uuid, "assigned_team" character varying(100), "root_cause" text, "corrective_action" text, "preventive_action" text, "regulatory_reportable" boolean NOT NULL DEFAULT false, "customer_acceptance_status" character varying(30) NOT NULL DEFAULT 'PENDING', "customer_response" text, "customer_responded_at" TIMESTAMP WITH TIME ZONE, "acknowledgement_due_at" TIMESTAMP WITH TIME ZONE, "resolution_due_at" TIMESTAMP WITH TIME ZONE, "appeal_count" integer NOT NULL DEFAULT '0', "state_version" integer NOT NULL DEFAULT '1', "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4b7566a2a489c2cc7c12ed076ad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "complaint_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "complaint_id" uuid NOT NULL, "old_status" character varying(30), "new_status" character varying(30) NOT NULL, "reason" text NOT NULL, "changed_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f1a4835ad43ef2c46d6faa3f256" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "complaint_sla_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid, "event_type" character varying(60) NOT NULL, "duration_hours" integer NOT NULL, "warning_hours_before" integer NOT NULL DEFAULT '0', "effective_from" date NOT NULL, "effective_to" date, "is_active" boolean NOT NULL DEFAULT true, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9a35dd19c4747c8adcaf2e96681" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "complaint_sla_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "complaint_id" uuid NOT NULL, "event_type" character varying(60) NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "due_at" TIMESTAMP WITH TIME ZONE NOT NULL, "warning_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "breached_at" TIMESTAMP WITH TIME ZONE, "status" character varying(20) NOT NULL DEFAULT 'PENDING', "rule_snapshot" jsonb, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_73b94b1dfe9050a1d8586a19cdf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "complaint_comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "complaint_id" uuid NOT NULL, "body" text NOT NULL, "is_customer_visible" boolean NOT NULL DEFAULT false, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f78297102d686643a5c4f4ede67" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "complaint_appeals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "complaint_id" uuid NOT NULL, "appeal_no" character varying(80) NOT NULL, "reason" text NOT NULL, "filed_by" uuid NOT NULL, "filed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "decision" character varying(30), "decided_by" uuid, "decided_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_complaint_appeal_no" UNIQUE ("company_id", "appeal_no"), CONSTRAINT "PK_1053c8b1927ff5b7a29fd82f7d4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_assessments" ("tiramis_submission_tracking_id" uuid, "tiramis_status" character varying(50), "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "claim_id" uuid NOT NULL, "service_assignment_id" uuid, "claim_assessment_number" character varying(80) NOT NULL, "claim_intimation_number" character varying(80), "claim_reference_number" character varying(100), "cover_note_reference_number" character varying(100) NOT NULL, "assessment_received_date" TIMESTAMP WITH TIME ZONE NOT NULL, "assessment_report_summary" text NOT NULL, "currency_code" character varying(10) NOT NULL, "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1', "assessment_amount" numeric(18,2) NOT NULL DEFAULT '0', "approved_claim_amount" numeric(18,2) NOT NULL DEFAULT '0', "claim_approval_date" TIMESTAMP WITH TIME ZONE, "claim_approval_authority" character varying(180), "is_re_assessment" character varying(1) NOT NULL DEFAULT 'N', "claimants" jsonb NOT NULL DEFAULT '[]', "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "created_by" uuid, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "rejected_by" uuid, "rejected_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_59feee59dc29e866eeadcbe0ced" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_claimants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "claim_id" uuid NOT NULL, "customer_id" uuid, "claimant_type" character varying(40) NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "full_name" character varying(180) NOT NULL, "identification_type" character varying(50), "identification_number" character varying(100), "phone" character varying(50), "email" character varying(150), "amount_claimed" numeric(18,2) NOT NULL DEFAULT '0', "amount_approved" numeric(18,2) NOT NULL DEFAULT '0', "amount_paid" numeric(18,2) NOT NULL DEFAULT '0', "status" character varying(30) NOT NULL DEFAULT 'ACTIVE', "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_9b8ef824e65e634f43464b253e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "claim_id" uuid NOT NULL, "document_id" uuid, "document_type" character varying(80) NOT NULL, "requirement_code" character varying(80), "title" character varying(180) NOT NULL, "storage_key" character varying(500) NOT NULL, "file_name" character varying(255) NOT NULL, "mime_type" character varying(120), "file_size" bigint, "checksum" character varying(128), "status" character varying(30) NOT NULL DEFAULT 'UPLOADED', "uploaded_by" uuid, "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL, "verified_by" uuid, "verified_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "expires_at" TIMESTAMP WITH TIME ZONE, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_926ac9a44ec173769f00b65b841" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_payments" ("tiramis_submission_tracking_id" uuid, "tiramis_status" character varying(50), "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "sale_point_id" uuid, "claim_id" uuid NOT NULL, "claimant_id" uuid, "discharge_voucher_id" uuid, "claim_payment_number" character varying(80) NOT NULL, "claim_reference_number" character varying(100), "claim_intimation_number" character varying(80), "cover_note_reference_number" character varying(100) NOT NULL, "payment_date" TIMESTAMP WITH TIME ZONE, "paid_amount" numeric(18,2) NOT NULL DEFAULT '0', "payment_mode" integer NOT NULL DEFAULT '1', "payment_method" character varying(100), "payment_reference" character varying(120), "parties_notified" character varying(1) NOT NULL DEFAULT 'N', "net_premium_earned" numeric(18,2) NOT NULL DEFAULT '0', "claim_resulted_litigation" character varying(1) NOT NULL DEFAULT 'N', "litigation_reason" text, "currency_code" character varying(10) NOT NULL, "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1', "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "created_by" uuid, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "paid_by" uuid, "paid_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "payment_type" character varying(40) NOT NULL DEFAULT 'INDEMNITY', "payee_type" character varying(40), "payee_id" uuid, "payee_snapshot" jsonb, "payment_snapshot" jsonb, "payment_snapshot_hash" character varying(64), "finance_disbursement_id" uuid, "finance_status" character varying(40) NOT NULL DEFAULT 'NOT_REQUESTED', "finance_event_id" character varying(180), "state_version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9bcf2d187326230d3847508f40d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_reserves" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "claim_id" uuid NOT NULL, "reserve_no" character varying(60) NOT NULL, "reserve_type" character varying(50) NOT NULL, "amount" numeric(18,2) NOT NULL, "currency" character varying(10) NOT NULL, "reason" text NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "effective_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_by" uuid, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "rejected_by" uuid, "rejected_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "released_by" uuid, "released_at" TIMESTAMP WITH TIME ZONE, "release_reason" text, "supersedes_reserve_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_15f091f1cb9f1d75ad9c6ab177a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "claim_id" uuid NOT NULL, "old_status" character varying(30), "new_status" character varying(30) NOT NULL, "reason" text NOT NULL, "changed_by" uuid, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_65b019b6e804e5f3f201353b19d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claims" ("tiramis_submission_tracking_id" uuid, "tiramis_status" character varying(50), "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid, "reported_by_company_id" uuid, "branch_id" uuid, "reported_branch_id" uuid, "sale_point_id" uuid, "policy_id" uuid NOT NULL, "policy_risk_id" uuid, "customer_id" uuid NOT NULL, "assigned_user_id" uuid, "reported_by_user_id" uuid, "created_by" uuid, "claim_no" character varying(60) NOT NULL, "claim_notification_number" character varying(80) NOT NULL, "claim_reference_number" character varying(100), "cover_note_reference_number" character varying(100) NOT NULL, "claim_report_date" TIMESTAMP WITH TIME ZONE NOT NULL, "loss_date" TIMESTAMP WITH TIME ZONE NOT NULL, "loss_nature" character varying(150) NOT NULL, "loss_type" character varying(100) NOT NULL, "loss_location" text NOT NULL, "description" text NOT NULL, "cause_of_loss" text, "police_report_number" character varying(100), "claim_form_dully_filled" character varying(1) NOT NULL DEFAULT 'N', "officer_name" character varying(150), "officer_title" character varying(100), "currency_code" character varying(10) NOT NULL DEFAULT 'TZS', "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1', "estimated_amount" numeric(18,2) NOT NULL DEFAULT '0', "approved_amount" numeric(18,2) NOT NULL DEFAULT '0', "paid_amount" numeric(18,2) NOT NULL DEFAULT '0', "outstanding_reserve" numeric(18,2) NOT NULL DEFAULT '0', "recovery_expected" numeric(18,2) NOT NULL DEFAULT '0', "recovery_received" numeric(18,2) NOT NULL DEFAULT '0', "status" character varying(30) NOT NULL DEFAULT 'NOTIFIED', "priority" character varying(20) NOT NULL DEFAULT 'MEDIUM', "liability_status" character varying(30) NOT NULL DEFAULT 'PENDING', "fraud_indicator" boolean NOT NULL DEFAULT false, "litigation_indicator" boolean NOT NULL DEFAULT false, "closed_by" uuid, "closed_at" TIMESTAMP WITH TIME ZONE, "closure_reason" text, "claim_stage" character varying(40) NOT NULL DEFAULT 'NOTIFICATION_PENDING', "coverage_status" character varying(40) NOT NULL DEFAULT 'NOT_EVALUATED', "settlement_status" character varying(40) NOT NULL DEFAULT 'NOT_READY', "fraud_status" character varying(40) NOT NULL DEFAULT 'NOT_SCREENED', "policy_version_id" uuid, "policy_version_number" integer, "policy_snapshot" jsonb, "policy_snapshot_hash" character varying(64), "coverage_snapshot" jsonb, "coverage_snapshot_hash" character varying(64), "incident_snapshot" jsonb, "incident_snapshot_hash" character varying(64), "claimant_manifest_hash" character varying(64), "duplicate_fingerprint" character varying(64), "possible_duplicate_of_id" uuid, "duplicate_override_reason" text, "duplicate_override_by" uuid, "gross_case_reserve" numeric(18,2) NOT NULL DEFAULT '0', "gross_incurred_amount" numeric(18,2) NOT NULL DEFAULT '0', "expense_paid_amount" numeric(18,2) NOT NULL DEFAULT '0', "indemnity_paid_amount" numeric(18,2) NOT NULL DEFAULT '0', "total_recovery_expected" numeric(18,2) NOT NULL DEFAULT '0', "total_recovery_received" numeric(18,2) NOT NULL DEFAULT '0', "net_incurred_amount" numeric(18,2) NOT NULL DEFAULT '0', "current_assessment_id" uuid, "current_discharge_voucher_id" uuid, "source_channel" character varying(40) NOT NULL DEFAULT 'INTERNAL', "state_version" integer NOT NULL DEFAULT '1', "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_96c91970c0dcb2f69fdccd0a698" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_claims_assigned_user" ON "claims" ("company_id", "assigned_user_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_claims_company_status" ON "claims" ("company_id", "status", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_sla_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid, "event_type" character varying(80) NOT NULL, "duration_hours" integer NOT NULL, "warning_hours_before" integer NOT NULL DEFAULT '0', "effective_from" date NOT NULL, "effective_to" date, "is_active" boolean NOT NULL DEFAULT true, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7118781b8ca7a746397420d638a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_sla_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "claim_id" uuid NOT NULL, "event_type" character varying(80) NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "due_at" TIMESTAMP WITH TIME ZONE NOT NULL, "warning_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "breached_at" TIMESTAMP WITH TIME ZONE, "status" character varying(30) NOT NULL DEFAULT 'PENDING', "rule_snapshot" jsonb, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4896ebd378cf439d64e54d35fba" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_service_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "claim_id" uuid NOT NULL, "provider_company_id" uuid, "assigned_user_id" uuid, "service_type" character varying(80) NOT NULL, "assignment_no" character varying(80) NOT NULL, "instructions" text, "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL, "due_at" TIMESTAMP WITH TIME ZONE, "accepted_at" TIMESTAMP WITH TIME ZONE, "declined_at" TIMESTAMP WITH TIME ZONE, "decline_reason" text, "report_submitted_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "estimated_fee" numeric(18,2) NOT NULL DEFAULT '0', "approved_fee" numeric(18,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'ASSIGNED', "created_by" uuid, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4b39fb35b15bfd22e9ba59a767d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_reserve_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "claim_id" uuid NOT NULL, "reserve_id" uuid NOT NULL, "movement_no" character varying(80) NOT NULL, "movement_type" character varying(30) NOT NULL, "amount" numeric(18,2) NOT NULL, "signed_amount" numeric(18,2) NOT NULL, "currency_code" character varying(3) NOT NULL, "effective_at" TIMESTAMP WITH TIME ZONE NOT NULL, "reason" text NOT NULL, "source_event_id" character varying(180) NOT NULL, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_claim_reserve_source_event" UNIQUE ("company_id", "source_event_id"), CONSTRAINT "UQ_claim_reserve_movement_no" UNIQUE ("company_id", "movement_no"), CONSTRAINT "PK_c5971106b2d283b0f1707a3ca43" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_rejections" ("tiramis_submission_tracking_id" uuid, "tiramis_status" character varying(50), "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "claim_id" uuid NOT NULL, "claim_rejection_number" character varying(80) NOT NULL, "claim_reference_number" character varying(100), "cover_note_reference_number" character varying(100) NOT NULL, "rejection_date" TIMESTAMP WITH TIME ZONE NOT NULL, "rejection_reason" text NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'APPROVED', "created_by" uuid, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0c57bd96df7363a4a0498b1b388" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_regulatory_operations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "claim_id" uuid NOT NULL, "operation_type" character varying(40) NOT NULL, "source_record_id" uuid NOT NULL, "source_record_number" character varying(100) NOT NULL, "sequence_number" integer NOT NULL, "status" character varying(40) NOT NULL DEFAULT 'NOT_SUBMITTED', "tiramis_tracking_id" uuid, "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "regulatory_reference" character varying(150), "request_snapshot" jsonb NOT NULL, "request_snapshot_hash" character varying(64) NOT NULL, "response_snapshot" jsonb, "response_snapshot_hash" character varying(64), "acknowledgement_code" character varying(40), "acknowledgement_message" text, "final_response_code" character varying(40), "final_response_message" text, "signature_verified" boolean, "submitted_at" TIMESTAMP WITH TIME ZONE, "acknowledged_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_claim_regulatory_sequence" UNIQUE ("claim_id", "operation_type", "sequence_number"), CONSTRAINT "UQ_claim_regulatory_source" UNIQUE ("operation_type", "source_record_id"), CONSTRAINT "PK_7709d35357d30999a27df1f4549" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_recoveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "claim_id" uuid NOT NULL, "recovery_no" character varying(80) NOT NULL, "recovery_type" character varying(40) NOT NULL, "expected_amount" numeric(18,2) NOT NULL DEFAULT '0', "received_amount" numeric(18,2) NOT NULL DEFAULT '0', "status" character varying(30) NOT NULL DEFAULT 'EXPECTED', "notes" text, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e426f284465f8b6b18666a4d813" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_intimations" ("tiramis_submission_tracking_id" uuid, "tiramis_status" character varying(50), "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "claim_id" uuid NOT NULL, "claim_intimation_number" character varying(80) NOT NULL, "claim_reference_number" character varying(100), "cover_note_reference_number" character varying(100) NOT NULL, "claim_intimation_date" TIMESTAMP WITH TIME ZONE NOT NULL, "currency_code" character varying(10) NOT NULL, "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1', "claim_estimated_amount" numeric(18,2) NOT NULL DEFAULT '0', "claim_reserve_amount" numeric(18,2) NOT NULL DEFAULT '0', "claim_reserve_method" character varying(100) NOT NULL, "loss_assessment_option" integer NOT NULL DEFAULT '1', "assessor_name" character varying(180), "assessor_id_number" character varying(100), "assessor_id_type" integer, "claimants" jsonb NOT NULL DEFAULT '[]', "status" character varying(30) NOT NULL DEFAULT 'CREATED', "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_189c0a735a5c41e448d3e0e60df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_discharge_vouchers" ("tiramis_submission_tracking_id" uuid, "tiramis_status" character varying(50), "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "tiramis_acknowledgement_status_code" character varying(20), "tiramis_acknowledgement_status_desc" character varying(255), "tiramis_final_response_id" character varying(100), "tiramis_final_response_status_code" character varying(20), "tiramis_final_response_status_desc" character varying(255), "tiramis_last_error_message" text, "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "claim_id" uuid NOT NULL, "claimant_id" uuid, "discharge_voucher_number" character varying(80) NOT NULL, "claim_assessment_number" character varying(80), "claim_reference_number" character varying(100), "cover_note_reference_number" character varying(100) NOT NULL, "discharge_voucher_date" TIMESTAMP WITH TIME ZONE NOT NULL, "currency_code" character varying(10) NOT NULL, "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1', "claim_offer_communication_date" TIMESTAMP WITH TIME ZONE NOT NULL, "claim_offer_amount" numeric(18,2) NOT NULL DEFAULT '0', "claimant_response_date" TIMESTAMP WITH TIME ZONE, "offer_accepted" character varying(1) NOT NULL DEFAULT 'N', "signed_document_id" uuid, "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "created_by" uuid, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "rejected_by" uuid, "rejected_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6f9c1b00b1d93f0f5ada8d13683" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_disbursements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "claim_id" uuid NOT NULL, "claim_payment_id" uuid NOT NULL, "disbursement_no" character varying(80) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'REQUESTED', "payment_method" character varying(40), "amount" numeric(18,2) NOT NULL, "currency_code" character varying(3) NOT NULL, "payee_snapshot" jsonb, "requested_by" uuid NOT NULL, "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "confirmed_by" uuid, "confirmed_at" TIMESTAMP WITH TIME ZONE, "provider_reference" character varying(180), "failed_at" TIMESTAMP WITH TIME ZONE, "failure_message" text, "idempotency_key" character varying(180) NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_claim_disbursement_idempotency" UNIQUE ("company_id", "idempotency_key"), CONSTRAINT "UQ_claim_disbursement_no" UNIQUE ("company_id", "disbursement_no"), CONSTRAINT "PK_ad453eb293e5ff2ec7be61e2ee2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim_decisions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "claim_id" uuid NOT NULL, "assessment_id" uuid, "decision_no" character varying(80) NOT NULL, "decision_type" character varying(40) NOT NULL, "liability_status" character varying(40) NOT NULL, "amount_claimed" numeric(18,2) NOT NULL, "amount_admitted" numeric(18,2) NOT NULL, "amount_declined" numeric(18,2) NOT NULL, "currency_code" character varying(3) NOT NULL, "reason" text NOT NULL, "decision_snapshot" jsonb NOT NULL, "decision_snapshot_hash" character varying(64) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "created_by" uuid NOT NULL, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "rejected_by" uuid, "rejected_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_claim_decision_no" UNIQUE ("company_id", "decision_no"), CONSTRAINT "PK_9a6ca0f8c4738c96c89f9bcb220" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_category_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "company_user_id" uuid NOT NULL, "category_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" character varying NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_user_category_access_company_user_category" UNIQUE ("company_id", "company_user_id", "category_id"), CONSTRAINT "PK_42f27aa39733c40d8e9f78a5004" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_category_access_category_id" ON "user_category_access" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_category_access_company_user_id" ON "user_category_access" ("company_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_category_access_company_id" ON "user_category_access" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "department_category_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "department_id" uuid NOT NULL, "category_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" character varying NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_dept_category_access_company_dept_category" UNIQUE ("company_id", "department_id", "category_id"), CONSTRAINT "PK_752d1a9d5279e7a0daad5816778" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dept_category_access_category_id" ON "department_category_access" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dept_category_access_department_id" ON "department_category_access" ("department_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dept_category_access_company_id" ON "department_category_access" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "branch_category_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "category_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" character varying NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" character varying, "updated_by" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_branch_category_access_company_branch_category" UNIQUE ("company_id", "branch_id", "category_id"), CONSTRAINT "PK_0bb65af9ec72a41813e07119e07" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_category_access_category_id" ON "branch_category_access" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_category_access_branch_id" ON "branch_category_access" ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_category_access_company_id" ON "branch_category_access" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "invoice_id" uuid, "customer_id" uuid, "receipt_id" uuid, "transaction_no" character varying(80), "provider" character varying(50) NOT NULL, "provider_code" character varying(50), "provider_reference" character varying(100) NOT NULL, "provider_transaction_id" character varying(150), "provider_event_id" character varying(150), "internal_reference" character varying(100) NOT NULL, "payment_method" character varying(40), "amount" numeric(18,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "provider_amount" numeric(20,4), "provider_currency_code" character varying(3), "exchange_rate" numeric(20,10) NOT NULL DEFAULT '1', "status" character varying(20) NOT NULL DEFAULT 'PENDING', "payer_name" character varying(180), "payer_phone" character varying(50), "payer_email" character varying(180), "payment_reference" character varying(180), "bank_reference" character varying(180), "channel_reference" character varying(180), "idempotency_key" character varying(180), "request_hash" character varying(64), "provider_payload_hash" character varying(64), "provider_payload_redacted" jsonb, "request_payload" jsonb, "response_payload" jsonb, "reconciliation_status" character varying(20) NOT NULL DEFAULT 'UNMATCHED', "received_at" TIMESTAMP WITH TIME ZONE, "settled_at" TIMESTAMP WITH TIME ZONE, "failed_at" TIMESTAMP WITH TIME ZONE, "failure_code" character varying(100), "failure_message" text, "reconciled_by" uuid, "reconciled_at" TIMESTAMP WITH TIME ZONE, "bank_statement_line_id" uuid, "reversed_by" uuid, "reversed_at" TIMESTAMP WITH TIME ZONE, "reversal_reason" text, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d32b3c6b0d2c1d22604cbcc8c49" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_transactions_receipt_id" ON "payment_transactions" ("receipt_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_transactions_invoice_id" ON "payment_transactions" ("invoice_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_transactions_company_id" ON "payment_transactions" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "payment_transaction_id" uuid, "payer_customer_id" uuid, "invoice_id" uuid, "branch_id" uuid, "sale_point_id" uuid, "receipt_no" character varying(50) NOT NULL, "payment_method" character varying(50) NOT NULL, "payer_name" character varying(180), "amount" numeric(18,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "exchange_rate" numeric(20,10) NOT NULL DEFAULT '1', "base_currency_code" character varying(3), "base_currency_amount" numeric(20,4), "allocated_amount" numeric(20,4) NOT NULL DEFAULT '0', "unallocated_amount" numeric(18,2) NOT NULL DEFAULT '0', "payment_reference" character varying(100), "provider_reference" character varying(180), "receipt_hash" character varying(64), "state_version" integer NOT NULL DEFAULT '1', "received_by" uuid, "received_at" TIMESTAMP WITH TIME ZONE, "status" character varying(20) NOT NULL DEFAULT 'RECEIVED', "posted_by" uuid, "posted_at" TIMESTAMP WITH TIME ZONE, "reversed_by" uuid, "reversed_at" TIMESTAMP WITH TIME ZONE, "reversal_reason" text, "reversal_receipt_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_5e8182d7c29e023da6e1ff33bfe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_receipts_company_receipt_no" ON "receipts" ("company_id", "receipt_no") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_receipts_company_customer_id" ON "receipts" ("company_id", "customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_receipts_company_id" ON "receipts" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "receipt_allocations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "receipt_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "amount" numeric(18,2) NOT NULL, "currency" character varying(10) NOT NULL, "allocation_hash" character varying(64), "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "allocated_by" uuid, "allocated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reversed_by" uuid, "reversed_at" TIMESTAMP WITH TIME ZONE, "reversal_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a651cc7e3a63d31f0ea41d77e83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_receipt_allocation_invoice" ON "receipt_allocations" ("company_id", "invoice_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "financial_reversals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "reversal_no" character varying(60) NOT NULL, "resource_type" character varying(50) NOT NULL, "resource_id" uuid NOT NULL, "original_amount" numeric(18,2) NOT NULL, "reversal_amount" numeric(18,2) NOT NULL, "currency" character varying(10) NOT NULL, "reason" text NOT NULL, "created_by" uuid, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_791c6671d5abfd5013916fafebd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_financial_reversal_no" ON "financial_reversals" ("company_id", "reversal_no") `,
    );
    await queryRunner.query(
      `CREATE TABLE "finance_refunds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "refund_no" character varying(80) NOT NULL, "customer_id" uuid, "invoice_id" uuid, "receipt_id" uuid, "payment_transaction_id" uuid, "status" character varying(30) NOT NULL DEFAULT 'REQUESTED', "payment_method" character varying(40) NOT NULL, "amount" numeric(20,4) NOT NULL, "currency_code" character varying(3) NOT NULL, "reason" text NOT NULL, "requested_by" uuid NOT NULL, "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "provider_refund_id" character varying(180), "paid_by" uuid, "paid_at" TIMESTAMP WITH TIME ZONE, "failed_at" TIMESTAMP WITH TIME ZONE, "failure_message" text, "idempotency_key" character varying(180) NOT NULL, "refund_hash" character varying(64), "source_type" character varying(40), "source_record_id" uuid, "policy_id" uuid, "endorsement_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_96cfeb8d76ea4f38850f90bcadf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_finance_refund_source_receipt_invoice" ON "finance_refunds" ("company_id", "source_type", "source_record_id", "receipt_id", "invoice_id") WHERE source_type IS NOT NULL AND source_record_id IS NOT NULL AND receipt_id IS NOT NULL AND invoice_id IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_finance_refunds_source" ON "finance_refunds" ("company_id", "source_type", "source_record_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_finance_refund_number_entity" ON "finance_refunds" ("company_id", "refund_no") `,
    );
    await queryRunner.query(
      `CREATE TABLE "finance_reconciliation_batches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "batch_no" character varying(80) NOT NULL, "provider_code" character varying(50) NOT NULL, "account_reference" character varying(100), "statement_reference" character varying(150), "statement_date" date NOT NULL, "currency_code" character varying(3) NOT NULL, "opening_balance" numeric(20,4), "closing_balance" numeric(20,4), "statement_total" numeric(20,4) NOT NULL DEFAULT '0', "matched_total" numeric(20,4) NOT NULL DEFAULT '0', "unmatched_total" numeric(20,4) NOT NULL DEFAULT '0', "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "file_hash" character varying(64), "imported_by" uuid, "imported_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2f81c96238b4015290dfcded7ee" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_finance_reconciliation_batch_entity" ON "finance_reconciliation_batches" ("company_id", "batch_no") `,
    );
    await queryRunner.query(
      `CREATE TABLE "finance_reconciliation_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "batch_id" uuid NOT NULL, "line_number" integer NOT NULL, "transaction_date" date NOT NULL, "value_date" date, "description" text, "external_reference" character varying(180), "payer_reference" character varying(180), "amount" numeric(20,4) NOT NULL, "currency_code" character varying(3) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'UNMATCHED', "matched_payment_transaction_id" uuid, "matched_receipt_id" uuid, "match_score" numeric(8,4), "match_reason" text, "matched_by" uuid, "matched_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e4fba57c66d2dcfb6f63898c27c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reconciliation_batch_line_entity" ON "finance_reconciliation_items" ("batch_id", "line_number") `,
    );
    await queryRunner.query(
      `CREATE TABLE "finance_provider_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid, "provider_code" character varying(50) NOT NULL, "provider_event_id" character varying(180) NOT NULL, "event_type" character varying(80) NOT NULL, "signature_valid" boolean NOT NULL DEFAULT false, "payload_hash" character varying(64) NOT NULL, "payload_redacted" jsonb NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'RECEIVED', "payment_transaction_id" uuid, "processing_error" text, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "processed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_20e7b058d288b52b66403f7b92f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_finance_provider_event_entity" ON "finance_provider_events" ("provider_code", "provider_event_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "finance_outbox_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "aggregate_type" character varying(80) NOT NULL, "aggregate_id" uuid NOT NULL, "event_type" character varying(100) NOT NULL, "event_key" character varying(180) NOT NULL, "payload" jsonb NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'PENDING', "attempt_count" integer NOT NULL DEFAULT '0', "next_attempt_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ce52e38092f7e7bb95ba90985b0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_finance_outbox_event_key_entity" ON "finance_outbox_events" ("company_id", "event_key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "finance_journal_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "journal_no" character varying(80) NOT NULL, "journal_date" date NOT NULL, "source_type" character varying(50) NOT NULL, "source_id" uuid NOT NULL, "source_event_id" character varying(180) NOT NULL, "description" text NOT NULL, "currency_code" character varying(3) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'POSTED', "reversal_of_id" uuid, "posted_by" uuid, "posted_at" TIMESTAMP WITH TIME ZONE, "entry_hash" character varying(64) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3e93ff82fb503d62c4ca9d73fca" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_finance_journal_number_entity" ON "finance_journal_entries" ("company_id", "journal_no") `,
    );
    await queryRunner.query(
      `CREATE TABLE "finance_journal_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "journal_entry_id" uuid NOT NULL, "account_id" uuid NOT NULL, "customer_id" uuid, "intermediary_company_id" uuid, "description" text, "debit" numeric(20,4) NOT NULL DEFAULT '0', "credit" numeric(20,4) NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7502b44b0fff35cf51cbd1d66fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "finance_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "account_code" character varying(50) NOT NULL, "account_name" character varying(150) NOT NULL, "account_type" character varying(30) NOT NULL, "is_control_account" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_312bd8aacefb9f1a9163d4b4fe7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_finance_account_code_entity" ON "finance_accounts" ("company_id", "account_code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "commission_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "insurer_company_id" uuid NOT NULL, "intermediary_company_id" uuid NOT NULL, "policy_id" uuid, "quotation_id" uuid, "invoice_id" uuid, "receipt_id" uuid, "commission_rule_id" uuid, "distribution_option_id" uuid, "accrual_no" character varying(80), "commission_type" character varying(30) NOT NULL, "calculation_base" character varying(30) NOT NULL, "gross_premium" numeric(20,4) NOT NULL DEFAULT '0', "net_premium" numeric(20,4) NOT NULL DEFAULT '0', "commission_rate" numeric(18,10) NOT NULL DEFAULT '0', "commission_amount" numeric(20,4) NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'PENDING', "commission_snapshot" jsonb, "commission_snapshot_hash" character varying(64), "accrued_by" uuid, "earned_at" TIMESTAMP WITH TIME ZONE, "accrued_at" TIMESTAMP WITH TIME ZONE, "paid_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "paid_amount" numeric(20,4) NOT NULL DEFAULT '0', "balance_amount" numeric(20,4) NOT NULL DEFAULT '0', "reversed_by" uuid, "reversed_at" TIMESTAMP WITH TIME ZONE, "reversal_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a9d68af7a671bb3aaa9d24b6272" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commission_transactions_quotation_id" ON "commission_transactions" ("quotation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commission_transactions_status" ON "commission_transactions" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commission_transactions_policy_id" ON "commission_transactions" ("policy_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commission_transactions_company_id" ON "commission_transactions" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "commission_payment_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "commission_payment_id" uuid NOT NULL, "commission_transaction_id" uuid NOT NULL, "amount" numeric(18,2) NOT NULL DEFAULT '0', "status" character varying(30) NOT NULL DEFAULT 'ACTIVE', "allocated_by" uuid, "allocated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reversed_by" uuid, "reversed_at" TIMESTAMP WITH TIME ZONE, "reversal_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_64beb28f9839be438710aaa8b4e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cpi_commission_transaction_id" ON "commission_payment_items" ("commission_transaction_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cpi_commission_payment_id" ON "commission_payment_items" ("commission_payment_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "commission_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "intermediary_company_id" uuid NOT NULL, "branch_id" uuid, "sale_point_id" uuid, "payment_no" character varying(50) NOT NULL, "payment_method" character varying(50) NOT NULL, "idempotency_key" character varying(180), "payment_reference" character varying(100), "total_amount" numeric(18,2) NOT NULL DEFAULT '0', "allocated_amount" numeric(20,4) NOT NULL DEFAULT '0', "unallocated_amount" numeric(20,4) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "status" character varying(20) NOT NULL DEFAULT 'PENDING', "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "paid_by" uuid, "paid_at" TIMESTAMP WITH TIME ZONE, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "rejected_by" uuid, "rejected_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" text, "reversed_by" uuid, "reversed_at" TIMESTAMP WITH TIME ZONE, "reversal_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_acd76a7c1fc7895415bf945ae17" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_commission_payments_payment_no" ON "commission_payments" ("company_id", "payment_no") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commission_payments_intermediary_company_id" ON "commission_payments" ("intermediary_company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commission_payments_company_id" ON "commission_payments" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "analytics_metric_values" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "metric_code" character varying(100) NOT NULL, "period_type" character varying(40) NOT NULL, "period_start" date NOT NULL, "period_end" date NOT NULL, "value" numeric(24,8), "value_kind" character varying(30) NOT NULL, "currency_code" character varying(3), "dimensions" jsonb NOT NULL DEFAULT '{}', "dimensions_hash" character varying(64) NOT NULL, "formula_version" integer NOT NULL, "source_event_sequence" bigint NOT NULL DEFAULT '0', "calculated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "freshness" character varying(30) NOT NULL DEFAULT 'CURRENT', "freshness_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_df676eeb1cc0e268525f25191be" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "analytics_metric_definitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(100) NOT NULL, "name" character varying(180) NOT NULL, "description" text NOT NULL, "category" character varying(80) NOT NULL, "value_type" character varying(40) NOT NULL, "aggregation_type" character varying(40) NOT NULL, "formula_version" integer NOT NULL, "formula_description" text NOT NULL, "numerator_metric_code" character varying(100), "denominator_metric_code" character varying(100), "supported_dimensions" jsonb NOT NULL DEFAULT '[]', "supported_periods" jsonb NOT NULL DEFAULT '[]', "permission" character varying(150) NOT NULL, "sensitive" boolean NOT NULL DEFAULT false, "target_supported" boolean NOT NULL DEFAULT false, "forecast_supported" boolean NOT NULL DEFAULT false, "benchmark_supported" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_eb3d4a495970bee34fb9e31a448" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "refresh_token_hash" character varying(255) NOT NULL, "device_id" uuid, "family_id" uuid NOT NULL, "ip_address" character varying(45), "user_agent" text, "device_info" text, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "absolute_expires_at" TIMESTAMP WITH TIME ZONE, "idle_expires_at" TIMESTAMP WITH TIME ZONE, "revoked" boolean NOT NULL DEFAULT false, "revoked_at" TIMESTAMP WITH TIME ZONE, "revocation_reason" character varying(100), "authentication_strength" character varying(40) NOT NULL DEFAULT 'PASSWORD', "two_factor_verified_at" TIMESTAMP WITH TIME ZONE, "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_activity_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_ip_address" character varying(45), "risk_level" character varying(20) NOT NULL DEFAULT 'LOW', "compromised_at" TIMESTAMP WITH TIME ZONE, "previous_refresh_token_hash" character varying(255), "previous_refresh_rotated_at" TIMESTAMP WITH TIME ZONE, "security_events" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_sessions_family_active" ON "user_sessions" ("family_id", "revoked") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_sessions_device_active" ON "user_sessions" ("device_id", "revoked") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_sessions_user_active" ON "user_sessions" ("user_id", "revoked", "expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_expires_revoked" ON "user_sessions" ("expires_at", "revoked") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_user_id" ON "user_sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "security_policy_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid, "profile_code" character varying(80) NOT NULL, "profile_name" character varying(160) NOT NULL, "version_number" integer NOT NULL DEFAULT '1', "status" character varying(30) NOT NULL DEFAULT 'DRAFT', "description" text, "policy" jsonb NOT NULL DEFAULT '{}', "created_by" uuid, "approved_by" uuid, "effective_from" TIMESTAMP WITH TIME ZONE, "effective_to" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "approved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_31e01b0dfe244818477279b8922" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_security_policy_profile_version" ON "security_policy_profiles" ("company_id", "profile_code", "version_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_security_policy_company_status" ON "security_policy_profiles" ("company_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "legal_holds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid, "hold_code" character varying(80) NOT NULL, "resource_type" character varying(120) NOT NULL, "resource_id" character varying(120) NOT NULL, "reason" text NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_by" uuid, "released_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "released_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_bbe3e0c98678909493a90442dfb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_legal_hold_resource_active" ON "legal_holds" ("resource_type", "resource_id", "active") `,
    );
    await queryRunner.query(
      `CREATE TABLE "data_retention_policies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid, "policy_code" character varying(80) NOT NULL, "policy_name" character varying(160) NOT NULL, "resource_type" character varying(120) NOT NULL, "version_number" integer NOT NULL DEFAULT '1', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "action" character varying(20) NOT NULL DEFAULT 'RETAIN', "retention_days" integer NOT NULL DEFAULT '365', "dry_run_default" boolean NOT NULL DEFAULT true, "archive_before_delete" boolean NOT NULL DEFAULT false, "rules" jsonb NOT NULL DEFAULT '{}', "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f0272039a89c1c0aa616aedeaf5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_data_retention_policy_version" ON "data_retention_policies" ("company_id", "policy_code", "version_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_data_retention_company_status" ON "data_retention_policies" ("company_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "otp_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" character varying, "target" character varying(100) NOT NULL, "channel" character varying(10) NOT NULL, "purpose" character varying(30) NOT NULL, "otp_hash" character varying(255) NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "is_verified" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP NOT NULL, "verified_at" TIMESTAMP, "ip_address" character varying(45), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_91d17e75ac3182dba6701869b39" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_otp_user_id" ON "otp_verifications" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_otp_target_purpose" ON "otp_verifications" ("target", "purpose") `,
    );
    await queryRunner.query(
      `CREATE TABLE "devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "fingerprint" character varying(255) NOT NULL, "device_name" character varying(100), "device_type" character varying(50), "os" character varying(100), "browser" character varying(100), "trusted" boolean NOT NULL DEFAULT false, "trusted_at" TIMESTAMP WITH TIME ZONE, "trusted_until" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, "last_ip_address" character varying(45), "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_devices_user_fingerprint" UNIQUE ("user_id", "fingerprint"), CONSTRAINT "PK_b1514758245c12daf43486dd1f0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_devices_user_trusted" ON "devices" ("user_id", "trusted", "trusted_until") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_devices_user_id" ON "devices" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_no" bigint, "user_id" character varying, "company_id" character varying, "action" character varying(100) NOT NULL, "resource" character varying(100), "resource_id" character varying(100), "ip_address" character varying(45), "user_agent" text, "metadata" jsonb, "status" character varying(20) NOT NULL DEFAULT 'success', "company_membership_id" character varying, "branch_id" character varying, "session_id" character varying, "request_id" character varying(128), "correlation_id" character varying(128), "previous_event_hash" character varying(128), "event_hash" character varying(128), "actor_type" character varying(30) NOT NULL DEFAULT 'user', "actor_service" character varying(100), "event_category" character varying(80), "reason" text, "before_state" jsonb, "after_state" jsonb, "changed_fields" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_audit_event_no" ON "audit_logs" ("event_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_correlation_id" ON "audit_logs" ("correlation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_request_id" ON "audit_logs" ("request_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_company_created" ON "audit_logs" ("company_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_created_at" ON "audit_logs" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_action" ON "audit_logs" ("action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_user_id" ON "audit_logs" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "analytics_projection_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sequence_no" BIGSERIAL NOT NULL, "event_key" character varying(220) NOT NULL, "company_id" uuid, "branch_id" uuid, "source_module" character varying(80) NOT NULL, "aggregate_type" character varying(80) NOT NULL, "aggregate_id" uuid NOT NULL, "event_type" character varying(40) NOT NULL, "event_version" character varying(100) NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', "status" character varying(30) NOT NULL DEFAULT 'PENDING', "attempt_count" integer NOT NULL DEFAULT '0', "next_attempt_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "locked_at" TIMESTAMP WITH TIME ZONE, "processed_at" TIMESTAMP WITH TIME ZONE, "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_9a862cb327a1d1fcdcb3e7d6948" UNIQUE ("event_key"), CONSTRAINT "PK_594d8bfd0bbb944c9a6ba3d4c20" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_projection_events_pending" ON "analytics_projection_events" ("status", "next_attempt_at", "sequence_no") `,
    );
    await queryRunner.query(
      `CREATE TABLE "analytics_projection_checkpoints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projector_key" character varying(100) NOT NULL, "last_sequence_no" bigint NOT NULL DEFAULT '0', "last_processed_at" TIMESTAMP WITH TIME ZONE, "metadata" jsonb NOT NULL DEFAULT '{}', "company_id" uuid, "projection_code" character varying(100), "status" character varying(30) NOT NULL DEFAULT 'CURRENT', "last_event_sequence" bigint NOT NULL DEFAULT '0', "last_event_at" TIMESTAMP WITH TIME ZONE, "last_projected_at" TIMESTAMP WITH TIME ZONE, "failure_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c357f9935c8442a06b84d221b3e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "system_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "config_key" character varying(120) NOT NULL, "config_value" jsonb NOT NULL DEFAULT '{}', "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_29ac548e654c799fd885e1b9b71" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_system_configs_key" ON "system_configs" ("config_key") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_entitlements_value_type_enum" AS ENUM('BOOLEAN', 'INTEGER', 'DECIMAL', 'TEXT', 'JSON')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_entitlements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscription_id" uuid NOT NULL, "company_id" uuid NOT NULL, "feature_code" character varying(100) NOT NULL, "value_type" "public"."subscription_entitlements_value_type_enum" NOT NULL, "value" jsonb NOT NULL, "source" character varying(30) NOT NULL DEFAULT 'PLAN', "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "effective_to" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b3d4ec58e764e58b90c02770d43" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."saas_plans_billing_interval_enum" AS ENUM('MONTHLY', 'QUARTERLY', 'YEARLY')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."saas_plans_status_enum" AS ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "saas_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(60) NOT NULL, "name" character varying(150) NOT NULL, "description" text, "applicable_company_types" jsonb NOT NULL DEFAULT '[]', "billing_interval" "public"."saas_plans_billing_interval_enum" NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "base_price" numeric(20,2) NOT NULL DEFAULT '0', "trial_days" integer NOT NULL DEFAULT '0', "status" "public"."saas_plans_status_enum" NOT NULL DEFAULT 'DRAFT', "active_version_id" uuid, "current_version_number" integer NOT NULL DEFAULT '0', "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_ee5374051982b5e9a0610c78707" UNIQUE ("code"), CONSTRAINT "PK_7828a0c1b0c60456fdd27e9c31c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_changes_change_type_enum" AS ENUM('CREATED', 'UPGRADE', 'DOWNGRADE', 'RENEWAL', 'PLAN_CHANGED', 'REACTIVATION', 'SUSPENDED', 'UNSUSPENSION', 'CANCELLED', 'RESUMED', 'MANUAL_ADJUSTMENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_changes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscription_id" uuid NOT NULL, "company_id" uuid NOT NULL, "change_type" "public"."subscription_changes_change_type_enum" NOT NULL, "old_plan_version_id" uuid, "new_plan_version_id" uuid, "effective_at" TIMESTAMP WITH TIME ZONE NOT NULL, "change_summary" jsonb, "changed_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2fb5544fa5ee64a8f11ba29746f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."saas_plan_versions_status_enum" AS ENUM('DRAFT', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."saas_plan_versions_billing_interval_enum" AS ENUM('MONTHLY', 'QUARTERLY', 'YEARLY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "saas_plan_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plan_id" uuid NOT NULL, "version_number" integer NOT NULL, "status" "public"."saas_plan_versions_status_enum" NOT NULL DEFAULT 'DRAFT', "name" character varying(150) NOT NULL, "description" text, "billing_interval" "public"."saas_plan_versions_billing_interval_enum" NOT NULL, "currency" character varying(10) NOT NULL, "base_price" numeric(20,4) NOT NULL, "trial_days" integer NOT NULL DEFAULT '0', "feature_snapshot" jsonb NOT NULL DEFAULT '[]', "meter_rate_snapshot" jsonb NOT NULL DEFAULT '[]', "plan_snapshot" jsonb NOT NULL, "plan_snapshot_hash" character varying(64) NOT NULL, "effective_from" TIMESTAMP WITH TIME ZONE, "effective_to" TIMESTAMP WITH TIME ZONE, "created_by" uuid NOT NULL, "approved_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "approved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_397c5e31791cf15ac98a70686fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "saas_plan_meter_rates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plan_id" uuid NOT NULL, "metric_code" character varying(100) NOT NULL, "included_quantity" numeric(20,6) NOT NULL DEFAULT '0', "billing_unit" numeric(20,6) NOT NULL DEFAULT '1', "unit_price" numeric(20,6) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'TZS', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_aafdfb20c2679fba8b392a99659" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."saas_plan_features_value_type_enum" AS ENUM('BOOLEAN', 'INTEGER', 'DECIMAL', 'TEXT', 'JSON')`,
    );
    await queryRunner.query(
      `CREATE TABLE "saas_plan_features" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plan_id" uuid NOT NULL, "feature_code" character varying(100) NOT NULL, "value_type" "public"."saas_plan_features_value_type_enum" NOT NULL, "value" jsonb NOT NULL, "description" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cfd2b2fec95af089ebab8722fce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."saas_payments_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'FAILED', 'REVERSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "saas_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoice_id" uuid NOT NULL, "company_id" uuid NOT NULL, "payment_reference" character varying(100) NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "amount" numeric(20,2) NOT NULL DEFAULT '0', "status" "public"."saas_payments_status_enum" NOT NULL DEFAULT 'CONFIRMED', "payment_date" date NOT NULL, "recorded_by" uuid, "notes" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_213143244f869cd8c39f8cb8c73" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."saas_invoices_status_enum" AS ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID')`,
    );
    await queryRunner.query(
      `CREATE TABLE "saas_invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cycle_id" uuid NOT NULL, "subscription_id" uuid NOT NULL, "company_id" uuid NOT NULL, "invoice_no" character varying(60) NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "subtotal_amount" numeric(20,2) NOT NULL DEFAULT '0', "tax_amount" numeric(20,2) NOT NULL DEFAULT '0', "total_amount" numeric(20,2) NOT NULL DEFAULT '0', "paid_amount" numeric(20,2) NOT NULL DEFAULT '0', "balance_amount" numeric(20,2) NOT NULL DEFAULT '0', "status" "public"."saas_invoices_status_enum" NOT NULL DEFAULT 'DRAFT', "due_at" TIMESTAMP WITH TIME ZONE, "issued_at" TIMESTAMP WITH TIME ZONE, "voided_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_9729574f3ae0166cf0780d126f2" UNIQUE ("invoice_no"), CONSTRAINT "PK_a53c2a48d5ce7e61a911b6eb864" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "saas_invoice_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoice_id" uuid NOT NULL, "item_type" character varying(50) NOT NULL, "description" text NOT NULL, "quantity" numeric(20,6) NOT NULL DEFAULT '1', "unit_price" numeric(20,6) NOT NULL DEFAULT '0', "amount" numeric(20,2) NOT NULL DEFAULT '0', "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c9ee11907d52292165a5346246f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."saas_invoice_adjustments_adjustment_type_enum" AS ENUM('CREDIT', 'DEBIT', 'REVERSAL', 'WRITE_OFF')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."saas_invoice_adjustments_status_enum" AS ENUM('DRAFT', 'APPROVED', 'APPLIED', 'VOID')`,
    );
    await queryRunner.query(
      `CREATE TABLE "saas_invoice_adjustments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "adjustment_no" character varying(80) NOT NULL, "adjustment_type" "public"."saas_invoice_adjustments_adjustment_type_enum" NOT NULL, "amount" numeric(20,4) NOT NULL, "currency" character varying(3) NOT NULL, "reason" text NOT NULL, "status" "public"."saas_invoice_adjustments_status_enum" NOT NULL DEFAULT 'DRAFT', "created_by" uuid NOT NULL, "approved_by" uuid, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "approved_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ad4b3a2a667850decdc1bbaba77" UNIQUE ("adjustment_no"), CONSTRAINT "PK_165a8dbe17de5ede31b39e31418" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."saas_billing_cycles_status_enum" AS ENUM('OPEN', 'CALCULATED', 'INVOICED', 'CLOSED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "saas_billing_cycles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscription_id" uuid NOT NULL, "company_id" uuid NOT NULL, "period_start" TIMESTAMP WITH TIME ZONE NOT NULL, "period_end" TIMESTAMP WITH TIME ZONE NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "base_amount" numeric(20,2) NOT NULL DEFAULT '0', "usage_amount" numeric(20,2) NOT NULL DEFAULT '0', "discount_amount" numeric(20,2) NOT NULL DEFAULT '0', "tax_amount" numeric(20,2) NOT NULL DEFAULT '0', "total_amount" numeric(20,2) NOT NULL DEFAULT '0', "plan_version_id" uuid, "billing_snapshot" jsonb, "billing_snapshot_hash" character varying(64), "state_version" integer NOT NULL DEFAULT '1', "status" "public"."saas_billing_cycles_status_enum" NOT NULL DEFAULT 'OPEN', "calculated_at" TIMESTAMP WITH TIME ZONE, "closed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bc50e8b6bb5aff216457cdbe44f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "platform_usage_snapshots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "subscription_id" uuid, "metric_code" character varying(100) NOT NULL, "period_start" TIMESTAMP WITH TIME ZONE NOT NULL, "period_end" TIMESTAMP WITH TIME ZONE NOT NULL, "dimension_key" character varying(128) NOT NULL DEFAULT 'default', "dimensions" jsonb NOT NULL DEFAULT '{}', "quantity" numeric(20,6) NOT NULL DEFAULT '0', "calculated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4f9e984930acd06200d17841d84" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "platform_usage_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "subscription_id" uuid, "metric_code" character varying(100) NOT NULL, "quantity" numeric(20,6) NOT NULL, "idempotency_key" character varying(180) NOT NULL, "resource_type" character varying(80), "resource_id" uuid, "dimension_key" character varying(128) NOT NULL DEFAULT 'default', "dimensions" jsonb NOT NULL DEFAULT '{}', "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "metadata" jsonb, CONSTRAINT "PK_236022b6738c459847fe6cf4a28" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."company_subscriptions_status_enum" AS ENUM('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."company_subscriptions_billing_interval_enum" AS ENUM('MONTHLY', 'QUARTERLY', 'YEARLY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "company_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "plan_id" uuid NOT NULL, "plan_version_id" uuid, "subscription_no" character varying(60) NOT NULL, "status" "public"."company_subscriptions_status_enum" NOT NULL DEFAULT 'TRIALING', "billing_interval" "public"."company_subscriptions_billing_interval_enum" NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "base_price" numeric(20,2) NOT NULL DEFAULT '0', "plan_snapshot" jsonb, "plan_snapshot_hash" character varying(64), "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "trial_ends_at" TIMESTAMP WITH TIME ZONE, "current_period_start" TIMESTAMP WITH TIME ZONE NOT NULL, "current_period_end" TIMESTAMP WITH TIME ZONE NOT NULL, "grace_period_ends_at" TIMESTAMP WITH TIME ZONE, "scheduled_plan_id" uuid, "scheduled_plan_version_id" uuid, "scheduled_change_at" TIMESTAMP WITH TIME ZONE, "last_billed_at" TIMESTAMP WITH TIME ZONE, "next_billing_at" TIMESTAMP WITH TIME ZONE, "state_version" integer NOT NULL DEFAULT '1', "cancel_at_period_end" boolean NOT NULL DEFAULT false, "cancelled_at" TIMESTAMP WITH TIME ZONE, "suspended_at" TIMESTAMP WITH TIME ZONE, "suspension_reason" text, "created_by" uuid, "updated_by" uuid, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_b8eed62ff62795c513070d0c3f0" UNIQUE ("subscription_no"), CONSTRAINT "PK_2dad37af4a389c2878c9b67a050" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reference_countries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "iso2_code" character varying(2), "iso3_code" character varying(3) NOT NULL, "phone_code" character varying(20), "is_active" boolean NOT NULL DEFAULT true, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4fd76cd945f8d9ba40892139aea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reference_countries_name" ON "reference_countries" ("name") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reference_countries_iso3" ON "reference_countries" ("iso3_code") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "reference_districts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "region_id" uuid NOT NULL, "code" character varying(80) NOT NULL, "name" character varying(120) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_fd72654150eefdac31d65527367" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reference_districts_region_name" ON "reference_districts" ("region_id", "name") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reference_districts_region_code" ON "reference_districts" ("region_id", "code") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reference_districts_region" ON "reference_districts" ("region_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "reference_regions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "country_id" uuid NOT NULL, "code" character varying(80) NOT NULL, "name" character varying(120) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6e88cec367970377bd3c9eb6559" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reference_regions_country_name" ON "reference_regions" ("country_id", "name") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reference_regions_country_code" ON "reference_regions" ("country_id", "code") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reference_regions_country" ON "reference_regions" ("country_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "reference_currencies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "code" character varying(10) NOT NULL, "symbol" character varying(12), "is_active" boolean NOT NULL DEFAULT true, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_1ac5e4e4154e9e8d60375e8657d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reference_currencies_code" ON "reference_currencies" ("code") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "company_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "config_key" character varying(100) NOT NULL, "config_value" text NOT NULL, "value_type" character varying(20) NOT NULL DEFAULT 'string', "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_company_configs_company_key" UNIQUE ("company_id", "config_key"), CONSTRAINT "PK_726c503e5e9ae894378b0977353" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_company_configs_is_active" ON "company_configs" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_company_configs_company_id" ON "company_configs" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "api_clients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" character varying, "name" character varying(100) NOT NULL, "owner_user_id" uuid, "client_id" character varying(100) NOT NULL, "key_prefix" character varying(32), "client_secret_hash" character varying(255) NOT NULL, "previous_secret_hash" character varying(255), "previous_secret_valid_until" TIMESTAMP, "scopes" text NOT NULL DEFAULT '', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "client_type" character varying(30) NOT NULL DEFAULT 'TENANT_INTEGRATION', "environment" character varying(20) NOT NULL DEFAULT 'PRODUCTION', "description" character varying(255), "ip_whitelist" jsonb NOT NULL DEFAULT '[]', "rate_limit_per_minute" integer, "last_used_at" TIMESTAMP, "last_used_ip" character varying(45), "last_used_user_agent" text, "usage_count" bigint NOT NULL DEFAULT '0', "expires_at" TIMESTAMP, "rotated_at" TIMESTAMP, "compromised_at" TIMESTAMP, "revoked_reason" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2cc528aa877e26788808e581855" UNIQUE ("client_id"), CONSTRAINT "PK_ef2d5ef0eb5e9a6ddc67cfa310e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_api_clients_client_id" ON "api_clients" ("client_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "api_client_usage_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "api_client_id" uuid NOT NULL, "company_id" uuid, "outcome" character varying(20) NOT NULL, "ip_address" character varying(45), "method" character varying(10), "request_path" character varying(255), "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0a6b896b922e967cb06cfcfb2e0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "role_user" ("users_id" uuid NOT NULL, "roles_id" uuid NOT NULL, CONSTRAINT "PK_a556eb244a7c33bc37d0e152f01" PRIMARY KEY ("users_id", "roles_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_86227665514d1ffd65e24b63c1" ON "role_user" ("users_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0270be993d7a40e1191eff0e23" ON "role_user" ("roles_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "permission_user" ("users_id" uuid NOT NULL, "permissions_id" uuid NOT NULL, CONSTRAINT "PK_78ef128ddfd67f75552ef9b9fd1" PRIMARY KEY ("users_id", "permissions_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5947c2ab570235dc9a6514854f" ON "permission_user" ("users_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0108297cf9d7271cd7839d4720" ON "permission_user" ("permissions_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "permission_role" ("roles_id" uuid NOT NULL, "permissions_id" uuid NOT NULL, CONSTRAINT "PK_ecaa427c8c9e6c1cab0f130db17" PRIMARY KEY ("roles_id", "permissions_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a334e85861688a57f9b31e7045" ON "permission_role" ("roles_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_633d504f6120c3e07ad0c9c141" ON "permission_role" ("permissions_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_roles" ADD CONSTRAINT "FK_74ec3aa89216198cb0cfd6edc24" FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_roles" ADD CONSTRAINT "FK_c1314bc5a97bc33594274eba554" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_permissions" ADD CONSTRAINT "FK_42b8ee52319678d53cbfaf3f057" FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_permissions" ADD CONSTRAINT "FK_acb030193db62480c2fd8b2e352" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_users" ADD CONSTRAINT "FK_0a12e8588834314e38e43d6f5a7" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_users" ADD CONSTRAINT "FK_0363bc7120c6f81b0fdf3a77a8e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_users" ADD CONSTRAINT "FK_a426662e56c3eede9dcf463fd84" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_users" ADD CONSTRAINT "FK_17cbbd713e4213e3a83a0e88d6f" FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_features" ADD CONSTRAINT "FK_fe81add961e31d38ff880b21db3" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_features" ADD CONSTRAINT "FK_e146fc721a8c8e626d62d7cd530" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_features" ADD CONSTRAINT "FK_4f099a199202983bd5e53f4d129" FOREIGN KEY ("company_feature_id") REFERENCES "company_features"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD CONSTRAINT "FK_5973f79e64a27c506b07cd84b29" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD CONSTRAINT "FK_14da1875eaf9e5c81ca4678765d" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_sale_points" ADD CONSTRAINT "FK_12a3bea45da726cca25b87be45a" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_sale_points" ADD CONSTRAINT "FK_8f265e4fea834ebdecc521e6d85" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_company_configurations" ADD CONSTRAINT "FK_37e9de5ade6a888421a6c7b20f5" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_users" ADD CONSTRAINT "FK_0ae0cd2276d8973121d191da629" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_users" ADD CONSTRAINT "FK_8c0ba27e413a41a5fb0ddff5843" FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_users" ADD CONSTRAINT "FK_da192729d410e929026a7aef253" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "departments" ADD CONSTRAINT "FK_541e3d07c93baa9cc42b149a5fb" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "departments" ADD CONSTRAINT "FK_40b8818a0e3324c859199265503" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_addresses" ADD CONSTRAINT "FK_8821402eb6faf36eab1ad2670bd" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_addresses" ADD CONSTRAINT "FK_6be4e1a698f5c3f2c2e4c75c186" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_addresses" ADD CONSTRAINT "FK_6665704c2e089d04f3fbbe90600" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_addresses" ADD CONSTRAINT "FK_ec6e9d7459e1a05cd0b376daafa" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" ADD CONSTRAINT "FK_c2dcbcd356afe3f4285b2599499" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" ADD CONSTRAINT "FK_76ca61fed7339b9f358599f9fda" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_documents" ADD CONSTRAINT "FK_1ce91246e23e44dc91d4624b16e" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_documents" ADD CONSTRAINT "FK_5301fb44d91d7a9102f12fba583" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_identifiers" ADD CONSTRAINT "FK_56c106b2567769a92a7069f820f" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_identifiers" ADD CONSTRAINT "FK_bd069090c84b85a672fc2674b08" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_identifiers" ADD CONSTRAINT "FK_0ce096807c81323096dea836435" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_kyc_reviews" ADD CONSTRAINT "FK_0ebe2ce751ec4cc2355c43b636d" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_kyc_reviews" ADD CONSTRAINT "FK_999865462d0d46d73c12408d4c3" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insured_assets" ADD CONSTRAINT "FK_4085e2bade402147224202aae6a" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insured_assets" ADD CONSTRAINT "FK_d1841e0ba8cac88ef078920982e" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insured_assets" ADD CONSTRAINT "FK_d3413a7044a7877b121e819eabd" FOREIGN KEY ("owner_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_f0e29920aaf871f3eddbea69f0d" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_9ec223c81ccbc99ae04fd79752f" FOREIGN KEY ("document_verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_526a0e4622f2e6e3a21678731db" FOREIGN KEY ("kyc_verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_2bc37c86fa4da512b40191693ae" FOREIGN KEY ("merged_into_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicle_ownerships" ADD CONSTRAINT "FK_c8b76df22d8fead214816136b24" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicle_ownerships" ADD CONSTRAINT "FK_3067a128d292f667ae2c873f7c1" FOREIGN KEY ("insured_asset_id") REFERENCES "insured_assets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicle_ownerships" ADD CONSTRAINT "FK_1f17ecb12c9b18884faa52969fd" FOREIGN KEY ("owner_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" ADD CONSTRAINT "FK_cdfd30714ca46a08c077e07fd81" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" ADD CONSTRAINT "FK_8a1fc075e2d14ad506209463146" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" ADD CONSTRAINT "FK_de71abb8de3d170d4417e0132c0" FOREIGN KEY ("insured_asset_id") REFERENCES "insured_assets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" ADD CONSTRAINT "FK_492cc4d971a9644225b770d8f5f" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" ADD CONSTRAINT "FK_539d0b079709dfa941242fc898b" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_categories" ADD CONSTRAINT "FK_1c68b3f832e6594848d15998cfe" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_definition_items" ADD CONSTRAINT "FK_d59dc655c38fae0e732629f2642" FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_addon_definitions" ADD CONSTRAINT "FK_983ed140b06b8c36ac463779a18" FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_document_requirements" ADD CONSTRAINT "FK_24212f61fa2ffe1c7646af6f63e" FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_sub_classes" ADD CONSTRAINT "FK_b2a30603c1191b8b9870c9a25e3" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_sub_classes" ADD CONSTRAINT "FK_63ecfdabbefcc99a22d9e9e7d38" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_version_sub_classes" ADD CONSTRAINT "FK_9e3b0949677a7ffc232fb5ae2d1" FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_version_sub_classes" ADD CONSTRAINT "FK_3d6629b4219b8aa87e3cf27155b" FOREIGN KEY ("sub_class_id") REFERENCES "insurance_sub_classes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_product_versions" ADD CONSTRAINT "FK_2ddc80d9847e28a75ddd9a6ad44" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_product_versions" ADD CONSTRAINT "FK_09feffeafe2f171c899ebf5126d" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" ADD CONSTRAINT "FK_70126325ceed803671ac77b6f2d" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" ADD CONSTRAINT "FK_a7f6cbafa690b84cf7329e621e2" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" ADD CONSTRAINT "FK_1deb8a209c21b41690dcc71b826" FOREIGN KEY ("current_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_status_history" ADD CONSTRAINT "FK_e87b7dbdc6feae34ea434c233fd" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_status_history" ADD CONSTRAINT "FK_a352440062bfa4f06b024c8ecb7" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_entry_addon_taxes" ADD CONSTRAINT "FK_5b86d74973e2a6c59404fc3f34e" FOREIGN KEY ("addon_id") REFERENCES "quotation_entry_addons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_entry_addons" ADD CONSTRAINT "FK_0edb88f19be7a4ceb35f564565e" FOREIGN KEY ("entry_id") REFERENCES "quotation_cover_note_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_risks" ADD CONSTRAINT "FK_71a7c83a34fdd1490aba8b845d6" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_risks" ADD CONSTRAINT "FK_bada67d3d74a399a152935900b3" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_risks" ADD CONSTRAINT "FK_608421eb9a97bb2c56058e8d609" FOREIGN KEY ("sub_class_id") REFERENCES "insurance_sub_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_discounts" ADD CONSTRAINT "FK_af7f04bbd98fda16d6a2b86d211" FOREIGN KEY ("risk_id") REFERENCES "quotation_entry_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_premium_overrides" ADD CONSTRAINT "FK_79806ca35465747a33c313d4c8f" FOREIGN KEY ("risk_id") REFERENCES "quotation_entry_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_premium_overrides" ADD CONSTRAINT "FK_4af875ff0525e5ac993b826265d" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_premium_overrides" ADD CONSTRAINT "FK_d58420f9103b339da2b4cc7b935" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_taxes" ADD CONSTRAINT "FK_4347ad3b9b722126b21cd127f52" FOREIGN KEY ("risk_id") REFERENCES "quotation_entry_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_entry_risks" ADD CONSTRAINT "FK_f787fb447385f919895276975c9" FOREIGN KEY ("entry_id") REFERENCES "quotation_cover_note_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_entry_risks" ADD CONSTRAINT "FK_1b9ea8d4700d70bc5b019994b6c" FOREIGN KEY ("insurance_risk_id") REFERENCES "insurance_risks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" ADD CONSTRAINT "FK_37cffb80ef7baad58b32e419466" FOREIGN KEY ("entry_id") REFERENCES "quotation_cover_note_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_subject_matters" ADD CONSTRAINT "FK_a30c5e9210d74f14d72e6cd7d8a" FOREIGN KEY ("entry_id") REFERENCES "quotation_cover_note_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_cover_note_entries" ADD CONSTRAINT "FK_e6b8cb3245499b095d6141e0500" FOREIGN KEY ("cover_note_id") REFERENCES "quotation_cover_notes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_cover_notes" ADD CONSTRAINT "FK_678dc3f2c5872c18981f8e6ad09" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_policy_holders" ADD CONSTRAINT "FK_53d2472acd7229f2a05e7c69b30" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_policy_holders" ADD CONSTRAINT "FK_20ef343fa2c2763e3ffb95839a4" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_assets" ADD CONSTRAINT "FK_6b72b2e4c439b57e48cd2ed5b46" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_assets" ADD CONSTRAINT "FK_587e892145d4713dc294d4b0e6e" FOREIGN KEY ("quotation_risk_id") REFERENCES "quotation_entry_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_assets" ADD CONSTRAINT "FK_cb700c7d0584c6912e16cea6769" FOREIGN KEY ("insured_asset_id") REFERENCES "insured_assets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_90672d758a28a7f6f26f660041e" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_5f4e0ed5ac2b3644682583af62d" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_17545bd211f67fca4e792196210" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_96bf8297a857ceb6a1ff1a0f652" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_9faa10be11d38bd8106799e66ad" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_25dcb703da984fa66bde99af598" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_93a8c0e6fb7fc8f2cdf86db1ae4" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_cc6c7ed7b1b0e541ab54ea0da79" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_4c847470d8e883e84a9c8061b4b" FOREIGN KEY ("approval_submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_4e68f9183819b93ab74d1f6d129" FOREIGN KEY ("approval_decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_6c655818e6753ed41eb755b8bcb" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_ec1901bd8f11a1adc441ce0bdf6" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_e173cf45299e8591b80924e2a13" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_757709f9ddcb679d6caa933e127" FOREIGN KEY ("sub_class_id") REFERENCES "insurance_sub_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD CONSTRAINT "FK_b7940e13cb6a17a1e9087e78d7d" FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" ADD CONSTRAINT "FK_6ddb4cf38be8a2b700aeba7c1bc" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" ADD CONSTRAINT "FK_aa5c51e86a873c225aefe2ba81c" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" ADD CONSTRAINT "FK_b6734973870c21974811e20879b" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" ADD CONSTRAINT "FK_2f146932ced3d893755154d569a" FOREIGN KEY ("quotation_entry_id") REFERENCES "quotation_cover_note_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" ADD CONSTRAINT "FK_686f953478b635ef7d1dcb18781" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" ADD CONSTRAINT "FK_e8c87c137c03d25d23418464719" FOREIGN KEY ("insured_asset_id") REFERENCES "insured_assets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" ADD CONSTRAINT "FK_995923d78e87b81a611d0453df4" FOREIGN KEY ("tiramis_tracking_id") REFERENCES "tiramis_submission_tracking"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_cover_notes" ADD CONSTRAINT "FK_1fbaf78d9a871c1d6cefc16fc05" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_cover_notes" ADD CONSTRAINT "FK_341d788fdb9f2e322f145c22848" FOREIGN KEY ("cover_note_id") REFERENCES "cover_notes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rating_factors" ADD CONSTRAINT "FK_f5821597e2e8a2db3d813d7c4e2" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matter_factor_values" ADD CONSTRAINT "FK_167b54706ac591defff9b4a0311" FOREIGN KEY ("subject_matter_id") REFERENCES "subject_matters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matter_factor_values" ADD CONSTRAINT "FK_c16c807f8a5e5ccff3f4100d459" FOREIGN KEY ("factor_id") REFERENCES "rating_factors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" ADD CONSTRAINT "FK_3ee84192b50ef10e5d72345f829" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" ADD CONSTRAINT "FK_65236236aa8afbe540cccae641d" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" ADD CONSTRAINT "FK_c8b874865a0f4b7397ddc44886c" FOREIGN KEY ("owner_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" ADD CONSTRAINT "FK_7675cc4b2736afcc905ec144281" FOREIGN KEY ("insured_asset_id") REFERENCES "insured_assets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" ADD CONSTRAINT "FK_6527ce0234f7b67e168d3c7d947" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" ADD CONSTRAINT "FK_d0b77d7017770daef812e712f71" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_risks" ADD CONSTRAINT "FK_0cdf1f8c1b597025d3b384c91be" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_risks" ADD CONSTRAINT "FK_c598e82efc8037a1f85cb8ea62b" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_risks" ADD CONSTRAINT "FK_b2f032601d1834853b5e3501b0b" FOREIGN KEY ("quotation_entry_risk_id") REFERENCES "quotation_entry_risks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_risks" ADD CONSTRAINT "FK_24d3144874c6034bea14d03db02" FOREIGN KEY ("subject_matter_id") REFERENCES "subject_matters"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_risks" ADD CONSTRAINT "FK_a303f1b4702cf94b428d5e4aac4" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_premium_breakdowns" ADD CONSTRAINT "FK_881a24bce6a42b39f40b0469b76" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_premium_breakdowns" ADD CONSTRAINT "FK_7b803b7223e98bc8011c0bc5e9d" FOREIGN KEY ("policy_risk_id") REFERENCES "policy_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_status_history" ADD CONSTRAINT "FK_8b400ddff5f4c1484dc349d655f" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_status_history" ADD CONSTRAINT "FK_ac1578ccc32c594c919e77ab868" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transaction_changes" ADD CONSTRAINT "FK_9fadade0adcaaf8010ef4446489" FOREIGN KEY ("policy_transaction_id") REFERENCES "policy_transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transaction_events" ADD CONSTRAINT "FK_9fc70340c1784ca72269b9ea081" FOREIGN KEY ("policy_transaction_id") REFERENCES "policy_transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transactions" ADD CONSTRAINT "FK_c1bae4bf39f6c62391d7e5b952a" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transactions" ADD CONSTRAINT "FK_1de51ddabd1bcf05c9f9c0d3fb0" FOREIGN KEY ("source_policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transactions" ADD CONSTRAINT "FK_fb13b27af3e72dbc7674b89d4ce" FOREIGN KEY ("source_policy_version_id") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transactions" ADD CONSTRAINT "FK_83c2abe698fcd1c228d4d3a1949" FOREIGN KEY ("target_policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transactions" ADD CONSTRAINT "FK_1c943a6c464b35a42f9b01ea2ab" FOREIGN KEY ("target_policy_version_id") REFERENCES "policy_versions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" ADD CONSTRAINT "FK_b39b765ed67f82c6b52d880713e" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" ADD CONSTRAINT "FK_6fa02b022024b0a178885e41f95" FOREIGN KEY ("tiramis_tracking_id") REFERENCES "tiramis_submission_tracking"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" ADD CONSTRAINT "FK_75f2e9c511c3de456adcd3534a4" FOREIGN KEY ("policy_transaction_id") REFERENCES "policy_transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" ADD CONSTRAINT "FK_a6ddc0c402c5b907bee19e137af" FOREIGN KEY ("supersedes_version_id") REFERENCES "policy_versions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_736c7a6c5095956a21f779f63e1" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_40cdadb7d18ea75b3fc613fe968" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_0a6006d8d83bec5be6b28c37d7e" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_f87352aed9aa141350034065ae4" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_0e67496add1f8592aa0a106941a" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_34137cbe89e8c03c4cfbbcc902b" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_f7d30941e7f951eeeba747ae7ed" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_8f4ece3c45cee881189118cab5f" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_8979b7609ca99112ee529cd96dd" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_0940b940d340d6d5f3e443d7c56" FOREIGN KEY ("sub_class_id") REFERENCES "insurance_sub_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" ADD CONSTRAINT "FK_19f2c8bd148adc8fc98a3329c81" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" ADD CONSTRAINT "FK_cfae1df7622efcd5540f62598f0" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" ADD CONSTRAINT "FK_640cccc6f190bac0eb36679d1d1" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" ADD CONSTRAINT "FK_558dbcd245b8e8b39d421d726a8" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" ADD CONSTRAINT "FK_35b2aaabdefbc81bc6634a58e42" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" ADD CONSTRAINT "FK_56a89a1a300f20a4761cb068ff2" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submission_events" ADD CONSTRAINT "FK_60329bbdd89651c93a456151dcf" FOREIGN KEY ("submission_id") REFERENCES "portal_tira_submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" ADD CONSTRAINT "FK_bee533e23ef7040e4646a56cc58" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" ADD CONSTRAINT "FK_76e1729b3d3c7273c649eeffab3" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" ADD CONSTRAINT "FK_98540ade8e9d9c4dfeffc0d8dc5" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rate_books" ADD CONSTRAINT "FK_3d6d1557585e647bd2a571d73d5" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rate_books" ADD CONSTRAINT "FK_635a08901af580bfa02048052b6" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rate_books" ADD CONSTRAINT "FK_8fefe3e1c2643615dc99a1f8f8d" FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" ADD CONSTRAINT "FK_b2e19a6643c9f7f0be7a9f76623" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" ADD CONSTRAINT "FK_d8814448f953a4fdf5e392b28a8" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" ADD CONSTRAINT "FK_3c82d6d28ce3578e42cbc809c86" FOREIGN KEY ("rate_book_id") REFERENCES "pricing_rate_books"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rule_conditions" ADD CONSTRAINT "FK_56cd5167cc746cf8eded4e2b0f0" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rule_conditions" ADD CONSTRAINT "FK_1cd1320aa63d4057bee3ee0e3fe" FOREIGN KEY ("rule_id") REFERENCES "risk_rating_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_required_factors" ADD CONSTRAINT "FK_2caafa46df0c1f6273f80155f84" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_required_factors" ADD CONSTRAINT "FK_8988fc894f6b9d1bcf4c7f8e66e" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_required_factors" ADD CONSTRAINT "FK_db7346500ddf5e5df97de0c41c0" FOREIGN KEY ("factor_id") REFERENCES "rating_factors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_required_factors" ADD CONSTRAINT "FK_043aedcac61bd8007da8b0d5c29" FOREIGN KEY ("rate_book_id") REFERENCES "pricing_rate_books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_treaty_sections" ADD CONSTRAINT "FK_8c0cf20aaee1e112346719b3fa9" FOREIGN KEY ("treaty_id") REFERENCES "reinsurance_treaties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_treaty_participants" ADD CONSTRAINT "FK_94aad817a47ffee7521b22120d9" FOREIGN KEY ("treaty_id") REFERENCES "reinsurance_treaties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_treaty_participants" ADD CONSTRAINT "FK_207d1cfd8ca4b22ef54401940e2" FOREIGN KEY ("treaty_section_id") REFERENCES "reinsurance_treaty_sections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_treaty_eligibility_rules" ADD CONSTRAINT "FK_2059f491ec7c2f550db5e58675e" FOREIGN KEY ("treaty_id") REFERENCES "reinsurance_treaties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_settlement_items" ADD CONSTRAINT "FK_86b6d3009d11032771de835ffb3" FOREIGN KEY ("settlement_id") REFERENCES "reinsurance_settlements"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_recovery_receipts" ADD CONSTRAINT "FK_4876dcf47c92079796dd6a922ab" FOREIGN KEY ("claim_recovery_id") REFERENCES "reinsurance_claim_recoveries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_premium_account_items" ADD CONSTRAINT "FK_914d19902bee5728c0c4d7a53cd" FOREIGN KEY ("premium_account_id") REFERENCES "reinsurance_premium_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_cession_participants" ADD CONSTRAINT "FK_510f1b1b8f6ec46190d027ee392" FOREIGN KEY ("cession_id") REFERENCES "policy_cessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_cessions" ADD CONSTRAINT "FK_be99ee6abb21cacd620f8598810" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_declarations" ADD CONSTRAINT "FK_a57b88ea3ddd16e6b57cabc76c5" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_declarations" ADD CONSTRAINT "FK_4198f6b96dda5c19afd80ea4c15" FOREIGN KEY ("cession_id") REFERENCES "policy_cessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_bordereau_items" ADD CONSTRAINT "FK_c67072d95d1cee05ffb2c3782f7" FOREIGN KEY ("bordereau_id") REFERENCES "reinsurance_bordereaux"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "facultative_placement_offers" ADD CONSTRAINT "FK_34257431430f90fc1128da88e6d" FOREIGN KEY ("placement_id") REFERENCES "facultative_placements"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "facultative_signed_lines" ADD CONSTRAINT "FK_a1291ead4b6d790f989c4d54150" FOREIGN KEY ("placement_id") REFERENCES "facultative_placements"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_tax_rules" ADD CONSTRAINT "FK_316e874f4a27c4d649978626b6c" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_tax_rules" ADD CONSTRAINT "FK_de0515a9597c3dc3dc95bbfdb7f" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_tax_rules" ADD CONSTRAINT "FK_eeecd0b0343cd5c17c6be93c750" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_tax_rules" ADD CONSTRAINT "FK_2b641df6052ff9a66d944919a2e" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_document_requirements" ADD CONSTRAINT "FK_fb53543a3e3e414c741f97f9fb9" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_document_requirements" ADD CONSTRAINT "FK_949424df33df787c64ba25fe96c" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_document_requirements" ADD CONSTRAINT "FK_050a29d9d43b8d5158a95e49285" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_channels" ADD CONSTRAINT "FK_1972b0fe9528f9db31176bccf38" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_channels" ADD CONSTRAINT "FK_aec43e20032f6bd129549346ee9" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_channels" ADD CONSTRAINT "FK_1cb0c4c4fb89edc02f6aab78fef" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_channels" ADD CONSTRAINT "FK_e2459355bbe60728e6584b1a6fa" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_channels" ADD CONSTRAINT "FK_439f18e95971eb848dbc9a67bf4" FOREIGN KEY ("sub_class_id") REFERENCES "insurance_sub_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_commission_rules" ADD CONSTRAINT "FK_f89ba50e7a6c9e2769a3def3ed4" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_commission_rules" ADD CONSTRAINT "FK_7043464a85910cdbcac3486f78f" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_commission_rules" ADD CONSTRAINT "FK_e35079b1c4ce3321aa268ab14c2" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_commission_rules" ADD CONSTRAINT "FK_68e6efb10847f4c3de559c01308" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_commission_rules" ADD CONSTRAINT "FK_fa8f782a0909c544bd580f03c47" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_product_access" ADD CONSTRAINT "FK_1b2cd620b283a8128a41ff39d3f" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_product_access" ADD CONSTRAINT "FK_37a7feb04885329eacb521e1b0b" FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_product_access" ADD CONSTRAINT "FK_cf454357d25f042cb0587e3a571" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_product_access" ADD CONSTRAINT "FK_04731489c704d60c971054e8cbe" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_product_access" ADD CONSTRAINT "FK_899341d6228c37c3a74af896825" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_product_access" ADD CONSTRAINT "FK_4d0e7913b0a22e42b57e930b29b" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_product_access" ADD CONSTRAINT "FK_e77032483d75e0df1d26f77ec1a" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_product_access" ADD CONSTRAINT "FK_a101c9b496c8a509aef7f2c31fe" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_product_access" ADD CONSTRAINT "FK_03b7dd6f3868cf6557b5197c652" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_addon_rate_rules" ADD CONSTRAINT "FK_743bdf2dd3bfce084e3a31817f5" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_addon_rate_rules" ADD CONSTRAINT "FK_7ca1fce0531282bb2c2fda3ba7f" FOREIGN KEY ("rate_book_id") REFERENCES "pricing_rate_books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_addon_rate_rules" ADD CONSTRAINT "FK_7c8213b246d76b32a2d78abcc28" FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_addon_rate_rules" ADD CONSTRAINT "FK_facaaba7a698fd3dee15c8f35ac" FOREIGN KEY ("addon_definition_id") REFERENCES "product_addon_definitions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_quotes" ADD CONSTRAINT "FK_f08d2fd9be1fb1cdffd6d00152b" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_quotes" ADD CONSTRAINT "FK_fde6cc2afcdfed449922d268415" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_quotes" ADD CONSTRAINT "FK_25d03e4303743b7b060b93c0160" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_cancellations" ADD CONSTRAINT "FK_36720ec14d42a354bbbd3985482" FOREIGN KEY ("policy_transaction_id") REFERENCES "policy_transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "endorsement_types" ADD CONSTRAINT "FK_a0e526419f96f40091259b3c91a" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_endorsements" ADD CONSTRAINT "FK_2122c18281389a970ae738bd76c" FOREIGN KEY ("policy_transaction_id") REFERENCES "policy_transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_endorsements" ADD CONSTRAINT "FK_5854557ba5f6f42cf7ce16a18ff" FOREIGN KEY ("endorsement_type_id") REFERENCES "endorsement_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_renewals" ADD CONSTRAINT "FK_da6e467ce7f308f39a4ddf3d230" FOREIGN KEY ("policy_transaction_id") REFERENCES "policy_transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_renewals" ADD CONSTRAINT "FK_3f8d39492ffeb658bf8d1895194" FOREIGN KEY ("renewal_quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_renewals" ADD CONSTRAINT "FK_5c64e04e96e82434f774ad38021" FOREIGN KEY ("renewed_policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_dc991d555664682cfe892eea2c1" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_42385e42f092f26bd38df549717" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_782003f5e9d3028a2695fc68f1a" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_e1273b2f4d8bb07f71f420a5390" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_65e3145f317bd655481d3f96c74" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_f8b468df52fb45053ad0c4ca38b" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_89d694d8a71e452321221815676" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_59552b7ef43c66716e4ef795bb4" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_063c05c7aaecee8ecefe00ef629" FOREIGN KEY ("endorsement_id") REFERENCES "policy_endorsements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_c160c39f283cb227a8f03bc76c8" FOREIGN KEY ("cancellation_id") REFERENCES "policy_cancellations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_bb7da075b665fe4a1fb2269b89c" FOREIGN KEY ("renewal_id") REFERENCES "policy_renewals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_39a202af5d1dd1744458820ecb5" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_8dc3c1211899ef0d948b1652908" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_2870058010029467589962a8438" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_583c9037bc0cbe84ab512a33580" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_e9682eb7c1839bb55c6b77e5b81" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_accounts" ADD CONSTRAINT "FK_0e07d50242c13ee0effa13d0ce9" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_accounts" ADD CONSTRAINT "FK_2bbada20dbdbf3e36ee4fbb240d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_accounts" ADD CONSTRAINT "FK_49c7a0d1126147d9a38bad02df5" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_accounts" ADD CONSTRAINT "FK_aeea917d0442e7de9353be005bf" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_payment_proofs" ADD CONSTRAINT "FK_abd9f800717618cb6123c891a6c" FOREIGN KEY ("request_id") REFERENCES "portal_service_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_payment_proofs" ADD CONSTRAINT "FK_b9661c587ec2859d61b02a6cd81" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_request_attachments" ADD CONSTRAINT "FK_ac50274984dd0df2390f530f45c" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_request_attachments" ADD CONSTRAINT "FK_f230bb47679510b4264d68cf65f" FOREIGN KEY ("request_id") REFERENCES "portal_service_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_request_events" ADD CONSTRAINT "FK_13ff66faf0ba77605b84c6f3656" FOREIGN KEY ("request_id") REFERENCES "portal_service_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" ADD CONSTRAINT "FK_1fbf57522101d45de2e98a304fb" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" ADD CONSTRAINT "FK_c09a41e2aeff36cbdafb8ae6171" FOREIGN KEY ("portal_account_id") REFERENCES "portal_accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" ADD CONSTRAINT "FK_01cbbfc844c1921169302d958f9" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" ADD CONSTRAINT "FK_9d64aecf4a6291341c6a7738bfb" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" ADD CONSTRAINT "FK_11e95a4af086fdb0b44548fc8b7" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" ADD CONSTRAINT "FK_7fa5a7f6821c39d88ac803bee8a" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_notifications" ADD CONSTRAINT "FK_99ca0f8981e2fb6516d2c2a25ea" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_notifications" ADD CONSTRAINT "FK_6ea8adf3bea92d91328b3d684d2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_invitations" ADD CONSTRAINT "FK_315e59415b1351fd16d8477d3aa" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_invitations" ADD CONSTRAINT "FK_0116d51eab586dce535f476a783" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_invitations" ADD CONSTRAINT "FK_b4d6653563dae6dad943d4e1b3d" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "non_motor_policy_details" ADD CONSTRAINT "FK_c3c7e493f8c7340fa862380b028" FOREIGN KEY ("subject_matter_id") REFERENCES "subject_matters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "non_motor_policy_details" ADD CONSTRAINT "FK_16c29ea72eab396e165f7a1658b" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "non_motor_policy_details" ADD CONSTRAINT "FK_5475e83343a68d469ac172f547a" FOREIGN KEY ("policy_risk_id") REFERENCES "policy_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD CONSTRAINT "FK_a5e6e4342b8ee44497adde59cc6" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD CONSTRAINT "FK_b057f06d4ae2229c2dd84e9d485" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD CONSTRAINT "FK_5c1859364742f78b13046ed6745" FOREIGN KEY ("policy_risk_id") REFERENCES "policy_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" ADD CONSTRAINT "FK_4a4bbdfa94c307230d73e4eea51" FOREIGN KEY ("fleet_id") REFERENCES "motor_fleets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" ADD CONSTRAINT "FK_c321bc4c28c805c2d21f4601745" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" ADD CONSTRAINT "FK_659e121f9fdc0c3d0474a33e24b" FOREIGN KEY ("quotation_entry_risk_id") REFERENCES "quotation_entry_risks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_memberships" ADD CONSTRAINT "FK_12378fbcfc6ff355f7e84f85e49" FOREIGN KEY ("fleet_id") REFERENCES "motor_fleets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_memberships" ADD CONSTRAINT "FK_8b90d9a1e1d920a1f8bdbca3ad8" FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_memberships" ADD CONSTRAINT "FK_ba359a7b20dc9811543a4c0c1d4" FOREIGN KEY ("insured_asset_id") REFERENCES "insured_assets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleets" ADD CONSTRAINT "FK_0ea091c2214ac80fd389e91717c" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleets" ADD CONSTRAINT "FK_eb385045dda5bbfc914b85f7b75" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleets" ADD CONSTRAINT "FK_af5b5fb8d67f67018c3ba0d29cd" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_company_partners" ADD CONSTRAINT "FK_1f33886b63b52211fd4c71fd72b" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_company_partners" ADD CONSTRAINT "FK_62d0a9b4d94489c46a1222ae10a" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_versions" ADD CONSTRAINT "FK_ac75577bca976d6d581b0f459b6" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_access_events" ADD CONSTRAINT "FK_344deb202d1c0adf01bd46ff0a8" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_access_events" ADD CONSTRAINT "FK_26fad4b20bc811887b102cdaedb" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_links" ADD CONSTRAINT "FK_5f40e6ad7e81b58d863a5baa91e" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_upload_sessions" ADD CONSTRAINT "FK_c5d155bc8f7306e420c18dec5cd" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_upload_sessions" ADD CONSTRAINT "FK_18a957d2989fc3decaaaca5d1f5" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_a1f222cacfdd65e4b28e7b3c9f6" FOREIGN KEY ("current_version_id") REFERENCES "document_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_template_versions" ADD CONSTRAINT "FK_947c2b1178844907c926bae91c4" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_security_scans" ADD CONSTRAINT "FK_9304597e812b5bf45cfcd732548" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "complaint_sla_events" ADD CONSTRAINT "FK_89fd68c56626cb0915823f77ade" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "complaint_comments" ADD CONSTRAINT "FK_17a2eb3e8642a9a06309fec7a6a" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "complaint_appeals" ADD CONSTRAINT "FK_7d9984e8885c561cc7876562505" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_assessments" ADD CONSTRAINT "FK_980019892c8c863ab9ac5ce61b1" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_claimants" ADD CONSTRAINT "FK_4772f612b2e1f2d04cb51630426" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_documents" ADD CONSTRAINT "FK_9dfdd8ea365fd3699275a15b1c7" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_payments" ADD CONSTRAINT "FK_7ebd7fedbb1c662032082df783f" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_reserves" ADD CONSTRAINT "FK_cd2de2c3eabcc48334fd21d1aea" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_status_history" ADD CONSTRAINT "FK_45926a4ecbc253ec32ef9493895" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claims" ADD CONSTRAINT "FK_879ff2d9bdf3ee3db7963b7a25a" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claims" ADD CONSTRAINT "FK_7b2e5f9ce6ba50f5db961ec0293" FOREIGN KEY ("policy_risk_id") REFERENCES "policy_risks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claims" ADD CONSTRAINT "FK_af79ab775a51930eb21951a3c95" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claims" ADD CONSTRAINT "FK_4d7b7b14f07b16ebd5563d508c0" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claims" ADD CONSTRAINT "FK_707bacb220f239250a28279f1a8" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_reserve_movements" ADD CONSTRAINT "FK_af364733a540665174553eb575b" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_reserve_movements" ADD CONSTRAINT "FK_550b90fea1081851c018f3e98d0" FOREIGN KEY ("reserve_id") REFERENCES "claim_reserves"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_regulatory_operations" ADD CONSTRAINT "FK_b8fa86bc8b702ee015fd982b072" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_intimations" ADD CONSTRAINT "FK_5d3336314b7d2b5331d39c58a8c" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_disbursements" ADD CONSTRAINT "FK_38190b5ab069ad171d66303cced" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_disbursements" ADD CONSTRAINT "FK_eb45c2e94b78102fa426151bd52" FOREIGN KEY ("claim_payment_id") REFERENCES "claim_payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_decisions" ADD CONSTRAINT "FK_a3c5db2648bd93d01f617bcb258" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_decisions" ADD CONSTRAINT "FK_69b1c483f5d4ef8affc8d403a76" FOREIGN KEY ("assessment_id") REFERENCES "claim_assessments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_category_access" ADD CONSTRAINT "FK_8defd3fe56aeb657fb36459c2c9" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_category_access" ADD CONSTRAINT "FK_867d5b60fd77f8a3998e53a377c" FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_category_access" ADD CONSTRAINT "FK_e00c6ae230401787b6c2ab8d5f6" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_category_access" ADD CONSTRAINT "FK_d08c2de1bdaf91caf0c91932439" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_category_access" ADD CONSTRAINT "FK_b305d301996a7d6e116eed19a85" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_category_access" ADD CONSTRAINT "FK_124b6285548bdb7396f97d58dc0" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_category_access" ADD CONSTRAINT "FK_c58ea10cec497307410e62a0066" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_category_access" ADD CONSTRAINT "FK_92e2dab59caa79fbcc4497dc3ee" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_category_access" ADD CONSTRAINT "FK_7eee404dd908e27d683961978f0" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_c37870f6c86ba2d2e4f7bee21c2" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_d43f7ac66aab4c15fc030c46fa3" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_b6629510f01ed862de48c228fe3" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_343005ac120c1e018a430445190" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_901dd2e6c8af1e5ec4b46519c13" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_420aafdc1a77ef935ce5ce375a4" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_a560b337c02d397720dad8f8193" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_7b3c9ac513f95ec0e9efcf6670f" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_c825411b7bbc0cd9117ff6148ad" FOREIGN KEY ("payer_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_82e9dee911c0e7393154d1d98ad" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_9c3f287ceb6d42e796d1bfb0d3b" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_0dd8f628268da8afb8dbdf3b7cc" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_fd41950d13ade587d581505dd6f" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_d9b4eec00a31318001f355fb652" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" ADD CONSTRAINT "FK_7f866c87561db7113d87c47e664" FOREIGN KEY ("reversed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_allocations" ADD CONSTRAINT "FK_3273e0bc08e91c42971722efee7" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_allocations" ADD CONSTRAINT "FK_8f123895d7c10ad036e2766e11d" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_allocations" ADD CONSTRAINT "FK_a4b12d978a2cfa7a3dd650abee8" FOREIGN KEY ("allocated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_allocations" ADD CONSTRAINT "FK_164035ec61349a2fda7c5d42124" FOREIGN KEY ("reversed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_batches" ADD CONSTRAINT "FK_6df3f971f11e9d76116171623df" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_batches" ADD CONSTRAINT "FK_d26607340d42d217356453fa28f" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_batches" ADD CONSTRAINT "FK_bb120a2f9c2b1727c6ae6fe588b" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_items" ADD CONSTRAINT "FK_3bfdc64bd1d49c01f80b61724a7" FOREIGN KEY ("batch_id") REFERENCES "finance_reconciliation_batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_items" ADD CONSTRAINT "FK_f2af9590c6855e2dd6e1bbe3d37" FOREIGN KEY ("matched_payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_items" ADD CONSTRAINT "FK_5f37056802be37a83037290b818" FOREIGN KEY ("matched_receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_items" ADD CONSTRAINT "FK_b9ab17f88f1c6486c2823b8f7d3" FOREIGN KEY ("matched_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_journal_lines" ADD CONSTRAINT "FK_05c4a56eceeb0202433b0a60cf9" FOREIGN KEY ("journal_entry_id") REFERENCES "finance_journal_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_b6fb459c8603cab70cdf4ef92c7" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_d2decac441afaa178e3d76e598a" FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_1e71244787853edaeeffad6501f" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_8138fd2c77fed0821a0aa7ef1a5" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_4f013a20f7b29fc3786df8b3f90" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_af3dee661f638e512b49db7cc9a" FOREIGN KEY ("commission_rule_id") REFERENCES "product_commission_rules"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_0a051e4e71dbb3deff209514e94" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_37a5a100bc8dfa9faca96db40b5" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_4819931f2664fc27143fd792c6c" FOREIGN KEY ("accrued_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_76c03edf820e9c6c6480b925949" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" ADD CONSTRAINT "FK_b6c380b38235a4f38babc9faaa8" FOREIGN KEY ("reversed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" ADD CONSTRAINT "FK_9a8107110e0c8eba2af3f925105" FOREIGN KEY ("commission_payment_id") REFERENCES "commission_payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" ADD CONSTRAINT "FK_46ff01ea8efb4537da68e979550" FOREIGN KEY ("commission_transaction_id") REFERENCES "commission_transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" ADD CONSTRAINT "FK_57315f2b889995921dc87b5c85f" FOREIGN KEY ("allocated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" ADD CONSTRAINT "FK_2886613b3b45b4d501bf0eb6903" FOREIGN KEY ("reversed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_43c60f8a0896d8aefa4e436155f" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_72b270e1ac7fe5dfa27c264f610" FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_93ee385480f90c8a8723cff677a" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_431a96c541304db57934013a8ae" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_290684f0edc8c94b0947b6c0b94" FOREIGN KEY ("paid_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_13d43017d27945a36acc9f30691" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_7e505016d530990443506eb72b7" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" ADD CONSTRAINT "FK_d069632cc210163d7cc5747d525" FOREIGN KEY ("reversed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" ADD CONSTRAINT "FK_5e9bee993b4ce35c3606cda194c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reference_districts" ADD CONSTRAINT "FK_2e10fc9f52c9758330a532ef1b3" FOREIGN KEY ("region_id") REFERENCES "reference_regions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reference_regions" ADD CONSTRAINT "FK_cc488c558cf1cfc953cd35ae66a" FOREIGN KEY ("country_id") REFERENCES "reference_countries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_configs" ADD CONSTRAINT "FK_210a999928c188ba9191e11bd47" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_user" ADD CONSTRAINT "FK_86227665514d1ffd65e24b63c19" FOREIGN KEY ("users_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_user" ADD CONSTRAINT "FK_0270be993d7a40e1191eff0e231" FOREIGN KEY ("roles_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_user" ADD CONSTRAINT "FK_5947c2ab570235dc9a6514854f9" FOREIGN KEY ("users_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_user" ADD CONSTRAINT "FK_0108297cf9d7271cd7839d4720b" FOREIGN KEY ("permissions_id") REFERENCES "permissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_role" ADD CONSTRAINT "FK_a334e85861688a57f9b31e7045a" FOREIGN KEY ("roles_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_role" ADD CONSTRAINT "FK_633d504f6120c3e07ad0c9c141b" FOREIGN KEY ("permissions_id") REFERENCES "permissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // These two tables now have TypeORM entities (IdentifierSequence,
    // GeneratedIdentifier) so future `migration:generate` runs will see them
    // automatically. They're still created explicitly here since this
    // baseline predates those entities.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "identifier_sequences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "identifier_type" varchar(50) NOT NULL,
        "sequence_date" varchar(20) NOT NULL,
        "sequence_time_bucket" varchar(20) NOT NULL DEFAULT '',
        "current_value" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_identifier_sequences" PRIMARY KEY ("id"),
        CONSTRAINT "FK_identifier_sequences_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_identifier_sequences_scope"
      ON "identifier_sequences" (
        "company_id",
        "identifier_type",
        "sequence_date",
        "sequence_time_bucket"
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_identifier_sequences_company_type"
      ON "identifier_sequences" ("company_id", "identifier_type")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "generated_identifiers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "identifier_type" varchar(50) NOT NULL,
        "identifier_value" varchar(150) NOT NULL,
        "company_id" uuid NOT NULL,
        "related_entity_type" varchar(80) NULL,
        "related_entity_id" uuid NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_generated_identifiers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_generated_identifiers_value"
          UNIQUE ("identifier_value"),
        CONSTRAINT "FK_generated_identifiers_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_generated_identifiers_company_type"
      ON "generated_identifiers" ("company_id", "identifier_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_generated_identifiers_company_type"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "generated_identifiers"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_identifier_sequences_company_type"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_identifier_sequences_scope"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "identifier_sequences"
    `);

    await queryRunner.query(
      `ALTER TABLE "permission_role" DROP CONSTRAINT "FK_633d504f6120c3e07ad0c9c141b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_role" DROP CONSTRAINT "FK_a334e85861688a57f9b31e7045a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_user" DROP CONSTRAINT "FK_0108297cf9d7271cd7839d4720b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_user" DROP CONSTRAINT "FK_5947c2ab570235dc9a6514854f9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_user" DROP CONSTRAINT "FK_0270be993d7a40e1191eff0e231"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_user" DROP CONSTRAINT "FK_86227665514d1ffd65e24b63c19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_configs" DROP CONSTRAINT "FK_210a999928c188ba9191e11bd47"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reference_regions" DROP CONSTRAINT "FK_cc488c558cf1cfc953cd35ae66a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reference_districts" DROP CONSTRAINT "FK_2e10fc9f52c9758330a532ef1b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" DROP CONSTRAINT "FK_5e9bee993b4ce35c3606cda194c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_d069632cc210163d7cc5747d525"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_7e505016d530990443506eb72b7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_13d43017d27945a36acc9f30691"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_290684f0edc8c94b0947b6c0b94"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_431a96c541304db57934013a8ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_93ee385480f90c8a8723cff677a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_72b270e1ac7fe5dfa27c264f610"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payments" DROP CONSTRAINT "FK_43c60f8a0896d8aefa4e436155f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" DROP CONSTRAINT "FK_2886613b3b45b4d501bf0eb6903"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" DROP CONSTRAINT "FK_57315f2b889995921dc87b5c85f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" DROP CONSTRAINT "FK_46ff01ea8efb4537da68e979550"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_payment_items" DROP CONSTRAINT "FK_9a8107110e0c8eba2af3f925105"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_b6c380b38235a4f38babc9faaa8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_76c03edf820e9c6c6480b925949"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_4819931f2664fc27143fd792c6c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_37a5a100bc8dfa9faca96db40b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_0a051e4e71dbb3deff209514e94"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_af3dee661f638e512b49db7cc9a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_4f013a20f7b29fc3786df8b3f90"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_8138fd2c77fed0821a0aa7ef1a5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_1e71244787853edaeeffad6501f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_d2decac441afaa178e3d76e598a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_transactions" DROP CONSTRAINT "FK_b6fb459c8603cab70cdf4ef92c7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_journal_lines" DROP CONSTRAINT "FK_05c4a56eceeb0202433b0a60cf9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_items" DROP CONSTRAINT "FK_b9ab17f88f1c6486c2823b8f7d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_items" DROP CONSTRAINT "FK_5f37056802be37a83037290b818"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_items" DROP CONSTRAINT "FK_f2af9590c6855e2dd6e1bbe3d37"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_items" DROP CONSTRAINT "FK_3bfdc64bd1d49c01f80b61724a7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_batches" DROP CONSTRAINT "FK_bb120a2f9c2b1727c6ae6fe588b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_batches" DROP CONSTRAINT "FK_d26607340d42d217356453fa28f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finance_reconciliation_batches" DROP CONSTRAINT "FK_6df3f971f11e9d76116171623df"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_allocations" DROP CONSTRAINT "FK_164035ec61349a2fda7c5d42124"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_allocations" DROP CONSTRAINT "FK_a4b12d978a2cfa7a3dd650abee8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_allocations" DROP CONSTRAINT "FK_8f123895d7c10ad036e2766e11d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_allocations" DROP CONSTRAINT "FK_3273e0bc08e91c42971722efee7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_7f866c87561db7113d87c47e664"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_d9b4eec00a31318001f355fb652"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_fd41950d13ade587d581505dd6f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_0dd8f628268da8afb8dbdf3b7cc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_9c3f287ceb6d42e796d1bfb0d3b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_82e9dee911c0e7393154d1d98ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_c825411b7bbc0cd9117ff6148ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_7b3c9ac513f95ec0e9efcf6670f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_a560b337c02d397720dad8f8193"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_420aafdc1a77ef935ce5ce375a4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_901dd2e6c8af1e5ec4b46519c13"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_343005ac120c1e018a430445190"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_b6629510f01ed862de48c228fe3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_d43f7ac66aab4c15fc030c46fa3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_c37870f6c86ba2d2e4f7bee21c2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_category_access" DROP CONSTRAINT "FK_7eee404dd908e27d683961978f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_category_access" DROP CONSTRAINT "FK_92e2dab59caa79fbcc4497dc3ee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_category_access" DROP CONSTRAINT "FK_c58ea10cec497307410e62a0066"`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_category_access" DROP CONSTRAINT "FK_124b6285548bdb7396f97d58dc0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_category_access" DROP CONSTRAINT "FK_b305d301996a7d6e116eed19a85"`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_category_access" DROP CONSTRAINT "FK_d08c2de1bdaf91caf0c91932439"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_category_access" DROP CONSTRAINT "FK_e00c6ae230401787b6c2ab8d5f6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_category_access" DROP CONSTRAINT "FK_867d5b60fd77f8a3998e53a377c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_category_access" DROP CONSTRAINT "FK_8defd3fe56aeb657fb36459c2c9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_decisions" DROP CONSTRAINT "FK_69b1c483f5d4ef8affc8d403a76"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_decisions" DROP CONSTRAINT "FK_a3c5db2648bd93d01f617bcb258"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_disbursements" DROP CONSTRAINT "FK_eb45c2e94b78102fa426151bd52"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_disbursements" DROP CONSTRAINT "FK_38190b5ab069ad171d66303cced"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_intimations" DROP CONSTRAINT "FK_5d3336314b7d2b5331d39c58a8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_regulatory_operations" DROP CONSTRAINT "FK_b8fa86bc8b702ee015fd982b072"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_reserve_movements" DROP CONSTRAINT "FK_550b90fea1081851c018f3e98d0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_reserve_movements" DROP CONSTRAINT "FK_af364733a540665174553eb575b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claims" DROP CONSTRAINT "FK_707bacb220f239250a28279f1a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claims" DROP CONSTRAINT "FK_4d7b7b14f07b16ebd5563d508c0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claims" DROP CONSTRAINT "FK_af79ab775a51930eb21951a3c95"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claims" DROP CONSTRAINT "FK_7b2e5f9ce6ba50f5db961ec0293"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claims" DROP CONSTRAINT "FK_879ff2d9bdf3ee3db7963b7a25a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_status_history" DROP CONSTRAINT "FK_45926a4ecbc253ec32ef9493895"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_reserves" DROP CONSTRAINT "FK_cd2de2c3eabcc48334fd21d1aea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_payments" DROP CONSTRAINT "FK_7ebd7fedbb1c662032082df783f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_documents" DROP CONSTRAINT "FK_9dfdd8ea365fd3699275a15b1c7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_claimants" DROP CONSTRAINT "FK_4772f612b2e1f2d04cb51630426"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claim_assessments" DROP CONSTRAINT "FK_980019892c8c863ab9ac5ce61b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "complaint_appeals" DROP CONSTRAINT "FK_7d9984e8885c561cc7876562505"`,
    );
    await queryRunner.query(
      `ALTER TABLE "complaint_comments" DROP CONSTRAINT "FK_17a2eb3e8642a9a06309fec7a6a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "complaint_sla_events" DROP CONSTRAINT "FK_89fd68c56626cb0915823f77ade"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_security_scans" DROP CONSTRAINT "FK_9304597e812b5bf45cfcd732548"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_template_versions" DROP CONSTRAINT "FK_947c2b1178844907c926bae91c4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_a1f222cacfdd65e4b28e7b3c9f6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_upload_sessions" DROP CONSTRAINT "FK_18a957d2989fc3decaaaca5d1f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_upload_sessions" DROP CONSTRAINT "FK_c5d155bc8f7306e420c18dec5cd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_links" DROP CONSTRAINT "FK_5f40e6ad7e81b58d863a5baa91e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_access_events" DROP CONSTRAINT "FK_26fad4b20bc811887b102cdaedb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_access_events" DROP CONSTRAINT "FK_344deb202d1c0adf01bd46ff0a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_versions" DROP CONSTRAINT "FK_ac75577bca976d6d581b0f459b6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_company_partners" DROP CONSTRAINT "FK_62d0a9b4d94489c46a1222ae10a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_company_partners" DROP CONSTRAINT "FK_1f33886b63b52211fd4c71fd72b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleets" DROP CONSTRAINT "FK_af5b5fb8d67f67018c3ba0d29cd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleets" DROP CONSTRAINT "FK_eb385045dda5bbfc914b85f7b75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleets" DROP CONSTRAINT "FK_0ea091c2214ac80fd389e91717c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_memberships" DROP CONSTRAINT "FK_ba359a7b20dc9811543a4c0c1d4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_memberships" DROP CONSTRAINT "FK_8b90d9a1e1d920a1f8bdbca3ad8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_memberships" DROP CONSTRAINT "FK_12378fbcfc6ff355f7e84f85e49"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" DROP CONSTRAINT "FK_659e121f9fdc0c3d0474a33e24b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" DROP CONSTRAINT "FK_c321bc4c28c805c2d21f4601745"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_fleet_items" DROP CONSTRAINT "FK_4a4bbdfa94c307230d73e4eea51"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP CONSTRAINT "FK_5c1859364742f78b13046ed6745"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP CONSTRAINT "FK_b057f06d4ae2229c2dd84e9d485"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP CONSTRAINT "FK_a5e6e4342b8ee44497adde59cc6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "non_motor_policy_details" DROP CONSTRAINT "FK_5475e83343a68d469ac172f547a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "non_motor_policy_details" DROP CONSTRAINT "FK_16c29ea72eab396e165f7a1658b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "non_motor_policy_details" DROP CONSTRAINT "FK_c3c7e493f8c7340fa862380b028"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_invitations" DROP CONSTRAINT "FK_b4d6653563dae6dad943d4e1b3d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_invitations" DROP CONSTRAINT "FK_0116d51eab586dce535f476a783"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_invitations" DROP CONSTRAINT "FK_315e59415b1351fd16d8477d3aa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_notifications" DROP CONSTRAINT "FK_6ea8adf3bea92d91328b3d684d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_notifications" DROP CONSTRAINT "FK_99ca0f8981e2fb6516d2c2a25ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" DROP CONSTRAINT "FK_7fa5a7f6821c39d88ac803bee8a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" DROP CONSTRAINT "FK_11e95a4af086fdb0b44548fc8b7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" DROP CONSTRAINT "FK_9d64aecf4a6291341c6a7738bfb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" DROP CONSTRAINT "FK_01cbbfc844c1921169302d958f9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" DROP CONSTRAINT "FK_c09a41e2aeff36cbdafb8ae6171"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_requests" DROP CONSTRAINT "FK_1fbf57522101d45de2e98a304fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_service_request_events" DROP CONSTRAINT "FK_13ff66faf0ba77605b84c6f3656"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_request_attachments" DROP CONSTRAINT "FK_f230bb47679510b4264d68cf65f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_request_attachments" DROP CONSTRAINT "FK_ac50274984dd0df2390f530f45c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_payment_proofs" DROP CONSTRAINT "FK_b9661c587ec2859d61b02a6cd81"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_payment_proofs" DROP CONSTRAINT "FK_abd9f800717618cb6123c891a6c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_accounts" DROP CONSTRAINT "FK_aeea917d0442e7de9353be005bf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_accounts" DROP CONSTRAINT "FK_49c7a0d1126147d9a38bad02df5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_accounts" DROP CONSTRAINT "FK_2bbada20dbdbf3e36ee4fbb240d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_accounts" DROP CONSTRAINT "FK_0e07d50242c13ee0effa13d0ce9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_e9682eb7c1839bb55c6b77e5b81"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_583c9037bc0cbe84ab512a33580"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_2870058010029467589962a8438"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_8dc3c1211899ef0d948b1652908"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_39a202af5d1dd1744458820ecb5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_bb7da075b665fe4a1fb2269b89c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_c160c39f283cb227a8f03bc76c8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_063c05c7aaecee8ecefe00ef629"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_59552b7ef43c66716e4ef795bb4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_89d694d8a71e452321221815676"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_f8b468df52fb45053ad0c4ca38b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_65e3145f317bd655481d3f96c74"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_e1273b2f4d8bb07f71f420a5390"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_782003f5e9d3028a2695fc68f1a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_42385e42f092f26bd38df549717"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_dc991d555664682cfe892eea2c1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_renewals" DROP CONSTRAINT "FK_5c64e04e96e82434f774ad38021"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_renewals" DROP CONSTRAINT "FK_3f8d39492ffeb658bf8d1895194"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_renewals" DROP CONSTRAINT "FK_da6e467ce7f308f39a4ddf3d230"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_endorsements" DROP CONSTRAINT "FK_5854557ba5f6f42cf7ce16a18ff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_endorsements" DROP CONSTRAINT "FK_2122c18281389a970ae738bd76c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "endorsement_types" DROP CONSTRAINT "FK_a0e526419f96f40091259b3c91a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_cancellations" DROP CONSTRAINT "FK_36720ec14d42a354bbbd3985482"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_quotes" DROP CONSTRAINT "FK_25d03e4303743b7b060b93c0160"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_quotes" DROP CONSTRAINT "FK_fde6cc2afcdfed449922d268415"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_quotes" DROP CONSTRAINT "FK_f08d2fd9be1fb1cdffd6d00152b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_addon_rate_rules" DROP CONSTRAINT "FK_facaaba7a698fd3dee15c8f35ac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_addon_rate_rules" DROP CONSTRAINT "FK_7c8213b246d76b32a2d78abcc28"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_addon_rate_rules" DROP CONSTRAINT "FK_7ca1fce0531282bb2c2fda3ba7f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_addon_rate_rules" DROP CONSTRAINT "FK_743bdf2dd3bfce084e3a31817f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_product_access" DROP CONSTRAINT "FK_03b7dd6f3868cf6557b5197c652"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_product_access" DROP CONSTRAINT "FK_a101c9b496c8a509aef7f2c31fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_product_access" DROP CONSTRAINT "FK_e77032483d75e0df1d26f77ec1a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_product_access" DROP CONSTRAINT "FK_4d0e7913b0a22e42b57e930b29b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_product_access" DROP CONSTRAINT "FK_899341d6228c37c3a74af896825"`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_product_access" DROP CONSTRAINT "FK_04731489c704d60c971054e8cbe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_product_access" DROP CONSTRAINT "FK_cf454357d25f042cb0587e3a571"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_product_access" DROP CONSTRAINT "FK_37a7feb04885329eacb521e1b0b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_product_access" DROP CONSTRAINT "FK_1b2cd620b283a8128a41ff39d3f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_commission_rules" DROP CONSTRAINT "FK_fa8f782a0909c544bd580f03c47"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_commission_rules" DROP CONSTRAINT "FK_68e6efb10847f4c3de559c01308"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_commission_rules" DROP CONSTRAINT "FK_e35079b1c4ce3321aa268ab14c2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_commission_rules" DROP CONSTRAINT "FK_7043464a85910cdbcac3486f78f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_commission_rules" DROP CONSTRAINT "FK_f89ba50e7a6c9e2769a3def3ed4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_channels" DROP CONSTRAINT "FK_439f18e95971eb848dbc9a67bf4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_channels" DROP CONSTRAINT "FK_e2459355bbe60728e6584b1a6fa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_channels" DROP CONSTRAINT "FK_1cb0c4c4fb89edc02f6aab78fef"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_channels" DROP CONSTRAINT "FK_aec43e20032f6bd129549346ee9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_channels" DROP CONSTRAINT "FK_1972b0fe9528f9db31176bccf38"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_document_requirements" DROP CONSTRAINT "FK_050a29d9d43b8d5158a95e49285"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_document_requirements" DROP CONSTRAINT "FK_949424df33df787c64ba25fe96c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_distribution_document_requirements" DROP CONSTRAINT "FK_fb53543a3e3e414c741f97f9fb9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_tax_rules" DROP CONSTRAINT "FK_2b641df6052ff9a66d944919a2e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_tax_rules" DROP CONSTRAINT "FK_eeecd0b0343cd5c17c6be93c750"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_tax_rules" DROP CONSTRAINT "FK_de0515a9597c3dc3dc95bbfdb7f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_tax_rules" DROP CONSTRAINT "FK_316e874f4a27c4d649978626b6c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "facultative_signed_lines" DROP CONSTRAINT "FK_a1291ead4b6d790f989c4d54150"`,
    );
    await queryRunner.query(
      `ALTER TABLE "facultative_placement_offers" DROP CONSTRAINT "FK_34257431430f90fc1128da88e6d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_bordereau_items" DROP CONSTRAINT "FK_c67072d95d1cee05ffb2c3782f7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_declarations" DROP CONSTRAINT "FK_4198f6b96dda5c19afd80ea4c15"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_declarations" DROP CONSTRAINT "FK_a57b88ea3ddd16e6b57cabc76c5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_cessions" DROP CONSTRAINT "FK_be99ee6abb21cacd620f8598810"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_cession_participants" DROP CONSTRAINT "FK_510f1b1b8f6ec46190d027ee392"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_premium_account_items" DROP CONSTRAINT "FK_914d19902bee5728c0c4d7a53cd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_recovery_receipts" DROP CONSTRAINT "FK_4876dcf47c92079796dd6a922ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_settlement_items" DROP CONSTRAINT "FK_86b6d3009d11032771de835ffb3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_treaty_eligibility_rules" DROP CONSTRAINT "FK_2059f491ec7c2f550db5e58675e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_treaty_participants" DROP CONSTRAINT "FK_207d1cfd8ca4b22ef54401940e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_treaty_participants" DROP CONSTRAINT "FK_94aad817a47ffee7521b22120d9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reinsurance_treaty_sections" DROP CONSTRAINT "FK_8c0cf20aaee1e112346719b3fa9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_required_factors" DROP CONSTRAINT "FK_043aedcac61bd8007da8b0d5c29"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_required_factors" DROP CONSTRAINT "FK_db7346500ddf5e5df97de0c41c0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_required_factors" DROP CONSTRAINT "FK_8988fc894f6b9d1bcf4c7f8e66e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_required_factors" DROP CONSTRAINT "FK_2caafa46df0c1f6273f80155f84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rule_conditions" DROP CONSTRAINT "FK_1cd1320aa63d4057bee3ee0e3fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rule_conditions" DROP CONSTRAINT "FK_56cd5167cc746cf8eded4e2b0f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" DROP CONSTRAINT "FK_3c82d6d28ce3578e42cbc809c86"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" DROP CONSTRAINT "FK_d8814448f953a4fdf5e392b28a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" DROP CONSTRAINT "FK_b2e19a6643c9f7f0be7a9f76623"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rate_books" DROP CONSTRAINT "FK_8fefe3e1c2643615dc99a1f8f8d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rate_books" DROP CONSTRAINT "FK_635a08901af580bfa02048052b6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rate_books" DROP CONSTRAINT "FK_3d6d1557585e647bd2a571d73d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" DROP CONSTRAINT "FK_98540ade8e9d9c4dfeffc0d8dc5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" DROP CONSTRAINT "FK_76e1729b3d3c7273c649eeffab3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" DROP CONSTRAINT "FK_bee533e23ef7040e4646a56cc58"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submission_events" DROP CONSTRAINT "FK_60329bbdd89651c93a456151dcf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" DROP CONSTRAINT "FK_56a89a1a300f20a4761cb068ff2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" DROP CONSTRAINT "FK_35b2aaabdefbc81bc6634a58e42"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" DROP CONSTRAINT "FK_558dbcd245b8e8b39d421d726a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" DROP CONSTRAINT "FK_640cccc6f190bac0eb36679d1d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" DROP CONSTRAINT "FK_cfae1df7622efcd5540f62598f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_business_records" DROP CONSTRAINT "FK_19f2c8bd148adc8fc98a3329c81"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_0940b940d340d6d5f3e443d7c56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_8979b7609ca99112ee529cd96dd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_8f4ece3c45cee881189118cab5f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_f7d30941e7f951eeeba747ae7ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_34137cbe89e8c03c4cfbbcc902b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_0e67496add1f8592aa0a106941a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_f87352aed9aa141350034065ae4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_0a6006d8d83bec5be6b28c37d7e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_40cdadb7d18ea75b3fc613fe968"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_736c7a6c5095956a21f779f63e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" DROP CONSTRAINT "FK_a6ddc0c402c5b907bee19e137af"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" DROP CONSTRAINT "FK_75f2e9c511c3de456adcd3534a4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" DROP CONSTRAINT "FK_6fa02b022024b0a178885e41f95"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" DROP CONSTRAINT "FK_b39b765ed67f82c6b52d880713e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transactions" DROP CONSTRAINT "FK_1c943a6c464b35a42f9b01ea2ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transactions" DROP CONSTRAINT "FK_83c2abe698fcd1c228d4d3a1949"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transactions" DROP CONSTRAINT "FK_fb13b27af3e72dbc7674b89d4ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transactions" DROP CONSTRAINT "FK_1de51ddabd1bcf05c9f9c0d3fb0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transactions" DROP CONSTRAINT "FK_c1bae4bf39f6c62391d7e5b952a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transaction_events" DROP CONSTRAINT "FK_9fc70340c1784ca72269b9ea081"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_transaction_changes" DROP CONSTRAINT "FK_9fadade0adcaaf8010ef4446489"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_status_history" DROP CONSTRAINT "FK_ac1578ccc32c594c919e77ab868"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_status_history" DROP CONSTRAINT "FK_8b400ddff5f4c1484dc349d655f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_premium_breakdowns" DROP CONSTRAINT "FK_7b803b7223e98bc8011c0bc5e9d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_premium_breakdowns" DROP CONSTRAINT "FK_881a24bce6a42b39f40b0469b76"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_risks" DROP CONSTRAINT "FK_a303f1b4702cf94b428d5e4aac4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_risks" DROP CONSTRAINT "FK_24d3144874c6034bea14d03db02"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_risks" DROP CONSTRAINT "FK_b2f032601d1834853b5e3501b0b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_risks" DROP CONSTRAINT "FK_c598e82efc8037a1f85cb8ea62b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_risks" DROP CONSTRAINT "FK_0cdf1f8c1b597025d3b384c91be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" DROP CONSTRAINT "FK_d0b77d7017770daef812e712f71"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" DROP CONSTRAINT "FK_6527ce0234f7b67e168d3c7d947"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" DROP CONSTRAINT "FK_7675cc4b2736afcc905ec144281"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" DROP CONSTRAINT "FK_c8b874865a0f4b7397ddc44886c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" DROP CONSTRAINT "FK_65236236aa8afbe540cccae641d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matters" DROP CONSTRAINT "FK_3ee84192b50ef10e5d72345f829"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matter_factor_values" DROP CONSTRAINT "FK_c16c807f8a5e5ccff3f4100d459"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_matter_factor_values" DROP CONSTRAINT "FK_167b54706ac591defff9b4a0311"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rating_factors" DROP CONSTRAINT "FK_f5821597e2e8a2db3d813d7c4e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_cover_notes" DROP CONSTRAINT "FK_341d788fdb9f2e322f145c22848"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_cover_notes" DROP CONSTRAINT "FK_1fbaf78d9a871c1d6cefc16fc05"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" DROP CONSTRAINT "FK_995923d78e87b81a611d0453df4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" DROP CONSTRAINT "FK_e8c87c137c03d25d23418464719"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" DROP CONSTRAINT "FK_686f953478b635ef7d1dcb18781"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" DROP CONSTRAINT "FK_2f146932ced3d893755154d569a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" DROP CONSTRAINT "FK_b6734973870c21974811e20879b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" DROP CONSTRAINT "FK_aa5c51e86a873c225aefe2ba81c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cover_notes" DROP CONSTRAINT "FK_6ddb4cf38be8a2b700aeba7c1bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_b7940e13cb6a17a1e9087e78d7d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_757709f9ddcb679d6caa933e127"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_e173cf45299e8591b80924e2a13"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_ec1901bd8f11a1adc441ce0bdf6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_6c655818e6753ed41eb755b8bcb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_4e68f9183819b93ab74d1f6d129"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_4c847470d8e883e84a9c8061b4b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_cc6c7ed7b1b0e541ab54ea0da79"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_93a8c0e6fb7fc8f2cdf86db1ae4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_25dcb703da984fa66bde99af598"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_9faa10be11d38bd8106799e66ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_96bf8297a857ceb6a1ff1a0f652"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_17545bd211f67fca4e792196210"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_5f4e0ed5ac2b3644682583af62d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" DROP CONSTRAINT "FK_90672d758a28a7f6f26f660041e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_assets" DROP CONSTRAINT "FK_cb700c7d0584c6912e16cea6769"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_assets" DROP CONSTRAINT "FK_587e892145d4713dc294d4b0e6e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_assets" DROP CONSTRAINT "FK_6b72b2e4c439b57e48cd2ed5b46"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_policy_holders" DROP CONSTRAINT "FK_20ef343fa2c2763e3ffb95839a4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_policy_holders" DROP CONSTRAINT "FK_53d2472acd7229f2a05e7c69b30"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_cover_notes" DROP CONSTRAINT "FK_678dc3f2c5872c18981f8e6ad09"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_cover_note_entries" DROP CONSTRAINT "FK_e6b8cb3245499b095d6141e0500"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_subject_matters" DROP CONSTRAINT "FK_a30c5e9210d74f14d72e6cd7d8a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_motor_details" DROP CONSTRAINT "FK_37cffb80ef7baad58b32e419466"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_entry_risks" DROP CONSTRAINT "FK_1b9ea8d4700d70bc5b019994b6c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_entry_risks" DROP CONSTRAINT "FK_f787fb447385f919895276975c9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_taxes" DROP CONSTRAINT "FK_4347ad3b9b722126b21cd127f52"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_premium_overrides" DROP CONSTRAINT "FK_d58420f9103b339da2b4cc7b935"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_premium_overrides" DROP CONSTRAINT "FK_4af875ff0525e5ac993b826265d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_premium_overrides" DROP CONSTRAINT "FK_79806ca35465747a33c313d4c8f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_discounts" DROP CONSTRAINT "FK_af7f04bbd98fda16d6a2b86d211"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_risks" DROP CONSTRAINT "FK_608421eb9a97bb2c56058e8d609"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_risks" DROP CONSTRAINT "FK_bada67d3d74a399a152935900b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_risks" DROP CONSTRAINT "FK_71a7c83a34fdd1490aba8b845d6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_entry_addons" DROP CONSTRAINT "FK_0edb88f19be7a4ceb35f564565e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_entry_addon_taxes" DROP CONSTRAINT "FK_5b86d74973e2a6c59404fc3f34e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_status_history" DROP CONSTRAINT "FK_a352440062bfa4f06b024c8ecb7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_status_history" DROP CONSTRAINT "FK_e87b7dbdc6feae34ea434c233fd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" DROP CONSTRAINT "FK_1deb8a209c21b41690dcc71b826"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" DROP CONSTRAINT "FK_a7f6cbafa690b84cf7329e621e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" DROP CONSTRAINT "FK_70126325ceed803671ac77b6f2d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_product_versions" DROP CONSTRAINT "FK_09feffeafe2f171c899ebf5126d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_product_versions" DROP CONSTRAINT "FK_2ddc80d9847e28a75ddd9a6ad44"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_version_sub_classes" DROP CONSTRAINT "FK_3d6629b4219b8aa87e3cf27155b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_version_sub_classes" DROP CONSTRAINT "FK_9e3b0949677a7ffc232fb5ae2d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_sub_classes" DROP CONSTRAINT "FK_63ecfdabbefcc99a22d9e9e7d38"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_sub_classes" DROP CONSTRAINT "FK_b2a30603c1191b8b9870c9a25e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_document_requirements" DROP CONSTRAINT "FK_24212f61fa2ffe1c7646af6f63e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_addon_definitions" DROP CONSTRAINT "FK_983ed140b06b8c36ac463779a18"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_definition_items" DROP CONSTRAINT "FK_d59dc655c38fae0e732629f2642"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_categories" DROP CONSTRAINT "FK_1c68b3f832e6594848d15998cfe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" DROP CONSTRAINT "FK_539d0b079709dfa941242fc898b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" DROP CONSTRAINT "FK_492cc4d971a9644225b770d8f5f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" DROP CONSTRAINT "FK_de71abb8de3d170d4417e0132c0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" DROP CONSTRAINT "FK_8a1fc075e2d14ad506209463146"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicles" DROP CONSTRAINT "FK_cdfd30714ca46a08c077e07fd81"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicle_ownerships" DROP CONSTRAINT "FK_1f17ecb12c9b18884faa52969fd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicle_ownerships" DROP CONSTRAINT "FK_3067a128d292f667ae2c873f7c1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_vehicle_ownerships" DROP CONSTRAINT "FK_c8b76df22d8fead214816136b24"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "FK_2bc37c86fa4da512b40191693ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "FK_526a0e4622f2e6e3a21678731db"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "FK_9ec223c81ccbc99ae04fd79752f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "FK_f0e29920aaf871f3eddbea69f0d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insured_assets" DROP CONSTRAINT "FK_d3413a7044a7877b121e819eabd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insured_assets" DROP CONSTRAINT "FK_d1841e0ba8cac88ef078920982e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insured_assets" DROP CONSTRAINT "FK_4085e2bade402147224202aae6a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_kyc_reviews" DROP CONSTRAINT "FK_999865462d0d46d73c12408d4c3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_kyc_reviews" DROP CONSTRAINT "FK_0ebe2ce751ec4cc2355c43b636d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_identifiers" DROP CONSTRAINT "FK_0ce096807c81323096dea836435"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_identifiers" DROP CONSTRAINT "FK_bd069090c84b85a672fc2674b08"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_identifiers" DROP CONSTRAINT "FK_56c106b2567769a92a7069f820f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_documents" DROP CONSTRAINT "FK_5301fb44d91d7a9102f12fba583"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_documents" DROP CONSTRAINT "FK_1ce91246e23e44dc91d4624b16e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" DROP CONSTRAINT "FK_76ca61fed7339b9f358599f9fda"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" DROP CONSTRAINT "FK_c2dcbcd356afe3f4285b2599499"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_addresses" DROP CONSTRAINT "FK_ec6e9d7459e1a05cd0b376daafa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_addresses" DROP CONSTRAINT "FK_6665704c2e089d04f3fbbe90600"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_addresses" DROP CONSTRAINT "FK_6be4e1a698f5c3f2c2e4c75c186"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_addresses" DROP CONSTRAINT "FK_8821402eb6faf36eab1ad2670bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "departments" DROP CONSTRAINT "FK_40b8818a0e3324c859199265503"`,
    );
    await queryRunner.query(
      `ALTER TABLE "departments" DROP CONSTRAINT "FK_541e3d07c93baa9cc42b149a5fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_users" DROP CONSTRAINT "FK_da192729d410e929026a7aef253"`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_users" DROP CONSTRAINT "FK_8c0ba27e413a41a5fb0ddff5843"`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_users" DROP CONSTRAINT "FK_0ae0cd2276d8973121d191da629"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_company_configurations" DROP CONSTRAINT "FK_37e9de5ade6a888421a6c7b20f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_sale_points" DROP CONSTRAINT "FK_8f265e4fea834ebdecc521e6d85"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_sale_points" DROP CONSTRAINT "FK_12a3bea45da726cca25b87be45a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" DROP CONSTRAINT "FK_14da1875eaf9e5c81ca4678765d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" DROP CONSTRAINT "FK_5973f79e64a27c506b07cd84b29"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_features" DROP CONSTRAINT "FK_4f099a199202983bd5e53f4d129"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_features" DROP CONSTRAINT "FK_e146fc721a8c8e626d62d7cd530"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_features" DROP CONSTRAINT "FK_fe81add961e31d38ff880b21db3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_users" DROP CONSTRAINT "FK_17cbbd713e4213e3a83a0e88d6f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_users" DROP CONSTRAINT "FK_a426662e56c3eede9dcf463fd84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_users" DROP CONSTRAINT "FK_0363bc7120c6f81b0fdf3a77a8e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_users" DROP CONSTRAINT "FK_0a12e8588834314e38e43d6f5a7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_permissions" DROP CONSTRAINT "FK_acb030193db62480c2fd8b2e352"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_permissions" DROP CONSTRAINT "FK_42b8ee52319678d53cbfaf3f057"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_roles" DROP CONSTRAINT "FK_c1314bc5a97bc33594274eba554"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_user_roles" DROP CONSTRAINT "FK_74ec3aa89216198cb0cfd6edc24"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_633d504f6120c3e07ad0c9c141"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a334e85861688a57f9b31e7045"`,
    );
    await queryRunner.query(`DROP TABLE "permission_role"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0108297cf9d7271cd7839d4720"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5947c2ab570235dc9a6514854f"`,
    );
    await queryRunner.query(`DROP TABLE "permission_user"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0270be993d7a40e1191eff0e23"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_86227665514d1ffd65e24b63c1"`,
    );
    await queryRunner.query(`DROP TABLE "role_user"`);
    await queryRunner.query(`DROP TABLE "api_client_usage_events"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_api_clients_client_id"`);
    await queryRunner.query(`DROP TABLE "api_clients"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_company_configs_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_company_configs_is_active"`,
    );
    await queryRunner.query(`DROP TABLE "company_configs"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_reference_currencies_code"`,
    );
    await queryRunner.query(`DROP TABLE "reference_currencies"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reference_regions_country"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_reference_regions_country_code"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_reference_regions_country_name"`,
    );
    await queryRunner.query(`DROP TABLE "reference_regions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reference_districts_region"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_reference_districts_region_code"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_reference_districts_region_name"`,
    );
    await queryRunner.query(`DROP TABLE "reference_districts"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_reference_countries_iso3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_reference_countries_name"`,
    );
    await queryRunner.query(`DROP TABLE "reference_countries"`);
    await queryRunner.query(`DROP TABLE "company_subscriptions"`);
    await queryRunner.query(
      `DROP TYPE "public"."company_subscriptions_billing_interval_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."company_subscriptions_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "platform_usage_events"`);
    await queryRunner.query(`DROP TABLE "platform_usage_snapshots"`);
    await queryRunner.query(`DROP TABLE "saas_billing_cycles"`);
    await queryRunner.query(
      `DROP TYPE "public"."saas_billing_cycles_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "saas_invoice_adjustments"`);
    await queryRunner.query(
      `DROP TYPE "public"."saas_invoice_adjustments_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."saas_invoice_adjustments_adjustment_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "saas_invoice_items"`);
    await queryRunner.query(`DROP TABLE "saas_invoices"`);
    await queryRunner.query(`DROP TYPE "public"."saas_invoices_status_enum"`);
    await queryRunner.query(`DROP TABLE "saas_payments"`);
    await queryRunner.query(`DROP TYPE "public"."saas_payments_status_enum"`);
    await queryRunner.query(`DROP TABLE "saas_plan_features"`);
    await queryRunner.query(
      `DROP TYPE "public"."saas_plan_features_value_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "saas_plan_meter_rates"`);
    await queryRunner.query(`DROP TABLE "saas_plan_versions"`);
    await queryRunner.query(
      `DROP TYPE "public"."saas_plan_versions_billing_interval_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."saas_plan_versions_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "subscription_changes"`);
    await queryRunner.query(
      `DROP TYPE "public"."subscription_changes_change_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "saas_plans"`);
    await queryRunner.query(`DROP TYPE "public"."saas_plans_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."saas_plans_billing_interval_enum"`,
    );
    await queryRunner.query(`DROP TABLE "subscription_entitlements"`);
    await queryRunner.query(
      `DROP TYPE "public"."subscription_entitlements_value_type_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_system_configs_key"`);
    await queryRunner.query(`DROP TABLE "system_configs"`);
    await queryRunner.query(`DROP TABLE "analytics_projection_checkpoints"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_projection_events_pending"`,
    );
    await queryRunner.query(`DROP TABLE "analytics_projection_events"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_action"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_company_created"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_request_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_correlation_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_event_no"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_devices_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_devices_user_trusted"`);
    await queryRunner.query(`DROP TABLE "devices"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_otp_target_purpose"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_otp_user_id"`);
    await queryRunner.query(`DROP TABLE "otp_verifications"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_data_retention_company_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_data_retention_policy_version"`,
    );
    await queryRunner.query(`DROP TABLE "data_retention_policies"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_legal_hold_resource_active"`,
    );
    await queryRunner.query(`DROP TABLE "legal_holds"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_security_policy_company_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_security_policy_profile_version"`,
    );
    await queryRunner.query(`DROP TABLE "security_policy_profiles"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sessions_user_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_sessions_expires_revoked"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_sessions_user_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_sessions_device_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_sessions_family_active"`,
    );
    await queryRunner.query(`DROP TABLE "user_sessions"`);
    await queryRunner.query(`DROP TABLE "analytics_metric_definitions"`);
    await queryRunner.query(`DROP TABLE "analytics_metric_values"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_commission_payments_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_commission_payments_intermediary_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_commission_payments_payment_no"`,
    );
    await queryRunner.query(`DROP TABLE "commission_payments"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cpi_commission_payment_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cpi_commission_transaction_id"`,
    );
    await queryRunner.query(`DROP TABLE "commission_payment_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_commission_transactions_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_commission_transactions_policy_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_commission_transactions_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_commission_transactions_quotation_id"`,
    );
    await queryRunner.query(`DROP TABLE "commission_transactions"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_finance_account_code_entity"`,
    );
    await queryRunner.query(`DROP TABLE "finance_accounts"`);
    await queryRunner.query(`DROP TABLE "finance_journal_lines"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_finance_journal_number_entity"`,
    );
    await queryRunner.query(`DROP TABLE "finance_journal_entries"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_finance_outbox_event_key_entity"`,
    );
    await queryRunner.query(`DROP TABLE "finance_outbox_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_finance_provider_event_entity"`,
    );
    await queryRunner.query(`DROP TABLE "finance_provider_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_reconciliation_batch_line_entity"`,
    );
    await queryRunner.query(`DROP TABLE "finance_reconciliation_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_finance_reconciliation_batch_entity"`,
    );
    await queryRunner.query(`DROP TABLE "finance_reconciliation_batches"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_finance_refund_number_entity"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_finance_refunds_source"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_finance_refund_source_receipt_invoice"`,
    );
    await queryRunner.query(`DROP TABLE "finance_refunds"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_financial_reversal_no"`);
    await queryRunner.query(`DROP TABLE "financial_reversals"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_receipt_allocation_invoice"`,
    );
    await queryRunner.query(`DROP TABLE "receipt_allocations"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_receipts_company_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_receipts_company_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_receipts_company_receipt_no"`,
    );
    await queryRunner.query(`DROP TABLE "receipts"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_payment_transactions_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_payment_transactions_invoice_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_payment_transactions_receipt_id"`,
    );
    await queryRunner.query(`DROP TABLE "payment_transactions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_branch_category_access_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_branch_category_access_branch_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_branch_category_access_category_id"`,
    );
    await queryRunner.query(`DROP TABLE "branch_category_access"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dept_category_access_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dept_category_access_department_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dept_category_access_category_id"`,
    );
    await queryRunner.query(`DROP TABLE "department_category_access"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_category_access_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_category_access_company_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_category_access_category_id"`,
    );
    await queryRunner.query(`DROP TABLE "user_category_access"`);
    await queryRunner.query(`DROP TABLE "claim_decisions"`);
    await queryRunner.query(`DROP TABLE "claim_disbursements"`);
    await queryRunner.query(`DROP TABLE "claim_discharge_vouchers"`);
    await queryRunner.query(`DROP TABLE "claim_intimations"`);
    await queryRunner.query(`DROP TABLE "claim_recoveries"`);
    await queryRunner.query(`DROP TABLE "claim_regulatory_operations"`);
    await queryRunner.query(`DROP TABLE "claim_rejections"`);
    await queryRunner.query(`DROP TABLE "claim_reserve_movements"`);
    await queryRunner.query(`DROP TABLE "claim_service_assignments"`);
    await queryRunner.query(`DROP TABLE "claim_sla_events"`);
    await queryRunner.query(`DROP TABLE "claim_sla_rules"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_claims_company_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_claims_assigned_user"`);
    await queryRunner.query(`DROP TABLE "claims"`);
    await queryRunner.query(`DROP TABLE "claim_status_history"`);
    await queryRunner.query(`DROP TABLE "claim_reserves"`);
    await queryRunner.query(`DROP TABLE "claim_payments"`);
    await queryRunner.query(`DROP TABLE "claim_documents"`);
    await queryRunner.query(`DROP TABLE "claim_claimants"`);
    await queryRunner.query(`DROP TABLE "claim_assessments"`);
    await queryRunner.query(`DROP TABLE "complaint_appeals"`);
    await queryRunner.query(`DROP TABLE "complaint_comments"`);
    await queryRunner.query(`DROP TABLE "complaint_sla_events"`);
    await queryRunner.query(`DROP TABLE "complaint_sla_rules"`);
    await queryRunner.query(`DROP TABLE "complaint_status_history"`);
    await queryRunner.query(`DROP TABLE "complaints"`);
    await queryRunner.query(`DROP TABLE "communication_messages"`);
    await queryRunner.query(`DROP TABLE "communication_threads"`);
    await queryRunner.query(`DROP TABLE "document_security_scans"`);
    await queryRunner.query(`DROP TABLE "document_templates"`);
    await queryRunner.query(`DROP TABLE "document_template_versions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_documents_owner"`);
    await queryRunner.query(`DROP TABLE "documents"`);
    await queryRunner.query(`DROP TABLE "document_upload_sessions"`);
    await queryRunner.query(`DROP TABLE "document_links"`);
    await queryRunner.query(`DROP TABLE "document_access_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_document_versions_document"`,
    );
    await queryRunner.query(`DROP TABLE "document_versions"`);
    await queryRunner.query(`DROP TABLE "signature_events"`);
    await queryRunner.query(`DROP TABLE "signature_evidence"`);
    await queryRunner.query(`DROP TABLE "signature_participants"`);
    await queryRunner.query(`DROP TABLE "signature_requests"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_partner_insurer"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_partner_company"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_current_agency_one_insurer"`,
    );
    await queryRunner.query(`DROP TABLE "insurance_company_partners"`);
    await queryRunner.query(
      `DROP TYPE "public"."insurance_company_partners_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."insurance_company_partners_partner_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_fleets_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_fleets_company_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_fleets_company_fleet_no"`,
    );
    await queryRunner.query(`DROP TABLE "motor_fleets"`);
    await queryRunner.query(`DROP TABLE "motor_fleet_memberships"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mfi_fleet_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mfi_motor_vehicle_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_mfi_quotation_entry_risk_id"`,
    );
    await queryRunner.query(`DROP TABLE "motor_fleet_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mpd_policy_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mpd_policy_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mpd_motor_vehicle_id"`);
    await queryRunner.query(`DROP TABLE "motor_policy_details"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_nmpd_policy_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_nmpd_policy_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_nmpd_subject_matter_id"`);
    await queryRunner.query(`DROP TABLE "non_motor_policy_details"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_portal_invitations_company_email"`,
    );
    await queryRunner.query(`DROP TABLE "portal_invitations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_portal_notifications_user"`,
    );
    await queryRunner.query(`DROP TABLE "portal_notifications"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_portal_requests_company_status"`,
    );
    await queryRunner.query(`DROP TABLE "portal_service_requests"`);
    await queryRunner.query(`DROP TABLE "portal_service_request_events"`);
    await queryRunner.query(`DROP TABLE "portal_request_attachments"`);
    await queryRunner.query(`DROP TABLE "portal_payment_proofs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_portal_accounts_company_user"`,
    );
    await queryRunner.query(`DROP TABLE "portal_accounts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invoices_company_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_invoices_company_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_invoices_company_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_invoices_company_invoice_no"`,
    );
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_invoice_items_invoice_id"`,
    );
    await queryRunner.query(`DROP TABLE "invoice_items"`);
    await queryRunner.query(`DROP TABLE "policy_renewals"`);
    await queryRunner.query(`DROP TABLE "policy_endorsements"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_endorsement_types_company_active"`,
    );
    await queryRunner.query(`DROP TABLE "endorsement_types"`);
    await queryRunner.query(`DROP TABLE "policy_cancellations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pricing_quotes_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pricing_quotes_company_product_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pricing_quotes_company_risk_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pricing_quotes_pricing_quote_id"`,
    );
    await queryRunner.query(`DROP TABLE "pricing_quotes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_addon_rate_rules_resolution"`,
    );
    await queryRunner.query(`DROP TABLE "product_addon_rate_rules"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_branch_product_access_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_branch_product_access_branch_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_branch_product_access_product_id"`,
    );
    await queryRunner.query(`DROP TABLE "branch_product_access"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dept_product_access_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dept_product_access_department_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dept_product_access_product_id"`,
    );
    await queryRunner.query(`DROP TABLE "department_product_access"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_product_access_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_product_access_company_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_product_access_product_id"`,
    );
    await queryRunner.query(`DROP TABLE "user_product_access"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pcr_insurer_company_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pcr_intermediary_company_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_pcr_product_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pcr_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pcr_status"`);
    await queryRunner.query(`DROP TABLE "product_commission_rules"`);
    await queryRunner.query(
      `DROP TYPE "public"."product_commission_type_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_pdc_insurer_company_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pdc_intermediary_company_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_pdc_product_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pdc_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pdc_channel_type"`);
    await queryRunner.query(`DROP TABLE "product_distribution_channels"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pddr_company_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pddr_product_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pddr_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pddr_status"`);
    await queryRunner.query(
      `DROP TABLE "product_distribution_document_requirements"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_ptr_company_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ptr_category_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ptr_product_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ptr_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ptr_status"`);
    await queryRunner.query(`DROP TABLE "product_tax_rules"`);
    await queryRunner.query(`DROP TYPE "public"."product_tax_type_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."product_charge_category_enum"`,
    );
    await queryRunner.query(`DROP TABLE "company_regulatory_profiles"`);
    await queryRunner.query(
      `DROP TYPE "public"."company_regulatory_profiles_levy_frequency_enum"`,
    );
    await queryRunner.query(`DROP TABLE "premium_ledger_entries"`);
    await queryRunner.query(
      `DROP TYPE "public"."premium_ledger_entries_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."premium_ledger_entries_entry_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "premium_levy_return_lines"`);
    await queryRunner.query(
      `DROP TYPE "public"."premium_levy_return_lines_line_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "product_performance_snapshots"`);
    await queryRunner.query(`DROP TABLE "premium_levy_returns"`);
    await queryRunner.query(
      `DROP TYPE "public"."premium_levy_returns_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "regulatory_authority_profiles"`);
    await queryRunner.query(`DROP TABLE "regulatory_levy_assessments"`);
    await queryRunner.query(`DROP TABLE "regulatory_ledger_entries"`);
    await queryRunner.query(`DROP TABLE "regulatory_levy_rules"`);
    await queryRunner.query(`DROP TABLE "regulatory_obligation_definitions"`);
    await queryRunner.query(`DROP TABLE "regulatory_obligation_instances"`);
    await queryRunner.query(`DROP TABLE "regulatory_obligation_templates"`);
    await queryRunner.query(
      `DROP TYPE "public"."regulatory_obligation_templates_offset_unit_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."regulatory_obligation_templates_due_rule_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."regulatory_obligation_templates_frequency_enum"`,
    );
    await queryRunner.query(`DROP TABLE "regulatory_obligations"`);
    await queryRunner.query(
      `DROP TYPE "public"."regulatory_obligations_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "regulatory_return_attachments"`);
    await queryRunner.query(`DROP TABLE "regulatory_return_definitions"`);
    await queryRunner.query(
      `DROP TYPE "public"."regulatory_return_definitions_frequency_enum"`,
    );
    await queryRunner.query(`DROP TABLE "regulatory_return_submissions"`);
    await queryRunner.query(`DROP TABLE "regulatory_returns"`);
    await queryRunner.query(
      `DROP TYPE "public"."regulatory_returns_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "regulatory_submission_events"`);
    await queryRunner.query(`DROP TABLE "facultative_signed_lines"`);
    await queryRunner.query(`DROP TABLE "facultative_placements"`);
    await queryRunner.query(`DROP TABLE "facultative_placement_offers"`);
    await queryRunner.query(`DROP TABLE "reinsurance_bordereaux"`);
    await queryRunner.query(`DROP TABLE "reinsurance_bordereau_items"`);
    await queryRunner.query(`DROP TABLE "reinsurance_counterparties"`);
    await queryRunner.query(`DROP TABLE "reinsurance_declarations"`);
    await queryRunner.query(`DROP TABLE "policy_cessions"`);
    await queryRunner.query(`DROP TABLE "policy_cession_participants"`);
    await queryRunner.query(`DROP TABLE "reinsurance_premium_accounts"`);
    await queryRunner.query(`DROP TABLE "reinsurance_premium_account_items"`);
    await queryRunner.query(`DROP TABLE "reinsurance_programs"`);
    await queryRunner.query(`DROP TABLE "reinsurance_reconciliation_items"`);
    await queryRunner.query(`DROP TABLE "reinsurance_recovery_receipts"`);
    await queryRunner.query(`DROP TABLE "reinsurance_claim_recoveries"`);
    await queryRunner.query(`DROP TABLE "reinsurance_settlements"`);
    await queryRunner.query(`DROP TABLE "reinsurance_settlement_items"`);
    await queryRunner.query(
      `DROP TABLE "reinsurance_treaty_eligibility_rules"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reinsurance_treaty_company"`,
    );
    await queryRunner.query(`DROP TABLE "reinsurance_treaties"`);
    await queryRunner.query(`DROP TABLE "reinsurance_treaty_participants"`);
    await queryRunner.query(`DROP TABLE "reinsurance_treaty_sections"`);
    await queryRunner.query(`DROP TABLE "report_access_audit_events"`);
    await queryRunner.query(`DROP TABLE "report_artifacts"`);
    await queryRunner.query(
      `DROP TYPE "public"."report_artifacts_format_enum"`,
    );
    await queryRunner.query(`DROP TABLE "report_definitions"`);
    await queryRunner.query(
      `DROP TYPE "public"."report_definitions_default_format_enum"`,
    );
    await queryRunner.query(`DROP TABLE "report_delivery_attempts"`);
    await queryRunner.query(`DROP TABLE "report_jobs"`);
    await queryRunner.query(
      `DROP TYPE "public"."report_jobs_delivery_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."report_jobs_format_enum"`);
    await queryRunner.query(`DROP TYPE "public"."report_jobs_status_enum"`);
    await queryRunner.query(`DROP TABLE "report_schedules"`);
    await queryRunner.query(
      `DROP TYPE "public"."report_schedules_delivery_channel_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."report_schedules_format_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."report_schedules_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_required_factor_rate_book"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_required_factor_legacy"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_required_factors_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_required_factors_risk_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_required_factors_factor_id"`,
    );
    await queryRunner.query(`DROP TABLE "risk_required_factors"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_rule_conditions_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_rule_conditions_rule_id"`,
    );
    await queryRunner.query(`DROP TABLE "risk_rule_conditions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_rating_rules_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_rating_rules_risk_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_rating_rules_is_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_risk_rating_rules_company_risk_name_legacy"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_risk_rating_rules_company_risk_book_name"`,
    );
    await queryRunner.query(`DROP TABLE "risk_rating_rules"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pricing_rate_books_company_product"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pricing_rate_books_status"`,
    );
    await queryRunner.query(`DROP TABLE "pricing_rate_books"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pts_company_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pts_policy_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pts_quotation_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pts_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pts_request_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pts_transaction_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pts_business_reference"`);
    await queryRunner.query(`DROP TABLE "portal_tira_submissions"`);
    await queryRunner.query(
      `DROP TYPE "public"."portal_tira_submission_status_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_ptse_submission_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ptse_request_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ptse_event_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ptse_created_at"`);
    await queryRunner.query(`DROP TABLE "portal_tira_submission_events"`);
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tenant_notification_user"`,
    );
    await queryRunner.query(`DROP TABLE "tenant_notifications"`);
    await queryRunner.query(`DROP TABLE "work_item_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_work_items_company_status"`,
    );
    await queryRunner.query(`DROP TABLE "work_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_804c9d19bef1fa5df45047acfc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e55f92a76dad312ad399f6947f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7d5dcd533ef38bd3bdb3c062d8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9aa1bdb26a6e0dcb6051d234d9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f0048839860255c7aaf6694ee8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_79e96c137a1e1c40d4b9866ee6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e92727e34143e69e71c53ee36f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5b91c967178cb6aef40f987c1b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9aff4afbd1d6e01a227ecbe464"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_audit_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tiramis_business_records_company"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tiramis_business_records_source"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tiramis_business_records_reference"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tiramis_business_records_status"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_business_records"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_policies_company_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policies_company_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policies_company_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policies_company_product_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policies_company_policy_no"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_policies_issued_quotation_revision"`,
    );
    await queryRunner.query(`DROP TABLE "policies"`);
    await queryRunner.query(`DROP TYPE "public"."policy_channel_type_enum"`);
    await queryRunner.query(`DROP TABLE "policy_versions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policy_transactions_company_type_stage"`,
    );
    await queryRunner.query(`DROP TABLE "policy_transactions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policy_transaction_events_transaction"`,
    );
    await queryRunner.query(`DROP TABLE "policy_transaction_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policy_transaction_changes_transaction"`,
    );
    await queryRunner.query(`DROP TABLE "policy_transaction_changes"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_psh_policy_id"`);
    await queryRunner.query(`DROP TABLE "policy_status_history"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ppb_policy_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ppb_policy_risk_id"`);
    await queryRunner.query(`DROP TABLE "policy_premium_breakdowns"`);
    await queryRunner.query(
      `DROP TYPE "public"."policy_calculation_base_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."policy_premium_item_type_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_policy_risks_policy_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_policy_risks_risk_id"`);
    await queryRunner.query(`DROP TABLE "policy_risks"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_subject_matters_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_subject_matters_company_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_subject_matters_company_subject_code"`,
    );
    await queryRunner.query(`DROP TABLE "subject_matters"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_smfv_subject_matter_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_smfv_factor_id"`);
    await queryRunner.query(`DROP TABLE "subject_matter_factor_values"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rating_factors_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rating_factors_is_active"`,
    );
    await queryRunner.query(`DROP TABLE "rating_factors"`);
    await queryRunner.query(`DROP TABLE "policy_cover_notes"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_cover_note_quotation_entry"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_cover_note_regulatory_reference"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_cover_note_customer"`);
    await queryRunner.query(`DROP TABLE "cover_notes"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_quotations_company_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_approval_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_payment_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_tira_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_stage_v2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_approval_status_v2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_payment_status_v2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_submission_status_v2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_product_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_flow"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_finalization_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_workflow_gate_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quotations_company_quotation_no"`,
    );
    await queryRunner.query(`DROP TABLE "quotations"`);
    await queryRunner.query(`DROP TYPE "public"."quotation_channel_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."quotation_flow_enum"`);
    await queryRunner.query(`DROP TYPE "public"."quotation_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_quotation_risk_assets_risk"`,
    );
    await queryRunner.query(`DROP TABLE "quotation_risk_assets"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_qph_quotation_sequence"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qph_customer_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qph_identity"`);
    await queryRunner.query(`DROP TABLE "quotation_policy_holders"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_quotation_cover_notes_quotation_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_quotation_cover_notes_fleet_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_qcn_dates"`);
    await queryRunner.query(`DROP TABLE "quotation_cover_notes"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_qcne_cover_note_entry_number"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_qcne_cover_note_number"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qcne_cover_note_id"`);
    await queryRunner.query(`DROP TABLE "quotation_cover_note_entries"`);
    await queryRunner.query(`DROP TYPE "public"."quotation_entry_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_qsm_entry_sequence"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qsm_entry_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qsm_reference"`);
    await queryRunner.query(`DROP TABLE "quotation_subject_matters"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_qmd_entry_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_qmd_registration_number"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_qmd_chassis_number"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qmd_engine_number"`);
    await queryRunner.query(`DROP TABLE "quotation_motor_details"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_qer_entry_sequence"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qer_entry_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qer_risk_code"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qer_insurance_risk_id"`);
    await queryRunner.query(`DROP TABLE "quotation_entry_risks"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qrt_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_qrt_risk_sequence"`);
    await queryRunner.query(`DROP TABLE "quotation_risk_taxes"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qrpo_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_qrpo_risk_sequence"`);
    await queryRunner.query(`DROP TABLE "quotation_risk_premium_overrides"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qrd_risk_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_qrd_risk_sequence"`);
    await queryRunner.query(`DROP TABLE "quotation_risk_discounts"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_risks_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_risks_product_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_risks_sub_class_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_risks_is_active"`,
    );
    await queryRunner.query(`DROP TABLE "insurance_risks"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_qea_entry_sequence"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qea_entry_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qea_reference"`);
    await queryRunner.query(`DROP TABLE "quotation_entry_addons"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qeat_addon_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_qeat_addon_sequence"`);
    await queryRunner.query(`DROP TABLE "quotation_entry_addon_taxes"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_qsh_quotation_id"`);
    await queryRunner.query(`DROP TABLE "quotation_status_history"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_products_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_products_category_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_products_is_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_products_business_line"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_products_supports_fleet"`,
    );
    await queryRunner.query(`DROP TABLE "insurance_products"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_product_versions_company"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_product_versions_product_status"`,
    );
    await queryRunner.query(`DROP TABLE "insurance_product_versions"`);
    await queryRunner.query(`DROP TABLE "product_version_sub_classes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_sub_classes_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_sub_classes_product_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_sub_classes_is_active"`,
    );
    await queryRunner.query(`DROP TABLE "insurance_sub_classes"`);
    await queryRunner.query(`DROP TABLE "product_document_requirements"`);
    await queryRunner.query(`DROP TABLE "product_addon_definitions"`);
    await queryRunner.query(`DROP TABLE "product_definition_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_categories_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_categories_is_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_categories_business_line"`,
    );
    await queryRunner.query(`DROP TABLE "insurance_categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_vehicles_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_vehicles_company_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_vehicles_company_registration_no"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_vehicles_company_chassis_no"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_motor_vehicles_company_engine_no"`,
    );
    await queryRunner.query(`DROP TABLE "motor_vehicles"`);
    await queryRunner.query(`DROP TABLE "motor_vehicle_ownerships"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_customers_company_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_customers_company_customer_no"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_customers_company_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_customers_company_customer_type"`,
    );
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP TYPE "public"."customer_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."customer_document_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."customer_kyc_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."customer_gender_enum"`);
    await queryRunner.query(`DROP TYPE "public"."customer_type_enum"`);
    await queryRunner.query(`DROP TABLE "insured_assets"`);
    await queryRunner.query(`DROP TABLE "customer_kyc_reviews"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customer_identifier_company_type_value"`,
    );
    await queryRunner.query(`DROP TABLE "customer_identifiers"`);
    await queryRunner.query(`DROP TABLE "customer_documents"`);
    await queryRunner.query(`DROP TABLE "customer_contacts"`);
    await queryRunner.query(`DROP TABLE "customer_addresses"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_departments_company_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_departments_branch_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_departments_status"`);
    await queryRunner.query(`DROP TABLE "departments"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0ae0cd2276d8973121d191da62"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8c0ba27e413a41a5fb0ddff584"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_da192729d410e929026a7aef25"`,
    );
    await queryRunner.query(`DROP TABLE "department_users"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tiramis_company_config_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tiramis_company_config_environment"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tiramis_company_config_company_code"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_company_configurations"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_tiramis_lookups_group_code"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_lookups"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_033ea7c1f6d324492b3e4446f0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3803f6fc072e1d2f3af11b6e87"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e2722912fd72b62d3b446023d6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3b53010f93bb915f08ac223e0c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b3f28c61c3417d220a279219dc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9751d6b9f5875135eb9023d96a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_51b42a7add6bcc3dd6619321df"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b0a40f07f8b5f84b69bea17db8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_63a278be9de80a2038d26f1816"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_239dae46f7ccee665b466dadb5"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_notifications"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tiramis_sale_points_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tiramis_sale_points_branch_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tiramis_sale_points_sale_point_code"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_sale_points"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_branches_company_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_branches_status"`);
    await queryRunner.query(`DROP TABLE "branches"`);
    await queryRunner.query(`DROP TABLE "branch_features"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_company_features_company_id"`,
    );
    await queryRunner.query(`DROP TABLE "company_features"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_branch_users_branch_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_branch_users_company_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "branch_users"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_companies_identifier_prefix"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_companies_name"`);
    await queryRunner.query(`DROP TABLE "companies"`);
    await queryRunner.query(`DROP TYPE "public"."companies_company_type_enum"`);
    await queryRunner.query(`DROP TABLE "company_users"`);
    await queryRunner.query(`DROP TABLE "company_user_permissions"`);
    await queryRunner.query(`DROP TABLE "company_user_roles"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_role_company"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_roles_scope_company"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_roles_global_name"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_roles_company_name"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_permission_name"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_22f92c66c9ba233fc2bdcda026"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6f2de86d260058b732210972f6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c9b0430a762bec34a996529675"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_42c09d8e6672dc7d55cc3730ae"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_31d3e713ccc9a8180ae27ce13f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2f8146548fd3c3bb8fdd033cf1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c408eca454c38a059bab4bd3b2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_545c88f16d7be52d5185008549"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dda15935ea15d62b4706557af7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dc01abe1be2aeda70d09bc9865"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a66089d44f52084f7a272a064e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7f34a16825336290c51be1a9d9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_87cf0ce5fe19aa818e9f981e0f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e44d013ae76322e15e409e1682"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9ef2adfd1ec2cf03b853d827ee"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_submission_tracking"`);
  }
}
