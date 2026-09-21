/**
 * UI5 Controller Handler Pattern
 * Separate business logic from controllers into Handler classes.
 *
 * CONVENTION:
 * - Place in webapp/controller/{Domain}/Handler/ folder
 * - Handlers are plain objects with static-like functions
 * - First param is always `oController` (the calling controller instance)
 * - Use DTOs and UICommon utilities
 * - Controllers call: `MyHandler.fnHandleAction(this, eventData)`
 *
 * WHY: Controllers in large UI5 apps can grow to 100K+ LOC.
 * Handlers keep controllers thin. Each handler owns one concern.
 */
sap.ui.define(
    [
        "sap/m/MessageBox",
        "ns/api/DTO",
        "ns/utils/UICommon"
    ],
    function (MessageBox, DTO, UICommon) {
        "use strict";
        return {
            /**
             * Handles creating a new record from a template.
             * @param {sap.ui.core.mvc.Controller} oController - The calling controller
             * @param {Object} oTemplateData - Template data to clone from
             * @returns {Object} The cloned entity data
             */
            fnHandleCreateFromTemplate: function (oController, oTemplateData) {
                try {
                    const oCreateData = {
                        ID: UICommon.fnGenUUID(),
                        name: oTemplateData.name,
                        status: "Draft"
                    };
                    return oCreateData;
                } catch (error) {
                    console.error("MyHandler - fnHandleCreateFromTemplate - Error:", error);
                    MessageBox.error(oController.getText("generalTechnicalIssue"));
                    return null;
                }
            },

            /**
             * Handles filter bar search.
             * @param {sap.ui.core.mvc.Controller} oController
             * @param {sap.ui.base.Event} oEvent
             */
            fnHandleSearch: function (oController, oEvent) {
                try {
                    const aFilters = [];
                    // Build filters from oEvent source
                    oController.getModel().read("/MyEntities", {
                        filters: aFilters,
                        success: function (data) {
                            // Process results
                        }
                    });
                } catch (error) {
                    console.error("MyHandler - fnHandleSearch - Error:", error);
                    MessageBox.error(oController.getText("generalTechnicalIssue"));
                }
            }
        };
    }
);
