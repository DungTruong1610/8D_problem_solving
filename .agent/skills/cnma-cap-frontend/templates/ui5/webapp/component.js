/**
 * eslint-disable @sap/ui5-jsdocs/no-jsdoc
 */

sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "cnma/template/ui5/model/models",
    "sap/ui/model/json/JSONModel",
    "cnma/template/ui5/api/API",
    "cnma/template/ui5/utils/UICommon",
    "sap/ui/core/BusyIndicator",
    "cnma/template/ui5/utils/enum/RoleBaseEnum",
    "cnma/template/ui5/utils/Authorization",
    "cnma/template/ui5/utils/enum/AppRouteEnum",
    "cnma/template/ui5/interfaces/AppGlobalDataInterface",
    "sap/f/library",
    "sap/f/FlexibleColumnLayoutSemanticHelper"
],
    function (UIComponent, Device, models, JSONModel, API, UICommon, BusyIndicator, RoleBaseEnum, Authorization, AppRouteEnum, AppGlobalDataInterface,
        library, FlexibleColumnLayoutSemanticHelper) {
        "use strict";

        let LayoutType = library.LayoutType;

        return UIComponent.extend("cnma.template.ui5.Component", {
            metadata: {
                manifest: "json"
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                //Init ShellUIService Services
                this._oShellUIService = null;
                if (!UICommon.fnIsDevEnv()) {
                    this.getService("ShellUIService").then(
                        function (oService) {
                            this._oShellUIService = oService;
                        }.bind(this),
                        function (oError) {
                            console.log(`${this._oShellUIService}`)
                            console.error("Cannot get ShellUIService", oError);
                        }.bind(this)
                    );
                }

                //Define global json model config for common data
                let oInitAppGlobalData = AppGlobalDataInterface.Implementation();
                oInitAppGlobalData.viewName = AppRouteEnum;
                const oGlobalModel = new JSONModel(oInitAppGlobalData);

                sap.ui.getCore().setModel(oGlobalModel, "global");
                this.setModel(oGlobalModel, "global");


                // set the device model
                sap.ui.getCore().setModel(models.createDeviceModel(), "device");
                this.setModel(models.createDeviceModel(), "device");

                let oUserInfoRequest = API.getUserInfo(this);
                $.when(oUserInfoRequest).done((oUserInfoData) => {
                    try {

                        if (!oUserInfoData) {
                            //@ts-ignore
                            console.log("Component - init - Service Unavailable - ErrorMsg: Can not get User Info please check CAP Service");
                            UICommon.fnShowTechnicalIssue();
                            return;
                        }
                        const { status, success, data } = oUserInfoData;
                        if (!success) {
                            if (status != 401) {
                                //@ts-ignore
                                console.log("Component - init - Service Unavailable - ErrorMsg: Can not get User Info please check CAP Service");
                                UICommon.fnShowTechnicalIssue();
                                return;
                            }
                        }
                        if (data) {
                            UICommon.fnMaintainGlobalModelData(data.email, "logonEmail");
                            //Set user info global
                            const oUserInfo = {
                                logonEmail: data.email,
                                userName: data.userName,
                                firstName: data.givenName,
                                lastName: data.familyName,
                                btpRoleCollections: data.grantedRoleCollections,
                                isTechnicalAdmin: data.isTechnicalAdmin
                            };
                            Authorization.fnSetUserInfo(oUserInfo);
                            Authorization.fnInitUserRoleByScopes(data.grantedScopes);
                            UICommon.devLog(`User final role: ${JSON.stringify(Authorization.fnGetUserRole())}`);
                            // console.log(`User Granted Scopes: ${JSON.stringify(data.grantedScopes)}`);
                        }
                        // enable routing
                        this.getRouter().initialize();
                    } catch (error) {
                        //@ts-ignore
                        console.log("Component - init - Service Unavailable - ErrorMsg:", error);
                        UICommon.fnShowTechnicalIssue();
                        return;
                    }
                });
            },
            /**
             * Returns an instance of the semantic helper
             * @returns {sap.f.FlexibleColumnLayoutSemanticHelper} An instance of the semantic helper
             */
            getFlexibleLayoutSemanticHelper: function () {
                var oFCL = this.getRootControl().byId("flexibleColumnLayout"),
                    oParams = new URLSearchParams(window.location.search),
                    oSettings = {
                        defaultTwoColumnLayoutType: LayoutType.TwoColumnsMidExpanded,
                        defaultThreeColumnLayoutType: LayoutType.ThreeColumnsMidExpanded,
                        mode: oParams.get("mode"),
                        maxColumnsCount: oParams.get("max")
                    };

                return FlexibleColumnLayoutSemanticHelper.getInstanceFor(oFCL, oSettings);
            },
            getShellUIService: function () {
                return this._oShellUIService;
            },
            _loadCAPSecurityConfig: function () {
                //TODO
            }
        });
    }
);
