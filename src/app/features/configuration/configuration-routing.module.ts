import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AutenticacionGuard } from 'src/app/core/guards/autentication.guard';
import { PermissionGuard } from 'src/app/core/guards/permission.guard';
import { Permission } from 'src/app/shared/constants/permissions';
import { OwnerListComponent } from './pages/owner-list/owner-list.component';
import { PaddockListComponent } from './pages/paddock-list/paddock-list.component';
import { PaddockCreateComponent } from './pages/paddock-create/paddock-create.component';
import { PaddockDetailComponent } from './pages/paddock-detail/paddock-detail.component';
import { PaddockEditComponent } from './pages/paddock-edit/paddock-edit.component';

const paddockPermissions = [Permission.RANCH_READ];

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'owners' },
  {
    path: 'owners',
    component: OwnerListComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: [Permission.ANIMAL_READ],
      breadcrumb: 'breadcrumbs.owners'
    }
  },
  {
    path: 'paddocks/create',
    component: PaddockCreateComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: paddockPermissions,
      breadcrumb: 'breadcrumbs.paddockCreate'
    }
  },
  {
    path: 'paddocks/:uuidPaddock/edit',
    component: PaddockEditComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: paddockPermissions,
      breadcrumb: 'breadcrumbs.paddockEdit'
    }
  },
  {
    path: 'paddocks/:uuidPaddock',
    component: PaddockDetailComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: paddockPermissions,
      breadcrumb: 'breadcrumbs.paddockDetail'
    }
  },
  {
    path: 'paddocks',
    component: PaddockListComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: paddockPermissions,
      breadcrumb: 'breadcrumbs.paddocks'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ConfigurationRoutingModule {}
