/**
 * UI5 DTO (Data Transfer Object) Pattern
 * DTO modules define entity field shapes, auto-generate select/filter fields,
 * and provide a `create()` factory and `moveCorresponding()` mapper.
 *
 * CONVENTION:
 * - Place in webapp/api/DTO/ folder
 * - Import DTOInterface and use `DTOInterface.Implementation(FIELDS)`
 * - Each DTO defines the full field list of the OData entity
 */
sap.ui.define(["ns/interfaces/DTOInterface"], function (DTOInterface) {
    "use strict";

    const MY_ENTITY = {
        "ID": "",
        "createdAt": "",
        "createdBy": "",
        "modifiedAt": "",
        "modifiedBy": "",
        "name": "",
        "description": "",
        "status": ""
    };

    return {
        ...DTOInterface.Implementation(MY_ENTITY)
        // selectFields: ["ID", "name", "status"],  // Optional: limit OData $select
        // filterFields: ["name", "status"]          // Optional: limit filter columns
    };
});
