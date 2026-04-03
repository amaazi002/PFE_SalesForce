import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getUsers from '@salesforce/apex/SMAdminUsersController.getUsers';
import blockUser from '@salesforce/apex/SMAdminUsersController.blockUser';
import banUser from '@salesforce/apex/SMAdminUsersController.banUser';
import deactivateUser from '@salesforce/apex/SMAdminUsersController.deactivateUser';
import deleteUser from '@salesforce/apex/SMAdminUsersController.deleteUser';

export default class SMAdminUsers extends LightningElement {
    @track users = [];
    @track searchTerm = '';

    // Confirmation modal
    isConfirmModalOpen = false;
    confirmTitle = '';
    confirmMessage = '';
    confirmIcon = '';
    confirmVariant = 'brand';
    confirmUserName = '';
    confirmHeaderClass = 'slds-modal__header';
    pendingAction = null;
    pendingUserId = null;

    connectedCallback() {
        this.loadUsers();
    }

    async loadUsers() {
        try {
            const data = await getUsers();
            console.log('Users reçus:', JSON.stringify(data));
            this.users = (data || []).map(u => this.mapUser(u));
        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    mapUser(u) {
        // ✅ u.Name avec N majuscule
        const fullName = u.Name || '—';

        // ✅ Initiales correctes
        const nameParts = fullName.split(' ');
        const initials = nameParts.length >= 2
            ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
            : fullName[0]?.toUpperCase() || '?';

        const statut         = u.Statut__c || 'Actif';
        const statutLabel    = statut;
        const badgeClass     = this.getBadgeClass(statut);
        const rowClass       = this.getRowClass(statut);
        const createdDateFmt = u.CreatedDate
            ? new Date(u.CreatedDate).toLocaleDateString('fr-FR') : '';
        const roleLabel      = u.Role__c || u.Profile?.Name || '—';

        return {
            ...u,
            fullName,       // ✅ N majuscule
            initials,
            statutLabel,
            badgeClass,
            rowClass,
            createdDateFmt,
            roleLabel,
            isMenuOpen: false
        };
    }

    getBadgeClass(statut) {
        const base = 'status-badge ';
        switch ((statut || '').toLowerCase()) {
            case 'actif':   return base + 'badge_success';
            case 'bloqué':  return base + 'badge_warning';
            case 'banni':   return base + 'badge_danger';
            case 'inactif': return base + 'badge_neutral';
            default:        return base + 'badge_neutral';
        }
    }

    getRowClass(statut) {
        switch ((statut || '').toLowerCase()) {
            case 'bloqué':  return 'row_blocked';
            case 'banni':   return 'row_banned';
            case 'inactif': return 'row_inactive';
            default:        return '';
        }
    }

    // ── Recherche ──────────────────────────────────────────────
    get filteredUsers() {
        if (!this.searchTerm) return this.users;
        const term = this.searchTerm.toLowerCase();
        return this.users.filter(u =>
            (u.fullName  || '').toLowerCase().includes(term) ||
            (u.Email     || '').toLowerCase().includes(term) ||
            (u.Role__c   || '').toLowerCase().includes(term)
        );
    }

    get hasUsers() {
        return Array.isArray(this.filteredUsers) && this.filteredUsers.length > 0;
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    // ── Dropdown (3 points) ────────────────────────────────────
    // ✅ Utiliser template click au lieu de document
    toggleDropdown(event) {
        event.stopPropagation();
        const id = event.currentTarget.dataset.id;
        this.users = this.users.map(u => ({
            ...u,
            isMenuOpen: u.Id === id ? !u.isMenuOpen : false
        }));
    }

    // ✅ Fermer si on clique ailleurs dans le composant
    handleOutsideClick(event) {
        const clickedId = event.target.dataset.id;
        this.users = this.users.map(u => ({
            ...u,
            isMenuOpen: false
        }));
    }

    // ── Actions ────────────────────────────────────────────────
    handleAction(event) {
        event.stopPropagation();
        const action = event.currentTarget.dataset.action;
        const userId = event.currentTarget.dataset.id;
        const user   = this.users.find(u => u.Id === userId);

        // Fermer le dropdown
        this.users = this.users.map(u => ({ ...u, isMenuOpen: false }));

        if (action === 'view') {
            this.viewProfile(userId);
            return;
        }

        this.pendingAction   = action;
        this.pendingUserId   = userId;
        this.confirmUserName = user?.fullName || '';
        this.openConfirmModal(action);
    }

    viewProfile(userId) {
        window.open(`/lightning/r/User/${userId}/view`, '_blank');
    }

    openConfirmModal(action) {
        const config = {
            block: {
                title   : 'Bloquer l\'utilisateur',
                message : 'Êtes-vous sûr de vouloir bloquer cet utilisateur ?',
                icon    : 'utility:block_visitor',
                variant : 'destructive',
                headerClass: 'slds-modal__header modal-header_warning'
            },
            ban: {
                title   : 'Bannir l\'utilisateur',
                message : 'Êtes-vous sûr de vouloir bannir définitivement cet utilisateur ?',
                icon    : 'utility:ban',
                variant : 'destructive',
                headerClass: 'slds-modal__header modal-header_danger'
            },
            deactivate: {
                title   : 'Désactiver l\'utilisateur',
                message : 'Êtes-vous sûr de vouloir désactiver cet utilisateur ?',
                icon    : 'utility:pause',
                variant : 'neutral',
                headerClass: 'slds-modal__header modal-header_warning'
            },
            delete: {
                title   : 'Supprimer l\'utilisateur',
                message : '⚠️ Cette action est irréversible ! Confirmer la suppression ?',
                icon    : 'utility:delete',
                variant : 'destructive',
                headerClass: 'slds-modal__header modal-header_danger'
            }
        };

        const cfg = config[action] || {};
        this.confirmTitle       = cfg.title       || 'Confirmation';
        this.confirmMessage     = cfg.message     || 'Confirmer cette action ?';
        this.confirmIcon        = cfg.icon        || 'utility:warning';
        this.confirmVariant     = cfg.variant     || 'brand';
        this.confirmHeaderClass = cfg.headerClass || 'slds-modal__header';
        this.isConfirmModalOpen = true;
    }

    closeConfirmModal() {
        this.isConfirmModalOpen = false;
        this.pendingAction   = null;
        this.pendingUserId   = null;
        this.confirmUserName = '';
    }

    async confirmAction() {
        const action = this.pendingAction;
        const userId = this.pendingUserId;
        this.closeConfirmModal();

        try {
            switch (action) {
                case 'block':
                    await blockUser({ userId });
                    this.updateUserStatus(userId, 'Bloqué');
                    this.toast('Succès', 'Utilisateur bloqué.', 'success');
                    break;
                case 'ban':
                    await banUser({ userId });
                    this.updateUserStatus(userId, 'Banni');
                    this.toast('Succès', 'Utilisateur banni.', 'warning');
                    break;
                case 'deactivate':
                    await deactivateUser({ userId });
                    this.updateUserStatus(userId, 'Inactif');
                    this.toast('Succès', 'Utilisateur désactivé.', 'success');
                    break;
                case 'delete':
                    await deleteUser({ userId });
                    this.users = this.users.filter(u => u.Id !== userId);
                    this.toast('Succès', 'Utilisateur supprimé.', 'success');
                    break;
                default:
                    break;
            }
        } catch (e) {
            this.toast('Erreur', this.err(e), 'error');
        }
    }

    updateUserStatus(userId, newStatut) {
        this.users = this.users.map(u => {
            if (u.Id !== userId) return u;
            return {
                ...u,
                Statut__c   : newStatut,
                statutLabel : newStatut,
                badgeClass  : this.getBadgeClass(newStatut),
                rowClass    : this.getRowClass(newStatut)
            };
        });
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    err(e) {
        const b = e?.body || e?.detail || {};
        if (b.message) return b.message;
        if (b.pageErrors?.length) return b.pageErrors[0].message;
        return e?.message || 'Une erreur est survenue';
    }
}