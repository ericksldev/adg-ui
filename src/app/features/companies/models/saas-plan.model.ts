export interface SaasPlanLimits {
  USERS: number | null;
  ANIMALS: number | null;
  ACTIVITY_RECORDS: number | null;
}

export interface SaasPlan {
  uuid_plan: string;
  code: string;
  name: string;
  description: string | null;
  annual_price: number;
  currency: string;
  is_active: boolean;
  limits: SaasPlanLimits;
}

export interface SaasPlanWritePayload {
  code?: string;
  name: string;
  description?: string | null;
  annual_price: number;
  currency: string;
  is_active: boolean;
  max_users: number;
  max_animals: number;
  max_activity_records: number;
}
