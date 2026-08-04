import { AnimalLastExit } from './animal-exit.model';

/** Full row from GET /animal/:uuid (plain Sequelize). */
export interface AnimalDetail {
  animal_uuid: string;
  ranch_uuid: string;
  breed_code?: string | null;
  registration_number: string;
  chip_number?: string | null;
  mother_animal_uuid?: string | null;
  father_animal_uuid?: string | null;
  current_owner_uuid?: string | null;
  sex: string;
  color?: string | null;
  birth_date?: string | null;
  origin_type?: string;
  current_status?: string;
  description?: string | null;
  current_paddock_uuid?: string | null;
  is_active?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_exit?: AnimalLastExit | null;
}
