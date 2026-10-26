// App routes
// - /chat/**  : "Chat" — a Google-Chat-like clone where personas talk. Its data is the chat source for Unsung.
// - everything else : the Unsung app (manager + employee views) inside the Unsung shell.
import { Routes } from '@angular/router';
import { signedInGuard } from './core/auth/role.guard';
import { homeRedirectGuard, managerReadyGuard } from './core/util/guards';

export const routes: Routes = [
  // ---- Chat clone (owned by features/chat) ----
  { path: 'chat', loadComponent: () => import('./features/chat/chat-page').then(m => m.ChatPage) },
  { path: 'chat/:spaceId', loadComponent: () => import('./features/chat/chat-page').then(m => m.ChatPage) },

  // ---- Unsung app routes are added below (owned by the Unsung UI) ----
  { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },
  { path: 'login', title: 'Unsung — choose a persona', loadComponent: () => import('./features/login/login-page').then(m => m.LoginPage) },
  {
    path: '',
    canActivate: [signedInGuard],
    loadComponent: () => import('./layout/shell').then(m => m.Shell),
    children: [
      {
        path: 'manager',
        canActivate: [managerReadyGuard],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'team' },
          { path: 'team', title: 'Unsung — Team', loadComponent: () => import('./features/manager/team-page').then(m => m.TeamPage) },
          { path: 'alerts', title: 'Unsung — Alerts', loadComponent: () => import('./features/manager/alerts-page').then(m => m.AlertsPage) },
          { path: 'review', title: 'Unsung — Review drafts', loadComponent: () => import('./features/manager/review-page').then(m => m.ReviewPage) },
          { path: 'review/:id', title: 'Unsung — Review draft', loadComponent: () => import('./features/manager/review-page').then(m => m.ReviewPage) },
          { path: 'one-on-one', title: 'Unsung — 1:1 Prep', loadComponent: () => import('./features/manager/one-on-one-page').then(m => m.OneOnOnePage) },
          { path: 'one-on-one/:id', title: 'Unsung — 1:1 Prep', loadComponent: () => import('./features/manager/one-on-one-page').then(m => m.OneOnOnePage) },
          { path: 'bias', title: 'Unsung — Bias check', loadComponent: () => import('./features/manager/bias-page').then(m => m.BiasPage) },
        ],
      },
      { path: 'person/:id', title: 'Unsung — Profile', canActivate: [managerReadyGuard], loadComponent: () => import('./features/profile/profile-page').then(m => m.ProfilePage) },

      { path: 'me', title: 'Unsung — My profile', loadComponent: () => import('./features/profile/profile-page').then(m => m.ProfilePage) },
      { path: 'me/brag', title: 'Unsung — Brag doc', loadComponent: () => import('./features/employee/brag-page').then(m => m.BragPage) },
      { path: 'me/promo', title: 'Unsung — Promotion packet', loadComponent: () => import('./features/employee/promo-page').then(m => m.PromoPage) },
      { path: 'me/thanks', title: 'Unsung — Say thanks', loadComponent: () => import('./features/employee/thanks-page').then(m => m.ThanksPage) },
      { path: 'me/privacy', title: 'Unsung — Privacy', loadComponent: () => import('./features/employee/privacy-page').then(m => m.PrivacyPage) },
      { path: 'me/log', title: 'Unsung — Log activity', loadComponent: () => import('./features/employee/log-page').then(m => m.LogPage) },

      { path: 'source/:activityId', title: 'Unsung — Source', loadComponent: () => import('./features/source/source-page').then(m => m.SourcePage) },
      { path: 'pipeline', title: 'Unsung — Data pipeline', loadComponent: () => import('./features/pipeline/pipeline-page').then(m => m.PipelinePage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
