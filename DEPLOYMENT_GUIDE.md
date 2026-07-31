# SyncStream Hub — Production Deployment & Database Persistence Guide

This document provides an **industry-standard, end-to-end deployment blueprint** for SyncStream Hub. It addresses how to deploy the **Frontend** (Vercel), **Backend** (Render), and critically, how to host **PostgreSQL**, **MongoDB**, and **Redis** in the cloud with **100% data persistence** so user accounts, watch parties, chats, and active room states are never lost.

---

## 1. The Core Cloud Database Persistence Problem

In local development, Docker Compose runs databases inside containers using local disk volumes (`postgres_data`, `mongo_data`, `redis_data`).

In cloud application platforms like Render, Heroku, or Vercel:
- **Web Services are Stateless / Ephemeral**: Free/basic application containers restart, sleep, or move across cloud servers. Any database file written inside a basic container disk is deleted on restart.
- **Solution**: Production databases **MUST** be deployed either on **Managed Database-as-a-Service (DBaaS)** platforms (with dedicated persistent SSD storage and automated backups) OR on a **Self-Hosted VPS** with persistent block storage volumes.

---

## 2. Recommended Cloud Database Options (Free & Paid)

Here is the industry-standard matrix for managed cloud databases vs. self-hosting:

| Database | Free Tier Recommended | Industry Standard Paid | What it Hosts |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | **[Neon.tech](https://neon.tech)** (0.5 GB free, serverless) or **[Supabase](https://supabase.com)** (500 MB free) | AWS RDS / GCP Cloud SQL / Railway ($7–$15/mo) | User Accounts, Auth, Room Permissions, Friendships |
| **MongoDB** | **[MongoDB Atlas](https://www.mongodb.com/cloud/atlas)** (M0 Cluster: 512 MB free forever) | MongoDB Atlas M10 ($0.08/hr) | Watch Party Histories, Chat Logs, Video Analytics |
| **Redis** | **[Upstash Redis](https://upstash.com)** (Serverless, 10k req/day free) or **[Redis Cloud](https://redis.io/cloud)** (30 MB free) | Upstash Pay-as-You-Go / Railway Redis ($3–$5/mo) | Active Watch Room States, Real-Time Playback Sync |

---

## 3. Deployment Blueprint (Step-by-Step)

### Architecture Overview

```
+------------------+         +-------------------------------+         +----------------------------------+
|   Vercel (Free)  |         |      Render Web Service       |         |     Managed Cloud Databases      |
|                  |  HTTPS  |         (Spring Boot)         |  JDBC   |  Neon / Supabase (PostgreSQL)    |
| React + Vite SPA +---------> https://api.syncstream.com     +--------->  (Persistent User/Auth Data)    |
|                  |  WSS    |                               |  Mongo  |  MongoDB Atlas                   |
|                  +---------> WebSockets / STOMP Realtime   +--------->  (Persistent Chat/Party Logs)   |
+------------------+         +---------------+---------------+  Redis  |  Upstash Redis                   |
                                             |                         +--------->  (Active Sync State in RAM) |
                                             +-----------------------------------+----------------------------------+
```

---

### Step 1: Provision Cloud Databases

#### A. PostgreSQL (Neon.tech or Supabase)
1. Sign up at [Neon.tech](https://neon.tech) (or [Supabase.com](https://supabase.com)).
2. Create a new project: `SyncStream-DB`.
3. Copy your database connection string:
   ```text
   postgres://<user>:<password>@ep-sample-123456.us-east-2.aws.neon.tech/SyncStream?sslmode=require
   ```
4. Convert to Spring Boot JDBC format:
   ```text
   jdbc:postgresql://ep-sample-123456.us-east-2.aws.neon.tech:5432/SyncStream?sslmode=require
   ```

#### B. MongoDB (MongoDB Atlas)
1. Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a **Shared M0 (Free)** cluster.
3. Under **Database Access**, create a user (e.g. `syncstream_user` with password).
4. Under **Network Access**, click **Add IP Address** -> Select **Allow Access from Anywhere (`0.0.0.0/0`)** so Render can connect.
5. Click **Connect** -> **Drivers** -> Copy the `mongodb+srv` connection string:
   ```text
   mongodb+srv://syncstream_user:<password>@cluster0.mongodb.net/syncstream?retryWrites=true&w=majority
   ```

#### C. Redis (Upstash Redis)
1. Sign up at [Upstash.com](https://upstash.com).
2. Create a **Redis Database** (Serverless).
3. Copy your connection details:
   - **Host**: `sample-redis-12345.upstash.io`
   - **Port**: `6379` (TLS port)
   - **Password**: `<upstash_password>`

---

### Step 2: Deploy Backend to Render

1. Sign up at [Render.com](https://render.com) and connect your GitHub repository.
2. Click **New +** -> **Web Service**.
3. Choose your repository: `SyncStream Hub`.
4. Configure service settings:
   - **Name**: `syncstream-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Java` (or Docker)
   - **Build Command**: `./mvnw clean package -DskipTests` (or `mvn clean package -DskipTests`)
   - **Start Command**: `java -jar target/hub-0.0.1-SNAPSHOT.jar`
   - **Instance Type**: Free

5. Under **Environment Variables**, add the following cloud variables:

   | Environment Variable Key | Production Value |
   | :--- | :--- |
   | `SPRING_PROFILES_ACTIVE` | `prod` |
   | `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<neon-host>:5432/SyncStream?sslmode=require` |
   | `SPRING_DATASOURCE_USERNAME` | `<neon_username>` |
   | `SPRING_DATASOURCE_PASSWORD` | `<neon_password>` |
   | `SPRING_DATA_MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster0.mongodb.net/syncstream?retryWrites=true&w=majority` |
   | `SPRING_REDIS_HOST` | `<upstash_redis_host>` |
   | `SPRING_REDIS_PORT` | `6379` |
   | `SPRING_REDIS_PASSWORD` | `<upstash_redis_password>` |
   | `SPRING_REDIS_SSL_ENABLED` | `true` |

6. Click **Create Web Service**. Render will build and deploy your Spring Boot API (e.g. `https://syncstream-backend.onrender.com`).

---

### Step 3: Deploy Frontend to Vercel

1. Sign up at [Vercel.com](https://vercel.com) and import your GitHub repository.
2. Project Configuration:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. Under **Environment Variables**, set:
   - `VITE_API_BASE_URL`: `https://syncstream-backend.onrender.com`
   - `VITE_WS_BASE_URL`: `wss://syncstream-backend.onrender.com/ws`

4. Click **Deploy**. Vercel will deploy your React frontend to a global CDN (e.g. `https://syncstream-hub.vercel.app`).

---

## 4. Migrating Local Docker Data to Cloud Databases

To migrate existing local data from your Docker containers to your production cloud databases:

### A. PostgreSQL Data Migration
```bash
# 1. Export local PostgreSQL Docker data to a file
docker exec -t syncstream-postgres pg_dump -U root SyncStream > syncstream_local_backup.sql

# 2. Import into Cloud PostgreSQL (Neon / Supabase)
psql "postgres://<neon_user>:<neon_pass>@<neon_host>/SyncStream?sslmode=require" < syncstream_local_backup.sql
```

### B. MongoDB Data Migration
```bash
# 1. Export local MongoDB Docker data to dump folder
docker exec -t syncstream-mongo mongodump -u root -p Vivek@7986 --authenticationDatabase admin --db syncstream --out /data/db/dump

# 2. Copy dump out of container to host
docker cp syncstream-mongo:/data/db/dump ./mongo_dump

# 3. Restore to MongoDB Atlas Cloud
mongorestore --uri "mongodb+srv://<atlas_user>:<atlas_pass>@cluster0.mongodb.net/syncstream" ./mongo_dump/syncstream
```

---

## 5. Alternative Approach: Single VPS Deployment (Self-Hosted Docker)

If you prefer keeping **everything in Docker** (PostgreSQL + MongoDB + Redis + Backend) on a single cloud server for complete control and low cost:

### Recommended Providers
- **Hetzner Cloud** (CX22 instance: 2 vCPU, 4GB RAM, 40GB NVMe SSD — ~€4/month)
- **DigitalOcean** (Basic Droplet: 2GB RAM, 50GB SSD — ~$12/month)
- **Linode / Akamai** ($10–$12/month)

### How Data Persistence Works on VPS
On a VPS, Docker volumes (`postgres_data`, `mongo_data`, `redis_data`) are stored on the server's persistent SSD disk (`/var/lib/docker/volumes/`). Rebuilding containers or updating code via `git pull && docker compose up -d --build` **will keep 100% of data intact**.

#### Quick VPS Deployment Commands:
```bash
# 1. SSH into your cloud server
ssh root@your-server-ip

# 2. Clone repository
git clone https://github.com/your-username/SyncStream-Hub.git
cd SyncStream-Hub

# 3. Create production .env file with server passwords
nano .env

# 4. Start all services in detached mode
docker compose up -d --build
```

---

## 6. Summary Comparison: Which Deployment Path Should You Choose?

| Criteria | Managed Cloud (Vercel + Render + DBaaS) | Self-Hosted Single VPS (Docker Compose) |
| :--- | :--- | :--- |
| **Cost** | **$0 / month (Free Tier)** | **~$4 to $12 / month** |
| **Data Safety** | 🏆 Automated Cloud Backups (Neon/Atlas) | Manual backups / Volume snapshots required |
| **Maintenance** | 🏆 Zero Server Maintenance | OS patches, Docker security updates |
| **Scalability** | 🏆 Automatic Scaling | Fixed capacity of VPS instance |
| **Setup Complexity** | Low (Web UI configuration) | Medium (SSH, Linux CLI, Nginx/SSL) |
| **Recommendation** | **Best for Production & Portfolios** | **Best for budget self-hosting** |
