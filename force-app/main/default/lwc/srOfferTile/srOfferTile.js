import { LightningElement, api } from 'lwc';

export default class SrOfferTile extends LightningElement {

    @api offer;

    get titreText() {
        return this.offer?.Titre__c || '—';
    }

    get descriptionText() {
        const desc = this.offer?.Description__c || '—';
        return desc.length > 200 ? desc.substring(0, 200) + '...' : desc;
    }

    get departementText() {
        return this.offer?.Departement__c || '—';
    }

    get localisationText() {
        return this.offer?.Localisation__c || '—';
    }

    get deadlineText() {
        if (!this.offer?.Deadline__c) return 'Pas de date limite';
        const d = new Date(this.offer.Deadline__c);
        return 'Date limite : ' + d.toLocaleDateString('fr-FR', {
            day:   '2-digit',
            month: 'long',
            year:  'numeric'
        });
    }

    get deadlineClass() {
        if (!this.offer?.Deadline__c) return 'offer-card__deadline';
        const deadline = new Date(this.offer.Deadline__c);
        return deadline < new Date()
            ? 'offer-card__deadline offer-card__deadline--expired'
            : 'offer-card__deadline';
    }

    view() {
        if (!this.offer?.Id) return;
        this.dispatchEvent(
            new CustomEvent('viewdetail', {
                detail  : { offerId: this.offer.Id },
                bubbles : false,
                composed: false
            })
        );
    }
}