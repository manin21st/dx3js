from cryptography.fernet import Fernet
import os

# Define file paths relative to the script location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KEY_FILE = os.path.join(BASE_DIR, 'secret.key')
CONFIG_FILE = os.path.join(BASE_DIR, 'config.ini')
ENCRYPTED_CONFIG_FILE = os.path.join(BASE_DIR, 'config.ini.enc')

def generate_key():
    """Generates a key and saves it into a file."""
    key = Fernet.generate_key()
    with open(KEY_FILE, "wb") as key_file:
        key_file.write(key)
    return key

def load_key():
    """Loads the key from the current directory."""
    return open(KEY_FILE, "rb").read()

# --- Main execution ---
# If secret.key does not exist, generate one.
if not os.path.exists(KEY_FILE):
    print("Secret key not found. Generating a new one...")
    key = generate_key()
    print(f"New key generated and saved to {KEY_FILE}")
else:
    key = load_key()
    print("Secret key loaded.")

# Encrypt the config file
f = Fernet(key)

with open(CONFIG_FILE, "rb") as file:
    # read all file data
    file_data = file.read()

encrypted_data = f.encrypt(file_data)

with open(ENCRYPTED_CONFIG_FILE, "wb") as file:
    file.write(encrypted_data)

print(f"Successfully encrypted '{CONFIG_FILE}' to '{ENCRYPTED_CONFIG_FILE}'")
