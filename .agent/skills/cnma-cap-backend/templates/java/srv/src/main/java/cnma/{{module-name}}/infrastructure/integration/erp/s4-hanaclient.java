package cnma.{{module_name}}.infrastructure.integration.erp;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * S4HANAClient - SAP S/4HANA ERP integration.
 * ISP: Only handles S/4HANA-specific API operations.
 */
@Slf4j
@Service
public class S4HANAClient {

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    private final String baseUrl;
    private final String authToken;

    public S4HANAClient(String baseUrl, String authToken) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
    }

    private Map<String, String> getHeaders() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "application/json");
        headers.put("Authorization", "Bearer " + authToken);
        headers.put("Accept", "application/json");
        return headers;
    }

    private <T> T request(String path, String method, Object body, Class<T> responseType) {
        try {
            String url = baseUrl + path;
            log.info("S/4HANA API call: {} {}", method, url);

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(60));

            getHeaders().forEach(builder::header);

            switch (method) {
                case "GET":
                    builder.GET();
                    break;
                case "POST":
                    builder.POST(HttpRequest.BodyPublishers.ofString(toJson(body)));
                    break;
                case "PUT":
                    builder.PUT(HttpRequest.BodyPublishers.ofString(toJson(body)));
                    break;
            }

            HttpResponse<String> response = HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                log.error("S/4HANA API error: {} - {}", response.statusCode(), response.body());
                throw new RuntimeException("S/4HANA API error: " + response.statusCode());
            }

            return parseResponse(response.body(), responseType);
        } catch (Exception e) {
            log.error("S/4HANA request failed: {}", path, e);
            throw new RuntimeException("S/4HANA API call failed: " + e.getMessage(), e);
        }
    }

    private String toJson(Object obj) {
        if (obj == null) return "{}";
        return obj.toString();
    }

    @SuppressWarnings("unchecked")
    private <T> T parseResponse(String json, Class<T> responseType) {
        if (responseType == String.class || responseType == Object.class) {
            return (T) json;
        }
        return null;
    }

    // ===== Business Partner APIs =====

    /**
     * Get business partner by ID.
     */
    public Map<String, Object> getBusinessPartner(String bpId) {
        String path = "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner('" + bpId + "')";
        return request(path, "GET", null, Map.class);
    }

    /**
     * Get business partner contact.
     */
    public Map<String, Object> getBusinessPartnerContact(String bpId) {
        String path = "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartnerContact('" + bpId + "')";
        return request(path, "GET", null, Map.class);
    }

    /**
     * Get business partner address.
     */
    public Map<String, Object> getBusinessPartnerAddress(String addressId) {
        String path = "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartnerAddress(ID='" + addressId + "')";
        return request(path, "GET", null, Map.class);
    }

    // ===== Sales APIs =====

    /**
     * Create sales order in S/4HANA.
     */
    public Map<String, Object> createSalesOrder(Map<String, Object> orderData) {
        String path = "/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder";
        return request(path, "POST", orderData, Map.class);
    }

    /**
     * Get sales order by ID.
     */
    public Map<String, Object> getSalesOrder(String orderId) {
        String path = "/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder('" + orderId + "')";
        return request(path, "GET", null, Map.class);
    }

    // ===== Material APIs =====

    /**
     * Get material details.
     */
    public Map<String, Object> getMaterial(String materialId) {
        String path = "/sap/opu/odata/sap/API_MATERIAL_SRV/A_Material('" + materialId + "')";
        return request(path, "GET", null, Map.class);
    }

    /**
     * Get material stock.
     */
    public Map<String, Object> getMaterialStock(String materialId, String plant) {
        String path = "/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MaterialStockDetails(Material='" + materialId + "',Plant='" + plant + "')";
        return request(path, "GET", null, Map.class);
    }
}