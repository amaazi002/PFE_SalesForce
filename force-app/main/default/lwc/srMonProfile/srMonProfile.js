// force-app/main/default/lwc/srMonProfile/srMonProfile.js
import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getUserProfile    from '@salesforce/apex/SR_UserProfileController.getUserProfile';
import updateUserProfile from '@salesforce/apex/SR_UserProfileController.updateUserProfile';
import getMyCandidatures from '@salesforce/apex/SR_UserProfileController.getMyCandidatures';

export default class SrMonProfile extends LightningElement {

    // ── Infos personnelles ──────────────────────────────────────────────────
    @track firstName  = '';
    @track lastName   = '';
    @track email      = '';
    @track phone      = '';
    loading           = true;
    saving            = false;
    saveSuccess       = false;
    saveError         = '';

    // ── Candidatures ────────────────────────────────────────────────────────
    @track candidatures       = [];
    loadingCandidatures       = true;

    connectedCallback() {
        this.loadProfile();
        this.loadCandidatures();
    }

    // ── Chargement profil ───────────────────────────────────────────────────
    async loadProfile() {
        this.loading = true;
        try {
            const p = await getUserProfile();
            this.firstName = p.firstName || '';
            this.lastName  = p.lastName  || '';
            this.email     = p.email     || '';
            this.phone     = p.phone     || '';
        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        } finally {
            this.loading = false;
        }
    }

    // ── Chargement candidatures ─────────────────────────────────────────────
    async loadCandidatures() {
        this.loadingCandidatures = true;
        try {
            const rows = await getMyCandidatures();
            this.candidatures = (rows || []).map(c => ({
                ...c,
                formattedDate : c.CreatedDate ? new Date(c.CreatedDate).toLocaleDateString('fr-FR') : '',
                statutClass   : this.getStatutClass(c.Statut__c)
            }));
        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        } finally {
            this.loadingCandidatures = false;
        }
    }

    // ── Changement champ ────────────────────────────────────────────────────
    onChange(evt) {
        const field = evt.target.dataset.field;
        this[field] = evt.target.value;
        this.saveSuccess = false;
        this.saveError   = '';
    }

    // ── Enregistrement ──────────────────────────────────────────────────────
    async handleSave() {
        this.saving      = true;
        this.saveSuccess = false;
        this.saveError   = '';
        try {
            await updateUserProfile({
                firstName : this.firstName,
                lastName  : this.lastName,
                email     : this.email,
                phone     : this.phone
            });
            this.saveSuccess = true;
            this.toast('Succès', 'Profil mis à jour avec succès !', 'success');
        } catch (e) {
            this.saveError = this.err(e);
        } finally {
            this.saving = false;
        }
    }

    // ── Getters ─────────────────────────────────────────────────────────────
    get hasCandidatures() { return this.candidatures.length > 0; }

    getStatutClass(statut) {
        const base = 'statut-badge ';
        if (!statut) return base + 'statut--default';
        const s = statut.toLowerCase();
        if (s.includes('accept') || s.includes('valid')) return base + 'statut--success';
        if (s.includes('refus') || s.includes('rejet'))  return base + 'statut--error';
        if (s.includes('soumis') || s.includes('cours')) return base + 'statut--info';
        return base + 'statut--default';
    }

    // ── Utilitaires ─────────────────────────────────────────────────────────
    toast(title, message, variant) { this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }
    err(e) { const b = e?.body || {}; return b?.message || e?.message || 'Une erreur est survenue'; }
}
