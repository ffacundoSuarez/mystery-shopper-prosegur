import { redirect } from 'next/navigation';

// La vista pública del cliente ahora está en /resultados
export default function AprobadasRedirect() {
  redirect('/resultados');
}
