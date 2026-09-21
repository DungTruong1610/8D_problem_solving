package cnma.{{module_name}}.domain.__feature__.handler;

import org.springframework.stereotype.Component;
import com.sap.cds.services.EventHandler;
import com.sap.cds.services.handler.EventHandlerContext;
import com.sap.cds.services.RequestContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import cnma.{{module_name}}.domain.__feature__.events.OnRead{{FeatureName}}Event;
import cnma.{{module_name}}.domain.__feature__.events.OnBeforeCreate{{FeatureName}}Event;
import cnma.{{module_name}}.domain.__feature__.events.OnAfterCreate{{FeatureName}}Event;
import cnma.{{module_name}}.domain.__feature__.events.OnBeforeUpdate{{FeatureName}}Event;
import cnma.{{module_name}}.domain.__feature__.events.OnAfterUpdate{{FeatureName}}Event;
import cnma.{{module_name}}.domain.__feature__.events.OnAfterDelete{{FeatureName}}Event;

/**
 * {{FeatureName}}Handler - Event handler for {{FeatureName}} domain.
 * SRP: Only registers events, delegates logic to event classes.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class {{FeatureName}}Handler implements EventHandler {

    private final OnRead{{FeatureName}}Event onReadEvent;
    private final OnBeforeCreate{{FeatureName}}Event onBeforeCreateEvent;
    private final OnAfterCreate{{FeatureName}}Event onAfterCreateEvent;
    private final OnBeforeUpdate{{FeatureName}}Event onBeforeUpdateEvent;
    private final OnAfterUpdate{{FeatureName}}Event onAfterUpdateEvent;
    private final OnAfterDelete{{FeatureName}}Event onAfterDeleteEvent;

    @Handler(event = Event.READ)
    public void onRead(EventHandlerContext ctx) {
        onReadEvent.execute(ctx);
    }

    @Handler(event = Event.CREATE)
    public void onBeforeCreate(RequestContext ctx) {
        onBeforeCreateEvent.execute(ctx);
    }

    @Handler(event = Event.AFTER_CREATE)
    public void onAfterCreate(EventHandlerContext ctx) {
        onAfterCreateEvent.execute(ctx.getResult(), ctx);
    }

    @Handler(event = Event.UPDATE)
    public void onBeforeUpdate(RequestContext ctx) {
        onBeforeUpdateEvent.execute(ctx);
    }

    @Handler(event = Event.AFTER_UPDATE)
    public void onAfterUpdate(EventHandlerContext ctx) {
        onAfterUpdateEvent.execute(ctx.getResult(), ctx);
    }

    @Handler(event = Event.AFTER_DELETE)
    public void onAfterDelete(EventHandlerContext ctx) {
        onAfterDeleteEvent.execute(ctx.getResult(), ctx);
    }
}