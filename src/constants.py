# Default map centre (EPSG:4326 lon/lat).
DEFAULT_CENTRE = [-3.198308, 54.465458]

# Default map centre in Web Mercator (EPSG:3857).
# Only used internally by the routing engine / OpenLayers view.
DEFAULT_CENTRE_MERCATOR = [-356034, 7258806]

# Open Layers zoom level
DEFAULT_ZOOM = 10.5

# Hardcoded Web Mercator (EPSG:3857) bounds for Cumbria
# used for the graph / routing bounds 
MIN_X = -425000  
MAX_X = -233000 
MIN_Y = 7170000  
MAX_Y = 7395000  

# Auth related constants 
SPECIAL_CHARACTERS = ["@", "#", "$", "%", "^", "&", "*", "(", ")", "_", "+", "-", "=", "[", "]", "{", "}", "|", ";", ":", ",", ".", "<", ">", "?", "/"]