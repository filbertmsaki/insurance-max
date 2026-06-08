import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1779875576591 implements MigrationInterface {
  name = 'Migration1779875576591';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "company_user_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_user_id" uuid NOT NULL, "role_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_company_user_roles_membership_role" UNIQUE ("company_user_id", "role_id"), CONSTRAINT "PK_745cfc55c7335ce3f01b5da5189" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "display_name" character varying(100) NOT NULL, "description" text, "is_system_generated" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_permission_name" ON "permissions" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "company_user_permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_user_id" uuid NOT NULL, "permission_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_company_user_permissions_membership_permission" UNIQUE ("company_user_id", "permission_id"), CONSTRAINT "PK_d30fb64106f894e6b1152f4eb5d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "company_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "user_id" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'active', "is_default" boolean NOT NULL DEFAULT false, "last_accessed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_company_users_company_user" UNIQUE ("company_id", "user_id"), CONSTRAINT "PK_fcd31773e604355d8a473de888c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "slug" character varying(120) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'active', "contact_email" character varying(100), "contact_phone" character varying(30), "website" character varying(255), "logo_url" character varying(500), "address" jsonb, "settings" jsonb, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b28b07d25e4324eee577de5496d" UNIQUE ("slug"), CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(50) NOT NULL, "display_name" character varying(100) NOT NULL, "description" text, "company_id" uuid, "is_system_generated" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_role_company" ON "roles" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_no" character varying(30) NOT NULL, "first_name" character varying(50) NOT NULL, "last_name" character varying(50) NOT NULL, "phone" character varying(20) NOT NULL, "email" character varying(100) NOT NULL, "password" character varying(255), "status" character varying(20) NOT NULL DEFAULT 'active', "user_type" character varying(20) NOT NULL DEFAULT 'CUSTOMER', "is_email_verified" boolean NOT NULL DEFAULT false, "is_phone_verified" boolean NOT NULL DEFAULT false, "email_verification_token" character varying(255), "email_verification_expires" TIMESTAMP WITH TIME ZONE, "failed_login_attempts" integer NOT NULL DEFAULT '0', "locked_until" TIMESTAMP WITH TIME ZONE, "last_login_at" TIMESTAMP WITH TIME ZONE, "last_login_ip" character varying(45), "is_two_factor_enabled" boolean NOT NULL DEFAULT false, "two_factor_secret" text, "two_factor_backup_codes" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_e5f6813966537a78538a896d74b" UNIQUE ("user_no"), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "refresh_token_hash" character varying(255) NOT NULL, "device_id" uuid, "ip_address" character varying(45), "user_agent" text, "device_info" jsonb, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked" boolean NOT NULL DEFAULT false, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_expires_revoked" ON "user_sessions" ("expires_at", "revoked") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_user_id" ON "user_sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "insurance_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "code" character varying(50) NOT NULL, "name" character varying(150) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_insurance_categories_company_name" UNIQUE ("company_id", "name"), CONSTRAINT "UQ_insurance_categories_company_code" UNIQUE ("company_id", "code"), CONSTRAINT "PK_9e9d526e40b7a3adbc887cea078" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_categories_is_active" ON "insurance_categories" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_insurance_categories_company_id" ON "insurance_categories" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "insurance_products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "category_id" uuid NOT NULL, "product_code" character varying(50) NOT NULL, "product_name" character varying(150) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_insurance_products_company_category_name" UNIQUE ("company_id", "category_id", "product_name"), CONSTRAINT "UQ_insurance_products_company_code" UNIQUE ("company_id", "product_code"), CONSTRAINT "PK_36ac5b506fcc1644ddf95580824" PRIMARY KEY ("id"))`,
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
      `CREATE TABLE "insurance_sub_classes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_id" uuid NOT NULL, "code" character varying(50) NOT NULL, "name" character varying(150) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_insurance_sub_classes_company_product_name" UNIQUE ("company_id", "product_id", "name"), CONSTRAINT "UQ_insurance_sub_classes_company_product_code" UNIQUE ("company_id", "product_id", "code"), CONSTRAINT "PK_aa616f43d088dd82838d8f592ba" PRIMARY KEY ("id"))`,
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
      `CREATE TABLE "insurance_risks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "product_id" uuid NOT NULL, "sub_class_id" uuid, "risk_code" character varying(50) NOT NULL, "risk_name" character varying(600) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_insurance_risks_company_product_name" UNIQUE ("company_id", "product_id", "risk_name"), CONSTRAINT "UQ_insurance_risks_company_code" UNIQUE ("company_id", "risk_code"), CONSTRAINT "PK_b8dacfa9cb9ce1c47583953fc22" PRIMARY KEY ("id"))`,
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
      `CREATE TYPE "public"."risk_rating_rules_rate_type_enum" AS ENUM('PERCENTAGE', 'FIXED', 'PERCENTAGE_PLUS_FIXED', 'PERCENTAGE_PLUS_PER_UNIT', 'PER_UNIT', 'FORMULA')`,
    );
    await queryRunner.query(
      `CREATE TABLE "risk_rating_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "risk_id" uuid NOT NULL, "rule_name" character varying(150) NOT NULL, "rate_type" "public"."risk_rating_rules_rate_type_enum" NOT NULL DEFAULT 'PERCENTAGE', "percentage_rate" numeric(18,6), "fixed_amount" numeric(18,2), "per_unit_amount" numeric(18,6), "per_unit_factor_code" character varying(100), "minimum_amount" numeric(18,2), "formula" text, "priority" integer NOT NULL DEFAULT '1', "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_risk_rating_rules_company_risk_name" UNIQUE ("company_id", "risk_id", "rule_name"), CONSTRAINT "PK_e08043838a735aaec300b1313d0" PRIMARY KEY ("id")); COMMENT ON COLUMN "risk_rating_rules"."percentage_rate" IS 'Rate as percentage (e.g. 3.5 means 3.5%)'; COMMENT ON COLUMN "risk_rating_rules"."per_unit_factor_code" IS 'Factor code used as unit for per-unit rate types'; COMMENT ON COLUMN "risk_rating_rules"."formula" IS 'Math formula using factor codes as variables, e.g. (sum_insured * 0.03)'`,
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
      `CREATE TYPE "public"."risk_rule_conditions_operator_enum" AS ENUM('EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'BETWEEN', 'IN', 'NOT_IN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."risk_rule_conditions_logical_operator_enum" AS ENUM('AND', 'OR')`,
    );
    await queryRunner.query(
      `CREATE TABLE "risk_rule_conditions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "rule_id" uuid NOT NULL, "factor_code" character varying(100) NOT NULL, "operator" "public"."risk_rule_conditions_operator_enum" NOT NULL DEFAULT 'EQUALS', "value_from" character varying(255), "value_to" character varying(255), "logical_operator" "public"."risk_rule_conditions_logical_operator_enum" NOT NULL DEFAULT 'AND', "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_risk_rule_conditions_rule_factor_op_from_to" UNIQUE ("company_id", "rule_id", "factor_code", "operator", "value_from", "value_to"), CONSTRAINT "PK_6b136f3afbbcb5095ca76d1f39c" PRIMARY KEY ("id")); COMMENT ON COLUMN "risk_rule_conditions"."factor_code" IS 'References RatingFactor.code'; COMMENT ON COLUMN "risk_rule_conditions"."logical_operator" IS 'Logical operator combining this condition with the next'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risk_rule_conditions_rule_id" ON "risk_rule_conditions" ("rule_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risk_rule_conditions_company_id" ON "risk_rule_conditions" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."rating_factors_data_type_enum" AS ENUM('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "rating_factors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "code" character varying(100) NOT NULL, "name" character varying(150) NOT NULL, "data_type" "public"."rating_factors_data_type_enum" NOT NULL DEFAULT 'NUMBER', "options" jsonb, "default_value" character varying(255), "is_required" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_rating_factors_company_name" UNIQUE ("company_id", "name"), CONSTRAINT "UQ_rating_factors_company_code" UNIQUE ("company_id", "code"), CONSTRAINT "PK_43ec32f6253a45bf42ecb05a026" PRIMARY KEY ("id")); COMMENT ON COLUMN "rating_factors"."options" IS 'Available options for SELECT/MULTI_SELECT types'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rating_factors_is_active" ON "rating_factors" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rating_factors_company_id" ON "rating_factors" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "risk_required_factors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "risk_id" uuid NOT NULL, "factor_id" uuid NOT NULL, "is_required" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_risk_required_factors_company_risk_factor" UNIQUE ("company_id", "risk_id", "factor_id"), CONSTRAINT "PK_491a07199b8634c137480ede4de" PRIMARY KEY ("id"))`,
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
      `CREATE TYPE "public"."user_product_access_access_status_enum" AS ENUM('ALLOW', 'DENY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_product_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "company_user_id" uuid NOT NULL, "product_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" "public"."user_product_access_access_status_enum" NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_user_product_access_company_user_product" UNIQUE ("company_id", "company_user_id", "product_id"), CONSTRAINT "PK_2b6e2d9b8f3b07335af556a17c0" PRIMARY KEY ("id"))`,
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
      `CREATE TABLE "branch_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "company_user_id" uuid NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_branch_users_branch_company_user" UNIQUE ("branch_id", "company_user_id"), CONSTRAINT "PK_165d04e1f7360e289b9afa2ee96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_users_company_user_id" ON "branch_users" ("company_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_users_branch_id" ON "branch_users" ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "company_features" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "feature_key" character varying(100) NOT NULL, "display_name" character varying(150) NOT NULL, "description" text, "is_enabled" boolean NOT NULL DEFAULT true, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_company_features_company_key" UNIQUE ("company_id", "feature_key"), CONSTRAINT "PK_0313635ef7228bbca878f35ec2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_company_features_company_id" ON "company_features" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "branch_features" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "company_feature_id" uuid NOT NULL, "is_enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_branch_features_branch_feature" UNIQUE ("branch_id", "company_feature_id"), CONSTRAINT "PK_97e9c5f34b989f3a7c15dde32cf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "code" character varying(50) NOT NULL, "sale_point_code" character varying(100), "sale_point_name" character varying(150), "status" character varying(20) NOT NULL DEFAULT 'active', "address" jsonb, "phone" character varying(30), "email" character varying(100), "manager_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_branches_company_code" UNIQUE ("company_id", "code"), CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branches_status" ON "branches" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branches_company_id" ON "branches" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "departments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid, "name" character varying(120) NOT NULL, "code" character varying(50) NOT NULL, "description" text, "status" character varying(20) NOT NULL DEFAULT 'active', "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_departments_company_name" UNIQUE ("company_id", "name"), CONSTRAINT "UQ_departments_company_code" UNIQUE ("company_id", "code"), CONSTRAINT "PK_839517a681a86bb84cbcc6a1e9d" PRIMARY KEY ("id"))`,
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
      `CREATE TYPE "public"."department_product_access_access_status_enum" AS ENUM('ALLOW', 'DENY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "department_product_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "department_id" uuid NOT NULL, "product_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" "public"."department_product_access_access_status_enum" NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_dept_product_access_company_dept_product" UNIQUE ("company_id", "department_id", "product_id"), CONSTRAINT "PK_6f863211ed90c0051c77f164bc1" PRIMARY KEY ("id"))`,
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
      `CREATE TYPE "public"."branch_product_access_access_status_enum" AS ENUM('ALLOW', 'DENY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "branch_product_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "product_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" "public"."branch_product_access_access_status_enum" NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_branch_product_access_company_branch_product" UNIQUE ("company_id", "branch_id", "product_id"), CONSTRAINT "PK_00f392c54b0912c9a1960e923d4" PRIMARY KEY ("id"))`,
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
      `CREATE TABLE "otp_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "target" character varying(100) NOT NULL, "channel" character varying(10) NOT NULL, "purpose" character varying(30) NOT NULL, "otp_hash" character varying(255) NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "is_verified" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "verified_at" TIMESTAMP WITH TIME ZONE, "ip_address" character varying(45), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_91d17e75ac3182dba6701869b39" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_otp_user_id" ON "otp_verifications" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_otp_target_purpose" ON "otp_verifications" ("target", "purpose") `,
    );
    await queryRunner.query(
      `CREATE TABLE "devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "fingerprint" character varying(255) NOT NULL, "device_name" character varying(100), "device_type" character varying(50), "os" character varying(100), "browser" character varying(100), "trusted" boolean NOT NULL DEFAULT false, "trusted_at" TIMESTAMP WITH TIME ZONE, "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_devices_user_fingerprint" UNIQUE ("user_id", "fingerprint"), CONSTRAINT "PK_b1514758245c12daf43486dd1f0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_devices_user_id" ON "devices" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "company_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "config_key" character varying(100) NOT NULL, "config_value" jsonb NOT NULL, "value_type" character varying(20) NOT NULL DEFAULT 'string', "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_company_configs_company_key" UNIQUE ("company_id", "config_key"), CONSTRAINT "PK_726c503e5e9ae894378b0977353" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_company_configs_is_active" ON "company_configs" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_company_configs_company_id" ON "company_configs" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_category_access_access_status_enum" AS ENUM('ALLOW', 'DENY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_category_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "company_user_id" uuid NOT NULL, "category_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" "public"."user_category_access_access_status_enum" NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_user_category_access_company_user_category" UNIQUE ("company_id", "company_user_id", "category_id"), CONSTRAINT "PK_42f27aa39733c40d8e9f78a5004" PRIMARY KEY ("id"))`,
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
      `CREATE TYPE "public"."department_category_access_access_status_enum" AS ENUM('ALLOW', 'DENY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "department_category_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "department_id" uuid NOT NULL, "category_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" "public"."department_category_access_access_status_enum" NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_dept_category_access_company_dept_category" UNIQUE ("company_id", "department_id", "category_id"), CONSTRAINT "PK_752d1a9d5279e7a0daad5816778" PRIMARY KEY ("id"))`,
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
      `CREATE TYPE "public"."branch_category_access_access_status_enum" AS ENUM('ALLOW', 'DENY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "branch_category_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "category_id" uuid NOT NULL, "can_view" boolean NOT NULL DEFAULT true, "can_create_policy" boolean NOT NULL DEFAULT false, "access_status" "public"."branch_category_access_access_status_enum" NOT NULL DEFAULT 'ALLOW', "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_branch_category_access_company_branch_category" UNIQUE ("company_id", "branch_id", "category_id"), CONSTRAINT "PK_0bb65af9ec72a41813e07119e07" PRIMARY KEY ("id"))`,
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
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "company_id" uuid, "action" character varying(100) NOT NULL, "resource" character varying(100), "resource_id" character varying(100), "ip_address" character varying(45), "user_agent" text, "metadata" jsonb, "status" character varying(20) NOT NULL DEFAULT 'success', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
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
      `CREATE TABLE "api_clients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid, "name" character varying(100) NOT NULL, "client_id" character varying(100) NOT NULL, "client_secret_hash" character varying(255) NOT NULL, "scopes" text array NOT NULL DEFAULT '{}', "status" character varying(20) NOT NULL DEFAULT 'active', "description" character varying(255), "last_used_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2cc528aa877e26788808e581855" UNIQUE ("client_id"), CONSTRAINT "PK_ef2d5ef0eb5e9a6ddc67cfa310e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_api_clients_client_id" ON "api_clients" ("client_id") `,
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
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_categories" ADD CONSTRAINT "FK_1c68b3f832e6594848d15998cfe" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" ADD CONSTRAINT "FK_70126325ceed803671ac77b6f2d" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" ADD CONSTRAINT "FK_a7f6cbafa690b84cf7329e621e2" FOREIGN KEY ("category_id") REFERENCES "insurance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_sub_classes" ADD CONSTRAINT "FK_b2a30603c1191b8b9870c9a25e3" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_sub_classes" ADD CONSTRAINT "FK_63ecfdabbefcc99a22d9e9e7d38" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "risk_rating_rules" ADD CONSTRAINT "FK_b2e19a6643c9f7f0be7a9f76623" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" ADD CONSTRAINT "FK_d8814448f953a4fdf5e392b28a8" FOREIGN KEY ("risk_id") REFERENCES "insurance_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rule_conditions" ADD CONSTRAINT "FK_56cd5167cc746cf8eded4e2b0f0" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rule_conditions" ADD CONSTRAINT "FK_1cd1320aa63d4057bee3ee0e3fe" FOREIGN KEY ("rule_id") REFERENCES "risk_rating_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rating_factors" ADD CONSTRAINT "FK_f5821597e2e8a2db3d813d7c4e2" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "user_product_access" ADD CONSTRAINT "FK_1b2cd620b283a8128a41ff39d3f" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_product_access" ADD CONSTRAINT "FK_37a7feb04885329eacb521e1b0b" FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_product_access" ADD CONSTRAINT "FK_cf454357d25f042cb0587e3a571" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "departments" ADD CONSTRAINT "FK_541e3d07c93baa9cc42b149a5fb" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "departments" ADD CONSTRAINT "FK_40b8818a0e3324c859199265503" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
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
      `ALTER TABLE "devices" ADD CONSTRAINT "FK_5e9bee993b4ce35c3606cda194c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_configs" ADD CONSTRAINT "FK_210a999928c188ba9191e11bd47" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "permission_role" ADD CONSTRAINT "FK_a334e85861688a57f9b31e7045a" FOREIGN KEY ("roles_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_role" ADD CONSTRAINT "FK_633d504f6120c3e07ad0c9c141b" FOREIGN KEY ("permissions_id") REFERENCES "permissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
      `ALTER TABLE "permission_role" DROP CONSTRAINT "FK_633d504f6120c3e07ad0c9c141b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_role" DROP CONSTRAINT "FK_a334e85861688a57f9b31e7045a"`,
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
      `ALTER TABLE "company_configs" DROP CONSTRAINT "FK_210a999928c188ba9191e11bd47"`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" DROP CONSTRAINT "FK_5e9bee993b4ce35c3606cda194c"`,
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
      `ALTER TABLE "departments" DROP CONSTRAINT "FK_40b8818a0e3324c859199265503"`,
    );
    await queryRunner.query(
      `ALTER TABLE "departments" DROP CONSTRAINT "FK_541e3d07c93baa9cc42b149a5fb"`,
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
      `ALTER TABLE "user_product_access" DROP CONSTRAINT "FK_cf454357d25f042cb0587e3a571"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_product_access" DROP CONSTRAINT "FK_37a7feb04885329eacb521e1b0b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_product_access" DROP CONSTRAINT "FK_1b2cd620b283a8128a41ff39d3f"`,
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
      `ALTER TABLE "rating_factors" DROP CONSTRAINT "FK_f5821597e2e8a2db3d813d7c4e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rule_conditions" DROP CONSTRAINT "FK_1cd1320aa63d4057bee3ee0e3fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rule_conditions" DROP CONSTRAINT "FK_56cd5167cc746cf8eded4e2b0f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" DROP CONSTRAINT "FK_d8814448f953a4fdf5e392b28a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" DROP CONSTRAINT "FK_b2e19a6643c9f7f0be7a9f76623"`,
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
      `ALTER TABLE "insurance_sub_classes" DROP CONSTRAINT "FK_63ecfdabbefcc99a22d9e9e7d38"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_sub_classes" DROP CONSTRAINT "FK_b2a30603c1191b8b9870c9a25e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" DROP CONSTRAINT "FK_a7f6cbafa690b84cf7329e621e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_products" DROP CONSTRAINT "FK_70126325ceed803671ac77b6f2d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_categories" DROP CONSTRAINT "FK_1c68b3f832e6594848d15998cfe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`,
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
    await queryRunner.query(
      `DROP INDEX "public"."IDX_633d504f6120c3e07ad0c9c141"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a334e85861688a57f9b31e7045"`,
    );
    await queryRunner.query(`DROP TABLE "permission_role"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_api_clients_client_id"`);
    await queryRunner.query(`DROP TABLE "api_clients"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_action"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_created_at"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
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
      `DROP TYPE "public"."branch_category_access_access_status_enum"`,
    );
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
      `DROP TYPE "public"."department_category_access_access_status_enum"`,
    );
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
    await queryRunner.query(
      `DROP TYPE "public"."user_category_access_access_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_company_configs_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_company_configs_is_active"`,
    );
    await queryRunner.query(`DROP TABLE "company_configs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_devices_user_id"`);
    await queryRunner.query(`DROP TABLE "devices"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_otp_target_purpose"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_otp_user_id"`);
    await queryRunner.query(`DROP TABLE "otp_verifications"`);
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
      `DROP TYPE "public"."branch_product_access_access_status_enum"`,
    );
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
      `DROP TYPE "public"."department_product_access_access_status_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_departments_company_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_departments_branch_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_departments_status"`);
    await queryRunner.query(`DROP TABLE "departments"`);
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
      `DROP INDEX "public"."IDX_user_product_access_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_product_access_company_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_product_access_product_id"`,
    );
    await queryRunner.query(`DROP TABLE "user_product_access"`);
    await queryRunner.query(
      `DROP TYPE "public"."user_product_access_access_status_enum"`,
    );
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
      `DROP INDEX "public"."IDX_rating_factors_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rating_factors_is_active"`,
    );
    await queryRunner.query(`DROP TABLE "rating_factors"`);
    await queryRunner.query(
      `DROP TYPE "public"."rating_factors_data_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_rule_conditions_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_rule_conditions_rule_id"`,
    );
    await queryRunner.query(`DROP TABLE "risk_rule_conditions"`);
    await queryRunner.query(
      `DROP TYPE "public"."risk_rule_conditions_logical_operator_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."risk_rule_conditions_operator_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_rating_rules_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_rating_rules_risk_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_risk_rating_rules_is_active"`,
    );
    await queryRunner.query(`DROP TABLE "risk_rating_rules"`);
    await queryRunner.query(
      `DROP TYPE "public"."risk_rating_rules_rate_type_enum"`,
    );
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
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_products_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_products_category_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_products_is_active"`,
    );
    await queryRunner.query(`DROP TABLE "insurance_products"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_categories_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_insurance_categories_is_active"`,
    );
    await queryRunner.query(`DROP TABLE "insurance_categories"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sessions_user_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_sessions_expires_revoked"`,
    );
    await queryRunner.query(`DROP TABLE "user_sessions"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_role_company"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "companies"`);
    await queryRunner.query(`DROP TABLE "company_users"`);
    await queryRunner.query(`DROP TABLE "company_user_permissions"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_permission_name"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(`DROP TABLE "company_user_roles"`);
  }
}
