package cnma.{{module_name}};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

/**
 * CAP Java Application Entry Point
 *
 * Spring Boot auto-discovers:
 * - @Component classes (handlers, services)
 * - @Repository classes (data access)
 * - @Service classes (business logic)
 *
 * CDS annotations (@Handler, @Service) are processed automatically.
 */
@SpringBootApplication
@ComponentScan(basePackages = "cnma.{{module_name}}")
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}