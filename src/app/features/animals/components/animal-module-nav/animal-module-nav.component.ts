import { Component } from '@angular/core';
import { SessionService } from 'src/app/core/services/session.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';

export interface AnimalModuleNavItem {
  id: string;
  labelKey: string;
  descriptionKey: string;
  route: string;
  iconClass: string;
  exact?: boolean;
  requiresWrite?: boolean;
}

@Component({
  selector: 'app-animal-module-nav',
  templateUrl: './animal-module-nav.component.html',
  styleUrls: ['./animal-module-nav.component.scss']
})
export class AnimalModuleNavComponent {
  readonly items: AnimalModuleNavItem[] = [
    {
      id: 'list',
      labelKey: 'animal.nav.list',
      descriptionKey: 'animal.nav.listDescription',
      route: '/animal',
      iconClass: 'bi-list-ul',
      exact: true
    },
    {
      id: 'register-individual',
      labelKey: 'animal.nav.registerIndividual',
      descriptionKey: 'animal.nav.registerIndividualDescription',
      route: '/animal/register/individual',
      iconClass: 'bi-plus-circle',
      requiresWrite: true
    },
    {
      id: 'register-batch',
      labelKey: 'animal.nav.registerBatch',
      descriptionKey: 'animal.nav.registerBatchDescription',
      route: '/animal/register/batch',
      iconClass: 'bi-table',
      requiresWrite: true
    },
    {
      id: 'inactive',
      labelKey: 'animal.nav.inactive',
      descriptionKey: 'animal.nav.inactiveDescription',
      route: '/animal/inactive',
      iconClass: 'bi-archive'
    }
  ];

  constructor(private readonly sessionService: SessionService) {}

  get visibleItems(): AnimalModuleNavItem[] {
    return this.items.filter((item) => !item.requiresWrite || this.canAnimalWrite);
  }

  get canAnimalWrite(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.ANIMAL_WRITE);
  }
}
