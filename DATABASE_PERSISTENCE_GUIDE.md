# Comprehensive Data Storage, Data Persistence, and Access Guide

This document provides a detailed, structured guide on how data is stored, persisted, and accessed in **SyncStream Hub** across **MongoDB**, **PostgreSQL**, and **Redis** when running inside Docker containers.

---

## 1. How Data is Stored in Databases & Docker

In Dockerized environments, data storage is decoupled into two layers:
1. **Inside the Database Engine** (Logical/Internal Storage Format)
2. **Inside Docker Storage** (Physical Storage Mechanism on Host)

```
+-------------------------------------------------------------------------------+
|                                Host Machine                                   |
|                                                                               |
|  +-------------------------------------------------------------------------+  |
|  |                           Docker Engine                                 |  |
|  |                                                                         |  |
|  |  +-----------------------+  +-------------------+  +-----------------+  |  |
|  |  |   syncstream-postgres |  |  syncstream-mongo |  | syncstream-redis|  |  |
|  |  |      (PostgreSQL)     |  |     (MongoDB)     |  |     (Redis)     |  |  |
|  |  +-----------+-----------+  +---------+---------+  +--------+--------+  |  |
|  |              |                        |                     |           |  |
|  +--------------|------------------------|---------------------|-----------+  |
|                 |                        |                     |              |
|                 v                        v                     v              |
|       +-------------------+    +------------------+   +------------------+    |
|       |   postgres_data   |    |    mongo_data    |   |    redis_data    |    |
|       |   (Docker Volume) |    |  (Docker Volume) |   |  (Docker Volume) |    |
|       +-------------------+    +------------------+   +------------------+    |
+-------------------------------------------------------------------------------+
```

### A. MongoDB (`syncstream-mongo`)
- **Internal Storage Engine**: WiredTiger.
- **How Data is Stored**: MongoDB writes collections and documents into BSON format. WiredTiger manages data files (`.wt`), index files, and write-ahead transaction logs (`journal/`) inside the container directory `/data/db`.
- **Docker Storage**: The `/data/db` directory inside the container is mapped to the named Docker volume **`mongo_data`**.

### B. PostgreSQL (`syncstream-postgres`)
- **Internal Storage Engine**: PostgreSQL Storage Manager (Relational Heap & WAL).
- **How Data is Stored**: Tables, rows, indexes, and Write-Ahead Logs (WAL) are stored as 8KB binary pages inside `/var/lib/postgresql/data`.
- **Docker Storage**: The `/var/lib/postgresql/data` directory is mapped to the named Docker volume **`postgres_data`**.

### C. Redis (`syncstream-redis`)
- **Internal Storage Engine**: In-Memory Data Structure Store with AOF (Append-Only File) persistence.
- **How Data is Stored**: Primary operations run directly in RAM. With `--appendonly yes` enabled in `docker-compose.yml`, every write command is logged sequentially to `appendonly.aof` on disk in `/data`.
- **Docker Storage**: The `/data` directory is mapped to the named Docker volume **`redis_data`**.

---

## 2. Will Data Be Lost? (Scenarios & Data Safety Matrix)

Data retention depends on whether actions affect **Containers**, **Images**, or **Volumes**.

| Action / Command | Will Data Be Lost? | Explanation |
| :--- | :---: | :--- |
| `docker stop` / `docker restart` | **NO** | The container state and volume remain completely intact. |
| `docker rm <container>` or `docker compose down` | **NO** | Containers are ephemeral, but Docker **Named Volumes** persist independently on your machine. |
| `docker rmi <image>` (Remove Images) | **NO** | Images store application code/binaries. Data resides in volumes, which are unaffected. |
| Re-building Docker containers (`docker compose up --build`) | **NO** | Container instances are recreated, but re-attached to the existing volumes (`postgres_data`, `mongo_data`, `redis_data`). |
| `docker compose down -v` | **YES** ⚠️ | The `-v` flag explicitly tells Docker to **delete named volumes**. |
| `docker volume rm <volume_name>` or `docker system prune --volumes` | **YES** ⚠️ | Deletes the storage volume containing the database files. |
| **Uninstalling Docker Desktop (Windows)** | **YES** ⚠️ *(High Risk)* | Docker Desktop on Windows stores volumes inside the default WSL2 virtual disk (`docker-desktop-data` distro / `ext4.vhdx`). Uninstalling Docker Desktop typically deletes this distro and all stored volume data. |

> [!CAUTION]
> **Key Takeaway**: Stopping, removing, or rebuilding containers will **NOT** delete your data. Data loss only occurs if you explicitly purge Docker volumes (`docker compose down -v`, `docker volume rm`) or uninstall Docker Desktop without backing up WSL2 distributions.

---

## 3. How to Access and Inspect Data

Since databases run inside Docker containers, they expose host ports defined in `docker-compose.yml`:
- **MongoDB**: `localhost:27017`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

You can access and inspect your data using **GUI Client Applications**, **VS Code Extensions**, **Command Line (CLI)**, or **Physical File Paths**.

---

### A. Accessing MongoDB Data

#### Method 1: GUI — MongoDB Compass (Recommended - Similar to MongoDB Atlas)
You do **NOT** need MongoDB Atlas to use MongoDB Compass. Compass works seamlessly with local Docker instances.

1. Download & open [MongoDB Compass](https://www.mongodb.com/try/download/compass).
2. Connect using the following URI (matches `docker-compose.yml` credentials):
   ```text
   mongodb://root:mongo_password@localhost:27017/?authSource=admin
   ```
   *(Note: Replace `mongo_password` with your actual `${DB_PASSWORD}` environment variable if customized)*
3. Click **Connect**. You will see all your databases, collections, schema graphs, and document contents visually, exactly like in Atlas.

#### Method 2: GUI — VS Code Extension
1. Install **MongoDB for VS Code** extension in VS Code.
2. Click the MongoDB icon in the activity bar -> **Add Connection**.
3. Paste: `mongodb://root:mongo_password@localhost:27017/?authSource=admin`
4. Expand databases and collections directly within your editor.

#### Method 3: CLI — Interactive `mongosh` via Docker
Run the MongoDB Shell directly inside the running container:
```bash
docker exec -it syncstream-mongo mongosh -u root -p mongo_password --authenticationDatabase admin
```
Inside the shell:
```javascript
show dbs;
use <your_db_name>;
show collections;
db.<collection_name>.find().pretty();
```

---

### B. Accessing PostgreSQL Data

#### Method 1: GUI — DBeaver / pgAdmin / TablePlus (Recommended)
You can connect any standard PostgreSQL GUI management tool to `localhost:5432`.

**Connection Parameters**:
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `SyncStream`
- **Username**: `root`
- **Password**: `postgres_password` *(or your custom `${DB_PASSWORD}`)*

**Steps in DBeaver**:
1. Open DBeaver -> New Database Connection -> Select **PostgreSQL**.
2. Fill in Host: `localhost`, Port: `5432`, Database: `SyncStream`, User: `root`, Password: `postgres_password`.
3. Click **Test Connection** -> **Finish**.
4. Expand `SyncStream` -> `Schemas` -> `public` -> `Tables` to view, edit, and query records visually.

#### Method 2: GUI — VS Code Extension
1. Install **PostgreSQL** or **Database Client** extension in VS Code.
2. Add connection using Host: `localhost`, Port: `5432`, Database: `SyncStream`, User: `root`, Password: `postgres_password`.

#### Method 3: CLI — Interactive `psql` via Docker
Run the `psql` interactive terminal inside the PostgreSQL container:
```bash
docker exec -it syncstream-postgres psql -U root -d SyncStream
```
Inside `psql`:
```sql
\dt                  -- List all tables
SELECT * FROM users; -- Query data from a table
\q                   -- Exit
```

---

### C. Accessing Redis Data

#### Method 1: GUI — Redis Insight (Recommended)
[Redis Insight](https://redis.io/insight/) is the official GUI visualizer for Redis.

1. Launch Redis Insight.
2. Click **Add Redis Database**.
3. Set **Host**: `localhost`, **Port**: `6379`. (No password required based on current `docker-compose.yml`).
4. Browse keys, inspect key-value pairs, pub/sub channels, TTL timers, and data structures (Strings, Hashes, Lists, Sets).

#### Method 2: CLI — Interactive `redis-cli` via Docker
Execute `redis-cli` inside the container:
```bash
docker exec -it syncstream-redis redis-cli
```
Inside `redis-cli`:
```text
KEYS *               -- Show all cached keys
GET <key_name>       -- Get value of a specific key
HGETALL <hash_name>  -- Get all fields in a hash
PING                 -- Test connection (returns PONG)
```

---

### D. Physical Storage Location on Host Machine

If you are curious where Docker physically stores volume files on your machine:

#### Windows (Docker Desktop with WSL2 Engine):
Docker manages volumes inside a dedicated WSL distribution (`docker-desktop-data`).
- You can explore physical volume files via Windows File Explorer by navigating to:
  ```text
  \\wsl$\docker-desktop-data\data\docker\volumes\
  ```
- Under this directory, you will see folders:
  - `\\wsl$\docker-desktop-data\data\docker\volumes\SyncStream Hub_postgres_data\_data`
  - `\\wsl$\docker-desktop-data\data\docker\volumes\SyncStream Hub_mongo_data\_data`
  - `\\wsl$\docker-desktop-data\data\docker\volumes\SyncStream Hub_redis_data\_data`

> [!WARNING]
> Do **NOT** directly modify or manipulate files inside the `_data` host directories while containers are running, as this can corrupt database indexes and transaction logs. Always use database management tools (Compass, DBeaver, Redis Insight, or CLI) to read and modify data safely.

---

## 4. Best Practices for Data Safety & Backup

To ensure you never lose data when upgrading Docker or moving machines, use export/dump tools:

### PostgreSQL Backup & Restore
```bash
# Dump PostgreSQL database to a SQL file on host
docker exec -t syncstream-postgres pg_dump -U root SyncStream > backup_postgres.sql

# Restore PostgreSQL database from SQL file
docker exec -i syncstream-postgres psql -U root -d SyncStream < backup_postgres.sql
```

### MongoDB Backup & Restore
```bash
# Dump MongoDB collections to a archive file
docker exec -t syncstream-mongo mongodump -u root -p mongo_password --authenticationDatabase admin --archive=/data/db/backup.archive

# Restore MongoDB collections
docker exec -i syncstream-mongo mongorestore -u root -p mongo_password --authenticationDatabase admin --archive=/data/db/backup.archive
```

### Redis Snapshot
Redis continuously appends updates to `/data/appendonly.aof` inside the volume. Running `docker exec syncstream-redis redis-cli BGSAVE` forces an instant snapshot to `dump.rdb`.
