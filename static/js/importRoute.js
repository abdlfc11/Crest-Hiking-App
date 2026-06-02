const routeInputTypes = document.querySelectorAll('input[name="import-route-method"]');

const fileInputType = document.getElementById('file-route-input-type');
const URLInputType = document.getElementById('url-route-input-type')

/**
 * Function responsible for displaying the correct input type when the selected input type in the input type radio pill choices changes.
 */
function handleRouteImportType() {

    // this gets the content of the different input types
    const fileInputTypeContent = document.getElementById('import-route-file-row');
    const URLInputTypeContent = document.getElementById('import-route-url-row');

    // this gets the currently selected import type
    const selectedInputType = document.querySelector('input[name="import-route-method"]:checked');

    // this compares against one and displays the corresponding input type
    if (selectedInputType === fileInputType) {
        fileInputTypeContent.style.display = 'flex';
        URLInputTypeContent.style.display = 'none';
    }
    else {
        fileInputTypeContent.style.display = 'none';
        URLInputTypeContent.style.display = 'flex';
    }
}

routeInputTypes.forEach(radio => {
    radio.addEventListener('change', handleRouteImportType);
});