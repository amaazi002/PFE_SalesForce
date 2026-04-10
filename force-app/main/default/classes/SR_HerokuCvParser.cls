public with sharing class SR_HerokuCvParser {

    private static final String RENDER_URL =
        'https://cv-parser-xwwy.onrender.com/parse-cv';

    public class CvData {
        @AuraEnabled public Integer anneesExperience;
        @AuraEnabled public String  competencesTech;
        @AuraEnabled public String  experienceProf;
        @AuraEnabled public String  competencesPerso;
        @AuraEnabled public String  dernierDiplome;
        @AuraEnabled public String  ecoleUniversite;
        @AuraEnabled public Integer anneeObtention;
        @AuraEnabled public String  errorMessage;
        @AuraEnabled public String  warning;
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
            // ✅ Nettoyer le base64
            if (fileBase64.contains(',')) {
                fileBase64 = fileBase64.substringAfter(',');
            }
            fileBase64 = fileBase64.trim();

            System.debug('fileName: '     + fileName);
            System.debug('contentType: '  + contentType);
            System.debug('base64 length: '+ fileBase64.length());

            Map<String, Object> body = new Map<String, Object>();
            body.put('fileBase64',  fileBase64);
            body.put('fileName',    fileName   != null ? fileName    : '');
            body.put('contentType', contentType != null ? contentType : '');

            String jsonBody = JSON.serialize(body);

            HttpRequest req = new HttpRequest();
            req.setEndpoint(RENDER_URL);
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('Accept', 'application/json');
            req.setBody(jsonBody);
            req.setTimeout(120000);

            Http         http = new Http();
            HttpResponse res  = http.send(req);

            System.debug('Status: '   + res.getStatusCode());
            System.debug('Response: ' + res.getBody());

            if (res.getStatusCode() == 200) {
                Map<String, Object> parsed =
                    (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

                Object annExp = parsed.get('anneesExperience');
                result.anneesExperience = annExp != null
                    ? Integer.valueOf(String.valueOf(annExp)) : 0;

                result.competencesTech  = getStr(parsed, 'competencesTech');
                result.experienceProf   = getStr(parsed, 'experienceProf');
                result.competencesPerso = getStr(parsed, 'competencesPerso');
                result.dernierDiplome   = getStr(parsed, 'dernierDiplome');
                result.ecoleUniversite  = getStr(parsed, 'ecoleUniversite');

                Object annObt = parsed.get('anneeObtention');
                result.anneeObtention = annObt != null
                    ? Integer.valueOf(String.valueOf(annObt)) : null;

                result.warning = getStr(parsed, 'warning');

            } else {
                result.errorMessage = 'Erreur API: ' + res.getStatusCode() + ' - ' + res.getBody();
            }

        } catch (Exception e) {
            result.errorMessage = 'Exception: ' + e.getMessage();
            System.debug('Exception: ' + e.getMessage());
        }

        return result;
    }

    private static String getStr(Map<String, Object> m, String key) {
        Object val = m.get(key);
        if (val == null) return '';
        String s = String.valueOf(val);
        return s == 'null' ? '' : s;
    }
}