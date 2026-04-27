public without sharing class SR_SelfRegistrationController {

    private static final Integer OTP_EXPIRY_MINUTES = 10;
    private static final Integer OTP_LENGTH         = 6;

    // ═══════════════════════════════════════════════════════════
    // ETAPE 1 : Envoyer un OTP
    // ═══════════════════════════════════════════════════════════
    @AuraEnabled(cacheable=false)
    public static void sendOtp(
            String firstName,
            String lastName,
            String email,
            String password,
            String confirmPassword) {

        if (String.isBlank(firstName) || String.isBlank(lastName)
            || String.isBlank(email))
            throw new AuraHandledException(
                'Nom, prenom et email sont obligatoires.');

        if (String.isBlank(password) || String.isBlank(confirmPassword))
            throw new AuraHandledException(
                'Le mot de passe est obligatoire.');

        if (password != confirmPassword)
            throw new AuraHandledException(
                'Les mots de passe ne correspondent pas.');

        if (password.length() < 8)
            throw new AuraHandledException(
                'Mot de passe trop court (min 8 caracteres).');

        String cleanEmail = email.trim().toLowerCase();

        // ✅ Vérifier doublon User
        List<User> existingUsers = [
            SELECT Id FROM User
            WHERE Email    = :cleanEmail
            AND   IsActive = true
            LIMIT 1
        ];
        if (!existingUsers.isEmpty())
            throw new AuraHandledException(
                'Un compte existe deja avec cet email.');

        // ✅ Supprimer les anciens OTP via SR_OTP_Manager
        SR_OTP_Manager.deleteOldOtps(cleanEmail);

        // ✅ Générer et insérer l'OTP
        String code = generateOtpCode();

        SR_OTP__c otp = new SR_OTP__c(
            Email__c = cleanEmail,
            Code__c  = code
        );

        // ✅ Insérer via SR_OTP_Manager
        SR_OTP_Manager.insertOtp(otp);

        // ✅ Envoyer l'email
        SR_OTP_EmailHelper.sendOtpEmail(cleanEmail, code);
    }

    // ═══════════════════════════════════════════════════════════
    // ETAPE 2 : Verifier OTP et creer compte
    // ═══════════════════════════════════════════════════════════
    @AuraEnabled(cacheable=false)
    public static String verifyOtpAndRegister(
            String firstName,
            String lastName,
            String email,
            String password,
            String confirmPassword,
            String otpCode) {

        if (String.isBlank(email) || String.isBlank(otpCode))
            throw new AuraHandledException(
                'Email et code OTP sont obligatoires.');

        if (String.isBlank(password) || password != confirmPassword)
            throw new AuraHandledException(
                'Mot de passe invalide ou non confirme.');

        String cleanEmail = email.trim().toLowerCase();
        String cleanCode  = otpCode.trim();

        // ✅ Récupérer l'OTP
        List<SR_OTP__c> otps = [
            SELECT Id, Code__c, CreatedDate
            FROM   SR_OTP__c
            WHERE  Email__c = :cleanEmail
            ORDER BY CreatedDate DESC
            LIMIT  1
        ];

        if (otps.isEmpty())
            throw new AuraHandledException(
                'Aucun code OTP trouve. Veuillez recommencer.');

        SR_OTP__c otp = otps[0];

        // ✅ Vérifier expiration
        Datetime expiresAt = otp.CreatedDate.addMinutes(OTP_EXPIRY_MINUTES);
        if (Datetime.now() > expiresAt)
            throw new AuraHandledException(
                'Le code OTP a expire. Demandez-en un nouveau.');

        // ✅ Vérifier le code
        if (otp.Code__c != cleanCode)
            throw new AuraHandledException('Code OTP incorrect.');

        // ✅ Supprimer l'OTP via SR_OTP_Manager
        SR_OTP_Manager.deleteOtp(otp);

        // ✅ Créer le compte
        return createPortalUser(
            firstName, lastName, cleanEmail, password
        );
    }

    // ═══════════════════════════════════════════════════════════
    // Methode privee : Créer le user portail
    // ═══════════════════════════════════════════════════════════
    private static String createPortalUser(
        String firstName, String lastName,
        String email,     String password) {

        // ── 1. Récupérer le Profile ─────────────────────────────
        List<Profile> profiles = [
            SELECT Id, Name
            FROM   Profile
            WHERE  Name = 'Customer Community User'
            LIMIT  1
        ];
        if (profiles.isEmpty())
            throw new AuraHandledException(
                'Profil introuvable.');

        Profile communityProfile = profiles[0];

        // ── 2. Récupérer le Permission Set ──────────────────────
        List<PermissionSet> permSets = [
            SELECT Id, Name
            FROM   PermissionSet
            WHERE  Name = 'Portal_Offres_Access'
            LIMIT  1
        ];
        if (permSets.isEmpty())
            throw new AuraHandledException(
                'Permission Set introuvable.');

        PermissionSet permSet = permSets[0];

        // ── 3. Récupérer le Record Type Person Account ──────────
        List<RecordType> rts = [
            SELECT Id
            FROM   RecordType
            WHERE  SObjectType = 'Account'
            AND    Name        = 'Person Account'
            LIMIT  1
        ];
        if (rts.isEmpty())
            throw new AuraHandledException(
                'Record Type Person Account introuvable.');

        RecordType personAccountRT = rts[0];

        // ── 4. Vérifier doublon Account ─────────────────────────
        List<Account> existingAccounts = [
            SELECT Id
            FROM   Account
            WHERE  PersonEmail     = :email
            AND    IsPersonAccount = true
            LIMIT  1
        ];
        if (!existingAccounts.isEmpty())
            throw new AuraHandledException(
                'Un compte existe déjà avec cet email.');

        // ── 5. Créer le Person Account ──────────────────────────
        Account personAccount = new Account(
            RecordTypeId = personAccountRT.Id,
            FirstName    = firstName,
            LastName     = lastName,
            PersonEmail  = email
        );
        try {
            // ✅ Insert via SR_OTP_Manager
            SR_OTP_Manager.insertAccount(personAccount);
            System.debug('✅ Account created: ' + personAccount.Id);
        } catch(Exception e) {
            throw new AuraHandledException(
                'Erreur création compte : ' + e.getMessage());
        }

        // ── 6. Récupérer le Contact auto-généré ─────────────────
        Account paWithContact = [
            SELECT Id, PersonContactId
            FROM   Account
            WHERE  Id = :personAccount.Id
            LIMIT  1
        ];

        if (paWithContact.PersonContactId == null) {
            SR_OTP_Manager.deleteAccount(personAccount);
            throw new AuraHandledException(
                'Contact auto-généré introuvable.');
        }

        // ── 7. Construire alias, username, nickname ──────────────
        String aliasBase = (firstName.substring(0, 1) + lastName)
                            .replaceAll('[^A-Za-z0-9]', '');
        if (String.isBlank(aliasBase)) aliasBase = 'user';

        String username = email;
        List<User> existingUsernames = [
            SELECT Id FROM User
            WHERE Username = :username
            LIMIT 1
        ];
        if (!existingUsernames.isEmpty()) {
            username = email + '.'
                     + Datetime.now().getTime();
        }

        String nick = (firstName + lastName
                     + String.valueOf(Datetime.now().getTime()))
                        .replaceAll('[^A-Za-z0-9]', '')
                        .toLowerCase();

        // ── 8. Construire l'utilisateur portail ──────────────────
        User u = new User(
            FirstName         = firstName,
            LastName          = lastName,
            Email             = email,
            Username          = username,
            ContactId         = paWithContact.PersonContactId,
            ProfileId         = communityProfile.Id,
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

        // ── 9. ✅ Insert User + Password + PermSet ───────────────
        try {
            // ✅ Appeler la méthode asynchrone pour éviter l'erreur MIXED_DML_OPERATION
            String userJson = JSON.serialize(u);
            SR_OTP_Manager.createUserAsync(userJson, password, permSet.Id);
            System.debug('✅ User creation queued asynchronously');

            return 'OK';

        } catch (Exception ex) {
            System.debug('❌ Error: ' + ex.getMessage());
            System.debug('❌ Type: ' + ex.getTypeName());
            SR_OTP_Manager.deleteAccount(personAccount);
            throw new AuraHandledException(
                'Erreur : ' + ex.getMessage());
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Générateur OTP
    // ═══════════════════════════════════════════════════════════
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