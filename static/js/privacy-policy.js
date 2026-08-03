/**
 * Self-contained theme controller for the Crestr privacy policy page.
 */

(function () {
  "use strict";

    /** Theme toggle to be used by the user */
    const toggle = document.getElementById("pp-theme-toggle");

    const label = document.getElementById("pp-theme-label");

    /** localStorage key used exclusively by this page */
    const STORAGE_KEY = "privacy-policy-theme";

    /** Valid theme values */
    const VALID_THEMES = ["system", "light", "dark"];

    /**
     * Reads the stored theme from localStorage.
     * Falls back to "system" if the key is missing or invalid.
     *
     * @returns {string} "system" or "light" or "dark"
     */
    function getStoredTheme() {
        try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && VALID_THEMES.indexOf(stored) !== -1) {
            return stored;
        }
        } catch (e) {
        /* this ensures that those in private mode / storage disabled falls through to default value (system) */
        }
        return "system";
    }

    /**
     * Persists the theme choice to localStorage.
     *
     * @param {string} theme "system" | "light" | "dark"
     */
    function setStoredTheme(theme) {
        try {
        localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            // ignores those who have storage disabled 
        }
    }

    /**
     * Returns the effective theme to use (i.e if light or dark, returns, if system, it queries the OS for the current system setting)
     *
     * @param {string} preference "system" or "light" or "dark"
     * @returns {string} "light" or "dark"
     */
    function resolveEffective(preference) {
        if (preference === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
        }
        return preference;
    }

    /**
     * Applies the effective theme to the document root
     *
     * @param {string} preference "system" | "light" | "dark"
     */
    function applyTheme(preference) {
        const effective = resolveEffective(preference);
        document.documentElement.setAttribute("data-theme", effective);
    }

    /**
     * Updates the toggle button label to reflect the current preference.
     *
     * @param {string} preference "system" | "light" | "dark"
     */
    function updateToggleLabel(preference) {
        if (!label) return;

        if (preference === "dark") {
        label.textContent = "Dark";
        } else if (preference === "light") {
        label.textContent = "Light";
        } else {
        label.textContent = "System";
        }
    }

    /**
     * Cycles through themes e.g system to light to dark to system
     */
    function cycleTheme() {
        let current = getStoredTheme();
        let next;

        if (current === "system") {
        next = "light";
        } else if (current === "light") {
        next = "dark";
        } else {
        next = "system";
        }

        setStoredTheme(next);
        applyTheme(next);
        updateToggleLabel(next);
    }

    //  Initialisation

    const preference = getStoredTheme();
    applyTheme(preference);
    updateToggleLabel(preference);

    if (toggle) {
        toggle.addEventListener("click", cycleTheme);
    }

    // This ensures the page responds to a change to the OS's change in theme if the user has set the theme to system 
    window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", function () {
            if (getStoredTheme() === "system") {
                applyTheme("system");
            }
        });
})();