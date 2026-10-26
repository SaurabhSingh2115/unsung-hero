// Blocks routes by role
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

/** Requires a selected persona. */
export const signedInGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.userId() ? true : inject(Router).parseUrl('/login');
};

/** Requires the selected persona to be a manager. */
export const managerGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (!session.userId()) return inject(Router).parseUrl('/login');
  return session.isManager() ? true : inject(Router).parseUrl('/me');
};
