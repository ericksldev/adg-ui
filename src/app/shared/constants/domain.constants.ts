export const USER_ROLES = ['saas_owner', 'administrator', 'ranch_staff'] as const;
export type UserRole = typeof USER_ROLES[number];

const CANONICAL = USER_ROLES as readonly string[];

/** Solo los tres roles canónicos (exacto o en minúsculas). */
export const normalizeUserRole = (role: string): UserRole | null => {
  const trimmed = typeof role === 'string' ? role.trim() : '';
  if (!trimmed) {
    return null;
  }
  if ((CANONICAL as readonly string[]).includes(trimmed)) {
    return trimmed as UserRole;
  }
  const lower = trimmed.toLowerCase();
  if ((CANONICAL as readonly string[]).includes(lower)) {
    return lower as UserRole;
  }
  return null;
};

export const normalizeUserRoles = (roles: unknown): UserRole[] => {
  let list: string[] = [];
  if (Array.isArray(roles)) {
    list = roles.filter((r): r is string => typeof r === 'string' && r !== '');
  } else if (typeof roles === 'string' && roles !== '') {
    list = [roles];
  }

  return Array.from(
    new Set(
      list
        .map((role) => normalizeUserRole(role))
        .filter((role): role is UserRole => role !== null)
    )
  );
};

/** Plan code stored on the company. Names and limits come from the SaaS catalog. */
export type CompanyPlanType = string;

export const BILLING_CYCLES = ['SEMESTRAL', 'ANNUAL'] as const;
export type BillingCycle = typeof BILLING_CYCLES[number];

export const MEMBERSHIP_STATUSES = ['TRIAL', 'ACTIVE', 'CANCELLED'] as const;
export type MembershipStatus = typeof MEMBERSHIP_STATUSES[number];

export const PAYMENT_STATUSES = ['POSTED', 'VOIDED'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const PAYMENT_METHODS = ['bank_transfer', 'qr_payment', 'manual_payment'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
