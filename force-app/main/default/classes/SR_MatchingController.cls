public without sharing class SR_MatchingController {

    private static final String RENDER_URL =
        'https://cv-parser-xwwy.onrender.com/match-cv';

    @AuraEnabled
    public static Integer matchCv(
        String cvDataJson,
        Id     candidatureId,
        Id     offreId
    ) {
        System.debug('=== matchCv START ===');
        System.debug('candidatureId : ' + candidatureId);
        System.debug('offreId       : ' + offreId);
        System.debug('cvDataJson    : ' + cvDataJson);

        // ✅ Validations
        if (String.isBlank(cvDataJson)) {
            throw new AuraHandledException('cvDataJson manquant.');
        }
        if (candidatureId == null) {
            throw new AuraHandledException('candidatureId manquant.');
        }
        if (offreId == null) {
            throw new AuraHandledException('offreId manquant.');
        }

        // ✅ Récupérer les champs de l'offre
        List<Offre__c> offres = [
            SELECT Id,
                   CompetencesRequises__c,
                   Description__c
            FROM   Offre__c
            WHERE  Id = :offreId
            LIMIT  1
        ];

        if (offres.isEmpty()) {
            System.debug('❌ Offre introuvable : ' + offreId);
            throw new AuraHandledException('Offre introuvable : ' + offreId);
        }

        Offre__c offre = offres[0];
        System.debug('CompetencesRequises : ' + offre.CompetencesRequises__c);
        System.debug('Description         : ' + offre.Description__c);

        // ✅ Construire le body
        Map<String, Object> cvData = 
            (Map<String, Object>) JSON.deserializeUntyped(cvDataJson);

        Map<String, Object> body = new Map<String, Object>();
        body.put('cvData',              cvData);
        body.put('competencesRequises', offre.CompetencesRequises__c != null
                                            ? offre.CompetencesRequises__c : '');
        body.put('descriptionOffre',    offre.Description__c != null
                                            ? offre.Description__c : '');

        String jsonBody = JSON.serialize(body);
        System.debug('Body envoyé : ' + jsonBody);

        // ✅ Appel API Render
        HttpRequest req = new HttpRequest();
        req.setEndpoint(RENDER_URL);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Accept',       'application/json');
        req.setBody(jsonBody);
        req.setTimeout(120000);

        Http         http = new Http();
        HttpResponse res;

        try {
            res = http.send(req);
        } catch(Exception e) {
            System.debug('❌ Callout erreur : ' + e.getMessage());
            throw new AuraHandledException('Erreur appel API : ' + e.getMessage());
        }

        System.debug('Status   : ' + res.getStatusCode());
        System.debug('Response : ' + res.getBody());

        if (res.getStatusCode() != 200) {
            throw new AuraHandledException(
                'Erreur API : ' + res.getStatusCode() + ' - ' + res.getBody()
            );
        }

        // ✅ Parser la réponse
        Map<String, Object> result =
            (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

        Integer score = result.get('score') != null
            ? Integer.valueOf(String.valueOf(result.get('score'))) : 0;

        System.debug('✅ Score : ' + score);

        // ✅ Sauvegarder le score
        update new Candidature__c(
            Id                = candidatureId,
            Score_Matching__c = score
        );

        System.debug('✅ Score sauvegardé dans Candidature__c');
        System.debug('=== matchCv END ===');

        return score;
    }
}