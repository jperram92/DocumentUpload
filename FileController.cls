// Apex Controller
public with sharing class FileController {

    @AuraEnabled(cacheable=true)
    public static List<FileWrapper> getFiles(String objectId) {
        List<FileWrapper> files = new List<FileWrapper>();

        if (String.isBlank(objectId)) {
            throw new AuraHandledException('Object ID is required to fetch files.');
        }

        try {
            // Query ContentDocumentLink to fetch associated ContentDocumentIds
            List<ContentDocumentLink> links = [
                SELECT ContentDocumentId
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :objectId
            ];

            if (links.isEmpty()) {
                System.debug('No ContentDocumentLinks found for objectId: ' + objectId);
                return files;
            }

            // Extract ContentDocumentIds into a Set
            Set<Id> contentDocumentIds = new Set<Id>();
            for (ContentDocumentLink link : links) {
                contentDocumentIds.add(link.ContentDocumentId);
            }

            // Fetch the latest ContentVersion for each ContentDocument
            List<ContentVersion> versions = [
                SELECT Id, ContentDocumentId, Title, ContentSize, LastModifiedDate, FileType, Description, Document_Type__c, LastModifiedBy.Name
                FROM ContentVersion
                WHERE ContentDocumentId IN :contentDocumentIds
                ORDER BY LastModifiedDate DESC
            ];

            // Map the ContentVersion data to FileWrapper
            for (ContentVersion version : versions) {
                files.add(new FileWrapper(
                    version.Id, // ContentVersion.Id for updates
                    version.ContentDocumentId, // Logical grouping
                    version.Title,
                    version.ContentSize != null ? version.ContentSize / 1024 : null, // Convert size to KB
                    version.LastModifiedDate,
                    version.FileType,
                    version.Description,
                    version.Document_Type__c,
                    version.LastModifiedBy != null ? version.LastModifiedBy.Name : null
                ));
            }

        } catch (Exception e) {
            System.debug('Error in getFiles: ' + e.getMessage());
            throw new AuraHandledException('Unable to fetch files. Please contact support.');
        }

        return files;
    }


    @AuraEnabled
    public static void addFile(String recordId) {
        if (String.isBlank(recordId)) {
            throw new AuraHandledException('Record ID is required to add a file.');
        }

        try {
            ContentDocument contentDoc = [
                SELECT Id
                FROM ContentDocument
                WHERE Title = 'Sample File'
                LIMIT 1
            ];

            if (contentDoc == null) {
                throw new AuraHandledException('Sample File does not exist.');
            }

            ContentDocumentLink contentLink = new ContentDocumentLink(
                LinkedEntityId = recordId,
                ContentDocumentId = contentDoc.Id,
                ShareType = 'V'
            );
            insert contentLink;

        } catch (Exception e) {
            System.debug('Error in addFile: ' + e.getMessage());
            throw new AuraHandledException('Error adding file: ' + e.getMessage());
        }
    }

    @AuraEnabled
public static Map<String, Object> updateFiles(List<FileWrapper> updatedFiles) {
    System.debug('Received updatedFiles: ' + JSON.serialize(updatedFiles));

    Map<String, Object> result = new Map<String, Object>();
    List<String> successIds = new List<String>();
    Map<String, String> errors = new Map<String, String>();

    if (updatedFiles == null || updatedFiles.isEmpty()) {
        throw new AuraHandledException('No files provided for update.');
    }

    try {
        List<ContentVersion> versionsToUpdate = new List<ContentVersion>();

        for (FileWrapper file : updatedFiles) {
            if (String.isNotBlank(file.id)) {
                try {
                    // Query the existing ContentVersion to avoid overwriting unintended fields
                    ContentVersion existingVersion = [
                        SELECT Id, Title, Description, Document_Type__c
                        FROM ContentVersion
                        WHERE Id = :file.id
                        LIMIT 1
                    ];

                    // Update fields only if they are provided (non-null)
                    if (String.isNotBlank(file.title)) {
                        existingVersion.Title = file.title;
                    }
                    if (String.isNotBlank(file.description)) {
                        existingVersion.Description = file.description;
                    }
                    if (String.isNotBlank(file.documentType)) {
                        existingVersion.Document_Type__c = file.documentType;
                    }

                    versionsToUpdate.add(existingVersion);
                } catch (QueryException qe) {
                    errors.put(file.id, 'ContentVersion not found for provided ID.');
                }
            } else {
                errors.put('Missing ID', 'File ID is required for updates.');
            }
        }

        // Perform the update
        if (!versionsToUpdate.isEmpty()) {
            Database.SaveResult[] saveResults = Database.update(versionsToUpdate, false);

            for (Integer i = 0; i < saveResults.size(); i++) {
                if (saveResults[i].isSuccess()) {
                    successIds.add(versionsToUpdate[i].Id);
                } else {
                    String errorMessage = '';
                    for (Database.Error err : saveResults[i].getErrors()) {
                        errorMessage += err.getMessage() + ' ';
                    }
                    errors.put(versionsToUpdate[i].Id, errorMessage.trim());
                }
            }
        }
    } catch (Exception e) {
        System.debug('Error in updateFiles: ' + e.getMessage());
        throw new AuraHandledException('Unable to update files: ' + e.getMessage());
    }

    result.put('successIds', successIds);
    result.put('errors', errors);
    return result;
}

    // Wrapper class to pass file data
    public class FileWrapper {
        @AuraEnabled public String id; // ContentVersion ID
        @AuraEnabled public String contentDocumentId; // ContentDocument ID
        @AuraEnabled public String title; // Editable field
        @AuraEnabled public Decimal size; // Optional
        @AuraEnabled public DateTime lastModified; // Optional
        @AuraEnabled public String fileType; // Optional
        @AuraEnabled public String description; // Editable field
        @AuraEnabled public String documentType; // Editable field
        @AuraEnabled public String lastModifiedBy; // Optional

        // Default constructor
        public FileWrapper() {}

        // Full constructor
        public FileWrapper(String id, String contentDocumentId, String title, Decimal size, DateTime lastModified, String fileType, String description, String documentType, String lastModifiedBy) {
            this.id = id;
            this.contentDocumentId = contentDocumentId;
            this.title = title;
            this.size = size;
            this.lastModified = lastModified;
            this.fileType = fileType;
            this.description = description;
            this.documentType = documentType;
            this.lastModifiedBy = lastModifiedBy;
        }
    }
}
