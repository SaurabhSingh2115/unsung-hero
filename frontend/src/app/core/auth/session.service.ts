// Current demo user (persona switcher). Stored in localStorage; sent as X-User-Id.
import { Injectable, computed, signal } from '@angular/core';
import {
  DEFAULT_HERO_ID,
  DEFAULT_UNBLOCKED_PEER_ID,
  STORAGE_KEY_CHAT_USER_ID,
  STORAGE_KEY_USER_ID,
} from '../constants';
import { Person } from '../models';

@Injectable({ providedIn: 'root' })
export class SessionService {
  /** Persona used in the Unsung app. Defaults to Priya (hero). */
  readonly userId = signal<string>(localStorage.getItem(STORAGE_KEY_USER_ID) ?? DEFAULT_HERO_ID);
  /** Persona used in the Chat clone (separate, so you can chat as Arjun while viewing Unsung as Karan). */
  readonly chatUserId = signal<string>(localStorage.getItem(STORAGE_KEY_CHAT_USER_ID) ?? DEFAULT_UNBLOCKED_PEER_ID);
  readonly people = signal<Person[]>([]);

  readonly user = computed(() => this.people().find(p => p.id === this.userId()) ?? null);
  readonly chatUser = computed(() => this.people().find(p => p.id === this.chatUserId()) ?? null);
  readonly isManager = computed(() => this.user()?.role === 'manager');

  person(id: string | null | undefined): Person | undefined {
    return this.people().find(p => p.id === id);
  }

  setUser(id: string | null) {
    const effective = id ?? DEFAULT_HERO_ID;
    this.userId.set(effective);
    if (id) localStorage.setItem(STORAGE_KEY_USER_ID, id); else localStorage.removeItem(STORAGE_KEY_USER_ID);
  }
  setChatUser(id: string) {
    this.chatUserId.set(id);
    localStorage.setItem(STORAGE_KEY_CHAT_USER_ID, id);
  }
}
