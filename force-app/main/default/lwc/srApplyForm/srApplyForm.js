import { LightningElement, track } from 'lwc';
import { NavigationMixin }         from 'lightning/navigation';
import { ShowToastEvent }          from 'lightning/platformShowToastEvent';

import getProfile        from '@salesforce/apex/SR_OfferController.getCurrentUserProfile';
import getOffer          from '@salesforce/apex/SR_OfferController.getOfferById';
import createCandidature from '@salesforce/apex/SR_ApplicationController.createCandidature';
import uploadCv          from '@salesforce/apex/SR_FileUploadController.uploadCv';

// ✅ Nouveau : appel Heroku pour parser le CV
import parseCv           from '@salesforce/apex/SR_HerokuCvParser.parseCv';

export default class SrApplyForm extends NavigationMixin(LightningElement) {

    // ── State ────────────────────────────────────────────────────────
    @track offerId       = null;
    @track offerName     = '';
    @track candidatureId = null;
    @track cvUploaded    = false;
    @track uploadingCv   = false;
    @track fileName      = '';
    @track currentStep   = 1;

    // ✅ Nouveau : état parsing CV
    @track parsingCv     = false;
    @track cvParsed      = false;

    // ── Étape 1 ──────────────────────────────────────────────────────
    @track firstName          = '';
    @track lastName           = '';
    @track email              = '';
    @track telephone          = '';
    @track dateNaissance      = '';
    @track sexe               = '';
    @track situationFamiliale = '';

    // ── Étape 2 ──────────────────────────────────────────────────────
    @track tech             = '';
    @track xp               = '';
    @track soft             = '';
    @track anneesExperience = '';
    @track dernierDiplome   = '';
    @track niveauEtude      = '';
    @track ecoleUniversite  = '';
    @track anneeObtention   = '';

    isSubmitting = false;
    lastError    = '';
    _pendingFile = null;

    // ── Getters étapes ───────────────────────────────────────────────
    get isStep1() { return this.currentStep === 1; }
    get isStep2() { return this.currentStep === 2; }
    get isStep3() { return this.currentStep === 3; }

    get stepClass1() {
        return 'step' + (this.currentStep >= 1 ? ' step--active' : '');
    }
    get stepClass2() {
        return 'step' + (this.currentStep >= 2 ? ' step--active' : '');
    }
    get stepClass3() {
        return 'step' + (this.currentStep >= 3 ? ' step--active' : '');
    }
    get isStep1Done() { return this.currentStep > 1; }

    // ── Options picklists ────────────────────────────────────────────
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

    // ── Connexion ────────────────────────────────────────────────────
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
        } catch(e) {}

        try {
            if (!this.offerName && this.offerId) {
                const o    = await getOffer({ offreId: this.offerId });
                this.offerName = o?.Titre__c || '';
            }
        } catch(e) {}
    }

    // ── Handlers étape 1 ─────────────────────────────────────────────
    onFirst              = (e) => { this.firstName          = e.detail.value; }
    onLast               = (e) => { this.lastName           = e.detail.value; }
    onEmail              = (e) => { this.email              = e.detail.value; }
    onTelephone          = (e) => { this.telephone          = e.detail.value; }
    onDateNaissance      = (e) => { this.dateNaissance      = e.detail.value; }
    onSexe               = (e) => { this.sexe               = e.detail.value; }
    onSituationFamiliale = (e) => { this.situationFamiliale = e.detail.value; }

    // ── Handlers étape 2 ─────────────────────────────────────────────
    onTech             = (e) => { this.tech             = e.detail.value; }
    onXp               = (e) => { this.xp               = e.detail.value; }
    onSoft             = (e) => { this.soft             = e.detail.value; }
    onAnneesExperience = (e) => { this.anneesExperience = e.detail.value; }
    onDernierDiplome   = (e) => { this.dernierDiplome   = e.detail.value; }
    onNiveauEtude      = (e) => { this.niveauEtude      = e.detail.value; }
    onEcoleUniversite  = (e) => { this.ecoleUniversite  = e.detail.value; }
    onAnneeObtention   = (e) => { this.anneeObtention   = e.detail.value; }

    // ── Sélection fichier ────────────────────────────────────────────
    onFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowed = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!allowed.includes(file.type)) {
            this.toast('Erreur', 'Format non autorisé. PDF, DOC ou DOCX uniquement.', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.toast('Erreur', 'Fichier trop volumineux (max 5 Mo).', 'error');
            return;
        }
        this.fileName     = file.name;
        this._pendingFile = file;
        this.cvParsed     = false;
    }

    // ── Navigation étape 1 → 2 ──────────────────────────────────────
    goStep2 = async () => {
        this.lastError = '';

        // Validation
        if (!this.firstName || !this.lastName || !this.email) {
            this.lastError = 'Prénom, Nom et Email sont obligatoires.';
            this.toast('Champs requis', this.lastError, 'warning');
            return;
        }

        // ✅ Si CV présent → parser avec Heroku
        if (this._pendingFile && !this.cvParsed) {
            await this.parseCvWithHeroku();
        }

        this.currentStep = 2;
    }

    // ── Parser le CV avec Heroku ─────────────────────────────────────
    parseCvWithHeroku = () => {
        return new Promise((resolve) => {
            this.parsingCv = true;
            this.lastError = '';

            const reader = new FileReader();

            reader.onload = async () => {
                try {
                    const base64 = reader.result;

                    console.log('Appel Heroku CV Parser...');

                    // ✅ Appel Apex → Heroku
                    const data = await parseCv({
                        fileBase64  : base64,
                        fileName    : this._pendingFile.name,
                        contentType : this._pendingFile.type
                    });

                    console.log('Résultat Heroku:', JSON.stringify(data));

                    if (data.errorMessage) {
                        console.warn('Erreur parsing:', data.errorMessage);
                        this.toast(
                            'Attention',
                            'CV analysé partiellement : ' + data.errorMessage,
                            'warning'
                        );
                    } else {
                        this.toast(
                            'CV analysé !',
                            'Les champs ont été remplis automatiquement.',
                            'success'
                        );
                    }

                    // ✅ Remplir automatiquement les champs étape 2
                    if (data.anneesExperience != null && data.anneesExperience > 0) {
                        this.anneesExperience = String(data.anneesExperience);
                    }
                    if (data.competencesTech) {
                        this.tech = data.competencesTech;
                    }
                    if (data.experienceProf) {
                        this.xp = data.experienceProf;
                    }
                    if (data.competencesPerso) {
                        this.soft = data.competencesPerso;
                    }
                    if (data.dernierDiplome) {
                        this.dernierDiplome = data.dernierDiplome;
                    }
                    if (data.ecoleUniversite) {
                        this.ecoleUniversite = data.ecoleUniversite;
                    }
                    if (data.anneeObtention != null && data.anneeObtention > 0) {
                        this.anneeObtention = String(data.anneeObtention);
                    }

                    this.cvParsed  = true;

                } catch(e) {
                    console.error('Erreur parseCv:', e);
                    this.toast(
                        'Attention',
                        'Analyse du CV échouée. Remplissez manuellement.',
                        'warning'
                    );
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

    goStep1 = () => { this.lastError = ''; this.currentStep = 1; }

    // ── Soumission ───────────────────────────────────────────────────
    submit = async () => {
        if (this.isSubmitting) return;
        this.isSubmitting = true;
        this.lastError    = '';

        try {
            if (!this.tech || !this.xp || !this.soft) {
                throw new Error(
                    'Renseignez compétences techniques, expérience et compétences personnelles.'
                );
            }
            if (!this.offerId || String(this.offerId).trim().length < 15) {
                throw new Error('Offre manquante.');
            }

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

            // Upload CV
            if (this._pendingFile) {
                await this.uploadFileNow(this._pendingFile);
            }

            sessionStorage.removeItem('applyOfferId');
            sessionStorage.removeItem('applyOfferName');

            this.currentStep = 3;
            this.toast('Succès', 'Candidature enregistrée !', 'success');

        } catch(e) {
            this.lastError = this.err(e);
            this.toast('Erreur', this.lastError, 'error');
        } finally {
            this.isSubmitting = false;
        }
    }

    // ── Upload Base64 ─────────────────────────────────────────────────
    uploadFileNow = (file) => {
        return new Promise((resolve, reject) => {
            this.uploadingCv = true;
            const reader     = new FileReader();
            reader.onload = async () => {
                try {
                    await uploadCv({
                        recordId   : this.candidatureId,
                        fileName   : file.name,
                        base64Data : reader.result,
                        contentType: file.type,
                        makePublic : false
                    });
                    this.cvUploaded  = true;
                    this.uploadingCv = false;
                    resolve();
                } catch(e) {
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

    goBack = () => {
        sessionStorage.removeItem('applyOfferId');
        sessionStorage.removeItem('applyOfferName');
        this[NavigationMixin.Navigate]({
            type      : 'comm__namedPage',
            attributes: { name: 'Home' }
        });
    }

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