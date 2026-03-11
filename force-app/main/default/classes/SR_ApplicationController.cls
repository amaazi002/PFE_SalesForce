/**
 * SR_ApplicationController
 * Controller for candidate application creation from site/LWC.
 *
 * - Résout le Contact depuis l'utilisateur courant si possible, sinon par email, sinon le crée
 * - Insère Candidature__c et la partage avec un groupe public "Recruiters"/"Recruteurs" si présent
 *
 * Sécurité:
 * - with sharing pour respecter le modèle de partage
 */
public with sharing class SR_ApplicationController {

    /**
     * Crée une Candidature__c pour une offre. Peut associer un Contact existant ou en créer un.
     * @param offreId Id de l'offre (requis)
     * @param sexe Valeur de sexe
     * @param techSkills Compétences techniques
     * @param experience Expérience professionnelle
     * @param softSkills Compétences personnelles
     * @param firstName Prénom du candidat (pour création Contact)
     * @param lastName Nom du candidat (pour création Contact)
     * @param email Email du candidat (pour retrouver/créer Contact)
     * @return Id de la Candidature__c créée
     */

@AuraEnabled
public static Id createCandidature(
    Id    offreId,
    String sexe,
    String techSkills,
    String experience,
    String softSkills,
    String firstName,
    String lastName,
    String email
) {
    if (offreId == null) {
        throw new AuraHandledException('Offre requise (offreId manquant).');
    }

    // Résoudre le Contact (utilisateur connecté vs invité)
    Id contactId = null;
    try {
        User u = [SELECT UserType, ContactId FROM User WHERE Id = :UserInfo.getUserId()];
        if (u.UserType != 'Guest' && u.ContactId != null) {
            contactId = u.ContactId;
        }
    } catch (Exception e) {
        // invité: continuer
    }

    // Invité : réutiliser un Contact par email si possible
    if (contactId == null && String.isNotBlank(email)) {
        try {
            Contact c0 = [SELECT Id FROM Contact WHERE Email = :email LIMIT 1];
            contactId = c0.Id;
        } catch (Exception e) {
            // aucun contact existant
        }
    }

    // Créer un Contact léger si toujours rien et qu'on a l'identité
    if (contactId == null && String.isNotBlank(firstName) && String.isNotBlank(lastName) && String.isNotBlank(email)) {
        try {
            Account acc = [SELECT Id FROM Account WHERE Name = 'Candidats' LIMIT 1];
            Contact c = new Contact(FirstName = firstName, LastName = lastName, Email = email, AccountId = acc.Id);
            insert c;
            contactId = c.Id;
        } catch (Exception e) {
            // pas de compte/droits -> continuer sans Contact
        }
    }

    // Construire la candidature
    Candidature__c cand = new Candidature__c(
        Offre__c             = offreId,
        Candidat__c          = contactId,
        Statut__c            = 'Soumise',
        Sexe__c              = sexe,
        Competences_Tech__c  = techSkills,
        Experience_Prof__c   = experience,
        Competences_Perso__c = softSkills
    );

    // Renseigner DateDepot__c automatiquement (Date ou DateTime selon le champ)
    try {
        Schema.DescribeFieldResult dd = Candidature__c.DateDepot__c.getDescribe();
        if (dd.getType() == Schema.DisplayType.Date) {
            cand.put('DateDepot__c', Date.today());
         } else if (dd.getType() == Schema.DisplayType.Date) {
             cand.put('DateDepot__c', Date.today());
         }
    } catch (Exception e) { /* ignore */ }

    // Valider Statut__c: si 'Soumise' n'est pas autorisé, prendre la 1ère valeur
    try {
        Schema.DescribeFieldResult st = Candidature__c.Statut__c.getDescribe();
        if (st.getType() == Schema.DisplayType.Picklist) {
            Set<String> allowed = new Set<String>();
            for (Schema.PicklistEntry pe : st.getPicklistValues()) allowed.add(pe.getValue());
            if (!allowed.contains(cand.Statut__c)) {
                cand.Statut__c = (st.getPicklistValues().isEmpty() ? null : st.getPicklistValues()[0].getValue());
            }
        }
    } catch (Exception e) { /* ignore */ }

    // Valider Sexe__c: si valeur non autorisée, mettre null
    try {
        Schema.DescribeFieldResult sx = Candidature__c.Sexe__c.getDescribe();
        if (sx.getType() == Schema.DisplayType.Picklist && cand.Sexe__c != null) {
            Set<String> allowed = new Set<String>();
            for (Schema.PicklistEntry pe : sx.getPicklistValues()) allowed.add(pe.getValue());
            if (!allowed.contains(cand.Sexe__c)) {
                cand.Sexe__c = null;
            }
        }
    } catch (Exception e) { /* ignore */ }

    // Sécurité FLS/CRUD (assainir avant insert)
    try {
        SObjectAccessDecision sad = Security.stripInaccessible(AccessType.CREATABLE, new List<SObject>{ cand });
        cand = (Candidature__c) sad.getRecords()[0];
    } catch (Exception e) { /* ignore */ }

    // Insert avec message d’erreur explicite
    try {
        insert cand;
    } catch (DmlException d) {
        String msg = d.getDmlMessage(0);
        throw new AuraHandledException('Création de la candidature impossible: ' + msg);
    }

    // Partage vers groupe recruteurs (ne bloque pas en cas d’échec)
    try {
        shareWithRecruiters(cand.Id, 'Read'); // ou 'Edit'
    } catch (Exception e) { /* ignore */ }

    return cand.Id;
}

// Partage vers un Public Group "Recruiters"/"Recruteurs" (à créer si absent)
private static void shareWithRecruiters(Id candId, String accessLevel) {
    if (candId == null) return;

    List<Group> gps = [
        SELECT Id FROM Group
        WHERE Type = 'Regular' AND DeveloperName IN ('Recruiters','Recruteurs')
        LIMIT 1
    ];
    if (gps.isEmpty()) return;

    Candidature__Share sh = new Candidature__Share();
    sh.ParentId      = candId;
    sh.UserOrGroupId = gps[0].Id;
    sh.AccessLevel   = String.isBlank(accessLevel) ? 'Read' : accessLevel;

    // Si tu as un Apex Sharing Reason sur Candidature__c, décommente et adapte:
    // sh.RowCause = Candidature__Share.RowCause.Recruiters_Access__c;

    insert sh;
}
}