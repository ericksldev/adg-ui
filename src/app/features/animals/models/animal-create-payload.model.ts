/** Body for POST /animal (snake_case, Sequelize plain shape). */
export interface AnimalCreatePayload {
  ranch_uuid: string;
  breed_code?: string | null;
  registration_number: string;
  chip_number?: string | null;
  mother_registration_number?: string | null;
  father_registration_number?: string | null;
  current_owner_uuid?: string | null;
  sex: 'MALE' | 'FEMALE';
  color?: string | null;
  /** `YYYY` (year only) or full `YYYY-MM-DD` (API normalizes year to Jan 1 UTC). */
  birth_date: string;
  origin_type: 'BIRTH' | 'PURCHASE' | 'TRANSFER' | 'UNKNOWN';
  description?: string | null;
  current_paddock_uuid?: string | null;
}
