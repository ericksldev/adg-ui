import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { I18nService } from '../../services/i18n.service';

interface BreadcrumbItem {
  label: string;
  url: string;
  active: boolean;
}

@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.scss']
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
  breadcrumbItems: BreadcrumbItem[] = [];
  showBreadcrumb = false;
  showBackButton = true;

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => this.buildBreadcrumbs())
    );

    this.subscriptions.add(
      this.i18nService.language$.subscribe(() => this.buildBreadcrumbs())
    );

    this.buildBreadcrumbs();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  goBack(): void {
    if (globalThis.history.length > 1) {
      globalThis.history.back();
      return;
    }

    this.router.navigateByUrl('/home');
  }

  private buildBreadcrumbs(): void {
    const items = this.collectBreadcrumbs(this.activatedRoute.root);
    this.breadcrumbItems = items.map((item, index) => ({
      ...item,
      active: index === items.length - 1
    }));
    this.showBreadcrumb = this.breadcrumbItems.length > 0;
    this.showBackButton = !this.routeHidesBackButton(this.activatedRoute.root);
  }

  private routeHidesBackButton(route: ActivatedRoute): boolean {
    const currentRoute = route.children.find((child: ActivatedRoute) => child.outlet === PRIMARY_OUTLET);
    if (!currentRoute) {
      return false;
    }
    if (currentRoute.snapshot.data['hideBackButton'] === true) {
      return true;
    }
    return this.routeHidesBackButton(currentRoute);
  }

  private collectBreadcrumbs(route: ActivatedRoute, parentUrl = ''): Omit<BreadcrumbItem, 'active'>[] {
    const breadcrumbs: Omit<BreadcrumbItem, 'active'>[] = [];
    const currentRoute = route.children.find((child: ActivatedRoute) => child.outlet === PRIMARY_OUTLET);
    if (!currentRoute) {
      return breadcrumbs;
    }

    const routeSegments = currentRoute.snapshot.url
      .map((segment) => segment.path)
      .filter((segment) => segment.length > 0);
    const currentUrl = routeSegments.length > 0
      ? `${parentUrl}/${routeSegments.join('/')}`
      : parentUrl;

    const breadcrumbKey = currentRoute.snapshot.data['breadcrumb'] as string | undefined;
    if (breadcrumbKey) {
      breadcrumbs.push({
        label: this.i18nService.translate(breadcrumbKey),
        url: currentUrl || '/'
      });
    }

    return breadcrumbs.concat(this.collectBreadcrumbs(currentRoute, currentUrl));
  }
}
