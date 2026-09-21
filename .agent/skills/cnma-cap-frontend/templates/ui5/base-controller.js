sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/model/Filter",
        "sap/ui/core/BusyIndicator",
        "sap/ui/model/FilterOperator",
        "sap/ui/core/format/DateFormat",
        "sap/m/MessageBox",
        "sap/ui/core/UIComponent"
    ],
    function (Controller, Filter, BusyIndicator, FilterOperator, DateFormat, MessageBox, UIComponent) {
        "use strict";
        return Controller.extend(
            "ns.controller.BaseController",
            {
                /**
                 * Convenience method for accessing the router.
                 * @public
                 * @returns {sap.ui.core.routing.Router} the router for this component
                 */
                getRouter: function () {
                    return UIComponent.getRouterFor(this);
                },

                /**
                 * Convenience method for getting model.
                 * @public
                 * @returns {Object} the object model
                 */
                getModel: function (sName) {
                    return this.getView().getModel(sName);
                },

                /**
                 * Convenience method for setting model.
                 * @public
                 * @returns {Object} the object model
                 */
                setModel: function (oModel, sName) {
                    return this.getView().setModel(oModel, sName);
                },

                /**
                 * Convenience method for getting i18n resource bundle.
                 * @public
                 * @returns {Object} the object i18n model
                 */
                getResourceBundle: function () {
                    try {
                        return this.getOwnerComponent().getModel("i18n").getResourceBundle();
                    } catch (error) {
                        console.log("BaseController - getResourceBundle - Error:", error);
                        MessageBox.error("Something went wrong! Please contact technical support.");
                    }
                },

                /**
                 * Turn off the loading icon - hiding busy indicator
                 */
                hideBusy: function () {
                    BusyIndicator.hide();
                },

                /**
                 * Turn on the loading icon - showing busy indicator
                 */
                showBusy: function () {
                    BusyIndicator.show(0);
                },

                getText: function (sKey, aParams = []) {
                    return this.getResourceBundle().getText(sKey, aParams);
                },

                navTo: function (sRoute, oParams = {}, bReplace = false) {
                    this.getRouter().navTo(sRoute, oParams, bReplace);
                }
            }
        );
    }
);
