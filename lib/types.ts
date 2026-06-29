// Tipos para el sistema de formularios Mystery Shopper Prosegur

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  text: string;
  type: 'single' | 'multiple' | 'text' | 'longtext' | 'date' | 'time' | 'number' | 'scale' | 'evidence';
  options?: QuestionOption[];
  required?: boolean;
  hint?: string;
  showIf?: {
    questionId: string;
    values: string[];
  };
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
}

export interface SurveySection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

// Estado global legacy (compatibilidad)
export type ResponseStatus = 'borrador' | 'en_revision' | 'publicado' | 'rechazado';

// Estado por etapa/sección revisable
export type StageStatus = 'pendiente' | 'en_revision' | 'aprobada' | 'rechazada';

export interface StageInfo {
  status: StageStatus;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  /** Motivo del rechazo (visible para el postulante) */
  rejectionMessage?: string;
}

export type StagesMap = Record<string, StageInfo>;

export interface EvidenceFile {
  url: string;
  name: string;
  type: string;
}

export type AnswerValue = string | string[] | EvidenceFile[];

export interface SurveyResponse {
  id: string;
  code?: string;
  accessToken?: string;
  nombre?: string;
  apellido?: string;
  nombreApellido?: string;
  empresa?: string;
  ciudad?: string;
  fechaInicio?: string;
  fechaFin?: string;
  ultimaEtapa?: string;
  status: ResponseStatus;
  stages: StagesMap;
  answers: Record<string, AnswerValue>;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Item en cola de revisión (una etapa pendiente)
export interface PendingReviewItem {
  id: string;
  code?: string;
  accessToken?: string;
  nombre?: string;
  apellido?: string;
  nombreApellido?: string;
  empresa?: string;
  ciudad?: string;
  sectionId: string;
  stages: StagesMap;
  answers: Record<string, AnswerValue>;
  updatedAt: string;
}

// Resultado público para vista del cliente
export interface PublicResult {
  id: string;
  code?: string;
  nombre?: string;
  apellido?: string;
  nombreApellido?: string;
  empresa?: string;
  ciudad?: string;
  maxApprovedStage?: string;
  stages: StagesMap;
  answers: Record<string, AnswerValue>;
  updatedAt: string;
}

export interface PostulanteSummary {
  id: string;
  code?: string;
  accessToken?: string;
  nombre?: string;
  apellido?: string;
  nombreApellido?: string;
  empresa?: string;
  ciudad?: string;
  stages?: StagesMap;
  status?: ResponseStatus;
  createdAt: string;
  updatedAt?: string;
}
