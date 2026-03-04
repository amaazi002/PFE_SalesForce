import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class SMRecBotAjoOffre extends LightningElement {
    isOpen = false;

    today;        
    deadline;     

    connectedCallback() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        this.today = `${yyyy}-${mm}-${dd}`;
    }

    openModal = () => { this.isOpen = true; };
    closeModal = () => { this.isOpen = false; };

    handleDate(event) {
        this.deadline = event.target.value;
    }
    handleSubmit(event) {
        event.preventDefault();
        const fields = event.detail.fields;
        if (this.deadline && this.deadline < this.today) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Date invalide',
                message: 'La deadline doit être aujourd’hui ou plus tard.',
                variant: 'error'
            }));
            return;
        }
        if (this.deadline) {
            fields.Deadline__c = this.deadline; 
        }
        this.template.querySelector('lightning-record-edit-form').submit(fields);
    }

    handleSuccess(event) {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Succès',
            message: 'Offre créée',
            variant: 'success'
        }));
        this.isOpen = false;
        this.dispatchEvent(new CustomEvent('offercreated', {
            detail: { recordId: event.detail.id }
        }));
    }

    handleError(event) {
        const msg = event?.detail?.message || 'Erreur lors de la création';
        this.dispatchEvent(new ShowToastEvent({
            title: 'Erreur',
            message: msg,
            variant: 'error'
        }));
    }
}