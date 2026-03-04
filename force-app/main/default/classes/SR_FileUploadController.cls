public with sharing class SR_FileUploadController {

    @AuraEnabled
    public static void uploadCv(Id recordId, String fileName, String base64Data, String contentType) {
        if (recordId == null)            throw new AuraHandledException('recordId manquant.');
        if (String.isBlank(fileName))    throw new AuraHandledException('Nom de fichier manquant.');
        if (String.isBlank(base64Data))  throw new AuraHandledException('Données fichier manquantes.');

        // Décoder
        Blob body;
        try {
            body = EncodingUtil.base64Decode(base64Data);
        } catch (Exception e) {
            throw new AuraHandledException('Fichier invalide (Base64).');
        }

        // Limite prudente (Apex heap)
        Integer maxBytes = 5 * 1024 * 1024; // 5 Mo
        if (body.size() > maxBytes) {
            throw new AuraHandledException('Fichier trop volumineux (> 5 Mo). Utilisez le bouton standard "Déposer votre CV".');
        }

        // Déterminer le titre
        String title = fileName;
        Integer dot = fileName.lastIndexOf('.');
        if (dot > 0) title = fileName.substring(0, dot);

        ContentVersion cv = new ContentVersion();
        cv.Title = title;
        cv.PathOnClient = fileName;    // conserve l'extension
        cv.VersionData = body;
        cv.FirstPublishLocationId = recordId; // lie directement au record (Candidature__c)
        insert cv;
    }
}