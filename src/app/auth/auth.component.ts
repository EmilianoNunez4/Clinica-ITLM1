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
import Swal from 'sweetalert2';


interface Usuario {
  uid: string;
  nombre: string;
  email: string;
  rol: string;
  dni?: string;
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

  registerName = '';
  registerEmail = '';
  registerPass = '';
  registerDni = '';

  // Alternar entre login y registro
  isRegister = false;

  constructor(private router: Router) {}

  // CAMBIAR FORMULARIO
  toggleRegister() {
    this.isRegister = !this.isRegister;

    this.loginEmail = '';
    this.loginPass = '';
    this.registerName = '';
    this.registerEmail = '';
    this.registerPass = '';
    this.registerDni = '';
  }

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

      const ref = doc(db, 'usuarios', cred.user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        if (!snap.exists()) {
          await Swal.fire({
            icon: 'error',
            title: 'Usuario no encontrado',
            text: 'No encontramos tu cuenta en nuestra base de datos.',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#b00020',
            background: '#f7f7f7',
          });
          return;
        }
        return;
      }

      const user = snap.data() as Usuario;

      localStorage.setItem('usuarioActual', JSON.stringify(user));

      await Swal.fire({
        icon: 'success',
        title: '¡Bienvenido!',
        text: `Hola ${user.nombre}, nos alegra tenerte de vuelta 💙`,
        confirmButtonColor: '#00509e',
      });


      if (user.rol === 'medico') {
        this.router.navigate(['/medico']);
      } else {
        this.router.navigate(['/home']);
      }

    } catch (err: any) {
        await Swal.fire({
          icon: 'error',
          title: 'Error al iniciar sesión',
          text:'Verificá tu correo y contraseña.',
          confirmButtonText: 'Reintentar',
          confirmButtonColor: '#b00020',
          background: '#f7f7f7',
        });
    }
  }

  // REGISTRO
  async registrarUsuario() {
  this.registerEmail = this.registerEmail.trim().toLowerCase();
  this.registerPass  = this.registerPass.trim();
  this.registerName  = this.registerName.trim();
  this.registerDni   = this.registerDni?.trim() || ''; // si agregaste dni

  if (!this.registerName || !this.registerEmail || !this.registerPass) {
    await Swal.fire({
      icon: 'warning',
      title: 'Campos incompletos',
      text: 'Por favor, completa todos los campos.',
      confirmButtonColor: '#ff9800',
    });
    return;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(this.registerEmail)) {
    await Swal.fire({
      icon: 'warning',
      title: 'Correo no válido',
      text: 'Ingresá un correo electrónico válido.',
      confirmButtonColor: '#ff9800',
    });
    return;
  }

  try {
    const auth = getAuth();
    const db   = getFirestore();

    // 1) Crear usuario en Authentication
    const cred = await createUserWithEmailAndPassword(
      auth,
      this.registerEmail,
      this.registerPass
    );

    // 2) Definir rol siempre como 'paciente' (el admin lo seteás después)
    const rol: 'paciente' | 'admin' = 'paciente';

    const nuevoUsuario: any = {
      uid:   cred.user.uid,
      nombre: this.registerName,
      email:  this.registerEmail,
      dni:    this.registerDni || null,
      rol,
      fechaRegistro: new Date().toISOString(),
      activo: true,
      estado: 'activo'
    };

    // 3) Crear documento en colección 'usuarios'
    await setDoc(doc(db, 'usuarios', cred.user.uid), nuevoUsuario);

    // 4) Guardar usuario en localStorage
    localStorage.setItem('usuarioActual', JSON.stringify(nuevoUsuario));

    // 5) Mensaje y redirección
    await Swal.fire({
      icon: 'success',
      title: '¡Registro completado!',
      text: 'Tu cuenta fue creada con éxito. Bienvenido a la Clínica ITLM.',
      confirmButtonColor: '#00509e',
    });

    this.router.navigate(['/home']);

  } catch (err: any) {
    console.error('Error completo en registrarUsuario:', err.code, err.message);
    await Swal.fire({
      icon: 'error',
      title: 'Error al registrarse',
      text: err.message || 'Ocurrió un problema.',
      confirmButtonColor: '#b00020',
    });
  }
}
}
