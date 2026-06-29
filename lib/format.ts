import { surveySections } from './survey-config';
import { AnswerValue, EvidenceFile, Question } from './types';

// Busca una pregunta por id en todas las secciones
export function findQuestion(questionId: string): Question | undefined {
  for (const section of surveySections) {
    const q = section.questions.find((q) => q.id === questionId);
    if (q) return q;
  }
  return undefined;
}

// ¿El valor es una lista de archivos de evidencia?
export function isEvidence(value: AnswerValue): value is EvidenceFile[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'object' &&
    value[0] !== null &&
    'url' in value[0]
  );
}

// Devuelve el texto legible de una respuesta (resuelve labels de opciones)
export function getAnswerLabel(questionId: string, value: AnswerValue): string {
  if (value === undefined || value === null || value === '') return '-';

  if (isEvidence(value)) {
    return `${value.length} archivo${value.length !== 1 ? 's' : ''}`;
  }

  const question = findQuestion(questionId);

  if (Array.isArray(value)) {
    return (value as string[])
      .map((v) => question?.options?.find((o) => o.value === v)?.label || v)
      .join(', ');
  }

  return question?.options?.find((o) => o.value === value)?.label || String(value);
}

// Etiqueta legible del estado
export const STATUS_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  publicado: 'Publicado',
  rechazado: 'Rechazado',
};
