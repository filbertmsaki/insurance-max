export class RoleDto {
  id: string;
  name: string;
  display_name: string;
}

export class PermissionDto {
  id: string;
  name: string;
  display_name: string;
}

export class UserAdminDetailDto {
  id: string;
  user_no: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  status: string;
  user_type: string;
  officer_title: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_two_factor_enabled: boolean;
  failed_login_attempts: number;
  last_login_at: Date | null;
  last_login_ip: string | null;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
  roles: RoleDto[];
  permissions: PermissionDto[];
  quotation_policy_data_scope: string;
  current_company?: {
    id: string;
    name: string;
    slug: string;
  };

  constructor(partial: Partial<UserAdminDetailDto>) {
    Object.assign(this, partial);
  }
}
