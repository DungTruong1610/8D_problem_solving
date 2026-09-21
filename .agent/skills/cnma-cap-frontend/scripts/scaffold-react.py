
import os
import sys

def create_react_structure(base_path):
    folders = [
        "src/core",
        "src/domain/entities",
        "src/domain/repositories",
        "src/domain/usecases",
        "src/data/repositories",
        "src/data/datasources",
        "src/presentation/pages",
        "src/presentation/components",
        "src/presentation/hooks",
        "src/presentation/styles",
        "src/di",
        "public"
    ]
    
    for folder in folders:
        path = os.path.join(base_path, folder)
        os.makedirs(path, exist_ok=True)
        with open(os.path.join(path, ".gitkeep"), "w") as f:
            pass
            

    import shutil

    # Determine script directory to find templates
    script_dir = os.path.dirname(os.path.realpath(__file__))
    templates_dir = os.path.join(script_dir, "../templates/react")
    
    if os.path.exists(templates_dir):
        try:
            # Copy all files from templates/react to base_path
            # dirs_exist_ok=True allows copying into existing directories (created above)
            shutil.copytree(templates_dir, base_path, dirs_exist_ok=True)
            print(f"Templates copied to {base_path}")
        except Exception as e:
            print(f"Warning: Could not copy templates: {e}")
    else:
        print(f"Warning: Templates directory not found at {templates_dir}")

    print(f"React Clean Architecture scaffolded in {base_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scaffold_react.py <app_folder_path>")
        sys.exit(1)
        
    app_path = sys.argv[1]
    create_react_structure(app_path)
