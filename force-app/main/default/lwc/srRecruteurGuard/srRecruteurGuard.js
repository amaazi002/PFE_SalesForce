import { LightningElement, track } from 'lwc';
import hasRecruteurAccess from '@salesforce/apex/SR_RecruteurAccessController.hasRecruteurAccess';

export default class SrRecruteurGuard extends LightningElement {

    @track isLoading    = true;
    @track accessDenied = false;

    async connectedCallback() {
        try {
            const access = await hasRecruteurAccess();
            console.log('hasRecruteurAccess:', access);

            if (access) {
                // ✅ Accès autorisé → cacher ce composant
                this.accessDenied = false;
                this.isLoading    = false;

                // ✅ Dispatch event pour dire aux autres composants que l'accès est OK
                this.dispatchEvent(new CustomEvent('accessgranted'));

            } else {
                // ✅ Accès refusé → cacher TOUTE la page
                this.accessDenied = true;
                this.isLoading    = false;

                // ✅ Cacher tous les autres composants de la page
                this.hideOtherComponents();
            }
        } catch(e) {
            console.error('Guard error:', e);
            this.accessDenied = true;
            this.isLoading    = false;
            this.hideOtherComponents();
        }
    }

    // ✅ Cache tous les éléments de la page sauf ce composant
    hideOtherComponents() {
        try {
            // Cherche le parent de la page et cache tout
            const pageContent = document.querySelector('.sfdcPage') 
                             || document.querySelector('.experience-component')
                             || document.body;

            // Cache tous les composants LWC de la page
            const allComponents = document.querySelectorAll(
                'c-sm-rec-bot-ajo-offre, c-sm-rec-tab-offre'
            );
            allComponents.forEach(el => {
                el.style.display = 'none';
            });
        } catch(e) {
            console.error('hideOtherComponents error:', e);
        }
    }

    goHome = () => {
        window.location.href = '/smartrec/';
    }
}