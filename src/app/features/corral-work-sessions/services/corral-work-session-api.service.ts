import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ConfigureCorralWorkPayload,
  CorralSessionAnimalsLoadBody,
  CorralSessionAnimalsSourceBody,
  CorralSessionAnimalsLoadResultDto,
  CorralSessionAnimalsPreviewDto,
  CorralSessionWorkspaceDto,
  CorralStepGridDto,
  CorralWorkSessionDto,
  CreateCorralWorkSessionPayload,
  SaveCorralStepGridPayload,
  UpsertCorralFindingPayload,
  AnimalLookupDto
} from '../models/corral-work-session.model';

interface ApiItemResponse<T> {
  success: boolean;
  data: T;
}

interface ApiListResponse<T> {
  success: boolean;
  data: T[];
}

@Injectable({
  providedIn: 'root'
})
export class CorralWorkSessionApiService {
  private readonly baseUrl = `${environment.urlApi}/corral-work-session`;

  constructor(private readonly http: HttpClient) {}

  listSessions(query?: {
    ranch_uuid?: string;
    status?: string;
    work_date?: string;
    activity_code?: string;
  }): Observable<CorralWorkSessionDto[]> {
    let params = new HttpParams().set('page', '1').set('size', '100').set('sortBy', 'work_date').set('order', 'DESC');
    if (query?.ranch_uuid) params = params.set('ranch_uuid', query.ranch_uuid);
    if (query?.status) params = params.set('status', query.status);
    if (query?.work_date) params = params.set('work_date', query.work_date);
    if (query?.activity_code) params = params.set('activity_code', query.activity_code);
    return this.http.get<ApiListResponse<CorralWorkSessionDto>>(this.baseUrl, { params }).pipe(map((r) => r.data ?? []));
  }

  getSession(uuid: string): Observable<CorralWorkSessionDto> {
    return this.http
      .get<ApiItemResponse<CorralWorkSessionDto>>(`${this.baseUrl}/${uuid}`)
      .pipe(map((r) => r.data));
  }

  getWorkspace(uuid: string): Observable<CorralSessionWorkspaceDto> {
    return this.http
      .get<ApiItemResponse<CorralSessionWorkspaceDto>>(`${this.baseUrl}/${uuid}/workspace`)
      .pipe(map((r) => r.data));
  }

  createSession(payload: CreateCorralWorkSessionPayload): Observable<CorralWorkSessionDto> {
    return this.http.post<ApiItemResponse<CorralWorkSessionDto>>(this.baseUrl, payload).pipe(map((r) => r.data));
  }

  configureWork(sessionUuid: string, payload: ConfigureCorralWorkPayload): Observable<CorralWorkSessionDto> {
    return this.http
      .post<ApiItemResponse<CorralWorkSessionDto>>(`${this.baseUrl}/${sessionUuid}/configure-work`, payload)
      .pipe(map((r) => r.data));
  }

  extendWorkConfiguration(sessionUuid: string, payload: ConfigureCorralWorkPayload): Observable<CorralWorkSessionDto> {
    return this.http
      .post<ApiItemResponse<CorralWorkSessionDto>>(`${this.baseUrl}/${sessionUuid}/extend-work`, payload)
      .pipe(map((r) => r.data));
  }

  scanStepAnimal(sessionUuid: string, stepUuid: string, identifier: string): Observable<CorralStepGridDto> {
    const normalized = identifier.replace(/[\u0000-\u001F\u007F]/g, '').trim();
    return this.http
      .post<ApiItemResponse<CorralStepGridDto>>(
        `${this.baseUrl}/${sessionUuid}/steps/${stepUuid}/scan-animal`,
        { identifier: normalized }
      )
      .pipe(map((r) => r.data));
  }

  previewAnimals(
    sessionUuid: string,
    body: CorralSessionAnimalsSourceBody
  ): Observable<CorralSessionAnimalsPreviewDto> {
    return this.http
      .post<ApiItemResponse<CorralSessionAnimalsPreviewDto>>(`${this.baseUrl}/${sessionUuid}/animals/preview`, body)
      .pipe(map((r) => r.data));
  }

  loadAnimals(
    sessionUuid: string,
    body: CorralSessionAnimalsLoadBody
  ): Observable<CorralSessionAnimalsLoadResultDto> {
    return this.http
      .post<ApiItemResponse<CorralSessionAnimalsLoadResultDto>>(`${this.baseUrl}/${sessionUuid}/animals/load`, body)
      .pipe(map((r) => r.data));
  }

  saveStepGrid(sessionUuid: string, stepUuid: string, payload: SaveCorralStepGridPayload): Observable<CorralStepGridDto> {
    return this.http
      .put<ApiItemResponse<CorralStepGridDto>>(
        `${this.baseUrl}/${sessionUuid}/steps/${stepUuid}/grid`,
        payload
      )
      .pipe(map((r) => r.data));
  }

  lookupAnimal(sessionUuid: string, identifier: string): Observable<AnimalLookupDto> {
    const normalized = identifier.replace(/[\u0000-\u001F\u007F]/g, '').trim();
    const params = new HttpParams().set('identifier', normalized);
    return this.http
      .get<ApiItemResponse<AnimalLookupDto>>(`${this.baseUrl}/${sessionUuid}/lookup-animal`, { params })
      .pipe(map((r) => r.data));
  }

  upsertFinding(sessionUuid: string, payload: UpsertCorralFindingPayload): Observable<void> {
    return this.http
      .post<ApiItemResponse<null>>(`${this.baseUrl}/${sessionUuid}/findings`, payload)
      .pipe(map(() => undefined));
  }

  closeSession(uuid: string): Observable<CorralWorkSessionDto> {
    return this.http
      .post<ApiItemResponse<CorralWorkSessionDto>>(`${this.baseUrl}/${uuid}/close`, {})
      .pipe(map((r) => r.data));
  }

  startSession(uuid: string): Observable<CorralWorkSessionDto> {
    return this.http
      .post<ApiItemResponse<CorralWorkSessionDto>>(`${this.baseUrl}/${uuid}/start`, {})
      .pipe(map((r) => r.data));
  }

  updateStepWorkMode(sessionUuid: string, stepUuid: string, workMode: string): Observable<CorralStepGridDto> {
    return this.http
      .patch<ApiItemResponse<CorralStepGridDto>>(
        `${this.baseUrl}/${sessionUuid}/steps/${stepUuid}/work-mode`,
        { work_mode: workMode }
      )
      .pipe(map((r) => r.data));
  }

  appendAnimalsToStep(
    sessionUuid: string,
    stepUuid: string,
    body: CorralSessionAnimalsSourceBody
  ): Observable<CorralStepGridDto> {
    return this.http
      .post<ApiItemResponse<CorralStepGridDto>>(
        `${this.baseUrl}/${sessionUuid}/steps/${stepUuid}/append-animals`,
        body
      )
      .pipe(map((r) => r.data));
  }
}
