public without sharing class SMRecTabOffreController {

    @AuraEnabled(cacheable=true)
    public static List<Offre__c> getOffres() {
        return [
            SELECT Id, Titre__c, Statut__c, TypeOffre__c,
                   Deadline__c, CreatedDate, Visible_aux_candidat__c,
                   Departement__c, Localisation__c, Description__c,
                   CompetencesRequises__c
            FROM Offre__c
            ORDER BY CreatedDate DESC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<OffreStats> getOffresWithStats() {
        List<Offre__c> offres = [
            SELECT Id, Titre__c, Statut__c, TypeOffre__c,
                   Deadline__c, CreatedDate, Visible_aux_candidat__c,
                   Departement__c, Localisation__c
            FROM Offre__c
            ORDER BY CreatedDate DESC
        ];

        Set<Id> offreIds = new Map<Id, Offre__c>(offres).keySet();

        List<Candidature__c> candidatures = [
            SELECT Id, Offre__c, Statut__c,
                   DateEntretien__c, DateDepot__c
            FROM Candidature__c
            WHERE Offre__c IN :offreIds
        ];

        Map<Id, OffreStats> statsMap = new Map<Id, OffreStats>();
        for (Offre__c o : offres) {
            OffreStats s = new OffreStats();
            s.offre      = o;
            s.offreId    = o.Id;
            statsMap.put(o.Id, s);
        }

        for (Candidature__c c : candidatures) {
            OffreStats s = statsMap.get(c.Offre__c);
            if (s == null) continue;
            s.totalCandidats++;

            if (c.Statut__c == 'Soumise' &&
                c.DateDepot__c != null &&
                c.DateDepot__c >= Date.today().addDays(-1)) {
                s.newSubmissions++;
            }

            if (c.Statut__c == 'Sans entretien' ||
                (c.Statut__c == 'Soumise' && c.DateEntretien__c == null)) {
                s.enAttenteEntretien++;
            }

            if (c.DateEntretien__c != null || c.Statut__c == 'En entretien') {
                s.entretienPlanifie++;
            }
        }

        return statsMap.values();
    }

    @AuraEnabled(cacheable=true)
    public static List<Candidature__c> getCandidatures(Id offreId) {
        return [
            SELECT Id, Statut__c, DateDepot__c,
                   Score_Matching__c, CV_Public_URL__c,
                   Decision__c, DateEntretien__c,
                   Candidat__r.Name, Candidat__r.Id,
                   Candidat__r.Email,
                   Competences_Tech__c,
                   Experience_Prof__c,
                   Competences_Perso__c,
                   AnneesExperience__c,
                   DernierDiplome__c,
                   EcoleUniversite__c,
                   NiveauEtude__c
            FROM Candidature__c
            WHERE Offre__c = :offreId
            ORDER BY DateDepot__c DESC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Candidature__c> getAllCandidatures(
            String searchTerm,
            String statutFilter) {

        String query = 'SELECT Id, Statut__c, DateDepot__c, '
                     + 'Score_Matching__c, CV_Public_URL__c, '
                     + 'Decision__c, DateEntretien__c, '
                     + 'Offre__r.Titre__c, '
                     + 'Candidat__r.Name, Candidat__r.Id '
                     + 'FROM Candidature__c WHERE Id != null ';

        if (String.isNotBlank(searchTerm)) {
            query += 'AND Candidat__r.Name LIKE \'%'
                  + String.escapeSingleQuotes(searchTerm.trim())
                  + '%\' ';
        }

        if (String.isNotBlank(statutFilter) && statutFilter != 'Tous') {
            query += 'AND Statut__c = \''
                  + String.escapeSingleQuotes(statutFilter)
                  + '\' ';
        }

        query += 'ORDER BY DateDepot__c DESC LIMIT 200';
        return Database.query(query);
    }

    @AuraEnabled(cacheable=true)
    public static Candidature__c getCandidatureById(Id candidatureId) {
        return [
            SELECT Id, Statut__c, DateDepot__c,
                   Score_Matching__c, CV_Public_URL__c,
                   Decision__c, DateEntretien__c,
                   Offre__r.Titre__c,
                   Candidat__r.Name,
                   Candidat__r.Email,
                   Competences_Tech__c,
                   Experience_Prof__c,
                   Competences_Perso__c,
                   AnneesExperience__c,
                   DernierDiplome__c,
                   EcoleUniversite__c,
                   AnneeObtention__c,
                   NiveauEtude__c,
                   RGPDConsent__c
            FROM Candidature__c
            WHERE Id = :candidatureId
            LIMIT 1
        ];
    }

    // ✅ updateCandidature — profil candidat
    @AuraEnabled
    public static void updateCandidature(
        String candidatureId,
        String newStatut,
        String decision,
        String dateEntretien
    ) {
        try {
            if (String.isBlank(candidatureId)) {
                throw new AuraHandledException('ID candidature manquant');
            }

            Candidature__c c = new Candidature__c(Id = candidatureId);
            if (String.isNotBlank(newStatut))     c.Statut__c        = newStatut;
            if (String.isNotBlank(decision))      c.Decision__c      = decision;
            if (String.isNotBlank(dateEntretien)) {
                c.DateEntretien__c = Datetime.valueOf(
                dateEntretien.replace('T', ' ') + ':00'
                );
            }

            update c;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ✅ updateCandidaturesGrouped — action groupée
    @AuraEnabled
    public static void updateCandidaturesGrouped(String updatesJson) {
        try {
            List<Object> rawList =
                (List<Object>) JSON.deserializeUntyped(updatesJson);
            List<Candidature__c> toUpdate = new List<Candidature__c>();

            for (Object obj : rawList) {
                Map<String, Object> u = (Map<String, Object>) obj;
                String cId    = (String) u.get('candidatureId');
                String statut = (String) u.get('newStatut');
                String dec    = (String) u.get('decision');

                if (String.isBlank(cId)) continue;

                Candidature__c c = new Candidature__c(Id = cId);
                if (String.isNotBlank(statut)) c.Statut__c   = statut;
                if (String.isNotBlank(dec))    c.Decision__c = dec;
                toUpdate.add(c);
            }

            if (!toUpdate.isEmpty()) update toUpdate;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateStatutCandidature(
            Id candidatureId, String statut) {
        try {
            Candidature__c c = new Candidature__c(
                Id        = candidatureId,
                Statut__c = statut
            );
            update c;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void clotureOffre(Id offreId) {
        try {
            Offre__c o = new Offre__c(
                Id                      = offreId,
                Statut__c               = 'Clôturée',
                Visible_aux_candidat__c = 'Non'
            );
            update o;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateOffre(
        Id     offreId,
        String titre,
        String departement,
        String localisation,
        Date   deadline,
        String statut,
        String typeOffre,
        String description,
        String competences,
        String visibleAuxCandidat
    ) {
        try {
            Offre__c o = new Offre__c(Id = offreId);
            if (titre              != null) o.Titre__c                = titre;
            if (departement        != null) o.Departement__c          = departement;
            if (localisation       != null) o.Localisation__c         = localisation;
            if (deadline           != null) o.Deadline__c             = deadline;
            if (statut             != null) o.Statut__c               = statut;
            if (typeOffre          != null) o.TypeOffre__c            = typeOffre;
            if (description        != null) o.Description__c          = description;
            if (competences        != null) o.CompetencesRequises__c  = competences;
            if (visibleAuxCandidat != null) o.Visible_aux_candidat__c = visibleAuxCandidat;
            update o;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ═══════════════════════════════════════════════════════════
    // WRAPPER
    // ═══════════════════════════════════════════════════════════
    public class OffreStats {
        @AuraEnabled public Offre__c offre;
        @AuraEnabled public Id       offreId;
        @AuraEnabled public Integer  totalCandidats      = 0;
        @AuraEnabled public Integer  newSubmissions      = 0;
        @AuraEnabled public Integer  enAttenteEntretien  = 0;
        @AuraEnabled public Integer  entretienPlanifie   = 0;
    }
}