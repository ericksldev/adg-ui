/** Matches API enums (see vrete-api animal.interface). */
export type AnimalSex = 'MALE' | 'FEMALE';
export type AnimalOriginType = 'BIRTH' | 'PURCHASE' | 'TRANSFER' | 'UNKNOWN';
export type AnimalCurrentStatus =
  | 'ACTIVE'
  | 'SOLD'
  | 'DISPOSED'
  | 'DEAD'
  | 'MISSING'
  | 'INACTIVE';
