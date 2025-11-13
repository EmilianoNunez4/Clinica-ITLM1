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
import { environment } from '../../environments/environment';

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

  // 🔹 INICIO
  async ngOnInit() {
    const auth = getAuth();

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        this.router.navigate(['/auth']);
        return;
      }

      const userRef = doc(db, 'usuarios', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        signOut(auth);
        this.router.navigate(['/auth']);
        return;
      }
      this.usuario = userData;

      this.usuario = userSnap.data();

      const usuariosSnap = await getDocs(collection(db, 'usuarios'));
      this.usuarios = usuariosSnap.docs.map((d) => d.data());

      const turnosSnap = await getDocs(collection(db, 'turnos'));
      this.turnos = turnosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Turno[];
      this.turnosFiltrados = [...this.turnos];

      if (this.usuario?.rol === 'paciente') {
        this.misTurnos = this.turnos.filter((t) => t.paciente === this.usuario.nombre);
      }
    });
  }

  // 🔹 Cerrar sesión
  async logout() {
    const auth = getAuth();
    await signOut(auth);
    this.router.navigate(['/auth']);
  }

async editarCampo(index: number, campo: keyof Turno) {
  const db = getFirestore();
  const t = this.turnos[index];

  // 🔹 Configurar títulos dinámicos
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

  // 🔹 Mostrar SweetAlert
  const { value: nuevoValor } = await Swal.fire({
    title: titulos[campo],
    input: 'text',
    inputPlaceholder: place[campo],
    inputValue: t[campo] as string,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#00509e',
    cancelButtonColor: '#999',
    background: '#f4f6f9',
  });

  // 🔹 Si se cancela o no se ingresa nada
  if (!nuevoValor) return;

  // 🔹 Actualizar local y en Firestore
  try {
    t[campo] = nuevoValor as any;
    this.turnos[index] = t;

    const turnoRef = doc(db, 'turnos', t.id!);
    await updateDoc(turnoRef, { [campo]: nuevoValor });

    await Swal.fire({
      icon: 'success',
      title: 'Actualizado',
      text: `${campo} del turno actualizado correctamente.`,
      confirmButtonColor: '#00509e',
    });
  } catch (err) {
    console.error(err);
    await Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Ocurrió un error al actualizar el turno.',
      confirmButtonColor: '#b00020',
    });
  }
}


  // 🔹 Cambiar rol de usuario
  async cambiarRol(index: number) {
    const order = ['paciente', 'medico', 'admin'];
    const u = this.usuarios[index];
    if (!u) return alert('Error: Usuario no encontrado.');

    if (!u.rol || !order.includes(u.rol)) u.rol = 'paciente';

    const currentRol = u.rol;
    const nextRol = order[(order.indexOf(currentRol) + 1) % order.length];

    if (
      currentRol === 'admin' &&
      nextRol !== 'admin' &&
      this.usuarios.filter(x => x.rol === 'admin').length === 1
    ) {
      return alert('Debe quedar al menos un administrador.');
    }

    u.rol = nextRol;
    this.usuarios[index] = u;

    try {
      const userRef = doc(this.firestore, 'usuarios', u.uid);
      await updateDoc(userRef, { rol: nextRol });
      if (this.usuario?.uid === u.uid) {
        this.usuario.rol = nextRol;
        localStorage.setItem('usuarioActual', JSON.stringify(this.usuario));
      }
      alert(`Rol cambiado a "${nextRol}"`);
    } catch (error) {
      console.error('Error al cambiar rol:', error);
    }
  }

  // 🔹 Dar de baja usuario
  async darBaja(index: number) {
    const u = this.usuarios[index];
    if (!u) return alert('Error: usuario no encontrado.');
    if (!confirm(`¿Dar de baja a ${u.nombre || u.email}?`)) return;

    try {
      const docId = u.uid || u.id;
      if (!docId) return alert('No se encontró el ID del usuario.');
      const userRef = doc(this.firestore, 'usuarios', docId);
      await updateDoc(userRef, { activo: false, estado: 'inactivo' });
      this.usuarios[index] = { ...u, activo: false, estado: 'inactivo' };

      if (this.usuario?.uid === docId) {
        await signOut(getAuth());
        this.router.navigate(['/auth']);
        alert('Tu cuenta fue dada de baja.');
      } else {
        alert(`${u.nombre || u.email} fue dado de baja correctamente.`);
      }
    } catch (err) {
      console.error('Error al dar de baja usuario:', err);
    }
  }

  // 🔹 Reactivar usuario
  async reactivarUsuario(index: number) {
    const u = this.usuarios[index];
    if (!u) return alert('Error: usuario no encontrado.');
    if (!confirm(`¿Reactivar a ${u.nombre || u.email}?`)) return;

    try {
      const docId = u.uid || u.id;
      if (!docId) return alert('No se encontró el ID del usuario.');
      const userRef = doc(this.firestore, 'usuarios', docId);
      await updateDoc(userRef, { activo: true, estado: 'activo' });
      this.usuarios[index] = { ...u, activo: true, estado: 'activo' };
      alert(`${u.nombre || u.email} fue reactivado correctamente.`);
    } catch (err) {
      console.error('Error al reactivar usuario:', err);
    }
  }

  // 🔹 Generar turnos
  async generarTurnos() {
    const horarios = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30'];
    const especialidades = ['Clínica', 'Pediatría', 'Dermatología'];
    const turnos: any[] = [];
    const hoy = new Date();

    for (let d = 0; d < 14; d++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + d);
      const fechaStr = fecha.toISOString().split('T')[0];
      const especialidadDelDia = especialidades[d % especialidades.length];

      for (const hora of horarios) {
        turnos.push({
          fecha: fechaStr,
          hora,
          especialidad: especialidadDelDia,
          estado: 'disponible',
        });
      }
    }

    this.turnos = turnos;
    this.turnosFiltrados = [...turnos];

    const turnosRef = collection(this.firestore, 'turnos');
    try {
      for (const turno of this.turnos) await addDoc(turnosRef, turno);
      alert('✅ Turnos generados correctamente.');
    } catch (error) {
      console.error('Error al guardar los turnos:', error);
    }
  }
  
  // 🔹 Filtros
  filtrarTurnos() {
    const especialidad = this.filtroEspecialidad.toLowerCase().trim();
    const fecha = this.filtroFecha;

    this.turnosFiltrados = this.turnos.filter(t => {
      const coincideEspecialidad = !especialidad || t.especialidad.toLowerCase().includes(especialidad);
      const coincideFecha = !fecha || t.fecha === fecha;
      return coincideEspecialidad && coincideFecha;
    });
  }

  limpiarFiltros() {
    this.filtroEspecialidad = '';
    this.filtroFecha = '';
    this.turnosFiltrados = [...this.turnos];
  }

  obtenerFechasUnicas(turnos: Turno[]): string[] {
    const fechas = turnos.map(t => t.fecha);
    return [...new Set(fechas)].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }

  obtenerTurnosPorFecha(fecha: string, turnos: Turno[]): Turno[] {
    return turnos.filter(t => t.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora));
  }
}


  toggleFecha(fecha: string) {
    this.fechaSeleccionada = this.fechaSeleccionada === fecha ? null : fecha;
  }
}

