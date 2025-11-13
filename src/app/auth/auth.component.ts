import { Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
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
  activo?: boolean;  
  estado?: string;    
}

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class AuthComponent {
  // LOGIN
  loginEmail: string = '';
  loginPass: string = '';

  // REGISTRO
  registerName: string = '';
  registerEmail: string = '';
  registerPass: string = '';

  // Estado del formulario
  isRegister: boolean = false;

  constructor(private router: Router) {}

  // 🔄 Cambiar entre login y registro
  toggleRegister() {
    this.isRegister = !this.isRegister;

    // limpiar inputs al alternar
    this.loginEmail = '';
    this.loginPass = '';
    this.registerName = '';
    this.registerEmail = '';
    this.registerPass = '';
  }

  // ============================
  // 🔐 LOGIN
  // ============================
  async login() {
    try {
      const auth = getAuth();
      const db = getFirestore();

      const cred = await signInWithEmailAndPassword(
        auth,
        this.loginEmail.trim(),
        this.loginPass
      );

      const userRef = doc(db, 'usuarios', cred.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        alert('Usuario no encontrado en base de datos');
        return;
      }

      const userData = snap.data() as Usuario;

      localStorage.setItem('usuarioActual', JSON.stringify(userData));

      alert(`Bienvenido ${userData.nombre}`);

      if (userData.rol === 'medico') {
        this.router.navigate(['/medico']);
      } else if (userData.rol === 'admin') {
        this.router.navigate(['/home']);
      } else {
        this.router.navigate(['/home']);
      }

    } catch (err: any) {
      console.error('Error al iniciar sesión:', err);
      alert('Error al iniciar sesión: ' + err.message);
    }
  }

  // ============================
  // 🆕 REGISTRO
  // ============================
  async registrarUsuario() {
    console.log('Ejecutando registrarUsuario()');

    this.registerEmail = (this.registerEmail || '').trim().toLowerCase();
    this.registerPass = (this.registerPass || '').trim();
    this.registerName = (this.registerName || '').trim();

    if (!this.registerName || !this.registerEmail || !this.registerPass) {
      alert('Completar todos los campos');
      return;
    }

    const emailRegex =
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(this.registerEmail)) {
      alert('Por favor, ingresá un correo electrónico válido');
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

      const allUsersSnap = await getDocs(collection(db, 'usuarios'));
      const rol = allUsersSnap.empty ? 'admin' : 'paciente';

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
      console.error('Error al registrar usuario:', err);
      alert('Error al registrar: ' + err.message);
    }
  }

  const emailRegex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(this.regEmail)) {
    console.log('Valor de email ingresado:', this.regEmail);
    alert('Por favor, ingresá un correo electrónico válido');
    return;
  }

  try {
    const auth = getAuth();
    const db = getFirestore();

    const cred = await createUserWithEmailAndPassword(auth, this.regEmail, this.regPass);
    console.log('Usuario creado en Auth:', cred.user.uid);

    const allUsersSnap = await getDocs(collection(db, 'usuarios'));
    const rol = allUsersSnap.empty ? 'admin' : 'paciente';

    const nuevoUsuario = {
      uid: cred.user.uid,
      nombre: this.nombre,
      email: this.regEmail,
      rol,
      fechaRegistro: new Date().toISOString()
    };

    await setDoc(doc(db, 'usuarios', cred.user.uid), nuevoUsuario);
    alert('Usuario registrado con éxito');
    this.router.navigate(['/home']);
  } catch (err: any) {
    console.error('Error al registrar usuario:', err);
    alert('Error al registrar: ' + err.message);
  }
}
