import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslateService } from '../../services/translate.service';

/** Override opzionale dei testi del form. */
export interface UploadFormLabels {
    /** Testo della dropzone quando nessun file è selezionato. */
    dropzoneText?: string;
    /** Etichetta sopra il nome file, selezione singola ("File selezionato:"). */
    fileChosenLabel?: string;
    /** Messaggio per la selezione multipla (riceve il conteggio come `{0}`). */
    filesChosenLabel?: string;
    /** Testo del bottone a riposo. */
    submitLabel?: string;
    /** Testo del bottone durante il caricamento. */
    uploadingLabel?: string;
    /** Errore: submit senza aver selezionato nulla. */
    noFileError?: string;
    /** Errore: file oltre `maxSize`. */
    tooLargeError?: string;
    /** Errore: estensione/MIME non in `accept`. */
    typeNotAllowedError?: string;
}

/** Form di selezione file con supporto click e drag-and-drop. */
@Component({
    selector: 'app-upload-form',
    imports: [],
    templateUrl: './upload-form.component.html',
})
export class UploadFormComponent {
    private readonly translate = inject(TranslateService);

    /** Emesso quando l'utente conferma la selezione (preme il bottone). */
    readonly filesConfirmed = output<File[]>();

    /** Emesso non appena la selezione cambia (file scelti o azzerati da una validazione fallita). */
    readonly filesSelected = output<File[]>();

    /** Estensioni o tipi MIME accettati (es. ['.pdf', 'image/*']). Vuoto = nessun filtro. */
    readonly accept = input<string[]>([]);

    /** Dimensione massima in byte per singolo file (0 = nessun limite). */
    readonly maxSize = input<number>(0);

    /** Consente la selezione di più file insieme (click multiplo o drag-and-drop di un gruppo). */
    readonly multiple = input<boolean>(false);

    /** Stato di caricamento gestito dal padre (disabilita il form e mostra lo spinner). */
    readonly isLoading = input<boolean>(false);

    /** Eventuale messaggio di errore passato dal padre (es. errore API), oltre a quelli di validazione. */
    readonly externalError = input<string | null>(null);

    /** Override opzionale dei testi — vedi {@link UploadFormLabels}. */
    readonly labels = input<UploadFormLabels>({});

    protected readonly acceptAttr = computed(() => {
        const arr = this.accept();
        return arr.length > 0 ? arr.join(',') : null;
    });

    protected readonly dropzoneText = computed(() =>
        this.labels().dropzoneText ?? this.translate.translate('uploadAreaTrascinamento'));
    protected readonly fileChosenLabel = computed(() =>
        this.labels().fileChosenLabel ?? this.translate.translate('uploadFileScelto'));
    protected readonly submitLabel = computed(() =>
        this.labels().submitLabel ?? this.translate.translate('uploadAzione'));
    protected readonly uploadingLabel = computed(() =>
        this.labels().uploadingLabel ?? this.translate.translate('uploadCaricamento'));

    /** Riepilogo per la selezione multipla (>1 file): conteggio via `{0}`. */
    protected readonly multipleChosenLabel = computed(() =>
        this.labels().filesChosenLabel
        ?? this.translate.translate('uploadFileMultipliScelti', this.selectedFiles().length));

    protected readonly errorMessage = signal<string | null>(null);
    protected readonly selectedFiles = signal<File[]>([]);
    protected readonly isDragging = signal(false);

    protected onFileSelected(event: Event): void {
        const target = event.target as HTMLInputElement;
        const files = Array.from(target.files ?? []);
        // Azzera il valore per consentire la riselezione dello stesso file
        target.value = '';
        this.setFilesIfAllowed(files);
    }

    protected onDragOver(event: DragEvent): void {
        event.preventDefault();
        if (!this.isLoading()) {
            this.isDragging.set(true);
        }
    }

    protected onDragLeave(event: DragEvent): void {
        // Ignora i leave verso figli interni dell'area
        const area = (event.currentTarget as HTMLElement);
        if (area.contains(event.relatedTarget as Node)) return;
        this.isDragging.set(false);
    }

    protected onDrop(event: DragEvent): void {
        event.preventDefault();
        this.isDragging.set(false);
        if (this.isLoading()) return;

        const files = Array.from(event.dataTransfer?.files ?? []);
        this.setFilesIfAllowed(files);
    }

    /** Valida i file selezionati secondo i filtri `accept` e `multiple`. */
    private setFilesIfAllowed(files: File[]): void {
        const picked = this.multiple() ? files : files.slice(0, 1);
        if (picked.length === 0) {
            this.setFiles([]);
            return;
        }

        for (const file of picked) {
            if (!this.isExtensionAllowed(file)) {
                this.errorMessage.set(this.labels().typeNotAllowedError
                    ?? this.translate.translate('uploadFileNonAmmesso'));
                this.setFiles([]);
                return;
            }
        }
        this.setFiles(picked);
    }

    private setFiles(files: File[]): void {
        if (files.length > 0 && this.maxSize() > 0 && files.some(f => f.size > this.maxSize())) {
            this.errorMessage.set(this.labels().tooLargeError
                ?? this.translate.translate('uploadFileTroppoGrande'));
            this.selectedFiles.set([]);
            this.filesSelected.emit([]);
            return;
        }
        this.selectedFiles.set(files);
        this.filesSelected.emit(files);
        this.errorMessage.set(null);
    }

    private isExtensionAllowed(file: File): boolean {
        const allowed = this.accept();
        if (allowed.length === 0) return true; // Nessun filtro applicato

        const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
        const fileMime = file.type.toLowerCase();

        return allowed.some(p => {
            p = p.trim().toLowerCase();
            if (p.startsWith('.')) {
                return p === fileExt;
            }
            if (p.endsWith('/*')) {
                const baseMime = p.replace('/*', '');
                return fileMime.startsWith(baseMime);
            }
            return p === fileMime;
        });
    }

    protected onSubmit(): void {
        const files = this.selectedFiles();
        if (files.length === 0) {
            this.errorMessage.set(this.labels().noFileError
                ?? this.translate.translate('uploadNessunFile'));
            return;
        }

        this.errorMessage.set(null);
        this.filesConfirmed.emit(files);
    }
}
