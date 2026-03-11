public with sharing class SR_SelfRegistrationController {

    public class SelfRegInput {
        @AuraEnabled public String firstName;
        @AuraEnabled public String lastName;
        @AuraEnabled public String email;
        @AuraEnabled public String password;
        @AuraEnabled public String confirmPassword;
        @AuraEnabled public Id accountId;  // optionnel: forcer un compte
        @AuraEnabled public Id profileId;  // optionnel: forcer un profil
    }

    @AuraEnabled
    public static String selfRegister(SelfRegInput input) {
        if (input == null) throw new AuraHandledException('Données manquantes.');
        if (String.isBlank(input.firstName) || String.isBlank(input.lastName) || String.isBlank(input.email))
            throw new AuraHandledException('Nom, prénom et email sont obligatoires.');
        if (String.isBlank(input.password) || String.isBlank(input.confirmPassword) || input.password != input.confirmPassword)
            throw new AuraHandledException('Mot de passe et confirmation doivent être identiques.');

        User u = new User();
        u.Username          = input.email;  // doit être unique
        u.Email             = input.email;
        u.FirstName         = input.firstName;
        u.LastName          = input.lastName;
        u.TimeZoneSidKey    = 'Europe/Paris';
        u.LocaleSidKey      = 'fr_FR';
        u.EmailEncodingKey  = 'UTF-8';
        u.LanguageLocaleKey = 'fr';

        String aliasBase = (input.firstName.substring(0,1) + input.lastName).replaceAll('[^A-Za-z0-9]', '');
        u.Alias = aliasBase.length() > 8 ? aliasBase.substring(0,8) : aliasBase;

        String nick = (input.firstName + '.' + input.lastName + '.' + Datetime.now().getTime()).replace(' ', '').toLowerCase();
        u.CommunityNickname = nick.length() > 40 ? nick.substring(0,40) : nick;

        if (input.profileId != null) u.ProfileId = input.profileId;

        try {
            Id newUserId;
            if (input.accountId != null) {
                newUserId = Site.createExternalUser(u, input.accountId, input.password);
            } else {
                newUserId = Site.createExternalUser(u, null, input.password); // utilise la config Login & Registration du site
            }
            if (newUserId == null) throw new AuraHandledException('La création de l’utilisateur a échoué (retour null).');
            return 'OK';
        }
        catch (Site.ExternalUserCreateException ex) {
            throw new AuraHandledException('Inscription impossible : ' + ex.getMessage());
        }
        catch (Exception e) {
            throw new AuraHandledException('Erreur inattendue : ' + e.getMessage());
        }
    }
}