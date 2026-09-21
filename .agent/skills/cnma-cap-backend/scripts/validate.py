
import os
import json
import sys

def validate_structure(project_path):
    required = [
        # Root files
        'package.json', 'mta.yaml', 'xs-security.json', 'tsconfig.json',
        # DB layer
        'db', 'db/src',
        # SRV layer
        'srv', 'srv/server.ts',
        'srv/src', 'srv/src/core', 'srv/src/model/core',
        'srv/src/interfaces', 'srv/src/enum',
        'srv/src/services', 'srv/src/api', 'srv/src/cds',
        'srv/src/config', 'srv/src/utils',
        'srv/src/events', 'srv/src/workers', 'srv/src/middleware',
        # i18n
        'i18n'
    ]
    missing = [f for f in required if not os.path.exists(os.path.join(project_path, f))]
    
    if missing:
        print(f"FAIL - Missing files/folders:")
        for m in missing:
            print(f"  ✗ {m}")
        return False
    
    print("PASS - All required files and folders exist.")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate.py <project_path>")
        sys.exit(1)
        
    project_path = sys.argv[1]
    if validate_structure(project_path):
        print("Backend structure validation passed.")
    else:
        sys.exit(1)
