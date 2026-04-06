public with sharing class SR_HerokuCvParser {

    // ✅ Remplacer par votre URL Heroku après déploiement
    private static final String HEROKU_URL =
        'https://votre-app.herokuapp.com/parse-cv';

    public class CvData {
        @AuraEnabled public Integer anneesExperience;
        @AuraEnabled public String  competencesTech;
        @AuraEnabled public String  experienceProf;
        @AuraEnabled public String  competencesPerso;
        @AuraEnabled public String  dernierDiplome;
        @AuraEnabled public String  ecoleUniversite;
        @AuraEnabled public Integer anneeObtention;
        @AuraEnabled public String  errorMessage;
    }

    @AuraEnabled
    public static CvData parseCv(
        String fileBase64,
        String fileName,
        String contentType
    ) {
        CvData result = new CvData();

        if (String.isBlank(fileBase64)) {
            result.errorMessage = 'Fichier manquant.';
            return result;
        }

        try {
            // Construire le body JSON
            Map<String, Object> body = new Map<String, Object>();
            body.put('fileBase64',  fileBase64);
            body.put('fileName',    fileName);
            body.put('contentType', contentType);

            String jsonBody = JSON.serialize(body);

            // Appel HTTP vers Heroku
            HttpRequest req = new HttpRequest();
            req.setEndpoint(HEROKU_URL);
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setBody(jsonBody);
            req.setTimeout(120000); // 2 minutes

            Http http     = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                Map<String, Object> parsed =
                    (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

                result.anneesExperience = parsed.get('anneesExperience') != null
                    ? Integer.valueOf(String.valueOf(parsed.get('anneesExperience'))) : 0;
                result.competencesTech  = (String) parsed.get('competencesTech');
                result.experienceProf   = (String) parsed.get('experienceProf');
                result.competencesPerso = (String) parsed.get('competencesPerso');
                result.dernierDiplome   = (String) parsed.get('dernierDiplome');
                result.ecoleUniversite  = (String) parsed.get('ecoleUniversite');
                result.anneeObtention   = parsed.get('anneeObtention') != null
                    ? Integer.valueOf(String.valueOf(parsed.get('anneeObtention'))) : null;

            } else {
                result.errorMessage = 'Erreur API: ' + res.getStatusCode()
                    + ' - ' + res.getBody();
            }

        } catch (Exception e) {
            result.errorMessage = 'Erreur: ' + e.getMessage();
        }

        return result;
    }
}