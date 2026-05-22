import {
  BillingCycle,
  CompanyPlanType,
  MembershipStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole
} from 'src/app/shared/constants/domain.constants';

export interface CompanyManagement {
  uuid_company: string;
  name: string;
  legal_name?: string | null;
  tax_id?: string | null;
  plan_type: CompanyPlanType;
  billing_cycle: BillingCycle;
  membership_status: MembershipStatus;
  membership_started_at?: string | null;
  membership_renewal_at?: string | null;
  is_active: boolean;
}

export interface RanchSummary {
  uuid_ranch: string;
  uuid_company: string;
  name: string;
  location?: string | null;
  area?: string | null;
  is_active?: boolean;
}

export interface CompanyUser {
  uuid_user: string;
  id_card?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  second_last_name?: string | null;
  phone?: string | null;
  username: string;
  email?: string | null;
  role?: UserRole;
  uuid_company: string;
  is_active: boolean;
}

export interface CompanyPayment {
  uuid_company_payment: string;
  uuid_company: string;
  amount: number;
  currency: string;
  payment_method?: PaymentMethod | null;
  payment_reference?: string | null;
  notes?: string | null;
  paid_at: string;
  period_start?: string | null;
  period_end?: string | null;
  plan_type: CompanyPlanType;
  billing_cycle: BillingCycle;
  status: PaymentStatus;
  is_active: boolean;
}

export interface CompanyPaidActivationPayload {
  plan_type: CompanyPlanType;
  billing_cycle: BillingCycle;
  amount?: number;
  payment_method: PaymentMethod;
  payment_reference?: string | null;
  notes?: string | null;
  paid_at: string;
  period_start?: string | null;
}

export interface CompanyTrialActivationPayload {
  trial_start_date: string;
  trial_end_date: string;
}

export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  pagination?: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    order: string;
    pageSize: number;
  };
}

export interface ApiItemResponse<T> {
  success: boolean;
  data: T;
}
