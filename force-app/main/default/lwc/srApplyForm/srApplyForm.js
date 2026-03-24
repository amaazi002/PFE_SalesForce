import { LightningElement, api, track } from 'lwc';
import getProfile        from '@salesforce/apex/SR_OfferController.getCurrentUserProfile';
import getOffer          from '@salesforce/apex/SR_OfferController.getOfferById';
import createCandidature from '@salesforce/apex/SR_ApplicationController.createCandidature';
import uploadCv          from '@salesforce/apex/SR_FileUploadController.uploadCv';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class SrApplyForm extends LightningElement {

    @api offerId;
    @api offerName;

    @track candidatureId = null;
    @track cvUploaded    = false;
    @track uploadingCv   = false;
    @track fileName      = '';

    @track firstName = '';
    @track lastName  = '';
    @track email     = '';
    @track sexe      = '';
    @track tech      = '';
    @track xp        = '';
    @track soft      = '';

    isSubmitting = false;
    lastError    = '';

    // ── Options picklist ─────────────────────────────────────────────
    get genderOptions() {
        return [
            { label: '— Sélectionner —', value: ''      },
            { label: 'Homme',            value: 'Homme' },
            { label: 'Femme',            value: 'Femme' },
            { label: 'Autre',            value: 'Autre' }
        ];
    }

    // ── Chargement profil + offre ────────────────────────────────────
    async connectedCallback() {
        try {
            const p = await getProfile();
            if (p && p.isGuest === 'false') {
                this.firstName = p.firstName || '';
                this.lastName  = p.lastName  || '';
                this.email     = p.email     || '';
            }
        } catch(e) {}

        try {
            if (!this.offerName && this.offerId && this.offerId.length >= 15) {
                const o = await getOffer({ offreId: this.offerId });
                this.offerName = o?.Titre__c || '';
            }
        } catch(e) {}
    }

    // ── Handlers champs ──────────────────────────────────────────────
    onFirst = (e) => { this.firstName = e.detail.value; }
    onLast  = (e) => { this.lastName  = e.detail.value; }
    onEmail = (e) => { this.email     = e.detail.value; }
    onSexe  = (e) => { this.sexe      = e.detail.value; }
    onTech  = (e) => { this.tech      = e.detail.value; }
    onXp    = (e) => { this.xp        = e.detail.value; }
    onSoft  = (e) => { this.soft      = e.detail.value; }

    close = () => this.dispatchEvent(new CustomEvent('close'));

    // ── Étape 1 : Créer la candidature ───────────────────────────────
    submit = async () => {
        if (this.isSubmitting) return;
        this.isSubmitting = true;
        this.lastError    = '';

        try {
            if (!this.offerId || String(this.offerId).trim().length < 15) {
                throw new Error('Offre manquante. Fermez et rouvrez l\'offre.');
            }
            if (!this.firstName || !this.lastName || !this.email) {
                throw new Error('Prénom, Nom et Email sont obligatoires.');
            }
            if (!this.tech || !this.xp || !this.soft) {
                throw new Error('Renseignez compétences techniques, expérience et compétences personnelles.');
            }

            const candId = await createCandidature({
                offreId   : String(this.offerId).trim(),
                sexe      : this.sexe      || null,
                techSkills: this.tech      || null,
                experience: this.xp        || null,
                softSkills: this.soft      || null,
                firstName : this.firstName || null,
                lastName  : this.lastName  || null,
                email     : this.email     || null
            });

            if (!candId) throw new Error('La création a échoué (Id vide).');

            this.candidatureId = candId;
            this.toast('Succès', 'Candidature créée ! Déposez votre CV.', 'success');

        } catch(e) {
            this.lastError = this.err(e);
            this.toast('Erreur', this.lastError, 'error');
        } finally {
            this.isSubmitting = false;
        }
    }

    // ── Étape 2a : Sélection du fichier ──────────────────────────────
    onFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Vérification type
        const allowed = ['application/pdf',
                         'application/msword',
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowed.includes(file.type)) {
            this.toast('Erreur', 'Format non autorisé. Utilisez PDF, DOC ou DOCX.', 'error');
            return;
        }

        // Vérification taille (5 Mo max)
        if (file.size > 5 * 1024 * 1024) {
            this.toast('Erreur', 'Fichier trop volumineux (max 5 Mo).', 'error');
            return;
        }

        this.fileName = file.name;
        this.uploadFile(file);
    }

    // ── Étape 2b : Upload en Base64 via Apex ─────────────────────────
    uploadFile = (file) => {
        this.uploadingCv = true;
        this.lastError   = '';

        const reader = new FileReader();

        reader.onload = async () => {
            try {
                // ✅ base64Data contient "data:...;base64,XXXX"
                // Apex retire le préfixe automatiquement
                const base64Data = reader.result;

                console.log('Upload CV:', file.name, '| candidatureId:', this.candidatureId);

                const result = await uploadCv({
                    recordId   : this.candidatureId,
                    fileName   : file.name,
                    base64Data : base64Data,
                    contentType: file.type,
                    makePublic : false
                });

                console.log('uploadCv result:', JSON.stringify(result));

                this.cvUploaded  = true;
                this.uploadingCv = false;
                this.toast('Succès', 'CV déposé avec succès !', 'success');

            } catch(e) {
                this.uploadingCv = false;
                this.lastError   = this.err(e);
                this.toast('Erreur', 'Erreur upload CV : ' + this.lastError, 'error');
                console.error('uploadCv error:', JSON.stringify(e));
            }
        };

        reader.onerror = () => {
            this.uploadingCv = false;
            this.toast('Erreur', 'Impossible de lire le fichier.', 'error');
        };

        // ✅ Lecture en Base64
        reader.readAsDataURL(file);
    }

    // ── Étape 3 : Terminer ───────────────────────────────────────────
    finish = () => {
        this.toast('Succès', 'Merci, votre candidature est bien enregistrée.', 'success');
        this.dispatchEvent(new CustomEvent('applied'));
        this.close();
    }

    // ── Helpers ──────────────────────────────────────────────────────
    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    err(e) {
        const b = e?.body || {};
        if (b?.output?.errors?.length) return b.output.errors[0].message;
        if (b?.pageErrors?.length)      return b.pageErrors[0].message;
        if (b?.message)                 return b.message;
        return e?.message || 'Une erreur est survenue';
    }
}