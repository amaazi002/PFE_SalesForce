public without sharing class ContentDocumentLinkHandler {

    public static void handleAfterInsert(List<ContentDocumentLink> newLinks) {

        Set<Id> candidatureIds = new Set<Id>();

        for (ContentDocumentLink cdl : newLinks) {
            if (cdl.LinkedEntityId != null) {
                String objType = cdl.LinkedEntityId.getSObjectType()
                                    .getDescribe().getName();
                if (objType == 'Candidature__c') {
                    candidatureIds.add(cdl.LinkedEntityId);
                }
            }
        }

        if (candidatureIds.isEmpty()) return;

        Map<Id, Id> candToDoc = new Map<Id, Id>();
        for (ContentDocumentLink cdl : newLinks) {
            if (candidatureIds.contains(cdl.LinkedEntityId)) {
                candToDoc.put(cdl.LinkedEntityId, cdl.ContentDocumentId);
            }
        }

        List<Candidature__c> toUpdate = new List<Candidature__c>();

        for (Id candId : candToDoc.keySet()) {
            Id docId = candToDoc.get(candId);

            // ✅ URL fixe de ton org
            String fileUrl = 'https://orgfarm-a3f35930cc-dev-ed.develop.lightning.force.com'
                           + '/lightning/r/ContentDocument/'
                           + docId
                           +'/view';

            toUpdate.add(new Candidature__c(
                Id               = candId,
                CV_Public_URL__c = fileUrl
            ));
        }

        if (!toUpdate.isEmpty()) {
            try {
                update toUpdate;
            } catch (DmlException e) {
                System.debug('Erreur update CV_Public_URL__c : ' + e.getMessage());
            }
        }
    }
}