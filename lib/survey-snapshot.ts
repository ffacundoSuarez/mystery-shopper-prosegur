import {
  MARCAS,
  PAISES,
  REGION_ARG,
  REGION_CHI,
  REGION_COL,
  REGION_DEU,
  REGION_PER,
  REGION_POR,
  REGION_PRY,
  REGION_URY,
} from './survey-config/constants';
import { getSectionTitle, allStagesApproved } from './survey-config';
import { AnswerValue, QuestionOption, StageStatus, StagesMap } from './types';

const CATEGORIA_LABELS: Record<string, string> = {
  '1': 'Hogares',
  '2': 'Negocios',
};

const CANAL_LABELS: Record<string, string> = {
  '1': 'Telefónico',
  '2': 'Presencial',
};

const REGION_FIELDS: { key: string; options: QuestionOption[] }[] = [
  { key: 'f2a-region', options: REGION_ARG },
  { key: 'f2b-region', options: REGION_COL },
  { key: 'f2c-region', options: REGION_PER },
  { key: 'f2d-region', options: REGION_CHI },
  { key: 'f2e-region', options: REGION_PRY },
  { key: 'f2f-region', options: REGION_URY },
  { key: 'f2g-region', options: REGION_POR },
  { key: 'f2h-region', options: REGION_DEU },
];

const STAGE_SHORT: Record<StageStatus, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

export interface ScreeningSnapshot {
  paisCode?: string;
  pais?: string;
  region?: string;
  marca?: string;
  categoria?: string;
  canal?: string;
  hasScreening: boolean;
}

function optionLabel(options: QuestionOption[], value: string): string | undefined {
  return options.find((o) => o.value === value)?.label;
}

/** Resumen legible del módulo screening (F1–F5) desde answers */
export function getScreeningSnapshot(
  answers: Record<string, AnswerValue> = {}
): ScreeningSnapshot {
  const paisCode = answers['f1-pais'] as string | undefined;
  const pais = paisCode ? optionLabel(PAISES, paisCode) : undefined;

  let region: string | undefined;
  for (const { key, options } of REGION_FIELDS) {
    const raw = answers[key] as string | undefined;
    if (!raw) continue;
    region =
      raw === 'otro'
        ? 'Otro'
        : optionLabel(options, raw) ?? raw;
    break;
  }

  const marcaCode = answers['f3-marca'] as string | undefined;
  let marca: string | undefined;
  if (marcaCode === '13') {
    marca = (answers['f3-marca-otra'] as string) || 'Otra';
  } else if (marcaCode) {
    marca = optionLabel(MARCAS, marcaCode);
  }

  const categoriaCode = answers['f4-categoria'] as string | undefined;
  const categoria = categoriaCode ? CATEGORIA_LABELS[categoriaCode] : undefined;

  const canalCode = answers['f5-canal'] as string | undefined;
  const canal = canalCode ? CANAL_LABELS[canalCode] : undefined;

  return {
    paisCode,
    pais,
    region,
    marca,
    categoria,
    canal,
    hasScreening: Boolean(paisCode),
  };
}

/**
 * True si la encuesta fue contestada en la primera etapa:
 * la Parte 1 fue enviada (status distinto de pendiente).
 * Se usa para que las estadísticas no cuenten links generados sin responder.
 */
export function hasAnsweredFirstStage(stages: StagesMap = {}): boolean {
  const status = stages['parte-1']?.status;
  return Boolean(status && status !== 'pendiente');
}

/** Texto corto de progreso por partes */
export function getPartProgressLabel(
  stages: StagesMap = {},
  answers: Record<string, AnswerValue> = {}
): string {
  if (allStagesApproved(stages)) return 'Encuesta completa';

  const partIds = ['parte-1', 'parte-2', 'parte-3'] as const;
  let lastActive = -1;

  for (let i = 0; i < partIds.length; i++) {
    const status = stages[partIds[i]]?.status;
    if (status && status !== 'pendiente') lastActive = i;
  }

  if (lastActive < 0) return 'Sin iniciar';

  const partId = partIds[lastActive];
  const status = stages[partId]?.status as StageStatus | undefined;
  const title = getSectionTitle(partId).replace('Parte ', 'P');
  return status ? `${title} · ${STAGE_SHORT[status]}` : title;
}
