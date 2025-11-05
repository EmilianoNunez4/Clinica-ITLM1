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

// este ollente Escucha si hay un usuario logueado actualmente. para ver si hay alguien activo o no
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
        alert('No se encontró tu usuario en la base de datos.');
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

  // 🧩 Validar que exista el usuario
  if (!u) {
    console.error('⚠️ Usuario no encontrado en el índice:', index);
    alert('Error: Usuario no encontrado.');
    return;
  }

  // 🧩 Validar que tenga rol (si no, asignar paciente)
  if (!u.rol || !order.includes(u.rol)) {
    console.warn('⚠️ Usuario sin rol válido, asignando "paciente":', u);
    u.rol = 'paciente';
  }

  // 🔹 Calcular el siguiente rol en el orden
  const currentRol = u.rol || 'paciente';
  const currentIdx = order.indexOf(currentRol);

  if (currentIdx === -1) {
    console.error('❌ Rol desconocido:', currentRol, 'en usuario:', u);
    alert('Rol desconocido, no se puede cambiar.');
    return;
  }

  const nextIdx = (currentIdx + 1) % order.length;
  const nextRol = order[nextIdx];

  // ⚠️ Evitar eliminar el último admin
  if (
    currentRol === 'admin' &&
    nextRol !== 'admin' &&
    this.usuarios.filter(x => x.rol === 'admin').length === 1
  ) {
    alert('Debe quedar al menos un administrador.');
    return;
  }

  // 🔁 Actualizar en memoria
  u.rol = nextRol;
  this.usuarios[index] = u;

  try {
    const userRef = doc(this.firestore, 'usuarios', u.uid);
    await updateDoc(userRef, { rol: nextRol });

    // 🔄 Si el usuario logueado es el mismo, actualizar localStorage
    if (this.usuario?.uid === u.uid) {
      this.usuario.rol = nextRol;
      localStorage.setItem('usuarioActual', JSON.stringify(this.usuario));
    }

    console.log(`✅ Rol de ${u.email} cambiado a "${nextRol}"`);
    alert(`Rol cambiado a "${nextRol}"`);
  } catch (error) {
    console.error('❌ Error al cambiar rol:', error);
    alert('Error al cambiar rol. Revisá la consola.');
  }
}

// ELIMINAR USUARIO
async eliminarUsuario(index: number) {
  // Validaciones básicas
  const u = this.usuarios[index];
  if (!u) {
    console.error('Usuario no encontrado en el índice', index);
    alert('Error: usuario no encontrado.');
    return;
  }

  if (!confirm(`¿Seguro que querés eliminar a ${u.nombre || u.email}? Esta acción es irreversible.`)) {
    return;
  }

  try {
    // Primero intentar obtener el id/uid del documento
    const docId = u.uid || u.id;
    if (!docId) {
      // Si no existe uid/id, avisar y sólo remover del arreglo local
      console.warn('Usuario sin uid/id en Firestore, se eliminará sólo localmente:', u);
      this.usuarios.splice(index, 1);
      alert(`${u.nombre || u.email} eliminado localmente (no había id en Firestore).`);
      return;
    }

    // Eliminar del arreglo local (actualiza UI inmediatamente)
    this.usuarios.splice(index, 1);

    // Eliminar el doc en Firestore usando la instancia inyectada
    const userRef = doc(this.firestore, 'usuarios', docId);
    await deleteDoc(userRef);

    // Si eliminaste al usuario que está logueado, cerrá sesión y redirigí
    if (this.usuario?.uid === docId) {
      await signOut(getAuth());
      localStorage.removeItem('usuarioActual');
      this.router.navigate(['/auth']);
    }

    alert(`${u.nombre || u.email} eliminado correctamente.`);
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    alert('Ocurrió un error al eliminar el usuario. Revisa la consola.');
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
  console.log("✅ Turnos generados:", this.turnos);

  // Guardar turnos en Firebase
  const turnosRef = collection(this.firestore, 'turnos');

  try {
    for (const turno of this.turnos) {
      await addDoc(turnosRef, turno);
    }
    console.log("✅ Turnos guardados en Firestore");
  } catch (error) {
    console.error("❌ Error al guardar los turnos:", error);
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

  async eliminarTurno(index: number) {
    const db = getFirestore();
    const t = this.turnos[index];
    if (confirm(`¿Seguro que querés eliminar el turno de ${t.fecha} a las ${t.hora}?`)) {
      this.turnos.splice(index, 1);
      const turnoRef = doc(db, 'turnos', t.id!);
      await deleteDoc(turnoRef);
      alert('Turno eliminado');
    }
  }

  async eliminarTodosTurnos() {
    const db = getFirestore();
    if (confirm('¿Eliminar TODOS los turnos?')) {
      const turnosSnap = await getDocs(collection(db, 'turnos'));
      for (const d of turnosSnap.docs) {
        await deleteDoc(d.ref);
      }
      this.turnos = [];
      alert('🗑️ Todos los turnos eliminados');
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
