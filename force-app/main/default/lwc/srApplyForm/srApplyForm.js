import { LightningElement, track } from 'lwc';
import { NavigationMixin }         from 'lightning/navigation';
import { ShowToastEvent }          from 'lightning/platformShowToastEvent';

import getProfile        from '@salesforce/apex/SR_OfferController.getCurrentUserProfile';
import getOffer          from '@salesforce/apex/SR_OfferController.getOfferById';
import createCandidature from '@salesforce/apex/SR_ApplicationController.createCandidature';
import uploadCv          from '@salesforce/apex/SR_FileUploadController.uploadCv';
import parseCv           from '@salesforce/apex/SR_HerokuCvParser.parseCv';
import matchCv           from '@salesforce/apex/SR_MatchingController.matchCv';

export default class SrApplyForm extends NavigationMixin(LightningElement) {

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
    @track isJunior           = false;
    @track juniorAdvice       = '';

    // Étape 1 - Identité
    @track firstName          = '';
    @track lastName           = '';
    @track email              = '';
    @track telephone          = '';
    @track dateNaissance      = '';
    @track sexe               = '';
    @track situationFamiliale = '';

    // Étape 2 - Profil pro
    @track hardSkills         = [];   // { id, label }
    @track softSkills         = [];   // { id, label }
    @track experiences        = [];   // { id, poste, dateDebut, dateFin, description }
    @track newHardSkill       = '';
    @track newSoftSkill       = '';
    @track anneesExperience   = '';
    @track dernierDiplome     = '';
    @track niveauEtude        = '';
    @track ecoleUniversite    = '';
    @track anneeObtention     = '';

    get hasHardSkills() { return this.hardSkills.length > 0; }
    get hasSoftSkills() { return this.softSkills.length > 0; }

    // État
    @track isSubmitting       = false;
    @track lastError          = '';
    @track scoreMatching      = null;

    // ✅ Stocker le JSON du CV parsé pour le matching
    _pendingFile  = null;
    _cvParsedData = null;

    // ══════════════════════════════════════
    // GETTERS
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
    onAnneesExperience = (e) => { this.anneesExperience = e.detail.value; }
    onDernierDiplome   = (e) => { this.dernierDiplome   = e.detail.value; }
    onNiveauEtude      = (e) => { this.niveauEtude      = e.detail.value; }
    onEcoleUniversite  = (e) => { this.ecoleUniversite  = e.detail.value; }
    onAnneeObtention   = (e) => { this.anneeObtention   = e.detail.value; }

    // Hard Skills
    onNewHardSkillInput  = (e) => { this.newHardSkill = e.target.value; }
    onHardSkillKeydown   = (e) => { if (e.key === 'Enter') { e.preventDefault(); this.addHardSkill(); } }
    addHardSkill = () => {
        const label = (this.newHardSkill || '').trim();
        if (!label) return;
        if (this.hardSkills.find(s => s.label.toLowerCase() === label.toLowerCase())) return;
        this.hardSkills  = [...this.hardSkills, { id: Date.now() + Math.random(), label }];
        this.newHardSkill = '';
    }
    removeHardSkill = (e) => {
        const id = Number(e.currentTarget.dataset.id);
        this.hardSkills = this.hardSkills.filter(s => s.id !== id);
    }

    // Soft Skills
    onNewSoftSkillInput  = (e) => { this.newSoftSkill = e.target.value; }
    onSoftSkillKeydown   = (e) => { if (e.key === 'Enter') { e.preventDefault(); this.addSoftSkill(); } }
    addSoftSkill = () => {
        const label = (this.newSoftSkill || '').trim();
        if (!label) return;
        if (this.softSkills.find(s => s.label.toLowerCase() === label.toLowerCase())) return;
        this.softSkills  = [...this.softSkills, { id: Date.now() + Math.random(), label }];
        this.newSoftSkill = '';
    }
    removeSoftSkill = (e) => {
        const id = Number(e.currentTarget.dataset.id);
        this.softSkills = this.softSkills.filter(s => s.id !== id);
    }

    // Expériences
    addExperience = () => {
        this.experiences = [...this.experiences, {
            id: Date.now() + Math.random(), poste: '', dateDebut: '', dateFin: '', description: ''
        }];
    }
    removeExperience = (e) => {
        const id = Number(e.currentTarget.dataset.id);
        this.experiences = this.experiences.filter(exp => exp.id !== id);
    }
    onExpChange = (e) => {
        const id    = Number(e.currentTarget.dataset.id);
        const field = e.currentTarget.dataset.field;
        const value = e.target.value;
        this.experiences = this.experiences.map(exp =>
            exp.id === id ? { ...exp, [field]: value } : exp
        );
    }

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
        this._cvParsedData = null; // ✅ Reset CV data
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

        // ✅ Validation LWC standard de tous les champs (Prénom, Nom, Sexe, etc.)
        const allValid = [...this.template.querySelectorAll('lightning-input, lightning-combobox')]
            .reduce((validSoFar, inputCmp) => {
                inputCmp.reportValidity();
                return validSoFar && inputCmp.checkValidity();
            }, true);

        if (!allValid) {
            this.lastError = 'Veuillez remplir correctement tous les champs obligatoires.';
            this.toast('Champs requis', this.lastError, 'warning');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.email)) {
            this.lastError = 'Adresse email invalide.';
            this.toast('Email invalide', this.lastError, 'warning');
            return;
        }

        // ✅ Validation de l'âge (minimum 20 ans)
        if (this.dateNaissance) {
            const birthDate = new Date(this.dateNaissance);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            
            if (age < 20) {
                this.lastError = 'Vous devez avoir au moins 20 ans pour postuler.';
                this.toast('Âge minimum requis', this.lastError, 'error');
                return;
            }
        }

        if (!this._pendingFile) {
            this.lastError = 'Veuillez télécharger votre CV pour continuer.';
            this.toast('CV obligatoire', this.lastError, 'warning');
            return;
        }

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
    // PARSING CV
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
                    let base64Only   = fullBase64;
                    if (fullBase64 && fullBase64.includes(',')) {
                        base64Only = fullBase64.split(',')[1];
                    }

                    const data = await parseCv({
                        fileBase64  : base64Only,
                        fileName    : this._pendingFile.name,
                        contentType : this._pendingFile.type
                    });

                    if (!data) throw new Error('Réponse vide');

                    // ✅ Stocker le JSON parsé pour le matching
                    this._cvParsedData = {
                        anneesExperience : data.anneesExperience || 0,
                        competencesTech  : data.competencesTech  || '',
                        experienceProf   : data.experienceProf   || '',
                        competencesPerso : data.competencesPerso || '',
                        dernierDiplome   : data.dernierDiplome   || '',
                        ecoleUniversite  : data.ecoleUniversite  || '',
                        anneeObtention   : data.anneeObtention   || null
                    };

                    // ✅ Remplir les champs
                    if (data.anneesExperience != null && Number(data.anneesExperience) > 0) {
                        this.anneesExperience = String(data.anneesExperience);
                    }
                    if (data.competencesTech && data.competencesTech.trim()) {
                        this.hardSkills = data.competencesTech
                            .split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
                            .map(label => ({ id: Date.now() + Math.random(), label }));
                    }
                    if (data.competencesPerso && data.competencesPerso.trim()) {
                        this.softSkills = data.competencesPerso
                            .split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
                            .map(label => ({ id: Date.now() + Math.random(), label }));
                    }
                    if (data.experienceProf && data.experienceProf.trim()) {
                        // On découpe par ligne
                        const lines = data.experienceProf.split('\n').filter(line => line.trim());
                        this.experiences = lines.map(line => {
                            const parts = line.split('|').map(p => p.trim());
                            let poste = parts[0] || '';
                            let dateDebut = '';
                            let dateFin = '';
                            let description = parts.slice(1).join(' - ');

                            // Tentative simple d'extraction de dates (ex: 2020 - 2024)
                            const dateMatch = line.match(/\b(20\d{2})\b.*\b(20\d{2}|présent|actuel)\b/i);
                            if (dateMatch) {
                                dateDebut = dateMatch[1];
                                dateFin = dateMatch[2].toLowerCase().includes('20') ? dateMatch[2] : '';
                            }

                            return {
                                id: Date.now() + Math.random(),
                                poste: poste,
                                dateDebut: dateDebut,
                                dateFin: dateFin,
                                description: description
                            };
                        });
                    }
                    if (data.competencesPerso && data.competencesPerso.trim()) {
                        this.softSkills = data.competencesPerso
                            .split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
                            .map(label => ({ id: Date.now() + Math.random(), label }));
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

                    if (data.conseil) {
                        this.juniorAdvice = data.conseil;
                        this.isJunior     = !!data.is_junior;
                    }

                    if (data.errorMessage) {
                        this.cvParseError = true;
                        this.toast('Attention', data.errorMessage, 'warning');
                    } else {
                        this.cvParsed = true;
                        if (this.isJunior) {
                            this.toast('Profil Junior', 'Votre potentiel est mis en avant !', 'success');
                        } else {
                            this.toast('CV analysé !', 'Champs remplis automatiquement.', 'success');
                        }
                    }

                } catch(e) {
                    console.error('Erreur parsing:', e?.body?.message || e?.message);
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
            // ✅ Validation LWC standard de tous les champs de l'étape 2
            const allValid = [...this.template.querySelectorAll('lightning-input, lightning-textarea, lightning-combobox')]
                .reduce((validSoFar, inputCmp) => {
                    inputCmp.reportValidity();
                    return validSoFar && inputCmp.checkValidity();
                }, true);

            if (!allValid) {
                this.isSubmitting = false;
                this.lastError = 'Veuillez remplir tous les champs obligatoires.';
                this.toast('Champs requis', this.lastError, 'warning');
                return;
            }

            if (!this.offerId || String(this.offerId).trim().length < 15) {
                throw new Error('Offre manquante. Veuillez accéder au formulaire depuis une offre.');
            }

            // ✅ Créer la candidature
            const candId = await createCandidature({
                offreId           : String(this.offerId).trim(),
                sexe              : this.sexe               || null,
                techSkills        : this.hardSkills.map(s => s.label).join(', ') || null,
                experience        : JSON.stringify(this.experiences) || null,
                softSkills        : this.softSkills.map(s => s.label).join(', ') || null,
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
                    ? parseInt(this.anneeObtention, 10) : null,
                isJunior          : this.isJunior || false
            });

            if (!candId) throw new Error('La création a échoué (Id vide).');
            this.candidatureId = candId;

            // ✅ Uploader le CV si présent
            if (this._pendingFile) {
                await this.uploadFileNow(this._pendingFile);
            }

            // ✅ Matching CV / Offre avec les données À JOUR du formulaire
            if (this.offerId) {
                try {
                    const currentCvData = {
                        anneesExperience : this.anneesExperience ? parseInt(this.anneesExperience, 10) : 0,
                        competencesTech  : this.hardSkills.map(s => s.label).join(', '),
                        experienceProf   : JSON.stringify(this.experiences),
                        competencesPerso : this.softSkills.map(s => s.label).join(', '),
                        dernierDiplome   : this.dernierDiplome,
                        ecoleUniversite  : this.ecoleUniversite,
                        anneeObtention   : this.anneeObtention ? parseInt(this.anneeObtention, 10) : null
                    };

                    const score  = await matchCv({
                        cvDataJson    : JSON.stringify(currentCvData),
                        candidatureId : candId,
                        offreId       : String(this.offerId).trim()
                    });
                    this.scoreMatching = score;
                    console.log('✅ Score matching:', score);
                } catch(matchErr) {
                    console.warn('Matching ignoré:', matchErr?.body?.message || matchErr?.message);
                }
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