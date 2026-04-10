public without sharing class SR_FileUploadController {

    public class UploadResult {
        @AuraEnabled public Id     contentDocumentId;
        @AuraEnabled public Id     contentVersionId;
        @AuraEnabled public String url;
    }

    @AuraEnabled
    public static UploadResult uploadCv(
        Id      recordId,
        String  fileName,
        String  base64Data,
        String  contentType,
        Boolean makePublic
    ) {
        // ✅ Validations
        if (recordId == null)           throw new AuraHandledException('recordId manquant.');
        if (String.isBlank(fileName))   throw new AuraHandledException('Nom de fichier manquant.');
        if (String.isBlank(base64Data)) throw new AuraHandledException('Données fichier manquantes.');

        // ✅ Extraire uniquement la partie base64
        Integer commaPos = base64Data.indexOf(',');
        if (commaPos > -1) base64Data = base64Data.substring(commaPos + 1);

        // ✅ Décoder le base64
        Blob body;
        try {
            body = EncodingUtil.base64Decode(base64Data);
        } catch (Exception e) {
            throw new AuraHandledException('Fichier invalide (Base64).');
        }

        // ✅ Validation taille
        if (body.size() > 5 * 1024 * 1024) {
            throw new AuraHandledException('Fichier trop volumineux (> 5 Mo).');
        }

        // ✅ Titre sans extension
        String title = fileName;
        Integer dot  = fileName.lastIndexOf('.');
        if (dot > 0) title = fileName.substring(0, dot);

        // ✅ Créer le ContentVersion lié directement à la candidature
        ContentVersion cv = new ContentVersion(
            Title                  = title,
            PathOnClient           = fileName,
            VersionData            = body,
            FirstPublishLocationId = recordId
        );
        insert cv;

        // ✅ Récupérer le ContentDocumentId
        ContentVersion cvInserted = [
            SELECT Id, ContentDocumentId
            FROM ContentVersion
            WHERE Id = :cv.Id
            LIMIT 1
        ];

        // ✅ Déclencher after update pour générer le lien public
        // CV_Public_URL__c = null → le trigger va générer l'URL via CandidatureHelper
        update new Candidature__c(
            Id               = recordId,
            CV_Public_URL__c = null
        );

        // ✅ Récupérer l'URL générée par le trigger
        Candidature__c updated = [
            SELECT Id, CV_Public_URL__c
            FROM Candidature__c
            WHERE Id = :recordId
            LIMIT 1
        ];

        String finalUrl = updated.CV_Public_URL__c;

        // ✅ Si l'URL n'est pas encore générée (ContentDistribution async)
        // on retourne une URL de fallback
        if (String.isBlank(finalUrl)) {
            finalUrl = 'https://orgfarm-a3f35930cc-dev-ed.develop.lightning.force.com'
                + '/lightning/r/ContentDocument/'
                + cvInserted.ContentDocumentId + '/view';

            // ✅ Mettre à jour avec l'URL de fallback
            update new Candidature__c(
                Id               = recordId,
                CV_Public_URL__c = finalUrl
            );
        }

        // ✅ Retourner le résultat
        UploadResult res      = new UploadResult();
        res.contentDocumentId = cvInserted.ContentDocumentId;
        res.contentVersionId  = cvInserted.Id;
        res.url               = finalUrl;
        return res;
    }

    @AuraEnabled
    public static UploadResult setCvLink(
        Id      candidatureId,
        Id      contentDocumentId,
        Boolean makePublic
    ) {
        // ✅ Validations
        if (candidatureId == null)     throw new AuraHandledException('Id de candidature manquant.');
        if (contentDocumentId == null) throw new AuraHandledException('Id du fichier manquant.');

        // ✅ Récupérer le document
        ContentDocument doc = [
            SELECT Id, LatestPublishedVersionId
            FROM ContentDocument
            WHERE Id = :contentDocumentId
            LIMIT 1
        ];

        // ✅ Déclencher after update pour générer le lien public
        update new Candidature__c(
            Id               = candidatureId,
            CV_Public_URL__c = null
        );

        // ✅ Récupérer l'URL générée par le trigger
        Candidature__c updated = [
            SELECT Id, CV_Public_URL__c
            FROM Candidature__c
            WHERE Id = :candidatureId
            LIMIT 1
        ];

        String finalUrl = updated.CV_Public_URL__c;

        // ✅ Si l'URL n'est pas encore générée → fallback
        if (String.isBlank(finalUrl)) {
            finalUrl = 'https://orgfarm-a3f35930cc-dev-ed.develop.lightning.force.com'
                + '/lightning/r/ContentDocument/'
                + contentDocumentId + '/view';

            update new Candidature__c(
                Id               = candidatureId,
                CV_Public_URL__c = finalUrl
            );
        }

        // ✅ Retourner le résultat
        UploadResult res      = new UploadResult();
        res.contentDocumentId = contentDocumentId;
        res.contentVersionId  = doc.LatestPublishedVersionId;
        res.url               = finalUrl;
        return res;
    }
}