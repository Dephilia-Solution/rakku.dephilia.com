export interface Owner {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  password_hash: string;
  email_verified_at: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface OwnerSession {
  owner_id: string;
  email: string;
  name: string;
  company_id: string | null;
  company_name: string | null;
  company_slug: string | null;
}

export interface OwnerWithCompany extends Owner {
  company_id: string | null;
  company_name: string | null;
  company_slug: string | null;
  company_code: string | null;
}

export interface OwnerDashboardOutlet {
  id: string;
  name: string;
  address: string | null;
  status: "active" | "inactive";
  created_at: string;
  employee_count: number;
}

export interface OwnerDashboardEmployee {
  id: string;
  name: string;
  username: string;
  role_id: string;
  role_name: string;
  all_outlets: boolean;
  status: "active" | "inactive";
  avatar_url: string | null;
  outlets: { id: string; name: string }[];
  created_at: string;
}
