import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StorySummary, StorySnapshotDto } from '../dto/story.dto';

const BASE_URL = '/api/stories';

@Injectable({ providedIn: 'root' })
export class StoriesApiService {
    private readonly http = inject(HttpClient);

    getStories(): Observable<StorySummary[]> {
        return this.http.get<StorySummary[]>(BASE_URL);
    }

    startStory(slug: string): Observable<StorySnapshotDto> {
        return this.http.post<StorySnapshotDto>(`${BASE_URL}/${slug}/start`, {});
    }

    resumeStory(slug: string, sceneId: string, stats: Record<string, number>): Observable<StorySnapshotDto> {
        return this.http.post<StorySnapshotDto>(`${BASE_URL}/${slug}/resume`, { sceneId, stats });
    }

    choose(slug: string, currentSceneId: string, choiceId: string, stats: Record<string, number>): Observable<StorySnapshotDto> {
        return this.http.post<StorySnapshotDto>(
            `${BASE_URL}/${slug}/choose`,
            { currentSceneId, choiceId, stats }
        );
    }
}
