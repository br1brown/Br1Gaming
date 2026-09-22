/** Verifica che OGNI faccia di OGNI voce di `SYSTEM_FONTS` esista su disco — unico modo genuino di
 *  sapere se i pacchetti Alpine del Dockerfile (`apk add ... $FONT_PACKAGES`) coprono per intero
 *  l'enum `SystemFont`. Un fallimento qui è quasi sempre un font aggiunto senza aggiornare
 *  `FONT_PACKAGES`, o un pacchetto che ha cambiato nome/percorso da una release all'altra. Uso: tsx
 *  system-fonts-installed.ts, invocato dal Dockerfile (RUN, stage di build) — fallisce sempre fuori
 *  dal container per definizione, di proposito non cablato nel gate "frontend" bare in CI. */
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
