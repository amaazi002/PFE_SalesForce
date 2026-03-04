public with sharing class SR_SelfRegistrationController {

    public class SelfRegInput {
        @AuraEnabled public String firstName;
        @AuraEnabled public String lastName;
        @AuraEnabled public String email;
        @AuraEnabled public String password;
        @AuraEnabled public String confirmPassword;

        // Optionnels : si tu veux forcer un compte/profil au lieu d’utiliser la config Login & Registration du site
        @AuraEnabled public Id accountId;  // si null -> le site utilisera le compte configuré en L&R
        @AuraEnabled public Id profileId;  // si null -> le site utilisera le profil configuré en L&R
    }

    /**
     * Crée un utilisateur Experience Cloud via Site.createExternalUser.
     * A appeler depuis le contexte d'un site actif (URL du site).
     */
    @AuraEnabled
    public static String selfRegister(SelfRegInput input) {
        if (input == null) {
            throw new AuraHandledException('Données manquantes.');
        }
        if (String.isBlank(input.firstName) || String.isBlank(input.lastName) || String.isBlank(input.email)) {
            throw new AuraHandledException('Nom, prénom et email sont obligatoires.');
        }
        if (String.isBlank(input.password) || String.isBlank(input.confirmPassword) || input.password != input.confirmPassword) {
            throw new AuraHandledException('Mot de passe et confirmation doivent être identiques.');
        }

        // Prépare l'utilisateur
        User u = new User();
        u.Username          = input.email;  // doit être unique
        u.Email             = input.email;
        u.FirstName         = input.firstName;
        u.LastName          = input.lastName;
        u.TimeZoneSidKey    = 'Europe/Paris';
        u.LocaleSidKey      = 'fr_FR';
        u.EmailEncodingKey  = 'UTF-8';
        u.LanguageLocaleKey = 'fr';

        // Alias <= 8 caractères
        String aliasBase = (input.firstName.substring(0,1) + input.lastName).replaceAll('[^A-Za-z0-9]', '');
        u.Alias = aliasBase.length() > 8 ? aliasBase.substring(0,8) : aliasBase;

        // CommunityNickname requis (unique)
        String nick = (input.firstName + '.' + input.lastName + '.' + Datetime.now().getTime())
                      .replace(' ', '').toLowerCase();
        u.CommunityNickname = nick.length() > 40 ? nick.substring(0,40) : nick;

        // (Option) forcer un profil spécifique
        if (input.profileId != null) {
            u.ProfileId = input.profileId;
        }

        try {
            // createExternalUser renvoie un Id (pas un User) -> stocke le retour dans une variable de type Id
            Id newUserId;

            if (input.accountId != null) {
                // forcer le compte si fourni
                newUserId = Site.createExternalUser(u, input.accountId, input.password);
            } else {
                // laisser le site utiliser le compte/profil configurés dans Login & Registration
                newUserId = Site.createExternalUser(u, null, input.password);
            }

            if (newUserId == null) {
                throw new AuraHandledException('La création de l’utilisateur a échoué (retour null).');
            }
            return 'OK';
        }
        catch (Site.ExternalUserCreateException ex) {
            // Causes fréquentes : username déjà utilisé, profil/licence incompatibles, appel hors contexte site actif, etc.
            throw new AuraHandledException('Inscription impossible : ' + ex.getMessage());
        }
        catch (Exception e) {
            throw new AuraHandledException('Erreur inattendue : ' + e.getMessage());
        }
    }
}