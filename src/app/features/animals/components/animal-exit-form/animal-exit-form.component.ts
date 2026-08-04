import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ANIMAL_EXIT_TYPE_OPTIONS } from '../../constants/animal-exit.constants';

@Component({
  selector: 'app-animal-exit-form',
  templateUrl: './animal-exit-form.component.html',
  styleUrls: ['./animal-exit-form.component.scss']
})
export class AnimalExitFormComponent {
  @Input() form!: FormGroup;
  @Input() showLegend = true;

  readonly exitTypeOptions = ANIMAL_EXIT_TYPE_OPTIONS;
  readonly maxExitDate = new Date().toISOString().slice(0, 10);
}
