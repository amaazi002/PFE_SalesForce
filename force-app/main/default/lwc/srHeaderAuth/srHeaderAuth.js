import { LightningElement } from 'lwc';
import isGuest from '@salesforce/user/isGuest';

export default class SrHeaderAuth extends LightningElement {
    isGuest = isGuest;

    get basePath() {
        const p = window.location.pathname || '/';
        const i = p.indexOf('/s/');
        return (i >= 0) ? p.substring(0, i + 3) : (p.endsWith('/') ? p : p + '/');
    }

    goLogin = () => window.location.assign(this.basePath + 'login');
    goRegister = () => window.location.assign(this.basePath + 'SelfRegister'); // adapte le chemin si ta page d’inscription a un autre URL
    onMenu = (e) => {
        const v = e.detail.value;
        if (v === 'profile') {
            window.location.assign(this.basePath + 'profile'); // adapte si la page profil a un autre URL
    }   else if (v === 'logout') {
    window.location.assign(this.basePath + 'secur/logout.jsp');
        }
    }
}

