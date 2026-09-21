package cnma.{{module_name}}.infrastructure.database;

import com.sap.cds.Result;
import com.sap.cds.services.persistence.PersistenceService;
import com.sap.cds.ql.Select;
import com.sap.cds.ql.Insert;
import com.sap.cds.ql.Update;
import com.sap.cds.ql.Delete;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * DBHandler - Generic database operations with transaction management.
 * DIP: Domain layer depends on this abstraction, not concrete CQN.
 */
@Slf4j
@Component
public class DBHandler {

    private final PersistenceService persistence;

    public DBHandler(PersistenceService persistence) {
        this.persistence = persistence;
    }

    /**
     * Execute SELECT query with conditions.
     */
    public <T> List<T> select(Class<T> entityClass, String entityName, Map<String, Object> conditions) {
        try {
            Select<?> builder = Select.from(entityName);
            if (conditions != null && !conditions.isEmpty()) {
                builder.where(conditions);
            }
            Result result = persistence.run(builder);
            return result.stream(entityClass).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("SELECT failed for {}", entityName, e);
            return List.of();
        }
    }

    /**
     * Find by ID.
     */
    public <T> Optional<T> findById(Class<T> entityClass, String entityName, String id) {
        try {
            Result result = persistence.run(
                Select.from(entityName).where("ID", id)
            );
            return result.first(entityClass);
        } catch (Exception e) {
            log.error("findById failed for {} with id {}", entityName, id, e);
            return Optional.empty();
        }
    }

    /**
     * Insert single record.
     */
    public <T> T insert(String entityName, T data) {
        try {
            persistence.run(Insert.into(entityName).entry(data));
            return data;
        } catch (Exception e) {
            log.error("INSERT failed for {}", entityName, e);
            throw new RuntimeException("Insert failed: " + e.getMessage(), e);
        }
    }

    /**
     * Insert multiple records (batch).
     */
    public <T> void insertBatch(String entityName, List<T> entries) {
        try {
            persistence.run(Insert.into(entityName).entries(entries));
        } catch (Exception e) {
            log.error("Batch INSERT failed for {}", entityName, e);
            throw new RuntimeException("Batch insert failed: " + e.getMessage(), e);
        }
    }

    /**
     * Update records matching conditions.
     */
    public int update(String entityName, Map<String, Object> conditions, Map<String, Object> data) {
        try {
            Update<?> builder = Update.entity(entityName).data(data);
            if (conditions != null && !conditions.isEmpty()) {
                builder.where(conditions);
            }
            Result result = persistence.run(builder);
            return result.rowCount();
        } catch (Exception e) {
            log.error("UPDATE failed for {}", entityName, e);
            throw new RuntimeException("Update failed: " + e.getMessage(), e);
        }
    }

    /**
     * Delete records matching conditions.
     */
    public void delete(String entityName, Map<String, Object> conditions) {
        try {
            Delete<?> builder = Delete.from(entityName);
            if (conditions != null && !conditions.isEmpty()) {
                builder.where(conditions);
            }
            persistence.run(builder);
        } catch (Exception e) {
            log.error("DELETE failed for {}", entityName, e);
            throw new RuntimeException("Delete failed: " + e.getMessage(), e);
        }
    }

    /**
     * Execute custom CQN query.
     */
    public Result execute(Select<?> query) {
        return persistence.run(query);
    }
}