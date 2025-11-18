import { Component, OnInit, inject } from '@angular/core';
import { Firestore, collection, addDoc, query, where, doc, updateDoc, getDocs } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { getAuth, signOut } from 'firebase/auth';
import { Router } from '@angular/router';

interface Turno {
  id: string;
  estado: string;
  fecha: string;
  hora: string;
  especialidad: string;
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
  nombre = '';
  apellido = '';
  dni = '';
  email = '';

  turnosFuturos: Turno[] = [];
  turnosPasados: Turno[] = [];

  especialidades = ['Cardiología', 'Pediatría', 'Dermatología', 'Clínica Médica'];

  nuevaEspecialidad = '';
  nuevaFecha = '';
  nuevaHora = '';

  constructor(private router: Router) {}

  async ngOnInit() {
    const user = this.auth.currentUser;

    if (user) {
      this.uid = user.uid;
      this.email = user.email || '';
      await this.cargarPerfil();
      await this.cargarTurnos();
    }
  }

  async cargarPerfil() {
    const usuariosRef = collection(this.firestore, 'usuarios');
    const q = query(usuariosRef, where('uid', '==', this.uid));
    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {
      const data: any = docSnap.data();
      this.nombre = data.nombre;
      this.apellido = data.apellido;
      this.dni = data.dni;
    });
  }

  async cargarTurnos() {
    const turnosRef = collection(this.firestore, 'turnos');
    const q = query(turnosRef, where('uidPaciente', '==', this.uid));
    const snapshot = await getDocs(q);

    const lista: Turno[] = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as Turno[];

    this.turnosFuturos = lista.filter(t => t.estado !== 'atendido' && t.estado !== 'cancelado');
    this.turnosPasados = lista.filter(t => t.estado === 'atendido' || t.estado === 'cancelado');
  }

  async solicitarTurno() {
    if (!this.nuevaEspecialidad || !this.nuevaFecha || !this.nuevaHora) {
      alert("Complete todos los campos.");
      return;
    }

    const turnosRef = collection(this.firestore, 'turnos');

    await addDoc(turnosRef, {
      fecha: this.nuevaFecha,
      hora: this.nuevaHora,
      especialidad: this.nuevaEspecialidad,
      estado: 'pendiente',
      uidPaciente: this.uid,
      nombrePaciente: this.nombre
    });

    alert('Turno solicitado con éxito.');
    await this.cargarTurnos();
  }

  async cancelarTurno(id: string) {
    const turnoRef = doc(this.firestore, 'turnos', id);
    await updateDoc(turnoRef, { estado: 'cancelado' });
    await this.cargarTurnos();
  }

  cerrarSesion() {
    const auth = getAuth();
    signOut(auth).then(() => {
      localStorage.removeItem('usuarioActual');
      this.router.navigate(['/auth']);
    });
  }
}
