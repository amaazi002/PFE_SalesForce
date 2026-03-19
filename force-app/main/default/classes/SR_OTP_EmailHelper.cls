public without sharing class SR_OTP_EmailHelper {

    private static final Integer OTP_EXPIRY_MINUTES = 10;

    public static void sendOtpEmail(String toEmail, String code) {

        System.debug('sendOtpEmail - to: ' + toEmail + ' | code: ' + code);

        String subject = 'Votre code de verification - Portail Recrutement';

        String styleDiv  = 'font-family:Arial,sans-serif;max-width:480px;'
                         + 'margin:auto;border:1px solid #dddbda;'
                         + 'border-radius:8px;padding:32px;';
        String styleH2   = 'color:#0176d3;';
        String styleCode = 'font-size:2rem;font-weight:700;'
                         + 'letter-spacing:10px;text-align:center;'
                         + 'padding:16px 0;color:#0176d3;';
        String styleNote = 'color:#706e6b;font-size:.85rem;';

        String htmlBody
            = '<div style="' + styleDiv + '">'
            + '<h2 style="' + styleH2 + '">Portail de Recrutement</h2>'
            + '<p>Voici votre code de verification'
            + ' pour finaliser la creation de votre compte :</p>'
            + '<div style="' + styleCode + '">' + code + '</div>'
            + '<p>Ce code est valable <strong>'
            + OTP_EXPIRY_MINUTES + ' minutes</strong>.</p>'
            + '<p style="' + styleNote + '">'
            + 'Si vous n\'avez pas demande ce code,'
            + ' ignorez cet e-mail.</p>'
            + '</div>';

        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setToAddresses(new List<String>{ toEmail });
        mail.setSubject(subject);
        mail.setHtmlBody(htmlBody);
        mail.setSaveAsActivity(false);

        List<Messaging.SendEmailResult> results =
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail }, false);

        for (Messaging.SendEmailResult r : results) {
            if (r.isSuccess()) {
                System.debug('EMAIL SENT OK to: ' + toEmail);
            } else {
                String errMsg = '';
                for (Messaging.SendEmailError err : r.getErrors()) {
                    errMsg += err.getStatusCode() + ' - ' + err.getMessage() + '; ';
                }
                System.debug('EMAIL ERROR: ' + errMsg);
            }
        }
    }
}
