sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/model/Filter",
        "sap/ui/core/BusyIndicator",
        "sap/ui/model/FilterOperator",
        "sap/ui/core/format/DateFormat",
        "cnma/template/ui5/utils/enum/AppRouteEnum",
        "sap/m/MessageBox",
        "cnma/template/ui5/utils/UICommon"
    ],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Filter, BusyIndicator, FilterOperator, DateFormat, AppRouteEnum, MessageBox, UICommon) {
        "use strict";
        return Controller.extend(
            "cnma.template.ui5.controller.BaseController",
            {
                MainAppRoute: AppRouteEnum,
                /**
                 * Convenience method for accessing the router.
                 * @public
                 * @returns {sap.ui.core.routing.Router} the router for this component
                 */
                getRouter: function () {
                    const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                    return oRouter;
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
                 * Convenience method for accessing the router.
                 * @public
                 * @returns {Object} the object model
                 */
                setModel: function (oModel, sName) {
                    return this.getView().setModel(oModel, sName);
                },

                /**
                 * Convenience method for getting i18n model.
                 * @public
                 * @returns {Object} the object i18n model
                 */
                getResourceBundle: function () {
                    try {
                        return this.getOwnerComponent().getModel("i18n").getResourceBundle();
                    } catch (error) {
                        console.log("BaseController - getResourceBundle - Error:", error);
                        MessageBox.error("Something went wrong!. Please contact technical for support!");
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

                getArgValue: function (oEvent, sArg) {
                    const oArgs = oEvent.getParameter("arguments");
                    if (oArgs && oArgs[sArg]) {
                        return oArgs[sArg];
                    }
                    return null;

                },

                getGlobalModel: function () {
                    return sap.ui.getCore().getModel("global");
                },

                getGeneralTechnicalIssueMsg: function () {
                    return this.getResourceBundle().getText("generalTechnicalIssue");
                },

                translate: function (sKey, aParams = []) {
                    return this.getResourceBundle().getText(sKey, aParams);
                },

                getShellUIService: function () {
                    try {
                        return this.getOwnerComponent().getShellUIService();
                    } catch (e) {
                        return null;
                    }
                }
            }
        );
    }
);
