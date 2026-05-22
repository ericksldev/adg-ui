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
