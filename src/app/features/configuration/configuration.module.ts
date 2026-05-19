import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';
import { ConfigurationRoutingModule } from './configuration-routing.module';
import { OwnerListComponent } from './pages/owner-list/owner-list.component';
import { PaddockListComponent } from './pages/paddock-list/paddock-list.component';
import { PaddockCreateComponent } from './pages/paddock-create/paddock-create.component';
import { PaddockDetailComponent } from './pages/paddock-detail/paddock-detail.component';
import { PaddockEditComponent } from './pages/paddock-edit/paddock-edit.component';
import { PaddockFormComponent } from './components/paddock-form/paddock-form.component';

@NgModule({
  declarations: [
    OwnerListComponent,
    PaddockListComponent,
    PaddockCreateComponent,
    PaddockDetailComponent,
    PaddockEditComponent,
    PaddockFormComponent
  ],
  imports: [CommonModule, FormsModule, SharedModule, ConfigurationRoutingModule]
})
export class ConfigurationModule {}
