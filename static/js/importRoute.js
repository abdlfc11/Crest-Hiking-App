import { showError, addClickListener } from "./utils.js";

export async function processImportedRouteFile(file) {

    const form = new FormData();
    form.append("route_file", file);

    const response = await fetch("/import_route_file", {
        method: 'POST',
        body: form
    });

    if (!response.ok) {
        showError(response.message || "There was an error on our end, try again later");
        throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
        return data;
    }
    else {
        return data.message;
    }

}

