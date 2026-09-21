package cnma.{{module_name}}.infrastructure.integration.btp;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.HashMap;

/**
 * DestinationCloudService - SAP BTP Destination Service integration.
 * Handles destination retrieval, authentication, and HTTP calls.
 * ISP: Only handles BTP destination operations.
 */
@Slf4j
@Service
public class DestinationCloudService {

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    private String destinationName;

    public DestinationCloudService() {
    }

    public DestinationCloudService(String destinationName) {
        this.destinationName = destinationName;
    }

    public String getDestinationName() {
        return destinationName;
    }

    /**
     * Get BTP destination configuration.
     * Note: In CAP Java, destinations are typically configured via @Destination annotation.
     * This method is for runtime destination lookups.
     */
    public Map<String, Object> getBTPDestination() {
        try {
            if (destinationName == null || destinationName.isEmpty()) {
                log.warn("Destination name not set");
                return null;
            }

            log.info("Retrieving BTP destination: {}", destinationName);

            Map<String, Object> destinationConfig = new HashMap<>();
            destinationConfig.put("name", destinationName);
            destinationConfig.put("url", getDestinationUrl());

            return destinationConfig;
        } catch (Exception e) {
            log.error("Failed to get destination: {}", destinationName, e);
            return null;
        }
    }

    private String getDestinationUrl() {
        return "";
    }

    /**
     * Execute HTTP GET request to destination.
     */
    public <T> T get(String servicePath, String requestPath, Class<T> responseType) {
        return sendRequest("GET", servicePath, requestPath, null, responseType);
    }

    /**
     * Execute HTTP POST request to destination.
     */
    public <T> T post(String servicePath, String requestPath, Object payload, Class<T> responseType) {
        return sendRequest("POST", servicePath, requestPath, payload, responseType);
    }

    /**
     * Execute HTTP PUT request to destination.
     */
    public <T> T put(String servicePath, String requestPath, Object payload, Class<T> responseType) {
        return sendRequest("PUT", servicePath, requestPath, payload, responseType);
    }

    /**
     * Execute HTTP DELETE request to destination.
     */
    public <T> T delete(String servicePath, String requestPath, Class<T> responseType) {
        return sendRequest("DELETE", servicePath, requestPath, null, responseType);
    }

    private <T> T sendRequest(String method, String servicePath, String requestPath, Object payload, Class<T> responseType) {
        Map<String, Object> destination = getBTPDestination();
        if (destination == null) {
            throw new RuntimeException("Destination not found: " + destinationName);
        }

        String baseUrl = (String) destination.get("url");
        String endpoint = servicePath + requestPath;
        String url = baseUrl.endsWith("/") ? baseUrl + requestPath : baseUrl + requestPath;

        log.info("Executing {} request to {}", method, url);

        try {
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(60));

            requestBuilder.header("Content-Type", "application/json");
            requestBuilder.header("Accept", "application/json");

            switch (method) {
                case "GET":
                    requestBuilder.GET();
                    break;
                case "POST":
                    requestBuilder.POST(HttpRequest.BodyPublishers.ofString(toJson(payload)));
                    break;
                case "PUT":
                    requestBuilder.PUT(HttpRequest.BodyPublishers.ofString(toJson(payload)));
                    break;
                case "DELETE":
                    requestBuilder.DELETE();
                    break;
            }

            HttpResponse<String> response = HTTP_CLIENT.send(
                    requestBuilder.build(),
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() >= 400) {
                throw new RuntimeException("HTTP " + response.statusCode() + ": " + response.body());
            }

            return parseResponse(response.body(), responseType);
        } catch (Exception e) {
            log.error("Request failed: {} {}", method, url, e);
            throw new RuntimeException("BTP service call failed: " + e.getMessage(), e);
        }
    }

    private String toJson(Object obj) {
        if (obj == null) return "{}";
        return obj.toString();
    }

    @SuppressWarnings("unchecked")
    private <T> T parseResponse(String json, Class<T> responseType) {
        if (responseType == String.class) {
            return (T) json;
        }
        return null;
    }
}