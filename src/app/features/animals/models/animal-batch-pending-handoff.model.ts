export interface PendingAnimalBatchHandoffRow {
  registrationNumber: string;
  ranchUuid: string;
  pendingRowUuid?: string;
}

export interface PendingAnimalBatchNavigationState {
  fromPendingRegistrations: true;
  rows: PendingAnimalBatchHandoffRow[];
}
