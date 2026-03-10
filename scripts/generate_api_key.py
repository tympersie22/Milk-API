from app.core.security import generate_api_key, hash_api_key


if __name__ == "__main__":
    key = generate_api_key("test")
    print(f"key={key}")
    print(f"sha256={hash_api_key(key)}")
