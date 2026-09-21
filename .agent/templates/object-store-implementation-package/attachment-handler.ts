import { cds, SELECT } from '../lib/db.ts';
import { ObjectStoreProvider } from '../lib/object-store.ts';

const LOG = cds.log('attachment-handler');

/**
 * Handles Attachment operations: upload/download URL generation, cleanup
 */
export class AttachmentHandler {

    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    /**
     * Register all attachment-related handlers
     */
    register() {
        const { Attachments } = this.srv.entities;

        // Generate upload URL
        this.srv.on('getUploadUrl', 'Attachments', this.onGetUploadUrl.bind(this));

        // Generate download URL
        this.srv.on('getDownloadUrl', 'Attachments', this.onGetDownloadUrl.bind(this));

        // Cleanup on delete
        this.srv.before('DELETE', 'Attachments', this.beforeDelete.bind(this));
    }

    /**
     * Generate a pre-signed URL for uploading a file to Object Store
     * Frontend calls this before uploading directly to S3
     */
    private async onGetUploadUrl(req: cds.Request) {
        const { fileName, mimeType } = req.data as { fileName: string; mimeType: string };

        if (!fileName) {
            return req.error(400, 'fileName is required');
        }

        if (!ObjectStoreProvider.isInitialized()) {
            return req.error(503, 'Object Store not configured. Set S3_BUCKET environment variable.');
        }

        // Generate unique content ID: UUID/filename
        const contentId = `${cds.utils.uuid()}/${fileName}`;

        try {
            const url = await ObjectStoreProvider.getUploadUrl(contentId, mimeType || 'application/octet-stream');

            LOG.info(`Generated upload URL for: ${contentId}`);

            return { contentId, url };
        } catch (error) {
            LOG.error('Failed to generate upload URL:', error);
            return req.error(500, 'Failed to generate upload URL');
        }
    }

    /**
     * Generate a pre-signed URL for downloading a file from Object Store
     */
    private async onGetDownloadUrl(req: cds.Request) {
        const { Attachments } = this.srv.entities;
        const param = req.params[0] as { ID: string };

        // Get the attachment to find contentId
        const attachment = await SELECT.one.from(Attachments, param.ID).columns('contentId', 'fileName');

        if (!attachment) {
            return req.error(404, 'Attachment not found');
        }

        if (!attachment.contentId) {
            return req.error(400, 'Attachment has no content');
        }

        if (!ObjectStoreProvider.isInitialized()) {
            return req.error(503, 'Object Store not configured');
        }

        try {
            const url = await ObjectStoreProvider.getDownloadUrl(attachment.contentId);

            LOG.info(`Generated download URL for: ${attachment.fileName}`);

            return url;
        } catch (error) {
            LOG.error('Failed to generate download URL:', error);
            return req.error(500, 'Failed to generate download URL');
        }
    }

    /**
     * Delete file from Object Store when attachment record is deleted
     */
    private async beforeDelete(req: cds.Request) {
        const { Attachments } = this.srv.entities;
        const param = req.params[0] as { ID: string };

        const attachment = await SELECT.one.from(Attachments, param.ID).columns('contentId');

        if (attachment?.contentId) {
            LOG.info(`Deleting from Object Store: ${attachment.contentId}`);
            await ObjectStoreProvider.delete(attachment.contentId);
        }
    }
}
