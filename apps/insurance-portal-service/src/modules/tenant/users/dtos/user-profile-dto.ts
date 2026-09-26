export class UserProfileDto {
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
  is_two_factor_enabled: boolean;
  last_login_at: Date | null;
  last_login_ip: string | null;
  created_at: Date;
  updated_at: Date;

  roles: string[];
  permissions: string[];
  quotation_policy_data_scope?: string;
  current_company?: {
    id: string;
    name: string;
    slug: string;
  };
  companies?: Array<{
    companyId: string;
    companyName: string;
    companySlug: string;
    membershipId: string;
    isDefault: boolean;
    roles: string[];
    permissions: string[];
    quotationPolicyDataScope?: string;
  }>;

  constructor(partial: Partial<UserProfileDto>) {
    Object.assign(this, partial);
  }
}
