import { Component, Input } from '@angular/core';
import { I18nService } from 'src/app/core/services/i18n.service';
import { notAvailableLabel } from 'src/app/core/utils/i18n-display.util';
import { PAYMENT_METHODS } from 'src/app/shared/constants/domain.constants';
import { CompanyPayment } from '../../models/company-management.model';
import { normalizeCompanyPlanType } from 'src/app/shared/constants/subscription.constants';

@Component({
  selector: 'app-company-subscription-list',
  templateUrl: './company-subscription-list.component.html',
  styleUrls: ['./company-subscription-list.component.scss']
})
export class CompanySubscriptionListComponent {
  @Input() subscriptions: CompanyPayment[] = [];

  constructor(private readonly i18nService: I18nService) {}

  planTypeI18nSuffix(plan: string | undefined): string {
    if (!plan) {
      return 'essential';
    }
    return normalizeCompanyPlanType(plan).toLowerCase();
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
