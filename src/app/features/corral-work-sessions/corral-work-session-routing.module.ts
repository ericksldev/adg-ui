import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AutenticacionGuard } from 'src/app/core/guards/autentication.guard';
import { PermissionGuard } from 'src/app/core/guards/permission.guard';
import { Permission } from 'src/app/shared/constants/permissions';
import { CorralWorkSessionListComponent } from './pages/corral-work-session-list/corral-work-session-list.component';
import { CorralWorkSessionCreateComponent } from './pages/corral-work-session-create/corral-work-session-create.component';
import { CorralWorkSessionSetupComponent } from './pages/corral-work-session-setup/corral-work-session-setup.component';
import { CorralWorkSessionLoadAnimalsComponent } from './pages/corral-work-session-load-animals/corral-work-session-load-animals.component';
import { CorralWorkSessionWorkspaceComponent } from './pages/corral-work-session-workspace/corral-work-session-workspace.component';
import { CorralWorkSessionDetailComponent } from './pages/corral-work-session-detail/corral-work-session-detail.component';
import { CorralActivityShortcutPageComponent } from './pages/corral-activity-shortcut/corral-activity-shortcut-page.component';

const readPermissions = [Permission.ANIMAL_WORK_SESSION_READ];
const writePermissions = [Permission.ANIMAL_WORK_SESSION_WRITE];

const routes: Routes = [
  {
    path: '',
    component: CorralWorkSessionListComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: readPermissions,
      breadcrumb: 'breadcrumbs.corralWorkSessionList'
    }
  },
  {
    path: 'create',
    component: CorralWorkSessionCreateComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: writePermissions,
      breadcrumb: 'breadcrumbs.corralWorkSessionCreate'
    }
  },
  {
    path: 'activity/:activityCode',
    component: CorralActivityShortcutPageComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: readPermissions,
      breadcrumb: 'breadcrumbs.corralWorkSessionList'
    }
  },
  {
    path: ':sessionUuid/setup',
    component: CorralWorkSessionSetupComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: writePermissions,
      breadcrumb: 'breadcrumbs.corralWorkSessionSetup'
    }
  },
  {
    path: ':sessionUuid/load-animals',
    component: CorralWorkSessionLoadAnimalsComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: writePermissions,
      breadcrumb: 'breadcrumbs.corralWorkSessionLoadAnimals'
    }
  },
  {
    path: ':sessionUuid/work',
    component: CorralWorkSessionWorkspaceComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: writePermissions,
      breadcrumb: 'breadcrumbs.corralWorkSessionWork'
    }
  },
  {
    path: ':sessionUuid',
    component: CorralWorkSessionDetailComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: readPermissions,
      breadcrumb: 'breadcrumbs.corralWorkSessionDetail'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CorralWorkSessionRoutingModule {}
