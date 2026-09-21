import { createLogger } from '../../../common/util/Logger';

const logger = createLogger('S4HANA');

/**
 * S4HANA Client - SAP S/4HANA ERP integration.
 * Provides methods for business partner, sales, and material operations.
 */
export class S4HANAClient {
    private baseUrl: string;
    private authToken: string;

    constructor(baseUrl: string, authToken: string) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
    }

    private get headers(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`,
        };
    }

    private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: { ...this.headers, ...options.headers },
        });

        if (!response.ok) {
            const error = await response.text();
            logger.error(`S/4HANA request failed: ${response.status}`, { path, error });
            throw new Error(`S/4HANA API error: ${response.status} - ${error}`);
        }

        return response.json();
    }

    // ===== Business Partner APIs =====

    /**
     * Get business partner by ID.
     */
    async getBusinessPartner(bpId: string): Promise<any> {
        return this.request(`/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner('${bpId}')`);
    }

    /**
     * Get business partner contact.
     */
    async getBusinessPartnerContact(bpId: string): Promise<any> {
        return this.request(`/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartnerContact('${bpId}')`);
    }

    /**
     * Get business partner address.
     */
    async getBusinessPartnerAddress(bpId: string): Promise<any> {
        return this.request(`/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartnerAddress(ID='${bpId}')`);
    }

    // ===== Sales APIs =====

    /**
     * Create sales order in S/4HANA.
     */
    async createSalesOrder(orderData: any): Promise<any> {
        return this.request('/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder', {
            method: 'POST',
            body: JSON.stringify(orderData),
        });
    }

    /**
     * Get sales order by ID.
     */
    async getSalesOrder(orderId: string): Promise<any> {
        return this.request(`/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder('${orderId}')`);
    }

    // ===== Material APIs =====

    /**
     * Get material details.
     */
    async getMaterial(materialId: string): Promise<any> {
        return this.request(`/sap/opu/odata/sap/API_MATERIAL_SRV/A_Material('${materialId}')`);
    }

    /**
     * Get material stock.
     */
    async getMaterialStock(materialId: string, plant: string): Promise<any> {
        return this.request(
            `/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MaterialStockDetails(Material='${materialId}',Plant='${plant}')`
        );
    }
}