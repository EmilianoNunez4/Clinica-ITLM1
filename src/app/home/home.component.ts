import { Component, OnInit, LOCALE_ID } from '@angular/core';
import { Router } from '@angular/router';
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { Firestore, collection, getDocs, deleteDoc, doc, getFirestore, getDoc, setDoc, updateDoc, addDoc, query, where } from '@angular/fire/firestore';
import Swal from 'sweetalert2';

import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
registerLocaleData(localeEs);

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

  filtroRol: string = '';
  filtroEspecialidadUsuario: string = '';
  usuariosFiltrados: any[] = [];
  especialidadesUnicas: string[] = [];

  filtroDni: string = '';

  cerrandoSesion: boolean = false;
  cargando: boolean = true;
  logoutEnProgreso: boolean = false;
  cargandoTurnos: boolean = false;

  constructor(private firestore: Firestore, private router: Router) {}
  
  async ngOnInit() {
    const auth = getAuth();

    onAuthStateChanged(auth, async (user) => {

      if (this.logoutEnProgreso) return;

      if (!user) {
        this.usuario = null;
        this.cargando = false;
        return;
      }

      const db = getFirestore();
      const userRef = doc(db, 'usuarios', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        signOut(auth);
        this.usuario = null;
        this.cargando = false;
        return;
      }

      this.usuario = userSnap.data();
      this.cargando = false;

      // USUARIOS
      const usuariosSnap = await getDocs(collection(db, 'usuarios'));
      // 👇 Guardamos también el uid del documento
      this.usuarios = usuariosSnap.docs.map(d => ({
        uid: d.id,
        ...d.data()
      }));
      this.usuariosFiltrados = [...this.usuarios];

      // ESPECIALIDADES ÚNICAS
      this.especialidadesUnicas = Array.from(
        new Set(
          this.usuarios
            .filter(u => u.rol === 'medico' && u.especialidad)
            .map(u => u.especialidad)
        )
      );

      // TURNOS
      const turnosSnap = await getDocs(collection(db, 'turnos'));
      this.turnos = turnosSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Turno[];
      this.turnosFiltrados = [...this.turnos];

      // TURNOS DEL PACIENTE
      if (this.usuario?.rol === 'paciente') {
        this.misTurnos = this.turnos.filter(t => t.paciente === this.usuario.nombre);
      }
    });
  }

  filtrarUsuarios() {
    this.usuariosFiltrados = this.usuarios.filter(u => {

      const coincideRol =
        this.filtroRol === '' || u.rol === this.filtroRol;

      const coincideEsp =
        this.filtroEspecialidadUsuario === '' ||
        (u.rol === 'medico' && u.especialidad === this.filtroEspecialidadUsuario);

      // filtro por DNI
      const dniFiltro = this.filtroDni.trim();
      const coincideDni =
        dniFiltro === '' ||
        
        // filtro cuando no hay dni registrado
        (!u.dni && (dniFiltro === 'na' || dniFiltro === 'n/a' || dniFiltro === 'sin')) ||
        (u.dni && u.dni.toString().includes(dniFiltro));

      return coincideRol && coincideEsp && coincideDni;
    });
  }

  limpiarFiltroUsuarios() {
    this.filtroRol = '';
    this.filtroEspecialidadUsuario = '';
    this.filtroDni = '';               // 🔹 limpiamos también el filtro de DNI
    this.usuariosFiltrados = [...this.usuarios];
  }

  // LOGOUT
  logout() {
    this.logoutEnProgreso = true;   
    this.cerrandoSesion = true;    

    const auth = getAuth();

    signOut(auth).then(() => {
      localStorage.removeItem('usuarioActual');

      setTimeout(() => {
        this.router.navigate(['/auth']);
      }, 1200);
    });
  }

  // ===========================
  // EDITAR CAMPO TURNO
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

  // CAMBIAR ROL USUARIO
  async cambiarRol(index: number) {
    const order = ['paciente', 'medico', 'admin'];
    const u = this.usuarios[index];
    if (!u) {
      Swal.fire('Error', 'Usuario no encontrado.', 'error');
      return;
    }

    const currentRol = u.rol || 'paciente';
    const nextRol = order[(order.indexOf(currentRol) + 1) % order.length];

    const admins = this.usuarios.filter(x => x.rol === 'admin');

    if (currentRol === 'admin' && admins.length === 1 && nextRol !== 'admin') {
      Swal.fire('Advertencia', 'Debe quedar al menos un administrador.', 'warning');
      return;
    }

    const confirm = await Swal.fire({
      title: '¿Cambiar rol?',
      text: `Nuevo rol: ${nextRol}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Cambiar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    try {
      const ref = doc(this.firestore, 'usuarios', u.uid);
      await updateDoc(ref, { rol: nextRol });

      u.rol = nextRol;

      if (this.usuario?.uid === u.uid) {
        this.usuario.rol = nextRol;
        localStorage.setItem('usuarioActual', JSON.stringify(this.usuario));
      }

      Swal.fire('Éxito', `Rol cambiado a ${nextRol}`, 'success');

    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo cambiar el rol.', 'error');
    }
  }

  // ===========================
  // ASIGNAR ESPECIALIDAD A MÉDICO
  // ===========================
  async asignarEspecialidad(index: number) {
    const u = this.usuarios[index];
    if (!u || u.rol !== 'medico') return;

    const especialidadesDisponibles = ['Clínica', 'Pediatría', 'Dermatología'];

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

  // REASIGNAR TURNOS A UN MÉDICO (ADMIN)
  // ===========================
  async reasignarTurnosAMedico(index: number) {
    const u = this.usuarios[index];

    const confirm = await Swal.fire({
      title: '¿Reasignar turnos?',
      text: `Esto reasignará los turnos de la especialidad "${u.especialidad}" al médico ${u.nombre}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Reasignar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    try {
      const turnosSnap = await getDocs(
        query(collection(this.firestore as any, 'turnos'), where('especialidad', '==', u.especialidad))
      );

      let actualizado = 0;

      for (const docSnap of turnosSnap.docs) {
        const data: any = docSnap.data();
        if (!data.uidMedico || data.uidMedico !== u.uid) {
          const ref = doc(this.firestore, 'turnos', docSnap.id);
          await updateDoc(ref, { uidMedico: u.uid });
          actualizado++;
        }
      }

      Swal.fire('Éxito', `Se reasignaron ${actualizado} turnos.`, 'success');

    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudieron reasignar los turnos.', 'error');
    }
  }

  // DAR DE BAJA
  // ===========================
  async darBaja(index: number) {
    const u = this.usuarios[index];

    const confirm = await Swal.fire({
      title: '¿Dar de baja?',
      text: `El usuario ${u.nombre} quedará inactivo.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Dar de baja',
      confirmButtonColor: '#d33',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    try {
      const ref = doc(this.firestore, 'usuarios', u.uid);
      await updateDoc(ref, { activo: false, estado: 'inactivo' });

      this.usuarios[index] = { ...u, activo: false, estado: 'inactivo' };

      Swal.fire('Hecho', 'Usuario dado de baja.', 'success');

    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo dar de baja.', 'error');
    }
  }

  // ===========================
  // REACTIVAR USUARIO
  // ===========================
  async reactivarUsuario(index: number) {
    const u = this.usuarios[index];

    const confirm = await Swal.fire({
      title: '¿Reactivar usuario?',
      text: `${u.nombre} volverá a estar activo.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Reactivar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    try {
      const ref = doc(this.firestore, 'usuarios', u.uid);
      await updateDoc(ref, { activo: true, estado: 'activo' });

      this.usuarios[index] = { ...u, activo: true, estado: 'activo' };

      Swal.fire('Hecho', 'Usuario reactivado.', 'success');

    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo reactivar.', 'error');
    }
  }

  // GENERAR TURNOS (ARREGLADO)
async generarTurnos() {

  Swal.fire({
    title: "Generando turnos...",
    text: "Esto puede tardar unos segundos",
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  this.cargandoTurnos = true;

  try {
    const horarios = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30'];
    const diasAGenerar = 14;
    const db = getFirestore();
    const medicosSnap = await getDocs(
      query(collection(db, 'usuarios'), where('rol', '==', 'medico'))
    );

    const medicos = medicosSnap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }));

    const especialidades = Array.from(
      new Set(medicos.map(m => m.especialidad).filter((e: any) => e))
    );

    if (especialidades.length === 0) {
      Swal.close();
      Swal.fire('Advertencia', 'No hay médicos con especialidades asignadas.', 'warning');
      return;
    }

    const allTurnosSnap = await getDocs(collection(db, 'turnos'));
    const existingKeys = new Set<string>();

    let ultimaFecha: string | null = null;

    allTurnosSnap.docs.forEach(d => {
      const data: any = d.data();
      const key = `${data.fecha}|${data.hora}|${data.especialidad}`;
      existingKeys.add(key);

      if (!ultimaFecha || data.fecha > ultimaFecha) {
        ultimaFecha = data.fecha; // string YYYY-MM-DD
      }
    });

    let fechaInicio: Date;

    if (!ultimaFecha) {
      fechaInicio = new Date();
      fechaInicio.setDate(fechaInicio.getDate() + 1);
    } else {
      fechaInicio = new Date(ultimaFecha);
      fechaInicio.setDate(fechaInicio.getDate() + 1);
    }

    while (fechaInicio.getDay() === 0 || fechaInicio.getDay() === 6) {
      fechaInicio.setDate(fechaInicio.getDate() + 1);
    }

    let diasGenerados = 0;
    let offsetMedico = 0;

    while (diasGenerados < diasAGenerar) {

      const fecha = new Date(fechaInicio);

      const fechaStr = fecha.toISOString().split('T')[0];
      const diaSemana = fecha.getDay();

      if (diaSemana !== 0 && diaSemana !== 6) {

        const especialidad = especialidades[diasGenerados % especialidades.length];
        const medicosEsp = medicos.filter(m => m.especialidad === especialidad);

        if (medicosEsp.length) {
          for (let i = 0; i < horarios.length; i++) {
            const hora = horarios[i];
            const key = `${fechaStr}|${hora}|${especialidad}`;

            if (existingKeys.has(key)) continue;

            const medico = medicosEsp[(offsetMedico + i) % medicosEsp.length];

            const turno: Turno = {
              fecha: fechaStr,
              hora,
              especialidad,
              estado: 'disponible',
              uidMedico: medico.uid
            };

            await addDoc(collection(db, 'turnos'), turno);
            existingKeys.add(key);
          }
        }

        diasGenerados++;
        offsetMedico++;
      }

      fechaInicio.setDate(fechaInicio.getDate() + 1);

      while (fechaInicio.getDay() === 0 || fechaInicio.getDay() === 6) {
        fechaInicio.setDate(fechaInicio.getDate() + 1);
      }
    }

    const turnosSnap2 = await getDocs(collection(db, 'turnos'));
    this.turnos = turnosSnap2.docs.map(d => ({ id: d.id, ...d.data() })) as Turno[];
    this.turnosFiltrados = [...this.turnos];

    Swal.close();
    Swal.fire('Éxito', 'Turnos generados correctamente.', 'success');

  } catch (error) {
    console.error(error);
    Swal.close();
    Swal.fire("Error", "Hubo un problema generando los turnos.", "error");

  } finally {
    this.cargandoTurnos = false;
  }
}


  // FILTROS
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

  toggleFecha(fecha: string) {
    this.fechaSeleccionada = this.fechaSeleccionada === fecha ? null : fecha;
  }

  // CANCELAR TURNO
  async cancelarTurno(index: number) {
    const turno = this.misTurnos[index];
    if (!turno) return;

    const confirmar = await Swal.fire({
      icon: 'warning',
      title: '¿Cancelar turno?',
      text: `¿Estás seguro de cancelar el turno del ${turno.fecha} a las ${turno.hora}?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No',
      confirmButtonTextColor: '#fff',
      confirmButtonColor: '#d33',
    } as any);

    if (!confirmar.isConfirmed) return;

    try {
      const db = getFirestore();
      const turnoRef = doc(db, 'turnos', turno.id!);

      await updateDoc(turnoRef, {
        estado: 'disponible',
        paciente: null
      });

      this.misTurnos.splice(index, 1);
      this.turnos = this.turnos.map(t =>
        t.id === turno.id ? { ...t, estado: 'disponible', paciente: null } : t
      );

      await Swal.fire({
        icon: 'success',
        title: 'Turno cancelado',
        text: 'Tu turno fue cancelado correctamente.',
        confirmButtonColor: '#00509e',
      });

    } catch (error) {
      console.error('Error al cancelar turno:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cancelar el turno.',
        confirmButtonColor: '#b00020',
      });
    }
  }

  irASolicitar() {
    this.router.navigate(['/solicitar-turno']);
  }

  private parseFechaTurno(fechaStr: string): Date | null {
  if (!fechaStr) return null;

  // Formato ISO: YYYY-MM-DD
  if (fechaStr.includes('-')) {
    const [anio, mes, dia] = fechaStr.split('-').map(Number);
    if (!anio || !mes || !dia) return null;
    return new Date(anio, mes - 1, dia);
  }

  // Formato DD/MM/YYYY o YYYY/MM/DD
  if (fechaStr.includes('/')) {
    const partes = fechaStr.split('/');
    if (partes.length === 3) {
      let d: number, m: number, a: number;
      if (partes[0].length === 4) {
        // YYYY/MM/DD
        [a, m, d] = partes.map(Number);
      } else {
        // DD/MM/YYYY
        [d, m, a] = partes.map(Number);
      }
      if (!a || !m || !d) return null;
      return new Date(a, m - 1, d);
    }
  }

  return null;
}

async limpiarTurnosViejos() {
  const hoy = new Date();
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  // 1) Buscar en el array local los turnos disponibles con fecha < hoy
  const aBorrar = this.turnos.filter(t => {
    if (t.estado !== 'disponible') return false;

    const fecha = this.parseFechaTurno(t.fecha);
    if (!fecha) return false;

    const fechaSinHora = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    return fechaSinHora.getTime() < hoySinHora.getTime();
  });

  if (!aBorrar.length) {
    await Swal.fire(
      'Sin turnos viejos',
      'No hay turnos disponibles con fecha anterior a hoy para eliminar.',
      'info'
    );
    return;
  }

  const confirm = await Swal.fire({
    title: 'Eliminar turnos viejos',
    text: `Se eliminarán ${aBorrar.length} turnos disponibles con fecha anterior a hoy.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d33'
  });

  if (!confirm.isConfirmed) return;

  const db = getFirestore();
  let borrados = 0;

  for (const t of aBorrar) {
    if (!t.id) continue;
    await deleteDoc(doc(db, 'turnos', t.id));
    borrados++;
  }

  // 3) Actualizar arrays locales
  this.turnos = this.turnos.filter(t => !aBorrar.includes(t));
  this.turnosFiltrados = this.turnosFiltrados.filter(t => !aBorrar.includes(t));
  this.misTurnos = this.misTurnos.filter(t => !aBorrar.includes(t));

  await Swal.fire(
    'Listo',
    `Se eliminaron ${borrados} turnos viejos disponibles.`,
    'success'
  );
}
}