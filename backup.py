import os
import shutil
import re
from pathlib import Path

# Percorsi
SOURCE_DIR = r"C:\Users\marco\Desktop\DARKORBIT"
BACKUP_BASE_DIR = r"C:\Users\marco\Desktop\VERTEXORBIT-BACKUP"

def get_latest_version():
    """Trova l'ultima versione del backup"""
    if not os.path.exists(BACKUP_BASE_DIR):
        os.makedirs(BACKUP_BASE_DIR)
        return 0.0
    
    folders = [f for f in os.listdir(BACKUP_BASE_DIR) if os.path.isdir(os.path.join(BACKUP_BASE_DIR, f))]
    
    max_version = 0.0
    pattern = r"VERTEXORBIT V(\d+(?:\.\d+)?)"
    
    for folder in folders:
        match = re.search(pattern, folder)
        if match:
            version = float(match.group(1))
            if version > max_version:
                max_version = version
    
    return max_version

def copy_project(src, dst):
    """Copia il progetto escludendo node_modules"""
    print(f"Copiando da {src} a {dst}...")
    
    for item in os.listdir(src):
        if item == "node_modules":
            print(f"Saltando la cartella node_modules...")
            continue
        
        source_path = os.path.join(src, item)
        dest_path = os.path.join(dst, item)
        
        try:
            if os.path.isdir(source_path):
                shutil.copytree(source_path, dest_path, ignore=shutil.ignore_patterns('node_modules'))
                print(f"Copiata cartella: {item}")
            else:
                shutil.copy2(source_path, dest_path)
                print(f"Copiato file: {item}")
        except Exception as e:
            print(f"Errore durante la copia di {item}: {e}")

def main():
    print("=== BACKUP VERTEXORBIT ===\n")
    
    # Chiedi il TAG all'utente
    tag = input("Inserisci un TAG per questo backup (es. 'Fix Chat', 'New Feature'): ").strip()
    print()
    
    # Trova l'ultima versione
    latest_version = get_latest_version()
    new_version = latest_version + 0.1
    
    # Crea il nome della nuova cartella con il TAG
    if tag:
        new_folder_name = f"VERTEXORBIT V{new_version:.1f} {tag}"
    else:
        new_folder_name = f"VERTEXORBIT V{new_version:.1f}"
    
    new_backup_path = os.path.join(BACKUP_BASE_DIR, new_folder_name)
    
    print(f"Ultima versione trovata: V{latest_version:.1f}")
    print(f"Creazione nuova versione: V{new_version:.1f}")
    if tag:
        print(f"TAG: {tag}")
    print()
    
    # Crea la cartella di backup
    if os.path.exists(new_backup_path):
        print(f"ATTENZIONE: La cartella {new_folder_name} esiste già!")
        response = input("Vuoi sovrascriverla? (s/n): ")
        if response.lower() != 's':
            print("Backup annullato.")
            return
        shutil.rmtree(new_backup_path)
    
    os.makedirs(new_backup_path)
    print(f"Cartella creata: {new_folder_name}\n")
    
    # Copia i file
    copy_project(SOURCE_DIR, new_backup_path)
    
    print(f"\n=== BACKUP COMPLETATO ===")
    print(f"Percorso: {new_backup_path}")

if __name__ == "__main__":
    try:
        main()
        input("\nPremi INVIO per chiudere...")
    except Exception as e:
        print(f"\nERRORE: {e}")
        input("\nPremi INVIO per chiudere...")
