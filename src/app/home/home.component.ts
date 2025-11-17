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
  addDoc,
  query,
  where
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
  // ASIGNAR ESPECIALIDAD A MÉDICO
  // ===========================
  async asignarEspecialidad(index: number) {
    const u = this.usuarios[index];
    if (!u || u.rol !== 'medico') return;

    const especialidadesDisponibles = ['Clínica', 'Pediatría', 'Dermatología', 'Cardiología', 'Neurología'];

    const { value: nuevaEspecialidad } = await Swal.fire({
      title: `Asignar especialidad a ${u.nombre}`,
      input: 'select',
      inputOptions: especialidadesDisponibles.reduce((acc, esp) => {
        acc[esp] = esp;
        return acc;
      }, {} as Record<string, string>),
      inputValue: u.especialidad || '',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
    });

    if (!nuevaEspecialidad) return;

    try {
      const ref = doc(this.firestore, 'usuarios', u.uid);
      await updateDoc(ref, { especialidad: nuevaEspecialidad });

      this.usuarios[index].especialidad = nuevaEspecialidad;
      Swal.fire('Éxito', `Especialidad asignada a ${u.nombre}`, 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo asignar la especialidad.', 'error');
    }
  }

  // ===========================
  // REASIGNAR TURNOS A UN MÉDICO (ADMIN)
  // ===========================
  async reasignarTurnosAMedico(index: number) {
    const u = this.usuarios[index];
    if (!u || u.rol !== 'medico') return;

    if (!confirm(`¿Reasignar todos los turnos de la especialidad "${u.especialidad}" a ${u.nombre}? Esto actualizará el campo uidMedico en los turnos.`)) return;

    try {
      const turnosSnap = await getDocs(
        query(collection(this.firestore as any, 'turnos'), where('especialidad', '==', u.especialidad))
      );

      let actualizado = 0;
      for (const docSnap of turnosSnap.docs) {
        const data: any = docSnap.data();
        // Solo actualizar si no coincide
        if (!data.uidMedico || data.uidMedico !== u.uid) {
          const ref = doc(this.firestore, 'turnos', docSnap.id);
          await updateDoc(ref, { uidMedico: u.uid });
          actualizado++;
        }
      }

      Swal.fire('Hecho', `Se reasignaron ${actualizado} turnos a ${u.nombre}.`, 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudieron reasignar los turnos.', 'error');
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
    const diasAGenerar = 14;

    const db = getFirestore();

    // Obtener todos los médicos para ver qué especialidades existen
    const todosLosMedicosSnap = await getDocs(
      query(collection(db, 'usuarios'), where('rol', '==', 'medico'))
    );
    const todosLosMedicos = todosLosMedicosSnap.docs.map(doc => ({
      uid: doc.id,
      ...(doc.data() as any)
    }));

    console.log('🏥 Médicos encontrados en la BD:', todosLosMedicos.length, todosLosMedicos.map(m => ({ uid: m.uid, nombre: m.nombre, especialidad: m.especialidad })));

    // Extraer especialidades únicas que tienen los médicos
    const especialidadesExistentes = Array.from(
      new Set(
        todosLosMedicos
          .map(m => m.especialidad)
          .filter(e => e && typeof e === 'string' && e.trim().length > 0)
      )
    ) as string[];

    console.log('🔬 Especialidades encontradas en médicos:', especialidadesExistentes);

    if (especialidadesExistentes.length === 0) {
      Swal.fire('Advertencia', 'No hay médicos con especialidades asignadas. Asigna especialidades a los médicos primero.', 'warning');
      return;
    }

    for (const especialidad of especialidadesExistentes) {
      // Obtener todos los médicos con esta especialidad
      const medicosSnap = await getDocs(
        query(
          collection(db, 'usuarios'),
          where('rol', '==', 'medico'),
          where('especialidad', '==', especialidad)
        )
      );

      const medicos = medicosSnap.docs.map(docSnap => ({
        uid: docSnap.id,
        ...docSnap.data()
      }));

      console.log(`📋 Médicos para especialidad "${especialidad}":`, medicos.length, medicos.map(m => ({ uid: m.uid, nombre: (m as any).nombre })));

      if (medicos.length === 0) {
        console.warn(`No hay médicos para la especialidad ${especialidad}`);
        continue;
      }

      const hoy = new Date();
      let fechasGeneradas = 0;
      let diasContados = 0;
      let dayOffset = 0; // controla qué médico inicia ese día

      while (fechasGeneradas < diasAGenerar) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() + diasContados);
        const diaSemana = fecha.getDay();

        // Saltar sábados (6) y domingos (0)
        if (diaSemana !== 0 && diaSemana !== 6) {
          const fechaStr = fecha.toISOString().split('T')[0];

          // Calcular el índice inicial para este día (rotación cíclica)
          const startIndex = dayOffset % medicos.length;

          // Crear un turno para cada horario de este día
          for (let i = 0; i < horarios.length; i++) {
            const medicoIndex = (startIndex + i) % medicos.length;
            const medicoSeleccionado = medicos[medicoIndex];

            const turno: Turno = {
              fecha: fechaStr,
              hora: horarios[i],
              especialidad: especialidad,
              estado: 'disponible',
              uidMedico: medicoSeleccionado.uid
            };

            const turnosRef = collection(db, 'turnos');
            await addDoc(turnosRef, turno);
          }

          fechasGeneradas++;
          dayOffset++; // Al día siguiente, la rotación comienza con el siguiente médico
        }

        diasContados++;
      }
    }

    // Recargar turnos después de generar
    const turnosSnap = await getDocs(collection(db, 'turnos'));
    this.turnos = turnosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Turno[];
    this.turnosFiltrados = [...this.turnos];

    Swal.fire('Éxito', 'Turnos generados correctamente con asignación de médicos', 'success');
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
