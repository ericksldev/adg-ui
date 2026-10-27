import { HttpParams } from '@angular/common/http';
import { ListQueryParams, PaginatedListResult } from '../models/paginated-list.model';

export function toHttpParams(query: ListQueryParams): HttpParams {
  let params = new HttpParams();
  if (query.page != null) {
    params = params.set('page', String(query.page));
  }
  if (query.size != null) {
    params = params.set('size', String(query.size));
  }
  if (query.sortBy) {
    params = params.set('sortBy', query.sortBy);
  }
  if (query.order) {
    params = params.set('order', query.order);
  }
  if (query.status) {
    params = params.set('status', query.status);
  }
  if (query.search?.trim()) {
    params = params.set('search', query.search.trim());
  }
  if (query.uuid_company?.trim()) {
    params = params.set('uuid_company', query.uuid_company.trim());
  }
  if (query.sex && query.sex !== 'ALL') {
    params = params.set('sex', query.sex);
  }
  if (query.ranch_uuid?.trim()) {
    params = params.set('ranch_uuid', query.ranch_uuid.trim());
  }
  if (query.breed_code?.trim()) {
    params = params.set('breed_code', query.breed_code.trim());
  }
  if (query.origin_type?.trim()) {
    params = params.set('origin_type', query.origin_type.trim());
  }
  if (query.current_owner_uuid?.trim()) {
    params = params.set('current_owner_uuid', query.current_owner_uuid.trim());
  }
  if (query.current_paddock_uuid?.trim()) {
    params = params.set('current_paddock_uuid', query.current_paddock_uuid.trim());
  }
  if (query.birth_date_from?.trim()) {
    params = params.set('birth_date_from', query.birth_date_from.trim());
  }
  if (query.birth_date_to?.trim()) {
    params = params.set('birth_date_to', query.birth_date_to.trim());
  }
  if (query.exit_type?.trim()) {
    params = params.set('exit_type', query.exit_type.trim());
  }
  return params;
}

export function mapPaginatedResponse<T>(response: {
  data?: T[];
  pagination?: PaginatedListResult<T>['pagination'];
}): PaginatedListResult<T> {
  const pagination = response.pagination ?? {
    totalItems: response.data?.length ?? 0,
    totalPages: 1,
    currentPage: 1,
    order: 'DESC',
    pageSize: response.data?.length ?? 0,
  };
  return {
    items: response.data ?? [],
    pagination,
  };
}

export function pageNumbers(totalPages: number): number[] {
  const pages = totalPages > 0 ? totalPages : 1;
  return Array.from({ length: pages }, (_, index) => index + 1);
}

export type PaginationWindowItem = number | 'ellipsis';

export function paginationWindow(
  currentPage: number,
  totalPages: number,
  siblingCount = 1
): PaginationWindowItem[] {
  const total = totalPages > 0 ? totalPages : 1;
  const current = Math.min(Math.max(currentPage, 1), total);
  const visibleWithoutGaps = siblingCount * 2 + 5;

  if (total <= visibleWithoutGaps) {
    return pageNumbers(total);
  }

  const windowSize = siblingCount * 2 + 1;
  let left = Math.max(current - siblingCount, 2);
  let right = Math.min(current + siblingCount, total - 1);
  if (right - left + 1 < windowSize) {
    left = Math.max(2, left - (windowSize - (right - left + 1)));
    right = Math.min(total - 1, left + windowSize - 1);
    left = Math.max(2, right - windowSize + 1);
  }

  const items: PaginationWindowItem[] = [1];

  if (left > 2) {
    items.push('ellipsis');
  }

  for (let page = left; page <= right; page += 1) {
    items.push(page);
  }

  if (right < total - 1) {
    items.push('ellipsis');
  }

  items.push(total);
  return items;
}
