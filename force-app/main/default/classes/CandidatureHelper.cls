public without sharing class CandidatureHelper {

    public static void generateCvPublicLinks(Set<Id> candidatureIds) {
        if (candidatureIds == null || candidatureIds.isEmpty()) return;

        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId,
                   LinkedEntityId,
                   ContentDocument.LatestPublishedVersionId
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :candidatureIds
            AND ContentDocument.LatestPublishedVersionId != null
        ];

        if (links.isEmpty()) return;

        Set<Id> versionIds = new Set<Id>();
        Map<Id, Id> versionToCandidature = new Map<Id, Id>();

        for (ContentDocumentLink l : links) {
            Id versionId = l.ContentDocument.LatestPublishedVersionId;
            versionIds.add(versionId);
            versionToCandidature.put(versionId, l.LinkedEntityId);
        }

        Map<Id, ContentDistribution> existingDist =
            new Map<Id, ContentDistribution>();

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
            insert toCreate;
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

        List<Candidature__c> toUpdate = new List<Candidature__c>();
        for (Id versionId : versionIds) {
            ContentDistribution cd = existingDist.get(versionId);
            Id candId              = versionToCandidature.get(versionId);

            if (cd != null && candId != null) {
                // ✅ Utiliser ContentDownloadUrl au lieu de DistributionPublicUrl
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
            update toUpdate;
        }
    }
}