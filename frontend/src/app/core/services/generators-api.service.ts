import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GeneratorInfo, GenerateRequest, GenerateResponse } from '../dto/generator.dto';

const BASE_URL = '/api/generators';

@Injectable({ providedIn: 'root' })
export class GeneratorsApiService {
    private readonly http = inject(HttpClient);

    getGenerators(): Observable<GeneratorInfo[]> {
        return this.http.get<GeneratorInfo[]>(BASE_URL);
    }

    getGenerator(slug: string): Observable<GeneratorInfo> {
        return this.http.get<GeneratorInfo>(`${BASE_URL}/${slug}`);
    }

    generate(slug: string, req: GenerateRequest): Observable<GenerateResponse> {
        return this.http.post<GenerateResponse>(`${BASE_URL}/${slug}/generate`, req);
    }
}
