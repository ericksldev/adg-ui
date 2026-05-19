import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from './pipes/translate.pipe';
import { UserFormComponent } from './components/forms/user-form/user-form.component';
import { RanchFormComponent } from './components/forms/ranch-form/ranch-form.component';
import { ConfirmDialogComponent } from './components/modals/confirm-dialog/confirm-dialog.component';
import { SearchableSelectComponent } from './components/searchable-select/searchable-select.component';

@NgModule({
  declarations: [
    TranslatePipe,
    UserFormComponent,
    RanchFormComponent,
    ConfirmDialogComponent,
    SearchableSelectComponent
  ],
  imports: [CommonModule, FormsModule],
  exports: [
    TranslatePipe,
    UserFormComponent,
    RanchFormComponent,
    ConfirmDialogComponent,
    SearchableSelectComponent
  ]
})
export class SharedModule {}
