trigger CandidatureTrigger on Candidature__c (after insert, after update) {

    // ✅ AFTER UPDATE — générer le lien si CV uploadé et URL vide
    if (Trigger.isAfter && Trigger.isUpdate) {
        Set<Id> ids = new Set<Id>();
        for (Candidature__c c : Trigger.new) {
            Candidature__c oldC = Trigger.oldMap.get(c.Id);
            if (c.Id != null && c.CV_Public_URL__c == null) {
                ids.add(c.Id);
            }
        }
        if (!ids.isEmpty()) {
            CandidatureHelper.generateCvPublicLinks(ids);
        }
    }
}