import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';

export interface CategoryMultiSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-category-multi-select',
  templateUrl: './category-multi-select.component.html',
  styleUrls: ['./category-multi-select.component.scss']
})
export class CategoryMultiSelectComponent implements OnChanges, AfterViewChecked, OnDestroy {
  @Input() options: CategoryMultiSelectOption[] = [];
  @Input() selectedIds: string[] = [];
  @Input() placeholder = '';
  @Input() disabled = false;
  @Input() compact = false;

  @Output() readonly selectedIdsChange = new EventEmitter<string[]>();

  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  open = false;
  panelTop = 0;
  panelLeft = 0;
  panelWidth = 220;
  private currentIds: string[] = [];

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['selectedIds'] || this.open) {
      return;
    }
    this.currentIds = [...(this.selectedIds ?? [])];
  }

  ngAfterViewChecked(): void {
    const panel = this.panelRef?.nativeElement;
    if (panel && panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
  }

  ngOnDestroy(): void {
    this.panelRef?.nativeElement.remove();
  }

  get summary(): string {
    const selected = new Set(this.currentIds);
    const labels = this.options.filter((option) => selected.has(option.value)).map((option) => option.label);
    if (labels.length === 0) {
      return '';
    }
    if (labels.length <= 2) {
      return labels.join(', ');
    }
    return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
  }

  isSelected(value: string): boolean {
    return this.currentIds.includes(value);
  }

  toggleOpen(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) {
      return;
    }
    this.open = !this.open;
    if (!this.open) {
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.panelTop = rect.bottom + 4;
    this.panelLeft = rect.left;
    this.panelWidth = Math.max(rect.width, 220);
  }

  onOptionMouseDown(event: MouseEvent, value: string): void {
    event.preventDefault();
    event.stopPropagation();
    const next = new Set(this.currentIds);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    this.currentIds = [...next];
    this.selectedIdsChange.emit(this.currentIds);
  }

  @HostListener('document:mousedown', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.open) {
      return;
    }
    const target = event.target as Node | null;
    if (!target) {
      this.open = false;
      return;
    }
    if (this.elementRef.nativeElement.contains(target) || this.panelRef?.nativeElement.contains(target)) {
      return;
    }
    this.open = false;
  }
}
