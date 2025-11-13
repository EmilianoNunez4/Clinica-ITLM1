import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { environment} from '../../environments/environment';
import { Firestore, collection, getDocs, deleteDoc, doc, getFirestore, getDoc, setDoc, updateDoc, addDoc} from '@angular/fire/firestore';


interface Turno {
  id?: string;
  fecha: string;
  hora: string;
  especialidad: string;
  estado: string;
  paciente?: string | null;
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
  misTurnos: Turno[] = [];
  fechaSeleccionada: string | null = null;

constructor(private firestore: Firestore, private router: Router) {}


// Crea las conexiones a Firebase Authentication (auth) y Firestore (db) para usarlas dentro de la función
  async ngOnInit() {
    const auth = getAuth();
    const db = getFirestore();

// este oyente Escucha si hay un usuario logueado actualmente. para ver si hay alguien activo o no
    onAuthStateChanged(auth, async (user) => {
// si no esta autenticado lo manda al login
      if (!user) {
        this.router.navigate(['/auth']);
        return;
      }

      // Obtener usuario actual desde Firestore para ver si existe y si no lo manda al login
      const userRef = doc(db, 'usuarios', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        signOut(auth);
        this.router.navigate(['/auth']);
        return;
      }

      this.usuario = userSnap.data();

      // Cargar todos los usuarios
      const usuariosSnap = await getDocs(collection(db, 'usuarios'));
      this.usuarios = usuariosSnap.docs.map((d) => d.data());

      // Cargar todos los turnos
      const turnosSnap = await getDocs(collection(db, 'turnos'));
      this.turnos = turnosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Turno[];

      // Si es paciente, cargar sus turnos reservados
      if (this.usuario?.rol === 'paciente') {
        this.misTurnos = this.turnos.filter((t) => t.paciente === this.usuario.nombre);
      }
    });
  }

  // Cerrar sesión
  async logout() {
    const auth = getAuth();
    await signOut(auth);
    this.router.navigate(['/auth']);
  }

  // Administración de usuarios
async cambiarRol(index: number) {
  const order = ['paciente', 'medico', 'admin'];
  const u = this.usuarios[index];

  // Validar que exista el usuario
  if (!u) {
    console.error('⚠️ Usuario no encontrado en el índice:', index);
    alert('Error: Usuario no encontrado.');
    return;
  }

  // Validar que tenga rol (si no, asignar paciente)
  if (!u.rol || !order.includes(u.rol)) {
    console.warn('⚠️ Usuario sin rol válido, asignando "paciente":', u);
    u.rol = 'paciente';
  }

  // Calcular el siguiente rol en el orden
  const currentRol = u.rol || 'paciente';
  const currentIdx = order.indexOf(currentRol);

  if (currentIdx === -1) {
    console.error(' Rol desconocido:', currentRol, 'en usuario:', u);
    alert('Rol desconocido, no se puede cambiar.');
    return;
  }

  const nextIdx = (currentIdx + 1) % order.length;
  const nextRol = order[nextIdx];

  // Evitar eliminar el último admin
  if (
    currentRol === 'admin' &&
    nextRol !== 'admin' &&
    this.usuarios.filter(x => x.rol === 'admin').length === 1
  ) {
    alert('Debe quedar al menos un administrador.');
    return;
  }

  // Actualizar en memoria
  u.rol = nextRol;
  this.usuarios[index] = u;

  try {
    const userRef = doc(this.firestore, 'usuarios', u.uid);
    await updateDoc(userRef, { rol: nextRol });

    // Si el usuario logueado es el mismo, actualizar localStorage
    if (this.usuario?.uid === u.uid) {
      this.usuario.rol = nextRol;
      localStorage.setItem('usuarioActual', JSON.stringify(this.usuario));
    }

    console.log(`Rol de ${u.email} cambiado a "${nextRol}"`);
    alert(`Rol cambiado a "${nextRol}"`);
  } catch (error) {
    console.error('Error al cambiar rol:', error);
    alert('Error al cambiar rol. Revisá la consola.');
  }
}

// DAR DE BAJA USUARIO (sin eliminarlo de la base)
async darBaja(index: number) {
  const u = this.usuarios[index];

  // 🔹 Validar usuario existente
  if (!u) {
    console.error('Usuario no encontrado en el índice', index);
    alert('Error: usuario no encontrado.');
    return;
  }

  if (!confirm(`¿Seguro que querés dar de baja a ${u.nombre || u.email}?`)) {
    return;
  }

  try {
    const docId = u.uid || u.id;

    if (!docId) {
      console.warn('Usuario sin uid/id en Firestore, no se puede actualizar:', u);
      alert('No se encontró el ID del usuario en la base de datos.');
      return;
    }

    const userRef = doc(this.firestore, 'usuarios', docId);

    // 🔹 En lugar de eliminar, solo marcamos como inactivo
    await updateDoc(userRef, { activo: false, estado: 'inactivo' });

    // 🔹 Actualizamos el array local
    this.usuarios[index] = { ...u, activo: false, estado: 'inactivo' };

    // 🔹 Si es el usuario logueado, cerramos sesión
    if (this.usuario?.uid === docId) {
      await signOut(getAuth());
      localStorage.removeItem('usuarioActual');
      this.router.navigate(['/auth']);
      alert('Tu cuenta fue dada de baja. Cerrando sesión...');
    } else {
      alert(`${u.nombre || u.email} fue dado de baja correctamente.`);
    }

  } catch (err) {
    console.error('❌ Error al dar de baja usuario:', err);
    alert('Ocurrió un error al dar de baja al usuario. Revisa la consola.');
  }
}

// REACTIVAR USUARIO (volver a activar un usuario dado de baja)
async reactivarUsuario(index: number) {
  const u = this.usuarios[index];

  // 🔹 Validar usuario existente
  if (!u) {
    console.error('Usuario no encontrado en el índice', index);
    alert('Error: usuario no encontrado.');
    return;
  }

  if (!confirm(`¿Seguro que querés reactivar a ${u.nombre || u.email}?`)) {
    return;
  }

  try {
    const docId = u.uid || u.id;

    if (!docId) {
      console.warn('Usuario sin uid/id en Firestore, no se puede actualizar:', u);
      alert('No se encontró el ID del usuario en la base de datos.');
      return;
    }

    const userRef = doc(this.firestore, 'usuarios', docId);

    // 🔹 Actualizamos en Firestore
    await updateDoc(userRef, { activo: true, estado: 'activo' });

    // 🔹 Actualizamos localmente para reflejar el cambio en pantalla
    this.usuarios[index] = { ...u, activo: true, estado: 'activo' };

    alert(`${u.nombre || u.email} fue reactivado correctamente.`);
  } catch (err) {
    console.error('❌ Error al reactivar usuario:', err);
    alert('Ocurrió un error al reactivar el usuario. Revisá la consola.');
  }
}


  // GENERAR TURNOS (6 por día, 14 días, lunes a viernes, hay que acomodarlo, porque genere los 14 dias de seguidos, no saltea 2 que serian los fines de semana)
async generarTurnos() {
  const horarios = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30"];
  const especialidades = ["Clínica", "Pediatría", "Dermatología"];
  const turnos: any[] = [];

  const hoy = new Date();

  for (let d = 0; d < 14; d++) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + d);
    const fechaStr = fecha.toISOString().split("T")[0];
    const especialidadDelDia = especialidades[d % especialidades.length];

    for (const hora of horarios) {
      turnos.push({
        fecha: fechaStr,
        hora,
        especialidad: especialidadDelDia,
        estado: "disponible",
      });
    }
  }

  this.turnos = turnos;
  console.log(" Turnos generados:", this.turnos);

  // Guardar turnos en Firebase
  const turnosRef = collection(this.firestore, 'turnos');

  try {
    for (const turno of this.turnos) {
      await addDoc(turnosRef, turno);
    }
    console.log(" Turnos guardados en Firestore");
  } catch (error) {
    console.error(" Error al guardar los turnos:", error);
  }
}


  obtenerFechasUnicas(): string[] {
    const fechas = this.turnos.map((t) => t.fecha);
    return [...new Set(fechas)].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
  }

  obtenerTurnosPorFecha(fecha: string): Turno[] {
    return this.turnos
      .filter((t) => t.fecha === fecha)
      .sort((a, b) => a.hora.localeCompare(b.hora));
  }

  toggleFecha(fecha: string) {
    this.fechaSeleccionada = this.fechaSeleccionada === fecha ? null : fecha;
  }

  async editarCampo(index: number, campo: keyof Turno) {
    const db = getFirestore();
    const t = this.turnos[index];
    let nuevoValor: string | null = null;

    switch (campo) {
      case 'fecha':
        nuevoValor = prompt('Nueva fecha (YYYY-MM-DD):', t.fecha);
        break;
      case 'hora':
        nuevoValor = prompt('Nueva hora (HH:MM):', t.hora);
        break;
      case 'especialidad':
        nuevoValor = prompt('Nueva especialidad:', t.especialidad);
        break;
      case 'estado':
        nuevoValor = prompt(
          'Nuevo estado (disponible / reservado / cancelado):',
          t.estado
        );
        break;
    }

    if (nuevoValor) {
      t[campo] = nuevoValor as any;
      this.turnos[index] = t;
      const turnoRef = doc(db, 'turnos', t.id!);
      await updateDoc(turnoRef, { [campo]: nuevoValor });
      alert(`✅ ${campo} del turno actualizado`);
    }
  }

  async cancelarTurno(index: number) {
    const db = getFirestore();
    const t = this.misTurnos[index];

    if (!confirm(`¿Cancelar turno del ${t.fecha} a las ${t.hora}?`)) return;

    const turnoRef = doc(db, 'turnos', t.id!);
    await updateDoc(turnoRef, { estado: 'disponible', paciente: null });

    this.misTurnos.splice(index, 1);
    alert('Turno cancelado correctamente');
  }

  irASolicitar() {
    this.router.navigate(['/turnos/solicitar']);
  }
}
