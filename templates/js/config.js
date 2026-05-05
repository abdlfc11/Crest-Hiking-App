// JINJA-DERIVED CONFIG & DATA

// === MAP CONFIGURATION ===
const mapInitialCenter = {{ map_centre | tojson }};
const mapInitialZoom = {{ map_zoom | default(10) }};
const defaultCenter = mapInitialCenter;

// === INITIAL ROUTE STATE ===
const initialCurrentPath = {% if current_path %}{{ current_path | tojson }}{% else %}null{% endif %};

// === INITIAL SAVED POINTS LOOKUP ===
const initialSavedPointsLookup = {};
{% if saved_points %}
{% for point in saved_points %}
initialSavedPointsLookup["{{ point.name }}"] = "{{ point.coordinates[0] }}, {{ point.coordinates[1] }}";
{% endfor %}
{% endif %}

// === API ENDPOINTS ===
const apiLogoutUrl = "{{ url_for('logout') }}";
const apiRegisterUrl = "{{ url_for('registering') }}";
const apiCalculatePathUrl = "{{ url_for('calculate_path') }}";
const apiSearchAreaUrl = "{{ url_for('search_area') }}";
const apiSavePointUrl = "{{ url_for('save_point') }}";
const apiGetSavedPointsUrl = "{{ url_for('get_saved_points') }}";
const apiDeletePointUrl = "{{ url_for('delete_point') }}";
const apiLoadRouteUrl = "{{ url_for('load_route') }}";
const apiGetRoutesUrl = "{{ url_for('get_routes') }}";
const apiDeleteRouteUrl = "{{ url_for('delete_route') }}";
const apiSaveRouteUrl = "{{ url_for('save_route') }}";
const apiDeleteAccountUrl = "{{ url_for('delete_account') }}";