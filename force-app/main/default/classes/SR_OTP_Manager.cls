public without sharing class SR_OTP_Manager {

    // ✅ Supprimer les anciens OTP
    public static void deleteOldOtps(String email) {
        List<SR_OTP__c> oldOtps = [
            SELECT Id FROM SR_OTP__c
            WHERE Email__c = :email
        ];
        if (!oldOtps.isEmpty()) {
            delete oldOtps;
        }
    }

    // ✅ Insérer un OTP
    public static void insertOtp(SR_OTP__c otp) {
        insert otp;
    }

    // ✅ Supprimer un OTP
    public static void deleteOtp(SR_OTP__c otp) {
        delete otp;
    }

    // ✅ Créer Account
    public static void insertAccount(Account a) {
        insert a;
    }

    // ✅ Supprimer Account
    public static void deleteAccount(Account a) {
        delete a;
    }

    // ✅ Créer User
    public static void insertUser(User u) {
        insert u;
    }

    // ✅ Créer PermissionSetAssignment
    public static void insertPermSetAssignment(
        PermissionSetAssignment psa) {
        insert psa;
    }

    // ✅ Création asynchrone pour éviter MIXED_DML_OPERATION
    @future
    public static void createUserAsync(String userJson, String password, Id permSetId) {
        try {
            User u = (User) JSON.deserialize(userJson, User.class);
            insert u;
            if (String.isNotBlank(password)) {
                System.setPassword(u.Id, password);
            }
            if (permSetId != null) {
                PermissionSetAssignment psa = new PermissionSetAssignment(
                    AssigneeId = u.Id,
                    PermissionSetId = permSetId
                );
                insert psa;
            }
        } catch (Exception e) {
            System.debug('❌ Erreur createUserAsync : ' + e.getMessage());
        }
    }
}