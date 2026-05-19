import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { OwnerListItem } from '../models/owner-list-item.model';

@Injectable({
  providedIn: 'root'
})
export class OwnerManagementService {
  private readonly ownerUrl = `${environment.urlApi}/owner`;

  constructor(private readonly http: HttpClient) {}

  getOwners(): Observable<OwnerListItem[]> {
    return this.http
      .get<{ success: boolean; data: OwnerListItem[] }>(this.ownerUrl)
      .pipe(map((r) => r.data ?? []));
  }
}
