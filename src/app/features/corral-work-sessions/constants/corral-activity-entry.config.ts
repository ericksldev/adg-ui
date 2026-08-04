import {
  CORRAL_ACTIVITY_CATALOG,
  CORRAL_ACTIVITY_DEFAULT_WORK_MODES,
  type CorralActivityCode,
  type CorralActivityDefaultWorkMode
} from '../../../shared/constants/corral-activities.constants';

export interface CorralActivityShortcutConfig {
  activityCode: CorralActivityCode;
  listRoute: string[];
  defaultWorkMode: CorralActivityDefaultWorkMode;
}

function buildShortcutConfig(activityCode: CorralActivityCode): CorralActivityShortcutConfig {
  return {
    activityCode,
    listRoute: ['/corral-work-session', 'activity', activityCode],
    defaultWorkMode: CORRAL_ACTIVITY_DEFAULT_WORK_MODES[activityCode]
  };
}

const SHORTCUT_BY_ACTIVITY = CORRAL_ACTIVITY_CATALOG.reduce(
  (acc, item) => {
    const code = item.code as CorralActivityCode;
    acc[code] = buildShortcutConfig(code);
    return acc;
  },
  {} as Record<CorralActivityCode, CorralActivityShortcutConfig>
);

export function getCorralActivityShortcutConfig(
  activityCode: CorralActivityCode
): CorralActivityShortcutConfig {
  return SHORTCUT_BY_ACTIVITY[activityCode];
}
