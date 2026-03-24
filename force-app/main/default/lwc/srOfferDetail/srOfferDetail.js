import { LightningElement, api, track } from 'lwc';
import getOffer from '@salesforce/apex/SR_OfferController.getOfferById';

export default class SrOfferDetail extends LightningElement {
  @api offerId;         // l'Id de l'offre arrive du parent
  @track offer = {};

  // État local de la modale Postuler
  showApply = false;

  connectedCallback() { 
    console.log('srOfferDetail offerId reçu:', this.offerId);
    this.load(); 
  }


  async load() {
    try {
      const o = await getOffer({ offreId: this.offerId });
      this.offer = o || {};
    } catch(e) {}
  }

  get deadlineText() {
    return this.offer?.Deadline__c
      ? new Date(this.offer.Deadline__c).toLocaleDateString()
      : '';
  }

  // Overlay Détail
  close = () => this.dispatchEvent(new CustomEvent('close'));

  // Modale Postuler (ouverture/fermeture)
  openApply = () => { 
    console.log('openApply offerId:' , this.offerId);
    this.showApply = true; 
  };
  hideApply = () => { this.showApply = false; };

  // Empêche la propagation (clic dans la modale)
  stop = (evt) => evt.stopPropagation();

  // Candidature terminée : fermer la modale (et optionnellement la carte)
  applyDone = () => {
    this.showApply = false;
    // Option : aussi fermer l'overlay Détail :
    // this.close();
  };
}