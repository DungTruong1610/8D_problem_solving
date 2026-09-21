sap.ui.define(
    [
        "cnma/template/ui5/controller/BaseController",
        "cnma/template/ui5/utils/UICommon",
        "cnma/template/ui5/api/API",
        "sap/m/MessageBox",
        "sap/ui/core/routing/History",
        "sap/ui/core/UIComponent"
    ],
    function (BaseController, UICommon, API, MessageBox, History, UIComponent) {
        "use strict";

        return BaseController.extend("cnma.template.ui5.controller.App", {
            //-----------------------------------------------------------------------------------------------------------------------------
            /************************
            *   life cycle methods  *
            *************************/
            onInit: function () {
                let oUIState = {
                    bAllowConfirmation: true,
                    bStandALone: false,
                    bShowFooter: false,
                    bShowNavBack: false,
                    MDLayout: false,
                    sTabBarStatus: "All",
                    RouteName: "",
                    bEditable: false,
                    layout: "OneColumn"
                };
                this._oComponent = this.getOwnerComponent();
                this._oComponent.getModel("UiState").setData(oUIState);

                this.oRouter = this._oComponent.getRouter();
                this.oRouter.attachBeforeRouteMatched(this.onBeforeRouteMatched, this);
                this._attachShellBackButtonHandler();
            },

            onBeforeRouteMatched: function (oEvent) {

                var oModel = this._oComponent.getModel("UiState");

                var sLayout = oEvent.getParameters().arguments.layout;

                // If there is no layout parameter, query for the default level 0 layout (normally OneColumn)
                if (!sLayout) {
                    var oNextUIState = this.getOwnerComponent().getFlexibleLayoutSemanticHelper().getNextUIState(0);
                    sLayout = oNextUIState.layout;
                }

                // Update the layout of the FlexibleColumnLayout
                if (sLayout) {
                    oModel.setProperty("/layout", sLayout);
                }
            },
            _attachShellBackButtonHandler: function () {
                const oShellUIService = this.getShellUIService();
                if (oShellUIService) {
                    oShellUIService.setBackNavigation(this.onUShellNavBack.bind(this));
                }

            },
            //Handle back button ushell bar
            onUShellNavBack: function () {
                try {
                    const oEventBus = sap.ui.getCore().getEventBus();
                    //@ts-ignore
                    const oHistory = History.getInstance();
                    const sPreviousHash = oHistory.getPreviousHash();

                    //replicate back button action
                    if (sPreviousHash !== undefined) {
                        window.history.go(-1);
                    } else {
                        var oRouter = UIComponent.getRouterFor(this);
                        oRouter.navTo("home", {}, true);
                    }

                    //set app title by route
                    // this.fnSetAppTitle(this.getCurrentRoute());
                } catch (error) {
                    console.log(`Nav back error: ${error}`);
                    MessageBox.error(this.getGeneralTechnicalIssueMsg());
                }

            },

            //-----------------------------------------------------------------------------------------------------------------------------
            // /************************
            // *     event handlers    *
            // *************************/
            onContactSupportHandle: function () {
                const sRequestUri = "mailto:support@conarum.com";
                //@ts-ignore
                const oSupportLinkElem = document.createElement('a');
                oSupportLinkElem.href = sRequestUri;
                oSupportLinkElem.click();
            }

            //-----------------------------------------------------------------------------------------------------------------------------
            // /************************
            // *    private methods    *
            // *************************/
        });
    }
);
