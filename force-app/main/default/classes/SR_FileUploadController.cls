public with sharing class SR_FileUploadController {
    @AuraEnabled
    public static void uploadCv(Id recordId, String fileName, String base64Data, String contentType) {
        if (recordId == null)            throw new AuraHandledException('recordId manquant.');
        if (String.isBlank(fileName))    throw new AuraHandledException('Nom de fichier manquant.');
        if (String.isBlank(base64Data))  throw new AuraHandledException('Données fichier manquantes.');
        // Si base64Data vient d’un Data URL (data:...;base64,xxx), on retire le préfixe
        Integer commaPos = base64Data.indexOf(',');
        if (commaPos > -1) base64Data = base64Data.substring(commaPos + 1);

        Blob body;
        try {
            body = EncodingUtil.base64Decode(base64Data);
        } catch (Exception e) {
            throw new AuraHandledException('Fichier invalide (Base64).');
        }

        Integer maxBytes = 5 * 1024 * 1024; // 5 Mo
        if (body.size() > maxBytes) {
            throw new AuraHandledException('Fichier trop volumineux (> 5 Mo). Utilisez le bouton standard "Déposer votre CV".');
        }

        // Déterminer le titre (sans extension)
        String title = fileName;
        Integer dot = fileName.lastIndexOf('.');
        if (dot > 0) title = fileName.substring(0, dot);

        // 1) Créer le ContentVersion (sans FirstPublishLocationId si on gère le lien explicitement)
        ContentVersion cv = new ContentVersion();
        cv.Title = title;
        cv.PathOnClient = fileName;    // garde l’extension
        cv.VersionData = body;
        insert cv;

        // 2) Récupérer le ContentDocumentId
        ContentVersion cvInserted = [
            SELECT Id, ContentDocumentId
            FROM ContentVersion
            WHERE Id = :cv.Id
            LIMIT 1
        ];

        // 3) Créer le lien explicite vers l’enregistrement cible
        ContentDocumentLink cdl = new ContentDocumentLink();
        cdl.ContentDocumentId = cvInserted.ContentDocumentId;
        cdl.LinkedEntityId = recordId;     // <-- le "LinkedEntityId" que tu veux
        cdl.ShareType = 'V';               // V=Viewer, C=Collaborator, I=Inferred
        cdl.Visibility = 'AllUsers';       // ou 'InternalUsers' selon ton besoin
        insert cdl;
    }   
}