public with sharing class SMRecTabOffreController {

    private without sharing class WithoutSharingOps {

        public List<Offre__c> fetchOffres() {
            return [
                SELECT Id,
                       Titre__c,
                       Statut__c,
                       Visible_aux_candidat__c,
                       Deadline__c,
                       CompetencesRequises__c,
                       Departement__c,
                       Localisation__c,
                       CreatedDate,
                       TypeOffre__c
                FROM Offre__c
                ORDER BY Deadline__c DESC
                LIMIT 500
            ];
        }

        public List<Candidature__c> fetchCandidatures(Id offreId) {
            return [
                SELECT Id,
                       CV_Public_URL__c,
                       DateDepot__c,
                       Statut__c,
                       Score_Matching__c,
                       Candidat__r.Name
                FROM Candidature__c
                WHERE Offre__c = :offreId
                ORDER BY DateDepot__c DESC
                LIMIT 500
            ];
        }

        public Offre__c clotureOffreOp(Id offreId) {
            Offre__c rec = new Offre__c(
                Id        = offreId,
                Statut__c = 'Clôturée'
            );
            Schema.DescribeFieldResult d =
                Offre__c.Visible_aux_candidat__c.getDescribe();
            if (d.getType() == Schema.DisplayType.Boolean) {
                rec.put('Visible_aux_candidat__c', false);
            } else {
                rec.put('Visible_aux_candidat__c', 'Non');
            }
            update rec;

            return [
                SELECT Id, Titre__c, Statut__c, Visible_aux_candidat__c
                FROM   Offre__c
                WHERE  Id = :offreId
                LIMIT  1
            ];
        }
    }

    @AuraEnabled(cacheable=false)
    public static List<Offre__c> getOffres() {
        try {
            return new WithoutSharingOps().fetchOffres();
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=false)
    public static List<Candidature__c> getCandidatures(Id offreId) {
        if (offreId == null) return new List<Candidature__c>();
        try {
            return new WithoutSharingOps().fetchCandidatures(offreId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=false)
    public static Offre__c clotureOffre(Id offreId) {
        if (offreId == null) {
            throw new AuraHandledException('offreId requis');
        }
        try {
            return new WithoutSharingOps().clotureOffreOp(offreId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}