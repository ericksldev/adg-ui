import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AutenticacionGuard } from './core/guards/autentication.guard';
import { ShowLogin } from './core/guards/show-login.guard';
import { HomeComponent } from './features/home/pages/home/home.component';
import { LoginComponent } from './features/auth/pages/login/login.component';


const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'login', component: LoginComponent, canActivate: [ShowLogin] },
  {
    path: 'home',
    component: HomeComponent,
    canActivate: [AutenticacionGuard],
    data: { breadcrumb: 'breadcrumbs.home' }
  },
  {
    path: 'animal',
    loadChildren: () => import('./features/animals/animal.module').then((m) => m.AnimalModule),
    data: { breadcrumb: 'breadcrumbs.animal' }
  },
  {
    path: 'corral-work-session',
    loadChildren: () =>
      import('./features/corral-work-sessions/corral-work-session.module').then((m) => m.CorralWorkSessionModule),
    data: { breadcrumb: 'breadcrumbs.corralWorkSession' }
  },
  {
    path: 'saas-management',
    loadChildren: () =>
      import('./features/companies/company.module').then((m) => m.CompanyModule),
    data: { breadcrumb: 'breadcrumbs.saasManagement' }
  },
  {
    path: 'ranch-management',
    loadChildren: () =>
      import('./features/ranches/ranch-management.module').then((m) => m.RanchManagementModule),
    data: { breadcrumb: 'breadcrumbs.ranchManagement' }
  },
  {
    path: 'user-management',
    loadChildren: () =>
      import('./features/users/user-management.module').then((m) => m.UserManagementModule),
    data: { breadcrumb: 'breadcrumbs.userManagement' }
  },
  {
    path: 'configuration',
    loadChildren: () =>
      import('./features/configuration/configuration.module').then((m) => m.ConfigurationModule),
    data: { breadcrumb: 'breadcrumbs.configuration' }
  },
  { path: '**', redirectTo: 'home' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
