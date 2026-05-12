// Get references to DOM elements

// Login elements
const loginValidationLabel = document.getElementById("login_validation_label");
const loginScreen = document.getElementById("login-screen");
const loginUsernameEntry = document.getElementById("login_username_entry");
const loginPasswordEntry = document.getElementById("login_password_entry");
const loginButton = document.getElementById("login_button");
const logoutButton = document.getElementById("logout_button");
const switchToRegisterButton = document.getElementById("switch_to_register_button");

// Registering elements
const switchToLoginButton = document.getElementById("register-switch-to-login-button")
const registerButton = document.getElementById("register-button");
const registerValidationLabel = document.getElementById("register-validation-label");
const registerScreen = document.getElementById("register-screen");
const registerPasswordEntry1 = document.getElementById("register-password-entry1");
const registerPasswordEntry2 = document.getElementById("register-password-entry2");
const registerUsernameEntry = document.getElementById("register-username-entry");
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


function register() {
  const username = registerUsernameEntry.value;
  const password1 = registerPasswordEntry1.value;
  const password2 = registerPasswordEntry2.value;

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
  fetch(apiLogoutUrl, {
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

export function switchToRegistering() {
  window.location.href = "/register";
}

// ###########
// LOGIN AND LOGOUT
// ###########

function deleteAccount() {

  const userConfirmation = confirm("Are you sure you want to delete your account ? ") // ensures the user is sure they want to delete 

  // if the user has not confirmed (clicked no)
  if (!userConfirmation) {
    return;
  }

  // else, carry on with the deletion process
  fetch(apiDeleteAccountUrl, {
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

// Add event listeners to all password visibility toggle icons
icons.forEach((icon) => {
  icon.addEventListener("click", (event) => {
    const parent = event.currentTarget.parentElement;
    const passwordInput = parent.querySelector(
      'input[type="password"], input[type="text"]',
    );

    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";

    event.currentTarget.style.color = isPassword ? "#417affff" : "lightgray";
  });
});