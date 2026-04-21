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
    public static List<Candidature__c> getCandidatures(Id offreId) {
        return [
            SELECT Id, Statut__c, DateDepot__c, Score_Matching__c,
                   CV_Public_URL__c,
                   Candidat__r.Name
            FROM Candidature__c
            WHERE Offre__c = :offreId
            ORDER BY DateDepot__c DESC
        ];
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

    @AuraEnabled
    public static void updateStatutCandidature(Id candidatureId, String statut) {
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
}