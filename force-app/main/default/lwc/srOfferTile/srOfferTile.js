import { LightningElement, api } from 'lwc';
export default class SrOfferTile extends LightningElement {
  @api offer;

  get deadlineText() {
    if (this.offer && this.offer.Deadline__c) {
      try { return new Date(this.offer.Deadline__c).toLocaleDateString(); }
      catch (e) { return ''; }
    }
    return '';
  }
  get descriptionText() {
    return (this.offer && this.offer.Description__c) ? this.offer.Description__c : '';
  }
  get departementText() {
    return (this.offer && this.offer.Departement__c) ? this.offer.Departement__c : '';
  }
  get localisationText() {
    return (this.offer && this.offer.Localisation__c) ? this.offer.Localisation__c : '';
  }

  onClick() {
    if (this.offer && this.offer.Id) {
      this.dispatchEvent(new CustomEvent('viewdetail', { detail: { offerId: this.offer.Id } }));
    }
  }

  onKeyDown(evt) {
    var k = evt.key || evt.code;
    if (k === 'Enter' || k === ' ' || k === 'Spacebar' || k === 'Space') {
      evt.preventDefault();
      this.onClick();
    }
  }
}