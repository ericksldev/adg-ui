import { Component, ElementRef, HostListener, Input, OnDestroy, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-info-hint',
  templateUrl: './info-hint.component.html',
  styleUrls: ['./info-hint.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class InfoHintComponent implements OnDestroy {
  @Input() text = '';
  @Input() placement: 'top' | 'bottom' = 'top';

  private tooltipEl: HTMLDivElement | null = null;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  @HostListener('mouseenter')
  @HostListener('focusin')
  showTooltip(): void {
    if (!this.text || this.tooltipEl) {
      return;
    }

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = `app-info-hint__portal-tooltip app-info-hint__portal-tooltip--${this.placement}`;
    this.tooltipEl.textContent = this.text;
    this.tooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(this.tooltipEl);
    this.repositionTooltip();
  }

  @HostListener('mouseleave')
  @HostListener('focusout', ['$event'])
  hideTooltip(event?: FocusEvent): void {
    if (event?.relatedTarget && this.host.nativeElement.contains(event.relatedTarget as Node)) {
      return;
    }
    this.removeTooltip();
  }

  @HostListener('document:scroll', ['$event'])
  onDocumentScroll(): void {
    if (this.tooltipEl) {
      this.repositionTooltip();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.tooltipEl) {
      this.repositionTooltip();
    }
  }

  ngOnDestroy(): void {
    this.removeTooltip();
  }

  private repositionTooltip(): void {
    if (!this.tooltipEl) {
      return;
    }

    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const gap = 6;
    const tooltip = this.tooltipEl;

    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';

    const tooltipRect = tooltip.getBoundingClientRect();
    let top =
      this.placement === 'bottom'
        ? hostRect.bottom + gap
        : hostRect.top - tooltipRect.height - gap;
    let left = hostRect.left + hostRect.width / 2 - tooltipRect.width / 2;

    left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.visibility = 'visible';
  }

  private removeTooltip(): void {
    this.tooltipEl?.remove();
    this.tooltipEl = null;
  }
}
