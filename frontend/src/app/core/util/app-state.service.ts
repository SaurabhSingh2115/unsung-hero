// App-wide state for the Unsung UI: config (Gemini on/off, team id) and the unthanked-helpers count badge.
import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { SessionService } from '../auth/session.service';
import { AppConfig } from '../models';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private api = inject(ApiService);
  private session = inject(SessionService);

  readonly config = signal<AppConfig | null>(null);
  readonly configError = signal(false);
  readonly unthankedCount = signal(0);

  get teamId(): string { return this.config()?.team_id ?? 'payments'; }
  get toolName(): string { return this.config()?.recognition_tool_name ?? 'gThanks'; }

  loadConfig(): void {
    this.api.config().subscribe({
      next: c => { this.config.set(c); this.configError.set(false); },
      error: () => this.configError.set(true),
    });
  }

  refreshUnthanked(): void {
    const id = this.session.userId();
    if (!id) { this.unthankedCount.set(0); return; }
    this.api.unthankedHelpers(id).subscribe({
      next: list => this.unthankedCount.set(list.length),
      error: () => this.unthankedCount.set(0),
    });
  }
}
