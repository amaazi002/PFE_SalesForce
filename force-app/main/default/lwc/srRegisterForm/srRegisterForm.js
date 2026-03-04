import { LightningElement, track } from 'lwc';
import selfRegister from '@salesforce/apex/SR_SelfRegistrationController.selfRegister';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class SrRegisterForm extends LightningElement {
  @track firstName=''; @track lastName=''; @track email='';
  @track password=''; @track confirm='';
  @track hasErrors=false; @track errorText='';

  onFirst = (e)=> this.firstName = e.target.value;
  onLast  = (e)=> this.lastName  = e.target.value;
  onEmail = (e)=> this.email     = e.target.value;
  onPass  = (e)=> this.password  = e.target.value;
  onConfirm=(e)=> this.confirm   = e.target.value;

  close = ()=> this.dispatchEvent(new CustomEvent('close'));

  validate() {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.firstName || !this.lastName || !this.email || !this.password || !this.confirm) {
      this.error('Tous les champs sont obligatoires'); return false;
    }
    if (!emailRe.test(this.email)) { this.error('Adresse email invalide'); return false; }
    if (this.password !== this.confirm) { this.error('Les mots de passe ne correspondent pas'); return false; }
    if (this.password.length < 8) { this.error('Mot de passe trop court (min 8 caractères)'); return false; }
    this.hasErrors=false; this.errorText='';
    return true;
  }

  error(msg){ this.hasErrors=true; this.errorText=msg; }

  async register() {
    if (!this.validate()) return;
    try {
      await selfRegister({ input: {
        firstName: this.firstName, lastName: this.lastName, email: this.email,
        password: this.password, confirmPassword: this.confirm
      }});
      this.toast('Succès', 'Compte créé. Connectez-vous pour postuler.', 'success');
      this.dispatchEvent(new CustomEvent('registered'));
    } catch (e) {
      const msg = e?.body?.message || e?.message || 'Erreur à l’inscription';
      this.toast('Erreur', msg, 'error');
    }
  }

  toast(title, message, variant){ this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }
}