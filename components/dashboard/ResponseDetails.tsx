'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  REVIEWABLE_SECTIONS,
  surveySections,
  getSectionTitle,
  getModuleTitle,
  getAllSectionModules,
} from '@/lib/survey-config';
import {
  getAnswerLabel,
  hasAnswerValue,
  isEvidence,
  isMatrixAnswer,
  formatQuestionText,
} from '@/lib/format';
import {
  getVisibleMatrixRows,
  getVisibleQuestions,
  isModuleVisible,
} from '@/lib/survey-logic';
import {
  AnswerValue,
  Question,
  ReviewFlagsMap,
  StageStatus,
  StagesMap,
  SurveyResponse,
} from '@/lib/types';
import { FileText, Check, AlertCircle, MoreVertical, Unlock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ResponseDetailsMode = 'revision' | 'results';

const REVISION_STATUS_LABELS: Record<StageStatus, string> = {
  pendiente: 'Pendiente de respuesta',
  en_revision: 'Revisar',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

const RESULTS_STATUS_LABELS: Record<string, string> = {
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

const STAGE_STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-slate-100 text-slate-600 border-slate-200',
  en_revision: 'bg-amber-50 text-amber-800 border-amber-300',
  aprobada: 'bg-green-50 text-green-700 border-green-200',
  rechazada: 'bg-red-50 text-red-700 border-red-200',
};

interface ResponseDetailsProps {
  response: SurveyResponse;
  mode?: ResponseDetailsMode;
  showStageActions?: boolean;
  onApproveStage?: (sectionId: string) => void;
  onSendCorrections?: (sectionId: string, reviewFlags: ReviewFlagsMap) => void | Promise<void>;
  actionLoading?: string | null;
  onUnlockSurvey?: () => void;
  unlockLoading?: boolean;
}

function renderAnswerCell(
  question: Question,
  answer: AnswerValue | undefined,
  answers: Record<string, AnswerValue>
) {
  if (question.type === 'evidence') {
    if (!answer || !isEvidence(answer)) {
      return (
        <span className="text-muted-foreground italic font-normal">Sin evidencia adjunta</span>
      );
    }
    return (
      <div className="space-y-2">
        {answer.map((file) => (
          <a
            key={file.url}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">{file.name}</span>
          </a>
        ))}
      </div>
    );
  }

  if (question.type === 'matrix' && answer && isMatrixAnswer(answer)) {
    const rows = getVisibleMatrixRows(question, answers);
    const cols = question.matrixColumns ?? question.options ?? [];
    return (
      <div className="space-y-1">
        {rows
          .filter((r) => answer[r.id] !== undefined)
          .map((r) => {
            const colLabel =
              cols.find((c) => c.value === answer[r.id])?.label ?? answer[r.id];
            return (
              <div key={r.id}>
                <span className="text-muted-foreground">{r.label}: </span>
                {colLabel}
              </div>
            );
          })}
      </div>
    );
  }

  if (!hasAnswerValue(answer)) {
    return <span className="text-muted-foreground italic font-normal">Sin respuesta</span>;
  }

  return getAnswerLabel(question.id, answer as AnswerValue);
}

function stageWasSubmitted(status: StageStatus | undefined): boolean {
  return status === 'en_revision' || status === 'aprobada' || status === 'rechazada';
}

export function ResponseDetails({
  response,
  mode = 'revision',
  showStageActions = false,
  onApproveStage,
  onSendCorrections,
  actionLoading,
  onUnlockSurvey,
  unlockLoading = false,
}: ResponseDetailsProps) {
  const [draftFlags, setDraftFlags] = useState<ReviewFlagsMap>({});

  const stages: StagesMap = response.stages || {};
  const isFinalized = response.answers['proceso-finalizado'] === 'si';
  const fechaFin =
    (response.answers['fecha-fin'] as string) || response.fechaFin || '';

  useEffect(() => {
    const flags = response.reviewFlags || {};
    const active: ReviewFlagsMap = {};
    for (const [qId, flag] of Object.entries(flags)) {
      if (!flag.corrected) {
        active[qId] = flag;
      }
    }
    setDraftFlags(active);
  }, [response.id, response.reviewFlags]);

  const reviewableSectionIds =
    mode === 'results'
      ? REVIEWABLE_SECTIONS.filter((id) => {
          const st = stages[id]?.status;
          return st === 'aprobada' || st === 'rechazada';
        })
      : REVIEWABLE_SECTIONS;

  const toggleQuestionFlag = (questionId: string, sectionId: string, checked: boolean) => {
    setDraftFlags((prev) => {
      const next = { ...prev };
      if (checked) {
        next[questionId] = { note: prev[questionId]?.note || '', sectionId };
      } else {
        delete next[questionId];
      }
      return next;
    });
  };

  const updateQuestionNote = (questionId: string, sectionId: string, note: string) => {
    setDraftFlags((prev) => ({
      ...prev,
      [questionId]: { note, sectionId },
    }));
  };

  const getSectionDraftFlags = (sectionId: string): ReviewFlagsMap => {
    const result: ReviewFlagsMap = {};
    for (const [qId, flag] of Object.entries(draftFlags)) {
      if (flag.sectionId === sectionId && flag.note.trim()) {
        result[qId] = flag;
      }
    }
    return result;
  };

  const renderModuleBlock = (sectionId: string, moduleId: string) => {
    const section = surveySections.find((s) => s.id === sectionId);
    const module = section ? getAllSectionModules(section).find((m) => m.id === moduleId) : undefined;
    if (!module || !isModuleVisible(module, response.answers)) return null;

    const stageStatus = stages[sectionId]?.status;
    const canMarkReview = showStageActions && stageStatus === 'en_revision';

    const questions = getVisibleQuestions(module, response.answers).filter(
      (q) =>
        stageWasSubmitted(stageStatus) ||
        mode === 'results' ||
        hasAnswerValue(response.answers[q.id])
    );

    if (questions.length === 0) return null;

    return (
      <div key={`${sectionId}-${moduleId}`} className="space-y-3 pl-2 border-l-2 border-muted">
        <h5 className="font-medium text-base">{module.title}</h5>
        {module.description && (
          <p className="text-sm text-muted-foreground">{module.description}</p>
        )}
        <div className="grid gap-3">
          {questions.map((question) => {
            const storedFlag = response.reviewFlags?.[question.id];
            const wasCorrected = storedFlag?.corrected === true;
            const isMarked = Boolean(draftFlags[question.id]);
            const note = draftFlags[question.id]?.note || '';

            return (
              <div
                key={question.id}
                className={cn(
                  'grid grid-cols-1 gap-3 py-3 border-b last:border-0',
                  wasCorrected && 'rounded-lg border border-green-200 bg-green-50/50 p-3 -mx-1',
                  isMarked && canMarkReview && 'rounded-lg border border-amber-200 bg-amber-50/40 p-3 -mx-1'
                )}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  <span className="text-sm text-muted-foreground leading-relaxed">
                    {formatQuestionText(question.text)}
                  </span>
                  <div className="text-sm font-medium">
                    {renderAnswerCell(question, response.answers[question.id], response.answers)}
                  </div>
                </div>

                {wasCorrected && storedFlag?.note && (
                  <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm space-y-1.5">
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 border-green-300"
                    >
                      Marcada a revisar → Ya corregida
                    </Badge>
                    <p className="text-green-900/90 whitespace-pre-wrap">{storedFlag.note}</p>
                  </div>
                )}

                {canMarkReview && !wasCorrected && (
                  <div className="space-y-2 pl-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={isMarked}
                        onCheckedChange={(checked) =>
                          toggleQuestionFlag(question.id, sectionId, checked === true)
                        }
                      />
                      <span className="font-medium">Marcar a revisar</span>
                    </label>
                    {isMarked && (
                      <div className="space-y-1.5">
                        <Label htmlFor={`note-${question.id}`} className="text-xs text-muted-foreground">
                          Observación para el shopper
                        </Label>
                        <Textarea
                          id={`note-${question.id}`}
                          value={note}
                          onChange={(e) =>
                            updateQuestionNote(question.id, sectionId, e.target.value)
                          }
                          placeholder="Ej: Sea más explícito en la respuesta..."
                          className="min-h-[72px] text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSectionBlock = (sectionId: string) => {
    const section = surveySections.find((s) => s.id === sectionId);
    if (!section) return null;

    const stageStatus = stages[sectionId]?.status;
    const modules = getAllSectionModules(section).filter((m) =>
      isModuleVisible(m, response.answers)
    );

    const hasAnswers = modules.some((m) =>
      getVisibleQuestions(m, response.answers).some((q) =>
        hasAnswerValue(response.answers[q.id])
      )
    );

    if (mode === 'results' && stageStatus !== 'aprobada' && stageStatus !== 'rechazada') {
      return null;
    }

    const statusLabel =
      mode === 'revision' && stageStatus
        ? REVISION_STATUS_LABELS[stageStatus]
        : stageStatus
        ? RESULTS_STATUS_LABELS[stageStatus] || stageStatus
        : undefined;

    const sectionFlags = getSectionDraftFlags(sectionId);
    const markedCount = Object.keys(sectionFlags).length;

    return (
      <div
        key={sectionId}
        className={cn(
          'rounded-xl border p-5 space-y-4',
          stageStatus === 'en_revision' && mode === 'revision' && 'border-amber-300 bg-amber-50/30',
          stageStatus === 'pendiente' && mode === 'revision' && 'border-dashed opacity-90'
        )}
      >
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="space-y-2">
            <h4 className="font-semibold text-lg">{section.title}</h4>
            {statusLabel && stageStatus && (
              <Badge variant="outline" className={cn(STAGE_STATUS_COLORS[stageStatus])}>
                {statusLabel}
              </Badge>
            )}
          </div>

          {showStageActions && stageStatus === 'en_revision' && (
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-400 text-amber-900 hover:bg-amber-100"
                disabled={actionLoading === sectionId || markedCount === 0}
                onClick={() => onSendCorrections?.(sectionId, sectionFlags)}
              >
                {actionLoading === sectionId ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4 mr-1" />
                )}
                Enviar a corregir{markedCount > 0 ? ` (${markedCount})` : ''}
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                disabled={actionLoading === sectionId}
                onClick={() => onApproveStage?.(sectionId)}
              >
                <Check className="w-4 h-4 mr-1" />
                Aprobar
              </Button>
            </div>
          )}
        </div>

        {!hasAnswers ? (
          <p className="text-sm text-muted-foreground italic">
            {mode === 'revision'
              ? 'El shopper aún no completó esta parte.'
              : 'Sin respuestas registradas.'}
          </p>
        ) : (
          <div className="space-y-5">
            {modules.map((m) => renderModuleBlock(sectionId, m.id))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {isFinalized && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
              Proceso finalizado
            </Badge>
            {fechaFin && (
              <span className="text-sm text-muted-foreground">
                Fecha de término:{' '}
                <span className="font-medium text-foreground">
                  {new Date(fechaFin + 'T12:00:00').toLocaleDateString('es-AR')}
                </span>
              </span>
            )}
          </div>
          {mode === 'revision' && onUnlockSurvey && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" disabled={unlockLoading}>
                  {unlockLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onUnlockSurvey} disabled={unlockLoading}>
                  <Unlock className="w-4 h-4 mr-2" />
                  Desbloquear encuesta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {reviewableSectionIds.map((sectionId) => renderSectionBlock(sectionId))}

      {mode === 'results' && reviewableSectionIds.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay partes aprobadas o rechazadas para mostrar.
        </p>
      )}
    </div>
  );
}

export { getSectionTitle, getModuleTitle };
