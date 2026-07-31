# SyncStream Hub 🎬🍿

SyncStream Hub is a modern, real-time collaborative video watch party platform. It allows users to create virtual rooms, upload videos or embed external video streams, chat with friends, and synchronize video playback (play, pause, seek) seamlessly in real-time using WebSockets.

---

## 🏗️ Architecture Overview

SyncStream Hub uses a decoupled architecture with a **Spring Boot** backend and a **React (Vite + TypeScript)** frontend, powered by a specialized multi-database system designed for scale, speed, and reliability:

```mermaid
graph TD
    Client[React Frontend] <-->|WebSocket / STOMP| BE[Spring Boot Backend]
    Client <-->|REST API| BE
    BE <-->|User Accounts & Auth Data| Postgres[(PostgreSQL)]
    BE <-->|Session History & Chat Logs| Mongo[(MongoDB)]
    BE <-->|Active Room State & Live Cache| Redis[(Redis)]
    BE <-->|Local Video Storage| Disk[(uploaded-videos/)]
```

### Database Responsibilities:
- **PostgreSQL**: Stores structured relational data including User Profiles, Password Credentials, Room Configurations, and Room Permissions.
- **MongoDB**: Handles high-throughput, unstructured write loads such as Chat Message Streams, Session Logs, and Watch Party History logs asynchronously.
- **Redis**: Manages volatile, fast-access in-memory cache data like active room memberships, live playback sync state, and real-time user presence.

---

## ✨ Features

- **Real-Time Video Sync:** Play, pause, and seek events are instantly synchronized across all users in a room using WebSockets (STOMP protocol).
- **Live Group Chat:** Integrated chat feature to discuss scenes with other room members in real-time.
- **Video Uploads & Custom Streams:** Upload local video files (up to 2GB) directly to the platform or stream via external URLs (MP4, HLS/m3u8, YouTube).
- **Room Management:** Create private or public watch party rooms, configure permissions, and invite users via unique room links.
- **User Authentication:** Secure user registration, authentication, and session handling.
- **Asynchronous Session Logging:** Complete watch party logs and chat histories are recorded asynchronously to MongoDB for session review.

---

## ⚙️ Application Profiles & Configuration Management

The backend uses Spring Boot **Active Profiles** to isolate development setups from production configurations.

### Configuration Hierarchy
```text
backend/src/main/resources/
├── application.yml         # Base configuration (Shared defaults & profile activation)
├── application-local.yml   # Active profile for local development & Docker setup
└── application-prod.yml    # (Planned) Production profile for cloud DB deployment
```

- **`application.yml`**: Contains baseline settings shared across all environments (multipart upload limits, application name, logging format). Activates the default profile via environment variable:
  ```yaml
  spring:
    profiles:
      active: ${SPRING_PROFILES_ACTIVE:local}
  ```
- **`application-local.yml`**: Overrides base settings for local development. Pre-configured for local PostgreSQL, MongoDB, and Redis instances (running via Docker or local DB servers).
- **`application-prod.yml` *(Planned / In Progress)***: Environment profile specifically tailored for production deployments. It will manage cloud database connection strings (Neon/Supabase for PostgreSQL, MongoDB Atlas, Upstash Redis) with SSL enabled.

---

## 📥 How Data is Added, Managed, and Stored

Data enters and moves through **SyncStream Hub** via four primary pathways:

### 1. User & Auth Data (PostgreSQL)
- **Ingestion**: When a new user registers or signs in via `/api/auth/register` and `/api/auth/login`, JPA repositories save user credentials and account details to PostgreSQL.
- **Persistence**: Relational schema ensures strict data integrity for user IDs, hashed passwords, and room ownership permissions.

### 2. Room & Active Playback State (PostgreSQL + Redis)
- **Ingestion**: Creating a room via `/api/rooms` creates a master room record in PostgreSQL.
- **Caching**: Active room details, current video position, playback state (playing/paused), and connected socket clients are cached in **Redis** for sub-millisecond retrieval by WebSocket controllers.

### 3. Video Uploads & Storage (Local Disk / Static Handler)
- **Ingestion**: Users can upload video files using the endpoint `POST /api/uploads/video` (Multipart Form Data).
- **File Limit**: Spring Boot is configured to accept video uploads up to **2GB** (`max-file-size: 2GB`).
- **Storage Location**: Uploaded files are assigned a unique UUID filename and stored in the project's root `uploaded-videos/` directory.
- **Serving**: Videos are served to frontend player instances via Spring WebMVC static resource handler mapped to `http://localhost:8080/uploads/{filename}`.

### 4. Chat Logs & Session History (MongoDB)
- **Ingestion**: Real-time chat messages and playback actions dispatched over WebSockets (`/app/chat`, `/app/sync`) are pushed to MongoDB.
- **Persistence**: Mongo document collections (`WatchPartyHistory`, `ChatMessageEntry`, `SessionLogEntry`) log room events asynchronously without blocking real-time WebSocket frames.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18+ with Vite
- **Language:** TypeScript
- **Styling:** CSS3 & Modern Custom Styles
- **Real-Time Sync:** `@stomp/stompjs` & `sockjs-client`

### Backend
- **Framework:** Spring Boot 3.3 (Java 17)
- **Security & Database ORM:** Spring Security, Spring Data JPA, Spring Data MongoDB, Spring Data Redis
- **Real-Time Communications:** Spring WebSocket & STOMP Message Broker
- **Build Tool:** Maven

### Middleware & Storage
- **PostgreSQL:** Relational database for Users & Auth.
- **MongoDB:** NoSQL Document database for Chat Logs & Session Analytics.
- **Redis:** In-memory key-value store for Active Room State & Live Sync.
- **Docker Compose:** Local multi-container database orchestration.

---

## 🚀 Getting Started

### Prerequisites
Ensure you have the following installed on your machine:
- **Java 17 JDK** or higher
- **Node.js (v18+)** & npm
- **Maven**
- **Docker Desktop**

---

### Step 1: Start Databases with Docker
Launch PostgreSQL, MongoDB, and Redis containers in the background:
```bash
docker-compose up -d
```

---

### Step 2: Configure Environment Variables
Copy the `.env.example` file to create your local `.env` file:
```bash
cp .env.example .env
```
Customize your credentials in `.env`:
```env
DB_PASSWORD=your_secure_password
SPRING_DATASOURCE_PASSWORD=your_secure_password
SPRING_DATA_MONGODB_URI=mongodb://root:your_secure_password@localhost:27017/syncstream?authSource=admin
```

---

### Step 3: Run Backend Service
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Run Spring Boot (loads `application-local.yml` by default):
   ```bash
   mvn spring-boot:run
   ```
The backend server will launch at `http://localhost:8080`.

---

### Step 4: Run Frontend Application
1. In a new terminal window, navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies & start Vite dev server:
   ```bash
   npm install
   npm run dev
   ```
The frontend application will open at `http://localhost:5173`.

---

## 📁 Repository Structure

```text
SyncStream Hub/
│
├── backend/                              # Spring Boot Java application
│   ├── src/main/java/com/syncstream/hub/ # Application logic (Controllers, Services, Models)
│   ├── src/main/resources/               # Application profiles & configuration
│   │   ├── application.yml               # Base configuration file
│   │   ├── application-local.yml         # Local development profile override
│   │   └── application-prod.yml          # (Planned) Production profile override
│   └── pom.xml                           # Maven dependencies & build setup
│
├── frontend/                             # React TypeScript SPA
│   ├── src/                              # Components, WebSocket hooks, pages, styles
│   ├── package.json                      # Frontend dependencies & scripts
│   └── vite.config.ts                    # Vite configuration
│
├── uploaded-videos/                      # Server-side directory for uploaded video files
├── docker-compose.yml                    # Multi-container DB service definitions
├── DATABASE_PERSISTENCE_GUIDE.md         # In-depth database persistence & inspection guide
├── DEPLOYMENT_GUIDE.md                   # Cloud & VPS production deployment blueprint
├── .env.example                          # Environment variables template
└── README.md                             # Project documentation
```

---

## 📚 Dedicated Documentation Guides

For in-depth explanations on database management and production deployment, refer to the dedicated guide files in the root folder:

- 📖 **[DATABASE_PERSISTENCE_GUIDE.md](file:///c:/Users/Vivek/Documents/Java/SyncStream%20Hub/DATABASE_PERSISTENCE_GUIDE.md)**: Detailed breakdown of database storage engines (WiredTiger, Relational Heap/WAL, Redis AOF), Docker volumes, accessing data via GUI clients (MongoDB Compass, DBeaver, Redis Insight) or CLI, and automated database backups.
- 🚀 **[DEPLOYMENT_GUIDE.md](file:///c:/Users/Vivek/Documents/Java/SyncStream%20Hub/DEPLOYMENT_GUIDE.md)**: End-to-end production deployment blueprint for Vercel (Frontend), Render (Backend), Managed Cloud DBs (Neon/Supabase PostgreSQL, MongoDB Atlas, Upstash Redis), or single self-hosted VPS deployment.

---

## 🔒 Security Best Practices
- **Environment Isolation:** Secrets (database passwords, API keys) are kept in `.env` and `application-local.yml` (ignored by Git).
- **Target Exclusions:** Build outputs (`backend/target/`, `frontend/node_modules/`, `uploaded-videos/*`) are ignored via `.gitignore`.
- **Production Overrides:** When deploying to production (`application-prod.yml`), inject credentials via platform environment variables rather than storing hardcoded strings.

