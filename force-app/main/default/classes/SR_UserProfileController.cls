public without sharing class SR_UserProfileController {

    @AuraEnabled(cacheable=true)
    public static Map<String, String> getUserProfile() {
        Map<String, String> out = new Map<String, String>();
        try {
            User u = [
                SELECT Id, FirstName, LastName, Email,
                       ContactId, Profile.Name
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
            ];
            out.put('firstName',   u.FirstName    != null ? u.FirstName    : '');
            out.put('lastName',    u.LastName     != null ? u.LastName     : '');
            out.put('email',       u.Email        != null ? u.Email        : '');
            out.put('contactId',   u.ContactId    != null ? String.valueOf(u.ContactId) : '');
            out.put('profileName', u.Profile.Name != null ? u.Profile.Name : '');
        } catch (Exception e) {
            throw new AuraHandledException(
                'Erreur : ' + e.getMessage()
            );
        }
        return out;
    }

    @AuraEnabled
    public static void updateUserProfile(
        String firstName,
        String lastName,
        String email,
        String phone
    ) {
        try {
            User u = [
                SELECT Id, FirstName, LastName, Email, ContactId
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
            ];
            u.FirstName = firstName;
            u.LastName  = lastName;
            u.Email     = email;
            update u;

            if (u.ContactId != null) {
                Contact c = [
                    SELECT Id, FirstName, LastName, Email, Phone
                    FROM   Contact
                    WHERE  Id = :u.ContactId
                ];
                c.FirstName = firstName;
                c.LastName  = lastName;
                c.Email     = email;
                c.Phone     = phone;
                update c;
            }
        } catch (Exception e) {
            throw new AuraHandledException(
                'Erreur lors de la mise à jour : ' + e.getMessage()
            );
        }
    }

    @AuraEnabled(cacheable=false)
    public static List<Candidature__c> getMyCandidatures() {
        try {
            User u = [
                SELECT Id, ContactId
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
            ];
            if (u.ContactId == null) return new List<Candidature__c>();

            return [
                SELECT Id,
                       Offre__c,
                       Offre__r.Titre__c,
                       Offre__r.Localisation__c,
                       Offre__r.Departement__c,
                       Statut__c,
                       DateDepot__c,
                       CreatedDate
                FROM   Candidature__c
                WHERE  Candidat__c = :u.ContactId
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            throw new AuraHandledException(
                'Erreur lors de la récupération des candidatures : ' + e.getMessage()
            );
        }
    }
}