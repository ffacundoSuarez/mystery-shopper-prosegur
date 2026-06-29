'use client';

import { useEffect, useState } from 'react';
import {
  adminCreatePostulante,
  adminDeletePostulante,
  adminListPostulantes,
} from '@/lib/data';
import { PostulanteSummary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Link as LinkIcon,
  Loader2,
  MoreHorizontal,
  Plus,
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
              : `${postulantes.length} postulante${postulantes.length !== 1 ? 's' : ''} registrado${postulantes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo postulante
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Generador de links
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : postulantes.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Todavía no hay postulantes. Creá uno para generar su link de encuesta.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-4 font-medium">ID</th>
                    <th className="text-left p-4 font-medium">Nombre</th>
                    <th className="text-left p-4 font-medium">Apellido</th>
                    <th className="text-left p-4 font-medium">Link de encuesta</th>
                    <th className="text-right p-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {postulantes.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-4 font-mono font-medium">{p.code}</td>
                      <td className="p-4">{p.nombre || '-'}</td>
                      <td className="p-4">{p.apellido || '-'}</td>
                      <td className="p-4">
                        <span className="text-muted-foreground truncate max-w-xs inline-block">
                          {p.accessToken ? getSurveyUrl(p.accessToken) : '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyLink(p.accessToken)}
                            disabled={!p.accessToken}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copiar
                          </Button>
                          {p.accessToken && (
                            <Button variant="outline" size="sm" asChild>
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
                  ))}
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
