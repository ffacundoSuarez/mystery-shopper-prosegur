'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminListResponsesSummary } from '@/lib/data';
import { getSectionTitle, REVIEWABLE_SECTIONS } from '@/lib/survey-config';
import { SurveyResponse } from '@/lib/types';
import { ClipboardCheck, FileCheck2, Clock, UserPlus, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setResponses(await adminListResponsesSummary());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = useMemo(() => {
    const realResponses = responses.filter((r) => !r.isPrueba);
    let approvedStages = 0;
    let pendingReviews = 0;
    for (const r of realResponses) {
      for (const sectionId of REVIEWABLE_SECTIONS) {
        const status = r.stages?.[sectionId]?.status;
        if (status === 'en_revision') pendingReviews++;
        else if (status === 'aprobada') approvedStages++;
      }
    }
    return {
      postulantes: realResponses.length,
      pendingReviews,
      approvedStages,
    };
  }, [responses]);

  const stats = [
    {
      title: 'Postulantes',
      value: counts.postulantes,
      description: 'Registrados en el sistema',
      icon: UserPlus,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Etapas en revisión',
      value: counts.pendingReviews,
      description: 'Pendientes de aprobar',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      title: 'Etapas aprobadas',
      value: counts.approvedStages,
      description: 'Visibles en /resultados',
      icon: FileCheck2,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Total registros',
      value: counts.postulantes,
      description: 'Encuestas activas',
      icon: ClipboardCheck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen general del sistema Mystery Shopper Prosegur
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actividad reciente</CardTitle>
          <CardDescription>Últimos postulantes actualizados</CardDescription>
        </CardHeader>
        <CardContent>
          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          ) : (
            <div className="space-y-4">
              {responses.filter((r) => !r.isPrueba).slice(0, 8).map((r) => {
                const pendingStages = Object.entries(r.stages || {}).filter(
                  ([, st]) => st.status === 'en_revision'
                );
                const approvedStages = Object.entries(r.stages || {}).filter(
                  ([, st]) => st.status === 'aprobada'
                );
                const lastApproved = approvedStages[approvedStages.length - 1];

                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {r.code ? `${r.code} · ` : ''}
                        {r.nombreApellido ||
                          [r.nombre, r.apellido].filter(Boolean).join(' ') ||
                          r.id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.empresa || 'Sin empresa'}
                        {r.ciudad ? ` · ${r.ciudad}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground text-right">
                      {pendingStages.length > 0
                        ? `${pendingStages.length} en revisión`
                        : lastApproved
                        ? getSectionTitle(lastApproved[0])
                        : 'Sin etapas'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
