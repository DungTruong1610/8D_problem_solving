/**
 * UI Utility
 * standardized for templates
 * */
sap.ui.define([
    "sap/ui/core/format/DateFormat",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "cnma/template/ui5/utils/enum/AppRouteEnum"
], function (DateFormat, JSONModel, MessageBox, AppRouteEnum) {
    "use strict";
    return {
        DEFAULT_CONVERSION_ROUTINE: 0,
        FIXED_FLOAT_NUMBER: 3,
        LOG_INFO: "I",
        LOG_ERROR: "E",

        fnSortArrayObject: function (aSources, sortType, sortColumn, bFilterNullSortColValue = false) {
            if (!aSources || aSources === undefined) {
                console.error("UICommon - fnSortArrayObject - Invalid Source: ", aSources);
                return [];
            }
            if (bFilterNullSortColValue) {
                aSources = aSources.filter((item) => item[sortColumn] !== null);
            }
            aSources.sort((a, b) => {
                if (sortType === "ASC") {
                    return a[sortColumn] - b[sortColumn];
                } else if (sortType === "DESC") {
                    return b[sortColumn] - a[sortColumn];
                }
                return [];
            });
            return aSources;
        },

        fnHandleResponseException: function (error) {
            let oError = error.responseJSON;
            let sMessage = "";
            if (!oError) {
                sMessage = "Request Failed";
            } else {
                if (oError.message) {
                    sMessage = oError.message || error.responseText;
                }
                if (oError.data && oError.data.message) {
                    sMessage = sMessage + " " + oError.data.message;
                }
                if (sMessage === "" && oError.error) {
                    sMessage = oError.error.message;
                }
                console.error("UICommon - fnHandleResponseException - error: ", JSON.stringify(oError.data ? oError.data.stack : oError.message));
            }
            return sMessage;
        },

        fnMaintainGlobalModelData: function (oDataToBeAdded, sNameToBeAdded) {
            let oGlobalModel = sap.ui.getCore().getModel("global");
            let oGlobalData;
            if (!oGlobalModel) {
                oGlobalModel = new JSONModel();
                oGlobalData = {};
            } else {
                oGlobalData = oGlobalModel.getData();
            }
            oGlobalData[sNameToBeAdded] = oDataToBeAdded;
            oGlobalModel.setData(oGlobalData);
            sap.ui.getCore().setModel(oGlobalModel, "global");
        },

        fnIsDevEnv: function () {
            const sOriginUri = window.location.origin;
            const sBASUri = "applicationstudio.cloud.sap";
            // Basic check for BAS or localhost
            return sOriginUri.includes(sBASUri) || sOriginUri.includes("localhost");
        },

        fnShowTechnicalIssue: function () {
            const sGeneralMsg = "Something went wrong. Please get in touch with the Technical team for support!";
            MessageBox.error(sGeneralMsg);
        },

        devLog: function (logs, sType = this.LOG_INFO, sLogSource) {
            if (!this.fnIsDevEnv()) {
                return;
            }
            let logMsg = logs;
            if (sLogSource) logMsg = `${logs}${sLogSource}`;

            if (sType === this.LOG_INFO) console.log(logMsg);
            if (sType === this.LOG_ERROR) console.error(logMsg);
        },

        fnGetDeviceData: function () {
            const oDeviceModel = sap.ui.getCore().getModel("device");
            if (oDeviceModel) return oDeviceModel.getData();
        },
        fnIsDesktop: function () {
            return this.fnGetDeviceData()?.system?.desktop;
        },
        fnIsTablet: function () {
            return this.fnGetDeviceData()?.system?.tablet;
        },
        fnIsMobile: function () {
            return this.fnGetDeviceData()?.system?.phone;
        },

        fnGetQueryParams: function (url) {
            const queryParams = {};
            // Basic parsing logic
            // ...
            return queryParams;
        }
    };
});
