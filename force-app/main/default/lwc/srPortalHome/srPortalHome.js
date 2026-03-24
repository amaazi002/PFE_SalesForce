// force-app/main/default/lwc/srPortalHome/srPortalHome.js
import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getOffers from '@salesforce/apex/SR_OfferController.getPublicOffers';

export default class SrPortalHome extends LightningElement {

    // ── État ────────────────────────────────────────────────────────
    @track offers          = [];
    @track loadingOffers   = true;
    @track selectedOfferId = null;

    // ── Getter ──────────────────────────────────────────────────────
    get hasOffers() {
        return this.offers && this.offers.length > 0;
    }

    // ── Lifecycle ───────────────────────────────────────────────────
    connectedCallback() {
        this.loadOffers();
    }

    // ── Chargement des offres ────────────────────────────────────────
    async loadOffers() {
        this.loadingOffers = true;
        try {
            const rows = await getOffers({ limitSize: 100 });
            this.offers = rows || [];
            console.log('Offres chargées:', this.offers.length);
        } catch (e) {
            console.error('Erreur getOffers:', JSON.stringify(e));
            this.toast('Erreur', this.err(e), 'error');
            this.offers = [];
        } finally {
            this.loadingOffers = false;
        }
    }

    // ── Détail offre ─────────────────────────────────────────────────
    handleViewDetail(evt) {
        const id = evt?.detail?.offerId || null;
        console.log('handleViewDetail offerId:', id);
        this.selectedOfferId = id;
    }

    closeDetail() {
        this.selectedOfferId = null;
    }

    stop(evt) {
        evt.stopPropagation();
    }

    // ── Helpers ──────────────────────────────────────────────────────
    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    err(e) {
        const b = e?.body || {};
        return b?.message || e?.message || 'Une erreur est survenue';
    }
}