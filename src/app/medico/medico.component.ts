import { Component, OnInit, inject } from '@angular/core';
import { Firestore, collection, query, where, doc, updateDoc, getDocs } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { getAuth, signOut } from 'firebase/auth';
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

  constructor(private router: Router) {}

  async ngOnInit() {
    const user = this.auth.currentUser;

    if (user) {
      this.uid = user.uid;
      await this.cargarPerfil();
      await this.cargarTurnos();
    }
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
    const todosLosTurnos: Turno[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Turno[];

    this.turnosActivos = todosLosTurnos.filter(t => t.estado !== 'atendido');
    this.turnosAtendidos = todosLosTurnos.filter(t => t.estado === 'atendido');
  }

  async cambiarEstado(turnoId: string, nuevoEstado: string) {
    const turnoRef = doc(this.firestore, 'turnos', turnoId);
    await updateDoc(turnoRef, { estado: nuevoEstado });
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



