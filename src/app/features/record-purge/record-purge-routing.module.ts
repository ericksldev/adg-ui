import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AutenticacionGuard } from 'src/app/core/guards/autentication.guard';
import { PermissionGuard } from 'src/app/core/guards/permission.guard';
import { Permission } from 'src/app/shared/constants/permissions';
import { RecordPurgeAuditComponent } from './pages/record-purge-audit/record-purge-audit.component';
import { RecordPurgeCandidatesComponent } from './pages/record-purge-candidates/record-purge-candidates.component';

const routes: Routes = [
  {
    path: '',
    component: RecordPurgeCandidatesComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: [Permission.RECORD_PURGE_READ],
      breadcrumb: 'breadcrumbs.recordPurge'
    }
  },
  {
    path: 'audit',
    component: RecordPurgeAuditComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: [Permission.RECORD_PURGE_READ],
      breadcrumb: 'breadcrumbs.recordPurgeAudit'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RecordPurgeRoutingModule {}
