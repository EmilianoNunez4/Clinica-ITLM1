import { Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
} from 'firebase/firestore';

interface Usuario {
  uid: string;
  nombre: string;
  email: string;
  rol: string;
  fechaRegistro?: string;
}

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class AuthComponent {
  // ===========================
  // CAMPOS DEL FORMULARIO
  // ===========================
  loginEmail = '';
  loginPass = '';

  registerName = '';
  registerEmail = '';
  registerPass = '';

  // Alternar entre login y registro
  isRegister = false;

  constructor(private router: Router) {}

  // ===========================
  // CAMBIAR FORMULARIO
  // ===========================
  toggleRegister() {
    this.isRegister = !this.isRegister;

    this.loginEmail = '';
    this.loginPass = '';
    this.registerName = '';
    this.registerEmail = '';
    this.registerPass = '';
  }

  // ===========================
  // LOGIN
  // ===========================
  async login() {
    try {
      const auth = getAuth();
      const db = getFirestore();

      const cred = await signInWithEmailAndPassword(
        auth,
        this.loginEmail.trim(),
        this.loginPass
      );

      const ref = doc(db, 'usuarios', cred.user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        alert('Usuario no encontrado en base de datos');
        return;
      }

      const user = snap.data() as Usuario;

      localStorage.setItem('usuarioActual', JSON.stringify(user));

      alert(`Bienvenido ${user.nombre}`);

      if (user.rol === 'medico') {
        this.router.navigate(['/medico']);
      } else {
        this.router.navigate(['/home']);
      }

    } catch (err: any) {
      alert('Error al iniciar sesión: ' + err.message);
    }
  }

  // ===========================
  // REGISTRO
  // ===========================
  async registrarUsuario() {
    this.registerEmail = this.registerEmail.trim().toLowerCase();
    this.registerPass = this.registerPass.trim();
    this.registerName = this.registerName.trim();

    if (!this.registerName || !this.registerEmail || !this.registerPass) {
      alert('Completar todos los campos');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(this.registerEmail)) {
      alert('Correo electrónico inválido');
      return;
    }

    try {
      const auth = getAuth();
      const db = getFirestore();

      const cred = await createUserWithEmailAndPassword(
        auth,
        this.registerEmail,
        this.registerPass
      );

      const usersSnap = await getDocs(collection(db, 'usuarios'));
      const rol = usersSnap.empty ? 'admin' : 'paciente';

      const nuevoUsuario: Usuario = {
        uid: cred.user.uid,
        nombre: this.registerName,
        email: this.registerEmail,
        rol,
        fechaRegistro: new Date().toISOString(),
      };

      await setDoc(doc(db, 'usuarios', cred.user.uid), nuevoUsuario);

      alert('Usuario registrado con éxito');
      this.router.navigate(['/home']);

    } catch (err: any) {
      alert('Error al registrar: ' + err.message);
    }
  }
}
