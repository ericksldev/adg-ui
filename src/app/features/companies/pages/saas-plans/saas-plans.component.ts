import { Component, OnInit } from '@angular/core';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import { SaasPlan, SaasPlanWritePayload } from '../../models/saas-plan.model';
import { SaasPlanApiService } from '../../services/saas-plan-api.service';

interface SaasPlanForm {
  uuid_plan: string | null;
  code: string;
  name: string;
  description: string;
  annual_price: number | null;
  currency: string;
  is_active: boolean;
  max_users: number | null;
  max_animals: number | null;
  max_activity_records: number | null;
}

@Component({
  selector: 'app-saas-plans',
  templateUrl: './saas-plans.component.html',
  styleUrls: ['./saas-plans.component.scss']
})
export class SaasPlansComponent implements OnInit {
  plans: SaasPlan[] = [];
  errorMessage = '';
  isLoading = false;
  isSaving = false;
  showForm = false;
  form: SaasPlanForm = this.emptyForm();

  constructor(
    private readonly saasPlanApi: SaasPlanApiService,
    private readonly i18n: I18nService,
    private readonly sessionService: SessionService
  ) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  get canWrite(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.SAAS_PLAN_WRITE);
  }

  get isEditing(): boolean {
    return Boolean(this.form.uuid_plan);
  }

  loadPlans(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.saasPlanApi.list('all').subscribe({
      next: (plans) => {
        this.plans = plans;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.i18n.translate('saasPlans.loadError');
        this.isLoading = false;
      }
    });
  }

  startCreate(): void {
    this.form = this.emptyForm();
    this.showForm = true;
    this.errorMessage = '';
  }

  startEdit(plan: SaasPlan): void {
    this.form = {
      uuid_plan: plan.uuid_plan,
      code: plan.code,
      name: plan.name,
      description: plan.description ?? '',
      annual_price: Number(plan.annual_price),
      currency: plan.currency,
      is_active: plan.is_active,
      max_users: plan.limits.USERS,
      max_animals: plan.limits.ANIMALS,
      max_activity_records: plan.limits.ACTIVITY_RECORDS
    };
    this.showForm = true;
    this.errorMessage = '';
  }

  cancelForm(): void {
    this.showForm = false;
    this.form = this.emptyForm();
  }

  save(): void {
    if (!this.canWrite || this.isSaving) {
      return;
    }
    const payload = this.toPayload();
    if (!payload) {
      this.errorMessage = this.i18n.translate('saasPlans.validation');
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    const request = this.form.uuid_plan
      ? this.saasPlanApi.update(this.form.uuid_plan, payload)
      : this.saasPlanApi.create(payload);
    request.subscribe({
      next: () => {
        this.isSaving = false;
        this.cancelForm();
        this.loadPlans();
      },
      error: () => {
        this.errorMessage = this.i18n.translate('saasPlans.saveError');
        this.isSaving = false;
      }
    });
  }

  setActive(plan: SaasPlan, isActive: boolean): void {
    if (!this.canWrite || plan.limits.USERS == null || plan.limits.ANIMALS == null || plan.limits.ACTIVITY_RECORDS == null) {
      return;
    }
    const payload: SaasPlanWritePayload = {
      name: plan.name,
      description: plan.description,
      annual_price: Number(plan.annual_price),
      currency: plan.currency,
      is_active: isActive,
      max_users: plan.limits.USERS,
      max_animals: plan.limits.ANIMALS,
      max_activity_records: plan.limits.ACTIVITY_RECORDS
    };
    this.saasPlanApi.update(plan.uuid_plan, payload).subscribe({
      next: () => this.loadPlans(),
      error: () => {
        this.errorMessage = this.i18n.translate('saasPlans.saveError');
      }
    });
  }

  private toPayload(): SaasPlanWritePayload | null {
    const name = this.form.name.trim();
    const currency = this.form.currency.trim().toUpperCase();
    const annualPrice = Number(this.form.annual_price);
    const maxUsers = Number(this.form.max_users);
    const maxAnimals = Number(this.form.max_animals);
    const maxActivity = Number(this.form.max_activity_records);
    if (!name || !currency || !Number.isFinite(annualPrice) || annualPrice < 0) {
      return null;
    }
    if (![maxUsers, maxAnimals, maxActivity].every((value) => Number.isInteger(value) && value >= 0)) {
      return null;
    }
    const payload: SaasPlanWritePayload = {
      name,
      description: this.form.description.trim() || null,
      annual_price: annualPrice,
      currency,
      is_active: this.form.is_active,
      max_users: maxUsers,
      max_animals: maxAnimals,
      max_activity_records: maxActivity
    };
    if (!this.form.uuid_plan) {
      const code = this.form.code.trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(code)) {
        return null;
      }
      payload.code = code;
    }
    return payload;
  }

  private emptyForm(): SaasPlanForm {
    return {
      uuid_plan: null,
      code: '',
      name: '',
      description: '',
      annual_price: null,
      currency: 'USD',
      is_active: true,
      max_users: null,
      max_animals: null,
      max_activity_records: null
    };
  }
}
