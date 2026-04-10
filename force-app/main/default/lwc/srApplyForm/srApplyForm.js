import { LightningElement, track } from 'lwc';
import { NavigationMixin }         from 'lightning/navigation';
import { ShowToastEvent }          from 'lightning/platformShowToastEvent';

import getProfile        from '@salesforce/apex/SR_OfferController.getCurrentUserProfile';
import getOffer          from '@salesforce/apex/SR_OfferController.getOfferById';
import createCandidature from '@salesforce/apex/SR_ApplicationController.createCandidature';
import uploadCv          from '@salesforce/apex/SR_FileUploadController.uploadCv';
import parseCv           from '@salesforce/apex/SR_HerokuCvParser.parseCv';

export default class SrApplyForm extends NavigationMixin(LightningElement) {

    // ══════════════════════════════════════
    // PROPRIÉTÉS
    // ══════════════════════════════════════
    @track offerId            = null;
    @track offerName          = '';
    @track candidatureId      = null;
    @track currentStep        = 1;

    // Fichier
    @track fileName           = '';
    @track fileSize           = '';
    @track cvUploaded         = false;
    @track uploadingCv        = false;
    @track parsingCv          = false;
    @track cvParsed           = false;
    @track cvParseError       = false;

    // Étape 1 - Identité
    @track firstName          = '';
    @track lastName           = '';
    @track email              = '';
    @track telephone          = '';
    @track dateNaissance      = '';
    @track sexe               = '';
    @track situationFamiliale = '';

    // Étape 2 - Profil pro
    @track tech               = '';
    @track xp                 = '';
    @track soft               = '';
    @track anneesExperience   = '';
    @track dernierDiplome     = '';
    @track niveauEtude        = '';
    @track ecoleUniversite    = '';
    @track anneeObtention     = '';

    // État
    @track isSubmitting       = false;
    @track lastError          = '';

    _pendingFile = null;

    // ══════════════════════════════════════
    // GETTERS - NAVIGATION
    // ══════════════════════════════════════
    get isStep1()     { return this.currentStep === 1; }
    get isStep2()     { return this.currentStep === 2; }
    get isStep3()     { return this.currentStep === 3; }
    get isStep1Done() { return this.currentStep > 1;   }
    get isStep2Done() { return this.currentStep > 2;   }

    get stepClass1() {
        return 'step' + (this.currentStep >= 1 ? ' step--active' : '');
    }
    get stepClass2() {
        return 'step' + (this.currentStep >= 2 ? ' step--active' : '');
    }
    get stepClass3() {
        return 'step' + (this.currentStep >= 3 ? ' step--active' : '');
    }

    // ══════════════════════════════════════
    // GETTERS - OPTIONS
    // ══════════════════════════════════════
    get genderOptions() {
        return [
            { label: '— Sélectionner —', value: ''      },
            { label: 'Homme',            value: 'Homme' },
            { label: 'Femme',            value: 'Femme' },
            { label: 'Autre',            value: 'Autre' }
        ];
    }

    get situationOptions() {
        return [
            { label: '— Sélectionner —', value: ''            },
            { label: 'Célibataire',      value: 'Célibataire' },
            { label: 'Marié(e)',         value: 'Marié(e)'    },
            { label: 'Divorcé(e)',       value: 'Divorcé(e)'  },
            { label: 'Veuf/Veuve',       value: 'Veuf/Veuve'  }
        ];
    }

    get niveauEtudeOptions() {
        return [
            { label: '— Sélectionner —', value: ''         },
            { label: 'Bac',              value: 'Bac'      },
            { label: 'Bac+2',            value: 'Bac+2'    },
            { label: 'Bac+3',            value: 'Bac+3'    },
            { label: 'Bac+4',            value: 'Bac+4'    },
            { label: 'Bac+5',            value: 'Bac+5'    },
            { label: 'Doctorat',         value: 'Doctorat' }
        ];
    }

    // ══════════════════════════════════════
    // LIFECYCLE
    // ══════════════════════════════════════
    async connectedCallback() {
        this.offerId   = sessionStorage.getItem('applyOfferId')   || null;
        this.offerName = sessionStorage.getItem('applyOfferName') || '';

        try {
            const p = await getProfile();
            if (p && p.isGuest === 'false') {
                this.firstName = p.firstName || '';
                this.lastName  = p.lastName  || '';
                this.email     = p.email     || '';
            }
        } catch(e) {
            console.warn('getProfile ignoré:', e);
        }

        try {
            if (!this.offerName && this.offerId) {
                const o        = await getOffer({ offreId: this.offerId });
                this.offerName = o?.Titre__c || '';
            }
        } catch(e) {
            console.warn('getOffer ignoré:', e);
        }
    }

    // ══════════════════════════════════════
    // HANDLERS - ÉTAPE 1
    // ══════════════════════════════════════
    onFirst              = (e) => { this.firstName          = e.detail.value; }
    onLast               = (e) => { this.lastName           = e.detail.value; }
    onEmail              = (e) => { this.email              = e.detail.value; }
    onTelephone          = (e) => { this.telephone          = e.detail.value; }
    onDateNaissance      = (e) => { this.dateNaissance      = e.detail.value; }
    onSexe               = (e) => { this.sexe               = e.detail.value; }
    onSituationFamiliale = (e) => { this.situationFamiliale = e.detail.value; }

    // ══════════════════════════════════════
    // HANDLERS - ÉTAPE 2
    // ══════════════════════════════════════
    onTech             = (e) => { this.tech             = e.detail.value; }
    onXp               = (e) => { this.xp               = e.detail.value; }
    onSoft             = (e) => { this.soft             = e.detail.value; }
    onAnneesExperience = (e) => { this.anneesExperience = e.detail.value; }
    onDernierDiplome   = (e) => { this.dernierDiplome   = e.detail.value; }
    onNiveauEtude      = (e) => { this.niveauEtude      = e.detail.value; }
    onEcoleUniversite  = (e) => { this.ecoleUniversite  = e.detail.value; }
    onAnneeObtention   = (e) => { this.anneeObtention   = e.detail.value; }

    // ══════════════════════════════════════
    // GESTION FICHIER CV
    // ══════════════════════════════════════
    onFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        const allowedExt = ['pdf', 'doc', 'docx'];
        const ext = file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExt.includes(ext)) {
            this.toast('Erreur', 'Format non autorisé. PDF, DOC ou DOCX uniquement.', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.toast('Erreur', 'Fichier trop volumineux (max 5 Mo).', 'error');
            return;
        }

        this.fileName     = file.name;
        this.fileSize     = this.formatSize(file.size);
        this._pendingFile = file;
        this.cvParsed     = false;
        this.cvParseError = false;

        console.log('✅ Fichier sélectionné:', file.name, '|', this.fileSize, '|', file.type);
    }

    formatSize(bytes) {
        if (bytes < 1024)        return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ══════════════════════════════════════
    // NAVIGATION
    // ══════════════════════════════════════
    goStep2 = async () => {
        this.lastError = '';

        // ✅ Validation champs obligatoires
        if (!this.firstName?.trim() || !this.lastName?.trim() || !this.email?.trim()) {
            this.lastError = 'Prénom, Nom et Email sont obligatoires.';
            this.toast('Champs requis', this.lastError, 'warning');
            return;
        }

        // ✅ Validation email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.email)) {
            this.lastError = 'Adresse email invalide.';
            this.toast('Email invalide', this.lastError, 'warning');
            return;
        }

        // ✅ Parser le CV si présent et pas encore parsé
        if (this._pendingFile && !this.cvParsed) {
            await this.parseCvWithRender();
        }

        this.currentStep = 2;
    }

    goStep1 = () => {
        this.lastError   = '';
        this.currentStep = 1;
    }

    goBack = () => {
        sessionStorage.removeItem('applyOfferId');
        sessionStorage.removeItem('applyOfferName');
        this[NavigationMixin.Navigate]({
            type      : 'comm__namedPage',
            attributes: { name: 'Home' }
        });
    }

    // ══════════════════════════════════════
    // PARSING CV ✅ CORRIGÉ
    // ══════════════════════════════════════
    parseCvWithRender = () => {
        return new Promise((resolve) => {
            this.parsingCv    = true;
            this.cvParseError = false;
            this.lastError    = '';

            const reader = new FileReader();

            reader.onload = async (event) => {
                try {
                    const fullBase64 = event.target.result;

                    // ✅ Extraire uniquement la partie base64
                    let base64Only = fullBase64;
                    if (fullBase64 && fullBase64.includes(',')) {
                        base64Only = fullBase64.split(',')[1];
                    }

                    console.log('Fichier:', this._pendingFile.name);
                    console.log('Type:', this._pendingFile.type);
                    console.log('Base64 longueur:', base64Only.length);

                    // ✅ Appel Apex
                    const data = await parseCv({
                        fileBase64  : base64Only,
                        fileName    : this._pendingFile.name,
                        contentType : this._pendingFile.type
                    });

                    console.log('Résultat:', JSON.stringify(data));

                    if (!data) {
                        throw new Error('Réponse vide');
                    }

                    // ✅ Remplir les champs
                    if (data.anneesExperience != null && Number(data.anneesExperience) > 0) {
                        this.anneesExperience = String(data.anneesExperience);
                    }
                    if (data.competencesTech  && data.competencesTech.trim()) {
                        this.tech             = data.competencesTech;
                    }
                    if (data.experienceProf   && data.experienceProf.trim()) {
                        this.xp               = data.experienceProf;
                    }
                    if (data.competencesPerso && data.competencesPerso.trim()) {
                        this.soft             = data.competencesPerso;
                    }
                    if (data.dernierDiplome   && data.dernierDiplome.trim()) {
                        this.dernierDiplome   = data.dernierDiplome;
                    }
                    if (data.ecoleUniversite  && data.ecoleUniversite.trim()) {
                        this.ecoleUniversite  = data.ecoleUniversite;
                    }
                    if (data.anneeObtention != null && Number(data.anneeObtention) > 0) {
                        this.anneeObtention   = String(data.anneeObtention);
                    }

                    if (data.errorMessage) {
                        this.cvParseError = true;
                        this.toast('Attention', data.errorMessage, 'warning');
                    } else {
                        this.cvParsed = true;
                        this.toast('CV analysé !', 'Champs remplis automatiquement.', 'success');
                    }

                } catch(e) {
                    console.error('Erreur:', e?.body?.message || e?.message);
                    this.cvParseError = true;
                    this.lastError    = e?.body?.message || e?.message || 'Erreur inconnue';
                    this.toast('Erreur', this.lastError, 'error');
                } finally {
                    this.parsingCv = false;
                    resolve();
                }
            };

            reader.onerror = () => {
                this.parsingCv = false;
                resolve();
            };

            reader.readAsDataURL(this._pendingFile);
        });
    }

    // ══════════════════════════════════════
    // SOUMISSION
    // ══════════════════════════════════════
    submit = async () => {
        if (this.isSubmitting) return;
        this.isSubmitting = true;
        this.lastError    = '';

        try {
            // ✅ Validation étape 2
            if (!this.tech?.trim() || !this.xp?.trim() || !this.soft?.trim()) {
                throw new Error('Renseignez compétences techniques, expérience et compétences personnelles.');
            }

            if (!this.offerId || String(this.offerId).trim().length < 15) {
                throw new Error('Offre manquante. Veuillez accéder au formulaire depuis une offre.');
            }

            // ✅ Créer la candidature
            const candId = await createCandidature({
                offreId           : String(this.offerId).trim(),
                sexe              : this.sexe               || null,
                techSkills        : this.tech               || null,
                experience        : this.xp                 || null,
                softSkills        : this.soft               || null,
                firstName         : this.firstName          || null,
                lastName          : this.lastName           || null,
                email             : this.email              || null,
                telephone         : this.telephone          || null,
                dateNaissance     : this.dateNaissance      || null,
                situationFamiliale: this.situationFamiliale || null,
                anneesExperience  : this.anneesExperience
                    ? parseInt(this.anneesExperience, 10) : null,
                dernierDiplome    : this.dernierDiplome     || null,
                niveauEtude       : this.niveauEtude        || null,
                ecoleUniversite   : this.ecoleUniversite    || null,
                anneeObtention    : this.anneeObtention
                    ? parseInt(this.anneeObtention, 10) : null
            });

            if (!candId) throw new Error('La création a échoué (Id vide).');
            this.candidatureId = candId;

            // ✅ Uploader le CV si présent
            if (this._pendingFile) {
                await this.uploadFileNow(this._pendingFile);
            }

            sessionStorage.removeItem('applyOfferId');
            sessionStorage.removeItem('applyOfferName');

            this.currentStep = 3;
            this.toast('Succès', 'Candidature enregistrée avec succès !', 'success');

        } catch(e) {
            this.lastError = this.err(e);
            this.toast('Erreur', this.lastError, 'error');
        } finally {
            this.isSubmitting = false;
        }
    }

    // ══════════════════════════════════════
    // UPLOAD FICHIER
    // ══════════════════════════════════════
    uploadFileNow = (file) => {
        return new Promise((resolve, reject) => {
            this.uploadingCv = true;
            const reader     = new FileReader();

            reader.onload = async (event) => {
                try {
                    await uploadCv({
                        recordId   : this.candidatureId,
                        fileName   : file.name,
                        base64Data : event.target.result,
                        contentType: file.type,
                        makePublic : false
                    });
                    this.cvUploaded  = true;
                    this.uploadingCv = false;
                    resolve();
                } catch(e) {
                    console.error('Erreur upload CV:', e);
                    this.uploadingCv = false;
                    reject(e);
                }
            };

            reader.onerror = () => {
                this.uploadingCv = false;
                reject(new Error('Impossible de lire le fichier.'));
            };

            reader.readAsDataURL(file);
        });
    }

    // ══════════════════════════════════════
    // UTILITAIRES
    // ══════════════════════════════════════
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