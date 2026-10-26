// Root component: loads the people list once, then renders the routed app.
import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApiService } from './core/api/api.service';
import { SessionService } from './core/auth/session.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private api = inject(ApiService);
  private session = inject(SessionService);

  ngOnInit() {
    this.api.people().subscribe(people => this.session.people.set(people));
  }
}
