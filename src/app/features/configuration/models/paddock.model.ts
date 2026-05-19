export interface Paddock {
  paddock_uuid: string;
  ranch_uuid: string;
  name: string;
  size_in_hectares: number | null;
  grass_type: string | null;
  water_source: string | null;
  maximum_capacity: number | null;
  description: string | null;
  is_active: boolean;
}

export interface PaddockPayload {
  ranch_uuid: string;
  name: string;
  size_in_hectares?: number | null;
  grass_type?: string | null;
  water_source?: string | null;
  maximum_capacity?: number | null;
  description?: string | null;
}

export type PaddockListItem = Pick<
  Paddock,
  'paddock_uuid' | 'name' | 'size_in_hectares' | 'grass_type' | 'water_source' | 'maximum_capacity'
> & {
  ranch_uuid?: string;
  ranch_name?: string;
};
