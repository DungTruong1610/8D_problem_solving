sap.ui.define([
    "cnma/template/ui5/utils/UICommon"
], function (UICommon) {
    "use strict";

    let _oUserInfo = {
        logonEmail: "",
        userName: "",
        firstName: "",
        lastName: "",
        btpRoleCollections: [],
        isTechnicalAdmin: false
    };

    let _oUserRole = {
        isTechnicalAdmin: false
    };

    return {
        fnSetUserInfo: function (oNewUserInfo) {
            _oUserInfo = oNewUserInfo;
        },
        fnGetUserInfo: function () {
            return _oUserInfo;
        },
        fnInitUserRoleByScopes: function (aUserAssignedScopes) {
            // Default implementation - extend as needed
            return _oUserRole;
        },
        fnGetUserRole: function () {
            return _oUserRole;
        }
    };
});
