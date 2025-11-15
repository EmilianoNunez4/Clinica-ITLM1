import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  Firestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  getFirestore,
  getDoc,
  setDoc,
  updateDoc,
  addDoc
} from '@angular/fire/firestore';
import Swal from 'sweetalert2';

interface Turno {
  id?: string;
  fecha: string;
  hora: string;
  especialidad: string;
  estado: string;
  paciente?: string | null;
  uidMedico?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {

  usuario: any = null;
  usuarios: any[] = [];
  turnos: Turno[] = [];
  turnosFiltrados: Turno[] = [];
  misTurnos: Turno[] = [];
  fechaSeleccionada: string | null = null;

  filtroEspecialidad: string = '';
  filtroFecha: string = '';
  seccionActiva: string = 'usuarios';

  constructor(private firestore: Firestore, private router: Router) {}

  // ===========================
  // INIT
  // ===========================
  async ngOnInit() {
    const auth = getAuth();
    const db = getFirestore();

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        this.router.navigate(['/auth']);
        return;
      }

      // Obtener usuario
      const userRef = doc(db, 'usuarios', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await signOut(auth);
        this.router.navigate(['/auth']);
        return;
      }

      this.usuario = userSnap.data();

      // Obtener lista de usuarios
      const usuariosSnap = await getDocs(collection(db, 'usuarios'));
      this.usuarios = usuariosSnap.docs.map((d) => d.data());

      // Obtener turnos
      const turnosSnap = await getDocs(collection(db, 'turnos'));
      this.turnos = turnosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Turno[];
      this.turnosFiltrados = [...this.turnos];

      if (this.usuario?.rol === 'paciente') {
        this.misTurnos = this.turnos.filter(t => t.paciente === this.usuario.nombre);
      }
    });
  }

  // ===========================
  // LOGOUT
  // ===========================
  async logout() {
    const auth = getAuth();
    await signOut(auth);
    this.router.navigate(['/auth']);
  }

  // ===========================
  // EDITAR CAMPO TURNO
  // ===========================
  async editarCampo(index: number, campo: keyof Turno) {
    const db = getFirestore();
    const turno = this.turnos[index];

    const titulos: any = {
      fecha: 'Editar Fecha',
      hora: 'Editar Horario',
      especialidad: 'Editar Especialidad',
      estado: 'Editar Estado',
    };

    const place: any = {
      fecha: 'YYYY-MM-DD',
      hora: 'HH:MM',
      especialidad: 'Clínica / Pediatría / Dermatología',
      estado: 'disponible / reservado / cancelado',
    };

    const { value: nuevoValor } = await Swal.fire({
      title: titulos[campo],
      input: 'text',
      inputPlaceholder: place[campo],
      inputValue: turno[campo] as string,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
    });

    if (!nuevoValor) return;

    try {
      turno[campo] = nuevoValor as any;

      const ref = doc(db, 'turnos', turno.id!);
      await updateDoc(ref, { [campo]: nuevoValor });

      Swal.fire('Actualizado', `${campo} editado correctamente.`, 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo actualizar.', 'error');
    }
  }

  // ===========================
  // CAMBIAR ROL USUARIO
  // ===========================
  async cambiarRol(index: number) {
    const order = ['paciente', 'medico', 'admin'];
    const u = this.usuarios[index];
    if (!u) return alert('Usuario no encontrado.');

    const currentRol = u.rol || 'paciente';
    const nextRol = order[(order.indexOf(currentRol) + 1) % order.length];

    const admins = this.usuarios.filter(x => x.rol === 'admin');

    if (currentRol === 'admin' && admins.length === 1 && nextRol !== 'admin') {
      return alert('Debe quedar al menos un administrador.');
    }

    u.rol = nextRol;

    try {
      const ref = doc(this.firestore, 'usuarios', u.uid);
      await updateDoc(ref, { rol: nextRol });

      if (this.usuario?.uid === u.uid) {
        this.usuario.rol = nextRol;
        localStorage.setItem('usuarioActual', JSON.stringify(this.usuario));
      }

      alert(`Rol cambiado a ${nextRol}`);
    } catch (err) {
      console.error(err);
    }
  }

  // ===========================
  // DAR DE BAJA
  // ===========================
  async darBaja(index: number) {
    const u = this.usuarios[index];
    if (!u) return;

    if (!confirm(`¿Dar de baja a ${u.nombre}?`)) return;

    try {
      const ref = doc(this.firestore, 'usuarios', u.uid);
      await updateDoc(ref, { activo: false, estado: 'inactivo' });

      this.usuarios[index] = { ...u, activo: false, estado: 'inactivo' };
      alert('Usuario dado de baja');
    } catch (err) {
      console.error(err);
    }
  }

  // ===========================
  // REACTIVAR USUARIO
  // ===========================
  async reactivarUsuario(index: number) {
    const u = this.usuarios[index];
    if (!u) return;

    if (!confirm(`¿Reactivar a ${u.nombre}?`)) return;

    try {
      const ref = doc(this.firestore, 'usuarios', u.uid);
      await updateDoc(ref, { activo: true, estado: 'activo' });

      this.usuarios[index] = { ...u, activo: true, estado: 'activo' };
      alert('Usuario reactivado');
    } catch (err) {
      console.error(err);
    }
  }

  // ===========================
  // GENERAR TURNOS
  // ===========================
  async generarTurnos() {
    const horarios = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30'];
    const especialidades = ['Clínica', 'Pediatría', 'Dermatología'];

    const turnos: Turno[] = [];
    const hoy = new Date();

    for (let d = 0; d < 14; d++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + d);
      const fechaStr = fecha.toISOString().split('T')[0];

      for (const hora of horarios) {
        turnos.push({
          fecha: fechaStr,
          hora,
          especialidad: especialidades[d % especialidades.length],
          estado: 'disponible',
        });
      }
    }

    this.turnos = turnos;
    this.turnosFiltrados = [...turnos];

    const turnosRef = collection(this.firestore, 'turnos');

    try {
      for (const t of turnos) await addDoc(turnosRef, t);
      alert('Turnos generados');
    } catch (err) {
      console.error(err);
    }
  }

  // ===========================
  // FILTROS
  // ===========================
  filtrarTurnos() {
    this.turnosFiltrados = this.turnos.filter(t => {
      const matchFecha = !this.filtroFecha || t.fecha === this.filtroFecha;
      const matchEspecialidad =
        !this.filtroEspecialidad ||
        t.especialidad.toLowerCase().includes(this.filtroEspecialidad.toLowerCase());

      return matchFecha && matchEspecialidad;
    });
  }

  limpiarFiltros() {
    this.filtroFecha = '';
    this.filtroEspecialidad = '';
    this.turnosFiltrados = [...this.turnos];
  }

  obtenerFechasUnicas(turnos: Turno[]): string[] {
    return [...new Set(turnos.map(t => t.fecha))].sort();
  }

  obtenerTurnosPorFecha(fecha: string, turnos: Turno[]): Turno[] {
    return turnos.filter(t => t.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora));
  }

  // ===========================
  // TOGGLE FECHA (ARREGLADO)
  // ===========================
  toggleFecha(fecha: string) {
    this.fechaSeleccionada =
      this.fechaSeleccionada === fecha ? null : fecha;
  }
}
