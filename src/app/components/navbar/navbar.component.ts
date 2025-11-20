import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {

  usuario: any = null;

  constructor(private router: Router) {}

cargandoLogout = false;

  ngOnInit() {
    const auth = getAuth();

    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.usuario = user;     // si está logueado
      } else {
        this.usuario = null;     // si NO está logueado
      }
    });
  }

  logout() {
    this.cargandoLogout = true; // activar spinner

    const auth = getAuth();
    signOut(auth).then(() => {
      
      setTimeout(() => {
        this.cargandoLogout = false;
        this.router.navigate(['/home']);
      }, 800); // animación suave — podés bajar o subir el tiempo

    }).catch((error) => {
      this.cargandoLogout = false;
      console.error("Error al cerrar sesión", error);
    });
  }
}
