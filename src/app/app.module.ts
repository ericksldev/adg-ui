import { LOCALE_ID,NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './features/auth/pages/login/login.component';
import { TermsAcceptanceComponent } from './features/auth/pages/terms-acceptance/terms-acceptance.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CodeSenderModalComponent } from './shared/components/modals/code-sender-modal/code-sender-modal.component';
import { FormsModule } from '@angular/forms';
import { HomeComponent } from './features/home/pages/home/home.component';
import { NavbarComponent } from './core/layouts/navbar/navbar.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { SidebarComponent } from './core/layouts/sidebar/sidebar.component';
import { BreadcrumbComponent } from './core/layouts/breadcrumb/breadcrumb.component';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { HttpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { SharedModule } from './shared/shared.module';
registerLocaleData(localeEsAr, 'es-Ar');


@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    TermsAcceptanceComponent,
    CodeSenderModalComponent,
    HomeComponent,
    NavbarComponent,
    SidebarComponent,
    BreadcrumbComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NgbModule,
    HttpClientModule,
    FormsModule,
    BrowserAnimationsModule,
    SharedModule
  ],
  providers: [
    { provide: LOCALE_ID, useValue: 'es-Ar' },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
