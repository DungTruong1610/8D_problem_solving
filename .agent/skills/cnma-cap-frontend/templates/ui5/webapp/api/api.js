sap.ui.define([
    "cnma/template/ui5/utils/UICommon"
], function (UICommon) {
    "use strict";

    return {
        getUserInfo: function (oController) {
            // Mock implementation or call to backend
            return new Promise((resolve, reject) => {
                resolve({
                    success: true,
                    data: {
                        email: "user@example.com",
                        userName: "USER",
                        givenName: "User",
                        familyName: "Name",
                        grantedScopes: [],
                        isTechnicalAdmin: true
                    }
                });
            });
        }
    };
});
