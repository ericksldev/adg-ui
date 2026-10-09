import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CodeSenderModalComponent } from 'src/app/shared/components/modals/code-sender-modal/code-sender-modal.component';
import { AuthenticationServiceService } from 'src/app/core/services/authentication-service.service';
import {Location} from '@angular/common';
import { LoginRequest } from 'src/app/shared/models/auth.model';
import { I18nService } from 'src/app/core/services/i18n.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {

  user_name = '';
  password = '';
  see_password: boolean = false;
  validation= {
    user_name: true,
    password: true,
  }
  errorValidationMessage= {
    user_name: '',
    password: '',
  }
  loginApiError = '';

  constructor(
    public modalService: NgbModal,
    private readonly authenticationService: AuthenticationServiceService,
    private readonly i18nService: I18nService,
    private readonly _location: Location,
    private readonly router:Router
  ) { }

  private normalizeLoginCredential(raw: string): string {
    return raw.normalize('NFC').trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  }

  ValidateData(_action: string): boolean {
    if (this.normalizeLoginCredential(this.user_name) === '') {
      this.errorValidationMessage.user_name = this.i18nService.translate('login.usernameRequired');
      this.validation.user_name = false;
    } else {
      this.validation.user_name = true;
    }

    if (this.password === '') {
      this.errorValidationMessage.password = this.i18nService.translate('login.passwordRequired');
      this.validation.password = false;
    } else {
      this.validation.password = true;
    }

    return this.validation.user_name && this.validation.password;
  }

  Login(): void {
    if (!this.ValidateData('login')) {
      return;
    }

    const userData: LoginRequest = {
      user_name: this.normalizeLoginCredential(this.user_name),
      password: this.password
    };

    const applyApiError = (message: string): void => {
      const normalized = message.trim();
      let errorMessage = this.i18nService.translate('login.invalidCredentials');
      if (normalized.includes('Wrong user')) {
        errorMessage = this.i18nService.translate('login.wrongUser');
      } else if (normalized.includes('Wrong password')) {
        errorMessage = this.i18nService.translate('login.wrongPassword');
      } else if (normalized) {
        errorMessage = this.i18nService.translate('errors.generic');
      }

      this.loginApiError = '';
      if (normalized.includes('Wrong user')) {
        this.validation.user_name = false;
        this.errorValidationMessage.user_name = errorMessage;
      } else if (normalized.includes('Wrong password')) {
        this.validation.password = false;
        this.errorValidationMessage.password = errorMessage;
      } else {
        this.loginApiError = errorMessage;
      }
    };

    this.loginApiError = '';
    this.authenticationService.login(userData).subscribe({
      next: (result) => {
        if (result.success) {
          const granted = result.data?.terms?.access_granted === true;
          this.router.navigateByUrl(granted ? '/home' : '/terms-acceptance');
          return;
        }
        const errorMessage =
          typeof result.error === 'string' ? result.error : this.i18nService.translate('login.invalidCredentials');
        applyApiError(errorMessage);
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error as { error?: { message?: string }; message?: string } | undefined;
        const message = body?.error?.message ?? body?.message ?? err.message;
        applyApiError(typeof message === 'string' ? message : '');
      }
    });
  }

  SeePassword(){
    this.see_password = !this.see_password;
  }

  OpenCodeSenderModal(){
    this.modalService.open(CodeSenderModalComponent);
  }

  Cancel(){
    this._location.back();
  }
}
