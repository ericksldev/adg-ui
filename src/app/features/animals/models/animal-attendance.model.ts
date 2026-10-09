export type AnimalAttendanceScope = 'INVENTORY' | 'PADDOCK' | 'ANIMAL';

export type AnimalAttendanceMark = 'PRESENT' | 'ABSENT';

export interface AnimalAttendanceHistoryEntry {
  uuid_corral_work_session: string;
  work_date: string;
  responsible_person: string | null;
  session_status: string;
}

export interface AnimalAttendanceRow {
  animal_uuid: string;
  registration_number: string;
  chip_number: string | null;
  paddock_uuid: string | null;
  paddock_name: string | null;
  status: AnimalAttendanceMark;
  last_attended_on: string | null;
  history?: AnimalAttendanceHistoryEntry[];
}

export interface AnimalAttendanceSummary {
  expected: number;
  present: number;
  absent: number;
}

export interface AnimalAttendanceReview {
  scope: AnimalAttendanceScope;
  ranch_uuid: string;
  paddock_uuid: string | null;
  animal_uuid: string | null;
  from: string | null;
  to: string | null;
  summary: AnimalAttendanceSummary;
  animals: AnimalAttendanceRow[];
}

export interface AnimalAttendanceQuery {
  ranch_uuid: string;
  from?: string;
  to?: string;
  paddock_uuid?: string;
  animal_uuid?: string;
  attendance_status?: AnimalAttendanceMark;
  page?: number;
  size?: number;
}
