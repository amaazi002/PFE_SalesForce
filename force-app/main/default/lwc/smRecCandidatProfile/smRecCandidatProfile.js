import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin }               from 'lightning/navigation';
import { ShowToastEvent }                from 'lightning/platformShowToastEvent';
import { getPicklistValues,
         getObjectInfo }                 from 'lightning/uiObjectInfoApi';
import CANDIDATURE_OBJECT                from '@salesforce/schema/Candidature__c';
import STATUT_FIELD                      from '@salesforce/schema/Candidature__c.Statut__c';
import DECISION_FIELD                    from '@salesforce/schema/Candidature__c.Decision__c';
import getCandidatureById                from '@salesforce/apex/SMRecTabOffreController.getCandidatureById';
import updateCandidature                 from '@salesforce/apex/SMRecTabOffreController.updateCandidature';

export default class SmRecCandidatProfile
    extends NavigationMixin(LightningElement) {

    @track candidature    = null;
    @track isLoading      = true;
    @track errorMessage   = '';
    @track successMsg     = '';

    @track statutOptions   = [];
    @track decisionOptions = [];

    newStatut        = '';
    newDecision      = '';
    newDateEntretien = '';
    candidatureId    = '';
    recordTypeId     = '';

    // ══════════════════════════════════════════════
    // WIRE
    // ══════════════════════════════════════════════
    @wire(getObjectInfo, { objectApiName: CANDIDATURE_OBJECT })
    wiredObjectInfo({ data, error }) {
        if (data)  this.recordTypeId = data.defaultRecordTypeId;
        if (error) console.error('getObjectInfo:', JSON.stringify(error));
    }

    @wire(getPicklistValues, {
        recordTypeId : '$recordTypeId',
        fieldApiName : STATUT_FIELD
    })
    wiredStatutValues({ data, error }) {
        if (data) {
            this.statutOptions = data.values.map(v => ({
                label : v.label,
                value : v.value
            }));
        }
        if (error) {
            console.error('Statut picklist:', JSON.stringify(error));
        }
    }

    @wire(getPicklistValues, {
        recordTypeId : '$recordTypeId',
        fieldApiName : DECISION_FIELD
    })
    wiredDecisionValues({ data, error }) {
        if (data) {
            this.decisionOptions = data.values.map(v => ({
                label : v.label,
                value : v.value
            }));
        }
        if (error) {
            console.error('Decision picklist:', JSON.stringify(error));
        }
    }

    // ══════════════════════════════════════════════
    // LIFECYCLE
    // ══════════════════════════════════════════════
    connectedCallback() {
        const url = new URL(window.location.href);
        this.candidatureId = url.searchParams.get('id') || '';
        if (this.candidatureId) {
            this.loadCandidature();
        } else {
            this.isLoading    = false;
            this.errorMessage = 'ID candidature introuvable dans l\'URL';
        }
    }

    // ══════════════════════════════════════════════
    // CHARGER CANDIDATURE
    // ══════════════════════════════════════════════
    async loadCandidature() {
        this.isLoading = true;
        try {
            const data = await getCandidatureById({
                candidatureId: this.candidatureId
            });
            this.candidature = data;
        } catch (e) {
            this.errorMessage = this.err(e);
            this.toast('Erreur', this.err(e), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // ══════════════════════════════════════════════
    // GETTERS
    // ══════════════════════════════════════════════
    get initiales() {
        const name = this.candidature?.Candidat__r?.Name || '';
        return name.split(' ')
                   .map(n => n[0])
                   .join('')
                   .toUpperCase()
                   .substring(0, 2);
    }

    get dateFmt() {
        return this.candidature?.DateDepot__c
            ? new Date(this.candidature.DateDepot__c)
                .toLocaleDateString('fr-FR')
            : '—';
    }

    get dateEntretienFmt() {
        if (!this.candidature?.DateEntretien__c) return '—';
        return new Date(this.candidature.DateEntretien__c)
            .toLocaleString('fr-FR', {
                day   : '2-digit',
                month : '2-digit',
                year  : 'numeric',
                hour  : '2-digit',
                minute: '2-digit'
            });
    }

    get hasCv() {
        return !!this.candidature?.CV_Public_URL__c;
    }

    get hasDecision() {
        return !!this.candidature?.Decision__c;
    }

    get statutClass() {
        const s = String(this.candidature?.Statut__c || '').toLowerCase();
        if (s === 'soumise')                         return 'badge-statut badge-soumise';
        if (s.includes('entretien') && !s.includes('sans')) return 'badge-statut badge-entretien';
        if (s.includes('sans'))                      return 'badge-statut badge-sans-entretien';
        return 'badge-statut';
    }

    get decisionClass() {
        const d = String(this.candidature?.Decision__c || '').toLowerCase();
        if (d.includes('accept')) return 'badge-decision badge-accepte';
        if (d.includes('refus'))  return 'badge-decision badge-refuse';
        return 'badge-decision';
    }

    get scoreBarClass() {
        const score = this.candidature?.Score_Matching__c || 0;
        if (score >= 70) return 'score-bar score-high';
        if (score >= 40) return 'score-bar score-medium';
        return 'score-bar score-low';
    }

    get scoreBarStyle() {
        const score = this.candidature?.Score_Matching__c || 0;
        return `width: ${score}%`;
    }

    // ══════════════════════════════════════════════
    // HANDLERS
    // ══════════════════════════════════════════════
    handleStatutChange(event) {
        this.newStatut = event.target.value;
    }

    handleDecisionChange(event) {
        this.newDecision = event.target.value;
    }

    handleDateEntretienChange(event) {
        // datetime-local donne "2024-01-15T10:30"
        this.newDateEntretien = event.target.value;
    }

    async handleSaveAction() {
        this.errorMessage = '';
        this.successMsg   = '';

        if (!this.newStatut &&
            !this.newDecision &&
            !this.newDateEntretien) {
            this.errorMessage = 'Remplissez au moins un champ.';
            return;
        }

        // ✅ "2024-01-15T10:30" → "2024-01-15 10:30:00"
        let dateForApex = '';
        if (this.newDateEntretien) {
            dateForApex = this.newDateEntretien.replace('T', ' ') + ':00';
        }

        try {
            await updateCandidature({
                candidatureId : this.candidatureId,
                newStatut     : this.newStatut   || '',
                decision      : this.newDecision || '',
                dateEntretien : dateForApex
            });

            this.candidature = {
                ...this.candidature,
                Statut__c: this.newStatut
                    ? this.newStatut
                    : this.candidature.Statut__c,
                Decision__c: this.newDecision
                    ? this.newDecision
                    : this.candidature.Decision__c,
                DateEntretien__c: this.newDateEntretien
                    ? new Date(this.newDateEntretien).toISOString()
                    : this.candidature.DateEntretien__c
            };

            this.newStatut        = '';
            this.newDecision      = '';
            this.newDateEntretien = '';

            this.template
                .querySelectorAll('.select-action')
                .forEach(s => { s.value = ''; });

            const dateInput = this.template.querySelector('.input-date');
            if (dateInput) dateInput.value = '';

            this.successMsg = '✅ Candidature mise à jour avec succès.';
            this.toast('Succès', 'Candidature mise à jour.', 'success');

        } catch (e) {
            this.errorMessage = this.err(e);
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    // ══════════════════════════════════════════════
    // NAVIGATION
    // ══════════════════════════════════════════════
    handleBack() {
        history.back();
    }

    // ══════════════════════════════════════════════
    // UTILITAIRES
    // ══════════════════════════════════════════════
    toast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({ title, message, variant })
        );
    }

    err(e) {
        const b = e?.body || e?.detail || {};
        if (b.message)                return b.message;
        if (b.pageErrors?.length)     return b.pageErrors[0].message;
        if (b.output?.errors?.length) return b.output.errors[0].message;
        return e?.message || 'Une erreur est survenue';
    }
}