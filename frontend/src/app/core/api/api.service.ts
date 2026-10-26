// Calls backend endpoints
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Activity, Alert, Annotation, AppConfig, BiasCheck, BragDoc, ChatMessage, ChatSpace, Digest, Draft,
  EvidenceItem, OneOnOne, Person, PipelineStatus, Profile, Project, Recognition, SourceRecord, TeamGraph,
  TeamStats, ThankDraft, Translation, UnthankedHelper,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl + '/api';

  // ---- people / config ----
  people(): Observable<Person[]> { return this.http.get<Person[]>(`${this.base}/people`); }
  me(): Observable<Person> { return this.http.get<Person>(`${this.base}/me`); }
  config(): Observable<AppConfig> { return this.http.get<AppConfig>(`${this.base}/config`); }
  projects(): Observable<Project[]> { return this.http.get<Project[]>(`${this.base}/projects`); }
  setOptIn(personId: string, opted_in: boolean): Observable<Person> {
    return this.http.put<Person>(`${this.base}/person/${personId}/opt-in`, { opted_in });
  }

  // ---- team (manager) ----
  teamGraph(teamId: string): Observable<TeamGraph> { return this.http.get<TeamGraph>(`${this.base}/team/${teamId}/graph`); }
  teamAlerts(teamId: string): Observable<Alert[]> { return this.http.get<Alert[]>(`${this.base}/team/${teamId}/alerts`); }
  teamStats(teamId: string): Observable<TeamStats> { return this.http.get<TeamStats>(`${this.base}/team/${teamId}/stats`); }
  biasCheck(teamId: string): Observable<BiasCheck> { return this.http.get<BiasCheck>(`${this.base}/team/${teamId}/bias-check`); }

  // ---- person ----
  profile(personId: string, asManager = false): Observable<Profile> {
    return this.http.get<Profile>(`${this.base}/person/${personId}/profile`, { params: asManager ? { as_manager: 'true' } : {} });
  }
  evidence(personId: string, opts: { dimension?: string; category?: string; asManager?: boolean; limit?: number } = {}): Observable<EvidenceItem[]> {
    let params = new HttpParams();
    if (opts.dimension) params = params.set('dimension', opts.dimension);
    if (opts.category) params = params.set('category', opts.category);
    if (opts.asManager) params = params.set('as_manager', 'true');
    if (opts.limit) params = params.set('limit', opts.limit);
    return this.http.get<EvidenceItem[]>(`${this.base}/person/${personId}/evidence`, { params });
  }
  unthankedHelpers(personId: string): Observable<UnthankedHelper[]> {
    return this.http.get<UnthankedHelper[]>(`${this.base}/person/${personId}/unthanked-helpers`);
  }
  digest(personId: string): Observable<Digest> { return this.http.get<Digest>(`${this.base}/person/${personId}/digest`); }
  thankDraft(personId: string, body: { helper_id: string; activity_ids: string[]; type: 'kudos' | 'peer_bonus' }): Observable<ThankDraft> {
    return this.http.post<ThankDraft>(`${this.base}/person/${personId}/thank-draft`, body);
  }
  sendRecognition(body: { to_id: string; activity_ids: string[]; type: 'kudos' | 'peer_bonus'; message: string }): Observable<Recognition> {
    return this.http.post<Recognition>(`${this.base}/recognition`, body);
  }
  reviewDraft(personId: string): Observable<Draft> { return this.http.post<Draft>(`${this.base}/person/${personId}/review-draft`, {}); }
  promoPacket(personId: string): Observable<Draft> { return this.http.post<Draft>(`${this.base}/person/${personId}/promo-packet`, {}); }
  bragDoc(personId: string): Observable<BragDoc> { return this.http.get<BragDoc>(`${this.base}/person/${personId}/brag-doc`); }
  translate(personId: string, activity_ids: string[]): Observable<Translation[]> {
    return this.http.post<Translation[]>(`${this.base}/person/${personId}/translate`, { activity_ids });
  }
  oneOnOne(personId: string): Observable<OneOnOne> { return this.http.get<OneOnOne>(`${this.base}/person/${personId}/one-on-one`); }

  // ---- activity ----
  activity(activityId: string): Observable<SourceRecord> { return this.http.get<SourceRecord>(`${this.base}/activity/${activityId}`); }
  annotate(activityId: string, body: Partial<Pick<Annotation, 'hidden' | 'note' | 'disputed'>>): Observable<Annotation> {
    return this.http.post<Annotation>(`${this.base}/activity/${activityId}/annotate`, body);
  }
  logActivity(body: { text: string; target_ids: string[]; timestamp: string; project_id?: string | null; request_confirmation: boolean }): Observable<Activity> {
    return this.http.post<Activity>(`${this.base}/activity`, body);
  }

  // ---- pipeline ----
  pipelineStatus(): Observable<PipelineStatus> { return this.http.get<PipelineStatus>(`${this.base}/pipeline/status`); }
  pipelineSync(): Observable<PipelineStatus & { new_activities: number }> {
    return this.http.post<PipelineStatus & { new_activities: number }>(`${this.base}/pipeline/sync`, {});
  }

  // ---- chat clone ----
  chatSpaces(): Observable<ChatSpace[]> { return this.http.get<ChatSpace[]>(`${this.base}/chat/spaces`); }
  chatSpace(spaceId: string): Observable<ChatSpace> { return this.http.get<ChatSpace>(`${this.base}/chat/spaces/${spaceId}`); }
  chatMessages(spaceId: string): Observable<ChatMessage[]> { return this.http.get<ChatMessage[]>(`${this.base}/chat/spaces/${spaceId}/messages`); }
  postChatMessage(spaceId: string, text: string, threadId: string | null = null): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.base}/chat/spaces/${spaceId}/messages`, { text, thread_id: threadId });
  }
  openDm(memberId: string): Observable<ChatSpace> { return this.http.post<ChatSpace>(`${this.base}/chat/dm`, { member_id: memberId }); }
}
