import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from './pipes/translate.pipe';
import { UserFormComponent } from './components/forms/user-form/user-form.component';
import { RanchFormComponent } from './components/forms/ranch-form/ranch-form.component';
import { ConfirmDialogComponent } from './components/modals/confirm-dialog/confirm-dialog.component';
import { SearchableSelectComponent } from './components/searchable-select/searchable-select.component';
import { InfoHintComponent } from './components/info-hint/info-hint.component';

@NgModule({
  declarations: [
    TranslatePipe,
    UserFormComponent,
    RanchFormComponent,
    ConfirmDialogComponent,
    SearchableSelectComponent,
    InfoHintComponent
  ],
  imports: [CommonModule, FormsModule],
  exports: [
    TranslatePipe,
    UserFormComponent,
    RanchFormComponent,
    ConfirmDialogComponent,
    SearchableSelectComponent,
    InfoHintComponent
  ]
})
export class SharedModule {}
