/**
 * SR_OffreAutoClotureScheduler
 * ─────────────────────────────────────────────────────────────────────────────
 * Scheduled Apex — s'exécute chaque nuit à minuit.
 * Toutes les offres dont la Deadline__c est dépassée et dont le statut
 * n'est pas encore "Clôturée" sont automatiquement clôturées.
 *
 * Planification initiale (à exécuter une seule fois dans Developer Console) :
 *   SR_OffreAutoClotureScheduler.planifier();
 *
 * Ou manuellement via Setup → Scheduled Jobs → New Job.
 * ─────────────────────────────────────────────────────────────────────────────
 */
public without sharing class SR_OffreAutoClotureScheduler
        implements Schedulable, Database.Batchable<SObject> {

    // ─── Expression CRON : tous les jours à 00:05 ───────────────────────────
    private static final String CRON_EXPR = '0 5 0 * * ?';
    private static final String JOB_NAME  = 'SR_OffreAutoCloture_Daily';

    // ════════════════════════════════════════════════════════════════════════
    // PLANIFICATION HELPER
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Appeler cette méthode UNE seule fois dans Anonymous Apex ou Developer
     * Console pour enregistrer le job planifié :
     *   SR_OffreAutoClotureScheduler.planifier();
     */
    public static void planifier() {
        // Annuler un éventuel job existant avec le même nom
        for (CronTrigger ct : [
            SELECT Id FROM CronTrigger
            WHERE CronJobDetail.Name = :JOB_NAME
        ]) {
            System.abortJob(ct.Id);
        }
        System.schedule(JOB_NAME, CRON_EXPR, new SR_OffreAutoClotureScheduler());
        System.debug('✅ Job planifié : ' + JOB_NAME + ' | CRON : ' + CRON_EXPR);
    }

    // ════════════════════════════════════════════════════════════════════════
    // SCHEDULABLE — point d'entrée du job planifié
    // ════════════════════════════════════════════════════════════════════════
    public void execute(SchedulableContext sc) {
        // Lancer en mode batch pour gérer des volumes importants
        Database.executeBatch(new SR_OffreAutoClotureScheduler(), 200);
    }

    // ════════════════════════════════════════════════════════════════════════
    // BATCHABLE — traitement par lots
    // ════════════════════════════════════════════════════════════════════════

    /** Sélectionner toutes les offres expirées non encore clôturées */
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator([
            SELECT Id, Titre__c, Statut__c, Deadline__c
            FROM   Offre__c
            WHERE  Deadline__c < TODAY
            AND    Statut__c  != 'Clôturée'
        ]);
    }

    /** Mettre à jour chaque lot d'offres expirées */
    public void execute(Database.BatchableContext bc, List<Offre__c> scope) {
        for (Offre__c o : scope) {
            o.Statut__c               = 'Clôturée';
            o.Visible_aux_candidat__c = 'Non';
        }
        try {
            update scope;
            System.debug('✅ ' + scope.size() + ' offre(s) clôturée(s) automatiquement.');
        } catch (DmlException e) {
            System.debug('❌ Erreur lors de la clôture automatique : ' + e.getMessage());
        }
    }

    public void finish(Database.BatchableContext bc) {
        System.debug('✅ SR_OffreAutoClotureScheduler — traitement terminé.');
    }
}
