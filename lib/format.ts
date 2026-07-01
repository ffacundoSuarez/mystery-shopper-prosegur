import { surveySections } from './survey-config';
import {
  findQuestionInSections,
  getAllQuestions,
  getVisibleMatrixRows,
  getVisibleOptions,
  hasAnswerValue,
  isMatrixAnswer,
  isQuestionVisible,
} from './survey-logic';
import { AnswerValue, EvidenceFile, Question } from './types';

/** Quita prefijos internos (F1., P17A., C1.) del texto mostrado al usuario */
export function formatQuestionText(text: string): string {
  return text.replace(/^[FPCfpc]\d+[A-Za-z]?\.\s*/, '').trim();
}

export function findQuestion(questionId: string): Question | undefined {
  return findQuestionInSections(surveySections, questionId);
}

export function isEvidence(value: AnswerValue): value is EvidenceFile[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'object' &&
    value[0] !== null &&
    'url' in value[0]
  );
}

function labelFromOptions(
  options: { value: string; label: string }[] | undefined,
  value: string
): string {
  return options?.find((o) => o.value === value)?.label ?? value;
}

/** Texto legible de una respuesta (resuelve labels de opciones y matrices) */
export function getAnswerLabel(questionId: string, value: AnswerValue): string {
  if (value === undefined || value === null || value === '') return '-';

  if (isEvidence(value)) {
    return `${value.length} archivo${value.length !== 1 ? 's' : ''}`;
  }

  const question = findQuestion(questionId);
  if (!question) return String(value);

  if (isMatrixAnswer(value)) {
    const rows = question.matrixRows ?? [];
    const cols = question.matrixColumns ?? question.options ?? [];
    return rows
      .filter((r) => value[r.id] !== undefined)
      .map((r) => {
        const colLabel = labelFromOptions(cols, value[r.id]);
        return `${r.label}: ${colLabel}`;
      })
      .join(' | ');
  }

  if (Array.isArray(value)) {
    const opts = question.options ?? [];
    return (value as string[])
      .map((v) => labelFromOptions(opts, v))
      .join(', ');
  }

  const opts = question.options ?? question.matrixColumns ?? [];
  return labelFromOptions(opts, String(value));
}

/** Etiqueta legible del estado */
export const STATUS_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  publicado: 'Publicado',
  rechazado: 'Rechazado',
};

export {
  hasAnswerValue,
  isMatrixAnswer,
  isQuestionVisible,
  getVisibleOptions,
  getVisibleMatrixRows,
  getAllQuestions,
};
