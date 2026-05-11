public without sharing class SR_ApplicationController {

    @AuraEnabled
    public static Id createCandidature(
        Id      offreId,
        String  sexe,
        String  techSkills,
        String  experience,
        String  softSkills,
        String  firstName,
        String  lastName,
        String  email,
        String  telephone,
        String  dateNaissance,
        String  situationFamiliale,
        Integer anneesExperience,
        String  dernierDiplome,
        String  niveauEtude,
        String  ecoleUniversite,
        Integer anneeObtention,
        Boolean isJunior
    ) {
        if (offreId == null) {
            throw new AuraHandledException('Offre requise (offreId manquant).');
        }

        // ── Résolution Contact ────────────────────────────────────────
        Id contactId = null;
        try {
            User u = [SELECT UserType, ContactId FROM User WHERE Id = :UserInfo.getUserId()];
            if (u.UserType != 'Guest' && u.ContactId != null) {
                contactId = u.ContactId;
            }
        } catch (Exception e) {}

        if (contactId == null && String.isNotBlank(email)) {
            try {
                Contact c0 = [SELECT Id FROM Contact WHERE Email = :email LIMIT 1];
                contactId = c0.Id;
            } catch (Exception e) {}
        }

        // ── Vérification doublon ──────────────────────────────────────
        // Si le candidat existe déjà, vérifier qu'il n'a pas déjà postulé
        if (contactId != null) {
            List<Candidature__c> existantes = [
                SELECT Id FROM Candidature__c
                WHERE Offre__c    = :offreId
                AND   Candidat__c = :contactId
                LIMIT 1
            ];
            if (!existantes.isEmpty()) {
                throw new AuraHandledException(
                    'Vous avez déjà postulé à cette offre. Vous ne pouvez pas soumettre plusieurs candidatures pour la même offre.'
                );
            }
        }

        if (contactId != null) {
            // ✅ CORRECTION : Mettre à jour le contact existant avec les nouvelles infos
            try {
                Contact cToUpdate = new Contact(Id = contactId);
                if (String.isNotBlank(firstName)) cToUpdate.FirstName = firstName;
                if (String.isNotBlank(lastName))  cToUpdate.LastName = lastName;
                if (String.isNotBlank(telephone)) cToUpdate.Phone = telephone;
                if (String.isNotBlank(situationFamiliale)) cToUpdate.SituationFamiliale__c = situationFamiliale;

                if (String.isNotBlank(dateNaissance)) {
                    try {
                        cToUpdate.Birthdate = Date.valueOf(dateNaissance);
                    } catch (Exception e) {}
                }

                try {
                    Schema.DescribeFieldResult sx = Contact.Sexe__c.getDescribe();
                    if (sx.getType() == Schema.DisplayType.Picklist && String.isNotBlank(sexe)) {
                        Set<String> allowed = new Set<String>();
                        for (Schema.PicklistEntry pe : sx.getPicklistValues()) {
                            allowed.add(pe.getValue());
                        }
                        cToUpdate.put('Sexe__c', allowed.contains(sexe) ? sexe : null);
                    }
                } catch (Exception e) {}

                update cToUpdate;
            } catch (Exception e) {
                System.debug('Erreur lors de la mise à jour du contact: ' + e.getMessage());
            }
        } else if (String.isNotBlank(firstName) && String.isNotBlank(lastName) && String.isNotBlank(email)) {
            try {
                Account acc = [SELECT Id FROM Account WHERE Name = 'Candidats' LIMIT 1];

                // ✅ CORRECTION 1 : DateNaissance__c avec __c + virgule après chaque champ
                Contact c = new Contact(
                    FirstName             = firstName,
                    LastName              = lastName,
                    Email                 = email,
                    Phone                 = telephone,
                    SituationFamiliale__c = situationFamiliale,
                    AccountId             = acc.Id
                );

                // ✅ CORRECTION 2 : Birthdate
                if (String.isNotBlank(dateNaissance)) {
                    try {
                        c.Birthdate = Date.valueOf(dateNaissance);
                    } catch (Exception e) {}
                }

                // ✅ CORRECTION 3 : Validation Sexe__c ICI dans le même scope que c
                try {
                    Schema.DescribeFieldResult sx = Contact.Sexe__c.getDescribe();
                    String sexeVal = sexe;
                    if (sx.getType() == Schema.DisplayType.Picklist
                        && String.isNotBlank(sexeVal)) {
                        Set<String> allowed = new Set<String>();
                        for (Schema.PicklistEntry pe : sx.getPicklistValues()) {
                            allowed.add(pe.getValue());
                        }
                        c.put('Sexe__c', allowed.contains(sexeVal) ? sexeVal : null);
                    }
                } catch (Exception e) {}

                insert c;
                contactId = c.Id;

            } catch (Exception e) {}
        }

        // ── Construction Candidature ──────────────────────────────────
        Candidature__c cand = new Candidature__c(
            Offre__c             = offreId,
            Candidat__c          = contactId,
            Statut__c            = 'Soumise',
            Competences_Tech__c  = techSkills,
            Experience_Prof__c   = experience,
            Competences_Perso__c = softSkills,
            AnneesExperience__c  = anneesExperience,
            DernierDiplome__c    = dernierDiplome,
            NiveauEtude__c       = niveauEtude,
            EcoleUniversite__c   = ecoleUniversite,
            AnneeObtention__c    = anneeObtention
            // Is_Junior__c      = isJunior (Field doesn't exist yet)
        );

        // ── DateDepot__c ──────────────────────────────────────────────
        try {
            Schema.DescribeFieldResult dd = Candidature__c.DateDepot__c.getDescribe();
            if (dd.getType() == Schema.DisplayType.Date) {
                cand.put('DateDepot__c', Date.today());
            } else if (dd.getType() == Schema.DisplayType.DateTime) {
                cand.put('DateDepot__c', Datetime.now());
            }
        } catch (Exception e) {}

        // ── Validation Statut__c ──────────────────────────────────────
        try {
            Schema.DescribeFieldResult st = Candidature__c.Statut__c.getDescribe();
            if (st.getType() == Schema.DisplayType.Picklist) {
                Set<String> allowed = new Set<String>();
                for (Schema.PicklistEntry pe : st.getPicklistValues()) {
                    allowed.add(pe.getValue());
                }
                if (!allowed.contains(cand.Statut__c)) {
                    cand.Statut__c = st.getPicklistValues().isEmpty()
                        ? null : st.getPicklistValues()[0].getValue();
                }
            }
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
        try { shareWithRecruiters(cand.Id, 'Read'); } catch (Exception e) {}

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