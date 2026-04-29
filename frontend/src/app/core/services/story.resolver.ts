import { ResolveFn } from '@angular/router';
import { StoryInfo } from '../dto/story.dto';

/**
 * Resolver statico per le pagine storia.
 * Non chiama nessuna API: restituisce i metadati hardcoded in site.ts.
 * Permette all'SSR di scrivere title e description corretti senza rischio di errori HTTP.
 */
export function storyStaticResolver(info: StoryInfo): ResolveFn<StoryInfo> {
    return () => Promise.resolve(info);
}
