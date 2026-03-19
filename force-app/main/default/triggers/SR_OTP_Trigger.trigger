PPtrigger SR_OTP_Trigger on SR_OTP__c (after insert) {
    for (SR_OTP__c otp : Trigger.new) {
        SR_OTP_EmailHelper.sendOtpEmail(otp.Email__c, otp.Code__c);
    }
}
