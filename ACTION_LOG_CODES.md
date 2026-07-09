# Application Action Log Reference

This document catalogs the system-level event codes logged to the `ActionLog` table. Each code represents an action or system endpoint, with the `outcome` column determining whether the event tracks a successful operation/metric or an application failure.

## Why

For self-hosters and open-source contributors, troubleshooting a headless backend or a multi-container network can feel like working in the dark. 

By default, this project includes a **pgAdmin** instance exposed via your `docker-compose.yml` file (accessible at `http://localhost:5050`). The `ActionLog` table within your Postgres database serves as a transparent, centralised dashboard for your entire application's health.

### How to Use this with pgAdmin:
1. Open your browser and navigate to `http://localhost:5050`.
2. Connect to your application database and locate the `action_log` table.
3. Run a quick query to see recent system activity, performance benchmarks, or tracebacks:
   ```sql
   SELECT action, outcome, duration_ms, error_code, info 
   FROM action_log 
   ORDER BY created_at DESC;


---

## Authentication & User Accounts

### `LOGIN`
* **Context:** Triggered during user authentication attempts.
* **On Success (`outcome: true`):** Tracks active user sessions and security audit trails.
* **On Failure (`outcome: false`):** Indicates bad credentials, expired tokens, or session configuration mismatches.

### `FAILED_REGISTRATION`
* **Context:** Triggered during new user account creation attempts.
* **On Failure (`outcome: false`):** Account creation aborted. Common causes include username/email already taken, or failing password complexity requirements.

### `FAILED_ACCOUNT_DELETION`
* **Context:** Triggered when a user tries to purge their profile data.
* **On Failure (`outcome: false`):** Account data deletion halted. Common causes include unhandled foreign key constraints (e.g., active saved routes or points still tied to the user).

---

## Profile & Settings

### `FAILED_GET_SETTINGS`
* **Context:** Triggered when fetching a user's interface configurations or profile preferences.
* **On Failure (`outcome: false`):** Failed to render settings. Usually caused by missing session data or a corrupted profile record.

### `FAILED_SAVE_SETTINGS`
* **Context:** Triggered when committing new profile choices or map configurations to the database.
* **On Failure (`outcome: false`):** Preferences not updated. Usually due to invalid schema formats or data field overflows.

---

## Engine & Pathfinding

### `INVALID_COORDS_AUTO_PATH_CREATION`
* **Context:** Triggered when incoming coords data fails baseline validation checks before the routing engine runs.
* **On Failure (`outcome: false`):** Routing skipped due to malformed coordinate syntax or points sitting completely outside map bounds.

### `NO_PATH_FOUND`
* **Context:** Triggered when the routing engine processes coordinates successfully but cannot link them together.
* **On Failure (`outcome: false`):** Expected failure. Happens when no points are found as given coords are out of bounds (**most likely cause**) or points are entirely isolated from known road networks or maps segments are physically disconnected. 

### `PATH_CREATED`
* **Context:** Triggered during automated route path generation or manual routing (path generated between segments). 
* **On Success (`outcome: true`):** Path processed successfully. The `duration_ms` tracks how fast the routing engine responded.
* **On Failure (`outcome: false`):** Engine crashed mid-calculation, likely due to a timeout or a memory limit overflow from overly dense coordinate data.

---

## Points & Routes Management

### `SAVING_POINT`
* **Context:** Adding a new custom waypoint, pinpoint, or marker to the map dataset.
* **On Success (`outcome: true`):** Marker committed successfully.
* **On Failure (`outcome: false`):** Write failed. Usually caused by description character limits or broken database pools.

### `SAVE_ROUTE`
* **Context:** Committing a whole multi-coordinate route sequence to the user's saved list.
* **On Success (`outcome: true`):** Route securely saved.
* **On Failure (`outcome: false`):** Duplicate name constraints hit or geometry layout parse error.

### `LOAD_ROUTE`
* **Context:** Fetching a previously stored route for display on the map canvas.
* **On Success (`outcome: true`):** Route metrics and geometry sent to client.
* **On Failure (`outcome: false`):** Missing route ID, or user trying to load a route they don't own.

### `DOWNLOAD_ROUTE`
* **Context:** Compiling a route layout into an exportable format (GPX, GeoJSON) for a user download.
* **On Success (`outcome: true`):** File payload delivered to user.
* **On Failure (`outcome: false`):** Filesystem permission locks or serialisation errors.

### `IMPORT_ROUTE`
* **Context:** Parsing an external file upload (GPX/KML/GeoJSON/FIT) into the platform's internal tracking format.
* **On Success (`outcome: true`):** Route metadata accepted and converted.
* **On Failure (`outcome: false`):** File corrupted or XML/JSON markup syntax tags invalid.

### `GET_SAVED_POINT`
* **Context:** Querying points to place on map.
* **On Success (`outcome: true`):** Waypoint data retrieved.
* **On Failure (`outcome: false`):** Invalid waypoint ID requested / connection dropped.

### `DELETE_POINT`
* **Context:** Deleting a user waypoint from the system.
* **On Success (`outcome: true`):** Point successfully dropped.
* **On Failure (`outcome: false`):** Deletion unauthorised or connection dropped.

### `DELETE_ROUTE`
* **Context:** Permanent removal of a stored route line sequence.
* **On Success (`outcome: true`):** Route dropped.
* **On Failure (`outcome: false`):** Deletion unauthorised or connection dropped.

---

## Map UI & View Metrics

### `LOAD_MAP`
* **Context:** Initial canvas engine startup or tile mapping initialization.
* **On Success (`outcome: true`):** Tiles loaded successfully
* **On Failure (`outcome: false`):** Incorrect coord conversion for saved points (as saved points are retrieved)

### `RESET_VIEW`
* **Context:** Triggered when clicking to re-center the map bounds to default focus areas.
* **On Success (`outcome: true`):** Map camera boundaries updated.
* **On Failure (`outcome: false`):** Missing default bound array configuration values.

### `SEARCH_AREA`
* **Context:** Processing coordinate boundary geocoding or spatial address queries.
* **On Success (`outcome: true`):** Search indices returned matches.
* **On Failure (`outcome: false`):** Database lookup failed, query thread timed out and/or incorrect (or no) API key.