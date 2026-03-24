public with sharing class SR_OfferController {

    private without sharing class PublicOfferAccess {

        public List<Offre__c> fetchPublicOffers(Integer limitSize) {
            Integer l = (limitSize != null && limitSize > 0 && limitSize <= 500)
                ? limitSize : 100;

            // ✅ Filtre simplifié : uniquement Statut__c
            // Visible_aux_candidat__c retiré → offres visibles connecté ET déconnecté
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
                WHERE  Id = :offreId
                LIMIT  1
            ];
        }
    }

    @AuraEnabled(cacheable=false)
    public static List<Offre__c> getPublicOffers(Integer limitSize) {
        return new PublicOfferAccess().fetchPublicOffers(limitSize);
    }

    @AuraEnabled(cacheable=false)
    public static Offre__c getOfferById(Id offreId) {
        if (offreId == null) throw new AuraHandledException('offreId requis');
        return new PublicOfferAccess().fetchOfferById(offreId);
    }

    @AuraEnabled(cacheable=false)
    public static Map<String, String> getCurrentUserProfile() {
        Map<String,String> out = new Map<String,String>();
        Boolean isGuest = true;
        try {
            User u0 = [
                SELECT Id, UserType
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
            ];
            isGuest = (u0.UserType == 'Guest');
        } catch (Exception e) { isGuest = true; }

        out.put('isGuest', String.valueOf(isGuest));

        if (!isGuest) {
            try {
                User u = [
                    SELECT Id, FirstName, LastName, Email, ContactId
                    FROM   User
                    WHERE  Id = :UserInfo.getUserId()
                ];
                if (u.FirstName != null) out.put('firstName', u.FirstName);
                if (u.LastName  != null) out.put('lastName',  u.LastName);
                if (u.Email     != null) out.put('email',     u.Email);
                if (u.ContactId != null) out.put('contactId', String.valueOf(u.ContactId));
            } catch (Exception e) {}
        }
        return out;
    }
}