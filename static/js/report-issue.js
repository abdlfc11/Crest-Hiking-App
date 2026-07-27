// Report Issue form submission handler

// IMPORTS
import {
    showError,
    addClickListener
} from "./utils/ui-utils.js";

const titleInput = document.getElementById("issue-title");
const textarea = document.getElementById("issue-description");
const submitButton = document.getElementById("submit-button");

// DARK MODE 

// Helper to apply the '.dark' class to the document
function setDarkMode(isDark){
    if (isDark) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
};

function onThemeToggleClick() {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    const newThemeState = !isCurrentlyDark;
    
    setDarkMode(newThemeState);
    
    localStorage.setItem("user-theme", newThemeState ? "dark" : "light");
}

function initDarkMode() {
    const themeToggle = document.getElementById("theme-toggle");
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // This determines the initial state 
    const savedTheme = localStorage.getItem("user-theme");
    
    if (savedTheme) {
        // This ensure that if a user has explicitly chosen a setting before, use it
        setDarkMode(savedTheme === "dark");
    } else {
        // Otherwise, it'll fall back to the OS system preference
        setDarkMode(darkModeQuery.matches);
    }

    if (themeToggle) {
        themeToggle.addEventListener("click", onThemeToggleClick);
    }

    // This runs if the user hasn't overridden preferences
    darkModeQuery.addEventListener("change", (e) => {
        if (!localStorage.getItem("user-theme")) {
            setDarkMode(e.matches);
        }
    });
}

initDarkMode();

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

        const data = await response.json();
        
        if (!response.ok) {
            console.log(data);
            console.log(response);
            throw new Error("There was an unexpected error whilst submitting the issue report.")
            return;
        }

        if (!data.success) {
            console.log(data);
            console.log(response);
            throw new Error("There was an unexpected error whilst submitting the issue report.");
            return;
        }

        showError("Thank You ! The issue was successfully reported", '#53b74c')

        titleInput.value = '';
        textarea.value = '';

    } catch (error) {

        showError("There was an unexpected error whilst submitting the issue report.");
    } finally {
        // This re-enables the submit button
        submitButton.disabled = false;
    }
}

addClickListener(submitButton, handleSubmission, "click");