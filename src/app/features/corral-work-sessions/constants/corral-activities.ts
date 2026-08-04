export {
  CORRAL_ACTIVITY_CATALOG,
  CORRAL_ACTIVITY_CODES,
  CORRAL_ACTIVITY_CODE_SET,
  CORRAL_ACTIVITY_DEFAULT_WORK_MODES,
  CORRAL_ACTIVITY_ICONS,
  CORRAL_MULTI_RECORD_ACTIVITY_CODES,
  getCorralActivityDefinition,
  isCorralActivityCode,
  isMultiRecordActivity,
  type CorralActivityCode,
  type CorralActivityDefaultWorkMode
} from '../../../shared/constants/corral-activities.constants';

export type CorralWorkSessionStatus = 'DRAFT' | 'IN_PROGRESS' | 'CLOSED';

export type CorralVisualConditionCode =
  | 'NORMAL'
  | 'THIN'
  | 'VERY_THIN'
  | 'FAT'
  | 'VERY_FAT'
  | 'PREGNANT'
  | 'CLOSE_TO_CALVING'
  | 'SICK'
  | 'INJURED';

export const CORRAL_VISUAL_CONDITION_CODES: CorralVisualConditionCode[] = [
  'NORMAL',
  'THIN',
  'VERY_THIN',
  'FAT',
  'VERY_FAT',
  'PREGNANT',
  'CLOSE_TO_CALVING',
  'SICK',
  'INJURED'
];

export type CorralStepWorkMode = 'SCAN_DYNAMIC' | 'PRELOADED_SEARCH' | 'PRELOADED_QUEUE';

export const CORRAL_STEP_WORK_MODES: CorralStepWorkMode[] = [
  'SCAN_DYNAMIC',
  'PRELOADED_SEARCH',
  'PRELOADED_QUEUE'
];

export const CORRAL_PRELOADED_WORK_MODES: CorralStepWorkMode[] = [
  'PRELOADED_SEARCH',
  'PRELOADED_QUEUE'
];
