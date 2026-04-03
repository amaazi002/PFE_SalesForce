public with sharing class SMAdminUsersController {

    @AuraEnabled(cacheable=true)
    public static List<User> getUsers() {
        return [
            SELECT Id, Name, Email, UserRole.Name, IsActive, CreatedDate,
                   Profile.Name, Username
            FROM User
            WHERE IsActive = true
            ORDER BY CreatedDate DESC
            LIMIT 200
        ];
    }

    @AuraEnabled
    public static void blockUser(Id userId) {
        User u = [SELECT Id, IsActive FROM User WHERE Id = :userId];
        u.IsActive = false;
        update u;
    }

    @AuraEnabled
    public static void banUser(Id userId) {
        User u = [SELECT Id, IsActive FROM User WHERE Id = :userId];
        u.IsActive = false;
        update u;
    }

    @AuraEnabled
    public static void deactivateUser(Id userId) {
        User u = [SELECT Id, IsActive FROM User WHERE Id = :userId];
        u.IsActive = false;
        update u;
    }

    @AuraEnabled
    public static void deleteUser(Id userId) {
        // ⚠️ On ne peut pas supprimer un User Salesforce
        // On le désactive à la place
        User u = [SELECT Id, IsActive FROM User WHERE Id = :userId];
        u.IsActive = false;
        update u;
    }
}