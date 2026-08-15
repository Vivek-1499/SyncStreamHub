# SyncStream Hub 🎬🍿

> 🌐 **Live Application:** [https://syncstreamhub.pages.dev/](https://syncstreamhub.pages.dev/)

SyncStream Hub is a modern, high-performance real-time collaborative video watch party platform. It enables users to create public or private virtual watch party rooms, upload videos (via Cloudflare R2 cloud storage or local disk) or embed external streams (YouTube, HLS/m3u8, direct MP4), chat live with friends, manage party invitations, and synchronize video playback (play, pause, seek) seamlessly in real-time with sub-second accuracy using WebSockets.

---

## 🌐 Live Demo & Deployment Architecture

- **Frontend Hosting:** Deployed globally via **Cloudflare Pages** at [https://syncstreamhub.pages.dev/](https://syncstreamhub.pages.dev/).
- **Backend Hosting:** Powered by a Spring Boot application running on **AWS EC2**, serving REST APIs and WebSocket (STOMP) connections.
- **Media Storage:** Integrated with **Cloudflare R2** for fast, edge-cached video object storage with local storage fallback.

---

## 🏗️ Architecture Overview

SyncStream Hub utilizes a decoupled, event-driven architecture combining a **React (Vite + TypeScript)** frontend with a **Spring Boot** backend, supported by a multi-database architecture tailored for performance, security, and real-time reliability:

```mermaid
graph TD
    Client["React Frontend (Cloudflare Pages)"] <-->|WebSocket / STOMP| BE["Spring Boot Backend (AWS EC2)"]
    Client <-->|REST API| BE
    BE <-->|User Accounts & Auth Data| Postgres[(PostgreSQL)]
    BE <-->|Session History & Chat Logs| Mongo[(MongoDB)]
    BE <-->|Active Room State & Live Cache| Redis[(Redis)]
    BE <-->|Cloud Media Uploads| R2["Cloudflare R2 Storage"]
    BE <-->|Local Video Fallback| Disk["uploaded-videos/"]
```

### Multi-Database Responsibilities:
- **PostgreSQL**: Stores core relational data including User Accounts, Hashed Credentials, Room Configurations, Friends system, and Ownership/Permissions.
- **MongoDB**: High-throughput NoSQL document store handling Chat Message Streams, Watch Party History logs, and Session Analytics asynchronously without blocking real-time frames.
- **Redis**: High-speed in-memory store managing live playback state, active room memberships, socket sessions, and automated empty room purging.
- **Cloudflare R2 / Disk**: Scalable video blob storage for uploaded user videos, served via CDN public URLs or static backend handlers.

---

## ✨ Core Features & Recent Enhancements

- **⚡ Real-Time Video Sync (100% Event-Driven):** Instant, sub-second sync for Play, Pause, and Seek events using WebSockets (STOMP over SockJS) without periodic network polling loops.
- **🎯 High-Precision Playback Stabilization:** Fixed `ReactPlayer` re-render infinite loops (`onReady` guards and `useCallback` memoization), ensuring stutter-free synchronized video playback for both host and viewers.
- **👥 Friends & Party Invite System:** Send and accept friend requests, check online status, invite friends directly to active watch party rooms, and manage viewer/host reclaim edge cases.
- **🔒 Room Privacy & Controls:** Create public or private watch parties with customizable room permissions, viewer access, and host control locks.
- **☁️ Cloudflare R2 Storage Integration:** Seamless video file uploading directly to Cloudflare R2 bucket storage with automatic fallback to local disk storage.
- **💬 Real-Time Group Chat & Reactions:** Integrated live chat with message persistence to MongoDB and instant broadcast to all room members.
- **📱 Responsive & Glassmorphic UI:** Modern UI crafted with custom glassmorphism styling, responsive layouts for mobile/desktop, custom Popcorn Play branding/favicon, and OpenGraph SEO cards.

---

## ⚙️ Application Profiles & Configuration Management

The backend utilizes Spring Boot **Active Profiles** to isolate local development from cloud production setups.

### Configuration Hierarchy
```text
backend/src/main/resources/
├── application.yml         # Base configuration (Shared defaults & profile activation)
├── application-local.yml   # Active profile for local development & Docker container setup
└── application-prod.yml    # Production profile for AWS EC2 & Cloud DB deployment (SSL, R2 storage)
```

- **`application.yml`**: Baseline settings shared across environments (multipart upload limit up to 2GB, application naming, R2 cloud storage property structure). Activates profile via environment variable:
  ```yaml
  spring:
    profiles:
      active: ${SPRING_PROFILES_ACTIVE:local}
  ```
- **`application-local.yml`**: Overrides base settings for local execution against Docker containers (PostgreSQL, MongoDB, Redis).
- **`application-prod.yml`**: Production profile for AWS EC2 deployment connecting to cloud-hosted databases (Neon/Supabase PostgreSQL, MongoDB Atlas, Upstash Redis) and Cloudflare R2 bucket credentials.

---

## 📥 How Data is Managed and Stored

Data flows through **SyncStream Hub** via five main pathways:

1. **User Accounts & Auth (PostgreSQL):** Registered users and authentication credentials handled via `/api/auth/register` and `/api/auth/login` using Spring Data JPA.
2. **Room & Playback State (PostgreSQL + Redis):** Master room metadata is stored in PostgreSQL, while active playback positions, play/pause flags, and connected users are cached in Redis for low-latency WebSocket synchronization.
3. **Video Uploads & Storage (Cloudflare R2 / Local Disk):** Multipart uploads (`POST /api/uploads/video`) are streamed directly to Cloudflare R2 object storage when enabled (`R2_ENABLED=true`), or stored in the local `uploaded-videos/` directory.
4. **Chat Logs & Session History (MongoDB):** Chat messages and room action streams (`/app/chat`, `/app/sync`) are persisted asynchronously to MongoDB collections (`WatchPartyHistory`, `ChatMessageEntry`).
5. **Friends & Party Invites (PostgreSQL):** Friend relationships and room invitations are maintained in PostgreSQL relational tables for fast access and status updates.

---

## 🛠️ Tech Stack

### Frontend
- **Hosting:** Cloudflare Pages
- **Framework:** React 18+ with Vite
- **Language:** TypeScript
- **Styling:** CSS3 & Modern Glassmorphic Design System
- **Real-Time Sync:** `@stomp/stompjs` & `sockjs-client`

### Backend
- **Hosting:** AWS EC2
- **Framework:** Spring Boot 3.3 (Java 17)
- **Security & Persistence:** Spring Security, Spring Data JPA, Spring Data MongoDB, Spring Data Redis
- **Real-Time Communications:** Spring WebSocket & STOMP Message Broker
- **Build Tool:** Maven

### Storage & Infrastructure
- **Cloudflare R2:** Cloud object storage for uploaded video streams.
- **PostgreSQL:** Relational database for Users, Friends, and Room metadata.
- **MongoDB:** Document store for Chat logs & Session history.
- **Redis:** In-memory cache for Live Room State & Socket session management.
- **Docker Compose:** Multi-container orchestration for local development.

---

## 🚀 Getting Started

### Prerequisites
Ensure you have installed:
- **Java 17 JDK** or higher
- **Node.js (v18+)** & npm
- **Maven**
- **Docker Desktop**

---

### Step 1: Start Local Databases with Docker
Launch PostgreSQL, MongoDB, and Redis containers in the background:
```bash
docker-compose up -d
```

---

### Step 2: Configure Environment Variables
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```
Customize credentials in `.env`:
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
The backend server will start at `http://localhost:8080`.

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
│   │   └── application-prod.yml          # Production profile override
│   └── pom.xml                           # Maven dependencies & build setup
│
├── frontend/                             # React TypeScript SPA
│   ├── src/                              # Components, WebSocket hooks, pages, styles
│   ├── public/                           # Favicon & static assets
│   ├── package.json                      # Frontend dependencies & scripts
│   └── vite.config.ts                    # Vite configuration
│
├── uploaded-videos/                      # Server-side directory for uploaded video files (fallback)
├── docker-compose.yml                    # Multi-container DB service definitions
├── DATABASE_PERSISTENCE_GUIDE.md         # In-depth database persistence & inspection guide
├── DEPLOYMENT_GUIDE.md                   # Cloud & VPS production deployment blueprint
├── .env.example                          # Environment variables template
└── README.md                             # Project documentation
```

---

## 📚 Dedicated Documentation Guides

- 📖 **[DATABASE_PERSISTENCE_GUIDE.md](file:///c:/Users/Vivek/Documents/Java/SyncStream%20Hub/DATABASE_PERSISTENCE_GUIDE.md)**: Detailed breakdown of database storage engines (WiredTiger, Relational Heap/WAL, Redis AOF), Docker volumes, accessing data via GUI clients (MongoDB Compass, DBeaver, Redis Insight), and database backups.
- 🚀 **[DEPLOYMENT_GUIDE.md](file:///c:/Users/Vivek/Documents/Java/SyncStream%20Hub/DEPLOYMENT_GUIDE.md)**: End-to-end production deployment blueprint for Cloudflare Pages (Frontend), AWS EC2 / Render (Backend), Cloud DBs (Neon/Supabase PostgreSQL, MongoDB Atlas, Upstash Redis), and Cloudflare R2 storage.

---

## 🔒 Security Best Practices
- **Environment Isolation:** Secrets (DB passwords, Cloudflare R2 credentials) are stored in `.env` or environment variables and ignored by Git.
- **Target Exclusions:** Build outputs (`backend/target/`, `frontend/node_modules/`, `uploaded-videos/*`) are excluded via `.gitignore`.
- **CORS & WebSocket Security:** Configured Spring Security with permitted CORS preflight OPTIONS requests, allowed origins, and SockJS polyfills.
- **Production Overrides:** When deploying to production (`application-prod.yml`), inject credentials via platform environment variables rather than storing hardcoded strings.

