// Helpers for in-app links stored on activities ("/chat/space?msg=m-1" or "/source/A-0042").

export interface ParsedLink { path: string; queryParams: Record<string, string>; }

export function parseLink(link: string | null | undefined): ParsedLink {
  if (!link) return { path: '/', queryParams: {} };
  const [path, qs] = link.split('?');
  const queryParams: Record<string, string> = {};
  new URLSearchParams(qs ?? '').forEach((v, k) => (queryParams[k] = v));
  return { path, queryParams };
}

export function isChatLink(link: string | null | undefined): boolean {
  return !!link && link.startsWith('/chat');
}
