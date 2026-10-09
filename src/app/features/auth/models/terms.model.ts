export type TermsBlockReason =
  | 'none'
  | 'acceptance_required'
  | 'organization_missing'
  | 'membership_invalid'
  | 'terms_unavailable';

export interface TermsVersionSummary {
  uuid_terms_version: string;
  version: string;
  title: string;
  effective_at: string;
  updated_at: string;
  is_active: boolean;
  requires_acceptance: boolean;
}

export interface TermsAccessDecision {
  access_granted: boolean;
  acceptance_required: boolean;
  accepted: boolean;
  block_reason: TermsBlockReason;
  current_version: TermsVersionSummary | null;
}

export interface TermsDocument extends TermsVersionSummary {
  content: string;
  created_at?: string;
}

export interface TermsAcceptanceRecord {
  uuid_terms_acceptance: string;
  uuid_user: string;
  uuid_company: string;
  uuid_terms_version: string;
  accepted_at: string;
}

export interface TermsAcceptResult {
  acceptance: TermsAcceptanceRecord;
  already_recorded: boolean;
  access: TermsAccessDecision;
}

export interface TermsVersionWritePayload {
  version: string;
  title: string;
  content: string;
  effective_at: string;
  requires_acceptance: boolean;
  publish: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { name?: string; message?: string };
}

export function unavailableTermsDecision(): TermsAccessDecision {
  return {
    access_granted: false,
    acceptance_required: true,
    accepted: false,
    block_reason: 'terms_unavailable',
    current_version: null
  };
}
