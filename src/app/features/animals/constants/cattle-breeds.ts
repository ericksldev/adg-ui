/**
 * Breed codes must match `vrete-api/src/constants/cattle-breed.constants.ts`.
 * UI labels use i18n keys `animal.breed.<code>`.
 */
export const CATTLE_BREED_CODES = [
  'UNKNOWN',
  'HOLSTEIN',
  'JERSEY',
  'ANGUS',
  'HEREFORD',
  'BRAHMAN',
  'BRANGUS',
  'SIMMENTAL',
  'LIMOUSIN',
  'CHAROLAIS',
  'GIROLANDO',
  'NELORE',
  'OTHER'
] as const;

export type CattleBreedCode = (typeof CATTLE_BREED_CODES)[number];
