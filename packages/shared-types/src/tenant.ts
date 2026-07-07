export interface TenantSession {
  user_id: string;
  company_id: string;
  outlet_id: string;
  role_id: string;
  user_name: string;
  company_name: string;
  outlet_name: string;
}

export interface PendingLogin {
  company_id: string;
  company_name?: string;
  outlet_id?: string;
  outlet_name?: string;
}
