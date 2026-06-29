import { SurveySection } from './types';

const SI_NO = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
];

// Configuración base de la encuesta Mystery Shopper Prosegur.
// Reemplazar/ampliar secciones cuando se tenga la encuesta definitiva.
// Soporta saltos lógicos con showIf en cada pregunta.
export const surveySections: SurveySection[] = [
  {
    id: 'general',
    title: 'Información General',
    description: 'Datos generales del mystery shopper y del proceso',
    questions: [
      { id: 'nombre-apellido', text: 'Nombre y Apellido', type: 'text', required: true },
      { id: 'empresa', text: 'Empresa / Sucursal', type: 'text', required: true },
      { id: 'ciudad', text: 'Ciudad', type: 'text', required: true },
      { id: 'fecha-inicio', text: 'Fecha de inicio', type: 'date' },
      {
        id: 'ultima-etapa',
        text: 'Última etapa alcanzada',
        type: 'single',
        options: [
          { value: 'ejemplo', label: 'Sección de ejemplo' },
        ],
      },
    ],
  },
  {
    id: 'ejemplo',
    title: 'Sección de Ejemplo',
    description: 'Sección de prueba para validar el flujo. Reemplazar con la encuesta real de Prosegur.',
    questions: [
      {
        id: 'ej-tuvo-incidente',
        text: '¿Hubo algún incidente durante la visita?',
        type: 'single',
        options: SI_NO,
      },
      {
        id: 'ej-detalle-incidente',
        text: 'Describir el incidente',
        type: 'longtext',
        hint: 'Solo si respondió Sí arriba',
        showIf: { questionId: 'ej-tuvo-incidente', values: ['si'] },
      },
      {
        id: 'ej-satisfaccion',
        text: 'Nivel de satisfacción general',
        type: 'scale',
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: 'Muy bajo',
        scaleMaxLabel: 'Muy alto',
      },
      {
        id: 'evidence-ejemplo',
        text: 'Evidencia de la visita',
        type: 'evidence',
        hint: 'Fotos, capturas o documentos de respaldo.',
      },
    ],
  },
];

export const HEADER_FIELDS = {
  'nombre-apellido': 'nombreApellido',
  'empresa': 'empresa',
  'ciudad': 'ciudad',
  'fecha-inicio': 'fechaInicio',
  'fecha-fin': 'fechaFin',
  'ultima-etapa': 'ultimaEtapa',
} as const;

export const REVIEWABLE_SECTIONS = surveySections
  .filter((s) => s.id !== 'general')
  .map((s) => s.id);

export function getSectionTitle(sectionId: string): string {
  return surveySections.find((s) => s.id === sectionId)?.title ?? sectionId;
}

export function getSectionIndex(sectionId: string): number {
  return surveySections.findIndex((s) => s.id === sectionId);
}

export function getNextReviewableSection(currentSectionId: string): string | null {
  const idx = surveySections.findIndex((s) => s.id === currentSectionId);
  for (let i = idx + 1; i < surveySections.length; i++) {
    if (REVIEWABLE_SECTIONS.includes(surveySections[i].id)) {
      return surveySections[i].id;
    }
  }
  return null;
}

export function getResumeSectionIndex(stages: Record<string, { status?: string }>): number {
  let maxIdx = 0;
  for (const sectionId of REVIEWABLE_SECTIONS) {
    const st = stages[sectionId]?.status;
    if (st && st !== 'pendiente') {
      const idx = getSectionIndex(sectionId);
      if (idx > maxIdx) maxIdx = idx;
    }
  }
  return maxIdx;
}

export function getMaxApprovedStage(stages: Record<string, { status?: string }>): string | null {
  let maxIdx = -1;
  let maxStage: string | null = null;
  for (const sectionId of REVIEWABLE_SECTIONS) {
    if (stages[sectionId]?.status === 'aprobada') {
      const idx = REVIEWABLE_SECTIONS.indexOf(sectionId);
      if (idx > maxIdx) {
        maxIdx = idx;
        maxStage = sectionId;
      }
    }
  }
  return maxStage;
}
