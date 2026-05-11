/**
 * OffreAutoCloturer
 * ─────────────────────────────────────────────────────────────────────────────
 * Trigger Before Insert / Before Update sur Offre__c.
 *
 * Si la Deadline__c d'une offre est dépassée (inférieure à la date du jour)
 * ET que le statut n'est pas déjà "Clôturée", le statut est automatiquement
 * passé à "Clôturée".
 * ─────────────────────────────────────────────────────────────────────────────
 */
trigger OffreAutoCloturer on Offre__c (before insert, before update) {

    Date today = Date.today();

    for (Offre__c offre : Trigger.new) {

        // Vérifier seulement si le deadline est renseigné et dépassé
        if (offre.Deadline__c != null
                && offre.Deadline__c < today
                && offre.Statut__c != 'Clôturée') {

            offre.Statut__c = 'Clôturée';
        }
    }
}
