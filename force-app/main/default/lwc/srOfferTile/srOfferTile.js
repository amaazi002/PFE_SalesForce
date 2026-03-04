// force-app/main/default/lwc/srOfferTile/srOfferTile.js
import { LightningElement, api } from 'lwc';
export default class SrOfferTile extends LightningElement {
  @api offer;
  get deadlineText(){ return this.offer?.Deadline__c ? new Date(this.offer.Deadline__c).toLocaleDateString() : ''; }
  get descriptionText(){ return this.offer?.Description__c || ''; }
  get departementText(){ return this.offer?.Departement__c || ''; }
  get localisationText(){ return this.offer?.Localisation__c || ''; }
  view = () => this.dispatchEvent(new CustomEvent('viewdetail',{ detail:{ offerId:this.offer.Id } }));
}