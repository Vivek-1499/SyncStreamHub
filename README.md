# SyncStream Hub 🎬🍿

SyncStream Hub is a modern, real-time collaborative video watch party platform. It allows users to create virtual rooms, upload videos, chat with friends, and synchronize video playback (play, pause, seek) in real-time using WebSockets.

---

## 🏗️ Architecture Overview

The application is split into a **Spring Boot** backend and a **React (Vite + TypeScript)** frontend, backed by a multi-database architecture for scale and reliability:

```mermaid
graph TD
    Client[React Frontend] <-->|WebSocket / STOMP| BE[Spring Boot Backend]
    Client <-->|REST API| BE
    BE <-->|User & Auth Data| Postgres[(PostgreSQL)]
    BE <-->|Session History & Chat Logs| Mongo[(MongoDB)]
    BE <-->|Active Room State & Cache| Redis[(Redis)]
```

---

## ✨ Features

- **Real-Time Video Sync:** Play, pause, and seek events are instantly synchronized across all users in a room using WebSockets (STOMP protocol).
- **Live Group Chat:** Integrated chat feature to discuss scenes with other room members in real-time.
- **Custom Video Uploads:** Upload your own videos to stream directly within your watch party room.
- **Room Management:** Create private/public rooms, set passwords, and invite users via unique room links.
- **User Authentication:** Secure signup and login flow to manage profiles and room ownership.
- **Robust Session Logging:** Entire watch party history (chat logs, playback sync events) is saved asynchronously for review.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18+ with Vite
- **Language:** TypeScript
- **Styling:** CSS3 & Tailwind CSS / Modern Custom Styles
- **Real-Time Sync:** `@stomp/stompjs` & `sockjs-client`

### Backend
- **Framework:** Spring Boot 3.3 (Java 17)
- **Security & Database ORM:** Spring Security, Spring Data JPA, Spring Data MongoDB, Spring Data Redis
- **Real-Time Communications:** Spring WebSocket & STOMP Message Broker
- **Build Tool:** Maven

### Infrastructure & Middleware
- **PostgreSQL:** Stores relational data like User profiles, Room configuration, and Authentication tables.
- **MongoDB:** Handles high-throughput, unstructured write loads like chat histories and playback logs asynchronously.
- **Redis:** Manages volatile, fast-access cache data such as active room memberships and instant sync states.
- **Docker Compose:** Handles local orchestration of Postgres, MongoDB, and Redis databases.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed on your local machine:
- **Java 17 JDK** or higher
- **Node.js (v18+)** & npm
- **Maven**
- **Docker Desktop** (for running databases)

---

### Step 1: Set Up Databases with Docker
Launch the pre-configured databases (PostgreSQL, MongoDB, and Redis) in docker containers:
```bash
docker-compose up -d
```
*This will start the databases in the background on their default ports.*

---

### Step 2: Configure Environment Variables
Copy the template `.env.example` file to create a local `.env` file in the root folder:
```bash
cp .env.example .env
```
Open the `.env` file and customize your local credentials:
```env
DB_PASSWORD=your_secure_password
SPRING_DATASOURCE_PASSWORD=your_secure_password
SPRING_DATA_MONGODB_URI=mongodb://root:your_secure_password@localhost:27017/syncstream?authSource=admin
```
*(The `.env` file is automatically ignored by Git to protect your secrets).*

---

### Step 3: Run the Backend Services
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Build and run the Spring Boot application using Maven:
   ```bash
   mvn spring-boot:run
   ```
The backend server will launch at `http://localhost:8080`.

---

### Step 4: Run the Frontend Application
1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
The frontend application will launch at `http://localhost:5173`.

---

## 📁 Repository Structure

```text
SyncStream Hub/
│
├── backend/                  # Spring Boot project folder
│   ├── src/main/java/        # Java source code (Controllers, Services, Configs, etc.)
│   ├── src/main/resources/   # Application properties/YML config templates
│   └── pom.xml               # Maven configuration
│
├── frontend/                 # React frontend project folder
│   ├── src/                  # React components, hooks, assets
│   ├── package.json          # Node dependencies and scripts
│   └── vite.config.ts        # Vite configuration
│
├── docker-compose.yml        # Multi-container DB deployment configuration
├── .gitignore                # Git ignore rules for root, frontend, and backend folders
├── .env.example              # Environment variables template
└── README.md                 # Project documentation
```

---

## 🔒 Security Best Practices
- **Do not commit raw secrets:** Database passwords and API keys are stored in `.env`.
- **Target Directories:** Avoid committing Java `target/` class files or React `node_modules/` folders. They are automatically handled by the custom `.gitignore`.
- **Production Credentials:** In staging or production, inject environment variables (like `SPRING_DATASOURCE_PASSWORD` and `SPRING_DATA_MONGODB_URI`) directly into the hosting platform (e.g., AWS, GCP, Azure, or Heroku) instead of file-based config.
