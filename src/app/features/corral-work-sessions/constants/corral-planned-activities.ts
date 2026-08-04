export type CorralPlannedActivityType = 'ATTENDANCE' | 'HEALTH' | 'PADDOCK_REORGANIZATION';

export const CORRAL_PLANNED_ACTIVITY_OPTIONS: CorralPlannedActivityType[] = [
  'ATTENDANCE',
  'HEALTH',
  'PADDOCK_REORGANIZATION'
];

export type CorralWorkSessionStatus = 'DRAFT' | 'IN_PROGRESS' | 'CLOSED';
