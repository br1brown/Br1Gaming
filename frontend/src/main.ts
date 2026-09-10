import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => {
    console.error(err);
    renderFatalBootError();
  });

/**
 * Bootstrap fallito (appInitializer o simili): l'albero dei componenti — quindi anche
 * `ErrorComponent`/il router — non esiste mai, `<app-root>` è rimasto vuoto. Serve markup
 * puro, senza dipendere da TranslateService (proprio ciò che può aver fallito) né da Angular:
 * qui il framework non è mai partito. Stile via classi Bootstrap (già nel bundle CSS, caricato
 * a parte dal JS) così resta coerente col resto del sito e col tema chiaro/scuro impostato da
 * theme-init.js su <html> prima di questo script.
 */
function renderFatalBootError(): void {
  const it = (navigator.language || '').toLowerCase().startsWith('it');
  const text = it
    ? {
        title: 'Impossibile avviare l\'app',
        body: 'Si è verificato un problema durante il caricamento. Riprova tra qualche istante.',
        retry: 'Ricarica'
      }
    : {
        title: 'Unable to start the app',
        body: 'Something went wrong while loading. Please try again in a moment.',
        retry: 'Reload'
      };

  document.title = `${text.title} | ${environment.appName}`;
  document.body.innerHTML = `
    <div class="d-flex flex-column align-items-center justify-content-center text-center p-4" style="min-height: 100dvh;">
      <h1 class="h4 mb-2">${text.title}</h1>
      <p class="text-body-secondary mb-4">${text.body}</p>
      <button type="button" class="btn btn-primary" onclick="location.reload()">${text.retry}</button>
    </div>
  `;
}
