import { Component, OnInit, inject } from '@angular/core';
import { Firestore, collection, query, where, doc, updateDoc, getDocs } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { getAuth, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { Router } from '@angular/router';

interface Turno {
  id: string;
  estado: string;
  fecha: string;
  hora: string;
  especialidad: string;
  nombrePaciente?: string;
  uidMedico?: string;
  uidPaciente?: string;
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
  verHistorial = false;
  usuarioActual: any = null;
  removingTurnos: Set<string> = new Set();
  processingTurnos: Set<string> = new Set();

  constructor(private router: Router) {}

  async ngOnInit() {
    const user = this.auth.currentUser;
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
    const q = query(usuariosRef, where('uid', '==', this.uid));
    const snapshot = await getDocs(q);
    snapshot.forEach((docSnap) => {
      this.nombre = (docSnap.data() as any).nombre;
    });
  }

  async cargarTurnos() {
    const turnosRef = collection(this.firestore, 'turnos');
    const q = query(turnosRef, where('uidMedico', '==', this.uid));
    const snapshot = await getDocs(q);

    console.log('📌 cargarTurnos: UID del médico logueado:', this.uid);
    console.log('📌 cargarTurnos: documentos obtenidos por query uidMedico=', this.uid, ' -> ', snapshot.size);
    
    const allTurnosSnap = await getDocs(collection(this.firestore, 'turnos'));
    console.log('📄 TODOS los turnos en la BD (hasta 10):', allTurnosSnap.docs.slice(0, 10).map(d => ({
      id: d.id,
      uidMedico: (d.data() as any).uidMedico,
      estado: (d.data() as any).estado,
      fecha: (d.data() as any).fecha,
      especialidad: (d.data() as any).especialidad
    })));
    
    if (snapshot.empty) {
      console.warn('⚠️ cargarTurnos: snapshot vacío — no se encontraron turnos con uidMedico igual a', this.uid);
    }

    const todosLosTurnos: Turno[] = snapshot.docs.map((docSnap) => {
      const data: any = docSnap.data();
      const fecha = data.fecha instanceof Timestamp ? data.fecha.toDate().toISOString().split('T')[0] : data.fecha;

      const nombrePaciente = data.nombrePaciente ?? data.paciente ?? null;
      const uidPaciente = data.uidPaciente ?? data.uidPaciente ?? data.uidPaciente ?? null;

      const mapped: any = {
        id: docSnap.id,
        ...data,
        fecha,
        nombrePaciente,
        uidPaciente,
      };

      return mapped as Turno;
    }) as Turno[];

    console.log('📄 ejemplo turnos (hasta 6):', snapshot.docs.slice(0, 6).map(d => ({ id: d.id, ...d.data() })));
    todosLosTurnos.sort((a, b) => {
      const fechaCmp = a.fecha.localeCompare(b.fecha);
      return fechaCmp !== 0 ? fechaCmp : a.hora.localeCompare(b.hora);
    });

    this.turnosActivos = todosLosTurnos.filter(t => t.estado !== 'atendido');
    this.turnosAtendidos = todosLosTurnos.filter(t => t.estado === 'atendido');

    console.log('🔎 turnos totales encontrados:', todosLosTurnos.length);
    console.log('🔹 turnos activos (no atendidos):', this.turnosActivos.length);
    console.log('🔸 turnos atendidos:', this.turnosAtendidos.length);

    console.log('📅 Turnos activos:', this.turnosActivos);
    console.log('📅 Turnos atendidos:', this.turnosAtendidos);
  }

  async cambiarEstado(turnoId: string, nuevoEstado: string) {
    const turnoRef = doc(this.firestore, 'turnos', turnoId);
    await updateDoc(turnoRef, { estado: nuevoEstado });
    await this.cargarTurnos();
  }

  async marcarAtendido(turno: Turno) {
    if (!turno?.id) return;
    const id = turno.id;
    this.removingTurnos.add(id);
    this.processingTurnos.add(id);

    setTimeout(async () => {
      try {
        const turnoRef = doc(this.firestore, 'turnos', id);
        await updateDoc(turnoRef, { estado: 'atendido' });

        this.turnosActivos = this.turnosActivos.filter(t => t.id !== id);
        const atendido = { ...turno, estado: 'atendido' } as Turno;
        this.turnosAtendidos = [atendido, ...this.turnosAtendidos].sort((a, b) => {
          const fechaCmp = a.fecha.localeCompare(b.fecha);
          return fechaCmp !== 0 ? fechaCmp : a.hora.localeCompare(b.hora);
        });
      } catch (err) {
        console.error('Error marcando turno como atendido', err);
      } finally {
        this.removingTurnos.delete(id);
        this.processingTurnos.delete(id);
      }
    }, 360);
  }

  cerrarSesion() {
    const auth = getAuth();
    signOut(auth).then(() => {
      localStorage.removeItem('usuarioActual');
      this.router.navigate(['/auth']);
    });
  }
}





