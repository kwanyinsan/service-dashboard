# Service Dashboard

A simple service dashboard website. I use this project to learn and practise React, FastAPI, SQLite, HTTP requests, and Docker. It lets me register services by name and URL, run manual HTTP checks, and view their status, latency, and recent check history.

## Features

- Register a service with a name and URL, and delete services when they are no longer needed.
- Refresh one service or check all registered services concurrently.
- Display HTTP status, response time in milliseconds, and the last check timestamp.
- View the latest five saved results for each service, newest first.
- Keep services and check history in SQLite across restarts.
- Show loading for each service being checked, report refresh failures, and display history loading and error states.
- Use a dark interface with compact status badges and readable history tables.

Checks run when I click **Refresh** or **Refresh all**. Opening the dashboard loads the saved service list and history.

## Tech stack

| Layer | Technology | Location |
| --- | --- | --- |
| Frontend | React, Vite, Axios, and Tailwind CSS | `frontend/` |
| Backend | Python, FastAPI, Uvicorn, and Requests | `backend/` |
| Database | SQLite with SQLAlchemy | Models in `backend/models.py` |
| Local containers | Docker and Docker Compose | `docker-compose.yml` and both Dockerfiles |

The browser sends requests directly to the FastAPI backend. The backend makes the HTTP checks, saves results through SQLAlchemy, and returns JSON. `App.jsx` manages requests and state; `Dashboard.jsx` displays the services and history.

## Project structure

```text
service-dashboard/
├── backend/
│   ├── main.py                 # API routes, HTTP checks, caching, and concurrent checks
│   ├── models.py               # SQLite models and initial example services
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile
│   └── service-dashboard.db    # Created locally; ignored by Git
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Requests, forms, and application state
│   │   ├── Dashboard.jsx       # Service cards and history tables
│   │   ├── index.css           # Theme and responsive styles
│   │   └── main.jsx            # React entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Run locally on Windows

These commands use PowerShell. For the Docker setup, install Git and Docker Desktop with Docker Compose, then start Docker Desktop using Linux containers. The images provide Python 3.12 and Node.js 20; separate Python and Node.js installations are only needed for the direct setup below.

Ports `5173` and `8000` must be available.

### 1. Clone the project

Run this in the folder where you want to keep the project:

```powershell
git clone https://github.com/kwanyinsan/service-dashboard.git
cd service-dashboard
```

The following Docker commands run from the repository root.

### 2. Start both containers

```powershell
docker compose up --build -d
docker compose ps
```

The first command builds and starts the frontend and backend in the background. Check the output of `docker compose ps` to confirm both services are running.

To follow their logs:

```powershell
docker compose logs -f
```

`Ctrl+C` exits the log view while the containers keep running.

### 3. Open the app

| Address | Purpose |
| --- | --- |
| http://localhost:5173 | Service Dashboard |
| http://localhost:8000 | Backend API base URL |
| http://localhost:8000/services | Saved service list as JSON |
| http://localhost:8000/docs | Interactive API documentation |

The API base URL has no homepage; use `/services` or `/docs` to check the backend.

`VITE_BACKEND_URL` is set to `http://localhost:8000` in Compose. React runs in the browser, so it reaches the backend through the published host port. The frontend also uses this URL as its fallback when running directly.

### 4. Verify the local app

```powershell
curl.exe -i http://localhost:8000/services
```

Expect HTTP `200` and a JSON array. In the browser, register a service with a unique URL, refresh it, and check its status, latency, timestamp, and history. Try repeated refreshes and **Refresh all**, then delete the service used for testing.

### 5. Stop and restart

Stop the existing containers:

```powershell
docker compose stop
```

Start them again:

```powershell
docker compose start
```

Restart both running services:

```powershell
docker compose restart
```

To remove the containers and their network:

```powershell
docker compose down
```

Run `docker compose up --build -d` to recreate them. The database remains in the host's `backend/` folder.

The frontend source is copied into its image, so rebuild after frontend changes. The backend source is mounted from the host, but its Docker command does not enable automatic reload; use `docker compose restart backend` after backend changes. Rebuild when changing dependencies or Dockerfiles.

## Run directly without Docker

Install Python 3.12 or newer and Node.js 20 or newer with npm. Stop the Docker containers first so both setups do not use the same ports or database at the same time.

In one terminal, starting from the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Run the backend from `backend/` so its relative SQLite path uses the expected database file. The commands call the virtual environment's interpreter directly, so activation is not required.

In another terminal, starting from the repository root:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

There is no committed npm lockfile, so use `npm install`. `npm.cmd` avoids PowerShell script execution-policy issues. Open the same local URLs listed above. Keep both terminals open and use `Ctrl+C` in each to stop the servers. To restart, rerun the two startup commands; dependency installation and virtual environment creation are only needed for initial setup or dependency changes.

To check the frontend build, run this from `frontend/`:

```powershell
npm.cmd run build
```

## Data storage

The backend creates `backend/service-dashboard.db` with two tables: `services` stores the registered URLs and their latest results; `ping_history` stores saved check results. SQLAlchemy creates missing tables at startup.

Compose mounts `./backend` on the host to `/app` in the backend container. The database is therefore stored on the host and persists when containers are stopped, rebuilt, or removed. The direct setup uses the same file when started from `backend/`. Database files are ignored by Git.

When the services table is empty at startup, eight example website entries are inserted. Existing services are kept when the table already contains data.

The API returns the latest five history entries, but older entries remain in SQLite. Deleting a service also deletes all of its saved history.

## How service checks work

- **Register:** Save the name and URL. Duplicate URLs return HTTP `400`; registration does not run a check.
- **Refresh:** Make an HTTP GET request and record the numeric HTTP status, elapsed time in milliseconds, and a UTC timestamp. HTTP `200` displays as **Up**; other results display as **Down**.
- **Failures:** Requests uses a five-second connection/read timeout. Handled request failures store null status and latency. This timeout is not a guaranteed five-second limit for the entire operation.
- **Cache:** Results are cached by URL for two seconds in backend memory. A cached check retains its original timestamp and still saves a history entry, so repeated timestamps are expected. Restarting the backend clears this cache.
- **Refresh all:** HTTP requests run concurrently in a bounded thread pool. Database updates and history entries are then saved together in the endpoint's thread.
- **History:** Results are returned newest first by record ID, rather than by timestamp, because cached checks can share timestamps. The UI reloads history after checks and clears row loading even when a result's timestamp is unchanged.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Docker cannot connect to its engine | Start Docker Desktop and confirm Linux containers are available. |
| A port is already allocated | Stop the existing app using port `5173` or `8000`, then start this project again. |
| The page loads but service requests fail | Check the backend logs and `http://localhost:8000/services`. The browser must be able to reach `VITE_BACKEND_URL`. |
| The backend root returns `404` | Use `/services` for JSON or `/docs` for the API documentation. |
| Frontend changes are missing in Docker | Run `docker compose up --build -d` to rebuild the copied source. |
| A reachable website shows Down | Check its returned HTTP status. Only `200` is classified as Up; some websites reject automated requests. |
| Data appears missing in the direct setup | Check the working directory. Start Uvicorn from `backend/` and keep the existing database file. |

## API

These routes are served directly by FastAPI; there is no `/api` prefix.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/services` | List registered services and their latest results |
| POST | `/services` | Register a service using JSON fields `name` and `url` |
| DELETE | `/services/{service_id}` | Delete a service and its history |
| POST | `/services/{service_id}/check` | Check one service and save a history entry |
| POST | `/services/check-all` | Check all services concurrently and save results |
| GET | `/services/{service_id}/history` | Return the latest five saved results |

Requests for a missing service return HTTP `404`. A failed target check is represented by null result fields; it does not mean the API request itself failed. The frontend reports failed refresh API requests with an alert and shows history request failures beside the affected service.

## References

- [React documentation](https://react.dev/learn)
- [FastAPI documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy documentation](https://docs.sqlalchemy.org/)
- [Docker Compose documentation](https://docs.docker.com/compose/)
- [Uptime Kuma](https://github.com/louislam/uptime-kuma), the visual reference for the dark theme.
