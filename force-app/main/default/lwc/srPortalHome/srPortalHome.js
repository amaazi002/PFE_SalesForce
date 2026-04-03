import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getOffers from '@salesforce/apex/SR_OfferController.getPublicOffers';

export default class SrPortalHome extends NavigationMixin(LightningElement) {

    @track offers        = [];
    @track loadingOffers = true;
    _navigating          = false;

    get hasOffers() {
        return this.offers && this.offers.length > 0;
    }

    get offersCount() {
        return this.offers.length;
    }

    connectedCallback() {
        this._navigating = false;
        this.loadOffers();
    }

    async loadOffers() {
        this.loadingOffers = true;
        try {
            const rows  = await getOffers({ limitSize: 100 });
            this.offers = rows || [];
        } catch (e) {
            console.error('Erreur getOffers:', JSON.stringify(e));
            this.toast('Erreur', this.err(e), 'error');
            this.offers = [];
        } finally {
            this.loadingOffers = false;
        }
    }

    handleViewDetail(evt) {
        if (this._navigating) return;
        const offerId = evt?.detail?.offerId || null;
        if (!offerId) return;

        this._navigating = true;

        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: {
                name: 'offredetail__c'
            },
            state: {
                offerId: offerId
            }
        });
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    err(e) {
        const b = e?.body || {};
        return b?.message || e?.message || 'Une erreur est survenue';
    }
}