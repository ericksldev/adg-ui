import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-animal-shell',
  templateUrl: './animal-shell.component.html',
  styleUrls: ['./animal-shell.component.scss']
})
export class AnimalShellComponent implements OnInit, OnDestroy {
  showModuleNav = true;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.updateNavVisibility();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.updateNavVisibility());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateNavVisibility(): void {
    let route: ActivatedRoute | null = this.activatedRoute;
    while (route?.firstChild) {
      route = route.firstChild;
    }
    this.showModuleNav = route?.snapshot.data['hideModuleNav'] !== true;
  }
}
