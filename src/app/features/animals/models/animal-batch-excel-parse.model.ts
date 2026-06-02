import { AnimalBatchOptionalColumnKey } from '../constants/animal-batch.constants';
import { AnimalBatchDraftRow } from './animal-batch-draft.model';

export interface AnimalBatchExcelParseResult {
  rows: AnimalBatchDraftRow[];
  /** Optional columns whose header exists in the imported file. */
  optionalColumnsInFile: AnimalBatchOptionalColumnKey[];
}
