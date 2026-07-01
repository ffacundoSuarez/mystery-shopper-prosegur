'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  adminCreatePostulante,
  adminDeletePostulante,
  adminListPostulantes,
} from '@/lib/data';
import { PAISES } from '@/lib/survey-config/constants';
import { getPartProgressLabel, getScreeningSnapshot } from '@/lib/survey-snapshot';
import { PostulanteSummary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Copy,
  Filter,
  Link as LinkIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

function getSurveyUrl(accessToken: string) {
  if (typeof window === 'undefined') return `/encuesta/${accessToken}`;
  return `${window.location.origin}/encuesta/${accessToken}`;
}

export default function PostulantesPage() {
  const [postulantes, setPostulantes] = useState<PostulanteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PostulanteSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPais, setFilterPais] = useState('all');

  const load = async () => {
    try {
      setPostulantes(await adminListPostulantes());
    } catch {
      toast.error('Error al cargar postulantes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return postulantes.filter((p) => {
      const snapshot = getScreeningSnapshot(p.answers);
      const name =
        p.nombreApellido || [p.nombre, p.apellido].filter(Boolean).join(' ') || '';
      const matchesSearch =
        term === '' ||
        name.toLowerCase().includes(term) ||
        (p.code || '').toLowerCase().includes(term) ||
        (snapshot.marca || '').toLowerCase().includes(term) ||
        (snapshot.pais || '').toLowerCase().includes(term);
      const matchesPais =
        filterPais === 'all' || snapshot.paisCode === filterPais;
      return matchesSearch && matchesPais;
    });
  }, [postulantes, searchTerm, filterPais]);

  const handleCreate = async () => {
    if (!nombre.trim() || !apellido.trim()) {
      toast.error('Completá nombre y apellido');
      return;
    }
    setCreating(true);
    try {
      const created = await adminCreatePostulante(nombre.trim(), apellido.trim());
      setPostulantes((prev) => [created, ...prev]);
      setDialogOpen(false);
      setNombre('');
      setApellido('');
      toast.success(`Postulante ${created.code} creado`);
    } catch {
      toast.error('No se pudo crear el postulante');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDeletePostulante(deleteTarget.id);
      setPostulantes((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success(`Postulante ${deleteTarget.code || deleteTarget.id} eliminado`);
      setDeleteTarget(null);
    } catch {
      toast.error('No se pudo eliminar el postulante');
    } finally {
      setDeleting(false);
    }
  };

  const copyLink = async (accessToken?: string) => {
    if (!accessToken) return;
    await navigator.clipboard.writeText(getSurveyUrl(accessToken));
    toast.success('Link copiado al portapapeles');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Postulantes</h1>
          <p className="text-muted-foreground">
            {loading
              ? 'Cargando...'
              : `${filtered.length} de ${postulantes.length} postulante${postulantes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo postulante
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Generador de links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 px-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, ID, país o marca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterPais} onValueChange={setFilterPais}>
              <SelectTrigger className="w-full sm:w-48">
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

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : postulantes.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Todavía no hay postulantes. Creá uno para generar su link de encuesta.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No hay postulantes que coincidan con los filtros.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 pl-6 font-medium">ID</th>
                    <th className="text-left p-3 font-medium">Nombre</th>
                    <th className="text-left p-3 font-medium">País</th>
                    <th className="text-left p-3 font-medium">Marca</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Categoría</th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">Progreso</th>
                    <th className="text-left p-3 font-medium hidden xl:table-cell">Link</th>
                    <th className="text-right p-3 pr-6 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const snapshot = getScreeningSnapshot(p.answers);
                    const progress = getPartProgressLabel(p.stages, p.answers);
                    const displayName =
                      p.nombreApellido ||
                      [p.nombre, p.apellido].filter(Boolean).join(' ') ||
                      '-';

                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3 pl-6 font-mono font-medium whitespace-nowrap">
                          {p.code}
                        </td>
                        <td className="p-3 whitespace-nowrap">{displayName}</td>
                        <td className="p-3">
                          {snapshot.hasScreening ? (
                            <span className="inline-flex flex-col">
                              <span>{snapshot.pais}</span>
                              {snapshot.region && (
                                <span className="text-xs text-muted-foreground">
                                  {snapshot.region}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {snapshot.marca ? (
                            <span className="inline-flex flex-col">
                              <span>{snapshot.marca}</span>
                              {snapshot.canal && (
                                <span className="text-xs text-muted-foreground">
                                  {snapshot.canal}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          {snapshot.categoria || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 hidden lg:table-cell text-muted-foreground whitespace-nowrap">
                          {progress}
                        </td>
                        <td className="p-3 hidden xl:table-cell max-w-[12rem]">
                          <span className="text-muted-foreground truncate block">
                            {p.accessToken ? getSurveyUrl(p.accessToken) : '-'}
                          </span>
                        </td>
                        <td className="p-3 pr-6">
                          <div className="flex justify-end items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyLink(p.accessToken)}
                              disabled={!p.accessToken}
                            >
                              <Copy className="w-4 h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Copiar</span>
                            </Button>
                            {p.accessToken && (
                              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                                <a
                                  href={getSurveyUrl(p.accessToken)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <LinkIcon className="w-4 h-4 mr-1" />
                                  Abrir
                                </a>
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="px-2">
                                  <MoreHorizontal className="w-4 h-4" />
                                  <span className="sr-only">Más acciones</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {p.accessToken && (
                                  <DropdownMenuItem asChild className="sm:hidden">
                                    <a
                                      href={getSurveyUrl(p.accessToken)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <LinkIcon className="w-4 h-4 mr-2" />
                                      Abrir encuesta
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => setDeleteTarget(p)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo postulante</DialogTitle>
            <DialogDescription>
              Se generará un ID (PS-xxx) y un link único de encuesta.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellido">Apellido</Label>
              <Input
                id="apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="Apellido"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear postulante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar postulante</DialogTitle>
            <DialogDescription>
              ¿Eliminar a{' '}
              <strong>
                {deleteTarget?.code} ·{' '}
                {[deleteTarget?.nombre, deleteTarget?.apellido].filter(Boolean).join(' ') ||
                  'Sin nombre'}
              </strong>
              ? Se borrará el registro y su link dejará de funcionar. Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
