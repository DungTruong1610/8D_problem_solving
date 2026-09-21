
import os
import sys
import shutil

def create_ui5_structure(base_path, namespace="ns"):
    """
    Creates UI5 directory structure by copying from templates.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    template_dir = os.path.join(script_dir, "../templates/ui5/webapp")
    
    target_webapp = os.path.join(base_path, "webapp")
    
    print(f"Scaffolding UI5 from {template_dir} to {target_webapp}...")
    
    # 1. Copy the entire webapp template
    if os.path.exists(target_webapp):
        print(f"Warning: {target_webapp} already exists. Merging...")
    
    try:
        shutil.copytree(template_dir, target_webapp, dirs_exist_ok=True)
    except Exception as e:
        print(f"Error copying templates: {e}")
        return

    # 2. Replace placeholders in all files
    # Placeholders: {{ui_namespace}} -> namespace
    #               {{project_name}} -> last part of namespace (simple approximation)
    
    project_name = namespace.split("/")[-1] if "/" in namespace else "app"
    
    for root, dirs, files in os.walk(target_webapp):
        for file in files:
            file_path = os.path.join(root, file)
            
            # Skip binary files if any (though UI5 is mostly text)
            if file.endswith(('.png', '.jpg', '.jpeg', '.ico')):
                continue
                
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # Perform replacements
                new_content = content.replace("{{ui_namespace}}", namespace)
                new_content = new_content.replace("ns/", f"{namespace}/") # Replace generic 'ns/' import
                new_content = new_content.replace("{{project_name}}", project_name)
                
                # Standardize 'ns' namespace in templates to the actual namespace
                # Check for "ns/" usages which we used in templates
                
                if new_content != content:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(new_content)
                        
            except Exception as e:
                print(f"Skipping file {file_path}: {e}")

    # 3. Create .gitkeep in empty folders if they didn't copy
    # (copytree usually copies empty folders too, but good to be safe)
    
    print(f"UI5 structure scaffolded in {base_path} with namespace: {namespace}")
    print("Don't forget to update mta.yaml to include the new UI module.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scaffold_ui5.py <app_folder_path> [namespace]")
        print("  namespace: UI5 namespace (e.g., 'cnma/notification/app'). Default: 'ns'")
        sys.exit(1)
        
    app_path = sys.argv[1]
    ns = sys.argv[2] if len(sys.argv) > 2 else "ns"
    create_ui5_structure(app_path, ns)
