import { LightningElement, api, track, wire } from 'lwc';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import getOffer from '@salesforce/apex/SR_OfferController.getOfferById';
import checkIfApplied from '@salesforce/apex/SR_OfferController.checkIfApplied';

export default class SrOfferDetail extends NavigationMixin(LightningElement) {

    @api offerId;
    @track offer = {};
    isLoading    = true;
    hasAlreadyApplied = false;
    _loaded      = false;

    @wire(CurrentPageReference)
    pageRef(ref) {
        if (!ref || this._loaded) return;

        console.log('=== CurrentPageReference ===', JSON.stringify(ref));

        const idFromUrl     = ref?.state?.offerId     || null;
        const idFromSession = sessionStorage.getItem('currentOfferId') || null;
        const idFromApi     = this.offerId             || null;

        console.log('idFromUrl     :', idFromUrl);
        console.log('idFromSession :', idFromSession);
        console.log('idFromApi     :', idFromApi);

        this.offerId = idFromUrl || idFromApi || idFromSession || null;
        console.log('offerId final :', this.offerId);

        this._loaded = true;
        this.load();
    }

    async load() {
        this.isLoading = true;
        if (!this.offerId) {
            this.isLoading = false;
            return;
        }
        try {
            const result = await getOffer({ offreId: this.offerId });
            this.offer   = result || {};
            
            // Vérifier si déjà postulé
            this.hasAlreadyApplied = await checkIfApplied({ offreId: this.offerId });
            
            console.log('Offre chargée :', JSON.stringify(this.offer));
            console.log('Déjà postulé ?', this.hasAlreadyApplied);
        } catch (e) {
            console.error('Erreur chargement offre:', e);
            this.offer = {};
        } finally {
            this.isLoading = false;
        }
    }

    get hasOffer() {
        return !!(this.offer && this.offer.Id);
    }

    get deadlineText() {
        if (!this.offer?.Deadline__c) return '';
        return new Date(this.offer.Deadline__c)
            .toLocaleDateString('fr-FR', {
                day:   '2-digit',
                month: 'long',
                year:  'numeric'
            });
    }

    get createdDateText() {
        if (!this.offer?.CreatedDate) return '';
        return new Date(this.offer.CreatedDate)
            .toLocaleDateString('fr-FR', {
                day:   '2-digit',
                month: 'long',
                year:  'numeric'
            });
    }

    get statutBadgeClass() {
        const s = (this.offer?.Statut__c || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        if (s === 'ouverte')   return 'statut-badge statut-badge_open';
        if (s === 'cloturee')  return 'statut-badge statut-badge_closed';
        if (s === 'brouillon') return 'statut-badge statut-badge_draft';
        return 'statut-badge statut-badge_default';
    }

    handleBack() {
        sessionStorage.removeItem('currentOfferId');
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: 'candidat__c' }
        });
    }

    openApply() {
        if (this.hasAlreadyApplied) {
            return; // Sécurité supplémentaire
        }
        sessionStorage.setItem('applyOfferId',   this.offerId);
        sessionStorage.setItem('applyOfferName', this.offer?.Titre__c || '');
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: 'candidature__c' }
        });
    }
}