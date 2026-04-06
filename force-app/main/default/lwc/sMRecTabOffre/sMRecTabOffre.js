import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { getRecord } from 'lightning/uiRecordApi';
import { getPicklistValuesByRecordType, getObjectInfo } from 'lightning/uiObjectInfoApi';
import OFFRE_OBJECT from '@salesforce/schema/Offre__c';
import userId from '@salesforce/user/Id';

import getOffres       from '@salesforce/apex/SMRecTabOffreController.getOffres';
import getCandidatures from '@salesforce/apex/SMRecTabOffreController.getCandidatures';
import clotureOffre    from '@salesforce/apex/SMRecTabOffreController.clotureOffre';

const INVISIBLE_PREFERRED = 'Non';

export default class SMRecTabOffre extends NavigationMixin(LightningElement) {

    @track rows         = [];
    @track candidatures = [];

    get isGuest() { return !userId; }

    isModalOpen      = false;
    modalOfferId;
    modalOfferTitle;
    isEditModalOpen  = false;
    editRecordId;
    editOfferTitle;
    isEditClosed     = false;
    savingAsDraft    = false;
    currentRtId;
    allowedVisibleValues = [];
    defaultRtId;

    connectedCallback() {
        console.log('=== SMRecTabOffre ===');
        console.log('userId:', userId);
        console.log('isGuest:', this.isGuest);
        this.loadOffres();
    }

    @wire(getObjectInfo, { objectApiName: OFFRE_OBJECT })
    wiredObjInfo({ data, error }) {
        if (data)  this.defaultRtId = data.defaultRecordTypeId;
        if (error) console.error('wiredObjInfo:', JSON.stringify(error));
    }

    get hasRows() {
        return Array.isArray(this.rows) && this.rows.length > 0;
    }

    get hasCandidatures() {
        return Array.isArray(this.candidatures) && this.candidatures.length > 0;
    }

    async loadOffres() {
        try {
            console.log('loadOffres START');
            const data = await getOffres();
            console.log('data:', JSON.stringify(data));
            console.log('count:', data?.length);

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

            console.log('rows:', this.rows.length);

        } catch (e) {
            console.error('ERREUR loadOffres:', JSON.stringify(e));
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    // ── Édition ────────────────────────────────────────────────
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

    handleEditSubmit = (event) => {
        event.preventDefault();
        const form      = event.target;
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
        form.submit(fields);
    };

    handleEditSuccess = (event) => {
        const id = event.detail.id;
        const f  = event.detail.fields || {};

        this.rows = this.rows.map(r => {
            if (r.Id !== id) return r;
            const newStat  = f.Statut__c?.value ??
                             (this.savingAsDraft ? 'Brouillon' : r.Statut__c);
            const visField = f.Visible_aux_candidat__c?.value
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
                Titre__c:                f.Titre__c?.value        ?? r.Titre__c,
                Departement__c:          f.Departement__c?.value  ?? r.Departement__c,
                Localisation__c:         f.Localisation__c?.value ?? r.Localisation__c,
                Statut__c:               newStat,
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
    };

    handleEditError = (evt) => {
        this.toast('Erreur', evt?.detail?.message || 'Erreur', 'error');
    };

    // ── Clôturer ───────────────────────────────────────────────
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

    // ── Candidatures ───────────────────────────────────────────
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
            console.log('candidatures:', JSON.stringify(data));

            this.candidatures = (data || []).map(c => {
                // ✅ URL publique depuis CV_Public_URL__c
                const cvUrl = c?.CV_Public_URL__c || null;
                return {
                    ...c,
                    candidateName:     c?.Candidat__r?.Name || '',
                    createdDateFmt:    c?.DateDepot__c
                        ? new Date(c.DateDepot__c).toLocaleString('fr-FR') : '',
                    cvUrl:   cvUrl,
                    cvLabel: cvUrl ? 'Voir le CV' : '—',
                    hasCv:   !!cvUrl
                };
            });

            this.isModalOpen = true;

        } catch (e) {
            console.error('ERREUR getCandidatures:', JSON.stringify(e));
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    closeModal = () => { this.isModalOpen = false; };

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