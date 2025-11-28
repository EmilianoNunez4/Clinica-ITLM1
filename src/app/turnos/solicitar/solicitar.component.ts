import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

@Component({
  selector: 'app-solicitar',
  templateUrl: './solicitar.component.html',
  styleUrls: ['./solicitar.component.scss']
})
export class SolicitarComponent implements OnInit {
  usuario: any = null;
  turnos: any[] = [];
  filtrados: any[] = [];
  especialidades: string[] = [];
  misTurnos: any[] = [];

  // 🔹 Paginación de turnos disponibles
  pageSize: number = 20;       // cantidad de turnos por página
  currentPage: number = 1;     // página actual

  get totalPages(): number {
    return this.filtrados.length
      ? Math.ceil(this.filtrados.length / this.pageSize)
      : 1;
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  constructor(private router: Router) {}

  async ngOnInit() {
    const auth = getAuth();
    const db = getFirestore();

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        this.router.navigate(['/auth']);
        return;
      }

      // Obtener usuario actual desde Firestore
      const usuariosSnap = await getDocs(collection(db, 'usuarios'));
      const allUsers = usuariosSnap.docs.map((d) => d.data());
      this.usuario = allUsers.find((u) => u['email'] === user.email);

      // Cargar turnos
      const turnosSnap = await getDocs(collection(db, 'turnos'));
      this.turnos = turnosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Filtrar solo disponibles
      this.filtrados = this.turnos.filter((t) => t.estado === 'disponible');

      // Turnos reservados por este paciente
      this.misTurnos = this.turnos.filter(
        (t) => t.paciente === this.usuario?.nombre
      );

      // Especialidades únicas
      this.especialidades = Array.from(
        new Set(this.turnos.map((t) => t.especialidad))
      );

      // 👇 Arrancamos siempre en la primera página
      this.currentPage = 1;
    });
  }

  // 🔹 Ir a una página específica
  irAPagina(p: number) {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  // 🔹 Filtrar por especialidad
  filtrarPorEspecialidad(event: Event) {
    const select = event.target as HTMLSelectElement | null;
    const valor = select?.value || 'todos';

    if (valor === 'todos') {
      this.filtrados = this.turnos.filter((t) => t.estado === 'disponible');
    } else {
      this.filtrados = this.turnos.filter(
        (t) => t.especialidad === valor && t.estado === 'disponible'
      );
    }

    // 👇 Cada vez que filtrás, volvés a la página 1
    this.currentPage = 1;
  }

  // 🔹 Reservar turno
  async reservarTurno(index: number) {
    const db = getFirestore();
    const turno = this.filtrados[index];

    if (
      !confirm(
        `¿Confirmar turno de ${turno.fecha} a las ${turno.hora} (${turno.especialidad})?`
      )
    )
      return;

    try {
      const turnoRef = doc(db, 'turnos', turno.id);

      // Si el turno no tiene uidMedico asignado, lo resolvemos
      let uidMedicoToAssign = turno.uidMedico || null;
      if (!uidMedicoToAssign) {
        const medicosSnap = await getDocs(
          query(collection(db, 'usuarios'), where('rol', '==', 'medico'))
        );
        const medicosAll = medicosSnap.docs.map((d) => ({
          uid: d.id,
          ...(d.data() as any)
        }));

        const normalize = (s: string) =>
          s
            ?.normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            .trim();

        const medicos = medicosAll.filter(
          (m) => normalize(m.especialidad || '') === normalize(turno.especialidad || '')
        );

        if (medicos.length > 0) {
          const horarios = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30'];
          const dayIndex = Math.floor(
            new Date(turno.fecha).getTime() / 86400000
          );
          const slotIndex = Math.max(0, horarios.indexOf(turno.hora));
          const chosen = medicos[(dayIndex + slotIndex) % medicos.length];
          uidMedicoToAssign = chosen.uid;
        }
      }

      const updatePayload: any = {
        estado: 'reservado',
        paciente: this.usuario.nombre
      };
      if (uidMedicoToAssign) updatePayload.uidMedico = uidMedicoToAssign;

      await updateDoc(turnoRef, updatePayload);

      // Actualizar local (MISMA LÓGICA)
      this.turnos = this.turnos.map((t) =>
        t.id === turno.id
          ? {
              ...t,
              estado: 'reservado',
              paciente: this.usuario.nombre,
              uidMedico: uidMedicoToAssign || t.uidMedico
            }
          : t
      );
      this.filtrados = this.turnos.filter((t) => t.estado === 'disponible');
      this.misTurnos = this.turnos.filter(
        (t) => t.paciente === this.usuario.nombre
      );

      // Ajustar página actual (por si quedó fuera de rango)
      this.currentPage = Math.min(this.currentPage, this.totalPages);

      alert('✅ Turno reservado correctamente');
    } catch (error: any) {
      console.error(error);
      alert('❌ Error al reservar el turno: ' + error.message);
    }
  }

  // 🔹 Cancelar turno
  async cancelarTurno(index: number) {
    const db = getFirestore();
    const t = this.misTurnos[index];

    if (!confirm(`¿Cancelar turno del ${t.fecha} a las ${t.hora}?`)) return;

    try {
      const turnoRef = doc(db, 'turnos', t.id);
      await updateDoc(turnoRef, { estado: 'disponible', paciente: null });

      // Actualizar local (MISMA LÓGICA)
      this.misTurnos.splice(index, 1);
      this.turnos = this.turnos.map((x) =>
        x.id === t.id ? { ...x, estado: 'disponible', paciente: null } : x
      );
      this.filtrados = this.turnos.filter((x) => x.estado === 'disponible');

      // Ajustar página
      this.currentPage = Math.min(this.currentPage, this.totalPages);

      alert('🟢 Turno cancelado correctamente');
    } catch (error: any) {
      console.error(error);
      alert('❌ Error al cancelar turno: ' + error.message);
    }
  }

  volver() {
    this.router.navigate(['/home']);
  }
}