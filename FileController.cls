public with sharing class FileController {
    @AuraEnabled(cacheable=true)
    public static List<FileWrapper> getFiles(String objectId) {
        List<FileWrapper> files = new List<FileWrapper>();

        try {
            // Query ContentDocumentLink to fetch associated ContentDocumentIds
            List<ContentDocumentLink> links = [
                SELECT ContentDocumentId
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :objectId
            ];

            // Iterate through the links and fetch the latest ContentVersion for each document
            for (ContentDocumentLink link : links) {
                ContentVersion version = [
                    SELECT Id, Title, ContentSize, LastModifiedDate, FileType, Description, Document_Type__c, LastModifiedBy.Name
                    FROM ContentVersion
                    WHERE ContentDocumentId = :link.ContentDocumentId
                    ORDER BY LastModifiedDate DESC
                    LIMIT 1
                ];

                files.add(new FileWrapper(
                    version.Id,
                    version.Title,
                    version.ContentSize,
                    version.LastModifiedDate,
                    version.FileType,
                    version.Description,
                    version.Document_Type__c,
                    version.LastModifiedBy.Name
                ));
            }
        } catch (Exception e) {
            System.debug('Error in getFiles: ' + e.getMessage());
            throw new AuraHandledException('Unable to fetch files. Please contact support.');
        }

        return files;
    }

    @AuraEnabled
public static void updateFiles(List<FileWrapper> updatedFiles) {
    System.debug('updateFiles called with: ' + updatedFiles);

    if (updatedFiles == null || updatedFiles.isEmpty()) {
        throw new AuraHandledException('No files to update.');
    }

    try {
        // Extract IDs from updatedFiles
        Set<Id> contentVersionIds = new Set<Id>();
        for (FileWrapper file : updatedFiles) {
            if (file.id != null) {
                contentVersionIds.add(file.id);
            } else {
                System.debug('FileWrapper is missing ID: ' + file);
            }
        }
        System.debug('ContentVersion IDs to fetch: ' + contentVersionIds);

        // Fetch ContentVersion records in bulk
        Map<Id, ContentVersion> existingVersions = new Map<Id, ContentVersion>([
            SELECT Id, Title, Description, Document_Type__c
            FROM ContentVersion
            WHERE Id IN :contentVersionIds
        ]);
        System.debug('Fetched ContentVersion records: ' + existingVersions);

        List<ContentVersion> versionsToUpdate = new List<ContentVersion>();

        for (FileWrapper file : updatedFiles) {
            ContentVersion version = existingVersions.get(file.id);

            if (version != null) {
                System.debug('Updating ContentVersion: ' + version.Id);
                if (file.title != null) version.Title = file.title;
                if (file.description != null) version.Description = file.description;
                if (file.documentType != null) version.Document_Type__c = file.documentType;

                versionsToUpdate.add(version);
            } else {
                System.debug('No ContentVersion found for ID: ' + file.id);
            }
        }

        if (!versionsToUpdate.isEmpty()) {
            update versionsToUpdate;
            System.debug('Successfully updated ContentVersions: ' + versionsToUpdate);
        } else {
            System.debug('No versions to update.');
        }
    } catch (Exception e) {
        System.debug('Error in updateFiles: ' + e.getMessage());
        throw new AuraHandledException('Unable to update files. Please contact support.');
    }
}


public class FileWrapper {
    @AuraEnabled public String id;
    @AuraEnabled public String title;
    @AuraEnabled public Decimal size;
    @AuraEnabled public DateTime lastModified;
    @AuraEnabled public String fileType;
    @AuraEnabled public String description;
    @AuraEnabled public String documentType;
    @AuraEnabled public String lastModifiedBy;

    // No-argument constructor
    public FileWrapper() {}

    // Parameterized constructor
    public FileWrapper(String id, String title, Decimal size, DateTime lastModified, String fileType, String description, String documentType, String lastModifiedBy) {
        this.id = id;
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
