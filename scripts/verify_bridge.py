import requests
import sys

# Configuration
BRIDGE_URL = "http://localhost:3737"

def main():
    print(f"Testing API Bridge at {BRIDGE_URL}...")
    
    # 1. Check if server is reachable
    try:
        resp = requests.get(f"{BRIDGE_URL}/api/paths")
        if resp.status_code != 200:
            print(f"❌ Server reachable but returned {resp.status_code}")
            sys.exit(1)
        print("✅ Server reachable")
        paths = resp.json()
        print(f"   Authorized folders: {len(paths)}")
        for pid, ppath in paths.items():
            print(f"   - {pid}: {ppath}")
            
        if not paths:
            print("⚠️ No folders authorized. Please use the UI to authorize a folder first.")
            return

        # 2. Pick first folder and list it
        path_id = list(paths.keys())[0]
        print(f"\n📂 Listing directory context for path_id: {path_id}")
        
        resp = requests.post(f"{BRIDGE_URL}/api/file/list", json={
            "path_id": path_id,
            "relative_path": None
        })
        
        if resp.status_code == 200:
            data = resp.json()
            if data['success']:
                print(f"✅ List success. Found {len(data['files'])} files.")
                for f in data['files'][:5]:
                    print(f"   - {f['name']} ({'DIR' if f['is_dir'] else 'FILE'})")
            else:
                print(f"❌ List failed: {data.get('error')}")
        else:
             print(f"❌ List request failed: {resp.status_code}")

    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Is the Tauri app running?")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
