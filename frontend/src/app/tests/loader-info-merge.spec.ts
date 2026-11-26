/** Fusione dell'`info` di un `contentLoader` sul `PageInfo` statico (`mergeLoaderInfo`, `mergeOgImage`):
 *  un campo senza valore non cancella quello della pagina, un tipo sbagliato non entra. */
import '@angular/compiler'; // siteBuilder porta con sé librerie Angular compilate in parziale
import { describe, it, expect } from 'vitest';
import { mergeLoaderInfo, mergeOgImage, type PageInfo } from '../core/engine/siteBuilder';
const pagina = (extra: Partial<PageInfo> = {}): PageInfo => ({ title: 't', path: 'p', isExternal: false, ...extra });

describe('mergeOgImage', () => {
    it('pagina senza immagine e loader senza immagine: resta la card generata', () => {
        expect(mergeOgImage(undefined, undefined)).toBeUndefined();
        expect(mergeOgImage(undefined, {})).toBeUndefined();
        expect(mergeOgImage(undefined, { id: undefined, soloSfondo: true })).toBeUndefined();
    });

    it('loader con campi vuoti o undefined: resta l\'immagine della pagina', () => {
        expect(mergeOgImage({ id: 'img4k' }, { id: undefined, soloSfondo: true })).toEqual({ id: 'img4k', soloSfondo: true });
        expect(mergeOgImage({ blobGuid: 'g1' }, { blobGuid: undefined })).toEqual({ blobGuid: 'g1' });
        expect(mergeOgImage({ id: 'img4k' }, { id: '' })).toEqual({ id: 'img4k' });
        expect(mergeOgImage({ id: 'img4k', soloSfondo: true }, {})).toEqual({ id: 'img4k', soloSfondo: true });
    });

    it('immagine del loader: sostituisce quella della pagina, soloSfondo ereditato se non dichiarato', () => {
        expect(mergeOgImage({ id: 'a', soloSfondo: true }, { blobGuid: 'g' })).toEqual({ blobGuid: 'g', soloSfondo: true });
        expect(mergeOgImage({ id: 'a', soloSfondo: true }, { id: 'b', soloSfondo: false })).toEqual({ id: 'b', soloSfondo: false });
        expect(mergeOgImage(undefined, { id: 'b' })).toEqual({ id: 'b' });
        expect(mergeOgImage(false, { id: 'b' })).toEqual({ id: 'b' });
    });

    it('false: nel loader toglie l\'og:image, nella pagina resta se il loader non porta immagine', () => {
        expect(mergeOgImage({ id: 'a' }, false)).toBe(false);
        expect(mergeOgImage(false, undefined)).toBe(false);
        expect(mergeOgImage(false, { soloSfondo: true })).toBe(false);
    });
});

describe('mergeLoaderInfo', () => {
    const scartati: string[] = [];
    const onScartato = (campo: string) => { scartati.push(campo); };

    it('assente, undefined o null non cancella il valore della pagina', () => {
        const base = pagina({ description: 'd', noindex: true, ogType: 'article', ogImage: { id: 'img4k' } });
        const out = mergeLoaderInfo(base, { description: undefined, noindex: null as never, ogType: '  ', ogImage: undefined }, onScartato);
        expect(out).toEqual(base);
    });

    it('tipo sbagliato o campo sconosciuto: ignorato e segnalato', () => {
        scartati.length = 0;
        const out = mergeLoaderInfo(pagina({ noindex: true }), { noindex: 'false', ignoto: 1 } as never, onScartato);
        expect(out.noindex).toBe(true);
        expect(scartati.sort()).toEqual(['ignoto', 'noindex']);
    });

    it('valori veri del loader vincono; updatedOn in ISO', () => {
        const out = mergeLoaderInfo(pagina({ ogImage: { id: 'a' } }), {
            title: 'nuovo', noindex: false, ogImage: { blobGuid: 'g', soloSfondo: true }, updatedOn: new Date('2026-09-22T10:00:00Z'),
        }, onScartato);
        expect(out.title).toBe('nuovo');
        expect(out.noindex).toBe(false);
        expect(out.ogImage).toEqual({ blobGuid: 'g', soloSfondo: true });
        expect(out.updatedOn).toBe('2026-09-22');
    });
});
