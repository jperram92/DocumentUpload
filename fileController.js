import { LightningElement, wire, api, track } from 'lwc';
import getFiles from '@salesforce/apex/FileController.getFiles';
import updateFiles from '@salesforce/apex/FileController.updateFiles';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class FileTable extends LightningElement {
    @api recordId; // The record ID of the parent object
    @track files = []; // Holds the data for the table
    @track originalFiles = []; // Backup for filtering and sorting
    @track draftValues = []; // Holds draft values during inline editing
    wiredResult; // Stores the wired result for refresh
    sortBy = 'title'; // Default sort column
    sortDirection = 'asc'; // Default sort direction

    // Define columns
    columns = [
        { label: 'Title', fieldName: 'title', type: 'text', editable: true, sortable: true },
        { label: 'Document Type', fieldName: 'documentType', type: 'text', editable: true, sortable: true },
        { label: 'Description', fieldName: 'description', type: 'text', editable: true, sortable: true },
        { label: 'Last Modified', fieldName: 'lastModified', type: 'date', sortable: true },
        { label: 'Last Modified By', fieldName: 'lastModifiedBy', type: 'text', sortable: true },
        {
            label: 'File Type',
            fieldName: 'fileType',
            type: 'text',
            sortable: true,
            cellAttributes: {
                iconName: { fieldName: 'icon' },
                iconPosition: 'left',
            },
        },
        { label: 'Size (KB)', fieldName: 'size', type: 'number', sortable: true },
        {
            type: 'action',
            typeAttributes: {
                rowActions: [
                    { label: 'Preview', name: 'preview' },
                    { label: 'Download', name: 'download' },
                    { label: 'Delete', name: 'delete' },
                ],
            },
        },
    ];

    // Fetch data from the Apex controller
    @wire(getFiles, { objectId: '$recordId' })
    wiredFiles(result) {
        this.wiredResult = result; // Store the result for refresh
        const { error, data } = result;

        if (data) {
            try {
                console.log('Files fetched successfully:', data);
                this.originalFiles = data.map((file) => ({
                    id: file.id,
                    title: file.title,
                    size: (file.size / 1024).toFixed(2), // Convert bytes to KB
                    lastModified: file.lastModified,
                    fileType: file.fileType,
                    description: file.description,
                    documentType: file.documentType,
                    lastModifiedBy: file.lastModifiedBy,
                    icon: this.getFileIcon(file.fileType), // Determine file icon
                }));
                this.files = [...this.originalFiles];
            } catch (error) {
                console.error('Error processing files:', error);
                this.showToast('Error', 'An error occurred while processing files.', 'error');
            }
        } else if (error) {
            console.error('Error fetching files:', error);
            this.showToast('Error', 'Unable to fetch files. Please try again.', 'error');
        }
    }

    // Handle inline editing save
    handleSave(event) {
        const updatedFields = event.detail.draftValues;
        console.log('Draft values to save:', updatedFields);

        if (!updatedFields || updatedFields.length === 0) {
            this.showToast('Warning', 'No changes detected to save.', 'warning');
            return;
        }

        updateFiles({ updatedFiles: updatedFields })
            .then(() => {
                this.draftValues = []; // Clear draft values after successful update
                this.showToast('Success', 'Files updated successfully.', 'success');
                return refreshApex(this.wiredResult); // Refresh data
            })
            .catch((error) => {
                console.error('Error updating files:', error);
                this.showToast('Error', 'Unable to save changes. Please try again.', 'error');
            });
    }

    // Handle search functionality
    handleSearch(event) {
        const searchKey = event.target.value.toLowerCase();
        console.log('Search Key:', searchKey);

        try {
            if (this.originalFiles && this.originalFiles.length > 0) {
                this.files = this.originalFiles.filter((file) =>
                    file.title.toLowerCase().includes(searchKey)
                );
            }
        } catch (error) {
            console.error('Error during search:', error);
            this.showToast('Error', 'An error occurred during search. Please try again.', 'error');
        }
    }

    // Handle column sorting
    updateColumnSorting(event) {
        try {
            this.sortBy = event.detail.fieldName;
            this.sortDirection = event.detail.sortDirection;
            this.files = [...this.sortData(this.files, this.sortBy, this.sortDirection)];
        } catch (error) {
            console.error('Error sorting columns:', error);
            this.showToast('Error', 'Unable to sort columns. Please try again.', 'error');
        }
    }

    // Sort data based on column and direction
    sortData(data, fieldName, sortDirection) {
        const parseData = [...data];
        const key = (a) => a[fieldName];

        parseData.sort((a, b) => {
            const aVal = key(a) || '';
            const bVal = key(b) || '';
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        });

        return sortDirection === 'asc' ? parseData : parseData.reverse();
    }

    handlePreview(row) {
        const fileId = row.id; // Use the ContentDocumentId
        if (!fileId) {
            this.showToast('Error', 'File ID is missing. Unable to preview.', 'error');
            return;
        }
    
        const previewUrl = `/sfc/servlet.shepherd/document/download/${fileId}`;
        window.open(previewUrl, '_blank'); // Open in a new tab
        this.showToast('Success', 'Preview opened in a new tab.', 'success');
    }

    // Handle row-level actions (Preview, Download, Delete)
    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        try {
            switch (actionName) {
                case 'preview':
                    console.log('Preview file:', row);
                    this.handlePreview(row); // Call handlePreview
                    //this.showToast('Info', 'Preview functionality is not yet implemented.', 'info');
                    break;
                case 'download':
                    console.log('Download file:', row);
                    this.showToast('Info', 'Download functionality is not yet implemented.', 'info');
                    break;
                case 'delete':
                    console.log('Delete file:', row);
                    this.handleDelete(row);
                    break;
                default:
                    console.error('Unknown action:', actionName);
            }
        } catch (error) {
            console.error('Error handling row action:', error);
            this.showToast('Error', `An error occurred while handling ${actionName}.`, 'error');
        }
    }

    // Handle file deletion
    handleDelete(row) {
        console.log('Delete file:', row);
        // Add logic for deletion (e.g., calling an Apex method to delete the file)
        this.showToast('Info', 'Delete functionality is currently a placeholder.', 'info');
    }

    // Determine file icon based on file type
    getFileIcon(fileType) {
        const icons = {
            PDF: 'doctype:pdf',
            IMAGE: 'doctype:image',
            EXCEL: 'doctype:excel',
            WORD: 'doctype:word',
        };
        return icons[fileType?.toUpperCase()] || 'doctype:unknown';
    }

    // Show toast messages for user feedback
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant,
        });
        this.dispatchEvent(event);
    }
}
