import os
import zipfile

def create_extension_zip():
    workspace_dir = r"d:\dhruv\Chrome Extension\WaifuWire"
    output_zip = os.path.join(workspace_dir, "WaifuWire_Extension_v1.0.zip")
    
    files_to_include = [
        "manifest.json",
        "background.js",
        "content.js",
        "popup.js",
        "popup.html",
        "popup.css",
        "styles.css"
    ]
    
    dirs_to_include = [
        "images"
    ]
    
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for f in files_to_include:
            file_path = os.path.join(workspace_dir, f)
            if os.path.exists(file_path):
                # arcname uses forward slash explicitly
                zipf.write(file_path, arcname=f)
                
        for d in dirs_to_include:
            dir_path = os.path.join(workspace_dir, d)
            if os.path.exists(dir_path):
                for root, _, files in os.walk(dir_path):
                    for file in files:
                        full_path = os.path.join(root, file)
                        # Construct relative path using forward slashes
                        rel_path = os.path.relpath(full_path, workspace_dir)
                        arc_name = rel_path.replace(os.sep, '/')
                        zipf.write(full_path, arcname=arc_name)

    print(f"Build Complete! Clean extension package is ready at: {output_zip}")

if __name__ == "__main__":
    create_extension_zip()
