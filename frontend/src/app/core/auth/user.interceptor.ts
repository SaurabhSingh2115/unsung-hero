// Adds current user header to requests.
// Chat clone requests (/api/chat/*) use the chat persona; everything else uses the Unsung persona.
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionService } from './session.service';

export const userInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const isChat = req.url.includes('/api/chat');
  const id = isChat ? session.chatUserId() : session.userId();
  if (!id) return next(req);
  return next(req.clone({ setHeaders: { 'X-User-Id': id } }));
};
