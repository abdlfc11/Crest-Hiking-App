//#region IMPORTS

import { showError } from "../utils/ui-utils.js";
import { 
  validatePassword,
  validateRegisterInput,
  clearRegisterEntries,
  userFeedback
} from "./helpers.js";

//#endregion

//#region VAR / CONST DECLARATIONS

// Login elements
const loginValidationLabel = document.getElementById("login_validation_label");
const loginScreen = document.getElementById("login-screen");
const loginUsernameEntry = document.getElementById("login_username_entry");
const loginPasswordEntry = document.getElementById("login_password_entry");
const loginButton = document.getElementById("login_button");
const logoutButton = document.getElementById("logout-button");
const switchToRegisterButton = document.getElementById("switch_to_register_button");

// Registering elements
const switchToLoginButton = document.getElementById("register-switch-to-login-button")
const registerButton = document.getElementById("register-button");
const registerValidationLabel = document.getElementById("register-validation-label");
const registerScreen = document.getElementById("register-screen");
const registerPasswordEntry1 = document.getElementById("register-password-entry1");
const registerPasswordEntry2 = document.getElementById("register-password-entry2");
const registerUsernameEntry = document.getElementById("register-username-entry");
const registerPreferredNameEntry = document.getElementById("register-preferred-name-entry");

// icon elements
const icons = document.querySelectorAll(".fa-eye");

// deleting elements
const deleteAccountButton = document.getElementById("delete-user-button");

//#endregion

// ###########
// REGISTERING
// ###########


function switchToLoginFromRegister() {
  window.location.href = '/login-page';
}

export function switchToRegistering() {
  window.location.href = "/register";
}


async function register() {
  const username = registerUsernameEntry.value;
  const password1 = registerPasswordEntry1.value;
  const password2 = registerPasswordEntry2.value;
  const preferredName = registerPreferredNameEntry.value;

  const message = validateRegisterInput(username, password1, password2);

  if (message !== true) {
    registerValidationLabel.innerText = message;
    registerValidationLabel.style.opacity = "1";
    setTimeout(() => {
      registerValidationLabel.style.opacity = "0";
    }, 3000);
    return;
  };

  try { 

    console.log("ENTERING FETCH")

    const response = await fetch(apiRegisterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preferred_name: preferredName,
        username: username,
        password1: password1,
        password2: password2,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      userFeedback(registerValidationLabel, data.message, false);
      return;
    };

    if (data.success) {
      clearRegisterEntries(registerUsernameEntry, registerPasswordEntry1, registerPasswordEntry2);
      window.location.href = 'https://crestr.co.uk';
      userFeedback(loginValidationLabel, data.message, true);
    } else {
      userFeedback(registerValidationLabel, data.message, false);
    }
} catch (error) {
    console.log(`ERROR: ${error}`);
    userFeedback(registerValidationLabel, error.message, false);
};

};

// ###########
// LOGIN AND LOGOUT
// ###########

// Function to handle user login
export async function login() {

  const username = loginUsernameEntry.value;
  const password = loginPasswordEntry.value;
  loginValidationLabel.style.color = "#ff4d4d";

  try { 

    const response = await fetch(apiLoginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: username, password: password }),
    })

    const data = await response.json();

    if (!response.ok) {
      userFeedback(loginValidationLabel, data.message, false);
      return;
    };

    if (data.success) {
      loginUsernameEntry.value = "";
      loginPasswordEntry.value = "";
      window.location.href = "/map"
    } else {
      userFeedback(loginValidationLabel, data.message, false);
    }
  } 
  catch(error) {
    console.error("ERROR: ", error);
    showError(error.message || "Sorry, there was an unexpected error whilst logging in, try again later.")
  }

}

// Function to handle user logging out
export function logout() {

  const url = window.appConfig.apiLogoutUrl

  fetch(url, {
    method: "POST",
    credentials: "same-origin",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        window.location.href = "https://crestr.co.uk";
        settingsModal.classList.remove("active");
      }
    });
}

// ###########
// DELETING ACCOUNT
// ###########

export async function deleteAccount(skipConfirm = false) {

  const userConfirmation = skipConfirm || confirm("Are you sure you want to delete your account ? ") // ensures the user is sure they want to delete 

  // if the user has not confirmed (clicked no)
  if (!userConfirmation) {
    return;
  }

  // else, carry on with the deletion process

  const url = window.appConfig.apiDeleteAccountUrl

  try { 

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok) {
      showError("There was an unexpected error whilst deleting your account.")
      return;
    };

    if (!data.success) {
      showError("There was an unexpected error whilst deleting your account.")
      return;
    };

    // redirect back to landing page if deletion successfull
    window.location.href = 'https://crestr.co.uk'
  } catch(error) {
    console.log(`ERROR : ${error.message}`)
    showError("There was an unexpected error whilst deleting your account.")
    return;
  };
}

// ###########
// DARK MODE
// ###########

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

// ###########
// INIT
// ###########

initDarkMode();

// Add event listeners to all password visibility toggle icons
icons.forEach((icon) => {
  icon.addEventListener("click", (event) => {
    const parent = event.currentTarget.parentElement;
    const passwordInput = parent.querySelector(
      'input[type="password"], input[type="text"]',
    );

    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";

    event.currentTarget.classList.toggle("auth-icon-active", isPassword);
  });
});

// ###########
// ADDING EVENT LISTENERS 
// ###########

// NOTE: conditional checks are necessary to prevent errors on pages where these buttons don't exist

if (logoutButton) {
  logoutButton.addEventListener("click", logout);
}

if (loginButton) {
  loginButton.addEventListener("click", login);
}

if (switchToRegisterButton) {
  switchToRegisterButton.addEventListener("click", switchToRegistering);
}

if (switchToLoginButton) {
  switchToLoginButton.addEventListener('click', switchToLoginFromRegister)
}

if (registerButton) {
  registerButton.addEventListener('click', register)
}

if (deleteAccountButton) {
  deleteAccountButton.addEventListener('click', (e) => {deleteAccount(e)})
}

if (registerPasswordEntry1) {
  registerPasswordEntry1.addEventListener("input", () => validatePassword(registerPasswordEntry1.value, registerPasswordEntry2.value));
}

if (registerPasswordEntry2) {
  registerPasswordEntry2.addEventListener("input", () => validatePassword(registerPasswordEntry1.value, registerPasswordEntry2.value));
}

if (window.location.pathname === "/login-page" || window.location.pathname === "/register") {
  if (window.location.pathname === "/login-page") {
    document.addEventListener("keypress", (event) => {
      if (event.key === 'Enter') {
        login()
      }
    });
  }
  else {
    document.addEventListener("keypress", (event) => {
      if (event.key === 'Enter') {
        register()
      }
    });
  }
};
