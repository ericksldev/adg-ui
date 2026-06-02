import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AnimalBatchCreateRequestBody, AnimalBatchCreateResultDto } from '../models/animal-batch-create.model';
import { AnimalCreatePayload } from '../models/animal-create-payload.model';
import { CattleBreedCode } from '../constants/cattle-breeds';

export interface BreedOptionDto {
  code: CattleBreedCode;
}

export interface ParentOptionDto {
  animal_uuid: string;
  registration_number: string;
}

export interface PaddockOptionDto {
  paddock_uuid: string;
  name: string;
}

export interface OwnerOptionDto {
  owner_uuid: string;
  full_name: string;
}

interface ApiItemResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AnimalApiService {
  private readonly animalUrl = `${environment.urlApi}/animal`;
  private readonly ranchUrl = `${environment.urlApi}/ranch`;
  private readonly ownerUrl = `${environment.urlApi}/owner`;

  constructor(private readonly http: HttpClient) {}

  getBreeds(): Observable<BreedOptionDto[]> {
    return this.http
      .get<{ success: boolean; data: BreedOptionDto[] }>(`${this.animalUrl}/breeds`)
      .pipe(map((r) => r.data ?? []));
  }

  getParentOptions(ranchUuid: string, sex: 'MALE' | 'FEMALE'): Observable<ParentOptionDto[]> {
    const params = { ranch_uuid: ranchUuid, sex };
    return this.http
      .get<{ success: boolean; data: ParentOptionDto[] }>(`${this.animalUrl}/parents`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  getPaddocksForRanch(ranchUuid: string): Observable<PaddockOptionDto[]> {
    return this.http
      .get<{ success: boolean; data: PaddockOptionDto[] }>(`${this.ranchUrl}/${ranchUuid}/paddocks`)
      .pipe(map((r) => r.data ?? []));
  }

  getOwners(): Observable<OwnerOptionDto[]> {
    return this.http.get<{ success: boolean; data: OwnerOptionDto[] }>(this.ownerUrl).pipe(map((r) => r.data ?? []));
  }

  createAnimal(payload: AnimalCreatePayload): Observable<unknown> {
    return this.http.post<ApiItemResponse<unknown>>(this.animalUrl, payload).pipe(map((r) => r.data));
  }

  createAnimalsBatch(body: AnimalBatchCreateRequestBody): Observable<AnimalBatchCreateResultDto> {
    return this.http
      .post<ApiItemResponse<AnimalBatchCreateResultDto>>(`${this.animalUrl}/batch`, body)
      .pipe(map((r) => r.data as AnimalBatchCreateResultDto));
  }
}
