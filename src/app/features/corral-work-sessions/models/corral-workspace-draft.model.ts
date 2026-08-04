import { CorralStepGridDto } from './corral-work-session.model';
import { RowFindingState } from './corral-row-finding.model';

export interface CorralWorkspaceDraft {
  version: 1;
  sessionUuid: string;
  updatedAt: string;
  activeStepIndex: number;
  findingColumnsExpanded?: boolean;
  grids: CorralStepGridDto[];
  rowFindingsByStep: Record<string, Record<string, RowFindingState>>;
  queueScannedByStep: Record<string, string[]>;
}

export function createEmptyCorralWorkspaceDraft(sessionUuid: string): CorralWorkspaceDraft {
  return {
    version: 1,
    sessionUuid,
    updatedAt: new Date().toISOString(),
    activeStepIndex: 0,
    grids: [],
    rowFindingsByStep: {},
    queueScannedByStep: {}
  };
}
