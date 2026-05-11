import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin }               from 'lightning/navigation';
import { ShowToastEvent }                from 'lightning/platformShowToastEvent';
import { getPicklistValues,
         getObjectInfo }                 from 'lightning/uiObjectInfoApi';
import CANDIDATURE_OBJECT                from '@salesforce/schema/Candidature__c';
import STATUT_FIELD                      from '@salesforce/schema/Candidature__c.Statut__c';
import DECISION_FIELD                    from '@salesforce/schema/Candidature__c.Decision__c';
import getAllCandidatures                 from '@salesforce/apex/SMRecTabOffreController.getAllCandidatures';
import getCandidatures                   from '@salesforce/apex/SMRecTabOffreController.getCandidatures';
import updateCandidaturesGrouped         from '@salesforce/apex/SMRecTabOffreController.updateCandidaturesGrouped';

export default class SmRecAllApps extends NavigationMixin(LightningElement) {

    @track candidatures      = [];
    @track searchTerm        = '';
    @track minScore          = 0;
    @track activeFilter      = 'Tous';
    @track isActionModalOpen = false;
    @track actionUpdates     = {};
    @track sortOrder         = 'desc'; // 'asc' or 'desc'

    @track statutOptions     = [];
    @track decisionOptions   = [];
    recordTypeId             = '';

    offreId    = '';
    offreTitre = '';

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
    }

    // ══════════════════════════════════════════════
    // LIFECYCLE
    // ══════════════════════════════════════════════
    connectedCallback() {
        const url = new URL(window.location.href);
        this.offreId    = url.searchParams.get('offreId') || '';
        this.offreTitre = url.searchParams.get('titre')   || '';
        this.loadCandidatures();
    }

    // ══════════════════════════════════════════════
    // CHARGER CANDIDATURES
    // ══════════════════════════════════════════════
    async loadCandidatures() {
        try {
            let data;

            // Si on vient d'une offre spécifique, charger uniquement ses candidatures
            if (this.offreId) {
                data = await getCandidatures({ offreId: this.offreId });
            } else {
                data = await getAllCandidatures({
                    searchTerm   : this.searchTerm,
                    statutFilter : (this.activeFilter === 'Tous' ||
                                    this.activeFilter === 'entretien' ||
                                    this.activeFilter === 'sansEntretien')
                        ? '' : this.activeFilter
                });
            }

            let list = (data || []).map(c => this.mapCandidature(c));

            // Filtre par recherche côté client si offreId (car getCandidatures n'a pas de searchTerm)
            if (this.offreId && this.searchTerm) {
                const term = this.searchTerm.toLowerCase();
                list = list.filter(c =>
                    c.candidateName.toLowerCase().includes(term)
                );
            }

            // Filtre par statut côté client
            if (this.activeFilter === 'entretien') {
                list = list.filter(c =>
                    String(c.Statut__c || '').toLowerCase().includes('entretien') &&
                    !String(c.Statut__c || '').toLowerCase().includes('sans')
                );
            } else if (this.activeFilter === 'sansEntretien') {
                list = list.filter(c =>
                    String(c.Statut__c || '').toLowerCase().includes('sans')
                );
            } else if (this.activeFilter === 'Soumise' && this.offreId) {
                list = list.filter(c =>
                    String(c.Statut__c || '').toLowerCase() === 'soumise'
                );
            }
            
            // Filtre par score minimum côté client
            if (this.minScore > 0) {
                list = list.filter(c => (c.Score_Matching__c || 0) >= this.minScore);
            }
            
            // Tri par score
            list = this.sortByScore(list);

            this.candidatures = list;

        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    // ══════════════════════════════════════════════
    // TRI PAR SCORE
    // ══════════════════════════════════════════════
    sortByScore(list) {
        return [...list].sort((a, b) => {
            const scoreA = a.Score_Matching__c || 0;
            const scoreB = b.Score_Matching__c || 0;
            return this.sortOrder === 'desc'
                ? scoreB - scoreA
                : scoreA - scoreB;
        });
    }

    handleSortToggle(event) {
        this.sortOrder = event.currentTarget.dataset.order;
        this.candidatures = this.sortByScore(this.candidatures);
    }

    // ══════════════════════════════════════════════
    // GETTERS
    // ══════════════════════════════════════════════
    get hasCandidatures() {
        return this.candidatures && this.candidatures.length > 0;
    }

    get totalCandidatures() {
        return this.candidatures ? this.candidatures.length : 0;
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
        return this.candidatures.length > 0 &&
               this.candidatures.every(c => c.isSelected);
    }

    get hasOffreContext() {
        return !!this.offreId;
    }

    get pageTitle() {
        return this.offreTitre
            ? `Candidatures — ${this.offreTitre}`
            : 'Toutes les candidatures';
    }

    get btnTousClass() {
        return this.activeFilter === 'Tous'
            ? 'filter-btn filter-btn-active' : 'filter-btn';
    }

    get btnSoumiseClass() {
        return this.activeFilter === 'Soumise'
            ? 'filter-btn filter-btn-active' : 'filter-btn';
    }

    get btnEntretienClass() {
        return this.activeFilter === 'entretien'
            ? 'filter-btn filter-btn-active' : 'filter-btn';
    }

    get btnSansEntretienClass() {
        return this.activeFilter === 'sansEntretien'
            ? 'filter-btn filter-btn-active' : 'filter-btn';
    }

    get isSortDesc() {
        return this.sortOrder === 'desc';
    }

    get isSortAsc() {
        return this.sortOrder === 'asc';
    }

    get sortDescClass() {
        return this.sortOrder === 'desc'
            ? 'sort-btn sort-btn-active' : 'sort-btn';
    }

    get sortAscClass() {
        return this.sortOrder === 'asc'
            ? 'sort-btn sort-btn-active' : 'sort-btn';
    }

    // ══════════════════════════════════════════════
    // SEARCH & FILTRES
    // ══════════════════════════════════════════════
    handleSearch(event) {
        this.searchTerm = event.target.value;
        this.loadCandidatures();
    }

    handleMinScoreChange(event) {
        this.minScore = parseInt(event.target.value || 0, 10);
        this.loadCandidatures();
    }

    handleFilterStatut(event) {
        this.activeFilter = event.currentTarget.dataset.filter;
        this.loadCandidatures();
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
    // NAVIGATION
    // ══════════════════════════════════════════════
    handleBack() {
        history.back();
    }

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

    stopPropagation(event) {
        event.stopPropagation();
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
            this.toast('Info', 'Aucune modification.', 'info');
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
                    Statut__c:    newStatut,
                    Decision__c:  newDecision,
                    statutClass:  this.getStatutClass(newStatut),
                    decisionClass: this.getDecisionClass(newDecision),
                    hasDecision:  !!newDecision,
                    isSelected:   false
                };
            });

            this.closeActionModal();
            this.toast('Succès', 'Candidatures mises à jour.', 'success');
            this.loadCandidatures();

        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    // ══════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════
    mapCandidature(c) {
        const score = c.Score_Matching__c || 0;

        const name     = c.Candidat__r?.Name || '';
        const initiales = name.split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

        const decision = c.Decision__c || '';

        return {
            ...c,
            candidateName  : name || '—',
            initiales      : initiales || '?',
            offreTitre     : c.Offre__r?.Titre__c || this.offreTitre || '—',
            hasCv          : !!c.CV_Public_URL__c,
            hasDecision    : !!decision,
            isSelected     : false,
            dateFmt        : c.DateDepot__c
                ? new Date(c.DateDepot__c).toLocaleDateString('fr-FR')
                : '—',
            statutClass    : this.getStatutClass(c.Statut__c),
            decisionClass  : this.getDecisionClass(decision),
            scoreBarClass  : this.getScoreBarClass(score),
            scoreBarStyle  : `width: ${score}%`
        };
    }

    getStatutClass(statut) {
        const s = String(statut || '').toLowerCase();
        if (s === 'soumise')                             return 'badge-statut badge-soumise';
        if (s.includes('entretien') && !s.includes('sans')) return 'badge-statut badge-entretien';
        if (s.includes('sans'))                          return 'badge-statut badge-sans-entretien';
        return 'badge-statut';
    }

    getDecisionClass(decision) {
        const d = String(decision || '').toLowerCase();
        if (d.includes('accept')) return 'badge-decision badge-accepte';
        if (d.includes('refus'))  return 'badge-decision badge-refuse';
        if (d)                    return 'badge-decision badge-en-cours';
        return 'badge-decision';
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
