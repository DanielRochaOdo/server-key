type ExportFormat = 'csv' | 'xlsx';

type XlsxLike = {
  utils: {
    json_to_sheet: (data: unknown[]) => unknown;
    book_new: () => unknown;
    book_append_sheet: (workbook: unknown, worksheet: unknown, name: string) => void;
  };
  writeFile: (workbook: unknown, filename: string, options?: { bookType?: string }) => void;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
};

const isXlsxCandidate = (candidate: unknown): candidate is XlsxLike => {
  const record = asRecord(candidate);
  if (!record) return false;

  const utils = asRecord(record.utils);
  if (!utils) return false;

  return (
    typeof utils.json_to_sheet === 'function' &&
    typeof utils.book_new === 'function' &&
    typeof utils.book_append_sheet === 'function' &&
    typeof record.writeFile === 'function'
  );
};

const collectCandidates = (moduleRef: unknown): unknown[] => {
  const level1 = asRecord(moduleRef);
  const level2 = asRecord(level1?.default);
  const level3 = asRecord(level2?.default);

  return [
    moduleRef,
    level1?.default,
    level1?.XLSX,
    level2?.XLSX,
    level2?.default,
    level3?.XLSX,
  ];
};

const resolveFromCandidates = (candidates: unknown[]): XlsxLike | null => {
  const found = candidates.find(isXlsxCandidate);
  return found || null;
};

export const resolveXlsxModule = async (): Promise<XlsxLike> => {
  const sources = await Promise.allSettled([import('xlsx-js-style'), import('xlsx')]);

  for (const source of sources) {
    if (source.status !== 'fulfilled') continue;
    const candidate = resolveFromCandidates(collectCandidates(source.value));
    if (candidate) return candidate;
  }

  const globalObj = globalThis as unknown as { XLSX?: unknown };
  const globalCandidate = resolveFromCandidates(collectCandidates(globalObj.XLSX));
  if (globalCandidate) return globalCandidate;

  throw new Error('Biblioteca de exportacao indisponivel.');
};

export const writeTemplateFile = async (
  templateData: Record<string, unknown>[],
  sheetName: string,
  filename: string
) => {
  const XLSX = await resolveXlsxModule();
  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename, { bookType: 'xlsx' });
};

export const writeExportFile = async (
  rows: Record<string, unknown>[],
  sheetName: string,
  filename: string,
  format: ExportFormat
) => {
  const XLSX = await resolveXlsxModule();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename, { bookType: format });
};
