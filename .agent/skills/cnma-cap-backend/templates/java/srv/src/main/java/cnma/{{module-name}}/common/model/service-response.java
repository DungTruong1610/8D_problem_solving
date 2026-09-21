package cnma.{{module_name}}.common.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Service response with HTTP status code.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceResponse<T> implements IServiceResponse<T> {
    private int statusCode;
    private boolean success;
    private String message;
    private T data;

    public static <T> ServiceResponse<T> ok(T data) {
        return ServiceResponse.<T>builder()
                .statusCode(200)
                .success(true)
                .message("Success")
                .data(data)
                .build();
    }

    public static <T> ServiceResponse<T> error(int statusCode, String message) {
        return ServiceResponse.<T>builder()
                .statusCode(statusCode)
                .success(false)
                .message(message)
                .data(null)
                .build();
    }

    @Override
    public IApiResponse<T> toApiResponse() {
        return ApiResponse.<T>builder()
                .success(this.success)
                .message(this.message)
                .data(this.data)
                .build();
    }
}