import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { HomeComponent } from './home/home.component';
import { AuthGuard } from './guards/auth.guard';
import { SolicitarComponent } from './turnos/solicitar/solicitar.component';
import { MedicoComponent } from './medico/medico.component';
import { PacienteComponent } from './paciente/paciente.component';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'turnos/solicitar', component: SolicitarComponent, canActivate: [AuthGuard] },
  { path: 'medico', component: MedicoComponent, canActivate: [AuthGuard] },
  { path: 'paciente', component: PacienteComponent }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      anchorScrolling: 'enabled',
      scrollOffset: [0, 80]
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
