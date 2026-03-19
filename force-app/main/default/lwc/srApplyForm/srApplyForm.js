import { LightningElement, api, track } from 'lwc';
import getProfile from '@salesforce/apex/SR_OfferController.getCurrentUserProfile';
import getOffer from '@salesforce/apex/SR_OfferController.getOfferById';
import createCandidature from '@salesforce/apex/SR_ApplicationController.createCandidature';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import setCvLink from '@salesforce/apex/SR_FileUploadController.setCvLink';


export default class SrApplyForm extends LightningElement {
  @api offerId;    // Id de l'offre (obligatoire)
  @api offerName;  // Titre affiché (lecture seule)
  @track candidatureId;

  firstName=''; lastName=''; email='';
  sexe=''; tech=''; xp=''; soft='';
  isSubmitting=false; lastError='';

  get genderOptions(){ return [
    { label:'—', value:'' }, { label:'Féminin', value:'F' },
    { label:'Masculin', value:'M' }, { label:'Autre', value:'Autre' }
  ]; }
  get submitLabel(){ return this.candidatureId ? 'Terminer' : 'Créer ma candidature'; }

  async connectedCallback(){
    try { const p = await getProfile();
      if (p && p.isGuest === 'false') { 
        this.firstName=p.firstName||''; 
        this.lastName=p.lastName||''; 
        this.email=p.email||''; 
      }
    } catch(e) {}
    // Fallback : si le nom n'est pas passé, on le charge via l'Id
    try { if (!this.offerName && this.offerId) { const o = await getOffer({ offreId:this.offerId }); this.offerName = o?.Titre__c || ''; } } catch(e) {}
  }

  onFirst=(e)=>this.firstName=e.target.value; onLast=(e)=>this.lastName=e.target.value; onEmail=(e)=>this.email=e.target.value;
  onSexe=(e)=>this.sexe=e.detail.value; onTech=(e)=>this.tech=e.target.value; onXp=(e)=>this.xp=e.target.value; onSoft=(e)=>this.soft=e.target.value;
  RGPDConsent = false;
  onRGPDConsent(event) {
    this.RGPDConsent = event.target.checked;
}
  close=()=> this.dispatchEvent(new CustomEvent('close'));

  submit=async()=>{
    if(this.isSubmitting) return;
    try {
      this.isSubmitting = true; this.lastError = '';

      if(!this.offerId){
        const msg = "Offre manquante (offerId vide). Fermez puis rouvrez l'offre et cliquez sur Postuler.";
        this.lastError = msg; this.toast('Erreur', msg, 'error'); return;
      }

      if(!this.candidatureId){
        // Étape 1 : créer (paramètres séparés)
        if(!this.tech || !this.xp || !this.soft){
          const msg='Renseignez compétences techniques, expérience et compétences personnelles.';
          this.lastError=msg; this.toast('Champs requis',msg,'warning'); return;
        }

        const candId = await createCandidature({
          offreId:   this.offerId,
          sexe:      this.sexe,
          RGPDConsent: this.RGPDConsent,
          techSkills:this.tech,
          experience:this.xp,
          softSkills:this.soft,
          firstName: this.firstName,
          lastName:  this.lastName,
          email:     this.email
        });

        this.candidatureId = candId;
        if(!this.candidatureId){
          const msg='La création a échoué (Id vide). Vérifiez permissions/Validation Rules.';
          this.lastError=msg; this.toast('Erreur',msg,'error'); return;
        }
        this.toast('Succès','Candidature créée : déposez votre CV.','success');
      } else {
        // Étape 2 : terminer
        this.toast('Succès','Merci, votre candidature est enregistrée.','success');
        this.dispatchEvent(new CustomEvent('applied'));
      }
    } catch(e) {
      const msg = this.err(e); this.lastError = msg; this.toast('Erreur', msg, 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  onUploadFinished = async (evt) => {
  try {
  const files = evt?.detail?.files || [];
  if (!files.length) return;
  if (!this.candidatureId) {
  this.toast('Erreur', "Créez d'abord la candidature avant de téléverser le CV.", 'error');
  return;
  }
  const docId = files[0].documentId; // ContentDocumentId
  const makePublic = true; // ou false pour un lien interne
  await setCvLink({ candidatureId: this.candidatureId, contentDocumentId: docId, makePublic });
  this.toast('Succès', 'CV chargé et lien ajouté à la candidature.', 'success');
  } catch (e) {
  this.toast('Erreur', this.err(e), 'error');
  }
  };



  toast(title,message,variant){ this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }
  err(e){ const b=e?.body||{}; if(b?.output?.errors?.length) return b.output.errors[0].message;
          if(b?.pageErrors?.length) return b.pageErrors[0].message; if(b?.message) return b.message;
          return e?.message || 'Une erreur est survenue'; }
}