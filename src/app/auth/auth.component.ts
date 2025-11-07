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

    // Guardar usuario actual localmente
    localStorage.setItem('usuarioActual', JSON.stringify(userData));

    alert(`Bienvenido ${userData.nombre}`);

    // Redirección según rol
    if (userData.rol === 'medico') {
      this.router.navigate(['/medico']);
    } else if (userData.rol === 'admin') {
      this.router.navigate(['/admin']);
    } else {
      // paciente por defecto
      this.router.navigate(['/home']);
    }

  } catch (err: any) {
    console.error('❌ Error al iniciar sesión:', err);
    alert('Error al iniciar sesión: ' + err.message);
  }
}

  // REGISTRO
  async registrar() {
    if (!this.nombre || !this.regEmail || !this.regPass) {
      alert('Completar todos los campos');
      return;
    }

    try {
      const auth = getAuth();
      const db = getFirestore();

      // Crear usuario en Firebase Auth
      const cred = await createUserWithEmailAndPassword(
        auth,
        this.regEmail.trim(),
        this.regPass
      );

      // Obtener usuarios existentes para definir rol
      let rol = 'paciente';
      try {
        const allUsersSnap = await getDocs(collection(db, 'usuarios'));
        if (allUsersSnap.empty) rol = 'admin';
      } catch (e) {
        console.warn('⚠️ No se pudo obtener usuarios existentes:', e);
      }

      // Estructura del nuevo usuario
      const nuevoUsuario: Usuario = {
        uid: cred.user.uid,
        nombre: this.nombre.trim(),
        email: this.regEmail.trim(),
        rol,
        fechaRegistro: new Date().toISOString(),
      };

      // Guardar en Firestore con el UID como ID
      await setDoc(doc(db, 'usuarios', cred.user.uid), nuevoUsuario);

      // Guardar localmente también
      localStorage.setItem('usuarioActual', JSON.stringify(nuevoUsuario));

      alert(`✅ Usuario ${rol === 'admin' ? 'administrador' : 'paciente'} registrado con éxito`);
      this.router.navigate(['/home']);
    } catch (err: any) {
      console.error('❌ Error al registrar usuario:', err);
      alert('Error al registrar: ' + err.message);
    }
  }
}
