import { LightningElement } from 'lwc';
import isGuest from '@salesforce/user/isGuest';

export default class SrHeaderAuth extends LightningElement {

    isGuest = isGuest;

    get basePath() {
        const p = window.location.pathname || '/';
        const i = p.indexOf('/smartrec/');
        return (i >= 0) ? p.substring(0, i + '/smartrec/' .length) : '/smartrec/';
    }

    goLogin    = () => window.location.href = this.basePath + 'login';
    goRegister = () => window.location.href = this.basePath + 'SelfRegister';

    onMenu = (e) => {
        const v = e.detail.value;
        if      (v === 'profile') window.location.href = this.basePath + 'profile';
        else if (v === 'logout')  window.location.href = this.basePath + 'secur/logout.jsp';
    }
}
