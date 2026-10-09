export interface ListQueryParams {
  page?: number;
  size?: number;
  sortBy?: string;
  order?: 'ASC' | 'DESC';
  status?: 'all' | 'active' | 'inactive';
  search?: string;
  uuid_company?: string;
  sex?: string;
  ranch_uuid?: string;
  breed_code?: string;
  origin_type?: string;
  current_owner_uuid?: string;
  current_paddock_uuid?: string;
  birth_date_from?: string;
  birth_date_to?: string;
  exit_type?: string;
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
