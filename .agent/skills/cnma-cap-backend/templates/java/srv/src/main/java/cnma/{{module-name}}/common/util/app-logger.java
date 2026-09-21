package cnma.{{module_name}}.common.util;

import lombok.extern.slf4j.Slf4j;

/**
 * Logger utility - wrapper around SLF4J.
 * Use this instead of System.out/err.
 */
@Slf4j
public final class AppLogger {

    private AppLogger() {}

    public static void info(String message) {
        log.info(message);
    }

    public static void info(String message, Object... args) {
        log.info(message, args);
    }

    public static void warn(String message) {
        log.warn(message);
    }

    public static void error(String message) {
        log.error(message);
    }

    public static void error(String message, Throwable t) {
        log.error(message, t);
    }

    public static void debug(String message) {
        log.debug(message);
    }
}