import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getOffer from '@salesforce/apex/SR_OfferController.getOfferById';

export default class SrOfferDetail extends NavigationMixin(LightningElement) {

    @api offerId;
    @track offer = {};

    connectedCallback() { this.load(); }

    async load() {
        try {
            const o = await getOffer({ offreId: this.offerId });
            this.offer = o || {};
        } catch(e) {
            console.error('Erreur chargement offre:', e);
        }
    }

    get deadlineText() {
        return this.offer?.Deadline__c
            ? new Date(this.offer.Deadline__c).toLocaleDateString('fr-FR')
            : '';
    }

    close = () => this.dispatchEvent(new CustomEvent('close'));

    // ✅ Stocker offerId dans sessionStorage avant de naviguer
    openApply = () => {
        sessionStorage.setItem('applyOfferId',   this.offerId);
        sessionStorage.setItem('applyOfferName', this.offer?.Titre__c || '');

        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: {
                name: 'candidature__c'
            }
        });
    }

    stop = (e) => e.stopPropagation();
}