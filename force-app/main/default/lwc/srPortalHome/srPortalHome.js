// force-app/main/default/lwc/srPortalHome/srPortalHome.js
import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getOffers from '@salesforce/apex/SR_OfferController.getPublicOffers';

export default class SrPortalHome extends LightningElement {
  @track offers = [];
  @track selectedOfferId = null;
  loadingOffers = false;

  connectedCallback() { this.loadOffers(); }

  async loadOffers() {
    this.loadingOffers = true;
    try {
      const rows = await getOffers({ limitSize: 100 });
      this.offers = rows || [];
    } catch (e) { this.toast('Erreur', this.err(e), 'error'); }
    finally { this.loadingOffers = false; }
  }

  handleViewDetail = (evt) => { this.selectedOfferId = evt?.detail?.offerId || null; };
  closeDetail = () => { this.selectedOfferId = null; };
  stop = (evt) => evt.stopPropagation();

  toast(title, message, variant) { this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }
  err(e) { const b = e?.body || {}; return b?.message || e?.message || 'Une erreur est survenue'; }
}
