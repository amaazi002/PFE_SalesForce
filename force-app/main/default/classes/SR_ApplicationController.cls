/**
 * SR_ApplicationController
 * Controller for candidate application creation from site/LWC.
 *
 * - Résout le Contact depuis l'utilisateur courant si possible,
 *   sinon par email, sinon le crée
 * - Insère Candidature__c et la partage avec un groupe public
 *   "Recruiters"/"Recruteurs" si présent
 *
 * Sécurité:
 * - with sharing pour respecter le modèle de partage
 */
public with sharing class SR_ApplicationController {

    /**
     * Retourne la liste des offres publiques.
     * cacheable=false car les données peuvent changer fréquemment.
     *
     * @param limitSize Nombre maximum d'offres à retourner
     * @return Liste d'Offre__c avec Titre__c
     */
    @AuraEnabled(cacheable=false)
    public static List<Offre__c> getPublicOffers(Integer limitSize) {

        Integer lim = (limitSize != null && limitSize > 0) ? limitSize : 50;

        return [
            SELECT Id,
                   Titre__c
            FROM   Offre__c
            ORDER BY CreatedDate DESC
            LIMIT :lim
        ];
    }

    /**
     * Retourne les candidatures de l'utilisateur connecté
     * avec Statut__c et DateDepot__c
     *
     * @return Liste de Candidature__c
     */
    @AuraEnabled(cacheable=false)
    public static List<Candidature__c> getMyCandidatures() {

        Id contactId = null;

        // Récupérer le ContactId de l'utilisateur connecté
        try {
            User u = [
                SELECT UserType, ContactId
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
            ];
            if (u.UserType != 'Guest' && u.ContactId != null) {
                contactId = u.ContactId;
            }
        } catch (Exception e) {
            // Utilisateur invité : retourner liste vide
            return new List<Candidature__c>();
        }

        if (contactId == null) {
            return new List<Candidature__c>();
        }

        return [
            SELECT Id,
                   Statut__c,
                   DateDepot__c,
                   Offre__r.Titre__c
            FROM   Candidature__c
            WHERE  Candidat__c = :contactId
            ORDER BY DateDepot__c DESC
        ];
    }

    /**
     * Crée une Candidature__c pour une offre.
     * Peut associer un Contact existant ou en créer un.
     *
     * @param offreId    Id de l'offre (requis)
     * @param sexe       Valeur de sexe
     * @param techSkills Compétences techniques
     * @param experience Expérience professionnelle
     * @param softSkills Compétences personnelles
     * @param firstName  Prénom du candidat (pour création Contact)
     * @param lastName   Nom du candidat (pour création Contact)
     * @param email      Email du candidat (pour retrouver/créer Contact)
     * @return Id de la Candidature__c créée
     */
    @AuraEnabled
    public static Id createCandidature(
        Id     offreId,
        String sexe,
        String techSkills,
        String experience,
        String softSkills,
        String firstName,
        String lastName,
        String email
    ) {
        // ── Validation entrée ────────────────────────────────────────────────
        if (offreId == null) {
            throw new AuraHandledException(
                'Offre requise (offreId manquant).'
            );
        }

        // ── Résolution du Contact ────────────────────────────────────────────

        Id contactId = null;

        // Étape 1 : utilisateur connecté avec un ContactId (Community/Portal)
        try {
            User u = [
                SELECT UserType, ContactId
                FROM   User
                WHERE  Id = :UserInfo.getUserId()
            ];
            if (u.UserType != 'Guest' && u.ContactId != null) {
                contactId = u.ContactId;
            }
        } catch (Exception e) {
            // Utilisateur invité ou absent : on continue
        }

        // Étape 2 : invité → chercher un Contact par email existant
        if (contactId == null && String.isNotBlank(email)) {
            try {
                Contact c0 = [
                    SELECT Id
                    FROM   Contact
                    WHERE  Email = :email
                    LIMIT  1
                ];
                contactId = c0.Id;
            } catch (Exception e) {
                // Aucun contact existant : on continue
            }
        }

        // Étape 3 : créer un Contact léger si on a les données nécessaires
        if (
            contactId == null
            && String.isNotBlank(firstName)
            && String.isNotBlank(lastName)
            && String.isNotBlank(email)
        ) {
            try {
                Account acc = [
                    SELECT Id
                    FROM   Account
                    WHERE  Name = 'Candidats'
                    LIMIT  1
                ];
                Contact c = new Contact(
                    FirstName = firstName,
                    LastName  = lastName,
                    Email     = email,
                    AccountId = acc.Id
                );
                insert c;
                contactId = c.Id;
            } catch (Exception e) {
                // Pas de compte Candidats ou droits insuffisants
                // On continue sans Contact (champ nullable)
            }
        }

        // ── Construction de la Candidature ───────────────────────────────────

        Candidature__c cand = new Candidature__c(
            Offre__c             = offreId,
            Candidat__c          = contactId,
            Statut__c            = 'Soumise',
            Sexe__c              = sexe,
            Competences_Tech__c  = techSkills,
            Experience_Prof__c   = experience,
            Competences_Perso__c = softSkills
        );

        // ── Renseigner DateDepot__c selon le type du champ ───────────────────
        try {
            Schema.DescribeFieldResult dd =
                Candidature__c.DateDepot__c.getDescribe();

            if (dd.getType() == Schema.DisplayType.Date) {
                // Champ Date : on stocke uniquement la date du jour
                cand.put('DateDepot__c', Date.today());

            } else if (dd.getType() == Schema.DisplayType.DateTime) {
                // Champ DateTime : on stocke la date ET l'heure courante
                cand.put('DateDepot__c', Datetime.now());
            }
        } catch (Exception e) {
            // Champ absent de l'org : on ignore silencieusement
        }

        // ── Validation Statut__c (picklist) ──────────────────────────────────
        // Si 'Soumise' n'est pas une valeur autorisée, on prend la 1ère valeur
        try {
            Schema.DescribeFieldResult st =
                Candidature__c.Statut__c.getDescribe();

            if (st.getType() == Schema.DisplayType.Picklist) {
                Set<String> allowed = new Set<String>();
                for (Schema.PicklistEntry pe : st.getPicklistValues()) {
                    allowed.add(pe.getValue());
                }
                if (!allowed.contains(cand.Statut__c)) {
                    cand.Statut__c = st.getPicklistValues().isEmpty()
                        ? null
                        : st.getPicklistValues()[0].getValue();
                }
            }
        } catch (Exception e) { /* ignore */ }

        // ── Validation Sexe__c (picklist) ────────────────────────────────────
        // Si valeur non autorisée, on met null pour éviter une erreur DML
        try {
            Schema.DescribeFieldResult sx =
                Candidature__c.Sexe__c.getDescribe();

            if (
                sx.getType() == Schema.DisplayType.Picklist
                && cand.Sexe__c != null
            ) {
                Set<String> allowed = new Set<String>();
                for (Schema.PicklistEntry pe : sx.getPicklistValues()) {
                    allowed.add(pe.getValue());
                }
                if (!allowed.contains(cand.Sexe__c)) {
                    cand.Sexe__c = null;
                }
            }
        } catch (Exception e) { /* ignore */ }

        // ── Sécurité FLS/CRUD ────────────────────────────────────────────────
        // stripInaccessible retire les champs non accessibles avant l'insert
        try {
            SObjectAccessDecision sad = Security.stripInaccessible(
                AccessType.CREATABLE,
                new List<SObject>{ cand }
            );
            cand = (Candidature__c) sad.getRecords()[0];
        } catch (Exception e) { /* ignore */ }

        // ── Insert avec message explicite ────────────────────────────────────
        try {
            insert cand;
        } catch (DmlException d) {
            String msg = d.getDmlMessage(0);
            throw new AuraHandledException(
                'Création de la candidature impossible: ' + msg
            );
        }

        // ── Partage vers groupe recruteurs ───────────────────────────────────
        // Non bloquant : un échec ici ne doit pas annuler la candidature
        try {
            shareWithRecruiters(cand.Id, 'Read');
        } catch (Exception e) { /* ignore */ }

        return cand.Id;
    }

    /**
     * Partage une Candidature__c vers le Public Group "Recruiters" ou
     * "Recruteurs" (à créer dans Setup > Public Groups si absent).
     *
     * @param candId      Id de la Candidature__c à partager
     * @param accessLevel Niveau d'accès : 'Read' ou 'Edit'
     */
    private static void shareWithRecruiters(Id candId, String accessLevel) {
        if (candId == null) return;

        List<Group> gps = [
            SELECT Id
            FROM   Group
            WHERE  Type         =  'Regular'
            AND    DeveloperName IN ('Recruiters', 'Recruteurs')
            LIMIT  1
        ];
        if (gps.isEmpty()) return;

        Candidature__Share sh = new Candidature__Share();
        sh.ParentId      = candId;
        sh.UserOrGroupId = gps[0].Id;
        sh.AccessLevel   = String.isBlank(accessLevel) ? 'Read' : accessLevel;

        // Si un Apex Sharing Reason existe sur Candidature__c, décommente :
        // sh.RowCause = Candidature__Share.RowCause.Recruiters_Access__c;

        insert sh;
    }
}