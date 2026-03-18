public with sharing class SMRecTabOffreController {

    // Helper: forcer l’invisibilité côté candidats (compatible Boolean ou Picklist)
private static void setVisibilityToFalse(Offre__c rec) {
    Schema.DescribeFieldResult d = Offre__c.Visible_aux_candidat__c.getDescribe();
    if (d.getType() == Schema.DisplayType.Boolean) {
        rec.put('Visible_aux_candidat__c', false);
    } else {
        rec.put('Visible_aux_candidat__c', 'Non'); // adapter si ta valeur picklist diffère
    }
}

// Liste des offres (vue recruteur)
@AuraEnabled(cacheable=true)
public static List<Offre__c> getOffres() {
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

// Clôturer une offre : statut = "Clôturée" + masquer côté candidats
@AuraEnabled
public static Offre__c clotureOffre(Id offreId) {
    if (offreId == null) {
        throw new AuraHandledException('offreId requis');
    }

    Offre__c rec = new Offre__c(
        Id = offreId,
        Statut__c = 'Clôturée'
    );
    setVisibilityToFalse(rec);
    update rec;

    return [
        SELECT Id, Titre__c, Statut__c, Visible_aux_candidat__c
        FROM Offre__c
        WHERE Id = :offreId
        LIMIT 1
    ];
}

// Candidatures liées à une offre
// NOTE: we also expose the public CV url so the LWC can render it.
    @AuraEnabled(cacheable=true)
    public static List<Candidature__c> getCandidatures(Id offreId) {
        if (offreId == null) {
            return new List<Candidature__c>();
        }
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
}