import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  BillingCycle,
  BILLING_CYCLES,
  CompanyPlanType,
  COMPANY_PLAN_TYPES,
  PAYMENT_METHODS,
  PaymentMethod
} from 'src/app/shared/constants/domain.constants';
import {
  getSubscriptionChargeUsd,
  normalizeBillingCycle,
  normalizeCompanyPlanType,
  PLAN_HEAD_LIMIT
} from 'src/app/shared/constants/subscription.constants';
import { I18nService } from 'src/app/core/services/i18n.service';
import { notAvailableLabel } from 'src/app/core/utils/i18n-display.util';
import { CompanyManagement, CompanyPaidActivationPayload, CompanyPayment } from '../../models/company-management.model';
import { SaasManagementService } from '../../services/saas-management.service';

@Component({
  selector: 'app-company-activation',
  templateUrl: './company-activation.component.html',
  styleUrls: ['./company-activation.component.scss']
})
export class CompanyActivationComponent implements OnInit {
  company: CompanyManagement | null = null;
  payments: CompanyPayment[] = [];
  errorMessage = '';
  isLoading = false;

  readonly planTypes: CompanyPlanType[] = [...COMPANY_PLAN_TYPES];
  readonly billingCycles: BillingCycle[] = [...BILLING_CYCLES];
  readonly paymentMethods: PaymentMethod[] = [...PAYMENT_METHODS];

  paymentForm: CompanyPaidActivationPayload = {
    payment_method: 'bank_transfer',
    payment_reference: '',
    notes: '',
    paid_at: new Date().toISOString().slice(0, 10),
    period_start: new Date().toISOString().slice(0, 10),
    plan_type: 'ESSENTIAL',
    billing_cycle: 'ANNUAL',
    amount: getSubscriptionChargeUsd('ESSENTIAL', 'ANNUAL')
  };

  trialForm = {
    trial_start_date: new Date().toISOString().slice(0, 10),
    trial_end_date: new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly saasManagementService: SaasManagementService,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    const uuidCompany = this.route.snapshot.paramMap.get('uuidCompany');
    if (!uuidCompany) {
      this.errorMessage = this.i18nService.translate('errors.loadCompanies');
      return;
    }
    this.loadCompany(uuidCompany);
  }

  get estimatedPeriodChargeUsd(): number {
    return getSubscriptionChargeUsd(this.paymentForm.plan_type, this.paymentForm.billing_cycle);
  }

  get planHeadLimitHint(): string {
    const plan = normalizeCompanyPlanType(this.paymentForm.plan_type);
    const limit = PLAN_HEAD_LIMIT[plan];
    return this.i18nService.translate('saas.planHeadLimitHint', { limit });
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
          this.company.plan_type = normalizeCompanyPlanType(this.paymentForm.plan_type);
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

  getPlanLabel(plan: CompanyPlanType | string | undefined): string {
    if (!plan) {
      return notAvailableLabel(this.i18nService);
    }
    const key = normalizeCompanyPlanType(String(plan)).toLowerCase();
    return this.i18nService.translate(`saas.planType.${key}`);
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
    const plan = normalizeCompanyPlanType(this.paymentForm.plan_type);
    if (!this.paymentForm.plan_type || !this.planTypes.includes(plan)) {
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
    return null;
  }

  private buildActivationPaymentPayload(): CompanyPaidActivationPayload {
    const reference = (this.paymentForm.payment_reference ?? '').toString().trim();
    const notes = (this.paymentForm.notes ?? '').toString().trim();
    const plan = normalizeCompanyPlanType(this.paymentForm.plan_type);
    const cycle = normalizeBillingCycle(this.paymentForm.billing_cycle);
    return {
      ...this.paymentForm,
      plan_type: plan,
      billing_cycle: cycle,
      amount: Number(this.paymentForm.amount),
      payment_reference: reference.length > 0 ? reference : null,
      notes: notes.length > 0 ? notes : null
    };
  }

  private loadCompany(uuidCompany: string): void {
    this.isLoading = true;
    this.saasManagementService.getCompany(uuidCompany).subscribe({
      next: (company) => {
        this.company = company;
        this.paymentForm.plan_type = normalizeCompanyPlanType(this.company.plan_type);
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
