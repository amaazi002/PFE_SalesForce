import { LightningElement, track } from 'lwc';
import sendOtp              from '@salesforce/apex/SR_SelfRegistrationController.sendOtp';
import verifyOtpAndRegister from '@salesforce/apex/SR_SelfRegistrationController.verifyOtpAndRegister';
import { ShowToastEvent }   from 'lightning/platformShowToastEvent';

export default class SrRegisterPage extends LightningElement {

    @track firstName = '';
    @track lastName  = '';
    @track email     = '';
    @track password  = '';
    @track confirm   = '';
    @track otpCode   = '';

    @track step      = 1;
    @track hasErrors = false;
    @track errorText = '';
    @track isLoading = false;

    // ── Getters ───────────────────────────────────────────────────
    get isStep1()       { return this.step === 1; }
    get isStep2()       { return this.step === 2; }
    get labelContinue() { return this.isLoading ? 'Envoi en cours...' : 'Continuer'; }
    get labelRegister() { return this.isLoading ? 'Création...'       : 'Créer mon compte'; }
    get loginUrl() {
        const p    = window.location.pathname || '/';
        const i    = p.indexOf('/s/');
        const base = (i >= 0) ? p.substring(0, i + 3) : (p.endsWith('/') ? p : p + '/');
        return base + 'login';
    }

    // ── Champs ────────────────────────────────────────────────────
    onFirst   = (e) => { this.firstName = e.target.value; }
    onLast    = (e) => { this.lastName  = e.target.value; }
    onEmail   = (e) => { this.email     = e.target.value; }
    onPass    = (e) => { this.password  = e.target.value; }
    onConfirm = (e) => { this.confirm   = e.target.value; }
    onOtp     = (e) => { this.otpCode   = e.target.value; }

    // ── Navigation ────────────────────────────────────────────────
    handleCancel = () => window.location.assign(this.loginUrl);
    goBack       = () => { this.step = 1; this.clearError(); }

    // ── Validation ────────────────────────────────────────────────
    validateForm() {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!this.firstName.trim() || !this.lastName.trim() ||
            !this.email.trim() || !this.password || !this.confirm) {
            this.setError('Tous les champs sont obligatoires.');
            return false;
        }
        if (!emailRe.test(this.email.trim())) {
            this.setError('Adresse email invalide.');
            return false;
        }
        if (this.password !== this.confirm) {
            this.setError('Les mots de passe ne correspondent pas.');
            return false;
        }
        if (this.password.length < 8) {
            this.setError('Mot de passe trop court (min 8 caractères).');
            return false;
        }
        this.clearError();
        return true;
    }

    // ── Étape 1 → envoyer OTP ─────────────────────────────────────
    async handleContinue() {
        if (!this.validateForm()) return;
        this.isLoading = true;
        try {
            await sendOtp({
                firstName       : this.firstName.trim(),
                lastName        : this.lastName.trim(),
                email           : this.email.trim(),
                password        : this.password,
                confirmPassword : this.confirm
            });
            this.step = 2;
            this.clearError();
        } catch (e) {
            this.setError(this.extractMsg(e));
        } finally {
            this.isLoading = false;
        }
    }

    // ── Étape 2 → vérifier OTP ────────────────────────────────────
    async handleRegister() {
        if (!this.otpCode || this.otpCode.trim().length !== 6) {
            this.setError('Veuillez saisir le code à 6 chiffres reçu par email.');
            return;
        }
        this.isLoading = true;
        try {
            await verifyOtpAndRegister({
                firstName       : this.firstName.trim(),
                lastName        : this.lastName.trim(),
                email           : this.email.trim(),
                password        : this.password,
                confirmPassword : this.confirm,   // ✅ AJOUTÉ
                otpCode         : this.otpCode.trim()
            });
            this.toast('Succès', 'Compte créé ! Connectez-vous pour postuler.', 'success');
            window.location.assign(this.loginUrl);
        } catch (e) {
            this.setError(this.extractMsg(e));
        } finally {
            this.isLoading = false;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────
    setError(msg) { this.hasErrors = true;  this.errorText = msg; }
    clearError()  { this.hasErrors = false; this.errorText = '';  }
    extractMsg(e) { return e?.body?.message || e?.message || 'Une erreur est survenue.'; }
    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}