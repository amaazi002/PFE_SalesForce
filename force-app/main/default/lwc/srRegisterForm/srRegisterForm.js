import { LightningElement, track } from 'lwc';
import sendOtp              from '@salesforce/apex/SR_SelfRegistrationController.sendOtp';
import verifyOtpAndRegister from '@salesforce/apex/SR_SelfRegistrationController.verifyOtpAndRegister';
import { ShowToastEvent }   from 'lightning/platformShowToastEvent';

export default class SrRegisterForm extends LightningElement {

    @track firstName = '';
    @track lastName  = '';
    @track email     = '';
    @track otpCode   = '';

    password = '';
    confirm  = '';

    @track step      = 1;
    @track hasErrors = false;
    @track errorText = '';
    @track isLoading = false;

    // ✅ connectedCallback ajouté
    connectedCallback() {
        // ✅ Restaurer les valeurs depuis sessionStorage
        // au cas où la page est rechargée
        const savedPassword  = sessionStorage.getItem('regPassword');
        const savedConfirm   = sessionStorage.getItem('regConfirm');
        const savedFirstName = sessionStorage.getItem('regFirstName');
        const savedLastName  = sessionStorage.getItem('regLastName');
        const savedEmail     = sessionStorage.getItem('regEmail');

        if (savedPassword)  this.password   = savedPassword;
        if (savedConfirm)   this.confirm    = savedConfirm;
        if (savedFirstName) this.firstName  = savedFirstName;
        if (savedLastName)  this.lastName   = savedLastName;
        if (savedEmail)     this.email      = savedEmail;

        console.log('=== srRegisterForm connectedCallback ===');
        console.log('firstName:', this.firstName);
        console.log('email:',     this.email);
        console.log('step:',      this.step);
    }

    // ── Getters ───────────────────────────────────────────────────
    get isStep1()       { return this.step === 1; }
    get isStep2()       { return this.step === 2; }
    get labelContinue() { 
        return this.isLoading ? 'Envoi en cours...' : 'Continuer'; 
    }
    get labelRegister() { 
        return this.isLoading ? 'Création...' : 'Créer mon compte'; 
    }

    // ── Base URL ──────────────────────────────────────────────────
    get basePath() {
        const p = window.location.pathname || '/';
        const i = p.indexOf('/smartrec/');
        return (i >= 0) 
            ? p.substring(0, i + '/smartrec/'.length) 
            : '/smartrec/';
    }

    // ── Champs ────────────────────────────────────────────────────
    onFirst   = (e) => { this.firstName = e.detail.value; }
    onLast    = (e) => { this.lastName  = e.detail.value; }
    onEmail   = (e) => { this.email     = e.detail.value; }
    onOtp     = (e) => { this.otpCode   = e.detail.value; }

    onPass = (e) => {
        this.password = e.detail.value;
        sessionStorage.setItem('regPassword', this.password);
    }

    onConfirm = (e) => {
        this.confirm = e.detail.value;
        sessionStorage.setItem('regConfirm', this.confirm);
    }

    // ── Navigation ────────────────────────────────────────────────
    handleCancel = () => {
        sessionStorage.removeItem('regPassword');
        sessionStorage.removeItem('regConfirm');
        sessionStorage.removeItem('regFirstName');
        sessionStorage.removeItem('regLastName');
        sessionStorage.removeItem('regEmail');
        window.location.href = this.basePath + 'login';
    }

    goBack = () => {
        this.step     = 1;
        this.password = sessionStorage.getItem('regPassword') || '';
        this.confirm  = sessionStorage.getItem('regConfirm')  || '';
        this.clearError();
    }

    // ── Validation étape 1 ────────────────────────────────────────
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
        if (this.step === 2) {
            this.password = sessionStorage.getItem('regPassword') 
                         || this.password;
            this.confirm  = sessionStorage.getItem('regConfirm')  
                         || this.confirm;
        }

        if (!this.validateForm()) return;

        this.isLoading = true;
        try {
            console.log('=== sendOtp ===');
            console.log('firstName:', this.firstName.trim());
            console.log('email:',     this.email.trim());

            await sendOtp({
                firstName      : this.firstName.trim(),
                lastName       : this.lastName.trim(),
                email          : this.email.trim(),
                password       : this.password,
                confirmPassword: this.confirm
            });

            // ✅ Sauvegarder pour étape 2
            sessionStorage.setItem('regPassword',  this.password);
            sessionStorage.setItem('regConfirm',   this.confirm);
            sessionStorage.setItem('regFirstName', this.firstName.trim());
            sessionStorage.setItem('regLastName',  this.lastName.trim());
            sessionStorage.setItem('regEmail',     this.email.trim());

            this.step = 2;
            this.clearError();
            this.toast('Info', 
                'Code envoyé à ' + this.email, 
                'info');

        } catch (e) {
            console.log('ERREUR sendOtp:', JSON.stringify(e));
            this.setError(this.extractMsg(e));
        } finally {
            this.isLoading = false;
        }
    }

    // ── Étape 2 → vérifier OTP et créer le compte ─────────────────
    async handleRegister() {
        if (!this.otpCode || this.otpCode.trim().length !== 6) {
            this.setError(
                'Veuillez saisir le code à 6 chiffres reçu par email.'
            );
            return;
        }

        this.isLoading = true;
        try {
            const pwd       = sessionStorage.getItem('regPassword') 
                           || this.password;
            const confirm   = sessionStorage.getItem('regConfirm')  
                           || this.confirm;
            const firstName = sessionStorage.getItem('regFirstName') 
                           || this.firstName.trim();
            const lastName  = sessionStorage.getItem('regLastName')  
                           || this.lastName.trim();
            const email     = sessionStorage.getItem('regEmail')     
                           || this.email.trim();

            console.log('=== handleRegister ===');
            console.log('firstName:',  firstName);
            console.log('lastName:',   lastName);
            console.log('email:',      email);
            console.log('pwd vide ?',  !pwd);
            console.log('otpCode:',    this.otpCode.trim());

            await verifyOtpAndRegister({
                firstName      : firstName,
                lastName       : lastName,
                email          : email,
                password       : pwd,
                confirmPassword: confirm,
                otpCode        : this.otpCode.trim()
            });

            // ✅ Nettoyer sessionStorage
            sessionStorage.removeItem('regPassword');
            sessionStorage.removeItem('regConfirm');
            sessionStorage.removeItem('regFirstName');
            sessionStorage.removeItem('regLastName');
            sessionStorage.removeItem('regEmail');

            this.toast(
                'Succès', 
                'Compte créé ! Connectez-vous pour postuler.', 
                'success'
            );

            // ✅ Redirection vers login après 2 secondes
            setTimeout(() => {
                window.location.href = this.basePath + 'login';
            }, 2000);

        } catch (e) {
            console.log('ERREUR verifyOtp:', JSON.stringify(e));
            this.setError(this.extractMsg(e));
        } finally {
            this.isLoading = false;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────
    setError(msg)  { 
        this.hasErrors = true;  
        this.errorText = msg; 
    }

    clearError() { 
        this.hasErrors = false; 
        this.errorText = '';  
    }

    extractMsg(e) {
        console.log('extractMsg full:', JSON.stringify(e));
        return e?.body?.message
            || e?.body?.output?.errors?.[0]?.message
            || e?.message
            || 'Une erreur est survenue.';
    }

    toast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({ title, message, variant })
        );
    }
}