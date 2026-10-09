import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/shared/shared.module';
import { RecordPurgeConfirmDialogComponent } from './components/record-purge-confirm-dialog/record-purge-confirm-dialog.component';
import { RecordPurgeAuditComponent } from './pages/record-purge-audit/record-purge-audit.component';
import { RecordPurgeCandidatesComponent } from './pages/record-purge-candidates/record-purge-candidates.component';
import { RecordPurgeRoutingModule } from './record-purge-routing.module';

@NgModule({
  declarations: [
    RecordPurgeCandidatesComponent,
    RecordPurgeAuditComponent,
    RecordPurgeConfirmDialogComponent
  ],
  imports: [CommonModule, NgbModule, SharedModule, RecordPurgeRoutingModule]
})
export class RecordPurgeModule {}
