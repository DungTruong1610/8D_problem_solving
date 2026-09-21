sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/core/HTML"
], function (UIComponent, HTML) {
    "use strict";

    return UIComponent.extend("{{NAMESPACE}}.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
        },

        createContent: function () {
            var sAppPath = sap.ui.require.toUrl("{{NAMESPACE_PATH}}");

            //Point to React index.html
            var sIndexUrl = sAppPath + "/index.html";

            // Return a UI5 HTML Control that contains an IFrame
            // This isolates React App (and its HashRouter) from the Launchpad
            return new HTML({
                content: '<iframe src="' + sIndexUrl + '" style="width:100%; height:100%; border:none; display:block;"></iframe>'
            });
        }
    });
});
