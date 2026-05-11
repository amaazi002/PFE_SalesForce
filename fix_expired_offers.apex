// Vérifier d'abord les statuts réels des offres expirées
List<Offre__c> offresExpirees = [
    SELECT Id, Titre__c, Statut__c, Deadline__c
    FROM Offre__c
    WHERE Deadline__c < TODAY
];
System.debug('=== Offres expirées trouvées : ' + offresExpirees.size() + ' ===');
for (Offre__c o : offresExpirees) {
    System.debug('Offre: ' + o.Titre__c + ' | Statut: [' + o.Statut__c + '] | Deadline: ' + o.Deadline__c);
}

// Forcer la clôture de toutes les offres expirées non encore clôturées
List<Offre__c> aCloturer = new List<Offre__c>();
for (Offre__c o : offresExpirees) {
    if (o.Statut__c != 'Clôturée') {
        o.Statut__c = 'Clôturée';
        aCloturer.add(o);
    }
}

if (!aCloturer.isEmpty()) {
    update aCloturer;
    System.debug('✅ ' + aCloturer.size() + ' offre(s) clôturée(s) avec succès.');
} else {
    System.debug('ℹ️ Toutes les offres expirées sont déjà clôturées.');
}
