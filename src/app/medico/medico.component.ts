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
  usuarioActual: any = null; // ✅ agregamos esto para evitar error en HTML

  constructor(private router: Router) {}

  async ngOnInit() {
    const user = this.auth.currentUser;
      const authInstance = getAuth();

      // Cuando cambia el estado de autenticación (login/logout), cargamos perfil y turnos
      onAuthStateChanged(authInstance, async (user: User | null) => {
        if (user) {
          this.uid = user.uid;
          this.usuarioActual = user; // almacenamos el usuario para mostrar en la vista
          await this.cargarPerfil();
          await this.cargarTurnos();
        } else {
          // usuario no logueado: limpiar datos locales
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

    const todosLosTurnos: Turno[] = snapshot.docs.map((docSnap) => {
      const data: any = docSnap.data();
      const fecha = data.fecha instanceof Timestamp ? data.fecha.toDate().toISOString().split('T')[0] : data.fecha;

      return {
        id: docSnap.id,
        ...data,
        fecha // ahora es un string YYYY-MM-DD si venía como Timestamp
      } as Turno;
    }) as Turno[];

  // Mostrar sólo los turnos disponibles para este médico
  this.turnosActivos = todosLosTurnos.filter(t => t.estado === 'disponible');
    this.turnosAtendidos = todosLosTurnos.filter(t => t.estado === 'atendido');

    console.log('📅 Turnos activos:', this.turnosActivos);
    console.log('📅 Turnos atendidos:', this.turnosAtendidos);
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





