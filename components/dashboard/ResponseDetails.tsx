'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { AnswerValue, Question, StageStatus, StagesMap, SurveyResponse } from '@/lib/types';
import { FileText, Check, X, MoreVertical, Unlock, Loader2 } from 'lucide-react';
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
  onRejectStage?: (sectionId: string, message: string) => void | Promise<void>;
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
  onRejectStage,
  actionLoading,
  onUnlockSurvey,
  unlockLoading = false,
}: ResponseDetailsProps) {
  const [rejectDialogSectionId, setRejectDialogSectionId] = useState<string | null>(null);
  const [rejectMessage, setRejectMessage] = useState('');

  const stages: StagesMap = response.stages || {};
  const isFinalized = response.answers['proceso-finalizado'] === 'si';
  const fechaFin =
    (response.answers['fecha-fin'] as string) || response.fechaFin || '';

  const reviewableSectionIds =
    mode === 'results'
      ? REVIEWABLE_SECTIONS.filter((id) => {
          const st = stages[id]?.status;
          return st === 'aprobada' || st === 'rechazada';
        })
      : REVIEWABLE_SECTIONS;

  const openRejectDialog = (sectionId: string) => {
    setRejectDialogSectionId(sectionId);
    setRejectMessage('');
  };

  const closeRejectDialog = () => {
    setRejectDialogSectionId(null);
    setRejectMessage('');
  };

  const confirmReject = async () => {
    if (!rejectDialogSectionId || !rejectMessage.trim()) return;
    try {
      await onRejectStage?.(rejectDialogSectionId, rejectMessage.trim());
      closeRejectDialog();
    } catch {
      // padre muestra toast
    }
  };

  const renderModuleBlock = (sectionId: string, moduleId: string) => {
    const section = surveySections.find((s) => s.id === sectionId);
    const module = section ? getAllSectionModules(section).find((m) => m.id === moduleId) : undefined;
    if (!module || !isModuleVisible(module, response.answers)) return null;

    const questions = getVisibleQuestions(module, response.answers).filter(
      (q) =>
        stageWasSubmitted(stages[sectionId]?.status) ||
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
          {questions.map((question) => (
            <div
              key={question.id}
              className="grid grid-cols-1 lg:grid-cols-2 gap-2 py-3 border-b last:border-0"
            >
                <span className="text-sm text-muted-foreground leading-relaxed">
                  {formatQuestionText(question.text)}
                </span>
              <div className="text-sm font-medium">
                {renderAnswerCell(question, response.answers[question.id], response.answers)}
              </div>
            </div>
          ))}
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

    const rejectionMessage = stages[sectionId]?.rejectionMessage;

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
                variant="destructive"
                disabled={actionLoading === sectionId}
                onClick={() => openRejectDialog(sectionId)}
              >
                <X className="w-4 h-4 mr-1" />
                Rechazar
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

        {stageStatus === 'rechazada' && rejectionMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-sm">
            <p className="font-medium text-red-800 mb-1">Motivo del rechazo</p>
            <p className="text-red-900/90 whitespace-pre-wrap">{rejectionMessage}</p>
          </div>
        )}

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
      <Dialog
        open={rejectDialogSectionId !== null}
        onOpenChange={(open) => {
          if (!open) closeRejectDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar parte</DialogTitle>
            <DialogDescription>
              {rejectDialogSectionId
                ? `Indicá el motivo del rechazo para "${getSectionTitle(rejectDialogSectionId)}".`
                : 'Indicá el motivo del rechazo.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-message">Mensaje para el shopper</Label>
            <Textarea
              id="reject-message"
              value={rejectMessage}
              onChange={(e) => setRejectMessage(e.target.value)}
              placeholder="Ej: Falta evidencia o la fecha no coincide..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeRejectDialog}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectMessage.trim() || actionLoading === rejectDialogSectionId}
              onClick={confirmReject}
            >
              {actionLoading === rejectDialogSectionId ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <X className="w-4 h-4 mr-2" />
              )}
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
