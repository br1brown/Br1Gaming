/** Metadati statici di una storia, risolti in SSR senza chiamate API. */
export interface StoryInfo {
    displayTitle: string;
    description: string;
}

export interface StorySummary {
    slug: string;
    title: string;
    description: string;
}

export interface ChoiceItem {
    id: string;
    text: string;
}

export interface StorySnapshotDto {
    storySlug: string;
    storyTitle: string;
    sceneId: string;
    sceneText: string;
    choices: ChoiceItem[];
    isEnding: boolean;
    consequences?: string;
    chosenChoiceText?: string;
    endingTitle?: string;
    stats: Record<string, number>;
}

export type StoryTimelineItem =
    | { type: 'scene'; sceneId: string; text: string }
    | { type: 'choice'; text: string }
    | { type: 'consequence'; text: string }
    | { type: 'ending'; sceneId: string; text: string; title?: string };
