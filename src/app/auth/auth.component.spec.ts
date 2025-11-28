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
import { getAuth, signOut } from 'firebase/auth';
import { Router } from '@angular/router';

interface Turno {
  id: string;
  estado: string;
  fecha: string;        // ej: '25/11/2025'
  hora: string;         // ej: '15:30'
  especialidad: string;
  uidPaciente?: string;
  uidMedico?: string;
}

@Component({
  selector: 'app-paciente',
  templateUrl: './paciente.component.html',
  styleUrls: ['./paciente.component.scss'],
})
export class PacienteComponent implements OnInit {
  private firestore = inject(Firestore);
  private router = inject(Router);

  // Datos del usuario
  uid = '';
  nombre = '';
  apellido = '';
  dni = '';
  email = '';

  // Turnos
  turnosProximos: Turno[] = [];
  turnosHistorial: Turno[] = [];

  // Tab activa
  tabActiva: 'proximos' | 'historial' = 'proximos';

  // Getter para usar en el hero
  get proximoTurno(): Turno | null {
    return this.turnosProximos.length ? this.turnosProximos[0] : null;
  }

  async ngOnInit(): Promise<void> {
    const raw = localStorage.getItem('usuarioActual');
    if (!raw) {
      // Si no hay usuario, lo mando al login
      this.router.navigate(['/auth']);
      return;
    }

    const user = JSON.parse(raw);
    this.uid = user.uid;
    this.nombre = user.nombre;
    this.apellido = user.apellido;
    this.dni = user.dni;
    this.email = user.email;

    await this.cargarTurnos();
  }

  // Trae turnos del paciente en Firestore
  async cargarTurnos() {
    const turnosRef = collection(this.firestore, 'turnos');
    const qTurnos = query(turnosRef, where('uidPaciente', '==', this.uid));
    const snapshot = await getDocs(qTurnos);

    const todos: Turno[] = snapshot.docs.map((docSnap) => {
      const data: any = docSnap.data();
      return {
        id: docSnap.id,
        estado: data.estado,
        fecha: data.fecha,
        hora: data.hora,
        especialidad: data.especialidad,
        uidPaciente: data.uidPaciente,
        uidMedico: data.uidMedico,
      };
    });

    // Separar próximos vs historial (muy simple: por fecha y cancelados)
    const hoy = new Date();
    const hoySoloFecha = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate()
    );

    const esFuturo = (t: Turno): boolean => {
      if (!t.fecha) return false;
      const partes = t.fecha.split('/');
      if (partes.length !== 3) return false;

      const [dia, mes, anio] = partes.map((n) => Number(n));
      const fechaTurno = new Date(anio, mes - 1, dia);

      return (
        fechaTurno.getTime() >= hoySoloFecha.getTime() &&
        t.estado !== 'cancelado'
      );
    };

    this.turnosProximos = todos
      .filter(esFuturo)
      .sort((a, b) => {
        const [da, ma, aa] = a.fecha.split('/').map(Number);
        const [db, mb, ab] = b.fecha.split('/').map(Number);
        const fa = new Date(aa, ma - 1, da).getTime();
        const fb = new Date(ab, mb - 1, db).getTime();
        if (fa !== fb) return fa - fb;
        return a.hora.localeCompare(b.hora);
      });

    this.turnosHistorial = todos.filter((t) => !this.turnosProximos.includes(t));
  }

  async cancelarTurno(id: string) {
    const turnoRef = doc(this.firestore, 'turnos', id);
    await updateDoc(turnoRef, { estado: 'cancelado' });
    await this.cargarTurnos();
  }

  cerrarSesion() {
    const auth = getAuth();
    signOut(auth).finally(() => {
      localStorage.removeItem('usuarioActual');
      this.router.navigate(['/auth']);
    });
  }
}