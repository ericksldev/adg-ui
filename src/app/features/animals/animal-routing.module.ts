import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AutenticacionGuard } from 'src/app/core/guards/autentication.guard';
import { PermissionGuard } from 'src/app/core/guards/permission.guard';
import { Permission } from 'src/app/shared/constants/permissions';
import { AnimalShellComponent } from './layouts/animal-shell/animal-shell.component';
import { AnimalComponent } from './pages/animal/animal.component';
import { AnimalBatchRegisterComponent } from './pages/animal-batch-register/animal-batch-register.component';
import { AnimalDetailComponent } from './pages/animal-detail/animal-detail.component';
import { AnimalEditComponent } from './pages/animal-edit/animal-edit.component';
import { AnimalBatchDeactivateComponent } from './pages/animal-batch-deactivate/animal-batch-deactivate.component';
import { AnimalRegisterIndividualComponent } from './pages/animal-register-individual/animal-register-individual.component';
import { AnimalAttendanceComponent } from './pages/animal-attendance/animal-attendance.component';

const readPermissions = [Permission.ANIMAL_READ];
const writePermissions = [Permission.ANIMAL_WRITE];

const routes: Routes = [
  {
    path: '',
    component: AnimalShellComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: readPermissions,
      breadcrumb: 'breadcrumbs.animal'
    },
    children: [
      {
        path: '',
        component: AnimalComponent,
        data: {
          breadcrumb: 'breadcrumbs.animalList',
          listStatus: 'active'
        },
        runGuardsAndResolvers: 'always'
      },
      {
        path: 'inactive',
        component: AnimalComponent,
        data: {
          breadcrumb: 'breadcrumbs.animalInactiveList',
          listStatus: 'inactive'
        },
        runGuardsAndResolvers: 'always'
      },
      {
        path: 'deactivate/batch',
        component: AnimalBatchDeactivateComponent,
        canActivate: [PermissionGuard],
        data: {
          permissions: writePermissions,
          breadcrumb: 'breadcrumbs.animalBatchDeactivate'
        }
      },
      {
        path: 'register/individual',
        component: AnimalRegisterIndividualComponent,
        canActivate: [PermissionGuard],
        data: {
          permissions: writePermissions,
          breadcrumb: 'breadcrumbs.animalIndividualRegister'
        }
      },
      {
        path: 'register/batch',
        component: AnimalBatchRegisterComponent,
        canActivate: [PermissionGuard],
        data: {
          permissions: writePermissions,
          breadcrumb: 'breadcrumbs.animalBatchRegister'
        }
      },
      {
        path: 'attendance',
        component: AnimalAttendanceComponent,
        data: {
          breadcrumb: 'breadcrumbs.animalAttendance'
        }
      },
      {
        path: ':animalUuid/edit',
        component: AnimalEditComponent,
        canActivate: [PermissionGuard],
        data: {
          permissions: writePermissions,
          breadcrumb: 'breadcrumbs.animalEdit',
          hideModuleNav: true
        }
      },
      {
        path: ':animalUuid',
        component: AnimalDetailComponent,
        data: {
          breadcrumb: 'breadcrumbs.animalDetail',
          hideModuleNav: true
        }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AnimalRoutingModule {}
