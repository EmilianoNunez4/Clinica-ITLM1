import { Component, OnInit, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  doc,
  updateDoc,
  getDocs,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { getAuth, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';


interface Turno {
  id: string;
  estado: string;
  fecha: string;
  hora: string;
  especialidad: string;
  nombrePaciente?: string;
  uidMedico?: string;
  uidPaciente?: string;
  observacion?: string;
}

@Component({
  selector: 'app-medico',
  templateUrl: './medico.component.html',
  styleUrls: ['./medico.component.scss']
})
export class MedicoComponent implements OnInit {

  private firestore = inject(Firestore);
  private auth = inject(Auth);

  turnosActivos: Turno[] = [];
  turnosAtendidos: Turno[] = [];

  uid: string = '';
  nombre: string = '';
  especialidadMedico: string = '';

  verHistorial = false;
  usuarioActual: any = null;
  removingTurnos: Set<string> = new Set();
  processingTurnos: Set<string> = new Set();

  filtroEstadoTurno: string = '';

  pageSizeActivos: number = 30;
  paginaActualActivos: number = 1;

  constructor(private router: Router) {}

  get turnosActivosFiltradosBase(): Turno[] {
    if (!this.filtroEstadoTurno) {
      return this.turnosActivos;
    }
    return this.turnosActivos.filter(t => t.estado === this.filtroEstadoTurno);
  }

  get totalPaginasActivos(): number {
    const total = this.turnosActivosFiltradosBase.length;
    return total > 0 ? Math.ceil(total / this.pageSizeActivos) : 1;
  }

  get turnosActivosFiltrados(): Turno[] {
    const inicio = (this.paginaActualActivos - 1) * this.pageSizeActivos;
    const fin = inicio + this.pageSizeActivos;
    return this.turnosActivosFiltradosBase.slice(inicio, fin);
  }

  async ngOnInit() {
    const authInstance = getAuth();

    onAuthStateChanged(authInstance, async (user: User | null) => {
      if (user) {
        this.uid = user.uid;
        this.usuarioActual = user;

        await this.cargarPerfil();
        await this.cargarTurnos();
      } else {
        this.uid = '';
        this.usuarioActual = null;
        this.turnosActivos = [];
        this.turnosAtendidos = [];
      }
    });
  }

  async cargarPerfil() {
    const usuariosRef = collection(this.firestore, 'usuarios');
    const qUsers = query(usuariosRef, where('uid', '==', this.uid));
    const snapshot = await getDocs(qUsers);

    snapshot.forEach((docSnap) => {
      const data: any = docSnap.data();
      this.nombre = data.nombre;
      this.especialidadMedico = data.especialidad || '';
    });

    console.log('👨‍⚕️ Médico:', this.nombre, 'Especialidad:', this.especialidadMedico);
  }

  async cargarTurnos() {
    if (!this.especialidadMedico) {
      console.warn('⚠️ Médico sin especialidad, no se pueden filtrar turnos.');
      this.turnosActivos = [];
      this.turnosAtendidos = [];
      return;
    }

    const turnosRef = collection(this.firestore, 'turnos');
    const qTurnos = query(
      turnosRef,
      where('especialidad', '==', this.especialidadMedico)
    );
    const snapshot = await getDocs(qTurnos);

    console.log('📌 Turnos con especialidad =', this.especialidadMedico, '->', snapshot.size);

    const todosLosTurnos: Turno[] = snapshot.docs.map((docSnap) => {
      const data: any = docSnap.data();

      const fecha =
        data.fecha instanceof Timestamp
          ? data.fecha.toDate().toISOString().split('T')[0]
          : data.fecha;

      const nombrePaciente = data.nombrePaciente ?? data.paciente ?? null;
      const uidPaciente = data.uidPaciente ?? null;


      const mapped: any = {
        id: docSnap.id,
        ...data,
        fecha,
        nombrePaciente,
        uidPaciente,
        observacion: data.observacion ?? ''
      };

  return mapped as Turno;
}) as Turno[];

    todosLosTurnos.sort((a, b) => {
      const f = a.fecha.localeCompare(b.fecha);
      return f !== 0 ? f : a.hora.localeCompare(b.hora);
    });

    this.turnosActivos   = todosLosTurnos.filter(t => t.estado !== 'atendido');
    this.turnosAtendidos = todosLosTurnos.filter(t => t.estado === 'atendido');

    if (this.paginaActualActivos > this.totalPaginasActivos) {
      this.paginaActualActivos = 1;
    }

    console.log('🔎 turnos totales:', todosLosTurnos.length);
    console.log('🔹 activos:', this.turnosActivos.length);
    console.log('🔸 atendidos:', this.turnosAtendidos.length);
  }

  onFiltroEstadoChange(valor: string) {
    this.filtroEstadoTurno = valor;
    this.paginaActualActivos = 1;
  }

  irPaginaActivos(delta: number) {
    const nueva = this.paginaActualActivos + delta;
    if (nueva < 1 || nueva > this.totalPaginasActivos) return;
    this.paginaActualActivos = nueva;
  }

  async cambiarEstado(turnoId: string, nuevoEstado: string) {
    const turnoRef = doc(this.firestore, 'turnos', turnoId);
    await updateDoc(turnoRef, { estado: nuevoEstado });
    await this.cargarTurnos();
  }

  async marcarAtendido(turno: Turno) {
  console.log("Botón de marcar como atendido clickeado");  // Agregar este log
  if (!turno?.id) return;

  if (turno.estado !== 'reservado') {
    await Swal.fire({
      icon: 'info',
      title: 'No se puede marcar como atendido',
      text: 'Solo los turnos reservados pueden marcarse como atendidos.',
      confirmButtonColor: '#00509e',
    });
    return;
  }

  const { value: obs, isConfirmed } = await Swal.fire({
    title: 'Cerrar consulta',
    text: 'Podés dejar una observación sobre la consulta (opcional).',
    input: 'textarea',
    inputValue: turno.observacion || '',
    inputPlaceholder: 'Escribí aquí notas sobre la consulta...',
    inputAttributes: {
      'aria-label': 'Escribí aquí notas sobre la consulta'
    },
    showCancelButton: true,
    confirmButtonText: 'Marcar como atendido',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#0d6efd',
    cancelButtonColor: '#6c757d',
    width: 600
  });

  if (!isConfirmed) return;

  const id = turno.id;

  this.removingTurnos.add(id);
  this.processingTurnos.add(id);

  setTimeout(async () => {
    try {
      const turnoRef = doc(this.firestore, 'turnos', id);

      await updateDoc(turnoRef, {
        estado: 'atendido',
        observacion: obs || ''
      });

      this.turnosActivos = this.turnosActivos.filter(t => t.id !== id);

      const atendido: Turno = {
        ...turno,
        estado: 'atendido',
        observacion: obs || ''
      };

      this.turnosAtendidos = [atendido, ...this.turnosAtendidos].sort((a, b) => {
        const fechaCmp = a.fecha.localeCompare(b.fecha);
        return fechaCmp !== 0 ? fechaCmp : a.hora.localeCompare(b.hora);
      });

      await Swal.fire({
        icon: 'success',
        title: 'Turno marcado como atendido',
        timer: 1300,
        showConfirmButton: false
      });

    } catch (err) {
      console.error('Error marcando turno como atendido', err);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo marcar el turno como atendido.',
        confirmButtonColor: '#b00020',
      });
    } finally {
      this.removingTurnos.delete(id);
      this.processingTurnos.delete(id);
    }
  }, 360);
}

  async cancelarTurnoMedico(turno: Turno) {
  if (!turno?.id) return;

  const confirmar = confirm(
    `¿Cancelar el turno del ${turno.fecha} a las ${turno.hora}?`
  );
  if (!confirmar) return;

  try {
    const turnoRef = doc(this.firestore, 'turnos', turno.id);
    await updateDoc(turnoRef, {
      estado: 'disponible',
      nombrePaciente: null,
      paciente: null,
      uidPaciente: null,
    });

    await this.cargarTurnos();
  } catch (err) {
    console.error('Error al cancelar turno desde médico:', err);
  }

}

  cerrarSesion() {
    const auth = getAuth();
    signOut(auth).then(() => {
      localStorage.removeItem('usuarioActual');
      this.router.navigate(['/auth']);
    });
  }
} 