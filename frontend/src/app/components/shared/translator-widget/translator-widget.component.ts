import { Component, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { ApiService } from '../../../core/services/api.service';
import { PageType } from '../../../site';

/**
 * Micro-tool "+S": una riga, un campo, la gag subito sotto (BR1-UI §3.C). Versione ridotta della
 * pagina `/utility/translator` (stesso `api.tradurre` con debounce, stesso backend C#) — qui senza
 * TTS/copia/condividi, solo input→output immediato, con link alla pagina completa per quelli.
 */
@Component({
    selector: 'app-translator-widget',
    standalone: true,
    imports: [TranslatePipe, PageDirective],
    templateUrl: './translator-widget.component.html',
    styleUrl: './translator-widget.component.css',
})
export class TranslatorWidgetComponent {
    private readonly api = inject(ApiService);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    protected readonly PageType = PageType;
    protected readonly maxChars = 300;

    protected readonly testo = signal('');
    protected readonly tradotto = signal('');
    protected readonly loading = signal(false);

    private timer?: ReturnType<typeof setTimeout>;
    private richiesta = 0;

    constructor() {
        effect(() => {
            const t = this.testo();
            if (!this.isBrowser) return;
            clearTimeout(this.timer);
            if (!t.trim()) { this.tradotto.set(''); this.loading.set(false); return; }
            this.loading.set(true);
            const mia = ++this.richiesta;
            this.timer = setTimeout(() => {
                this.api.tradurre(t)
                    .then(res => { if (mia === this.richiesta) this.tradotto.set(res); })
                    .catch(() => { /* errore silenzioso: si tiene l'ultima traduzione valida */ })
                    .finally(() => { if (mia === this.richiesta) this.loading.set(false); });
            }, 350);
        });
    }

    protected onInput(event: Event): void {
        this.testo.set((event.target as HTMLInputElement).value);
    }
}
