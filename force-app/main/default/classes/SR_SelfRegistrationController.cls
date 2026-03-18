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
        System.debug('OTPs : ' + [SELECT Id, Email__c, Code__c, CreatedDate FROM SR_OTP__c WHERE Id = :otp.Id]);

        try {
            sendOtpEmail(cleanEmail, firstName, code);
            System.debug('OTP email sent successfully to: ' + cleanEmail);
        } catch (Exception ex) {
            System.debug('sendOtpEmail error: ' + ex.getMessage());
            throw new AuraHandledException('Erreur lors de l envoi de l email : ' + ex.getMessage());
        }
    }

    // === ETAPE 2 : Verifier l'OTP et creer le compte ===
    @AuraEnabled
    public static String verifyOtpAndRegister(
            String firstName,
            String lastName,
            String email,
            String password,
            String confirmPassword,
            String otpCode) {

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
        System.debug('OTP record: ' + otp);

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

    // === Compatibilite ascendante (srRegisterForm) ===
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
        return createPortalUser(
            input.firstName, input.lastName,
            input.email,     input.password
        );
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

    private static void sendOtpEmail(
            String toEmail, String firstName, String code) {

        String subject = 'Votre code de verification - Portail Recrutement';

        String styleDiv  = 'font-family:Arial,sans-serif;max-width:480px;'
                         + 'margin:auto;border:1px solid #dddbda;'
                         + 'border-radius:8px;padding:32px;';
        String styleH2   = 'color:#0176d3;';
        String styleCode = 'font-size:2rem;font-weight:700;'
                         + 'letter-spacing:10px;text-align:center;'
                         + 'padding:16px 0;color:#0176d3;';
        String styleNote = 'color:#706e6b;font-size:.85rem;';

        String htmlBody
            = '<div style="' + styleDiv + '">'
            + '<h2 style="' + styleH2 + '">Portail de Recrutement</h2>'
            + '<p>Bonjour <strong>' + firstName + '</strong>,</p>'
            + '<p>Voici votre code de verification'
            + ' pour finaliser la creation de votre compte :</p>'
            + '<div style="' + styleCode + '">' + code + '</div>'
            + '<p>Ce code est valable <strong>'
            + OTP_EXPIRY_MINUTES + ' minutes</strong>.</p>'
            + '<p style="' + styleNote + '">'
            + 'Si vous n\'avez pas demande ce code,'
            + ' ignorez cet e-mail.</p>'
            + '</div>';

        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setToAddresses(new List<String>{ toEmail });
        mail.setSubject(subject);
        mail.setHtmlBody(htmlBody);
        mail.setSaveAsActivity(false);
        Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail });
    }
}
