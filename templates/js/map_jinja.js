// JINJA-DERIVED CONFIG & DATA
// This file is rendered by Jinja2 and exposes server-side values
// as plain JS constants for use by map.js. No application logic belongs here.

// === MAP CONFIGURATION ===
// Initial map center and zoom from the backend
const mapInitialCenter = {{ map_centre | tojson }};
const mapInitialZoom = {{ map_zoom | default(10) }};

// Default "home" view center (currently same as initial center)
const defaultCenter = mapInitialCenter;

// === INITIAL ROUTE STATE ===
// Route coordinates present when the page is first rendered (if any)
const initialCurrentPath = {% if current_path %}{{ current_path | tojson }}{% else %}null{% endif %};

// === INITIAL SAVED POINTS LOOKUP ===
// Name -> "x, y" string mapping used for autocomplete
const initialSavedPointsLookup = {};
{% if saved_points %}
{% for point in saved_points %}
initialSavedPointsLookup["{{ point.name }}"] = "{{ point.coordinates[0] }}, {{ point.coordinates[1] }}";
{% endfor %}
{% endif %}

// === API ENDPOINTS ===

// Core endpoints
const apiLoginUrl = "{{ url_for('login') }}";
const apiLogoutUrl = "{{ url_for('logout') }}";
const apiRegisterUrl = "{{ url_for('register') }}";

// Route generation and search endpoints
const apiCalculatePathUrl = "{{ url_for('calculate_path') }}";
const apiSearchAreaUrl = "{{ url_for('search_area') }}";

// Saved point management endpoints
const apiSavePointUrl = "{{ url_for('save_point') }}";
const apiGetSavedPointsUrl = "{{ url_for('get_saved_points') }}";
const apiDeletePointUrl = "{{ url_for('delete_point') }}";

// Saved route management endpoints
const apiLoadRouteUrl = "{{ url_for('load_route') }}";
const apiGetRoutesUrl = "{{ url_for('get_routes') }}";
const apiDeleteRouteUrl = "{{ url_for('delete_route') }}";
const apiSaveRouteUrl = "{{ url_for('save_route') }}";
const apiDeleteAccountUrl = "{{ url_for('delete_account') }}";

