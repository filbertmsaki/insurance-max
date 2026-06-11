# Insurance Max Project Overview

## 1. Overview

Insurance Max is a NestJS monorepo built around two backend services:

- `insurance-portal-service` is the core multi-tenant insurance platform. It handles companies, users, RBAC, branch and department management, the insurance product engine, access control, authentication, sessions, OTP, audit logs, and premium-rating setup.
- `tiramis` is the external integration service for TIRA-style workflows. It manages client configuration, service endpoints, response codes, cover notes, motor/fleet payloads, policies, claims, verification requests, submission tracking, and callback handling.

The repository also includes shared libraries for config, persistence, contracts, observability, and portal-wide helpers.

Both services use TypeORM with PostgreSQL-backed schemas and migration-based database management.

## 2. Backend Architecture

### `insurance-portal-service`

Main modules include:

- `platform` for companies, roles, permissions, and API clients
- `shared` for auth, sessions, OTP, devices, mail, and audit logging
- `tenant` for branches, departments, users, product engine, access control, rating factors, and premium calculation

This service is the administrative and operational backend for managing insurers and their internal access model.

### `tiramis`

Main modules include:

- configuration and endpoint management
- messaging/signature/XML handling
- cover notes and motor cover notes
- policies and reinsurance
- claims processing
- verification requests and responses
- callback processing
- submission/event tracking

This service acts as an integration gateway that prepares payloads, sends requests to external endpoints, stores responses, and keeps a full submission history.

## 3. Database Structure

### 3.1 `insurance-portal-service` database

The portal database is centered on a multi-tenant structure.

#### Identity and access tables

- `users` - master user accounts, login state, verification flags, 2FA data, and soft delete support
- `roles` - platform and company roles
- `permissions` - reusable permission definitions
- `role_user` - user-to-role many-to-many mapping
- `permission_user` - user-to-permission many-to-many mapping
- `company_users` - company membership for a user
- `company_user_roles` - role assignments inside a company membership
- `company_user_permissions` - direct permission assignments inside a company membership
- `user_sessions` - refresh-token and device session tracking
- `devices` - registered user devices
- `otp_verifications` - OTP lifecycle records
- `api_clients` - API key/client registrations
- `audit_logs` - security and activity audit trail

#### Company and organization tables

- `companies` - tenant/company profile
- `company_configs` - company-level configuration values
- `company_features` - feature flags enabled per company
- `branches` - company branches / sale points
- `branch_users` - branch membership for company users
- `branch_features` - branch-level feature overrides
- `departments` - company departments, optionally linked to a branch

#### Insurance product engine tables

- `insurance_categories` - top-level product categories
- `insurance_products` - products under each category
- `insurance_sub_classes` - product sub-classes
- `insurance_risks` - risks attached to products or sub-classes
- `rating_factors` - data points used during rating and underwriting
- `risk_required_factors` - factor requirements per risk
- `risk_rating_rules` - pricing rules for a risk
- `risk_rule_conditions` - logical conditions attached to rating rules

#### Access-control tables for the product engine

- `user_category_access`
- `department_category_access`
- `branch_category_access`
- `user_product_access`
- `department_product_access`
- `branch_product_access`

These tables determine who can view or act on specific categories and products at user, department, or branch level.

#### Main relationships

- One `company` has many `company_users`, `branches`, `departments`, `company_features`, categories, products, risks, and rating records.
- One `user` can belong to many companies through `company_users`.
- One `company_user` can have multiple roles and permissions.
- One `insurance_category` has many `insurance_products`.
- One `insurance_product` has many `insurance_sub_classes` and `insurance_risks`.
- One `insurance_risk` has many `risk_rating_rules` and `risk_required_factors`.
- One `risk_rating_rule` has many `risk_rule_conditions`.

### 3.2 `tiramis` database

The Tiramis database is designed around submission lifecycle tracking and external communication.

#### Configuration tables

- `tiramis_client_configurations` - per-environment client credentials, certificate paths, base URLs, and activation status
- `tiramis_service_endpoints` - endpoint path, method, and content type for each service type
- `tiramis_response_codes` - normalized response code catalogue with category and retryability flags

#### Submission tracking tables

- `tiramis_transactions` - logical submission transaction record
- `tiramis_submission_attempts` - retries and attempt history
- `tiramis_submission_events` - event history and state changes for each submission

#### Cover note tables

- `tiramis_cover_notes` - core cover note record
- `tiramis_cover_note_risks` - risks included in a cover note
- `tiramis_cover_note_addons` - add-ons attached to a cover note
- `tiramis_cover_note_discounts` - discount rows
- `tiramis_cover_note_taxes` - tax rows
- `tiramis_subject_matters` - insured subject matter records
- `tiramis_policy_holders` - policy holder details attached to a cover note

#### Motor tables

- `tiramis_motor_fleets` - fleet header records
- `tiramis_motor_fleet_items` - individual vehicles within a fleet
- `tiramis_motor_details` - non-fleet motor details

#### Policy tables

- `tiramis_policies` - issued policy records
- `tiramis_policy_cover_notes` - link table between policies and cover notes

#### Reinsurance tables

- `tiramis_reinsurances` - reinsurance transactions
- `tiramis_reinsurance_participants` - participating reinsurers and shares

#### Claims tables

- `tiramis_claim_notifications`
- `tiramis_claim_intimations`
- `tiramis_claim_assessments`
- `tiramis_discharge_vouchers`
- `tiramis_claim_payments`
- `tiramis_claim_rejections`
- `tiramis_claimants`

#### Verification and callback tables

- `tiramis_verification_requests`
- `tiramis_verification_responses`
- callback processing is handled through the callbacks module and related persistence records

#### Main relationships

- One `tiramis_transaction` can have multiple submission attempts and submission events.
- One `tiramis_cover_note` can have risks, add-ons, discounts, taxes, subject matters, and policy holders.
- One `tiramis_cover_note` can feed into motor, policy, claim, or verification workflows depending on the transaction type.
- One `tiramis_policy` can reference multiple cover notes through the link table.
- One claim workflow can progress through notification, intimation, assessment, discharge voucher, payment, and rejection records.

## 4. Suggested short project summary

> Insurance Max is a NestJS-based insurance platform composed of a multi-tenant portal backend and a Tiramis integration service. The portal backend manages companies, users, roles, permissions, branch access, departments, and a configurable insurance product engine. The Tiramis service handles external submission workflows such as cover notes, policies, claims, reinsurance, and verification, while persisting every request, attempt, and response for traceability.

## 5. Suggested short database summary

> The database is split into two domains. The portal database stores tenant management, identity and access control, and product-engine data. The Tiramis database stores integration configuration, transaction logs, cover notes, motor details, policies, claims, reinsurance, and verification records. Together, they support secure multi-tenant insurance operations and end-to-end external system integration.
