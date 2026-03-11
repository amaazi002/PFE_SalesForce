import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import isGuest from '@salesforce/user/isGuest';
import getOffers from '@salesforce/apex/SR_OfferController.getPublicOffers';
import getProfile from '@salesforce/apex/SR_OfferController.getCurrentUserProfile';

export default class SrPortalHome extends LightningElement {
    isGuest = isGuest;
    @track offers = [];
    @track selectedOfferId = null;
    userFullName = '';
    loadingOffers = false;

    connectedCallback() {
        this.loadProfile();
        this.loadOffers();
    }

    loadProfile() {
        if (this.isGuest) {
        return;
        }
        getProfile()
        .then((p) => {
            if (p && p.isGuest === false) {
                var first = p.firstName ? p.firstName : '';
                var last = p.lastName ? p.lastName : '';
                this.userFullName = (first + ' ' + last).trim();
            } else if (p && !p.isGuest) {
                var f = p.firstName ? p.firstName : '';
                var l = p.lastName ? p.lastName : '';
                this.userFullName = (f + ' ' + l).trim();
            }
        })
        .catch((e) => {
        // On ignore l'erreur profil pour ne pas bloquer l'affichage
        });
    }

    loadOffers() {
        this.loadingOffers = true;
        getOffers({ limitSize: 100 })
        .then((rows) => {
            this.offers = rows || [];
        })
        .catch((e) => {
            this.toast('Erreur', this.err(e), 'error');
            this.offers = [];
        })
        .then(() => {
            this.loadingOffers = false;
        });
    }

    get hasOffers() {
        return Array.isArray(this.offers) && this.offers.length > 0;
    }

    handleViewDetail(evt) {
        var offerId = null;
        if (evt && evt.detail && evt.detail.offerId) {
            offerId = evt.detail.offerId;
        }
        this.selectedOfferId = offerId;
    }

    closeDetail() {
        this.selectedOfferId = null;
    }

    stop(evt) {
        evt.stopPropagation();
    }

    get basePath() {
        var p = window.location.pathname || '/';
        var i = p.indexOf('/');
        return i >= 0 ? p.substring(0, i + 3) : (p.charAt(p.length - 1) === '/' ? p : p + '/');
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title: title, message: message, variant: variant }));
    }

    err(e) {
        var b = e && e.body ? e.body : {};
        return (b && b.message) || (e && e.message) || 'Une erreur est survenue';
    }
}