'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminListResponsesSummary } from '@/lib/data';
import { getSectionTitle } from '@/lib/survey-config';
import { SurveyResponse } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Loader2 } from 'lucide-react';

const PIE_COLORS = ['#FFDE00', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  publicado: 'Publicado',
  rechazado: 'Rechazado',
};

export default function EstadisticasPage() {
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

  const byEmpresa = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of responses) {
      const k = r.empresa || 'Sin empresa';
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [responses]);

  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of responses) {
      const k = STATUS_LABELS[r.status] || r.status;
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [responses]);

  const byEtapa = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of responses) {
      const raw = r.ultimaEtapa || r.answers['ultima-etapa'] as string | undefined;
      const k = raw ? getSectionTitle(raw) : 'Sin etapa';
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [responses]);

  const stageStats = useMemo(() => {
    let pending = 0;
    let inReview = 0;
    let approved = 0;
    let rejected = 0;
    for (const r of responses) {
      for (const st of Object.values(r.stages || {})) {
        if (st.status === 'pendiente') pending++;
        else if (st.status === 'en_revision') inReview++;
        else if (st.status === 'aprobada') approved++;
        else if (st.status === 'rechazada') rejected++;
      }
    }
    return { pending, inReview, approved, rejected };
  }, [responses]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estadísticas</h1>
          <p className="text-muted-foreground">Análisis de los formularios cargados</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Todavía no hay datos para mostrar.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estadísticas</h1>
        <p className="text-muted-foreground">Análisis de los formularios cargados</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total encuestas', value: responses.length },
          { label: 'Etapas en revisión', value: stageStats.inReview },
          { label: 'Etapas aprobadas', value: stageStats.approved },
          { label: 'Etapas rechazadas', value: stageStats.rejected },
        ].map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Formularios por Empresa</CardTitle>
            <CardDescription>Cantidad de procesos por empresa/sucursal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byEmpresa} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Formularios" fill="#FFDE00" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por Estado Global</CardTitle>
            <CardDescription>Estado general de cada encuesta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {byStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Por Última Etapa Alcanzada</CardTitle>
            <CardDescription>Hasta dónde llegó cada mystery shopper</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byEtapa}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Formularios" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
