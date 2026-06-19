// Get references to DOM elements

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
const specialCharacters = [
  "@", "#", "$", "%", "^",
  "&", "*", "(", ")", "_",
  "+", "-", "=", "[", "]",
  "{", "}", "|", ";", ":",
  ",", ".", "<", ">", "?",
  "/",
];

// icon elements
const icons = document.querySelectorAll(".fa-eye");

// deleting elements
const deleteAccountButton = document.getElementById("delete-user-button");

// beta code
const betaCodeEntry = document.getElementById('beta-code-entry');
const betaValidationLabel = document.getElementById('beta-validation-label');
const betaButton = document.getElementById('beta-button');

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
  deleteAccountButton.addEventListener('click', deleteAccount)
}

if (betaButton) {
  betaButton.addEventListener('click', validateBetaCode)
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

// ###########
// HELPER FUNCTIONS
// ###########

function userFeedback(label, message, isSuccess) {
  label.textContent = message;
  label.style.color = isSuccess ? "#0f7a52" : "#ff4d4d";
  label.style.opacity = "1";
  setTimeout(() => {
          label.style.opacity = "0";
  }, 3000);
}

// ###########
// REGISTERING
// ###########


function switchToLoginFromRegister() {
  window.location.href = '/login-page';
}

export function switchToRegistering() {
  window.location.href = "/register";
}


function register() {
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
  }

  fetch(apiRegisterUrl, {
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
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        clearRegisterEntries()
        window.location.href = '/'
        userFeedback(loginValidationLabel, data.message, true)
      } else {
        userFeedback(registerValidationLabel, data.message, false)
      }
    })
    .catch((error) => {
      console.error("Error", error);
    });
}

// helper

function clearRegisterEntries() {
  registerUsernameEntry.value = "";
  registerPasswordEntry1.value = "";
  registerPasswordEntry2.value = "";
}

// validation
/**
 * 
 * @param {string} username 
 * @param {string} p1 
 * @param {string} p2 
 * @returns 
 */
function validateRegisterInput(username, p1, p2) {
  const thereIsSpecialCharacter = specialCharacters.some((word) =>
    p1.includes(word),
  );

  if (username === "" || p1 === "" || p2 === "") {
    return "All entries must be filled";
  } else if (username.length <= 7) {
    return "Username must be 8 or more characters";
  } else if (p1 !== p2) {
    return "Passwords must be the same";
  } else if (p1.length <= 11) {
    return "Passwords must have at least 12 characters";
  } else if (!thereIsSpecialCharacter) {
    return "Passwords must contain at least one special character";
  }
  return true;
}

// ###########
// LOGIN AND LOGOUT
// ###########

// Function to handle user login
export function login() {

  const username = loginUsernameEntry.value;
  const password = loginPasswordEntry.value;
  loginValidationLabel.style.color = "#ff4d4d";

  fetch(apiLoginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username: username, password: password }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        loginUsernameEntry.value = "";
        loginPasswordEntry.value = "";
        window.location.href = "/map"
      } else {
        userFeedback(loginValidationLabel, data.message, false);
      }
    })
    .catch((error) => {
      console.error("Error", error);
    });
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
        window.location.href = "/";
        settingsModal.classList.remove("active");
        userFeedback(loginValidationLabel, data.message, true);
      }
    });
}

// ###########
// LOGIN AND LOGOUT
// ###########

export function deleteAccount(skipConfirm = false) {

  const userConfirmation = skipConfirm || confirm("Are you sure you want to delete your account ? ") // ensures the user is sure they want to delete 

  // if the user has not confirmed (clicked no)
  if (!userConfirmation) {
    return;
  }

  const url = window.appConfig.apiDeleteAccountUrl

  // else, carry on with the deletion process
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  })
  .then((response) => response.json())
  .then((data) => {
    if (data.success) {
      window.location.href = '/'
      userFeedback(loginValidationLabel, data.message, true)
    }
  })
  .catch((error) => {
    console.error("Error", error);
  });
}

export async function validateBetaCode(event) {
  event.preventDefault();

  const betaCode = betaCodeEntry.value;

  const response = await fetch('/validate-beta-code', {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ beta_code: betaCode })
  });

  const data = await response.json()

  if (data.success) {
    window.location.href = "/register";
    return;
  }


  if (!data.success) {
    userFeedback(betaValidationLabel, data.message, false);
    return;
  }
};

// Add event listeners to all password visibility toggle icons
icons.forEach((icon) => {
  icon.addEventListener("click", (event) => {
    const parent = event.currentTarget.parentElement;
    const passwordInput = parent.querySelector(
      'input[type="password"], input[type="text"]',
    );

    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";

    event.currentTarget.style.color = isPassword ? "rgb(86, 87, 89)" : "lightgray";
  });
});