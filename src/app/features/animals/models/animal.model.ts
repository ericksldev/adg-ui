import { AnimalLastExit } from './animal-exit.model';

/** Row shape from GET /animal (plain Sequelize). */
export interface AnimalListItem {
  animal_uuid: string;
  ranch_uuid?: string;
  registration_number: string;
  chip_number?: string | null;
  breed_code?: string | null;
  sex: string;
  color?: string | null;
  birth_date?: string | null;
  origin_type?: string | null;
  mother_animal_uuid?: string | null;
  father_animal_uuid?: string | null;
  current_owner_uuid?: string | null;
  current_paddock_uuid?: string | null;
  description?: string | null;
  current_status?: string;
  last_exit?: AnimalLastExit | null;
}
