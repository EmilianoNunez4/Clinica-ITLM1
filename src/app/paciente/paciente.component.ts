import { Component, OnInit, inject } from '@angular/core';
import { Firestore, collection, doc, updateDoc, getDocs } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { getAuth, signOut } from 'firebase/auth';
import { Router } from '@angular/router';

interface Turno {
  id: string;
  estado: string;
  fecha: string;
  hora: string;
  especialidad: string;
  paciente?: string;      
  uidPaciente?: string;
  uidMedico?: string;
}

@Component({
  selector: 'app-paciente',
  templateUrl: './paciente.component.html',
  styleUrls: ['./paciente.component.scss']
})
export class PacienteComponent implements OnInit {

  private firestore = inject(Firestore);
  private auth = inject(Auth);

  uid: string = '';
  nombre: string = '';
  apellido: string = '';
  dni: string = '';
  email: string = '';

  // Listas de turnos
turnosFuturos: any[] | null = null;
turnosPasados: any[] | null = null;


  // Formulario de nuevo turno
  especialidades: string[] = ['Pediatría', 'Dermatología', 'Clínica'];
  nuevaEspecialidad: string = '';
  nuevaFecha: string = '';
  nuevaHora: string = '';

  constructor(private router: Router) {}

  async ngOnInit(): Promise<void> {
    const user = await this.auth.currentUser;

    if (!user) {
      this.router.navigate(['/auth']);
      return;
    }

    this.uid = user.uid;
    this.email = user.email ?? '';

    await this.cargarPerfil();
    await this.cargarTurnos();
  }

  // ================= PERFIL =================
  async cargarPerfil(): Promise<void> {
    const usuariosRef = collection(this.firestore, 'usuarios');
    const snapshot = await getDocs(usuariosRef);

    snapshot.forEach((docSnap) => {
      const data: any = docSnap.data();
      if (data.uid === this.uid) {
        this.nombre = data.nombre;
        this.apellido = data.apellido;
        this.dni = data.dni;
      }
    });
  }

  // ================= TURNOS (MIS TURNOS) =================
  async cargarTurnos(): Promise<void> {
    const turnosRef = collection(this.firestore, 'turnos');
    const snapshot = await getDocs(turnosRef);

    const todos = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as Turno[];

    const misTurnos = todos.filter(t => t.paciente === this.nombre);

    this.turnosFuturos = misTurnos.filter(
      t => t.estado !== 'atendido' && t.estado !== 'cancelado'
    );
    this.turnosPasados = misTurnos.filter(
      t => t.estado === 'atendido' || t.estado === 'cancelado'
    );
  }

  // ================= RESERVAR NUEVO TURNO =================
  async solicitarTurno(): Promise<void> {
    if (!this.nuevaEspecialidad || !this.nuevaFecha || !this.nuevaHora) {
      alert('Complete todos los campos.');
      return;
    }

    const turnosRef = collection(this.firestore, 'turnos');
    const snapshot = await getDocs(turnosRef);

    const disponibles = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() as any }))
      .filter(t =>
        t.especialidad === this.nuevaEspecialidad &&
        t.fecha === this.nuevaFecha &&
        t.hora === this.nuevaHora &&
        t.estado === 'disponible'
      );

    if (!disponibles.length) {
      alert('No hay un turno disponible en ese horario.');
      return;
    }

    const turno = disponibles[0];
    const turnoRef = doc(this.firestore, 'turnos', turno.id);

    await updateDoc(turnoRef, {
      estado: 'reservado',
      paciente: this.nombre,        
      uidPaciente: this.uid ?? null 
    });

    alert('Turno reservado con éxito.');
    await this.cargarTurnos();
  }

  // ================= CANCELAR TURNO =================
  async cancelarTurno(id: string): Promise<void> {
    const turnoRef = doc(this.firestore, 'turnos', id);
    await updateDoc(turnoRef, { estado: 'disponible', paciente: null });
    await this.cargarTurnos();
  }
  // ================= CERRAR SESIÓN =================
  cerrarSesion(): void {
    const auth = getAuth();
    signOut(auth).then(() => {
      localStorage.removeItem('usuarioActual');
      this.router.navigate(['/auth']);
    });
  }
}