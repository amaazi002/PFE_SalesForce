// ✅ without sharing → utilisateur connecté peut créer une Candidature__c
public without sharing class SR_ApplicationController {

    @AuraEnabled(cacheable=false)
    public static List<Offre__c> getPublicOffers(Integer limitSize) {
        Integer lim = (limitSize != null && limitSize > 0) ? limitSize : 50;
        return [
            SELECT Id, Titre__c
            FROM   Offre__c
            ORDER BY CreatedDate DESC
            LIMIT :lim
        ];
    }

    @AuraEnabled
    public static Id createCandidature(
        Id     offreId,
        String sexe,
        String techSkills,
        String experience,
        String softSkills,
        String firstName,
        String lastName,
        String email
    ) {
        // ── Validation ───────────────────────────────────────────────
        if (offreId == null) {
            throw new AuraHandledException('Offre requise (offreId manquant).');
        }

        // ── Résolution Contact ────────────────────────────────────────
        Id contactId = null;

        // Étape 1 : utilisateur connecté
        try {
            User u = [
                SELECT UserType, ContactId
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
            ];
            if (u.UserType != 'Guest' && u.ContactId != null) {
                contactId = u.ContactId;
            }
        } catch (Exception e) {}

        // Étape 2 : chercher Contact par email
        if (contactId == null && String.isNotBlank(email)) {
            try {
                Contact c0 = [
                    SELECT Id FROM Contact
                    WHERE  Email = :email
                    LIMIT  1
                ];
                contactId = c0.Id;
            } catch (Exception e) {}
        }

        // Étape 3 : créer Contact léger
        if (
            contactId == null
            && String.isNotBlank(firstName)
            && String.isNotBlank(lastName)
            && String.isNotBlank(email)
        ) {
            try {
                Account acc = [
                    SELECT Id FROM Account
                    WHERE  Name = 'Candidats'
                    LIMIT  1
                ];
                Contact c = new Contact(
                    FirstName = firstName,
                    LastName  = lastName,
                    Email     = email,
                    AccountId = acc.Id
                );
                insert c;
                contactId = c.Id;
            } catch (Exception e) {}
        }

        // ── Construction Candidature ──────────────────────────────────
        Candidature__c cand = new Candidature__c(
            Offre__c             = offreId,
            Candidat__c          = contactId,
            Statut__c            = 'Soumise',
            Sexe__c              = sexe,
            Competences_Tech__c  = techSkills,
            Experience_Prof__c   = experience,
            Competences_Perso__c = softSkills
        );

        // ── DateDepot__c ──────────────────────────────────────────────
        try {
            Schema.DescribeFieldResult dd =
                Candidature__c.DateDepot__c.getDescribe();
            if (dd.getType() == Schema.DisplayType.Date) {
                cand.put('DateDepot__c', Date.today());
            } else if (dd.getType() == Schema.DisplayType.DateTime) {
                cand.put('DateDepot__c', Datetime.now());
            }
        } catch (Exception e) {}

        // ── Validation Statut__c ──────────────────────────────────────
        try {
            Schema.DescribeFieldResult st =
                Candidature__c.Statut__c.getDescribe();
            if (st.getType() == Schema.DisplayType.Picklist) {
                Set<String> allowed = new Set<String>();
                for (Schema.PicklistEntry pe : st.getPicklistValues()) {
                    allowed.add(pe.getValue());
                }
                if (!allowed.contains(cand.Statut__c)) {
                    cand.Statut__c = st.getPicklistValues().isEmpty()
                        ? null
                        : st.getPicklistValues()[0].getValue();
                }
            }
        } catch (Exception e) {}

        // ── Validation Sexe__c ────────────────────────────────────────
        try {
            Schema.DescribeFieldResult sx =
                Candidature__c.Sexe__c.getDescribe();
            if (sx.getType() == Schema.DisplayType.Picklist && cand.Sexe__c != null) {
                Set<String> allowed = new Set<String>();
                for (Schema.PicklistEntry pe : sx.getPicklistValues()) {
                    allowed.add(pe.getValue());
                }
                if (!allowed.contains(cand.Sexe__c)) {
                    cand.Sexe__c = null;
                }
            }
        } catch (Exception e) {}

        // ── Sécurité FLS/CRUD ─────────────────────────────────────────
        try {
            SObjectAccessDecision sad = Security.stripInaccessible(
                AccessType.CREATABLE,
                new List<SObject>{ cand }
            );
            cand = (Candidature__c) sad.getRecords()[0];
        } catch (Exception e) {}

        // ── Insert ────────────────────────────────────────────────────
        try {
            insert cand;
        } catch (DmlException d) {
            throw new AuraHandledException(
                'Création de la candidature impossible: ' + d.getDmlMessage(0)
            );
        }

        // ── Partage recruteurs ────────────────────────────────────────
        try {
            shareWithRecruiters(cand.Id, 'Read');
        } catch (Exception e) {}

        return cand.Id;
    }

    private static void shareWithRecruiters(Id candId, String accessLevel) {
        if (candId == null) return;

        List<Group> gps = [
            SELECT Id FROM Group
            WHERE  Type = 'Regular'
            AND    DeveloperName IN ('Recruiters', 'Recruteurs')
            LIMIT  1
        ];
        if (gps.isEmpty()) return;

        Candidature__Share sh = new Candidature__Share();
        sh.ParentId      = candId;
        sh.UserOrGroupId = gps[0].Id;
        sh.AccessLevel   = String.isBlank(accessLevel) ? 'Read' : accessLevel;
        insert sh;
    }
}