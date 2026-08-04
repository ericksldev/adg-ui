import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { I18nService } from 'src/app/core/services/i18n.service';
import { AnimalDeactivatePayload } from '../../models/animal-exit.model';
import { AnimalService } from '../../services/animal.service';

@Component({
  selector: 'app-animal-deactivate-dialog',
  templateUrl: './animal-deactivate-dialog.component.html',
  styleUrls: ['./animal-deactivate-dialog.component.scss']
})
export class AnimalDeactivateDialogComponent implements OnInit {
  @Input() animalUuid = '';
  @Input() animalLabel = '';

  readonly form = this.fb.group({
    exitType: ['SALE', Validators.required],
    exitDate: ['', Validators.required],
    reason: [''],
    description: ['']
  });

  saving = false;
  errorMessage = '';

  constructor(
    public readonly activeModal: NgbActiveModal,
    private readonly fb: FormBuilder,
    private readonly animalService: AnimalService,
    private readonly i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.form.patchValue({ exitDate: new Date().toISOString().slice(0, 10) });
  }

  submit(): void {
    if (!this.animalUuid || this.saving) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.errorMessage = this.i18n.translate('animal.exitInvalid');
      return;
    }
    const v = this.form.getRawValue();
    const payload: AnimalDeactivatePayload = {
      exit_type: v.exitType as AnimalDeactivatePayload['exit_type'],
      exit_date: String(v.exitDate ?? '').trim(),
      reason: String(v.reason ?? '').trim() || null,
      description: String(v.description ?? '').trim() || null
    };

    this.saving = true;
    this.errorMessage = '';
    this.animalService.deactivateAnimal(this.animalUuid, payload).subscribe({
      next: () => {
        this.saving = false;
        this.activeModal.close('success');
      },
      error: () => {
        this.saving = false;
        this.errorMessage = this.i18n.translate('errors.deactivateAnimal');
      }
    });
  }
}
