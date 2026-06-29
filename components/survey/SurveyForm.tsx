'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  surveySections,
  getResumeSectionIndex,
  getSectionTitle,
  getNextReviewableSection,
} from '@/lib/survey-config';
import { AnswerValue, EvidenceFile, Question, StageStatus, StagesMap } from '@/lib/types';
import { getResponseByToken, saveStageByToken, uploadEvidence, finalizeProcessByToken } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STAGE_STATUS_TEXT: Record<StageStatus, string> = {
  pendiente: 'pendente',
  en_revision: 'em revisão',
  aprobada: 'aprovada',
  rechazada: 'reprovada',
};

// Compara respuestas de una sección para detectar ediciones
function sectionAnswersEqual(
  a: Record<string, AnswerValue>,
  b: Record<string, AnswerValue>
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ¿La etapa de postulación ya fue enviada al menos una vez?
function isPostulacionCompleted(stages: StagesMap): boolean {
  const status = stages.postulacion?.status;
  return status === 'en_revision' || status === 'aprobada' || status === 'rechazada';
}

type FinalizeDialogStep = 'ask' | 'date';

export function SurveyForm({ accessToken }: { accessToken: string }) {
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [stages, setStages] = useState<StagesMap>({});
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** Cartel de estado (aprobada/en revisión): oculta el formulario hasta "Ver respuestas" */
  const [showStageGate, setShowStageGate] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  /** Snapshot al entrar a la sección: solo re-envía a revisión si hubo cambios */
  const [sectionBaseline, setSectionBaseline] = useState<Record<string, AnswerValue>>({});
  /** Cartel al ingresar: ¿ya finalizó el proceso? */
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [finalizeDialogStep, setFinalizeDialogStep] = useState<FinalizeDialogStep>('ask');
  const [finalizeFecha, setFinalizeFecha] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  const isFinalized = answers['proceso-finalizado'] === 'si';

  const totalSections = surveySections.length;
  const progress = ((currentSection + 1) / totalSections) * 100;
  const section = surveySections[currentSection];
  const sectionId = section.id;
  const currentStageStatus = stages[sectionId]?.status as StageStatus | undefined;
  const isGeneral = sectionId === 'general';
  const isReviewable = !isGeneral;

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
      const sectionAnswers: Record<string, AnswerValue> = {};
      for (const q of sec.questions) {
        if (source[q.id] !== undefined) {
          sectionAnswers[q.id] = source[q.id];
        }
      }
      return sectionAnswers;
    },
    [answers]
  );

  const hasSectionEdits = useMemo(() => {
    if (isGeneral) return false;
    return !sectionAnswersEqual(getSectionAnswers(sectionId), sectionBaseline);
  }, [answers, sectionBaseline, sectionId, isGeneral, getSectionAnswers]);

  // ¿La sección actual tiene al menos una respuesta cargada por el postulante?
  // (opción elegida, texto, fecha, escala o evidencia subida)
  const currentSectionHasAnswer = useMemo(() => {
    return section.questions.some((q) => {
      const v = answers[q.id];
      if (v === undefined || v === null || v === '') return false;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    });
  }, [answers, section]);

  // ¿Hay que enviar esta etapa a revisión al avanzar?
  const shouldSubmitForReview = useMemo(() => {
    if (isGeneral) return false;
    // No enviar a revisión una etapa vacía: requiere al menos una respuesta
    if (!currentSectionHasAnswer) return false;
    if (!currentStageStatus || currentStageStatus === 'pendiente') return true;
    if (currentStageStatus === 'rechazada') return hasSectionEdits;
    // aprobada o en_revision: solo si editó algo
    return hasSectionEdits;
  }, [isGeneral, currentStageStatus, hasSectionEdits, currentSectionHasAnswer]);

  const showStatusBanner =
    isReviewable &&
    currentStageStatus &&
    currentStageStatus !== 'pendiente';

  // Cargar encuesta
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const existing = await getResponseByToken(accessToken);
        if (!active) return;
        if (existing) {
          setAnswers(existing.answers || {});
          setStages(existing.stages || {});
          setCode(existing.code || '');
          setCurrentSection(getResumeSectionIndex(existing.stages || {}));
        }
      } catch {
        toast.error('Não foi possível carregar o formulário');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken]);

  // Al ingresar: si ya completó postulación y no finalizó, preguntar una vez
  useEffect(() => {
    if (loading) return;
    if (answers['proceso-finalizado'] === 'si') return;
    if (!isPostulacionCompleted(stages)) return;
    setFinalizeDialogOpen(true);
    setFinalizeDialogStep('ask');
    // Solo al cargar la encuesta (reingreso)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Al cambiar de sección: baseline + cartel si aprobada/en revisión
  useEffect(() => {
    if (loading) return;
    setSectionBaseline(getSectionAnswers(sectionId, answers));

    if (isReviewable) {
      const status = stages[sectionId]?.status;
      setShowStageGate(status === 'aprobada' || status === 'en_revision');
    } else {
      setShowStageGate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection, loading]);

  const shouldShowQuestion = useCallback(
    (question: Question): boolean => {
      if (!question.showIf) return true;
      const dependent = answers[question.showIf.questionId];
      if (!dependent) return false;
      if (Array.isArray(dependent)) {
        return question.showIf.values.some((v) =>
          (dependent as string[]).includes(v)
        );
      }
      return question.showIf.values.includes(dependent as string);
    },
    [answers]
  );

  const updateAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const toggleMultipleChoice = (questionId: string, value: string) => {
    const current = (answers[questionId] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateAnswer(questionId, updated);
  };

  const handleEvidenceUpload = async (
    questionId: string,
    files: FileList | null
  ) => {
    if (isFinalized) return;
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
      toast.success('Arquivo enviado com sucesso');
    } catch {
      toast.error('Erro ao enviar o arquivo');
    } finally {
      setUploading((p) => ({ ...p, [questionId]: false }));
      setUploadProgress((p) => ({ ...p, [questionId]: 0 }));
    }
  };

  const removeEvidence = (questionId: string, url: string) => {
    const current = (answers[questionId] as EvidenceFile[]) || [];
    updateAnswer(
      questionId,
      current.filter((f) => f.url !== url)
    );
  };

  const advanceToNextSection = () => {
    if (currentSection < totalSections - 1) {
      setCurrentSection((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const saveCurrentSection = async (advance: boolean, submitReview: boolean) => {
    if (isFinalized) return;
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
        toast.success(`Etapa "${section.title}" enviada para revisão`);
        // No avanzamos automáticamente: mostramos el bloque de estado (gate)
        // para que el postulante decida avanzar a la siguiente etapa o ver
        // sus respuestas. Es el mismo bloque que aparece al reingresar.
        setShowStageGate(true);
        return;
      }

      if (advance) advanceToNextSection();
    } catch {
      toast.error('Não foi possível salvar a etapa');
    } finally {
      setSaving(false);
    }
  };

  const goToNextSection = async () => {
    if (shouldSubmitForReview) {
      await saveCurrentSection(true, true);
      return;
    }

    // Sin cambios en etapa ya enviada/aprobada: solo avanzar
    if (isGeneral) {
      await saveCurrentSection(true, false);
      return;
    }

    advanceToNextSection();
  };

  const goToPreviousSection = () => {
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

  const openResponsesForEdit = () => {
    setShowStageGate(false);
  };

  const handleFinalizeNo = () => {
    setFinalizeDialogOpen(false);
    setFinalizeDialogStep('ask');
    setFinalizeFecha('');
  };

  const handleFinalizeYes = () => {
    setFinalizeDialogStep('date');
  };

  const handleFinalizeSubmit = async () => {
    if (!finalizeFecha) {
      toast.error('Indique a data de término do processo');
      return;
    }
    setFinalizing(true);
    try {
      const updated = await finalizeProcessByToken(accessToken, finalizeFecha);
      setAnswers(updated.answers || {});
      setStages(updated.stages || {});
      setFinalizeDialogOpen(false);
      toast.success('Processo finalizado com sucesso');
    } catch {
      toast.error('Não foi possível finalizar o processo');
    } finally {
      setFinalizing(false);
    }
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
              <DialogTitle>Você já finalizou o processo?</DialogTitle>
              <DialogDescription>
                Se o processo seletivo já terminou para você, podemos registrar a data de
                encerramento e fechar o formulário.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleFinalizeNo} className="flex-1">
                Não, continuar
              </Button>
              <Button onClick={handleFinalizeYes} className="flex-1">
                Sim, finalizou
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Data de término do processo</DialogTitle>
              <DialogDescription>
                Indique em qual data o processo seletivo terminou para você.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Label htmlFor="finalize-fecha">Data</Label>
              <Input
                id="finalize-fecha"
                type="date"
                value={finalizeFecha}
                onChange={(e) => setFinalizeFecha(e.target.value)}
                className="mt-2"
              />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setFinalizeDialogStep('ask')}
                disabled={finalizing}
              >
                Voltar
              </Button>
              <Button onClick={handleFinalizeSubmit} disabled={finalizing || !finalizeFecha}>
                {finalizing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Enviar e encerrar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
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
            <CardTitle className="text-2xl">Processo encerrado</CardTitle>
            <CardDescription className="text-base">
              O formulário foi finalizado e não aceita mais respostas.
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
                Data de término:{' '}
                <span className="font-medium">
                  {new Date(fechaFin + 'T12:00:00').toLocaleDateString('pt-BR')}
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
      currentStageStatus === 'aprobada'
        ? Check
        : currentStageStatus === 'en_revision'
        ? Clock
        : AlertCircle;

    return (
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        <div className={cn('text-sm rounded-lg p-4 border', statusStyles)}>
          <div className="flex items-center gap-2 font-medium mb-1">
            <StatusIcon className="w-4 h-4 shrink-0" />
            A etapa &quot;{section.title}&quot; está{' '}
            {STAGE_STATUS_TEXT[currentStageStatus]}
          </div>
          {currentStageStatus === 'rechazada' && (
            <>
              {rejectionMessage && (
                <div className="rounded-md border border-red-300/60 bg-red-100/40 p-3 mb-2">
                  <p className="font-medium text-red-900 mb-1">Motivo da reprovação:</p>
                  <p className="text-red-900/90 whitespace-pre-wrap">{rejectionMessage}</p>
                </div>
              )}
              <p className="opacity-90 mb-2">
                Corrija as informações e envie novamente quando estiver pronto.
              </p>
            </>
          )}
          {currentStageStatus !== 'rechazada' && (
            <p className="text-sm opacity-80">
              Complete a próxima etapa quando já a tiver realizado.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {nextSectionTitle && currentStageStatus !== 'rechazada' && (
            <Button onClick={goToNextStage} className="flex-1">
              Avançar para a etapa: {nextSectionTitle}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          <Button
            variant="outline"
            onClick={openResponsesForEdit}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-2" />
            Ver respostas
          </Button>
        </div>
      </div>
    );
  };

  const renderQuestion = (question: Question) => {
    if (!shouldShowQuestion(question)) return null;
    const options = question.options || [];

    return (
      <div key={question.id} className="space-y-3">
        <Label className="text-base font-medium leading-relaxed">
          {question.text}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {question.hint && (
          <p className="text-sm text-muted-foreground">{question.hint}</p>
        )}

        {question.type === 'single' && options.length > 0 && (
          <RadioGroup
            value={(answers[question.id] as string) || ''}
            onValueChange={(value) => updateAnswer(question.id, value)}
            className="grid gap-2"
          >
            {options.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                  answers[question.id] === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                )}
              >
                <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} />
                <span className="flex-1 text-sm">{option.label}</span>
              </label>
            ))}
          </RadioGroup>
        )}

        {question.type === 'multiple' && options.length > 0 && (
          <div className="grid gap-2">
            {options.map((option) => {
              const isChecked = ((answers[question.id] as string[]) || []).includes(
                option.value
              );
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
            placeholder="Escreva sua resposta..."
          />
        )}

        {question.type === 'longtext' && (
          <Textarea
            value={(answers[question.id] as string) || ''}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder="Escreva sua resposta..."
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
            placeholder="0"
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
                      onClick={() => updateAnswer(question.id, value)}
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
                  : 'Clique para enviar qualquer arquivo (PDF, áudio, vídeo, imagem, etc.)'}
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isFinalized) {
    return renderFinalizedScreen();
  }

  const hideForm = showStageGate && (currentStageStatus === 'aprobada' || currentStageStatus === 'en_revision');
  const showBottomNext = !hideForm;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {renderFinalizeDialog()}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {code ? `${code} · ` : ''}Seção {currentSection + 1} de {totalSections}
            </span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Cartel de estado + avance (aprobada / en revisión / rechazada) */}
      {(showStageGate || showStatusBanner) && renderStageGateBanner()}

      {showStatusBanner && !showStageGate && hasSectionEdits && (
        <div className="max-w-2xl mx-auto px-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Você modificou respostas. Ao continuar, a etapa será enviada novamente para revisão.
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

      {!hideForm && (
        <div className="max-w-2xl mx-auto px-4 pb-32">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">{section.title}</CardTitle>
              {section.description && (
                <CardDescription className="text-base">{section.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {section.questions.map(renderQuestion)}
            </CardContent>
          </Card>
        </div>
      )}

      {hideForm && <div className="pb-32" />}

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
        <div className="max-w-2xl mx-auto px-4 py-4 flex gap-3">
          <Button
            variant="outline"
            onClick={goToPreviousSection}
            disabled={currentSection === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          {showBottomNext &&
            (currentSection === totalSections - 1 ? (
              <Button
                onClick={() => saveCurrentSection(false, shouldSubmitForReview)}
                className="flex-1"
                disabled={saving || !shouldSubmitForReview}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {shouldSubmitForReview
                  ? 'Enviar etapa para revisão'
                  : isReviewable && !currentSectionHasAnswer
                  ? 'Preencha algo para enviar'
                  : 'Etapa sem alterações'}
              </Button>
            ) : (
              <Button onClick={goToNextSection} className="flex-1" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {shouldSubmitForReview
                  ? 'Próximo'
                  : isReviewable && !currentSectionHasAnswer
                  ? 'Pular etapa'
                  : 'Próxima etapa'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}
