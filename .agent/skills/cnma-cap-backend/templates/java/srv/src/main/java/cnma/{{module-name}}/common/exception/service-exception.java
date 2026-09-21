package cnma.{{module_name}}.common.exception;

import lombok.Getter;

/**
 * Base exception for business logic errors.
 * Never throw plain RuntimeException; use ServiceException.
 */
@Getter
public class ServiceException extends RuntimeException {
    private final String code;
    private final Object details;

    public ServiceException(String code, String message) {
        super(message);
        this.code = code;
        this.details = null;
    }

    public ServiceException(String code, String message, Object details) {
        super(message);
        this.code = code;
        this.details = details;
    }
}