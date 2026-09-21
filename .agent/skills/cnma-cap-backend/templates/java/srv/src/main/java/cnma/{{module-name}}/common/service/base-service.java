package cnma.{{module_name}}.common.service;

import cnma.{{module_name}}.common.interfaces.ICommonService;
import cnma.{{module_name}}.common.model.ServiceResponse;
import cnma.{{module_name}}.common.enums.HttpStatusCode;
import lombok.extern.slf4j.Slf4j;

/**
 * Base service class providing common functionality.
 * EXTEND THIS CLASS for any new service that needs:
 * - Localized messages (getText)
 * - Standardized response formatting
 * - Audit fields (setCreateManaged, setUpdateManaged)
 */
@Slf4j
public abstract class BaseService implements ICommonService {

    @Override
    public String getText(String textKey) {
        return textKey;
    }

    @Override
    public String getText(String textKey, String... params) {
        String text = textKey;
        for (int i = 0; i < params.length; i++) {
            text = text.replace("{" + i + "}", params[i]);
        }
        return text;
    }

    protected <T> ServiceResponse<T> buildResponse(HttpStatusCode status, String message, T data) {
        return ServiceResponse.<T>builder()
                .statusCode(status.getCode())
                .success(status.isSuccess())
                .message(message)
                .data(data)
                .build();
    }

    protected <T> ServiceResponse<T> ok(T data) {
        return buildResponse(HttpStatusCode.OK, "Success", data);
    }

    protected <T> ServiceResponse<T> created(T data) {
        return buildResponse(HttpStatusCode.CREATED, "Created", data);
    }

    protected <T> ServiceResponse<T> error(HttpStatusCode status, String message) {
        return buildResponse(status, message, null);
    }
}