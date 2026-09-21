/**
 * Composition Root — Dependency Injection Container
 *
 * Location: server/src/composition/container.ts
 *
 * This is the ONLY file allowed to instantiate concrete classes.
 * Every other module imports INTERFACES, never implementations.
 *
 * Adding a new module:
 *  1. Import its repo + service + mapper + controller classes.
 *  2. Instantiate in order: infra → repos → mappers → services → controllers.
 *  3. Export the controller (routes consume it).
 *
 * Swapping implementations (e.g., from local to S3 storage):
 *  - Change the single line in this file. No other code moves.
 */

// ──────────── Infrastructure (external integrations) ────────────
import { createStorageProvider } from '../services/storage/storage.factory.js';

// ──────────── Repositories ────────────
import { TradeRepository } from '../repositories/trade.repository.js';
// import { RuleRepository }     from '../repositories/rule.repository.js';
// import { TagRepository }      from '../repositories/tag.repository.js';

// ──────────── Mappers ────────────
import { TradeMapper } from '../mappers/trade.mapper.js';
// import { RuleMapper }  from '../mappers/rule.mapper.js';

// ──────────── Services ────────────
import { TradeService } from '../services/trade.service.js';
// import { RuleService }      from '../services/rule.service.js';
// import { AnalyticsService } from '../services/analytics.service.js';
// import { AIService }        from '../services/ai.service.js';

// ──────────── Controllers ────────────
import { TradeController } from '../controllers/trade.controller.js';
// import { RuleController }      from '../controllers/rule.controller.js';
// import { AnalyticsController } from '../controllers/analytics.controller.js';
// import { AIController }        from '../controllers/ai.controller.js';

// ╔══════════════════════════════════════════════════════════════╗
// ║                    WIRING ORDER MATTERS                      ║
// ║                                                              ║
// ║  infra → repositories → mappers → services → controllers     ║
// ╚══════════════════════════════════════════════════════════════╝

// 1. Infrastructure
export const storageProvider = createStorageProvider();

// 2. Repositories
const tradeRepo = new TradeRepository();
// const ruleRepo  = new RuleRepository();
// const tagRepo   = new TagRepository();

// 3. Mappers
const tradeMapper = new TradeMapper();
// const ruleMapper  = new RuleMapper();

// 4. Services
const tradeService     = new TradeService(tradeRepo, tradeMapper);
// const ruleService      = new RuleService(ruleRepo, ruleMapper);
// const analyticsService = new AnalyticsService(tradeRepo);
// const aiService        = new AIService(tradeRepo);

// 5. Controllers (exported for routes)
export const tradeController = new TradeController(tradeService);
// export const ruleController      = new RuleController(ruleService);
// export const analyticsController = new AnalyticsController(analyticsService);
// export const aiController        = new AIController(aiService);
