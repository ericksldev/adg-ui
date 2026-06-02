import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AnimalRoutingModule } from './animal-routing.module';
import { AnimalComponent } from './pages/animal/animal.component';
import { AnimalBatchRegisterComponent } from './pages/animal-batch-register/animal-batch-register.component';
import { AnimalRegisterIndividualComponent } from './pages/animal-register-individual/animal-register-individual.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  declarations: [AnimalComponent, AnimalBatchRegisterComponent, AnimalRegisterIndividualComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    AnimalRoutingModule,
    SharedModule
  ]
})
export class AnimalModule {}
