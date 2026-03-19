public without sharing class SR_OfferController {

    // ─── Offres publiques (Guest + Connecté) ──────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static List<Offre__c> getPublicOffers(Integer limitSize) {
        Integer l = (limitSize != null && limitSize > 0 && limitSize <= 500) ? limitSize : 100;
        String visFilter;
        Schema.DescribeFieldResult d = Offre__c.Visible_aux_candidat__c.getDescribe();
        if (d.getType() == Schema.DisplayType.Boolean) {
            visFilter = 'Visible_aux_candidat__c = true';
        } else {
            visFilter = '(Visible_aux_candidat__c IN (\'Oui\', \'Yes\', \'Visible\', \'Disponible\'))';
        }
        String soql =
            'SELECT Id, Titre__c, Description__c, CompetencesRequises__c,' +
            '       Departement__c, Localisation__c, Deadline__c, Statut__c, Visible_aux_candidat__c, TypeOffre__c ' +
            'FROM Offre__c ' +
            'WHERE ' + visFilter + ' ' +
            '  AND Statut__c NOT IN (\'Clôturée\', \'Brouillon\') ' +
            '  AND (TypeOffre__c = NULL OR TypeOffre__c NOT IN (\'Interne\', \'Internal\')) ' +
            'ORDER BY CreatedDate DESC ' +
            'LIMIT ' + String.valueOf(l);
        return Database.query(soql);
    }

    @AuraEnabled(cacheable=true)
    public static Offre__c getOfferById(Id offreId) {
        if (offreId == null) throw new AuraHandledException('offreId requis');
        return [
            SELECT Id, Titre__c, Description__c, CompetencesRequises__c,
                   Departement__c, Localisation__c, Deadline__c, Statut__c, Visible_aux_candidat__c, TypeOffre__c
            FROM Offre__c
            WHERE Id = :offreId LIMIT 1
        ];
    }

    // ─── Profil utilisateur courant ───────────────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static Map<String, String> getCurrentUserProfile() {
        Map<String,String> out = new Map<String,String>();
        Boolean isGuest = true;
        try {
            User u0 = [SELECT Id, UserType FROM User WHERE Id = :UserInfo.getUserId()];
            isGuest = (u0.UserType == 'Guest');
        } catch (Exception e) { isGuest = true; }
        out.put('isGuest', String.valueOf(isGuest));

        if (!isGuest) {
            try {
                User u = [SELECT Id, FirstName, LastName, Email, ContactId FROM User WHERE Id = :UserInfo.getUserId()];
                if (u != null) {
                    if (u.FirstName != null) out.put('firstName', u.FirstName);
                    if (u.LastName  != null) out.put('lastName',  u.LastName);
                    if (u.Email     != null) out.put('email',     u.Email);
                    if (u.ContactId != null) out.put('contactId', String.valueOf(u.ContactId));
                }
            } catch (Exception e) {}
        }
        return out;
    }
}
