package cnma.{{module_name}}.infrastructure.middleware;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * BTPServiceLoggingMiddleware - HTTP call logging for SAP BTP service integrations.
 * ISP: Only handles BTP service call logging, not business logic.
 */
@Slf4j
@Component
public class BTPServiceLoggingMiddleware {

    private static final Map<String, ServiceCallLog> activeLogs = new ConcurrentHashMap<>();

    /**
     * Log BTP service call start.
     */
    public static ServiceCallLog logServiceCallStart(
            String destinationName,
            String method,
            String url,
            Object data
    ) {
        ServiceCallLog callLog = new ServiceCallLog();
        callLog.setDestinationName(destinationName);
        callLog.setMethod(method);
        callLog.setUrl(url);
        callLog.setStartTime(Instant.now().toEpochMilli());
        callLog.setHasData(data != null);
        callLog.setDataSize(data != null ? estimateDataSize(data) : 0);

        log.info("BTP service call started - destination: {}, method: {}, url: {}",
                destinationName, method, url);

        return callLog;
    }

    /**
     * Log successful BTP service call.
     */
    public static void logServiceCallSuccess(ServiceCallLog callLog, int statusCode, Object responseData) {
        long endTime = Instant.now().toEpochMilli();
        long duration = endTime - callLog.getStartTime();

        callLog.setEndTime(endTime);
        callLog.setDuration(duration);
        callLog.setStatusCode(statusCode);
        callLog.setSuccess(true);
        callLog.setResponseSize(responseData != null ? estimateDataSize(responseData) : 0);

        log.info("BTP service call completed - destination: {}, status: {}, duration: {}ms",
                callLog.getDestinationName(), statusCode, duration);

        activeLogs.remove(callLog.getCallId());
    }

    /**
     * Log failed BTP service call.
     */
    public static void logServiceCallError(ServiceCallLog callLog, Exception error, Integer statusCode) {
        long endTime = Instant.now().toEpochMilli();
        long duration = endTime - callLog.getStartTime();

        callLog.setEndTime(endTime);
        callLog.setDuration(duration);
        callLog.setStatusCode(statusCode);
        callLog.setSuccess(false);
        callLog.setError(error != null ? error.getMessage() : "Unknown error");

        log.error("BTP service call failed - destination: {}, status: {}, duration: {}ms, error: {}",
                callLog.getDestinationName(), statusCode, duration, error != null ? error.getMessage() : "Unknown");

        activeLogs.remove(callLog.getCallId());
    }

    /**
     * Log destination retrieval.
     */
    public static void logDestinationRetrieval(String destinationName, boolean success, Exception error) {
        if (success) {
            log.info("BTP destination retrieved: {}", destinationName);
        } else {
            log.error("BTP destination retrieval failed: {}, error: {}",
                    destinationName, error != null ? error.getMessage() : "Unknown");
        }
    }

    private static int estimateDataSize(Object data) {
        try {
            return data.toString().length();
        } catch (Exception e) {
            return 0;
        }
    }

    @Data
    public static class ServiceCallLog {
        private String callId;
        private String destinationName;
        private String method;
        private String url;
        private long startTime;
        private long endTime;
        private long duration;
        private int statusCode;
        private boolean success;
        private boolean hasData;
        private int dataSize;
        private int responseSize;
        private String error;

        public ServiceCallLog() {
            this.callId = java.util.UUID.randomUUID().toString();
        }
    }
}