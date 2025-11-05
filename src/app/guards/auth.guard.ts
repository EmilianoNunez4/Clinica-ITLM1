import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean {
    const raw = localStorage.getItem('usuarioActual');
    if (!raw) {
      this.router.navigate(['/auth']); // ❌ No logueado → redirigir
      return false;
    }

    const user = JSON.parse(raw);
    if (!user.rol || !['admin', 'medico', 'paciente'].includes(user.rol)) {
      localStorage.removeItem('usuarioActual');
      this.router.navigate(['/auth']);
      return false;
    }

    return true; // ✅ Logueado y con rol válido
  }
}
