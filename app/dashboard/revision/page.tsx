'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ResponseDetails,
  REVISION_STATUS_LABELS,
  STAGE_STATUS_COLORS,
} from '@/components/dashboard/ResponseDetails';
import {
  adminGetResponses,
  adminReviewStage,
  adminUnlockSurvey,
  adminUpdateAnswers,
} from '@/lib/data';
import { getSectionTitle, REVIEWABLE_SECTIONS } from '@/lib/survey-config';
import { PAISES } from '@/lib/survey-config/constants';
import { getScreeningSnapshot } from '@/lib/survey-snapshot';
import { AnswerValue, StageStatus, SurveyResponse } from '@/lib/types';
import { Eye, Building2, MapPin, Clock, Loader2, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function displayName(r: SurveyResponse) {
  return (
    r.nombreApellido ||
    [r.nombre, r.apellido].filter(Boolean).join(' ') ||
    'Sin nombre'
  );
}

function pendingStageIds(r: SurveyResponse): string[] {
  return REVIEWABLE_SECTIONS.filter(
    (id) => r.stages?.[id]?.status === 'en_revision'
  );
}

function getStageBadgeLabel(sectionId: string, status: StageStatus): string {
  const title = getSectionTitle(sectionId);
  const statusLabel = REVISION_STATUS_LABELS[status] || status;
  return `${title} · ${statusLabel}`;
}

export default function RevisionPage() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SurveyResponse | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [filterNombre, setFilterNombre] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterId, setFilterId] = useState('');
  const [filterEtapa, setFilterEtapa] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterPais, setFilterPais] = useState('all');

  const load = async () => {
    try {
      const all = await adminGetResponses();
      setResponses(all);
    } catch {
      toast.error('Error al cargar postulantes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredResponses = useMemo(() => {
    const nombre = filterNombre.trim().toLowerCase();
    const empresa = filterEmpresa.trim().toLowerCase();
    const id = filterId.trim().toLowerCase();

    return responses.filter((r) => {
      const snapshot = getScreeningSnapshot(r.answers);
      const name = displayName(r).toLowerCase();
      const codeOrId = (r.code || r.id).toLowerCase();
      const stageEntries = REVIEWABLE_SECTIONS.map((sectionId) => ({
        sectionId,
        status: r.stages?.[sectionId]?.status as StageStatus | undefined,
      })).filter((e) => e.status);

      const matchesNombre = !nombre || name.includes(nombre);
      const matchesEmpresa =
        !empresa || (snapshot.marca || '').toLowerCase().includes(empresa);
      const matchesId =
        !id || codeOrId.includes(id) || r.id.toLowerCase().includes(id);
      const matchesEtapa =
        filterEtapa === 'all' ||
        stageEntries.some((e) => e.sectionId === filterEtapa);
      const matchesEstado =
        filterEstado === 'all' ||
        stageEntries.some((e) => e.status === filterEstado);
      const matchesPais =
        filterPais === 'all' || snapshot.paisCode === filterPais;

      return (
        matchesNombre &&
        matchesEmpresa &&
        matchesId &&
        matchesEtapa &&
        matchesEstado &&
        matchesPais
      );
    });
  }, [responses, filterNombre, filterEmpresa, filterId, filterEtapa, filterEstado, filterPais]);

  const filteredPendingStages = useMemo(
    () => filteredResponses.reduce((sum, r) => sum + pendingStageIds(r).length, 0),
    [filteredResponses]
  );

  const handleReview = async (
    sectionId: string,
    action: 'aprobar' | 'rechazar',
    reviewFlags?: import('@/lib/types').ReviewFlagsMap
  ) => {
    if (!selected) return;
    setActionLoading(sectionId);
    try {
      const updated = await adminReviewStage(
        selected.id,
        sectionId,
        action,
        'Ops',
        undefined,
        reviewFlags
      );
      setSelected(updated);
      setResponses((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );

      toast.success(
        action === 'aprobar'
          ? `Etapa "${getSectionTitle(sectionId)}" aprobada`
          : `Correcciones enviadas en "${getSectionTitle(sectionId)}"`
      );
    } catch {
      toast.error('No se pudo procesar la revisión');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveAnswers = async (answersDiff: Record<string, AnswerValue>) => {
    if (!selected) return;
    setSaveLoading(true);
    try {
      const updated = await adminUpdateAnswers(selected.id, answersDiff);
      setSelected(updated);
      setResponses((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
      toast.success('Respuestas guardadas');
    } catch {
      toast.error('No se pudieron guardar las respuestas');
    } finally {
      setSaveLoading(false);
    }
  };

  const openDetails = (response: SurveyResponse) => {
    setSelected(response);
    setDetailsOpen(true);
  };

  const handleUnlockSurvey = async () => {
    if (!selected) return;
    setUnlockLoading(true);
    try {
      const updated = await adminUnlockSurvey(selected.id);
      setSelected(updated);
      setResponses((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
      toast.success('Encuesta desbloqueada. El postulante puede editar de nuevo.');
    } catch {
      toast.error('No se pudo desbloquear la encuesta');
    } finally {
      setUnlockLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold tracking-tight">Revisión</h1>
          <p className="text-muted-foreground text-sm">
            {loading
              ? 'Cargando...'
              : `${filteredResponses.length} de ${responses.length} postulante${responses.length !== 1 ? 's' : ''} · ${filteredPendingStages} etapa${filteredPendingStages !== 1 ? 's' : ''} pendiente${filteredPendingStages !== 1 ? 's' : ''} de revisar`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Input
            placeholder="Nombre"
            value={filterNombre}
            onChange={(e) => setFilterNombre(e.target.value)}
            className="h-9 w-full sm:w-36"
          />
          <Input
            placeholder="Empresa"
            value={filterEmpresa}
            onChange={(e) => setFilterEmpresa(e.target.value)}
            className="h-9 w-full sm:w-36"
          />
          <Input
            placeholder="ID"
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            className="h-9 w-full sm:w-28"
          />
          <Select value={filterEtapa} onValueChange={setFilterEtapa}>
            <SelectTrigger className="h-9 w-full sm:w-44">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las etapas</SelectItem>
              {REVIEWABLE_SECTIONS.map((sectionId) => (
                <SelectItem key={sectionId} value={sectionId}>
                  {getSectionTitle(sectionId)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="h-9 w-full sm:w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="en_revision">En revisión</SelectItem>
              <SelectItem value="aprobada">Aprobada</SelectItem>
              <SelectItem value="rechazada">Rechazada</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPais} onValueChange={setFilterPais}>
            <SelectTrigger className="h-9 w-full sm:w-44">
              <Filter className="w-4 h-4 mr-2 shrink-0" />
              <SelectValue placeholder="País" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los países</SelectItem>
              {PAISES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : responses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-medium mb-1">Sin postulantes</h3>
            <p className="text-muted-foreground text-center">
              No hay postulantes registrados en el sistema.
            </p>
          </CardContent>
        </Card>
      ) : filteredResponses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <p className="text-muted-foreground text-center">
              No hay resultados con los filtros seleccionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredResponses.map((response) => {
            const snapshot = getScreeningSnapshot(response.answers);
            const stageBadges = REVIEWABLE_SECTIONS.map((sectionId) => {
              const status = response.stages?.[sectionId]?.status as StageStatus | undefined;
              if (!status) return null;
              return { sectionId, status };
            }).filter(Boolean) as { sectionId: string; status: StageStatus }[];

            return (
              <Card key={response.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="font-semibold text-base">{displayName(response)}</h3>
                        <p className="text-xs text-muted-foreground">
                          {response.code ? `ID: ${response.code}` : `ID: ${response.id}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {stageBadges.length > 0 ? (
                          stageBadges.map(({ sectionId, status }) => (
                            <Badge
                              key={sectionId}
                              variant="outline"
                              className={cn(
                                'text-xs py-0.5',
                                STAGE_STATUS_COLORS[status]
                              )}
                            >
                              {getStageBadgeLabel(sectionId, status)}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs py-0.5 text-muted-foreground">
                            Sin etapas iniciadas
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          {snapshot.marca || '-'}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {snapshot.pais ? (
                            <span className="inline-flex flex-col">
                              <span>{snapshot.pais}</span>
                              {snapshot.region && (
                                <span className="text-[10px] text-muted-foreground/80">
                                  {snapshot.region}
                                </span>
                              )}
                            </span>
                          ) : (
                            '-'
                          )}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          {new Date(response.updatedAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => openDetails(response)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Detalles
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-6xl w-[96vw] sm:max-w-6xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-2xl">
              {selected ? displayName(selected) : 'Detalles'}
            </DialogTitle>
            <DialogDescription className="text-base">
              {selected?.code ? `ID: ${selected.code}` : selected ? `ID: ${selected.id}` : ''}
              {selected &&
                (() => {
                  const snapshot = getScreeningSnapshot(selected.answers);
                  return (
                    <>
                      {snapshot.marca ? ` · ${snapshot.marca}` : ''}
                      {snapshot.pais
                        ? ` · ${snapshot.pais}${snapshot.region ? `, ${snapshot.region}` : ''}`
                        : ''}
                    </>
                  );
                })()}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <ResponseDetails
              response={selected}
              mode="revision"
              showStageActions
              allowEditAnswers
              actionLoading={actionLoading}
              saveLoading={saveLoading}
              unlockLoading={unlockLoading}
              onUnlockSurvey={handleUnlockSurvey}
              onApproveStage={(sectionId) => handleReview(sectionId, 'aprobar')}
              onSendCorrections={(sectionId, flags) =>
                handleReview(sectionId, 'rechazar', flags)
              }
              onSaveAnswers={handleSaveAnswers}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
