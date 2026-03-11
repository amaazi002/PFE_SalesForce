import { LightningElement, api } from 'lwc'; import isGuest from '@salesforce/user/isGuest';
export default class SrAuthButtons extends LightningElement {
@api showWhenAuthenticated = false;
@api loginPath = 'login';
@api registerPath = 'register';

isGuest = isGuest;

get showButtons() {
return this.isGuest || this.showWhenAuthenticated;
}
get basePath() {
const p = window.location.pathname || '/';
const i = p.indexOf('/s/');
return (i >= 0) ? p.substring(0, i + 3) : (p.endsWith('/') ? p : p + '/');
}
goLogin = () => window.location.assign(this.basePath + this.loginPath);
goRegister = () => window.location.assign(this.basePath + this.registerPath);
}