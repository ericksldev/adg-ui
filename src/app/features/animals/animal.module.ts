import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AnimalRoutingModule } from './animal-routing.module';
import { AnimalDeactivateDialogComponent } from './components/animal-deactivate-dialog/animal-deactivate-dialog.component';
import { AnimalExitFormComponent } from './components/animal-exit-form/animal-exit-form.component';
import { AnimalModuleNavComponent } from './components/animal-module-nav/animal-module-nav.component';
import { AnimalBatchDeactivateComponent } from './pages/animal-batch-deactivate/animal-batch-deactivate.component';
import { AnimalShellComponent } from './layouts/animal-shell/animal-shell.component';
import { AnimalComponent } from './pages/animal/animal.component';
import { AnimalBatchRegisterComponent } from './pages/animal-batch-register/animal-batch-register.component';
import { AnimalDetailComponent } from './pages/animal-detail/animal-detail.component';
import { AnimalEditComponent } from './pages/animal-edit/animal-edit.component';
import { AnimalRegisterIndividualComponent } from './pages/animal-register-individual/animal-register-individual.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [
    AnimalShellComponent,
    AnimalModuleNavComponent,
    AnimalExitFormComponent,
    AnimalDeactivateDialogComponent,
    AnimalComponent,
    AnimalBatchRegisterComponent,
    AnimalBatchDeactivateComponent,
    AnimalRegisterIndividualComponent,
    AnimalDetailComponent,
    AnimalEditComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    SharedModule,
    AnimalRoutingModule
  ]
})
export class AnimalModule {}
