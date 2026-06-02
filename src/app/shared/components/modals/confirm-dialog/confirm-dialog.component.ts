import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent {
  @Input() titleKey = '';
  @Input() messageKey = '';
  @Input() messageParams?: Record<string, string | number>;
  @Input() confirmKey = 'common.confirm';
  @Input() cancelKey = 'common.cancel';
  @Input() confirmButtonClass = 'btn-danger';

  constructor(public readonly activeModal: NgbActiveModal) {}
}
