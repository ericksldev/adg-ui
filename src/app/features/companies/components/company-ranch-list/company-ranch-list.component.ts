import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RanchSummary } from '../../models/company-management.model';

@Component({
  selector: 'app-company-ranch-list',
  templateUrl: './company-ranch-list.component.html',
  styleUrls: ['./company-ranch-list.component.scss']
})
export class CompanyRanchListComponent {
  @Input() ranches: RanchSummary[] = [];
  @Input() companyUuid = '';
  /** Resalta la fila cuando se abre el detalle desde la lista global de ranchos (?ranch=). */
  @Input() highlightedRanchUuid: string | null = null;
  @Input() canManageRanchUsers = false;
  @Input() canManageRanches = false;
  @Input() readOnly = false;

  @Output() readonly editRanch = new EventEmitter<RanchSummary>();
  @Output() readonly archiveRanch = new EventEmitter<RanchSummary>();

  onEdit(ranch: RanchSummary): void {
    this.editRanch.emit(ranch);
  }

  onArchive(ranch: RanchSummary): void {
    this.archiveRanch.emit(ranch);
  }
}
