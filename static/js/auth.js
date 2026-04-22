import { apiLoginUrl  } from "/js/config.js";

const loginValidationLabel = document.getElementById("login_validation_label");
const loginScreen = document.getElementById("login_screen");
const loginUsernameEntry = document.getElementById("login_username_entry");
const loginPasswordEntry = document.getElementById("login_password_entry");
const loginButton = document.getElementById("login_button");
const logoutButton = document.getElementById("logout_button");
const switchToRegisterButton = document.getElementById("switch_to_register_button");

loginButton.addEventListener("click", login);

function login() {
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