/** Row shape from GET /animal (plain Sequelize). */
export interface AnimalListItem {
  animal_uuid: string;
  registration_number: string;
  chip_number?: string | null;
  breed_code: string;
  sex: string;
  color?: string | null;
  birth_date?: string | null;
  description?: string | null;
  current_status?: string;
}
