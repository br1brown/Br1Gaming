/**
 * Verifica che OGNI faccia di OGNI voce di `SYSTEM_FONTS` (font-system.ts) esista davvero su
 * disco — l'unico modo genuino di sapere se i pacchetti Alpine installati dal Dockerfile
 * (`apk add ... $FONT_PACKAGES`) coprono per intero l'enum `SystemFont`, non solo alla data in cui
 * qualcuno l'ha verificato a mano. Un fallimento qui è quasi sempre una di due cose: un font
 * aggiunto a `SYSTEM_FONTS` senza aggiornare `FONT_PACKAGES` nel Dockerfile, o un pacchetto Alpine
 * che ha cambiato nome/percorso interno da una release all'altra.
 *
 * Uso: tsx system-fonts-installed.ts, invocato direttamente dal Dockerfile (RUN, stage di build).
 * Ha senso SOLO dove i pacchetti sono realmente installati — dentro il container Docker: eseguito
 * su un host qualunque fallisce sempre, di proposito, perché i file non ci sono per definizione —
 * non è quindi cablato nel gate "frontend" (bare, senza Docker, in CI), ma nello stage di build del
 * Dockerfile, l'unico punto dove il check e i file installati sono garantiti sincroni fra loro.
 */
import { SystemFont, SYSTEM_FONTS } from '../../font-system';
import { existsSync } from 'node:fs';

let failures = 0;
let checked = 0;
function fail(message: string): void {
    console.error(`[system-fonts-check] ${message}`);
    failures++;
}

for (const key of Object.values(SystemFont)) {
    const def = SYSTEM_FONTS[key];
    def.faces.forEach((face, index) => {
        checked++;
        if (!existsSync(face.file)) {
            fail(`SystemFont.${key}, faccia #${index} (${face.weight} ${face.style}): file assente — ${face.file}`);
        }
    });
}

if (failures > 0) {
    console.error(
        `[system-fonts-check] ${failures}/${checked} facce mancanti — i pacchetti Alpine installati ` +
        `(FONT_PACKAGES nel Dockerfile) non coprono per intero SYSTEM_FONTS. Aggiorna FONT_PACKAGES, ` +
        `o se il percorso di un pacchetto è cambiato aggiorna SYSTEM_FONTS in font-system.ts.`
    );
    process.exit(1);
}

console.log(`[system-fonts-check] OK — ${checked} facce su ${Object.values(SystemFont).length} SystemFont, tutte presenti su disco`);
