import { LightningElement } from 'lwc';
import isGuest from '@salesforce/user/isGuest';

export default class SrHeaderAuth extends LightningElement {

    isGuest = isGuest;

    get basePath() {
        const p = window.location.pathname || '/';
        const i = p.indexOf('/s/');
        return (i >= 0) ? p.substring(0, i + 3) : (p.endsWith('/') ? p : p + '/');
    }

    goLogin    = () => window.location.assign(this.basePath + 'login');
    goRegister = () => window.location.assign(this.basePath + 'SelfRegister');

    onMenu = (e) => {
        const v = e.detail.value;
        if      (v === 'profile') window.location.assign(this.basePath + 'profile');
        else if (v === 'logout')  window.location.assign(this.basePath + 'secur/logout.jsp');
    }
}
