// Get references to DOM elements
const loginValidationLabel = document.getElementById("login_validation_label");
const loginScreen = document.getElementById("login-screen");
const loginUsernameEntry = document.getElementById("login_username_entry");
const loginPasswordEntry = document.getElementById("login_password_entry");
const loginButton = document.getElementById("login_button");
const logoutButton = document.getElementById("logout_button");
const switchToRegisterButton = document.getElementById("switch_to_register_button");
const icons = document.querySelectorAll(".fa-eye");


// Add event listeners to buttons
// NOTE: conditional checks are necessary to prevent errors on pages where these buttons don't exist
if (logoutButton) {
  logoutButton.addEventListener("click", logout);
}

if (loginButton) {
  loginButton.addEventListener("click", login);
}

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
        loginValidationLabel.innerText = data.message;
        loginValidationLabel.style.opacity = "1";
        setTimeout(() => {
          loginValidationLabel.style.opacity = "0";
        }, 3000);
      }
    })
    .catch((error) => {
      console.error("Error", error);
    });
} 

// Function to handle user logout
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
        loginValidationLabel.innerText = data.message;
        loginValidationLabel.style.color = "#0f7a52";
        loginValidationLabel.style.opacity = "1";
        setTimeout(() => {
          loginValidationLabel.style.opacity = "0";
        }, 3000);
      }
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