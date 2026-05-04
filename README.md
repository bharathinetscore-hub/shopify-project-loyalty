# Shopfy Project

This app does not use a local SQLite `.db` file. It uses PostgreSQL, so when the app is moved to another domain or server you must deploy the code and provide the database environment variables from `.env.example`.

## Setup

1. Copy `.env.example` to `.env` and fill in the Shopify, PostgreSQL, and mail values.
2. Make sure the target server can connect to the PostgreSQL database.
3. Run `npm install`.
4. Run `npm run db:init` once, or just start the app and let startup bootstrap the schema automatically.
5. Run `npm run build`.
6. Run `npm start`.

## Important For Another Domain

- Include the `db/`, `lib/`, `models/`, `migrations/`, and `pages/` folders when deploying.
- The database itself is not a file inside this repo. The new domain needs working `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` values.
- If you want the new domain to use the same data, point it to the same PostgreSQL database or restore a PostgreSQL backup there.
