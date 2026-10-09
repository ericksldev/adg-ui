export interface PendingAnimalBatchHandoffRow {
  registrationNumber: string;
  ranchUuid: string;
}

export interface PendingAnimalBatchNavigationState {
  fromPendingRegistrations: true;
  rows: PendingAnimalBatchHandoffRow[];
}
