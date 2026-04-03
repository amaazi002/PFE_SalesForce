public with sharing class SR_OfferController {

    private without sharing class PublicOfferAccess {

        public List<Offre__c> fetchPublicOffers(Integer limitSize) {
            Integer l = (limitSize != null && limitSize > 0 && limitSize <= 500)
                ? limitSize : 100;
            return [
                SELECT Id,
                       Titre__c,
                       Description__c,
                       CompetencesRequises__c,
                       Departement__c,
                       Localisation__c,
                       Deadline__c,
                       Statut__c,
                       TypeOffre__c
                FROM   Offre__c
                WHERE  Statut__c NOT IN ('Clôturée', 'Brouillon')
                AND   (TypeOffre__c = NULL
                       OR TypeOffre__c NOT IN ('Interne', 'Internal'))
                ORDER BY CreatedDate DESC
                LIMIT :l
            ];
        }

        public Offre__c fetchOfferById(Id offreId) {
            List<Offre__c> offers = [
                SELECT Id,
                       Titre__c,
                       Description__c,
                       CompetencesRequises__c,
                       Departement__c,
                       Localisation__c,
                       Deadline__c,
                       Statut__c,
                       TypeOffre__c
                FROM   Offre__c
                WHERE  Id = :offreId
                LIMIT  1
            ];
            // ✅ Vérifier si la liste est vide
            if (offers.isEmpty()) return null;
            return offers[0];
        }
    }

    @AuraEnabled(cacheable=false)
    public static List<Offre__c> getPublicOffers(Integer limitSize) {
        try {
            return new PublicOfferAccess().fetchPublicOffers(limitSize);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=false)
    public static Offre__c getOfferById(Id offreId) {
        if (offreId == null) throw new AuraHandledException('offreId requis');
        try {
            return new PublicOfferAccess().fetchOfferById(offreId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=false)
    public static Map<String, String> getCurrentUserProfile() {
        Map<String,String> out = new Map<String,String>();
        Boolean isGuest = true;

        try {
            // ✅ List au lieu de SObject direct
            List<User> users = [
                SELECT Id, UserType
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
                LIMIT  1
            ];

            if (!users.isEmpty()) {
                isGuest = (users[0].UserType == 'Guest');
            }

        } catch (Exception e) {
            System.debug('Error checking user type: ' + e.getMessage());
            isGuest = true;
        }

        out.put('isGuest', String.valueOf(isGuest));

        if (!isGuest) {
            try {
                List<User> users = [
                    SELECT Id, FirstName, LastName, Email, ContactId
                    FROM   User
                    WHERE  Id = :UserInfo.getUserId()
                    LIMIT  1
                ];

                if (!users.isEmpty()) {
                    User u = users[0];
                    if (u.FirstName != null) out.put('firstName', u.FirstName);
                    if (u.LastName  != null) out.put('lastName',  u.LastName);
                    if (u.Email     != null) out.put('email',     u.Email);
                    if (u.ContactId != null) out.put('contactId', String.valueOf(u.ContactId));
                }

            } catch (Exception e) {
                System.debug('Error getting user details: ' + e.getMessage());
            }
        }

        return out;
    }
}