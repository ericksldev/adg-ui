export interface AnimalPurgeCandidate {
  animal_uuid: string;
  registration_number: string;
  chip_number?: string | null;
  sex: string;
  current_status: string;
  ranch_name: string;
  confirm_token: string;
  reasons: string[];
}

export interface WorkSessionPurgeCandidate {
  uuid_corral_work_session: string;
  work_date: string;
  status: string;
  responsible_person?: string | null;
  ranch_name: string;
  activity_codes: string[];
  confirm_token: string;
  reasons: string[];
}

export interface RecordDeletionAuditItem {
  id: string;
  kind: 'A' | 'W';
  label: string;
  reasons: string[];
  actor: string;
  deleted_at: string;
}

export type PurgeConfirmTarget =
  | {
      kind: 'animal';
      id: string;
      title: string;
      confirmToken: string;
      reasons: string[];
      activityCodes: string[];
    }
  | {
      kind: 'session';
      id: string;
      title: string;
      confirmToken: string;
      reasons: string[];
      activityCodes: string[];
    };
