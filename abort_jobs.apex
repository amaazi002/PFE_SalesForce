for (CronTrigger ct : [SELECT Id, CronJobDetail.Name FROM CronTrigger WHERE CronJobDetail.Name = 'SR_OffreAutoCloture_Daily']) {
    System.abortJob(ct.Id);
}
for(AsyncApexJob job : [SELECT Id, Status FROM AsyncApexJob WHERE Status IN ('Queued', 'Processing', 'Preparing') AND ApexClass.Name = 'SR_OffreAutoClotureScheduler']) {
    System.abortJob(job.Id);
}
