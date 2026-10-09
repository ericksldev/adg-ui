import { Component, Input } from '@angular/core';
import { I18nService } from 'src/app/core/services/i18n.service';
import { notAvailableLabel } from 'src/app/core/utils/i18n-display.util';
import { PAYMENT_METHODS } from 'src/app/shared/constants/domain.constants';
import { CompanyPayment } from '../../models/company-management.model';

@Component({
  selector: 'app-company-subscription-list',
  templateUrl: './company-subscription-list.component.html',
  styleUrls: ['./company-subscription-list.component.scss']
})
export class CompanySubscriptionListComponent {
  @Input() subscriptions: CompanyPayment[] = [];
  @Input() currentPlan: { code: string; name: string } | null | undefined = null;

  constructor(private readonly i18nService: I18nService) {}

  lockedLimitsLabel(subscription: CompanyPayment): string {
    return this.i18nService.translate('saas.planLimitsHint', {
      users: subscription.max_users ?? 0,
      animals: subscription.max_animals ?? 0,
      activities: subscription.max_activity_records ?? 0
    });
  }

  hasLockedLimits(subscription: CompanyPayment): boolean {
    return subscription.max_users != null
      && subscription.max_animals != null
      && subscription.max_activity_records != null;
  }

  planLabel(plan: string | undefined): string {
    const code = plan?.trim() ?? '';
    if (!code) {
      return notAvailableLabel(this.i18nService);
    }
    if (this.currentPlan?.code === code) {
      return this.currentPlan.name;
    }
    return code;
  }

  /** Texto traducido del método de pago; el API puede enviar mayúsculas o guiones distintos. */
  displayPaymentMethod(method: string | undefined | null): string {
    if (!method?.trim()) {
      return notAvailableLabel(this.i18nService);
    }
    const n = method.trim().toLowerCase().replace(/-/g, '_');
    let slug: string | null = null;
    if ((PAYMENT_METHODS as readonly string[]).includes(n)) {
      slug = n;
    } else if (n === 'qrpayment') {
      slug = 'qr_payment';
    }
    if (!slug) {
      return notAvailableLabel(this.i18nService);
    }
    return this.i18nService.translate(`saas.paymentMethod.${slug}`);
  }
}
