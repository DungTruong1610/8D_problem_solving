package cnma.{{module_name}}.common.exception;

/**
 * Thrown when input validation fails.
 */
public class ValidationException extends ServiceException {
    public ValidationException(String message) {
        super("VALIDATION_ERROR", message);
    }

    public ValidationException(String message, Object details) {
        super("VALIDATION_ERROR", message, details);
    }
}