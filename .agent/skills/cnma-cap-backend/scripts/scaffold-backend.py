
import os
import sys
import argparse
import shutil

def create_backend_structure(base_path, namespace="cnma.myservice", use_variant=False):
    """
    Creates backend directory structure.
    namespace: CDS namespace (e.g., 'cnma.notification')
    """
    folders = [
        # DB layer
        "db",
        "db/schema",
        "db/src",
        "db/view",
        # SRV layer
        "srv",
        "srv/src/core",
        "srv/src/model/core",
        "srv/src/interfaces",
        "srv/src/enum",
        "srv/src/config",
        "srv/src/services",
        "srv/src/middleware",
        "srv/src/utils",
        "srv/src/api",
        "srv/src/events",
        "srv/src/workers",
        "srv/src/cds",
        "srv/type",
        # i18n
        "i18n"
    ]
    
    for folder in folders:
        path = os.path.join(base_path, folder)
        os.makedirs(path, exist_ok=True)
        with open(os.path.join(path, ".gitkeep"), "w") as f:
            pass
    
    # Create sample CDS schema with namespace
    schema_path = os.path.join(base_path, "db/schema/SampleEntity.cds")
    with open(schema_path, "w") as f:
        f.write(f"namespace {namespace};\n\n")
        f.write("using { cuid, managed } from '@sap/cds/common';\n\n")
        f.write("entity SampleEntity : cuid, managed {\n")
        f.write("    name        : String(255);\n")
        f.write("    description : String(1000);\n")
        f.write("    status      : String(20) default 'Draft';\n")
        f.write("}\n")
    

    # Determining script directory to find templates
    script_dir = os.path.dirname(os.path.realpath(__file__))
    templates_dir = os.path.join(script_dir, "../templates")
    
    # --- Auto-copy base templates ---
    try:
        # Copy srv/core, srv/model/core, srv/interfaces, srv/enum, srv/middlewares, srv/utils
        base_folders_to_copy = [
            ("srv/core", "srv/src/core"),
            ("srv/model", "srv/src/model"),
            ("srv/interfaces", "srv/src/interfaces"),
            ("srv/enum", "srv/src/enum"),
            ("srv/middlewares", "srv/src/middleware"),
            ("srv/utils", "srv/src/utils")
        ]
        
        for src_rel, dest_rel in base_folders_to_copy:
            src_path = os.path.join(templates_dir, src_rel)
            dest_path = os.path.join(base_path, dest_rel)
            if os.path.exists(src_path):
                # Copy tree if it doesn't exist, otherwise we'd need a more complex merge.
                # Since this is a scaffold for a new project, dest_path usually empty.
                if os.path.exists(dest_path):
                    shutil.rmtree(dest_path)
                shutil.copytree(src_path, dest_path)
                
        # Copy server.ts
        if os.path.exists(os.path.join(templates_dir, "srv/server.ts")):
            shutil.copy(os.path.join(templates_dir, "srv/server.ts"), os.path.join(base_path, "srv/server.ts"))
            
        # Copy Base Handler.ts template
        if os.path.exists(os.path.join(templates_dir, "srv/Handler.ts")):
            default_handler_name = "DefaultHandler.ts"
            # Try to guess a better name from namespace
            if getattr(namespace, 'split', None):
                parts = namespace.split('.')
                if len(parts) > 1:
                    default_handler_name = f"{parts[-1].capitalize()}Handler.ts"
                    
            shutil.copy(os.path.join(templates_dir, "srv/Handler.ts"), os.path.join(base_path, "srv/src/cds", default_handler_name))
            
        print("Base templates (core, model, utils, middlewares, server.ts) copied successfully.")
    except Exception as e:
        print(f"Warning: Could not copy base templates: {e}")

    # --- Variant Management Prompt ---
    if use_variant:
        try:
            # DB Schema
            shutil.copy(os.path.join(templates_dir, "db/schema/VariantSettings.cds"), 
                        os.path.join(base_path, "db/schema/VariantSettings.cds"))
            
            # SRV Handlers & Events
            os.makedirs(os.path.join(base_path, "srv/src/cds/handlers"), exist_ok=True)
            os.makedirs(os.path.join(base_path, "srv/src/cds/events/variant"), exist_ok=True)
            
            shutil.copy(os.path.join(templates_dir, "srv/cds/handlers/VariantHandler.js"), 
                        os.path.join(base_path, "srv/src/cds/handlers/VariantHandler.js"))
            
            shutil.copy(os.path.join(templates_dir, "srv/cds/events/variant/ReadVariantSettings.js"), 
                        os.path.join(base_path, "srv/src/cds/events/variant/ReadVariantSettings.js"))
            shutil.copy(os.path.join(templates_dir, "srv/cds/events/variant/CreateVariantSettings.js"), 
                        os.path.join(base_path, "srv/src/cds/events/variant/CreateVariantSettings.js"))
            shutil.copy(os.path.join(templates_dir, "srv/cds/events/variant/AdjustDefaultVariantSetting.js"), 
                        os.path.join(base_path, "srv/src/cds/events/variant/AdjustDefaultVariantSetting.js"))
            
            # ActionResponse helper is already copied via srv/core base copy above if it was moved to templates/srv/core correctly.
            # But let's safely try to copy if it's explicitly separate:
            action_resp_src = os.path.join(templates_dir, "srv/core/ActionResponse.js")
            action_resp_dest = os.path.join(base_path, "srv/src/core/ActionResponse.js")
            if os.path.exists(action_resp_src) and not os.path.exists(action_resp_dest):
                shutil.copy(action_resp_src, action_resp_dest)
            
            print("Variant Management modules added.")
            print("IMPORTANT: You must manually add 'entity VariantSettings' to your srv/service.cds file.")
            
        except Exception as e:
            print(f"Warning: Could not copy Variant templates: {e}")
            print("Please ensure templates directory exists relative to this script.")

    # --- CRITICAL: Clean undeploy.json to protect HDI container ---
    try:
        undeploy_path = os.path.join(base_path, "db", "undeploy.json")
        if os.path.exists(undeploy_path):
            # Read current content for logging
            with open(undeploy_path, "r") as f:
                current_content = f.read().strip()
            
            # Make it empty to prevent data cleanup
            with open(undeploy_path, "w") as f:
                f.write("[]")
            
            print("🚨 CRITICAL: Cleaned db/undeploy.json to prevent HDI container data cleanup")
            print(f"   Previous content: {current_content}")
            print("   New content: []")
            print("   This prevents cleanup of all data in shared HDI container!")
        else:
            # Create empty undeploy.json if it doesn't exist
            with open(undeploy_path, "w") as f:
                f.write("[]")
            print("🚨 CRITICAL: Created empty db/undeploy.json to prevent HDI container data cleanup")
    except Exception as e:
        print(f"🚨 ERROR: Failed to clean db/undeploy.json: {e}")
        print("   MANUAL ACTION REQUIRED: Make db/undeploy.json empty before deployment!")
        print("   IF NOT DONE, ALL DATA IN HDI CONTAINER WILL BE CLEANED!")

    print(f"Backend structure scaffolded in {base_path} with namespace: {namespace}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scaffold SAP CAP Backend Structure")
    parser.add_argument("project_root", help="Root path of the project to scaffold")
    parser.add_argument("--namespace", default="cnma.myservice", help="CDS namespace (e.g., 'cnma.notification')")
    parser.add_argument("--variant", action="store_true", help="Include Variant Management modules")
    
    args = parser.parse_args()
    
    create_backend_structure(args.project_root, args.namespace, args.variant)
