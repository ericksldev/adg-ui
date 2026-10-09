import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-record-purge-confirm-dialog',
  templateUrl: './record-purge-confirm-dialog.component.html',
  styleUrls: ['./record-purge-confirm-dialog.component.scss']
})
export class RecordPurgeConfirmDialogComponent {
  @Input() title = '';
  @Input() confirmToken = '';
  @Input() reasons: string[] = [];
  @Input() activityCodes: string[] = [];
  @Input() kind: 'animal' | 'session' = 'animal';

  step: 1 | 2 = 1;
  typedToken = '';

  constructor(public readonly activeModal: NgbActiveModal) {}

  get tokenMatches(): boolean {
    return this.typedToken.trim() === this.confirmToken.trim();
  }

  continue(): void {
    this.step = 2;
  }

  back(): void {
    this.step = 1;
    this.typedToken = '';
  }

  confirm(): void {
    if (!this.tokenMatches) {
      return;
    }
    this.activeModal.close('confirmed');
  }
}
