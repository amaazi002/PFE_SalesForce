public without sharing class CandidatureHelper {

    public static void generateCvPublicLinks(Set<Id> candidatureIds) {
        if (candidatureIds == null || candidatureIds.isEmpty()) return;

        // ✅ Filtrer les Ids null
        Set<Id> validIds = new Set<Id>();
        for (Id cId : candidatureIds) {
            if (cId != null) validIds.add(cId);
        }
        if (validIds.isEmpty()) return;

        // ✅ Requête ContentDocumentLink avec filtre valide
        List<ContentDocumentLink> links;
        try {
            links = [
                SELECT ContentDocumentId,
                       LinkedEntityId,
                       ContentDocument.LatestPublishedVersionId
                FROM ContentDocumentLink
                WHERE LinkedEntityId IN :validIds
                AND ContentDocument.LatestPublishedVersionId != null
            ];
        } catch (Exception e) {
            System.debug('Erreur ContentDocumentLink: ' + e.getMessage());
            return;
        }

        if (links == null || links.isEmpty()) return;

        Set<Id> versionIds               = new Set<Id>();
        Map<Id, Id> versionToCandidature = new Map<Id, Id>();

        for (ContentDocumentLink l : links) {
            Id versionId = l.ContentDocument.LatestPublishedVersionId;
            if (versionId != null) {
                versionIds.add(versionId);
                versionToCandidature.put(versionId, l.LinkedEntityId);
            }
        }

        if (versionIds.isEmpty()) return;

        // ✅ Vérifier les distributions existantes
        Map<Id, ContentDistribution> existingDist = new Map<Id, ContentDistribution>();
        for (ContentDistribution cd : [
            SELECT Id,
                   ContentVersionId,
                   DistributionPublicUrl,
                   ContentDownloadUrl
            FROM ContentDistribution
            WHERE ContentVersionId IN :versionIds
        ]) {
            existingDist.put(cd.ContentVersionId, cd);
        }

        // ✅ Créer uniquement les distributions manquantes
        List<ContentDistribution> toCreate = new List<ContentDistribution>();
        for (Id versionId : versionIds) {
            if (!existingDist.containsKey(versionId)) {
                toCreate.add(new ContentDistribution(
                    Name                             = 'CV Public Link',
                    ContentVersionId                 = versionId,
                    PreferencesAllowViewInBrowser    = true,
                    PreferencesLinkLatestVersion     = true,
                    PreferencesNotifyOnVisit         = false,
                    PreferencesPasswordRequired      = false,
                    PreferencesAllowOriginalDownload = true
                ));
            }
        }

        if (!toCreate.isEmpty()) {
            try {
                insert toCreate;
            } catch (Exception e) {
                System.debug('Erreur insert ContentDistribution: ' + e.getMessage());
                return;
            }

            // ✅ Récupérer les nouvelles distributions avec leurs URLs
            for (ContentDistribution cd : [
                SELECT Id,
                       ContentVersionId,
                       DistributionPublicUrl,
                       ContentDownloadUrl
                FROM ContentDistribution
                WHERE Id IN :toCreate
            ]) {
                existingDist.put(cd.ContentVersionId, cd);
            }
        }

        // ✅ Mettre à jour les candidatures avec l'URL publique
        List<Candidature__c> toUpdate = new List<Candidature__c>();
        for (Id versionId : versionIds) {
            ContentDistribution cd = existingDist.get(versionId);
            Id candId              = versionToCandidature.get(versionId);

            if (cd != null && candId != null) {
                String url = cd.ContentDownloadUrl != null
                    ? cd.ContentDownloadUrl
                    : cd.DistributionPublicUrl;

                if (url != null) {
                    toUpdate.add(new Candidature__c(
                        Id               = candId,
                        CV_Public_URL__c = url
                    ));
                }
            }
        }

        if (!toUpdate.isEmpty()) {
            try {
                update toUpdate;
            } catch (Exception e) {
                System.debug('Erreur update Candidature: ' + e.getMessage());
            }
        }
    }
}