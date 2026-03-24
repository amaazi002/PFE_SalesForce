trigger ContentDocumentLinkTrigger on ContentDocumentLink (after insert) {
    ContentDocumentLinkHandler.handleAfterInsert(Trigger.new);
}