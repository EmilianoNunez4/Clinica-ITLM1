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
  loginEmail = '';
  loginPass = '';
  regEmail = '';
  regPass = '';
  nombre = '';

  constructor(private router: Router) {}

 // LOGIN
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

    // ✅ Validación: no permitir inicio si el usuario está inactivo o dado de baja
    if (userData.activo === false || userData.estado === 'inactivo') {
      alert('Tu cuenta fue dada de baja. Contactá al administrador.');
      await signOut(auth);
      return;
    }

    // Guardar usuario actual localmente
    localStorage.setItem('usuarioActual', JSON.stringify(userData));

    alert(`Bienvenido ${userData.nombre}`);

    // Redirección según rol
    if (userData.rol === 'medico') {
      this.router.navigate(['/medico']);
    } else if (userData.rol === 'admin') {
      this.router.navigate(['/home']);
    } else {
      // paciente por defecto
      this.router.navigate(['/home']);
    }

  } catch (err: any) {
    console.error('Error al iniciar sesión:', err);
    alert('Error al iniciar sesión: ' + err.message);
  }
}

  // REGISTRO
async registrar() {
  console.log('Ejecutando registrar()');

  this.regEmail = (this.regEmail || '').trim().toLowerCase();
  this.regPass = (this.regPass || '').trim();
  this.nombre = (this.nombre || '').trim();

  if (!this.nombre || !this.regEmail || !this.regPass) {
    alert('Completar todos los campos');
    return;
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

}

