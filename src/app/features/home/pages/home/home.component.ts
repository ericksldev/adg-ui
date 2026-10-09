import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from 'src/app/core/services/session.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  constructor(
    private readonly router: Router,
    private readonly sessionService: SessionService,
  ) { }

  ngOnInit(): void {
    if (!this.canOpenAnimals && hasPermission(this.sessionService.getRoles(), Permission.COMPANY_READ)) {
      this.router.navigate(['/saas-management']);
    }
  }

  get canOpenAnimals(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.ANIMAL_READ);
  }

  openAnimalTable(): void {
    this.router.navigate(['/animal']);
  }

  openAnimalTableFromKeyboard(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openAnimalTable();
    }
  }
}
