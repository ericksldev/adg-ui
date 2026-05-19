import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-searchable-select',
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.scss']
})
export class SearchableSelectComponent implements OnChanges {
  @Input() options: SearchableSelectOption[] = [];
  @Input() value = '';
  @Input() allowEmpty = false;
  @Input() emptyLabel = '';
  @Input() placeholder = '';
  @Input() inputId = '';
  @Input() disabled = false;

  @Output() readonly valueChange = new EventEmitter<string>();

  searchQuery = '';
  isOpen = false;
  highlightedIndex = -1;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['options'] || changes['emptyLabel']) {
      if (!this.isOpen) {
        this.syncSearchFromValue();
      }
    }
  }

  get filteredOptions(): SearchableSelectOption[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      return this.options;
    }
    return this.options.filter((option) => option.label.toLowerCase().includes(query));
  }

  get showDropdown(): boolean {
    return this.isOpen && !this.disabled && (this.allowEmpty || this.filteredOptions.length > 0);
  }

  get listLength(): number {
    return (this.allowEmpty ? 1 : 0) + this.filteredOptions.length;
  }

  onFocus(): void {
    if (this.disabled) {
      return;
    }
    this.isOpen = true;
    this.highlightedIndex = -1;
    this.searchQuery = this.selectedLabel();
  }

  onInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.isOpen = true;
    this.highlightedIndex = -1;
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        this.onFocus();
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'Escape') {
      this.close();
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowDown') {
      this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.listLength - 1);
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowUp') {
      this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter' && this.highlightedIndex >= 0) {
      this.selectByIndex(this.highlightedIndex);
      event.preventDefault();
    }
  }

  selectByIndex(index: number): void {
    if (this.allowEmpty) {
      if (index === 0) {
        this.selectValue('');
        return;
      }
      const option = this.filteredOptions[index - 1];
      if (option) {
        this.selectValue(option.value);
      }
      return;
    }

    const option = this.filteredOptions[index];
    if (option) {
      this.selectValue(option.value);
    }
  }

  selectValue(nextValue: string): void {
    if (nextValue !== this.value) {
      this.valueChange.emit(nextValue);
    }
    this.isOpen = false;
    this.highlightedIndex = -1;
    this.searchQuery = this.labelForValue(nextValue);
  }

  isHighlighted(index: number): boolean {
    return this.highlightedIndex === index;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  private close(): void {
    this.isOpen = false;
    this.highlightedIndex = -1;
    this.syncSearchFromValue();
  }

  private syncSearchFromValue(): void {
    this.searchQuery = this.selectedLabel();
  }

  private selectedLabel(): string {
    return this.labelForValue(this.value);
  }

  private labelForValue(optionValue: string): string {
    if (!optionValue) {
      return this.allowEmpty ? this.emptyLabel : '';
    }
    return this.options.find((option) => option.value === optionValue)?.label ?? '';
  }
}
