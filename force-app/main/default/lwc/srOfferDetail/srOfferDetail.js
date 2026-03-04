import { LightningElement, api, track } from 'lwc';
import getOffer from '@salesforce/apex/SR_OfferController.getOfferById';

export default class SrOfferDetail extends LightningElement {
  @api offerId;
  @track offer = {};
  showApply = false;

  connectedCallback(){ this.load(); }
  async load(){
    try {
      const o = await getOffer({ offreId: this.offerId });
      this.offer = o || {};
    } catch(e) {}
  }
  get deadlineText(){ return this.offer?.Deadline__c ? new Date(this.offer.Deadline__c).toLocaleDateString() : ''; }

  close = () => this.dispatchEvent(new CustomEvent('close'));
  openApply = () => { this.showApply = true; };
  hideApply = () => { this.showApply = false; };
  stop = (e) => e.stopPropagation();
  applyDone = () => { this.showApply = false; /* option: this.close(); */ };
}