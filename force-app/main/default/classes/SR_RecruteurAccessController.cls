public without sharing class SR_RecruteurAccessController {

    @AuraEnabled(cacheable=false)
    public static Boolean hasRecruteurAccess() {
        try {
            // ✅ Vérifier si l'utilisateur a le Permission Set Recruteur_Access
            List<PermissionSetAssignment> psa = [
                SELECT Id
                FROM   PermissionSetAssignment
                WHERE  AssigneeId = :UserInfo.getUserId()
                AND    PermissionSet.Name = 'Recruteur_Access'
                LIMIT  1
            ];
            return !psa.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }
}
