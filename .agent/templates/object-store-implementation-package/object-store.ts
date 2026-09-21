import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import cds from '@sap/cds';

const LOG = cds.log('object-store');

/**
 * Object Store Provider
 * 
 * Abstraction layer for SAP BTP Object Store (AWS S3, Azure Blob, GCP Bucket).
 * Provides pre-signed URLs for direct frontend uploads/downloads.
 * 
 * For local development, use MinIO (S3-compatible):
 * docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"
 */
export class ObjectStoreProvider {
    private static client: S3Client | null = null;
    private static bucket: string = '';
    private static initialized: boolean = false;

    /**
     * Initialize the provider with credentials.
     * In BTP, credentials come from VCAP_SERVICES.
     * For local dev, use environment variables.
     */
    static initialize(credentials?: {
        region?: string;
        access_key_id?: string;
        secret_access_key?: string;
        bucket?: string;
        endpoint?: string;
    }): void {
        // Try to get credentials from environment or VCAP_SERVICES
        const config = credentials || this.getCredentialsFromEnv();

        if (!config.bucket) {
            LOG.warn('No bucket configured. Attachment upload/download will fail.');
            return;
        }

        const clientConfig: any = {
            region: config.region || 'us-east-1',
            credentials: {
                accessKeyId: config.access_key_id || '',
                secretAccessKey: config.secret_access_key || ''
            }
        };

        // For MinIO/local development
        if (config.endpoint) {
            clientConfig.endpoint = config.endpoint;
            clientConfig.forcePathStyle = true;
        }

        this.client = new S3Client(clientConfig);
        this.bucket = config.bucket;
        this.initialized = true;

        LOG.info(`Initialized with bucket: ${this.bucket}`);
    }

    /**
     * Get credentials from environment variables or VCAP_SERVICES
     */
    private static getCredentialsFromEnv(): {
        region?: string;
        access_key_id?: string;
        secret_access_key?: string;
        bucket?: string;
        endpoint?: string;
    } {
        // Check for VCAP_SERVICES (BTP environment)
        if (process.env.VCAP_SERVICES) {
            try {
                const vcap = JSON.parse(process.env.VCAP_SERVICES);
                const objectstore = vcap['objectstore']?.[0]?.credentials;
                if (objectstore) {
                    return {
                        region: objectstore.region,
                        access_key_id: objectstore.access_key_id,
                        secret_access_key: objectstore.secret_access_key,
                        bucket: objectstore.bucket
                    };
                }
            } catch (e) {
                LOG.error('Failed to parse VCAP_SERVICES:', e);
            }
        }

        // Fall back to environment variables (local dev with MinIO)
        return {
            region: process.env.S3_REGION || 'us-east-1',
            access_key_id: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
            secret_access_key: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
            bucket: process.env.S3_BUCKET || 'attachments',
            endpoint: process.env.S3_ENDPOINT || undefined
        };
    }

    /**
     * Check if the provider is initialized
     */
    static isInitialized(): boolean {
        return this.initialized && this.client !== null;
    }

    /**
     * Generate a pre-signed URL for uploading a file
     */
    static async getUploadUrl(contentId: string, mimeType: string): Promise<string> {
        if (!this.client || !this.bucket) {
            throw new Error('ObjectStoreProvider not initialized');
        }

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: contentId,
            ContentType: mimeType
        });

        return getSignedUrl(this.client, command, { expiresIn: 3600 });
    }

    /**
     * Generate a pre-signed URL for downloading a file
     */
    static async getDownloadUrl(contentId: string): Promise<string> {
        if (!this.client || !this.bucket) {
            throw new Error('ObjectStoreProvider not initialized');
        }

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: contentId
        });

        return getSignedUrl(this.client, command, { expiresIn: 3600 });
    }

    /**
     * Delete a file from the object store
     */
    static async delete(contentId: string): Promise<void> {
        if (!this.client || !this.bucket) {
            LOG.warn('Not initialized, skipping delete');
            return;
        }

        try {
            await this.client.send(new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: contentId
            }));
            LOG.info(`Deleted: ${contentId}`);
        } catch (error) {
            LOG.error(`Failed to delete ${contentId}:`, error);
        }
    }
}
