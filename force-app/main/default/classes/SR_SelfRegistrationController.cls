public without sharing class SR_SelfRegistrationController {

    private static final Integer OTP_EXPIRY_MINUTES = 10;
    private static final Integer OTP_LENGTH         = 6;
    private static final String  PORTAL_ACCOUNT     = 'Candidats Portail';
    private static final Id      COMMUNITY_PROFILE  = '00efj000007pXw3AAE';

    // === ETAPE 1 : Envoyer un OTP ===
    @AuraEnabled
    public static void sendOtp(
            String firstName,
            String lastName,
            String email,
            String password,
            String confirmPassword) {

        if (String.isBlank(firstName) || String.isBlank(lastName) || String.isBlank(email))
            throw new AuraHandledException('Nom, prenom et email sont obligatoires.');
        if (String.isBlank(password) || String.isBlank(confirmPassword))
            throw new AuraHandledException('Le mot de passe est obligatoire.');
        if (password != confirmPassword)
            throw new AuraHandledException('Les mots de passe ne correspondent pas.');
        if (password.length() < 8)
            throw new AuraHandledException('Mot de passe trop court (min 8 caracteres).');

        String cleanEmail = email.trim().toLowerCase();

        List<Contact> existing = [SELECT Id FROM Contact WHERE Email = :cleanEmail LIMIT 1];
        if (!existing.isEmpty())
            throw new AuraHandledException('Un compte existe deja avec cet email.');

        List<SR_OTP__c> oldOtps = [SELECT Id FROM SR_OTP__c WHERE Email__c = :cleanEmail];
        if (!oldOtps.isEmpty()) delete oldOtps;

        String code = generateOtpCode();
        System.debug('OTP generated for ' + cleanEmail + ' : ' + code);

        SR_OTP__c otp = new SR_OTP__c();
        otp.Email__c  = cleanEmail;
        otp.Code__c   = code;
        insert otp;
        System.debug('OTP inserted: ' + otp.Id + ' for ' + cleanEmail);
        // Email envoye automatiquement par SR_OTP_Trigger (after insert)
    }

    // === ETAPE 2 : Verifier OTP et creer compte ===
    @AuraEnabled
    public static String verifyOtpAndRegister(
            String firstName,
            String lastName,
            String email,
            String password,
            String confirmPassword,
            String otpCode) {
        System.debug('=== verifyOtpAndRegister ===');
        System.debug('email:'                          + email);
        System.debug('password:'                       + password);
        System.debug('confirmPassword:'                + confirmPassword);
        System.debug('otpCode:'                        + otpCode);
        System.debug('password == confirmPassword: ' + (password == confirmPassword));
        System.debug('=========================');
        if (String.isBlank(email) || String.isBlank(otpCode))
            throw new AuraHandledException('Email et code OTP sont obligatoires.');
        if (String.isBlank(password) || password != confirmPassword)
            throw new AuraHandledException('Mot de passe invalide ou non confirme.');

        String cleanEmail = email.trim().toLowerCase();
        String cleanCode  = otpCode.trim();
        System.debug('verifyOtpAndRegister - email: ' + cleanEmail + ' | code: ' + cleanCode);

        List<SR_OTP__c> otps = [
            SELECT Id, Code__c, CreatedDate
            FROM   SR_OTP__c
            WHERE  Email__c = :cleanEmail
            ORDER BY CreatedDate DESC
            LIMIT  1
        ];
        System.debug('OTP records found: ' + otps.size());
        if (otps.isEmpty())
            throw new AuraHandledException('Aucun code OTP trouve. Veuillez recommencer.');

        SR_OTP__c otp = otps[0];

        Datetime expiresAt = otp.CreatedDate.addMinutes(OTP_EXPIRY_MINUTES);
        System.debug('expiresAt: ' + expiresAt + ' | now: ' + Datetime.now());
        if (Datetime.now() > expiresAt)
            throw new AuraHandledException('Le code OTP a expire. Demandez-en un nouveau.');

        System.debug('Stored: [' + otp.Code__c + '] | Entered: [' + cleanCode + ']');
        if (otp.Code__c != cleanCode)
            throw new AuraHandledException('Code OTP incorrect.');

        delete otp;
        System.debug('OTP deleted. Creating portal user...');
        return createPortalUser(firstName, lastName, cleanEmail, password);
    }

    // === Compatibilite ascendante ===
    public class SelfRegInput {
        @AuraEnabled public String firstName;
        @AuraEnabled public String lastName;
        @AuraEnabled public String email;
        @AuraEnabled public String password;
        @AuraEnabled public String confirmPassword;
    }

    @AuraEnabled
    public static String selfRegister(SelfRegInput input) {
        if (input == null)
            throw new AuraHandledException('Donnees manquantes.');
        return createPortalUser(input.firstName, input.lastName, input.email, input.password);
    }

    // === Methodes privees ===

    private static String createPortalUser(
            String firstName, String lastName,
            String email,     String password) {

        Account portalAccount;
        List<Account> accounts = [SELECT Id FROM Account WHERE Name = :PORTAL_ACCOUNT LIMIT 1];
        if (accounts.isEmpty()) {
            portalAccount = new Account(Name = PORTAL_ACCOUNT);
            insert portalAccount;
        } else {
            portalAccount = accounts[0];
        }

        List<Contact> existingContacts = [SELECT Id FROM Contact WHERE Email = :email LIMIT 1];
        if (!existingContacts.isEmpty())
            throw new AuraHandledException('Un compte existe deja avec cet email.');

        Contact c   = new Contact();
        c.FirstName = firstName;
        c.LastName  = lastName;
        c.Email     = email;
        c.AccountId = portalAccount.Id;
        insert c;

        User u = new User();
        u.FirstName         = firstName;
        u.LastName          = lastName;
        u.Email             = email;
        u.Username          = email;
        u.ContactId         = c.Id;
        u.ProfileId         = COMMUNITY_PROFILE;
        u.TimeZoneSidKey    = 'Europe/Paris';
        u.LocaleSidKey      = 'fr_FR';
        u.EmailEncodingKey  = 'UTF-8';
        u.LanguageLocaleKey = 'fr';

        String aliasBase = (firstName.substring(0, 1) + lastName).replaceAll('[^A-Za-z0-9]', '');
        u.Alias = aliasBase.length() > 8 ? aliasBase.substring(0, 8) : aliasBase;

        String nick = (firstName + '.' + lastName + '.' + Datetime.now().getTime())
                        .replace(' ', '').toLowerCase();
        u.CommunityNickname = nick.length() > 40 ? nick.substring(0, 40) : nick;

        try {
            Id newUserId = Site.createExternalUser(u, portalAccount.Id, password);
            if (newUserId == null)
                throw new AuraHandledException('La creation du compte a echoue.');
            System.debug('Portal user created: ' + newUserId);
            return 'OK';
        } catch (Site.ExternalUserCreateException ex) {
            delete c;
            throw new AuraHandledException('Inscription impossible : ' + ex.getMessage());
        } catch (Exception ex) {
            delete c;
            throw new AuraHandledException('Erreur inattendue : ' + ex.getMessage());
        }
    }

    private static String generateOtpCode() {
        Integer raw = Math.abs(
            Math.mod((Integer) Math.floor(Math.random() * 1000000), 1000000)
        );
        String code = String.valueOf(raw);
        while (code.length() < OTP_LENGTH) { code = '0' + code; }
        return code;
    }
}
