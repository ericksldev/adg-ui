export interface LivestockCategory {
  category_uuid: string;
  uuid_company: string | null;
  system_code: string | null;
  name: string;
  description: string | null;
  category_type: string;
  is_system: boolean;
  is_active: boolean;
}

export interface AnimalCategoryAssignment {
  animal_category_uuid: string;
  animal_uuid: string;
  category_uuid: string;
  name?: string;
  assigned_at?: string;
}

export interface AnimalCategoryHistoryEntry {
  history_uuid: string;
  category_uuid: string;
  category_name?: string | null;
  action: 'ASSIGN' | 'REMOVE';
  effective_at: string;
  recorded_at: string;
  reason?: string | null;
}
