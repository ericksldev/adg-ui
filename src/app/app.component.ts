import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';
import * as firebase from 'firebase/app';
import { BnNgIdleService } from 'bn-ng-idle';
import { AuthenticationServiceService } from './core/services/authentication-service.service';
import { NavigationEnd, Router } from '@angular/router';
import { SessionService } from './core/services/session.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Vrete';
  user: string | null = null;
  openSidebar = false;
  currentTheme: 'light' | 'dark' = 'light';
  private isDesktopView = window.innerWidth >= 992;
  
  constructor(
    private readonly bnIdle: BnNgIdleService,
    private readonly authenticationService: AuthenticationServiceService,
    private readonly sessionService: SessionService,
    private readonly router:Router
  ) {     
  }

  private sessionPollingIntervalId: any = null;

  ngOnInit(): void {
    this.initFirebase();
   
    this.user = this.authenticationService.getUsername();
    this.openSidebar = this.user !== null && this.isDesktopView;

    if (!this.authenticationService.isAuthenticated()) {
      this.authenticationService.clearSession();
      this.user = null;
      this.openSidebar = false;
    }

    this.sessionService.session$.subscribe((session) => {
      this.user = session?.username ?? null;
      if (!session) {
        this.openSidebar = false;
        this.syncMobileBodyScroll();
        return;
      }

      this.openSidebar = this.isDesktopView;
      this.syncMobileBodyScroll();
    });

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        if (window.innerWidth < 992 && this.openSidebar) {
          this.openSidebar = false;
          this.syncMobileBodyScroll();
        }
      });

    this.startSessionPolling();

    this.bnIdle.startWatching(28800).subscribe((isTimedOut: boolean) => {
      if (isTimedOut) {
        this.CerrarSesion();
      }
    });


  }

  ngOnDestroy(): void {
    if (this.sessionPollingIntervalId) {
      clearInterval(this.sessionPollingIntervalId);
      this.sessionPollingIntervalId = null;
    }
    document.body.style.overflow = '';
  }

  private startSessionPolling(): void {
    if (this.sessionPollingIntervalId) {
      return;
    }

    this.sessionPollingIntervalId = setInterval(() => {
      const token = this.sessionService.getToken();
      if (!token) {
        clearInterval(this.sessionPollingIntervalId);
        this.sessionPollingIntervalId = null;
        return;
      }

      // Heartbeat: if backend returns 401 (token/session invalid), interceptor will logout.
      this.authenticationService.getMe().subscribe({
        next: () => undefined,
        error: () => undefined
      });
    }, 60 * 1000);
  }

  initFirebase(): void {
    firebase.initializeApp(environment.firebaseConfig);
  }
  
  toggleSidebarToParent(openSidebar:boolean){
    this.openSidebar = openSidebar;
    this.syncMobileBodyScroll();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const currentIsDesktopView = window.innerWidth >= 992;
    if (currentIsDesktopView !== this.isDesktopView) {
      this.isDesktopView = currentIsDesktopView;
      this.openSidebar = this.user !== null && currentIsDesktopView;
    }
    this.syncMobileBodyScroll();
  }

  onThemeChange(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
  }

  CerrarSesion(){
    this.authenticationService.logout().subscribe({
      next: () => {
        this.authenticationService.clearSession();
        this.router.navigateByUrl('/login');
      },
      error: () => {
        this.authenticationService.clearSession();
        this.router.navigateByUrl('/login');
      }
    });
  }

  private syncMobileBodyScroll(): void {
    const shouldLockScroll = this.openSidebar && window.innerWidth < 992;
    document.body.style.overflow = shouldLockScroll ? 'hidden' : '';
  }
}
