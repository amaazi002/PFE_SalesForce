public with sharing class SR_FileUploadController {

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
        if (recordId == null)           throw new AuraHandledException('recordId manquant.');
        if (String.isBlank(fileName))   throw new AuraHandledException('Nom de fichier manquant.');
        if (String.isBlank(base64Data)) throw new AuraHandledException('Données fichier manquantes.');

        Integer commaPos = base64Data.indexOf(',');
        if (commaPos > -1) base64Data = base64Data.substring(commaPos + 1);

        Blob body;
        try {
            body = EncodingUtil.base64Decode(base64Data);
        } catch (Exception e) {
            throw new AuraHandledException('Fichier invalide (Base64).');
        }

        if (body.size() > 5 * 1024 * 1024) {
            throw new AuraHandledException('Fichier trop volumineux (> 5 Mo).');
        }

        String title = fileName;
        Integer dot  = fileName.lastIndexOf('.');
        if (dot > 0) title = fileName.substring(0, dot);

        ContentVersion cv = new ContentVersion(
            Title               = title,
            PathOnClient        = fileName,
            VersionData         = body,
            FirstPublishLocationId = recordId
        );
        insert cv;

        ContentVersion cvInserted = [
            SELECT Id, ContentDocumentId
            FROM ContentVersion
            WHERE Id = :cv.Id
            LIMIT 1
        ];

        String finalUrl = 'https://orgfarm-a3f35930cc-dev-ed.develop.lightning.force.com'
            + '/lightning/r/ContentDocument/'
            + cvInserted.ContentDocumentId + '/view';

        update new Candidature__c(
            Id               = recordId,
            CV_Public_URL__c = finalUrl
        );

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
        if (candidatureId == null)     throw new AuraHandledException('Id de candidature manquant.');
        if (contentDocumentId == null) throw new AuraHandledException('Id du fichier manquant.');

        ContentDocument doc = [
            SELECT Id, LatestPublishedVersionId
            FROM ContentDocument
            WHERE Id = :contentDocumentId
            LIMIT 1
        ];

        String finalUrl = 'https://orgfarm-a3f35930cc-dev-ed.develop.lightning.force.com'
            + '/lightning/r/ContentDocument/'
            + contentDocumentId + '/view';

        update new Candidature__c(
            Id               = candidatureId,
            CV_Public_URL__c = finalUrl
        );

        UploadResult res      = new UploadResult();
        res.contentDocumentId = contentDocumentId;
        res.contentVersionId  = doc.LatestPublishedVersionId;
        res.url               = finalUrl;
        return res;
    }
}