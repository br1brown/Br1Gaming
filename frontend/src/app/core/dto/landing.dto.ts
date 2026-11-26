import type { CheckoutRequest } from './checkout.dto';

/** Pagina landing (allineata ai record C# di `backend/Models/Landing.cs`): una lista di sezioni
 *  tipizzate, già nella lingua della richiesta. `type` è il discriminatore. */
export interface LandingPage {
    title: string;
    description: string;
    sections: LandingSection[];
}

export interface LandingImage { asset: string; alt: string; }
export interface TitledItem { title: string; text: string; }

export interface HeroSection {
    type: 'hero'; id: string;
    brand: string; headline: string; subheadline: string; body: string[];
    image?: LandingImage;
}
export interface FeatureListSection {
    type: 'featureList'; id: string;
    heading: string; intro?: string; items: TitledItem[];
}
export interface StepsSection {
    type: 'steps'; id: string;
    heading: string; headingLevel: number; items: TitledItem[];
}
export interface ProseSection {
    type: 'prose'; id: string;
    heading: string; paragraphs: string[];
}

export interface PricingDetail { label: string; lead?: string; text: string; }
/** Messaggio di un alert con un solo pulsante di conferma (`NotificationService.alert`). */
export interface AlertDialog { title: string; message: string; confirmLabel: string; }
export interface PricingPlan {
    id: string; name: string; badge?: string;
    price: string; period: string; featured: boolean;
    details: PricingDetail[];
    ctaLabel: string;
    /** Piano gratuito: un alert. Uno solo fra `dialog` e `checkout`. */
    dialog?: AlertDialog;
    /** Piano a pagamento: manda a `/checkout`. */
    checkout?: CheckoutRequest;
    /** «N persone stanno guardando questo piano»: un numero che oscilla fra `min` e `max`. */
    viewers?: ViewersSpec;
    /** Frase di scarsità («Ultimo partner disponibile…»). */
    scarcity?: string;
}
export interface ViewersSpec { text: string; min: number; max: number; }
export interface PricingSection {
    type: 'pricing'; id: string;
    heading: string; plans: PricingPlan[];
}

export interface FaqItem { question: string; answer: string; }
export interface FaqSection {
    type: 'faq'; id: string;
    heading: string; items: FaqItem[];
}
/** Badge di scaricamento sul modello di quelli dei negozi: riga piccola sopra, grande sotto, icona FA. */
export interface StoreBadge { subLabel: string; label: string; icon: string; dialog: AlertDialog; }
export interface CtaSection {
    type: 'cta'; id: string;
    heading: string; body: string[]; note?: string;
    badges?: StoreBadge[];
}

/** Pressione sul visitatore in stile dark pattern (parodia). */
export interface CountdownSpec { text: string; minutes: number; }
export interface PurchaseToasts { messages: string[]; intervalSeconds: number; max: number; }
export interface PressureSection {
    type: 'pressure'; id: string;
    countdown?: CountdownSpec;
    exit?: AlertDialog;
    purchases?: PurchaseToasts;
}

export type LandingSection =
    | HeroSection | FeatureListSection | StepsSection | ProseSection
    | PricingSection | FaqSection | CtaSection | PressureSection;
