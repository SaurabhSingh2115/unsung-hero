// Guards that wait for the people list (so role is known on a hard refresh).
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiService } from '../api/api.service';
import { SessionService } from '../auth/session.service';

export function homeUrl(session: SessionService): string {
  if (!session.userId()) return '/login';
  return session.isManager() ? '/manager/team' : '/me';
}

function withPeople<T>(fn: () => T): Observable<T> {
  const session = inject(SessionService);
  const api = inject(ApiService);
  if (session.people().length) return of(fn());
  return api.people().pipe(
    map(p => { session.people.set(p); return fn(); }),
    catchError(() => of(fn())),
  );
}

/** '' → home for the current persona. */
export const homeRedirectGuard: CanActivateFn = (): Observable<UrlTree> => {
  const session = inject(SessionService);
  const router = inject(Router);
  return withPeople(() => router.parseUrl(homeUrl(session)));
};

/** Manager-only, but waits for the people list first. */
export const managerReadyGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const session = inject(SessionService);
  const router = inject(Router);
  return withPeople(() => {
    if (!session.userId()) return router.parseUrl('/login');
    return session.isManager() ? true : router.parseUrl('/me');
  });
};
