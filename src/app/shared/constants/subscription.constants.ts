import { BillingCycle, BILLING_CYCLES } from './domain.constants';

const LEGACY_BILLING_MAP: Record<string, BillingCycle> = {
  MONTHLY: 'SEMESTRAL',
  SEMESTRAL: 'SEMESTRAL',
  ANNUAL: 'ANNUAL'
};

export function normalizeBillingCycle(cycle: string): BillingCycle {
  if (BILLING_CYCLES.includes(cycle as BillingCycle)) {
    return cycle as BillingCycle;
  }
  return LEGACY_BILLING_MAP[cycle] ?? 'ANNUAL';
}

/** Semestral charge is half of the catalog annual price. */
export function chargeForBillingCycle(annualPrice: number, billingCycle: BillingCycle): number {
  const annual = Number(annualPrice);
  if (!Number.isFinite(annual)) {
    return 0;
  }
  if (billingCycle === 'ANNUAL') {
    return Number(annual.toFixed(2));
  }
  return Number((annual / 2).toFixed(2));
}
