import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

import { getRecord } from 'lightning/uiRecordApi';
import { getPicklistValuesByRecordType, getObjectInfo } from 'lightning/uiObjectInfoApi';
import OFFRE_OBJECT from '@salesforce/schema/Offre__c';

import getOffres from '@salesforce/apex/SMRecTabOffreController.getOffres';
import clotureOffre from '@salesforce/apex/SMRecTabOffreController.clotureOffre';
import getCandidatures from '@salesforce/apex/SMRecTabOffreController.getCandidatures';

// Valeur préférée pour la picklist "non visible"
const INVISIBLE_PREFERRED = 'Non';

export default class SMRecTabOffre extends NavigationMixin(LightningElement) {
    @track rows = [];
    @track candidatures = [];
    // Candidatures modal
    isModalOpen = false;
    modalOfferId;
    modalOfferTitle;

    // Edit modal
    isEditModalOpen = false;
    editRecordId;
    editOfferTitle;
    isEditClosed = false; // masque Visible_aux_candidat__c si true
    savingAsDraft = false;

    // Picklist/RT helpers
    currentRtId;
    allowedVisibleValues = [];
    defaultRtId;

    connectedCallback() {
        this.loadOffres();
    }

    // ----- Object Info (fallback RT) -----
    @wire(getObjectInfo, { objectApiName: OFFRE_OBJECT })
    wiredObjInfo({ data }) {
        if (data) {
            this.defaultRtId = data.defaultRecordTypeId;
        }
    }

    get hasRows() { return Array.isArray(this.rows) && this.rows.length > 0; }
    get hasCandidatures() { return Array.isArray(this.candidatures) && this.candidatures.length > 0; }

    async loadOffres() {
        try {
            const data = await getOffres();
            this.rows = (data || []).map(r => {
                const isHidden =
                    typeof r.Visible_aux_candidat__c === 'boolean'
                        ? r.Visible_aux_candidat__c === false
                        : (String(r.Visible_aux_candidat__c).toLowerCase() !== 'oui' &&
                        String(r.Visible_aux_candidat__c).toLowerCase() !== 'yes' &&
                        String(r.Visible_aux_candidat__c).toLowerCase() !== 'true');

                const closed = (r.Statut__c === 'Clôturée') || isHidden;
                const draft  = (r.Statut__c === 'Brouillon');

                const createdDateFmt = r.CreatedDate ? new Date(r.CreatedDate).toLocaleString('fr-FR') : '';
                const deadlineFmt    = r.Deadline__c ? new Date(r.Deadline__c).toLocaleDateString('fr-FR') : '';

                const typeLabel = r.TypeOffre__c || '';

                return {
                    ...r,
                    __closed: closed,
                    __draft: draft,
                    rowClass: closed ? 'is-closed' : (draft ? 'is-draft' : ''),
                    closeLabel: closed ? 'Clôturée' : 'Clôturer',
                    createdDateFmt,
                    deadlineFmt,
                    typeLabel
                };
            });
        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    // ---------- EDIT ----------
    handleEdit = (event) => {
        const recordId = event.currentTarget?.dataset?.id || event.target?.dataset?.id;
        if (!recordId) {
            this.toast('Erreur', 'Id introuvable pour la ligne.', 'error');
            return;
        }
        const row = this.rows.find(r => r.Id === recordId);
        this.editRecordId   = recordId;
        this.editOfferTitle = row ? row.Titre__c : '';
        this.isEditClosed   = (row?.Statut__c === 'Clôturée');
        this.isEditModalOpen = true;
    };

    closeEditModal = () => { this.isEditModalOpen = false; };

    onStatusChange = (e) => {
        const val = e?.detail?.value;
        this.isEditClosed = (val === 'Clôturée');
    };

    // Récupère le RecordTypeId de l’offre en cours d’édition
    @wire(getRecord, { recordId: '$editRecordId', fields: ['Offre__c.RecordTypeId'] })
    wiredEditRecord({ data }) {
        if (data) {
            this.currentRtId = data.fields.RecordTypeId.value;
        } else if (!this.currentRtId && this.defaultRtId) {
            // Fallback si on n'a pas pu lire le RT de l'enregistrement
            this.currentRtId = this.defaultRtId;
        }
    }

    // Récupère les valeurs autorisées de Visible_aux_candidat__c pour ce Record Type
    @wire(getPicklistValuesByRecordType, { objectApiName: OFFRE_OBJECT, recordTypeId: '$currentRtId' })
    wiredVisiblePicklist({ data }) {
        if (data) {
            this.allowedVisibleValues = data.picklistFieldValues?.Visible_aux_candidat__c?.values || [];
        }
    }

    // Helpers pour choisir une valeur "invisible" autorisée
    findAllowedExact(value) {
        if (!value || !this.allowedVisibleValues?.length) return null;
        const tgt = String(value).toLowerCase();
        return this.allowedVisibleValues.find(v =>
            (v.value || '').toLowerCase() === tgt || (v.label || '').toLowerCase() === tgt
        ) || null;
    }

    getInvisibleOption() {
        if (!this.allowedVisibleValues?.length) return null;
        const candidates = ['Non', 'No', 'False', 'Inactif', 'Invisible', 'Masquée', 'Masque', 'Hidden', 'Off', 'Indisponible'];
        return this.allowedVisibleValues.find(v => {
            const lab = (v.label || '').toLowerCase();
            const val = (v.value || '').toLowerCase();
            return candidates.some(c => lab.includes(c.toLowerCase()) || val.includes(c.toLowerCase()));
        }) || null;
    }

    // Valeur de repli sûre (éviter de bloquer)
    getFallbackInvisible() {
        if (!this.allowedVisibleValues?.length) return null;
        const notPositive = this.allowedVisibleValues.find(v => {
            const s = ((v.value || v.label || '') + '').toLowerCase();
            return !(s.includes('oui') || s.includes('yes') || s.includes('true'));
        });
        return notPositive || this.allowedVisibleValues[0];
    }

    // Désactiver "Enregistrer" si Statut = Clôturée mais la picklist n'est pas encore chargée
    get saveDisabled() {
        return this.isEditModalOpen && this.isEditClosed && (!this.allowedVisibleValues || this.allowedVisibleValues.length === 0);
    }

    // Appliquer “invisible” côté candidats (checkbox/picklist)
    applyInvisibleToFields(fields) {
        const row = this.rows.find(rr => rr.Id === this.editRecordId);
        const isBool = typeof row?.Visible_aux_candidat__c === 'boolean';
        if (isBool) {
            fields.Visible_aux_candidat__c = false;
        } else {
            const invExact = this.findAllowedExact(INVISIBLE_PREFERRED);
            const invGuess = invExact || this.getInvisibleOption() || this.getFallbackInvisible();
            if (invGuess && invGuess.value) {
                fields.Visible_aux_candidat__c = invGuess.value;
            }
        }
    }

    // Interception + forçage selon statut
    handleEditSubmit = (event) => {
        event.preventDefault();

        const form   = event.target;               // <lightning-record-edit-form>
        const fields = { ...event.detail.fields }; // copie des champs

        const newStatus = this.savingAsDraft ? 'Brouillon' : (fields.Statut__c?.value ?? fields.Statut__c);
        const newType   = fields.TypeOffre__c?.value ?? fields.TypeOffre__c;


        if (this.savingAsDraft || newStatus === 'Brouillon') {
            fields.Statut__c = 'Brouillon';
            this.applyInvisibleToFields(fields);
        } else if (newStatus === 'Clôturée') {
            this.applyInvisibleToFields(fields);
        }
        if (String(newType || '').toLowerCase() === 'interne' || String(newType || '').toLowerCase() === 'internal') {
            this.applyInvisibleToFields(fields);
        }

        form.submit(fields);
    }

    handleSaveAsDraft = () => {
        this.savingAsDraft = true;
        const form = this.template.querySelector('lightning-record-edit-form');
        if (!form) {
            this.savingAsDraft = false;
            this.toast('Erreur','Formulaire introuvable','error');
            return;
        }
        // Récupère les valeurs courantes visibles dans les lightning-input-field
        const fields = { Id: this.editRecordId };
        this.template.querySelectorAll('lightning-input-field').forEach(f => {
            const api = f.fieldName || f.getAttribute('field-name');
            fields[api] = f.value;
        });
        // Simule le submit via handleEditSubmit
        const fakeEvent = { preventDefault: () => {}, target: form, detail: { fields } };
        this.handleEditSubmit(fakeEvent);
    }

    // Patch local après succès
    handleEditSuccess = (event) => {
        const id = event.detail.id;
        const f  = event.detail.fields || {};

        this.rows = this.rows.map(r => {
            if (r.Id !== id) return r;

            const newTitre = f.Titre__c?.value ?? r.Titre__c;
            const newDept  = f.Departement__c?.value ?? r.Departement__c;
            const newLoc   = f.Localisation__c?.value ?? r.Localisation__c;
            const newStat  = f.Statut__c?.value ?? (this.savingAsDraft ? 'Brouillon' : r.Statut__c);
            const visField = f.Visible_aux_candidat__c?.value ?? r.Visible_aux_candidat__c;

            const isHidden =
                typeof visField === 'boolean'
                    ? visField === false
                    : (String(visField).toLowerCase() !== 'oui' && String(visField).toLowerCase() !== 'yes' && String(visField).toLowerCase() !== 'true');

            const closed = (newStat === 'Clôturée') || isHidden;
            const draft  = (newStat === 'Brouillon');

            return {
                ...r,
                Titre__c: newTitre,
                Departement__c: newDept,
                Localisation__c: newLoc,
                Statut__c: newStat,
                Visible_aux_candidat__c: visField,
                __closed: closed,
                __draft: draft,
                rowClass: closed ? 'is-closed' : (draft ? 'is-draft' : ''),
                closeLabel: closed ? 'Clôturée' : 'Clôturer'
            };
        });

        const msg = this.savingAsDraft ? 'Offre enregistrée comme brouillon.' : 'Offre mise à jour.';
        this.savingAsDraft = false;
        this.toast('Succès', msg, 'success');
        this.isEditModalOpen = false;
    };

    handleEditError = (evt) => {
        const msg = evt?.detail?.message || 'Une erreur est survenue';
        this.toast('Erreur', msg, 'error');
    };

    // ---------- CLOSE (via bouton Clôturer) ----------
    async handleClose(event) {
        const recordId = event.currentTarget?.dataset?.id || event.target?.dataset?.id;
        if (!recordId) {
            this.toast('Erreur', 'Id introuvable pour la ligne.', 'error');
            return;
        }

        try {
            await clotureOffre({ offreId: recordId });
            // Patch local
            this.rows = this.rows.map(r =>
                r.Id === recordId
                    ? {
                        ...r,
                        Statut__c: 'Clôturée',
                        Visible_aux_candidat__c:
                            typeof r.Visible_aux_candidat__c === 'boolean' ? false : INVISIBLE_PREFERRED,
                        __closed: true,
                        __draft: false,
                        rowClass: 'is-closed',
                        closeLabel: 'Clôturée'
                    }
                    : r
            );
            this.toast('Succès', 'Offre clôturée et masquée côté candidats.', 'success');
        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    // ---------- Candidatures ----------
    async openCandidatures(event) {
        const offreId = event.currentTarget?.dataset?.id || event.target?.dataset?.id;
        const title   = event.currentTarget?.dataset?.title || event.target?.dataset?.title;
        if (!offreId) {
            this.toast('Erreur', 'Id introuvable pour la ligne.', 'error');
            return;
        }
        this.modalOfferId = offreId;
        this.modalOfferTitle = title || '';

        try {
            const data = await getCandidatures({ offreId });
            this.candidatures = (data || []).map(c => {
                // raw URL from the record
                const raw = c?.CV_Public_URL__c;
                // ensure it starts with http(s) so lightning-formatted-url makes it clickable
                const cvUrl = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;

                return {
                    ...c,
                    candidateName: c?.Candidat__r ? c.Candidat__r.Name : '',
                    createdDateFmt: c?.DateDepot__c ? new Date(c.DateDepot__c).toLocaleString('fr-FR') : '',
                    cvUrl,
                    // keep label short; change to `raw` if you prefer showing the full URL
                    cvLabel: raw ? 'Ouvrir le CV' : '—'
                };
            });
            this.isModalOpen = true;
        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    closeModal = () => { this.isModalOpen = false; };

    // ---------- Helpers ----------
    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
    err(e) {
        const b = e?.body || e?.detail || {};
        if (b.message) return b.message;
        if (b.pageErrors?.length) return b.pageErrors[0].message;
        if (b.output?.errors?.length) return b.output.errors[0].message;
        if (b.output?.fieldErrors) {
            const keys = Object.keys(b.output.fieldErrors);
            if (keys.length && b.output.fieldErrors[keys[0]]?.length) {
                return b.output.fieldErrors[keys[0]][0].message;
            }
        }
        return e?.message || 'Une erreur est survenue';
    }
}