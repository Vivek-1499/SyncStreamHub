# Cloud Services Setup & Integration Guide

This guide provides step-by-step instructions on setting up free-tier cloud database services (**MongoDB Atlas**, **Upstash Redis**, and **Supabase PostgreSQL**) for **SyncStream Hub**, configuring environment profiles (`application-local.yml` vs `application-prod.yml`), and testing locally or in production.

---

## 1. Overview & Architecture

SyncStream Hub supports two environment profiles for data persistence:

| Feature | `local` Profile (`application-local.yml`) | `prod` Profile (`application-prod.yml`) |
| :--- | :--- | :--- |
| **Primary Use Case** | Offline local development | Production deployment / Cloud testing |
| **PostgreSQL** | Local Docker container (`localhost:5432`) | **Supabase** Cloud PostgreSQL (`db.xxxx.supabase.co:5432`) |
| **MongoDB** | Local Docker container (`localhost:27017`) | **MongoDB Atlas** Cloud Cluster (`mongodb+srv://...`) |
| **Redis** | Local Docker container (`localhost:6379`) | **Upstash Redis** Cloud (`xxxx.upstash.io:6379`, SSL/TLS) |
| **Persistence** | Docker Volumes (`postgres_data`, `mongo_data`, `redis_data`) | Cloud Service Automatic Storage & Backup |

---

## 2. MongoDB Atlas Setup Guide (Free Tier)

### Step 1: Create a Free MongoDB Atlas Account
1. Visit [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. Sign up with Google or Email.
3. Complete the quick initial questionnaire (select **M0 Free Tier**).

### Step 2: Create an M0 Free Cluster
1. On the Atlas Dashboard, click **Create Deployment** or **Build a Database**.
2. Select **M0 (Free Forever)**.
3. Provider & Region: Choose AWS or GCP in the region closest to you (e.g., `N. Virginia (us-east-1)` or `Mumbai (ap-south-1)`).
4. Cluster Name: Set cluster name (e.g., `SyncStreamCluster`).
5. Click **Create**.

### Step 3: Create Database Credentials
1. In the **Security Quickstart** prompt (or navigate to **Database Access** under Security):
   - Select **Password** authentication.
   - Set **Username** (e.g., `syncstream_admin`).
   - Set a strong **Password** (or click **Autogenerate Secure Password** and copy it).
2. Click **Create Database User**.

> [!IMPORTANT]
> If your password contains special characters (like `@`, `#`, `$`, `/`, `:`, `%`), you must URL-encode them in connection strings (e.g., `@` becomes `%40`).

### Step 4: Configure Network Access (IP Whitelist)
1. Go to **Network Access** under Security in the left sidebar.
2. Click **Add IP Address**.
3. Select **Allow Access From Anywhere** (`0.0.0.0/0`) so that both your local machine and hosting providers (Render, Railway, AWS) can connect.
4. Click **Confirm**.

### Step 5: Get Connection String
1. Go to **Database** in the left sidebar and click **Connect** next to your cluster.
2. Select **Drivers** (Node.js/Java/Python).
3. Copy the **Connection String**. It will look like this:
   ```text
   mongodb+srv://<username>:<password>@syncstreamcluster.xxxx.mongodb.net/syncstream?retryWrites=true&w=majority
   ```
4. Replace `<username>` and `<password>` with your database user credentials.

---

## 3. Upstash Redis Setup Guide (Free Tier)

### Step 1: Create an Upstash Account
1. Visit [Upstash Console](https://console.upstash.com/).
2. Sign up with GitHub, Google, or Email.

### Step 2: Create a Redis Database
1. Click **Create Database**.
2. **Name**: `syncstream-redis`
3. **Type**: Redis
4. **Region**: Select a region close to your deployment/backend location.
5. **Primary Zone**: Multi-zone or single-zone (Free tier supported).
6. **TLS (SSL)**: Keep enabled (Upstash requires SSL by default).
7. Click **Create**.

### Step 3: Copy Connection Details
On your database details page, locate the **Connect** or **Details** tab:
1. **Endpoint (Host)**: `xxxx-xxxx-xxxxx.upstash.io`
2. **Port**: `6379`
3. **Password**: Copy the generated password.

### Step 4: Understanding Spring Boot SSL with Upstash
Upstash uses TLS/SSL over port 6379. In Spring Boot `application-prod.yml`, Redis SSL is enabled via:
```yaml
spring:
  data:
    redis:
      host: ${SPRING_REDIS_HOST}
      port: ${SPRING_REDIS_PORT:6379}
      password: ${SPRING_REDIS_PASSWORD}
      ssl:
        enabled: true
```

---

## 4. Supabase PostgreSQL Setup Guide

### Step 1: Get Supabase Database Credentials
1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project -> Go to **Project Settings** -> **Database**.
3. Under **Connection string**, select **JDBC**.
4. Note your host, port (`5432`), user (`postgres`), and password.
   Format:
   ```text
   jdbc:postgresql://db.<project-ref>.supabase.co:5432/postgres?sslmode=require
   ```

---

## 5. Integrating with SyncStream Hub Backend

### Option A: Testing Locally with Local Docker (`local` Profile)
By default, running the backend uses the `local` profile, connecting to local Docker containers:

1. Ensure Docker Desktop is running and launch local containers:
   ```bash
   docker compose up -d
   ```
2. Start the Spring Boot backend:
   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```
   *(Or set `SPRING_PROFILES_ACTIVE=local` in your IDE/run configuration)*

---

### Option B: Testing Production Cloud Services Locally (`prod` Profile)

You can test your cloud services (Supabase, MongoDB Atlas, Upstash Redis) directly on your local development machine without deploying!

#### Method 1: Using `.env` File
Update your `.env` file at the root of the project with your cloud credentials:

```env
SPRING_PROFILES_ACTIVE=prod

# Supabase Postgres Credentials
SPRING_DATASOURCE_URL=jdbc:postgresql://db.oulrflxzcfvstdnnxnfz.supabase.co:5432/postgres?sslmode=require
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=YourSupabasePassword

# MongoDB Atlas URI
SPRING_DATA_MONGODB_URI=mongodb+srv://syncstream_admin:YourAtlasPassword@syncstreamcluster.xxxx.mongodb.net/syncstream?retryWrites=true&w=majority

# Upstash Redis Credentials
SPRING_REDIS_HOST=glowing-cat-12345.upstash.io
SPRING_REDIS_PORT=6379
SPRING_REDIS_PASSWORD=YourUpstashPassword
SPRING_REDIS_SSL_ENABLED=true
```

#### Method 2: Command Line Maven Flag
Run the Spring Boot application with the `prod` profile flag:
```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=prod -Dspring.data.mongodb.uri="mongodb+srv://..." -Dspring.redis.host="your-upstash.upstash.io" -Dspring.redis.password="yourpassword"
```

---

### Option C: Deploying to Production Cloud (Render, Railway, Fly.io, AWS)

When deploying your backend JAR/container to a production cloud server:

Set the following environment variables in your cloud hosting provider dashboard:

| Variable Name | Value Description |
| :--- | :--- |
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://db.<ref>.supabase.co:5432/postgres?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` | `postgres` |
| `SPRING_DATASOURCE_PASSWORD` | `<your-supabase-db-password>` |
| `SPRING_DATA_MONGODB_URI` | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/syncstream?retryWrites=true&w=majority` |
| `SPRING_REDIS_HOST` | `<your-upstash-host>.upstash.io` |
| `SPRING_REDIS_PORT` | `6379` |
| `SPRING_REDIS_PASSWORD` | `<your-upstash-password>` |
| `SPRING_REDIS_SSL_ENABLED` | `true` |

---

## 6. Verification & Troubleshooting

### 1. MongoDB Atlas Connection Timeout
- **Symptom**: `MongoTimeoutException: Timed out after 30000 ms`
- **Fix**: Check Atlas **Network Access** -> Ensure `0.0.0.0/0` is added to IP Whitelist.

### 2. Upstash Redis Connection Failure
- **Symptom**: `RedisConnectionException` or SSL handshake error.
- **Fix**: Verify `SPRING_REDIS_SSL_ENABLED=true` is set. Upstash requires TLS/SSL on port 6379.

### 3. PostgreSQL SSL Mode Error
- **Symptom**: `PSQLException: SSL connection error`
- **Fix**: Ensure your JDBC URL includes `?sslmode=require` (e.g., `jdbc:postgresql://db.xxxx.supabase.co:5432/postgres?sslmode=require`).
