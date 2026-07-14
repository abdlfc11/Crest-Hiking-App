// Report Issue form submission handler

// IMPORTS
import { showError, addClickListener } from "./utils.js";

const titleInput = document.getElementById("issue-title");
const textarea = document.getElementById("issue-description");
const submitButton = document.getElementById("submit-button");

/**
 * This function validates the input fields for the report issue form.
 * @param {string} title 
 * @param {string} description 
 * @returns {boolean} Returns true if the input is valid, false otherwise.
 */
function validateInput(title, description) {
    if (!title || !description) {
        showError("Please fill in both the title and description fields.");
        return false;
    }

    if (title.length > 100) {
        showError("Title cannot exceed 100 characters.");
        return false;
    }

    if (description.length > 1000) {
        showError("Description cannot exceed 1000 characters.");
        return false;
    }

    return true;
}

/**
 * 
 * Handles the submission of the report issue form. It validates the input fields and sends a POST request to the server with the title and description of the issue. 
 */
async function handleSubmission() {
    const title = titleInput.value.trim();
    const description = textarea.value.trim();

    if (!validateInput(title, description)) {
        return;
    }

    // This disables the submit button to prevent multiple submissions
    submitButton.disabled = true;

    try {
        const response = await fetch(apiReportIssueUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ title: title, description: description })
        });
    } catch (error) {
        showError("An error occurred while submitting the issue report.");
    } finally {
        // This re-enables the submit button
        submitButton.disabled = false;
    }
}

addClickListener(submitButton, handleSubmission, "click");