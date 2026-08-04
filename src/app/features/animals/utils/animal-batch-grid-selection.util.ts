export interface GridCellCoord {
  row: number;
  col: number;
}

export interface GridSelectionBounds {
  rowMin: number;
  rowMax: number;
  colMin: number;
  colMax: number;
}

export function gridSelectionBounds(
  anchor: GridCellCoord | null,
  end: GridCellCoord | null
): GridSelectionBounds | null {
  if (!anchor || !end) {
    return null;
  }
  return {
    rowMin: Math.min(anchor.row, end.row),
    rowMax: Math.max(anchor.row, end.row),
    colMin: Math.min(anchor.col, end.col),
    colMax: Math.max(anchor.col, end.col)
  };
}

export function isCoordInGridSelection(row: number, col: number, bounds: GridSelectionBounds | null): boolean {
  if (!bounds) {
    return false;
  }
  return row >= bounds.rowMin && row <= bounds.rowMax && col >= bounds.colMin && col <= bounds.colMax;
}

export function parseClipboardMatrix(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  if (lines.length === 0) {
    return [];
  }
  return lines.map((line) => line.split('\t'));
}

export function matrixToClipboardText(matrix: string[][]): string {
  return matrix.map((row) => row.join('\t')).join('\n');
}
