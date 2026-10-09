import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { I18nService } from 'src/app/core/services/i18n.service';
import { ApiPagination } from 'src/app/shared/models/paginated-list.model';
import { pageNumbers } from 'src/app/shared/utils/list-query.util';
import { RecordPurgeConfirmDialogComponent } from '../../components/record-purge-confirm-dialog/record-purge-confirm-dialog.component';
import {
  AnimalPurgeCandidate,
  PurgeConfirmTarget,
  WorkSessionPurgeCandidate
} from '../../models/record-purge.model';
import { RecordPurgeService } from '../../services/record-purge.service';

@Component({
  selector: 'app-record-purge-candidates',
  templateUrl: './record-purge-candidates.component.html',
  styleUrls: ['./record-purge-candidates.component.scss']
})
export class RecordPurgeCandidatesComponent implements OnInit, OnDestroy {
  tab: 'animals' | 'sessions' = 'animals';
  search = '';
  page = 1;
  readonly pageSize = 10;
  isLoading = false;
  errorMessage = '';
  animals: AnimalPurgeCandidate[] = [];
  sessions: WorkSessionPurgeCandidate[] = [];
  pagination: ApiPagination = {
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    order: 'DESC',
    pageSize: 10
  };

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly recordPurgeService: RecordPurgeService,
    private readonly modalService: NgbModal,
    private readonly i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  get totalPages(): number {
    return this.pagination.totalPages || 1;
  }

  get pageNumbersList(): number[] {
    return pageNumbers(this.totalPages);
  }

  selectTab(tab: 'animals' | 'sessions'): void {
    if (this.tab === tab) {
      return;
    }
    this.tab = tab;
    this.page = 1;
    this.search = '';
    this.load();
  }

  updateSearch(value: string): void {
    this.search = value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.load();
    }, 300);
  }

  goToPage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages || nextPage === this.page) {
      return;
    }
    this.page = nextPage;
    this.load();
  }

  sexLabel(sex: string): string {
    return sex === 'FEMALE' ? this.i18n.translate('animal.female') : this.i18n.translate('animal.male');
  }

  statusLabel(status: string): string {
    return this.i18n.translate(`corralWorkSession.status.${status}`);
  }

  askDeleteAnimal(animal: AnimalPurgeCandidate): void {
    this.askDelete({
      kind: 'animal',
      id: animal.animal_uuid,
      title: `${animal.registration_number} · ${animal.ranch_name}`,
      confirmToken: animal.confirm_token,
      reasons: animal.reasons,
      activityCodes: []
    });
  }

  askDeleteSession(session: WorkSessionPurgeCandidate): void {
    const responsible = session.responsible_person ? ` · ${session.responsible_person}` : '';
    this.askDelete({
      kind: 'session',
      id: session.uuid_corral_work_session,
      title: `${session.work_date} · ${session.ranch_name}${responsible}`,
      confirmToken: session.confirm_token,
      reasons: session.reasons,
      activityCodes: session.activity_codes
    });
  }

  private askDelete(target: PurgeConfirmTarget): void {
    const modalRef = this.modalService.open(RecordPurgeConfirmDialogComponent, {
      centered: true,
      backdrop: 'static'
    });
    const instance = modalRef.componentInstance as RecordPurgeConfirmDialogComponent;
    instance.kind = target.kind;
    instance.title = target.title;
    instance.confirmToken = target.confirmToken;
    instance.reasons = target.reasons;
    instance.activityCodes = target.activityCodes;

    modalRef.result.then((result) => {
      if (result !== 'confirmed') {
        return;
      }
      this.purge(target);
    }).catch(() => undefined);
  }

  private purge(target: PurgeConfirmTarget): void {
    this.isLoading = true;
    this.errorMessage = '';
    const request = target.kind === 'animal'
      ? this.recordPurgeService.purgeAnimal(target.id)
      : this.recordPurgeService.purgeWorkSession(target.id);

    request.subscribe({
      next: () => {
        this.isLoading = false;
        if (this.page > 1 && (this.tab === 'animals' ? this.animals.length : this.sessions.length) === 1) {
          this.page -= 1;
        }
        this.load();
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = this.i18n.translate('recordPurge.errorDelete');
      }
    });
  }

  private load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const query = { page: this.page, size: this.pageSize, search: this.search };
    if (this.tab === 'animals') {
      this.recordPurgeService.listAnimals(query).subscribe({
        next: (result) => {
          this.animals = result.items;
          this.pagination = result.pagination;
          this.isLoading = false;
        },
        error: () => {
          this.animals = [];
          this.isLoading = false;
          this.errorMessage = this.i18n.translate('recordPurge.errorLoad');
        }
      });
      return;
    }

    this.recordPurgeService.listWorkSessions(query).subscribe({
      next: (result) => {
        this.sessions = result.items;
        this.pagination = result.pagination;
        this.isLoading = false;
      },
      error: () => {
        this.sessions = [];
        this.isLoading = false;
        this.errorMessage = this.i18n.translate('recordPurge.errorLoad');
      }
    });
  }
}
