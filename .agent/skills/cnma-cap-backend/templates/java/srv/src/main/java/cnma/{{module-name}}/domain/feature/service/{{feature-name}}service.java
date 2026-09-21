package cnma.{{module_name}}.domain.__feature__.service;

import cnma.{{module_name}}.common.service.BaseService;
import cnma.{{module_name}}.common.model.ApiResponse;
import cnma.{{module_name}}.domain.__feature__.repository.{{FeatureName}}Repository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.List;

/**
 * {{FeatureName}}Service - Business logic layer.
 * DIP: Depends on Repository abstraction, not implementation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class {{FeatureName}}Service extends BaseService {

    private final {{FeatureName}}Repository repository;

    public List<?> findByUser(String userId, Object cqn) {
        return repository.findByUserId(userId);
    }

    public void validateCreate(Object data) {
        log.debug("Validating create data: {}", data);
    }

    public void validateUpdate(Object data) {
        log.debug("Validating update data: {}", data);
    }

    public ApiResponse<?> adjustDefaultVariant(Object data, String userId) {
        try {
            return ApiResponse.success("Adjust Variant Setting success", null);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}