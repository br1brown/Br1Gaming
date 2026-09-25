import { Component, computed, input, inject, OnDestroy } from '@angular/core';
import { BaseActionComponent } from '../base/base-action.component';
import { BusyIconComponent } from '../busy-icon/busy-icon.component';
import { SpeechService } from '../../services/speech.service';

@Component({
    selector: 'app-speech-action',
    standalone: true,
    imports: [BusyIconComponent],
    templateUrl: './speech-action.component.html',
})
export class SpeechActionComponent extends BaseActionComponent implements OnDestroy {
    private readonly speech = inject(SpeechService);

    protected readonly defaultLabelKey = 'speechPlay';

    /** Funzione che restituisce il testo da leggere (sync o async). */
    readonly action = input.required<() => string | Promise<string>>();

    /** Chiave i18n per la label in stato "in riproduzione". */
    readonly labelStop = input<string>();

    /** Lingua di lettura (BCP-47, es. `es-ES`) quando il testo NON è nella lingua dell'app; assente = lingua corrente. */
    readonly lang = input<string | null>(null);

    readonly isSpeaking = this.speech.isSpeaking;

    override readonly displayLabel = computed(() =>
        this.isSpeaking()
            ? this.translate.translate(this.labelStop() ?? 'speechStop')
            : this.translate.translate(this.label() ?? this.defaultLabelKey)
    );

    protected onClick(): void {
        if (this.isSpeaking()) {
            this.speech.stop();
            return;
        }
        void this.run(async () => {
            const text = await this.action()();
            this.speech.speak(text, this.lang() ? { lang: this.lang()! } : undefined);
        });
    }

    ngOnDestroy(): void {
        this.speech.stop();
    }
}
