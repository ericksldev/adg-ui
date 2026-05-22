export interface Owner {
  owner_uuid: string;
  full_name: string;
  document_number: string | null;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  is_active: boolean;
}

export interface OwnerPayload {
  full_name: string;
  document_number?: string | null;
  phone_number?: string | null;
  email?: string | null;
  address?: string | null;
  description?: string | null;
}

export type OwnerListItem = Pick<
  Owner,
  'owner_uuid' | 'full_name' | 'document_number' | 'phone_number' | 'email'
>;
