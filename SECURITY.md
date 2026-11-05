# Security

## API keys

NovelMatch does not ship with an API key and does not operate a shared AI gateway.

- The API key is stored in the operating system credential store (Windows Credential Manager through `keyring`).
- The key is not written to SQLite, source code, logs, or the frontend after saving.
- Do not paste real API keys into GitHub issues, screenshots, demonstrations, or pull requests.

## Local data

Profiles, reference books, ratings, and evaluation records are stored in the user data directory, outside the application installation directory. The repository does not include user databases or credentials.

## Reporting

If you find a security issue, please open a minimal issue without including secrets or personal data, or contact the repository owner privately.
