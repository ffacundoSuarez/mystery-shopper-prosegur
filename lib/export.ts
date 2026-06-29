import { surveySections, getSectionTitle } from './survey-config';
import { getAnswerLabel, isEvidence } from './format';
import { PublicResult, SurveyResponse } from './types';

function csvCell(value: string): string {
  const v = value ?? '';
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type ExportRow = SurveyResponse | PublicResult;

function buildExportRows(responses: ExportRow[]) {
  const questions = surveySections.flatMap((s) => s.questions);
  const headers = [
    'ID',
    'Código',
    'Nombre',
    'Empresa',
    'Ciudad',
    'Etapa alcanzada',
    ...questions.map((q) => q.text),
  ];

  const rows = responses.map((r) => {
    const code = 'code' in r ? r.code : undefined;
    const maxStage =
      'maxApprovedStage' in r && r.maxApprovedStage
        ? getSectionTitle(r.maxApprovedStage)
        : '';

    const cells = [
      r.id,
      code || '',
      r.nombreApellido || [r.nombre, r.apellido].filter(Boolean).join(' ') || '',
      r.empresa || '',
      r.ciudad || '',
      maxStage,
    ];

    for (const q of questions) {
      const value = r.answers[q.id];
      if (value === undefined) {
        cells.push('');
      } else if (isEvidence(value)) {
        cells.push(value.map((f) => f.url).join(' | '));
      } else {
        cells.push(getAnswerLabel(q.id, value));
      }
    }
    return cells;
  });

  return { headers, rows };
}

export function exportResponsesToCsv(
  responses: ExportRow[],
  filename = 'prosegur-resultados.csv'
) {
  const { headers, rows } = buildExportRows(responses);
  const csv = [headers, ...rows]
    .map((row) => row.map((c) => csvCell(String(c))).join(','))
    .join('\n');

  downloadBlob(
    new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }),
    filename
  );
}

export async function exportResponsesToExcel(
  responses: ExportRow[],
  filename = 'prosegur-resultados.xlsx'
) {
  const XLSX = await import('xlsx');
  const { headers, rows } = buildExportRows(responses);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
  XLSX.writeFile(wb, filename);
}

export async function exportResponsesToPdf(
  responses: ExportRow[],
  filename = 'prosegur-resultados.pdf'
) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape' });
  const { headers, rows } = buildExportRows(responses);

  autoTable(doc, {
    head: [headers.slice(0, 8)],
    body: rows.map((r) => r.slice(0, 8).map(String)),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175] },
    margin: { top: 20 },
  });

  doc.save(filename);
}
