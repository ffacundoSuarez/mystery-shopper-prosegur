'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  surveySections,
  getResumeSectionIndex,
  getSectionTitle,
  getNextReviewableSection,
  getSectionModules,
  isLastVisibleModule,
  isReviewableSection,
} from '@/lib/survey-config';
import {
  getDisqualification,
  getOrderedOptions,
  getPartAnswers,
  getProgressiveQuestions,
  getVisibleMatrixRows,
  isModuleComplete,
  partHasAnswers,
} from '@/lib/survey-logic';
import { formatQuestionText } from '@/lib/format';
import { AnswerValue, EvidenceFile, MatrixAnswer, Question, StageStatus, StagesMap, SurveyModule } from '@/lib/types';
import { getResponseByToken, saveStageByToken, uploadEvidence, finalizeProcessByToken } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Upload,
  Loader2,
  FileText,
  X,
  Eye,
  Clock,
  AlertCircle,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STAGE_STATUS_TEXT: Record<StageStatus, string> = {
  pendiente: 'pendiente',
  en_revision: 'en revisión',
  aprobada: 'aprobada',
  rechazada: 'rechazada',
};

function sectionAnswersEqual(
  a: Record<string, AnswerValue>,
  b: Record<string, AnswerValue>
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isParte1Completed(stages: StagesMap): boolean {
  const status = stages['parte-1']?.status;
  return status === 'en_revision' || status === 'aprobada' || status === 'rechazada';
}

type FinalizeDialogStep = 'ask' | 'date';

export function SurveyForm({ accessToken }: { accessToken: string }) {
  const [currentSection, setCurrentSection] = useState(0);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [stages, setStages] = useState<StagesMap>({});
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showStageGate, setShowStageGate] = useState(false);
  const [surveyThankYou, setSurveyThankYou] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [sectionBaseline, setSectionBaseline] = useState<Record<string, AnswerValue>>({});
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [finalizeDialogStep, setFinalizeDialogStep] = useState<FinalizeDialogStep>('ask');
  const [finalizeFecha, setFinalizeFecha] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  const isFinalized = answers['proceso-finalizado'] === 'si';
  const section = surveySections[currentSection];
  const sectionId = section.id;
  const isReviewable = isReviewableSection(sectionId);
  const currentStageStatus = stages[sectionId]?.status as StageStatus | undefined;

  const visibleModules = useMemo(
    () => getSectionModules(section, answers),
    [section, answers]
  );

  const currentModule: SurveyModule | undefined =
    visibleModules[currentModuleIndex] ?? visibleModules[0];

  const moduleProgress = useMemo(() => {
    if (visibleModules.length === 0) return 0;
    return ((currentModuleIndex + 1) / visibleModules.length) * 100;
  }, [currentModuleIndex, visibleModules.length]);

  const totalSections = surveySections.length;
  const sectionProgress = ((currentSection + 1) / totalSections) * 100;

  const nextSectionTitle = useMemo(() => {
    const nextId = getNextReviewableSection(sectionId);
    return nextId ? getSectionTitle(nextId) : null;
  }, [sectionId]);

  const nextSectionIndex = useMemo(() => {
    const nextId = getNextReviewableSection(sectionId);
    if (!nextId) return null;
    return surveySections.findIndex((s) => s.id === nextId);
  }, [sectionId]);

  const getSectionAnswers = useCallback(
    (secId: string, source: Record<string, AnswerValue> = answers) => {
      const sec = surveySections.find((s) => s.id === secId);
      if (!sec) return {};
      return getPartAnswers(sec, source);
    },
    [answers]
  );

  const hasSectionEdits = useMemo(() => {
    return !sectionAnswersEqual(getSectionAnswers(sectionId), sectionBaseline);
  }, [answers, sectionBaseline, sectionId, getSectionAnswers]);

  const currentModuleComplete = useMemo(() => {
    if (!currentModule) return false;
    return isModuleComplete(currentModule, answers);
  }, [answers, currentModule]);

  const shouldSubmitForReview = useMemo(() => {
    if (!isReviewable) return false;
    if (!partHasAnswers(section, answers)) return false;
    if (!currentStageStatus || currentStageStatus === 'pendiente') return true;
    if (currentStageStatus === 'rechazada') return hasSectionEdits;
    return hasSectionEdits;
  }, [isReviewable, section, answers, currentStageStatus, hasSectionEdits]);

  const showStatusBanner =
    isReviewable && currentStageStatus && currentStageStatus !== 'pendiente';

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const existing = await getResponseByToken(accessToken);
        if (!active) return;
        if (existing) {
          const ans = existing.answers || {};
          setAnswers(ans);
          setStages(existing.stages || {});
          setCode(existing.code || '');
          setCurrentSection(getResumeSectionIndex(existing.stages || {}));
          if (ans['encuesta-cerrada'] === 'si') {
            setSurveyThankYou(true);
          }
        }
      } catch {
        toast.error('No se pudo cargar el formulario');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (loading) return;
    if (answers['proceso-finalizado'] === 'si') return;
    if (!isParte1Completed(stages)) return;
    setFinalizeDialogOpen(true);
    setFinalizeDialogStep('ask');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    setCurrentModuleIndex(0);
    setSectionBaseline(getSectionAnswers(sectionId, answers));
    if (isReviewable) {
      const status = stages[sectionId]?.status;
      setShowStageGate(status === 'aprobada' || status === 'en_revision');
    } else {
      setShowStageGate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection, loading]);

  const updateAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const updateMatrixCell = (questionId: string, rowId: string, value: string) => {
    setAnswers((prev) => {
      const current = (prev[questionId] as MatrixAnswer) || {};
      return { ...prev, [questionId]: { ...current, [rowId]: value } };
    });
  };

  const toggleMultipleChoice = (questionId: string, value: string) => {
    const current = (answers[questionId] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateAnswer(questionId, updated);
  };

  const handleEvidenceUpload = async (questionId: string, files: FileList | null) => {
    if (isFinalized || surveyThankYou) return;
    if (!files || files.length === 0) return;
    setUploading((p) => ({ ...p, [questionId]: true }));
    try {
      const uploaded: EvidenceFile[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(
          await uploadEvidence(accessToken, questionId, file, (pct) =>
            setUploadProgress((p) => ({ ...p, [questionId]: pct }))
          )
        );
      }
      const current = (answers[questionId] as EvidenceFile[]) || [];
      updateAnswer(questionId, [...current, ...uploaded]);
      toast.success('Archivo enviado correctamente');
    } catch {
      toast.error('Error al enviar el archivo');
    } finally {
      setUploading((p) => ({ ...p, [questionId]: false }));
      setUploadProgress((p) => ({ ...p, [questionId]: 0 }));
    }
  };

  const removeEvidence = (questionId: string, url: string) => {
    const current = (answers[questionId] as EvidenceFile[]) || [];
    updateAnswer(questionId, current.filter((f) => f.url !== url));
  };

  const advanceToNextModule = () => {
    if (currentModuleIndex < visibleModules.length - 1) {
      setCurrentModuleIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }
    return false;
  };

  const advanceToNextSection = () => {
    if (currentSection < totalSections - 1) {
      setCurrentSection((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const saveCurrentSection = async (advance: boolean, submitReview: boolean) => {
    if (isFinalized || surveyThankYou) return;
    setSaving(true);
    try {
      const sectionAnswers = getSectionAnswers(sectionId);
      const updated = await saveStageByToken(
        accessToken,
        sectionId,
        sectionAnswers,
        submitReview
      );
      setStages(updated.stages || {});
      setAnswers(updated.answers || {});
      setSectionBaseline(getSectionAnswers(sectionId, updated.answers || {}));

      if (submitReview && isReviewable) {
        toast.success(`"${section.title}" enviada para revisión`);
        setShowStageGate(true);
        return;
      }

      if (advance) advanceToNextSection();
    } catch {
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSurveyThankYou = async () => {
    setSaving(true);
    try {
      const sectionAnswers = {
        ...getSectionAnswers(sectionId),
        'encuesta-cerrada': 'si',
      };
      const updated = await saveStageByToken(
        accessToken,
        sectionId,
        sectionAnswers,
        false
      );
      setAnswers(updated.answers || {});
      setSurveyThankYou(true);
    } catch {
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const goToNext = async () => {
    if (!currentModuleComplete) return;

    const dq = getDisqualification(surveySections, answers);
    if (dq.terminated) {
      await handleSurveyThankYou();
      return;
    }

    const lastModule = isLastVisibleModule(section, currentModuleIndex, answers);

    if (!lastModule) {
      setSaving(true);
      try {
        const sectionAnswers = getSectionAnswers(sectionId);
        const updated = await saveStageByToken(
          accessToken,
          sectionId,
          sectionAnswers,
          false
        );
        setStages(updated.stages || {});
        setAnswers(updated.answers || {});
        setSectionBaseline(getSectionAnswers(sectionId, updated.answers || {}));
        advanceToNextModule();
      } catch {
        toast.error('No se pudo guardar');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (shouldSubmitForReview) {
      await saveCurrentSection(true, true);
      return;
    }

    advanceToNextSection();
  };

  const goToPrevious = () => {
    if (currentModuleIndex > 0) {
      setCurrentModuleIndex((i) => i - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (currentSection > 0) {
      setCurrentSection((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToNextStage = () => {
    if (nextSectionIndex !== null) {
      setCurrentSection(nextSectionIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openResponsesForEdit = () => setShowStageGate(false);

  const handleFinalizeNo = () => {
    setFinalizeDialogOpen(false);
    setFinalizeDialogStep('ask');
    setFinalizeFecha('');
  };

  const handleFinalizeYes = () => setFinalizeDialogStep('date');

  const handleFinalizeSubmit = async () => {
    if (!finalizeFecha) {
      toast.error('Indique la fecha de término');
      return;
    }
    setFinalizing(true);
    try {
      const updated = await finalizeProcessByToken(accessToken, finalizeFecha);
      setAnswers(updated.answers || {});
      setStages(updated.stages || {});
      setFinalizeDialogOpen(false);
      toast.success('Proceso finalizado');
    } catch {
      toast.error('No se pudo finalizar');
    } finally {
      setFinalizing(false);
    }
  };

  const renderMatrix = (question: Question) => {
    const rows = getVisibleMatrixRows(question, answers);
    const cols = question.matrixColumns ?? question.options ?? [];
    const matrixVal = (answers[question.id] as MatrixAnswer) || {};

    const handleCell = (rowId: string, colValue: string) => {
      if (matrixVal[rowId] === colValue) {
        const next = { ...matrixVal };
        delete next[rowId];
        updateAnswer(question.id, next);
      } else {
        updateMatrixCell(question.id, rowId, colValue);
      }
    };

    return (
      <div className="space-y-3 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 border-b" />
              {cols.map((col) => (
                <th key={col.value} className="text-center p-2 border-b font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="p-2 align-top text-muted-foreground">{row.label}</td>
                {cols.map((col) => (
                  <td key={col.value} className="p-2 text-center">
                    <input
                      type="radio"
                      name={`${question.id}-${row.id}`}
                      checked={matrixVal[row.id] === col.value}
                      onClick={() => handleCell(row.id, col.value)}
                      onChange={() => handleCell(row.id, col.value)}
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderQuestion = (question: Question) => {
    const options = getOrderedOptions(question, answers, accessToken);
    const displayText = formatQuestionText(question.text);

    return (
      <div key={question.id} className="space-y-3">
        <Label className="text-base font-medium leading-relaxed">
          {displayText}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {question.hint && (
          <p className="text-sm text-muted-foreground">{question.hint}</p>
        )}

        {question.type === 'info' && question.hint && (
          <p className="text-sm bg-muted/50 p-3 rounded-lg">{question.hint}</p>
        )}

        {question.type === 'single' && options.length > 0 && (
          <div className="grid gap-2">
            {options.map((option) => {
              const selected = answers[question.id] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    updateAnswer(question.id, selected ? '' : option.value)
                  }
                  className={cn(
                    'flex items-center text-left w-full p-4 rounded-lg border-2 cursor-pointer transition-all',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <span className="flex-1 text-sm">{option.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {question.type === 'multiple' && options.length > 0 && (
          <div className="grid gap-2">
            {options.map((option) => {
              const isChecked = ((answers[question.id] as string[]) || []).includes(option.value);
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                    isChecked
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleMultipleChoice(question.id, option.value)}
                  />
                  <span className="flex-1 text-sm">{option.label}</span>
                </label>
              );
            })}
          </div>
        )}

        {question.type === 'text' && (
          <Input
            type="text"
            value={(answers[question.id] as string) || ''}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder="Escriba su respuesta..."
          />
        )}

        {question.type === 'longtext' && (
          <Textarea
            value={(answers[question.id] as string) || ''}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder="Escriba su respuesta..."
            className="min-h-[100px]"
          />
        )}

        {question.type === 'date' && (
          <Input
            type="date"
            value={(answers[question.id] as string) || ''}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
          />
        )}

        {question.type === 'time' && (
          <Input
            type="time"
            value={(answers[question.id] as string) || ''}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
          />
        )}

        {question.type === 'number' && (
          <Input
            type="number"
            value={(answers[question.id] as string) || ''}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
          />
        )}

        {question.type === 'scale' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {question.scaleMinLabel || question.scaleMin}
            </span>
            <div className="flex gap-1 flex-1 justify-center">
              {Array.from(
                { length: (question.scaleMax || 5) - (question.scaleMin || 1) + 1 },
                (_, i) => {
                  const value = String((question.scaleMin || 1) + i);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        updateAnswer(
                          question.id,
                          answers[question.id] === value ? '' : value
                        )
                      }
                      className={cn(
                        'w-9 h-9 rounded-full border-2 text-sm font-medium transition-all',
                        answers[question.id] === value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      {value}
                    </button>
                  );
                }
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {question.scaleMaxLabel || question.scaleMax}
            </span>
          </div>
        )}

        {question.type === 'matrix' && renderMatrix(question)}

        {question.type === 'evidence' && (
          <div className="space-y-3">
            <label className="block border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <input
                type="file"
                className="hidden"
                multiple
                onChange={(e) => handleEvidenceUpload(question.id, e.target.files)}
                disabled={uploading[question.id]}
              />
              {uploading[question.id] ? (
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {uploading[question.id]
                  ? `Enviando... ${uploadProgress[question.id] || 0}%`
                  : 'Clic para subir archivos'}
              </p>
              {uploading[question.id] && uploadProgress[question.id] > 0 && (
                <Progress value={uploadProgress[question.id]} className="mt-3 h-2" />
              )}
            </label>
            <div className="grid gap-2">
              {((answers[question.id] as EvidenceFile[]) || []).map((file) => (
                <div
                  key={file.url}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm truncate hover:underline"
                  >
                    {file.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeEvidence(question.id, file.url)}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFinalizeDialog = () => (
    <Dialog
      open={finalizeDialogOpen}
      onOpenChange={(open) => {
        if (!open) handleFinalizeNo();
        else setFinalizeDialogOpen(true);
      }}
    >
      <DialogContent className="max-w-md">
        {finalizeDialogStep === 'ask' ? (
          <>
            <DialogHeader>
              <DialogTitle>¿Ya finalizó el proceso?</DialogTitle>
              <DialogDescription>
                Si el mystery ya terminó, podemos registrar la fecha de cierre.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleFinalizeNo} className="flex-1">
                No, continuar
              </Button>
              <Button onClick={handleFinalizeYes} className="flex-1">
                Sí, finalizó
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Fecha de término</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Label htmlFor="finalize-fecha">Fecha</Label>
              <Input
                id="finalize-fecha"
                type="date"
                value={finalizeFecha}
                onChange={(e) => setFinalizeFecha(e.target.value)}
                className="mt-2"
              />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setFinalizeDialogStep('ask')} disabled={finalizing}>
                Volver
              </Button>
              <Button onClick={handleFinalizeSubmit} disabled={finalizing || !finalizeFecha}>
                {finalizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Enviar y cerrar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  const renderThankYouScreen = () => (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-0 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl">¡Muchas gracias por responder!</CardTitle>
          <CardDescription className="text-base">
            Sus respuestas fueron registradas correctamente. Agradecemos su tiempo y
            colaboración.
          </CardDescription>
        </CardHeader>
        {code && (
          <CardContent className="text-center pb-8">
            <p className="text-sm text-muted-foreground">
              Código: <span className="font-mono font-medium text-foreground">{code}</span>
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );

  const renderFinalizedScreen = () => {
    const fechaFin = (answers['fecha-fin'] as string) || '';
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Proceso cerrado</CardTitle>
            <CardDescription className="text-base">
              El formulario fue finalizado y no acepta más respuestas.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-2 pb-8">
            {code && (
              <p className="text-sm text-muted-foreground">
                Código: <span className="font-mono font-medium text-foreground">{code}</span>
              </p>
            )}
            {fechaFin && (
              <p className="text-sm">
                Fecha de término:{' '}
                <span className="font-medium">
                  {new Date(fechaFin + 'T12:00:00').toLocaleDateString('es-AR')}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderStageGateBanner = () => {
    if (!showStatusBanner || !currentStageStatus) return null;

    const rejectionMessage = stages[sectionId]?.rejectionMessage;
    const statusStyles = {
      aprobada: 'bg-green-50 text-green-800 border-green-200',
      en_revision: 'bg-amber-50 text-amber-800 border-amber-200',
      rechazada: 'bg-red-50 text-red-800 border-red-200',
    }[currentStageStatus];

    const StatusIcon =
      currentStageStatus === 'aprobada' ? Check : currentStageStatus === 'en_revision' ? Clock : AlertCircle;

    return (
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        <div className={cn('text-sm rounded-lg p-4 border', statusStyles)}>
          <div className="flex items-center gap-2 font-medium mb-1">
            <StatusIcon className="w-4 h-4 shrink-0" />
            &quot;{section.title}&quot; está {STAGE_STATUS_TEXT[currentStageStatus]}
          </div>
          {currentStageStatus === 'rechazada' && rejectionMessage && (
            <div className="rounded-md border border-red-300/60 bg-red-100/40 p-3 mb-2">
              <p className="font-medium text-red-900 mb-1">Motivo del rechazo:</p>
              <p className="text-red-900/90 whitespace-pre-wrap">{rejectionMessage}</p>
            </div>
          )}
          {currentStageStatus !== 'rechazada' && (
            <p className="text-sm opacity-80">Complete la siguiente parte cuando corresponda.</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {nextSectionTitle && currentStageStatus !== 'rechazada' && (
            <Button onClick={goToNextStage} className="flex-1">
              Ir a: {nextSectionTitle}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          <Button variant="outline" onClick={openResponsesForEdit} className="flex-1">
            <Eye className="w-4 h-4 mr-2" />
            Ver respuestas
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (surveyThankYou) return renderThankYouScreen();
  if (isFinalized) return renderFinalizedScreen();

  const hideForm = showStageGate && (currentStageStatus === 'aprobada' || currentStageStatus === 'en_revision');
  const showBottomNext = !hideForm;
  const isLastModule = isLastVisibleModule(section, currentModuleIndex, answers);
  const progressiveQuestions = currentModule
    ? getProgressiveQuestions(currentModule, answers)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {renderFinalizeDialog()}

      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {code ? `${code} · ` : ''}
              {section.title}
              {currentModule && visibleModules.length > 1 && (
                <span className="text-muted-foreground font-normal">
                  {' '}
                  — {currentModule.title}
                </span>
              )}
            </span>
            <span className="text-muted-foreground">{Math.round(sectionProgress)}%</span>
          </div>
          <Progress value={moduleProgress} className="h-2" />
        </div>
      </div>

      {(showStageGate || showStatusBanner) && renderStageGateBanner()}

      {showStatusBanner && !showStageGate && hasSectionEdits && (
        <div className="max-w-2xl mx-auto px-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Modificó respuestas. Al continuar, la parte se enviará nuevamente a revisión.
          </p>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex justify-center gap-2 flex-wrap">
          {surveySections.map((s, index) => (
            <button
              key={s.id}
              onClick={() => setCurrentSection(index)}
              className={cn(
                'w-3 h-3 rounded-full transition-all',
                index === currentSection
                  ? 'bg-primary scale-125'
                  : stages[s.id]?.status === 'aprobada'
                  ? 'bg-green-500'
                  : stages[s.id]?.status === 'en_revision'
                  ? 'bg-amber-400'
                  : stages[s.id]?.status === 'rechazada'
                  ? 'bg-red-400'
                  : index < currentSection
                  ? 'bg-primary/50'
                  : 'bg-muted-foreground/30'
              )}
              title={s.title}
            />
          ))}
        </div>
      </div>

      {!hideForm && currentModule && (
        <div className="max-w-2xl mx-auto px-4 pb-32">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">{currentModule.title}</CardTitle>
              {currentModule.description && (
                <CardDescription className="text-base whitespace-pre-wrap">
                  {currentModule.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {progressiveQuestions.map(renderQuestion)}
              {!currentModuleComplete && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Complete todas las preguntas para continuar.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {hideForm && <div className="pb-32" />}

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
        <div className="max-w-2xl mx-auto px-4 py-4 flex gap-3">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={currentSection === 0 && currentModuleIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>

          {showBottomNext && (
            <Button
              onClick={goToNext}
              className="flex-1"
              disabled={saving || !currentModuleComplete}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isLastModule && isReviewable && shouldSubmitForReview
                ? 'Enviar parte a revisión'
                : isLastModule && currentSection === totalSections - 1
                ? shouldSubmitForReview
                  ? 'Enviar parte a revisión'
                  : 'Finalizar'
                : 'Siguiente'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
