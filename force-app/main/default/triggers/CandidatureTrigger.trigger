trigger CandidatureTrigger on Candidature__c (after insert, before insert) {
    set<Id> CandidatureIds = new set<Id>();
    for (Candidature__c c : Trigger.new) {
        CandidatureIds.add(c.Id);
    }
    CandidatureHelper.generateCvPublicLinks(CandidatureIds);
}