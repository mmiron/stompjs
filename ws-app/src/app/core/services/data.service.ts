import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DataRecord } from '../../shared/models/data.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly dataApiUrl = `${environment.apiBaseUrl}/api/data`;

  constructor(private httpClient: HttpClient) {
  }

  fetchData() {
    return this.httpClient.get<DataRecord[]>(this.dataApiUrl);
  }
}
