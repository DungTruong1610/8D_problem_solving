package cnma.{{module_name}}.infrastructure.messaging;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import com.sap.cds.services.messaging.EventContext;
import com.sap.cds.services.messaging.MessagingService;
import java.util.Map;
import java.util.HashMap;

//#TICKET_NO (Leo): Messaging service for event mesh
@Slf4j
@Service
public class MessagePublisher {

    private final MessagingService messagingService;
    private String topic;

    public MessagePublisher(MessagingService messagingService) {
        this.messagingService = messagingService;
    }

    public MessagePublisher(String topic) {
        this.messagingService = null;
        this.topic = topic;
    }

    /**
     * Publish message to event mesh topic.
     */
    public void publish(Object message) {
        try {
            if (topic == null || topic.isEmpty()) {
                throw new IllegalStateException("Topic not set");
            }

            log.info("Publishing to topic {}: {}", topic, message);

            if (messagingService != null) {
                messagingService.emit(topic, message);
            } else {
                log.warn("MessagingService not available, message not published");
            }
        } catch (Exception e) {
            log.error("Failed to publish to topic: {}", topic, e);
            throw new RuntimeException("Message publish failed: " + e.getMessage(), e);
        }
    }

    /**
     * Publish to specific topic.
     */
    public void publishToTopic(String topicName, Object message) {
        try {
            log.info("Publishing to topic {}: {}", topicName, message);

            if (messagingService != null) {
                messagingService.emit(topicName, message);
            }
        } catch (Exception e) {
            log.error("Failed to publish to topic: {}", topicName, e);
            throw new RuntimeException("Message publish failed: " + e.getMessage(), e);
        }
    }
}