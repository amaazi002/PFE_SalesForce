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

        List<Contact> existing = [
            SELECT Id FROM Contact
            WHERE Email = :cleanEmail
            LIMIT 1
        ];
        if (!existing.isEmpty())
            throw new AuraHandledException('Un compte existe deja avec cet email.');

        // ✅ Supprimer les anciens OTP
        List<SR_OTP__c> oldOtps = [
            SELECT Id FROM SR_OTP__c
            WHERE Email__c = :cleanEmail
        ];
        if (!oldOtps.isEmpty()) delete oldOtps;

        // ✅ Générer le code
        String code = generateOtpCode();
        System.debug('OTP generated for ' + cleanEmail + ' : ' + code);

        // ✅ Insérer l'OTP
        SR_OTP__c otp = new SR_OTP__c(
            Email__c = cleanEmail,
            Code__c  = code
        );
        insert otp;

        // ✅ Envoyer l'email DIRECTEMENT ici (plus fiable que le trigger)
        SR_OTP_EmailHelper.sendOtpEmail(cleanEmail, code);

        System.debug('OTP inserted: ' + otp.Id + ' | code: ' + code);
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
        System.debug('email: '    + email);
        System.debug('otpCode: '  + otpCode);

        if (String.isBlank(email) || String.isBlank(otpCode))
            throw new AuraHandledException('Email et code OTP sont obligatoires.');
        if (String.isBlank(password) || password != confirmPassword)
            throw new AuraHandledException('Mot de passe invalide ou non confirme.');

        String cleanEmail = email.trim().toLowerCase();
        String cleanCode  = otpCode.trim();

        System.debug('cleanEmail: ' + cleanEmail + ' | cleanCode: ' + cleanCode);

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

        System.debug('Stored code: [' + otp.Code__c + '] | Entered: [' + cleanCode + ']');

        // ✅ Vérifier expiration
        Datetime expiresAt = otp.CreatedDate.addMinutes(OTP_EXPIRY_MINUTES);
        if (Datetime.now() > expiresAt)
            throw new AuraHandledException('Le code OTP a expire. Demandez-en un nouveau.');

        // ✅ Vérifier le code
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
        return createPortalUser(
            input.firstName,
            input.lastName,
            input.email,
            input.password
        );
    }

    // === Methodes privees ===
    private static String createPortalUser(
        String firstName, String lastName,
        String email,     String password) {

        // ── 1. Récupérer le Record Type Person Account
        RecordType personAccountRT = [
            SELECT Id
            FROM   RecordType
            WHERE  SObjectType = 'Account'
            AND    Name        = 'Person Account'
            LIMIT  1
        ];

        // ── 2. Vérifier doublon
        List<Account> existingAccounts = [
            SELECT Id
            FROM   Account
            WHERE  PersonEmail     = :email
            AND    IsPersonAccount = true
            LIMIT  1
        ];
        if (!existingAccounts.isEmpty())
            throw new AuraHandledException('Un compte existe déjà avec cet email.');

        // ── 3. Créer le Person Account
        Account personAccount      = new Account(
            RecordTypeId = personAccountRT.Id,
            FirstName    = firstName,
            LastName     = lastName,
            PersonEmail  = email
        );
        insert personAccount;

        // ── 4. Récupérer le Contact auto-généré
        Account paWithContact = [
            SELECT Id, PersonContactId
            FROM   Account
            WHERE  Id = :personAccount.Id
            LIMIT  1
        ];

        // ── 5. Construire l'utilisateur portail
        String aliasBase = (firstName.substring(0, 1) + lastName)
                            .replaceAll('[^A-Za-z0-9]', '');

        String nick = (firstName + '.' + lastName + '.' + Datetime.now().getTime())
                        .replace(' ', '').toLowerCase();

        User u = new User(
            FirstName         = firstName,
            LastName          = lastName,
            Email             = email,
            Username          = email,
            ContactId         = paWithContact.PersonContactId,
            ProfileId         = COMMUNITY_PROFILE,
            TimeZoneSidKey    = 'Europe/Paris',
            LocaleSidKey      = 'fr_FR',
            EmailEncodingKey  = 'UTF-8',
            LanguageLocaleKey = 'fr',
            Alias             = aliasBase.length() > 8
                                    ? aliasBase.substring(0, 8)
                                    : aliasBase,
            CommunityNickname = nick.length() > 40
                                    ? nick.substring(0, 40)
                                    : nick
        );

        // ── 6. Créer l'utilisateur externe
        try {
            Id newUserId = Site.createExternalUser(u, paWithContact.Id, password);
            if (newUserId == null)
                throw new AuraHandledException('La création du compte a échoué.');
            System.debug('Portal user created: ' + newUserId);
            return 'OK';

        } catch (Site.ExternalUserCreateException ex) {
            delete personAccount;
            throw new AuraHandledException('Inscription impossible : ' + ex.getMessage());

        } catch (Exception ex) {
            delete personAccount;
            throw new AuraHandledException('Erreur inattendue : ' + ex.getMessage());
        }
    }

    // ✅ Générateur OTP fiable
    private static String generateOtpCode() {
        String code = '';
        for (Integer i = 0; i < OTP_LENGTH; i++) {
            Integer digit = Math.mod(
                Math.abs(Crypto.getRandomInteger()),
                10
            );
            code += String.valueOf(digit);
        }
        return code;
    }
}