import { LightningElement, wire, api, track } from 'lwc';
import getFiles from '@salesforce/apex/FileController.getFiles';
import updateFiles from '@salesforce/apex/FileController.updateFiles';
import addFile from '@salesforce/apex/FileController.addFile';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class FileTable extends LightningElement {
    @api recordId; // Parent record ID
    @track files = []; // Holds the file data
    @track draftValues = []; // Draft values for inline editing
    wiredFilesResult; // Stores wired result for refresh
    sortBy = 'title'; // Default sort column
    sortDirection = 'asc'; // Default sort direction

    // Table column definitions
    columns = [
        { label: 'Title', fieldName: 'Title', type: 'text', editable: true, sortable: true },
        { label: 'Document Type', fieldName: 'Document_Type__c', type: 'text', editable: true, sortable: true },
        { label: 'Description', fieldName: 'Description', type: 'text', editable: true, sortable: true },
        { label: 'Last Modified', fieldName: 'LastModifiedDate', type: 'date', sortable: true },
        { label: 'Last Modified By', fieldName: 'LastModifiedBy.Name', type: 'text', sortable: true },
        {
            label: 'File Type',
            fieldName: 'FileType',
            type: 'text',
            sortable: true,
            cellAttributes: {
                iconName: { fieldName: 'icon' },
                iconPosition: 'left',
            },
        },
        { label: 'Size (KB)', fieldName: 'ContentSize', type: 'number', sortable: true },
        {
            type: 'action',
            typeAttributes: {
                rowActions: [
                    { label: 'Preview', name: 'preview' },
                    { label: 'Download', name: 'download' },
                ],
            },
        },
    ];

    // Fetch data from Apex
    @wire(getFiles, { objectId: '$recordId' })
    wiredFiles(result) {
        this.wiredFilesResult = result; // Store result for refresh
        const { data, error } = result;

        if (data) {
            this.files = data.map((file) => ({
                ...file,
                ContentSize: file.ContentSize ? (file.ContentSize / 1024).toFixed(2) : null, // Convert size to KB
                icon: this.getFileIcon(file.FileType), // Determine file icon
            }));
        } else if (error) {
            this.showToast('Error', 'Unable to fetch files.', 'error');
            console.error('Error fetching files:', error);
        }
    }

    // Handle inline edit save
    handleSave(event) {
        const draftValues = event.detail.draftValues;
        console.log('Draft Values:', draftValues);

        updateFiles({ updatedFiles: draftValues })
            .then((result) => {
                console.log('Update Result:', result);

                const { successIds, errors } = result;
                if (successIds.length > 0) {
                    this.showToast('Success', `${successIds.length} file(s) updated successfully.`, 'success');
                }

                if (Object.keys(errors).length > 0) {
                    const errorMessages = Object.entries(errors)
                        .map(([id, message]) => `File ID ${id}: ${message}`)
                        .join(', ');
                    this.showToast('Warning', `Some updates failed: ${errorMessages}`, 'warning');
                }

                this.draftValues = [];
                return refreshApex(this.wiredFilesResult);
            })
            .catch((error) => {
                console.error('Error updating files:', error);
                this.showToast('Error', 'Unable to save changes. Please try again.', 'error');
            });
    }

    // Add a file and refresh
    handleAddFile() {
        addFile({ recordId: this.recordId })
            .then(() => {
                this.showToast('Success', 'File added successfully.', 'success');
                return refreshApex(this.wiredFilesResult);
            })
            .catch((error) => {
                console.error('Error adding file:', error);
                this.showToast('Error', 'Unable to add file. Please try again.', 'error');
            });
    }

    // Handle row actions
    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        if (actionName === 'preview') {
            this.handlePreview(row.Id);
        } else if (actionName === 'download') {
            this.handleDownload(row.Id);
        } else {
            console.warn(`Action "${actionName}" is not implemented.`);
        }
    }

    // Handle file preview
    handlePreview(fileId) {
        const previewUrl = `/sfc/servlet.shepherd/document/download/${fileId}`;
        window.open(previewUrl, '_blank');
    }

    // Handle file download
    handleDownload(fileId) {
        const downloadUrl = `/sfc/servlet.shepherd/document/download/${fileId}`;
        window.open(downloadUrl, '_self');
    }

    // File icon determination
    getFileIcon(fileType) {
        const icons = {
            PDF: 'doctype:pdf',
            IMAGE: 'doctype:image',
            EXCEL: 'doctype:excel',
            WORD: 'doctype:word',
        };
        return icons[fileType?.toUpperCase()] || 'doctype:unknown';
    }

    // Toast utility
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant,
            })
        );
    }
}
