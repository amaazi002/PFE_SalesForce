import { LightningElement, track }   from 'lwc';
import { ShowToastEvent }            from 'lightning/platformShowToastEvent';
import { NavigationMixin }           from 'lightning/navigation';
import getOffresWithStats            from '@salesforce/apex/SMRecTabOffreController.getOffresWithStats';
import getCandidatures               from '@salesforce/apex/SMRecTabOffreController.getCandidatures';
import updateCandidaturesGrouped     from '@salesforce/apex/SMRecTabOffreController.updateCandidaturesGrouped';
import updateOffre                   from '@salesforce/apex/SMRecTabOffreController.updateOffre';

export default class SmRecTabOffre extends NavigationMixin(LightningElement) {

    @track rows           = [];
    @track candidatures   = [];
    @track searchTerm     = '';
    @track activeFilter   = '';
    @track actionUpdates  = {};

    isModalOpen       = false;
    isActionModalOpen = false;
    isEditModalOpen   = false;
    modalOfferId      = '';
    modalOfferTitle   = '';
    editRecordId      = '';
    editOfferTitle    = '';

    // ══════════════════════════════════════════════
    // LIFECYCLE
    // ══════════════════════════════════════════════
    connectedCallback() {
        this.loadOffres();
    }

    // ══════════════════════════════════════════════
    // CHARGER OFFRES
    // ══════════════════════════════════════════════
    async loadOffres() {
        try {
            const data = await getOffresWithStats();
            this.rows = (data || []).map(s => ({
                ...s,
                deadlineFmt: s.offre?.Deadline__c
                    ? new Date(s.offre.Deadline__c)
                        .toLocaleDateString('fr-FR')
                    : '—',
                statutClass: this.getStatutOffreClass(s.offre?.Statut__c)
            }));
        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    // ══════════════════════════════════════════════
    // GETTERS
    // ══════════════════════════════════════════════
    get hasRows() {
        return this.rows && this.rows.length > 0;
    }

    get hasCandidatures() {
        return this.filteredCandidatures &&
               this.filteredCandidatures.length > 0;
    }

    get filteredCandidatures() {
        let list = [...this.candidatures];

        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            list = list.filter(c =>
                (c.candidateName || '').toLowerCase().includes(term)
            );
        }

        if (this.activeFilter === 'entretien') {
            list = list.filter(c =>
                c.Statut__c === 'En entretien' || c.DateEntretien__c
            );
        } else if (this.activeFilter === 'sansEntretien') {
            list = list.filter(c =>
                c.Statut__c === 'Sans entretien' ||
                (c.Statut__c === 'Soumise' && !c.DateEntretien__c)
            );
        } else if (this.activeFilter === 'nouveaux') {
            list = list.filter(c => c.isNew);
        }

        return list;
    }

    get selectedCandidatures() {
        return this.candidatures.filter(c => c.isSelected);
    }

    get hasSelected() {
        return this.selectedCandidatures.length > 0;
    }

    get selectedCount() {
        return this.selectedCandidatures.length;
    }

    get allSelected() {
        return this.filteredCandidatures.length > 0 &&
               this.filteredCandidatures.every(c => c.isSelected);
    }

    get btnEntretienClass() {
        return this.activeFilter === 'entretien'
            ? 'filter-btn filter-btn-active' : 'filter-btn';
    }

    get btnSansEntretienClass() {
        return this.activeFilter === 'sansEntretien'
            ? 'filter-btn filter-btn-active' : 'filter-btn';
    }

    get btnNouveauxClass() {
        return this.activeFilter === 'nouveaux'
            ? 'filter-btn filter-btn-active' : 'filter-btn';
    }

    // ══════════════════════════════════════════════
    // TOTAL CLICK
    // ══════════════════════════════════════════════
    handleTotalClick(event) {
        const offreId = event.currentTarget.dataset.id;
        const titre   = event.currentTarget.dataset.titre;
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: `/smartrec/recruteur/allapps?offreId=${offreId}&titre=${encodeURIComponent(titre)}`
            }
        });
    }

    // ══════════════════════════════════════════════
    // MODALE CANDIDATURES
    // ══════════════════════════════════════════════
    async handleRowClick(event) {
        const offreId = event.currentTarget.dataset.id;
        const titre   = event.currentTarget.dataset.titre;
        await this.openCandidatures(offreId, titre);
    }

    async openCandidatures(offreId, titre) {
        this.modalOfferId    = offreId;
        this.modalOfferTitle = titre;
        this.searchTerm      = '';
        this.activeFilter    = '';

        try {
            const data = await getCandidatures({ offreId });
            this.candidatures = (data || []).map(c => this.mapCandidature(c));
            this.isModalOpen  = true;
        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    closeModal() {
        this.isModalOpen  = false;
        this.candidatures = [];
        this.searchTerm   = '';
        this.activeFilter = '';
    }

    // ══════════════════════════════════════════════
    // SEARCH & FILTRES
    // ══════════════════════════════════════════════
    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    handleFilterEntretien() {
        this.activeFilter =
            this.activeFilter === 'entretien' ? '' : 'entretien';
    }

    handleFilterSansEntretien() {
        this.activeFilter =
            this.activeFilter === 'sansEntretien' ? '' : 'sansEntretien';
    }

    handleFilterNouveaux() {
        this.activeFilter =
            this.activeFilter === 'nouveaux' ? '' : 'nouveaux';
    }

    // ══════════════════════════════════════════════
    // SELECTION
    // ══════════════════════════════════════════════
    handleSelectAll(event) {
        const checked = event.target.checked;
        this.candidatures = this.candidatures.map(c => ({
            ...c, isSelected: checked
        }));
    }

    handleSelectOne(event) {
        const id      = event.target.dataset.id;
        const checked = event.target.checked;
        this.candidatures = this.candidatures.map(c =>
            c.Id === id ? { ...c, isSelected: checked } : c
        );
    }

    // ══════════════════════════════════════════════
    // NAVIGATION PROFIL
    // ══════════════════════════════════════════════
    handleCandidatClick(event) {
        const candidatureId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: `/smartrec/recruteur/profile-candidat?id=${candidatureId}`
            }
        });
    }

    // ══════════════════════════════════════════════
    // ACTION GROUPÉE
    // ══════════════════════════════════════════════
    handleOpenActionModal() {
        if (!this.hasSelected) {
            this.toast('Info', 'Sélectionnez au moins un candidat.', 'info');
            return;
        }
        this.actionUpdates     = {};
        this.isActionModalOpen = true;
    }

    closeActionModal() {
        this.isActionModalOpen = false;
        this.actionUpdates     = {};
    }

    handleNewStatutChange(event) {
        const id    = event.target.dataset.id;
        const value = event.target.value;
        if (!this.actionUpdates[id]) this.actionUpdates[id] = {};
        this.actionUpdates[id].newStatut = value;
    }

    handleDecisionChange(event) {
        const id    = event.target.dataset.id;
        const value = event.target.value;
        if (!this.actionUpdates[id]) this.actionUpdates[id] = {};
        this.actionUpdates[id].decision = value;
    }

    async handleSaveActions() {
        const updates = this.selectedCandidatures
            .map(c => ({
                candidatureId : c.Id,
                newStatut     : this.actionUpdates[c.Id]?.newStatut || '',
                decision      : this.actionUpdates[c.Id]?.decision  || ''
            }))
            .filter(u => u.newStatut || u.decision);

        if (!updates.length) {
            this.toast('Info', 'Aucune modification à enregistrer.', 'info');
            return;
        }

        try {
            await updateCandidaturesGrouped({
                updatesJson: JSON.stringify(updates)
            });

            this.candidatures = this.candidatures.map(c => {
                const upd = this.actionUpdates[c.Id];
                if (!upd) return { ...c, isSelected: false };
                const newStatut   = upd.newStatut || c.Statut__c;
                const newDecision = upd.decision  || c.Decision__c;
                return {
                    ...c,
                    Statut__c:   newStatut,
                    Decision__c: newDecision,
                    statutClass: this.getStatutClass(newStatut),
                    isSelected:  false
                };
            });

            this.closeActionModal();
            this.toast('Succès', 'Candidatures mises à jour.', 'success');
            this.loadOffres();

        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    // ══════════════════════════════════════════════
    // EDITION OFFRE
    // ══════════════════════════════════════════════
    handleEdit(event) {
        const id  = event.currentTarget.dataset.id;
        const row = this.rows.find(r => r.offreId === id);
        this.editRecordId    = id;
        this.editOfferTitle  = row?.offre?.Titre__c || '';
        this.isEditModalOpen = true;
    }

    closeEditModal() {
        this.isEditModalOpen = false;
    }

    handleEditSubmit(event) {
        event.preventDefault();
        const fields = event.detail.fields;
        updateOffre({
            offreId:            this.editRecordId,
            titre:              fields.Titre__c,
            departement:        fields.Departement__c,
            localisation:       fields.Localisation__c,
            deadline:           fields.Deadline__c,
            statut:             fields.Statut__c,
            typeOffre:          fields.TypeOffre__c,
            description:        fields.Description__c,
            competences:        fields.CompetencesRequises__c,
            visibleAuxCandidat: fields.Visible_aux_candidat__c
        }).then(() => {
            this.handleEditSuccess();
        }).catch(e => {
            this.toast('Erreur', this.err(e), 'error');
        });
    }

    handleEditSuccess() {
        this.isEditModalOpen = false;
        this.toast('Succès', 'Offre mise à jour.', 'success');
        this.loadOffres();
    }

    handleEditError(event) {
        this.toast('Erreur', event.detail.message, 'error');
    }

    // ══════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════
    mapCandidature(c) {
        const score     = c.Score_Matching__c || 0;
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const depotDate = c.DateDepot__c
            ? new Date(c.DateDepot__c) : null;
        const isNew = c.Statut__c === 'Soumise' &&
                      depotDate && depotDate >= oneDayAgo;

        return {
            ...c,
            candidateName : c.Candidat__r?.Name || '—',
            hasCv         : !!c.CV_Public_URL__c,
            isSelected    : false,
            isNew         : isNew,
            statutClass   : this.getStatutClass(c.Statut__c),
            scoreBarClass : this.getScoreBarClass(score),
            scoreBarStyle : `width: ${score}%`
        };
    }

    getStatutClass(statut) {
        const s = String(statut || '').toLowerCase();
        if (s === 'soumise')        return 'badge-statut badge-soumise';
        if (s === 'en entretien')   return 'badge-statut badge-entretien';
        if (s === 'sans entretien') return 'badge-statut badge-sans-entretien';
        return 'badge-statut';
    }

    getStatutOffreClass(statut) {
        const s = String(statut || '').toLowerCase();
        if (s === 'active')    return 'offre-statut offre-active';
        if (s === 'clôturée')  return 'offre-statut offre-cloturee';
        if (s === 'brouillon') return 'offre-statut offre-brouillon';
        return 'offre-statut';
    }

    getScoreBarClass(score) {
        if (score >= 70) return 'score-bar score-high';
        if (score >= 40) return 'score-bar score-medium';
        return 'score-bar score-low';
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    err(e) {
        const b = e?.body || e?.detail || {};
        if (b.message)                return b.message;
        if (b.pageErrors?.length)     return b.pageErrors[0].message;
        if (b.output?.errors?.length) return b.output.errors[0].message;
        return e?.message || 'Une erreur est survenue';
    }
}