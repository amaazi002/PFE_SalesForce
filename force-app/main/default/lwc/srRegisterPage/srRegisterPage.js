import { LightningElement, track } from 'lwc'; import selfRegister from '@salesforce/apex/SR_SelfRegistrationController.selfRegister'; import { ShowToastEvent } from 'lightning/platformShowToastEvent';
export default class SrRegisterPage extends LightningElement {
@track firstName=''; @track lastName=''; @track email='';
@track password=''; @track confirm='';
@track hasErrors=false; @track errorText=''; submitting=false;

onFirst = (e)=> this.firstName = e.target.value;
onLast  = (e)=> this.lastName  = e.target.value;
onEmail = (e)=> this.email     = e.target.value;
onPass  = (e)=> this.password  = e.target.value;
onConfirm=(e)=> this.confirm   = e.target.value;

get basePath() {
const p = window.location.pathname || '/'; const i = p.indexOf('/s/');
return (i >= 0) ? p.substring(0, i + 3) : (p.endsWith('/') ? p : p + '/');
}
goLogin = () => window.location.assign(this.basePath + 'login');

validate() {
const emailRe = /[\s@]+@[\s@]+.[\s@]+$/;
if (!this.firstName || !this.lastName || !this.email || !this.password || !this.confirm) { return this.err('Tous les champs sont obligatoires'); }
if (!emailRe.test(this.email)) { return this.err('Adresse email invalide'); }
if (this.password !== this.confirm) { return this.err('Les mots de passe ne correspondent pas'); }
if (this.password.length < 8) { return this.err('Mot de passe trop court (min 8 caractères)'); }
this.hasErrors=false; this.errorText=''; return true;
}
err(msg){ this.hasErrors=true; this.errorText=msg; return false; }
toast(title,message,variant){ this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }

async register() {
if (!this.validate()) return;
try {
this.submitting = true;
await selfRegister({ input: {
firstName: this.firstName, lastName: this.lastName, email: this.email,
password: this.password, confirmPassword: this.confirm
// Optionnel: profileId:'00eXXXX', accountId:'001XXXX'
}});
this.toast('Succès','Compte créé. Connectez-vous pour postuler.','success');
this.goLogin();
} catch (e) {
const msg = e?.body?.message || e?.message || 'Erreur à l’inscription';
this.toast('Erreur', msg, 'error');
} finally {
this.submitting = false;
}
}
}