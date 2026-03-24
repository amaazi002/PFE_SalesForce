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
          console.log('Offres reçues :', JSON.stringify(rows)); // ← AJOUTE ÇA
          this.offers = rows || [];
      } catch (e) {
          console.error('Erreur getOffers :', JSON.stringify(e)); // ← AJOUTE ÇA
          this.toast('Erreur', this.err(e), 'error');
          this.offers = [];
      } finally {
          this.loadingOffers = false;
      }
    }

    // ── Détail offre ─────────────────────────────────────────────────
    handleViewDetail(evt) {
        this.selectedOfferId = evt?.detail?.offerId || null;
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