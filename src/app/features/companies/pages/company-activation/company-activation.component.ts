import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  BillingCycle,
  BILLING_CYCLES,
  PAYMENT_METHODS,
  PaymentMethod
} from 'src/app/shared/constants/domain.constants';
import {
  chargeForBillingCycle,
  normalizeBillingCycle
} from 'src/app/shared/constants/subscription.constants';
import { I18nService } from 'src/app/core/services/i18n.service';
import { notAvailableLabel } from 'src/app/core/utils/i18n-display.util';
import { CompanyManagement, CompanyPaidActivationPayload, CompanyPayment } from '../../models/company-management.model';
import { SaasPlan } from '../../models/saas-plan.model';
import { SaasManagementService } from '../../services/saas-management.service';
import { SaasPlanApiService } from '../../services/saas-plan-api.service';

@Component({
  selector: 'app-company-activation',
  templateUrl: './company-activation.component.html',
  styleUrls: ['./company-activation.component.scss']
})
export class CompanyActivationComponent implements OnInit {
  company: CompanyManagement | null = null;
  payments: CompanyPayment[] = [];
  activePlans: SaasPlan[] = [];
  errorMessage = '';
  isLoading = false;

  readonly billingCycles: BillingCycle[] = [...BILLING_CYCLES];
  readonly paymentMethods: PaymentMethod[] = [...PAYMENT_METHODS];

  paymentForm: CompanyPaidActivationPayload = {
    payment_method: 'bank_transfer',
    payment_reference: '',
    notes: '',
    paid_at: new Date().toISOString().slice(0, 10),
    period_start: new Date().toISOString().slice(0, 10),
    plan_type: '',
    billing_cycle: 'ANNUAL',
    amount: 0,
    exchange_rate: null
  };

  trialForm = {
    trial_start_date: new Date().toISOString().slice(0, 10),
    trial_end_date: new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly saasManagementService: SaasManagementService,
    private readonly saasPlanApi: SaasPlanApiService,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    const uuidCompany = this.route.snapshot.paramMap.get('uuidCompany');
    if (!uuidCompany) {
      this.errorMessage = this.i18nService.translate('errors.loadCompanies');
      return;
    }
    this.loadActivePlans(uuidCompany);
  }

  get selectedPlan(): SaasPlan | undefined {
    return this.activePlans.find((plan) => plan.code === this.paymentForm.plan_type);
  }

  get estimatedPeriodChargeUsd(): number {
    const plan = this.selectedPlan;
    if (!plan) {
      return 0;
    }
    return chargeForBillingCycle(plan.annual_price, normalizeBillingCycle(this.paymentForm.billing_cycle));
  }

  get estimatedCurrency(): string {
    return this.selectedPlan?.currency || 'USD';
  }

  get estimatedPeriodChargeBob(): number {
    return this.toBolivianos(this.estimatedPeriodChargeUsd);
  }

  get paymentAmountBob(): number {
    return this.toBolivianos(Number(this.paymentForm.amount));
  }

  get planHeadLimitHint(): string {
    const plan = this.selectedPlan;
    if (!plan) {
      return '';
    }
    return this.i18nService.translate('saas.planLimitsHint', {
      users: plan.limits.USERS ?? 0,
      animals: plan.limits.ANIMALS ?? 0,
      activities: plan.limits.ACTIVITY_RECORDS ?? 0
    });
  }

  get hasActivePaidSubscription(): boolean {
    if (this.company?.membership_status !== 'ACTIVE') {
      return false;
    }
    if (!this.company.membership_renewal_at) {
      return true;
    }
    return new Date(this.company.membership_renewal_at).getTime() >= Date.now();
  }

  get isPaidActivationFormLocked(): boolean {
    return this.hasActivePaidSubscription;
  }

  get canRegisterPayment(): boolean {
    return this.getActivationPaymentValidationErrorKey() === null;
  }

  createPayment(): void {
    if (!this.company) {
      return;
    }
    if (this.isPaidActivationFormLocked) {
      return;
    }

    const validationKey = this.getActivationPaymentValidationErrorKey();
    if (validationKey) {
      this.errorMessage = this.i18nService.translate(validationKey);
      return;
    }

    this.errorMessage = '';
    const payload = this.buildActivationPaymentPayload();
    this.saasManagementService.createCompanyPayment(this.company.uuid_company, payload).subscribe({
      next: () => {
        if (this.company) {
          this.company.membership_status = 'ACTIVE';
          this.company.plan_type = payload.plan_type;
          const selected = this.activePlans.find((plan) => plan.code === payload.plan_type);
          if (selected) {
            this.company.plan = selected;
          }
          this.company.billing_cycle = normalizeBillingCycle(this.paymentForm.billing_cycle);
          this.loadPayments(this.company.uuid_company);
        }
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('errors.subscriptionAlreadyActive');
      }
    });
  }

  onPlanOrCycleChanged(): void {
    this.paymentForm.amount = this.estimatedPeriodChargeUsd;
  }

  activateTrial(): void {
    if (!this.company) {
      return;
    }

    this.saasManagementService.activateTrial(this.company.uuid_company, this.trialForm).subscribe({
      next: (company) => {
        this.company = company;
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('errors.subscriptionAlreadyActive');
      }
    });
  }

  getPlanLabel(plan: SaasPlan | string | undefined): string {
    if (!plan) {
      return notAvailableLabel(this.i18nService);
    }
    if (typeof plan !== 'string') {
      return plan.name;
    }
    const match = this.activePlans.find((item) => item.code === plan);
    return match?.name || plan;
  }

  getBillingCycleLabel(cycle: BillingCycle | string | undefined): string {
    if (!cycle) {
      return notAvailableLabel(this.i18nService);
    }
    const key = normalizeBillingCycle(String(cycle)).toLowerCase();
    return this.i18nService.translate(`saas.billingCycle.${key}`);
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    return this.i18nService.translate(`saas.paymentMethod.${method}`);
  }

  private getActivationPaymentValidationErrorKey(): string | null {
    if (!this.paymentForm.plan_type || !this.selectedPlan) {
      return 'saas.validation.activationPlanRequired';
    }
    const cycle = normalizeBillingCycle(this.paymentForm.billing_cycle);
    if (!this.paymentForm.billing_cycle || !this.billingCycles.includes(cycle)) {
      return 'saas.validation.activationCycleRequired';
    }
    if (!this.paymentForm.payment_method || !this.paymentMethods.includes(this.paymentForm.payment_method)) {
      return 'saas.validation.activationMethodRequired';
    }
    const paidAt = (this.paymentForm.paid_at ?? '').toString().trim();
    if (!paidAt) {
      return 'saas.validation.activationPaidAtRequired';
    }
    const periodStart = (this.paymentForm.period_start ?? '').toString().trim();
    if (!periodStart) {
      return 'saas.validation.activationStartRequired';
    }
    const amount = Number(this.paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return 'saas.validation.activationAmountInvalid';
    }
    const exchangeRate = Number(this.paymentForm.exchange_rate);
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      return 'saas.validation.activationExchangeRateInvalid';
    }
    return null;
  }

  private buildActivationPaymentPayload(): CompanyPaidActivationPayload {
    const reference = (this.paymentForm.payment_reference ?? '').toString().trim();
    const notes = (this.paymentForm.notes ?? '').toString().trim();
    const cycle = normalizeBillingCycle(this.paymentForm.billing_cycle);
    return {
      ...this.paymentForm,
      plan_type: this.paymentForm.plan_type,
      billing_cycle: cycle,
      amount: Number(this.paymentForm.amount),
      exchange_rate: Number(this.paymentForm.exchange_rate),
      payment_reference: reference.length > 0 ? reference : null,
      notes: notes.length > 0 ? notes : null
    };
  }

  private loadActivePlans(uuidCompany: string): void {
    this.isLoading = true;
    this.saasPlanApi.list('active').subscribe({
      next: (plans) => {
        this.activePlans = this.sortPlansBasicToHighest(plans);
        this.loadCompany(uuidCompany);
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('saasPlans.loadError');
        this.isLoading = false;
      }
    });
  }

  private sortPlansBasicToHighest(plans: SaasPlan[]): SaasPlan[] {
    return [...plans].sort((left, right) => {
      const priceDiff = Number(left.annual_price) - Number(right.annual_price);
      if (priceDiff !== 0) {
        return priceDiff;
      }
      const animalsDiff = (left.limits.ANIMALS ?? 0) - (right.limits.ANIMALS ?? 0);
      if (animalsDiff !== 0) {
        return animalsDiff;
      }
      return left.name.localeCompare(right.name);
    });
  }

  private toBolivianos(amountUsd: number): number {
    const rate = Number(this.paymentForm.exchange_rate);
    if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(amountUsd)) {
      return 0;
    }
    return Math.round((amountUsd * rate + Number.EPSILON) * 100) / 100;
  }

  private loadCompany(uuidCompany: string): void {
    this.saasManagementService.getCompany(uuidCompany).subscribe({
      next: (company) => {
        this.company = company;
        this.paymentForm.plan_type = this.activePlans[0]?.code ?? '';
        this.paymentForm.billing_cycle = normalizeBillingCycle(this.company.billing_cycle);
        this.paymentForm.amount = this.estimatedPeriodChargeUsd;
        this.loadPayments(uuidCompany);
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('saas.companyNotFound');
        this.isLoading = false;
      }
    });
  }

  private loadPayments(uuidCompany: string): void {
    this.saasManagementService.getCompanyPayments(uuidCompany).subscribe({
      next: (payments) => {
        this.payments = payments;
        this.isLoading = false;
      },
      error: () => {
        this.payments = [];
        this.isLoading = false;
      }
    });
  }
}
