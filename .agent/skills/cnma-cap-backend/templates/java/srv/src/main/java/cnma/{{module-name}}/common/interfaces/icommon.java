package cnma.{{module_name}}.common.interfaces;

/**
 * Common interfaces for CAP services.
 */
public interface IApiResponse<T> {
    boolean isSuccess();
    String getMessage();
    T getData();
}

public interface IServiceResponse<T> extends IApiResponse<T> {
    int getStatusCode();
    IApiResponse<T> toApiResponse();
}

public interface IValidationResponse {
    boolean isValid();
    String getMessage();
}

public interface ICommonService {
    String getText(String textKey);
    String getText(String textKey, String... params);
}