package cnma.{{module_name}}.common.exception;

/**
 * Thrown when entity is not found.
 */
public class NotFoundException extends ServiceException {
    public NotFoundException(String entity, String id) {
        super("NOT_FOUND", entity + " with ID " + id + " not found");
    }
}