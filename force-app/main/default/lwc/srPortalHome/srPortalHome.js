// force-app/main/default/lwc/srPortalHome/srPortalHome.js
import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import isGuest    from '@salesforce/user/isGuest';
import getOffers  from '@salesforce/apex/SR_OfferController.getPublicOffers';
import getProfile from '@salesforce/apex/SR_OfferController.getCurrentUserProfile';

export default class SrPortalHome extends LightningElement {
  isGuest = isGuest;
  @track offers          = [];
  @track selectedOfferId = null;
  userFullName = '';

  connectedCallback() { this.loadProfile(); this.loadOffers(); }

  async loadProfile() {
    try {
      const p = await getProfile();
      if (p && p.isGuest === 'false') {
        this.userFullName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
      }
    } catch (e) {}
  }

  async loadOffers() {
    try {
      const rows = await getOffers({ limitSize: 100 });
      this.offers = rows || [];
    } catch (e) { this.toast('Erreur', this.err(e), 'error'); }
  }

  handleViewDetail = (evt) => { this.selectedOfferId = evt?.detail?.offerId || null; }
  closeDetail      = ()    => { this.selectedOfferId = null; }
  stop             = (evt) => evt.stopPropagation();

  get basePath() {
    const p = window.location.pathname || '/';
    const i = p.indexOf('/s/');
    return (i >= 0) ? p.substring(0, i + 3) : (p.endsWith('/') ? p : p + '/');
  }

  // Redirige vers la page dédiée srRegisterPage
  openRegister = () => window.location.assign(this.basePath + 'SelfRegister');
  goLogin      = () => window.location.assign(this.basePath + 'login');

  toast(title, message, variant) { this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }
  err(e) { return e?.body?.message || e?.message || 'Une erreur est survenue'; }
}
