public without sharing class SMAdminUsersController {

    // ✅ Wrapper pour éviter les problèmes de champs Person Account
    public class AccountWrapper {
        @AuraEnabled public Id     Id;
        @AuraEnabled public String firstName;
        @AuraEnabled public String lastName;
        @AuraEnabled public String fullName;
        @AuraEnabled public String email;
        @AuraEnabled public String recordTypeName;
        @AuraEnabled public String createdDate;
        @AuraEnabled public String statut;
    }

    @AuraEnabled(cacheable=true)
    public static List<AccountWrapper> getUsers() {
        List<Account> accounts = [
            SELECT  Id,
                    FirstName,
                    LastName,
                    Name,
                    PersonEmail,
                    CreatedDate,
                    RecordType.Name,
                    IsPersonAccount
            FROM    Account
            WHERE   IsPersonAccount = true
            ORDER BY CreatedDate DESC
        ];

        List<AccountWrapper> wrappers = new List<AccountWrapper>();
        for (Account a : accounts) {
            AccountWrapper w  = new AccountWrapper();
            w.Id              = a.Id;
            w.firstName       = a.FirstName  != null ? a.FirstName  : '';
            w.lastName        = a.LastName   != null ? a.LastName   : '';
            w.fullName        = a.Name       != null ? a.Name       : '—';
            w.email           = a.PersonEmail != null ? a.PersonEmail : '—';
            w.recordTypeName  = a.RecordType != null ? a.RecordType.Name : '—';
            w.createdDate     = a.CreatedDate != null
                ? String.valueOf(a.CreatedDate) : '';
            w.statut          = 'Actif';
            wrappers.add(w);
        }
        return wrappers;
    }

    @AuraEnabled
    public static void blockUser(Id userId) {
        Account a = [SELECT Id FROM Account WHERE Id = :userId LIMIT 1];
        // ✅ Mettre à jour le statut sur le Person Account
        // Si vous avez un champ Statut__c sur Account décommentez :
        // a.Statut__c = 'Bloqué';
        // update a;

        // ✅ Désactiver l'utilisateur lié
        List<User> users = [
            SELECT Id, IsActive
            FROM   User
            WHERE  AccountId = :userId
            AND    IsActive  = true
            LIMIT  1
        ];
        if (!users.isEmpty()) {
            users[0].IsActive = false;
            update users[0];
        }
    }

    @AuraEnabled
    public static void banUser(Id userId) {
        List<User> users = [
            SELECT Id, IsActive
            FROM   User
            WHERE  AccountId = :userId
            AND    IsActive  = true
            LIMIT  1
        ];
        if (!users.isEmpty()) {
            users[0].IsActive = false;
            update users[0];
        }
    }

    @AuraEnabled
    public static void deactivateUser(Id userId) {
        List<User> users = [
            SELECT Id, IsActive
            FROM   User
            WHERE  AccountId = :userId
            AND    IsActive  = true
            LIMIT  1
        ];
        if (!users.isEmpty()) {
            users[0].IsActive = false;
            update users[0];
        }
    }

    @AuraEnabled
    public static void deleteUser(Id userId) {
        List<User> users = [
            SELECT Id, IsActive
            FROM   User
            WHERE  AccountId = :userId
            LIMIT  1
        ];
        if (!users.isEmpty()) {
            users[0].IsActive = false;
            update users[0];
        }
        // ✅ Supprimer le Person Account
        Account a = [SELECT Id FROM Account WHERE Id = :userId LIMIT 1];
        delete a;
    }
}   