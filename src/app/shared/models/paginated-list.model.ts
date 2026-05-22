export interface ListQueryParams {
  page?: number;
  size?: number;
  sortBy?: string;
  order?: 'ASC' | 'DESC';
  status?: 'all' | 'active' | 'inactive';
  search?: string;
  uuid_company?: string;
  sex?: string;
}

export interface ApiPagination {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  order: string;
  pageSize: number;
}

export interface PaginatedListResponse<T> {
  success: boolean;
  data: T[];
  pagination?: ApiPagination;
}

export interface PaginatedListResult<T> {
  items: T[];
  pagination: ApiPagination;
}
