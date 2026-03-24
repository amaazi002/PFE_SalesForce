import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getUserProfile    from '@salesforce/apex/SR_UserProfileController.getUserProfile';
import updateUserProfile from '@salesforce/apex/SR_UserProfileController.updateUserProfile';
import getMyCandidatures from '@salesforce/apex/SR_UserProfileController.getMyCandidatures';

export default class SrMonProfile extends LightningElement {

    // ── Infos personnelles ──────────────────────────────────────────
    @track firstName   = '';
    @track lastName    = '';
    @track email       = '';
    @track phone       = '';
    @track loading     = true;
    @track saving      = false;
    @track saveSuccess = false;
    @track saveError   = null;

    // ── Candidatures ────────────────────────────────────────────────
    @track candidatures        = [];
    @track loadingCandidatures = true;

    // ── Getters ─────────────────────────────────────────────────────
    get hasCandidatures() {
        return this.candidatures && this.candidatures.length > 0;
    }

    // ── Chargement du profil ─────────────────────────────────────────
    connectedCallback() {
        this.loadProfile();
        this.loadCandidatures();
    }

    loadProfile() {
        this.loading = true;
        getUserProfile()
            .then(data => {
                this.firstName = data.firstName || '';
                this.lastName  = data.lastName  || '';
                this.email     = data.email     || '';
                this.phone     = data.phone     || '';
                this.loading   = false;
            })
            .catch(error => {
                this.loading = false;
                console.error('Erreur profil:', error);
            });
    }

    // ── Chargement des candidatures ──────────────────────────────────
    loadCandidatures() {
        this.loadingCandidatures = true;
        getMyCandidatures()
            .then(data => {
                // ✅ Mapping des champs pour le HTML
                this.candidatures = data.map(c => ({
                    Id           : c.Id,
                    titrOffre    : c.Offre__r ? c.Offre__r.Titre__c       : '—',
                    departement  : c.Offre__r ? c.Offre__r.Departement__c : '—',
                    localisation : c.Offre__r ? c.Offre__r.Localisation__c: '—',
                    Statut__c    : c.Statut__c || '—',
                    statutClass  : this.getStatutClass(c.Statut__c),
                    // ✅ DateDepot__c affiché en priorité, sinon CreatedDate
                    formattedDate: this.formatDate(c.DateDepot__c || c.CreatedDate)
                }));
                this.loadingCandidatures = false;
            })
            .catch(error => {
                this.loadingCandidatures = false;
                console.error('Erreur candidatures:', error);
            });
    }

    // ── Helpers ──────────────────────────────────────────────────────
    formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', {
            day  : '2-digit',
            month: '2-digit',
            year : 'numeric'
        });
    }

    getStatutClass(statut) {
        const map = {
            'Soumise'  : 'badge badge--blue',
            'En cours' : 'badge badge--orange',
            'Acceptée' : 'badge badge--green',
            'Refusée'  : 'badge badge--red'
        };
        return map[statut] || 'badge';
    }

    // ── Changement de champ ──────────────────────────────────────────
    onChange(event) {
        const field = event.target.dataset.field;
        this[field] = event.target.value;
    }

    // ── Sauvegarde du profil ─────────────────────────────────────────
    handleSave() {
        this.saving      = true;
        this.saveSuccess = false;
        this.saveError   = null;

        updateUserProfile({
            firstName : this.firstName,
            lastName  : this.lastName,
            email     : this.email,
            phone     : this.phone
        })
        .then(() => {
            this.saving      = false;
            this.saveSuccess = true;
            setTimeout(() => { this.saveSuccess = false; }, 3000);
        })
        .catch(error => {
            this.saving    = false;
            this.saveError = error.body?.message || 'Erreur inconnue';
        });
    }
}