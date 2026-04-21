import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent }                from 'lightning/platformShowToastEvent';
import { NavigationMixin }               from 'lightning/navigation';
import { getRecord }                     from 'lightning/uiRecordApi';
import { getPicklistValuesByRecordType, getObjectInfo } from 'lightning/uiObjectInfoApi';
import OFFRE_OBJECT                      from '@salesforce/schema/Offre__c';
import userId                            from '@salesforce/user/Id';

import getOffres               from '@salesforce/apex/SMRecTabOffreController.getOffres';
import getCandidatures         from '@salesforce/apex/SMRecTabOffreController.getCandidatures';
import clotureOffre            from '@salesforce/apex/SMRecTabOffreController.clotureOffre';
import updateOffre             from '@salesforce/apex/SMRecTabOffreController.updateOffre';
import updateStatutCandidature from '@salesforce/apex/SMRecTabOffreController.updateStatutCandidature';

const INVISIBLE_PREFERRED = 'Non';

export default class SMRecTabOffre extends NavigationMixin(LightningElement) {

    @track rows         = [];
    @track candidatures = [];

    get isGuest() { return !userId; }

    isModalOpen          = false;
    modalOfferId;
    modalOfferTitle;
    isEditModalOpen      = false;
    editRecordId;
    editOfferTitle;
    isEditClosed         = false;
    savingAsDraft        = false;
    currentRtId;
    allowedVisibleValues = [];
    defaultRtId;

    // Confirmation modal
    isConfirmModalOpen  = false;
    confirmTitle        = '';
    confirmMessage      = '';
    confirmVariant      = '';
    pendingCandidatureId;
    pendingAction;

    // ── Lifecycle ────────────────────────────────────────────────
    connectedCallback() {
        this.loadOffres();
    }

    @wire(getObjectInfo, { objectApiName: OFFRE_OBJECT })
    wiredObjInfo({ data, error }) {
        if (data)  this.defaultRtId = data.defaultRecordTypeId;
        if (error) console.error('wiredObjInfo:', JSON.stringify(error));
    }

    // ── Getters ──────────────────────────────────────────────────
    get hasRows() {
        return Array.isArray(this.rows) && this.rows.length > 0;
    }

    get hasCandidatures() {
        return Array.isArray(this.candidatures) && this.candidatures.length > 0;
    }

    // ── Charger offres ───────────────────────────────────────────
    async loadOffres() {
        try {
            const data = await getOffres();
            this.rows = (data || []).map(r => {
                const isHidden =
                    typeof r.Visible_aux_candidat__c === 'boolean'
                        ? r.Visible_aux_candidat__c === false
                        : (String(r.Visible_aux_candidat__c || '').toLowerCase() !== 'oui' &&
                           String(r.Visible_aux_candidat__c || '').toLowerCase() !== 'yes' &&
                           String(r.Visible_aux_candidat__c || '').toLowerCase() !== 'true');

                const closed = (r.Statut__c === 'Clôturée') || isHidden;
                const draft  = (r.Statut__c === 'Brouillon');

                return {
                    ...r,
                    __closed:       closed,
                    __draft:        draft,
                    rowClass:       closed ? 'is-closed' : (draft ? 'is-draft' : ''),
                    closeLabel:     closed ? 'Clôturée'  : 'Clôturer',
                    createdDateFmt: r.CreatedDate
                        ? new Date(r.CreatedDate).toLocaleString('fr-FR') : '',
                    deadlineFmt:    r.Deadline__c
                        ? new Date(r.Deadline__c).toLocaleDateString('fr-FR') : '',
                    typeLabel:      r.TypeOffre__c || ''
                };
            });
        } catch (e) {
            console.error('ERREUR loadOffres:', JSON.stringify(e));
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    // ── Édition ──────────────────────────────────────────────────
    handleEdit = (event) => {
        if (this.isGuest) {
            this.toast('Accès refusé', 'Connectez-vous.', 'warning');
            return;
        }
        const recordId = event.currentTarget?.dataset?.id
                      || event.target?.dataset?.id;
        if (!recordId) {
            this.toast('Erreur', 'Id introuvable.', 'error');
            return;
        }
        const row            = this.rows.find(r => r.Id === recordId);
        this.editRecordId    = recordId;
        this.editOfferTitle  = row?.Titre__c || '';
        this.isEditClosed    = (row?.Statut__c === 'Clôturée');
        this.isEditModalOpen = true;
    };

    closeEditModal = () => { this.isEditModalOpen = false; };

    onStatusChange = (e) => {
        this.isEditClosed = (e?.detail?.value === 'Clôturée');
    };

    @wire(getRecord, {
        recordId: '$editRecordId',
        fields:   ['Offre__c.RecordTypeId']
    })
    wiredEditRecord({ data, error }) {
        if (data) {
            this.currentRtId = data.fields.RecordTypeId.value;
        } else if (!this.currentRtId && this.defaultRtId) {
            this.currentRtId = this.defaultRtId;
        }
        if (error) console.error('wiredEditRecord:', JSON.stringify(error));
    }

    @wire(getPicklistValuesByRecordType, {
        objectApiName: OFFRE_OBJECT,
        recordTypeId:  '$currentRtId'
    })
    wiredVisiblePicklist({ data, error }) {
        if (data) {
            this.allowedVisibleValues =
                data.picklistFieldValues?.Visible_aux_candidat__c?.values || [];
        }
        if (error) console.error('wiredVisiblePicklist:', JSON.stringify(error));
    }

    findAllowedExact(value) {
        if (!value || !this.allowedVisibleValues?.length) return null;
        const tgt = String(value).toLowerCase();
        return this.allowedVisibleValues.find(v =>
            (v.value || '').toLowerCase() === tgt ||
            (v.label || '').toLowerCase() === tgt
        ) || null;
    }

    getInvisibleOption() {
        if (!this.allowedVisibleValues?.length) return null;
        const candidates = ['Non','No','False','Inactif',
                            'Invisible','Masquée','Hidden','Off'];
        return this.allowedVisibleValues.find(v => {
            const lab = (v.label || '').toLowerCase();
            const val = (v.value || '').toLowerCase();
            return candidates.some(c =>
                lab.includes(c.toLowerCase()) || val.includes(c.toLowerCase())
            );
        }) || null;
    }

    getFallbackInvisible() {
        if (!this.allowedVisibleValues?.length) return null;
        const notPositive = this.allowedVisibleValues.find(v => {
            const s = ((v.value || v.label || '') + '').toLowerCase();
            return !(s.includes('oui') || s.includes('yes') || s.includes('true'));
        });
        return notPositive || this.allowedVisibleValues[0];
    }

    get saveDisabled() {
        return this.isEditModalOpen && this.isEditClosed &&
               (!this.allowedVisibleValues || this.allowedVisibleValues.length === 0);
    }

    applyInvisibleToFields(fields) {
        const row    = this.rows.find(rr => rr.Id === this.editRecordId);
        const isBool = typeof row?.Visible_aux_candidat__c === 'boolean';
        if (isBool) {
            fields.Visible_aux_candidat__c = false;
        } else {
            const inv = this.findAllowedExact(INVISIBLE_PREFERRED)
                     || this.getInvisibleOption()
                     || this.getFallbackInvisible();
            if (inv?.value) fields.Visible_aux_candidat__c = inv.value;
        }
    }

    handleEditSubmit = async (event) => {
        event.preventDefault();

        const fields    = { ...event.detail.fields };
        const newStatus = this.savingAsDraft
            ? 'Brouillon'
            : (fields.Statut__c?.value ?? fields.Statut__c);
        const newType   = fields.TypeOffre__c?.value ?? fields.TypeOffre__c;

        if (this.savingAsDraft || newStatus === 'Brouillon') {
            fields.Statut__c = 'Brouillon';
            this.applyInvisibleToFields(fields);
        } else if (newStatus === 'Clôturée') {
            this.applyInvisibleToFields(fields);
        }
        if (['interne','internal'].includes(
            String(newType || '').toLowerCase()
        )) {
            this.applyInvisibleToFields(fields);
        }

        try {
            await updateOffre({
                offreId:            this.editRecordId,
                titre:              fields.Titre__c?.value               ?? fields.Titre__c,
                departement:        fields.Departement__c?.value         ?? fields.Departement__c,
                localisation:       fields.Localisation__c?.value        ?? fields.Localisation__c,
                deadline:           fields.Deadline__c?.value            ?? fields.Deadline__c,
                statut:             fields.Statut__c?.value              ?? fields.Statut__c,
                typeOffre:          fields.TypeOffre__c?.value           ?? fields.TypeOffre__c,
                description:        fields.Description__c?.value         ?? fields.Description__c,
                competences:        fields.CompetencesRequises__c?.value ?? fields.CompetencesRequises__c,
                visibleAuxCandidat: fields.Visible_aux_candidat__c?.value ?? fields.Visible_aux_candidat__c
            });

            this.handleEditSuccessManual(fields, newStatus);

        } catch(e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    };

    handleEditSuccessManual(fields, newStatus) {
        const f       = fields;
        const newStat = newStatus ?? (this.savingAsDraft ? 'Brouillon' : '');

        this.rows = this.rows.map(r => {
            if (r.Id !== this.editRecordId) return r;

            const visField = f.Visible_aux_candidat__c?.value
                          ?? f.Visible_aux_candidat__c
                          ?? r.Visible_aux_candidat__c;
            const isHidden =
                typeof visField === 'boolean'
                    ? visField === false
                    : (String(visField || '').toLowerCase() !== 'oui' &&
                       String(visField || '').toLowerCase() !== 'yes' &&
                       String(visField || '').toLowerCase() !== 'true');

            const closed = (newStat === 'Clôturée') || isHidden;
            const draft  = (newStat === 'Brouillon');

            return {
                ...r,
                Titre__c:                f.Titre__c?.value        ?? f.Titre__c        ?? r.Titre__c,
                Departement__c:          f.Departement__c?.value  ?? f.Departement__c  ?? r.Departement__c,
                Localisation__c:         f.Localisation__c?.value ?? f.Localisation__c ?? r.Localisation__c,
                Statut__c:               newStat || r.Statut__c,
                Visible_aux_candidat__c: visField,
                __closed:   closed,
                __draft:    draft,
                rowClass:   closed ? 'is-closed' : (draft ? 'is-draft' : ''),
                closeLabel: closed ? 'Clôturée'  : 'Clôturer'
            };
        });

        const msg = this.savingAsDraft
            ? 'Offre enregistrée comme brouillon.'
            : 'Offre mise à jour.';
        this.savingAsDraft   = false;
        this.isEditModalOpen = false;
        this.toast('Succès', msg, 'success');
    }

    handleEditError = (evt) => {
        this.toast('Erreur', evt?.detail?.message || 'Erreur', 'error');
    };

    // ── Clôturer ─────────────────────────────────────────────────
    async handleClose(event) {
        const recordId = event.currentTarget?.dataset?.id
                      || event.target?.dataset?.id;
        if (!recordId) {
            this.toast('Erreur', 'Id introuvable.', 'error');
            return;
        }
        try {
            await clotureOffre({ offreId: recordId });
            this.rows = this.rows.map(r =>
                r.Id === recordId ? {
                    ...r,
                    Statut__c:               'Clôturée',
                    Visible_aux_candidat__c:
                        typeof r.Visible_aux_candidat__c === 'boolean'
                            ? false : INVISIBLE_PREFERRED,
                    __closed:   true,
                    __draft:    false,
                    rowClass:   'is-closed',
                    closeLabel: 'Clôturée'
                } : r
            );
            this.toast('Succès', 'Offre clôturée.', 'success');
        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    // ── Candidatures ─────────────────────────────────────────────
    async openCandidatures(event) {
        if (this.isGuest) {
            this.toast('Accès refusé', 'Connectez-vous.', 'warning');
            return;
        }
        const offreId = event.currentTarget?.dataset?.id
                     || event.target?.dataset?.id;
        const title   = event.currentTarget?.dataset?.title
                     || event.target?.dataset?.title;
        if (!offreId) {
            this.toast('Erreur', 'Id introuvable.', 'error');
            return;
        }

        this.modalOfferId    = offreId;
        this.modalOfferTitle = title || '';

        try {
            const data = await getCandidatures({ offreId });

            this.candidatures = (data || []).map(c => {
                // ✅ Correction : 'Soumise' avec e
                const statut   = String(c?.Statut__c || '').trim();
                const isSoumis = statut.toLowerCase() === 'soumise';
                const cvUrl    = c?.CV_Public_URL__c || null;

                return {
                    ...c,
                    candidateName:  c?.Candidat__r?.Name || '',
                    createdDateFmt: c?.DateDepot__c
                        ? new Date(c.DateDepot__c).toLocaleString('fr-FR') : '',
                    cvUrl:       cvUrl,
                    cvLabel:     cvUrl ? 'Voir le CV' : '—',
                    hasCv:       !!cvUrl,
                    isSoumis:    isSoumis,
                    statutClass: this.getStatutClass(statut),
                    isUpdating:  false
                };
            });

            this.isModalOpen = true;

        } catch (e) {
            console.error('ERREUR getCandidatures:', JSON.stringify(e));
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    closeModal = () => {
        this.isModalOpen  = false;
        this.candidatures = [];
    };

    // ── Actions Accepter / Refuser ───────────────────────────────
    // ── Clic sur Accepter/Refuser → ouvre confirmation ───────────
    handleCandidatureAction = (event) => {
        const candidatureId = event.currentTarget.dataset.id;
        const action        = event.currentTarget.dataset.action;

        if (!candidatureId || !action) return;

        // Sauvegarder en attente
        this.pendingCandidatureId = candidatureId;
        this.pendingAction        = action;

        // Configurer le popup selon l'action
        if (action === 'Accepté') {
            this.confirmTitle   = '✅ Accepter la candidature';
            this.confirmMessage = 'Êtes-vous sûr de vouloir accepter cette candidature ?';
            this.confirmVariant = 'success';
        } else {
            this.confirmTitle   = '❌ Refuser la candidature';
            this.confirmMessage = 'Êtes-vous sûr de vouloir refuser cette candidature ?';
            this.confirmVariant = 'destructive';
        }

        this.isConfirmModalOpen = true;
    };

    // ── Fermer confirmation ──────────────────────────────────────
    closeConfirmModal = () => {
        this.isConfirmModalOpen  = false;
        this.pendingCandidatureId = null;
        this.pendingAction        = null;
    };

    // ── Confirmer l'action ───────────────────────────────────────
    confirmAction = async () => {
        const candidatureId = this.pendingCandidatureId;
        const action        = this.pendingAction;

        // Fermer la modale confirmation
        this.isConfirmModalOpen = false;

        if (!candidatureId || !action) return;

        // Désactiver boutons pendant update
        this.candidatures = this.candidatures.map(c =>
            c.Id === candidatureId
                ? { ...c, isUpdating: true }
                : c
        );

        try {
            await updateStatutCandidature({
                candidatureId : candidatureId,
                statut        : action
            });

            // ✅ Mettre à jour localement
            this.candidatures = this.candidatures.map(c => {
                if (c.Id !== candidatureId) return c;
                return {
                    ...c,
                    Statut__c:   action,
                    isSoumis:    false,
                    statutClass: this.getStatutClass(action),
                    isUpdating:  false
                };
            });

            const msg = action === 'Accepté'
                ? '✅ Candidature acceptée avec succès.'
                : '❌ Candidature refusée.';
            this.toast('Succès', msg, 'success');

        } catch (e) {
            console.error('ERREUR updateStatut:', JSON.stringify(e));
            this.candidatures = this.candidatures.map(c =>
                c.Id === candidatureId
                    ? { ...c, isUpdating: false }
                    : c
            );
            this.toast('Erreur', this.err(e), 'error');
        } finally {
            this.pendingCandidatureId = null;
            this.pendingAction        = null;
        }
    };

    // ── Badge couleur statut ─────────────────────────────────────
    getStatutClass(statut) {
        const s = String(statut || '').trim().toLowerCase();
        if (s === 'soumise') return 'statut-badge statut-soumis';
        if (s === 'accepté') return 'statut-badge statut-accepte';
        if (s === 'refusé')  return 'statut-badge statut-refuse';
        return 'statut-badge statut-soumis';
    }

    // ── Utilitaires ──────────────────────────────────────────────
    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    err(e) {
        const b = e?.body || e?.detail || {};
        if (b.message)                return b.message;
        if (b.pageErrors?.length)     return b.pageErrors[0].message;
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