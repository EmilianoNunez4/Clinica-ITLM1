import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { getAuth, signOut, onAuthStateChanged, User } from 'firebase/auth';
import {
  Firestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  addDoc,
  query,
  where
} from '@angular/fire/firestore';

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
  misTurnos: Turno[] = [];
  fechaSeleccionada: string | null = null;

  constructor(private firestore: Firestore, private router: Router) {}

  async ngOnInit() {
    const auth = getAuth();

    onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        this.router.navigate(['/auth']);
        return;
      }

      const userRef = doc(this.firestore, 'usuarios', user.uid);
      const userSnap = await getDocs(collection(this.firestore, 'usuarios')); 
      // opción simple: obtén todos usuarios y luego busca tu uid
      const userData = (await getDocs(collection(this.firestore, 'usuarios')))
        .docs.find(d => d.id === user.uid)?.data();
      if (!userData) {
        alert('No se encontró tu usuario en la base de datos.');
        await signOut(auth);
        this.router.navigate(['/auth']);
        return;
      }
      this.usuario = userData;

      const usuariosSnap = await getDocs(collection(this.firestore, 'usuarios'));
      this.usuarios = usuariosSnap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }));

      const turnosSnap = await getDocs(collection(this.firestore, 'turnos'));
      this.turnos = turnosSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Turno[];

      if (this.usuario.rol === 'paciente') {
        this.misTurnos = this.turnos.filter((t) => t.paciente === this.usuario.nombre);
      }
    });
  }

  async logout() {
    const auth = getAuth();
    await signOut(auth);
    this.router.navigate(['/auth']);
  }

  async cambiarRol(index: number) {
    const order = ['paciente', 'medico', 'admin'];
    const u = this.usuarios[index];
    if (!u) {
      alert('Error: Usuario no encontrado.');
      return;
    }
    if (!u.rol || !order.includes(u.rol)) {
      u.rol = 'paciente';
    }
    const currentIdx = order.indexOf(u.rol);
    const nextRol = order[(currentIdx + 1) % order.length];
    if (u.rol === 'admin' && nextRol !== 'admin' && this.usuarios.filter(x => x.rol === 'admin').length === 1) {
      alert('Debe quedar al menos un administrador.');
      return;
    }

    try {
      const userRef = doc(this.firestore, 'usuarios', u.uid);
      await updateDoc(userRef, { rol: nextRol });
      u.rol = nextRol;
      this.usuarios[index] = u;

      if (this.usuario.uid === u.uid) {
        this.usuario.rol = nextRol;
        localStorage.setItem('usuarioActual', JSON.stringify(this.usuario));
      }

      alert(`Rol cambiado a "${nextRol}"`);
    } catch (error) {
      console.error('Error al cambiar rol:', error);
      alert('Error al cambiar rol. Revisá la consola.');
    }
  }

  async generarTurnosPorEspecialidad() {
    const horarios = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30"];
    const diasAGenerar = 14;
    // Especialidades esperadas (se pueden ajustar según cómo estén guardadas en la colección usuarios)
    const especialidades = ["Clínica", "Pediatría", "Dermatología"];

    // Normalizador simple: quita tildes y pasa a minúsculas para hacer matching robusto
    const normalize = (s: string) => s?.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

    for (const especialidad of especialidades) {
      // Traemos todos los médicos y filtramos en JS usando normalización (evita problemas por mayúsculas/tildes)
      const medicosSnap = await getDocs(query(collection(this.firestore, 'usuarios'), where('rol', '==', 'medico')));
      const medicosAll = medicosSnap.docs.map(docSnap => ({ uid: docSnap.id, ...(docSnap.data() as any) }));
      const medicos = medicosAll.filter(m => normalize(m.especialidad || '') === normalize(especialidad));

      if (medicos.length === 0) {
        console.warn(`No se encontraron médicos para especialidad ${especialidad}. Se omite generación para esta especialidad.`);
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
        if (diaSemana !== 0 && diaSemana !== 6) {
          const fechaStr = fecha.toISOString().split("T")[0];

          const startIndex = dayOffset % medicos.length;

          for (let i = 0; i < horarios.length; i++) {
            const medicoSeleccionado = medicos[(startIndex + i) % medicos.length];
            // Aseguramos que uidMedico exista
            const uidMedico = medicoSeleccionado?.uid || null;
            await addDoc(collection(this.firestore, 'turnos'), {
              fecha: fechaStr,
              hora: horarios[i],
              estado: 'disponible',
              especialidad: especialidad,
              uidMedico: uidMedico
            });
          }

          fechasGeneradas++;
          dayOffset++;
        }
        diasContados++;
      }
    }

    alert('✅ Turnos generados por especialidad sin fines de semana (rotación entre médicos)');
  }

  // Repara turnos existentes que no tengan uidMedico asignado.
  // Asigna médicos basándose en la rotación por fecha y especialidad.
  async repararTurnosSinMedico() {
    const turnosSnap = await getDocs(collection(this.firestore, 'turnos'));
    const turnos = turnosSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    const normalize = (s: string) => s?.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

    // Obtener todos los médicos
    const medicosSnap = await getDocs(query(collection(this.firestore, 'usuarios'), where('rol', '==', 'medico')));
    const medicosAll = medicosSnap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }));

    // Agrupar médicos por especialidad normalizada
    const medicosPorEsp: Record<string, any[]> = {};
    for (const m of medicosAll) {
      const key = normalize(m.especialidad || '');
      medicosPorEsp[key] = medicosPorEsp[key] || [];
      medicosPorEsp[key].push(m);
    }

    // Procesar turnos por fecha y especialidad para asignar rotación
    const turnosSinMedico = turnos.filter(t => !t.uidMedico || t.uidMedico === null || t.uidMedico === '');

    // Ordenar por fecha para aplicar rotación consistente
    turnosSinMedico.sort((a, b) => (a.fecha > b.fecha ? 1 : a.fecha < b.fecha ? -1 : a.hora.localeCompare(b.hora)));

    // Map de contador por especialidad que indica el offset actual
    const offsetPorEsp: Record<string, number> = {};

    for (const t of turnosSinMedico) {
      const key = normalize(t.especialidad || '');
      const medicos = medicosPorEsp[key] || [];
      if (medicos.length === 0) continue; // no hay médicos para esa especialidad

      const offset = offsetPorEsp[key] || 0;
      const index = offset % medicos.length;
      const medicoSeleccionado = medicos[index];

      try {
        const turnoRef = doc(this.firestore, 'turnos', t.id);
        await updateDoc(turnoRef, { uidMedico: medicoSeleccionado.uid });
        offsetPorEsp[key] = offset + 1;
      } catch (err) {
        console.error('Error al actualizar turno', t.id, err);
      }
    }

    alert('Proceso de reparación de turnos completado.');
  }

  obtenerFechasUnicas(): string[] {
    const fechas = this.turnos.map((t) => t.fecha);
    return [...new Set(fechas)].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
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
    const t = this.turnos[index];
    const nuevoValor = prompt(`Nuevo valor para ${campo}:`, (t as any)[campo]);
    if (!nuevoValor) return;
    const turnoRef = doc(this.firestore, 'turnos', t.id!);
    await updateDoc(turnoRef, { [campo]: nuevoValor });
    t[campo] = nuevoValor as any;
    alert('Campo actualizado');
  }

  async eliminarTurno(index: number) {
    const t = this.turnos[index];
    if (!confirm(`¿Eliminar turno ${t.fecha} ${t.hora}?`)) return;
    await deleteDoc(doc(this.firestore, 'turnos', t.id!));
    this.turnos.splice(index, 1);
    alert('Turno eliminado');
  }

  async eliminarTodosTurnos() {
    if (!confirm('¿Eliminar todos los turnos?')) return;
    const turnosSnap = await getDocs(collection(this.firestore, 'turnos'));
    for (const d of turnosSnap.docs) {
      await deleteDoc(d.ref);
    }
    this.turnos = [];
    alert('Todos los turnos eliminados');
  }

  async cancelarTurno(index: number) {
    const t = this.misTurnos[index];
    if (!confirm(`¿Cancelar turno ${t.fecha} ${t.hora}?`)) return;
    await updateDoc(doc(this.firestore, 'turnos', t.id!), { estado: 'disponible', paciente: null });
    this.misTurnos.splice(index, 1);
    alert('Turno cancelado');
  }

  async eliminarUsuario(index: number) {
  const u = this.usuarios[index];
  if (!u) { alert('Usuario no encontrado.'); return; }
  if (!confirm(`¿Eliminar a ${u.nombre || u.email}?`)) return;

  try {
    const userRef = doc(this.firestore, 'usuarios', u.uid);
    await deleteDoc(userRef);
    this.usuarios.splice(index, 1);

    if (this.usuario?.uid === u.uid) {
      await signOut(getAuth());
      localStorage.removeItem('usuarioActual');
      this.router.navigate(['/auth']);
    }

    alert('Usuario eliminado correctamente');
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    alert('Error al eliminar usuario.');
  }
}


  irASolicitar() {
    this.router.navigate(['/turnos/solicitar']);
  }
}

