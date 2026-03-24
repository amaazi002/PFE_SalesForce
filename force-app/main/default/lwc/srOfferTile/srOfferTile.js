// force-app/main/default/lwc/srOfferTile/srOfferTile.js
import { LightningElement, api } from 'lwc';

export default class SrOfferTile extends LightningElement {

    @api offer;

    // ── Titre ─────────────────────────────────────────────────────
    get titreText() {
        return this.offer?.Titre__c || '—';
    }

    // ── Description : 3 lignes max (200 caractères) ───────────────
    get descriptionText() {
        const desc = this.offer?.Description__c || '—';
        return desc.length > 200 ? desc.substring(0, 200) + '...' : desc;
    }

    // ── Département ───────────────────────────────────────────────
    get departementText() {
        return this.offer?.Departement__c || '—';
    }

    // ── Localisation ──────────────────────────────────────────────
    get localisationText() {
        return this.offer?.Localisation__c || '—';
    }

    // ── Date limite formatée en français ──────────────────────────
    get deadlineText() {
        if (!this.offer?.Deadline__c) return 'Pas de date limite';
        const d = new Date(this.offer.Deadline__c);
        return 'Date limite : ' + d.toLocaleDateString('fr-FR', {
            day  : '2-digit',
            month: 'long',
            year : 'numeric'
        });
    }

    // ── Classe deadline rouge si dépassée ─────────────────────────
    get deadlineClass() {
        if (!this.offer?.Deadline__c) return 'offer-card__deadline';
        const deadline = new Date(this.offer.Deadline__c);
        return deadline < new Date()
            ? 'offer-card__deadline offer-card__deadline--expired'
            : 'offer-card__deadline';
    }

    // ── ✅ Clic sur toute la carte ────────────────────────────────
    view() {
        this.dispatchEvent(
            new CustomEvent('viewdetail', {
                detail: { offerId: this.offer.Id }
            })
        );
    }
}