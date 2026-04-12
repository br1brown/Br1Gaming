import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/**
 * Setter puro per titolo browser e meta tag SEO (description, og:*, twitter:*).
 *
 * Riceve valori già pronti e li applica direttamente — nessuna formattazione,
 * nessuna logica di default. Quella responsabilità appartiene a chi chiama.
 *
 * Uso tipico in un componente con contenuto dinamico:
 *   private readonly pageMeta = inject(PageMetaService);
 *   this.pageMeta.setTitle('Titolo già formattato', 'Descrizione pagina');
 */
@Injectable({ providedIn: 'root' })
export class PageMetaService {
    private readonly title = inject(Title);
    private readonly meta = inject(Meta);

    setTitle(title: string, description: string): void {
        this.title.setTitle(title);
        this.meta.updateTag({ name: 'description', content: description });
        this.meta.updateTag({ property: 'og:description', content: description });
        this.meta.updateTag({ property: 'og:title', content: title });
        this.meta.updateTag({ name: 'twitter:description', content: description });
    }
}
