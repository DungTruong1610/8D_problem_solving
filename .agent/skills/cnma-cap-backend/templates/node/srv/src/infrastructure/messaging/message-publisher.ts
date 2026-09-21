import cds from '@sap/cds';

/**
 * MessagePublisher - SAP Event Mesh / Messaging integration.
 * Handles publish/subscribe for async business events.
 */
export class MessagePublisher {
    private topic: string;

    constructor(topic: string) {
        this.topic = topic;
    }

    /**
     * Publish message to event mesh.
     */
    async publish(message: any): Promise<void> {
        try {
            // Using CDS events for in-process messaging
            // For external Event Mesh, use @sap/event-queue client
            await cds.emit(this.topic, message);
            cds.log.info(`[MessagePublisher] Published to ${this.topic}:`, message);
        } catch (error) {
            cds.log.error(`[MessagePublisher] Failed to publish to ${this.topic}:`, error);
            throw error;
        }
    }

    /**
     * Subscribe to topic (in cds.on handlers).
     */
    static subscribe(topic: string, handler: (message: any) => Promise<void>): void {
        cds.on(topic, async (msg: any) => {
            await handler(msg);
        });
    }
}

/**
 * Predefined topics following convention: {namespace}.{feature}.{event}
 */
export const TOPICS = {
    NOTIFICATION_CREATED: 'cnma.notification.created',
    NOTIFICATION_UPDATED: 'cnma.notification.updated',
    NOTIFICATION_DELETED: 'cnma.notification.deleted',
    APPROVAL_REQUIRED: 'cnma.approval.required',
    APPROVAL_COMPLETED: 'cnma.approval.completed',
};