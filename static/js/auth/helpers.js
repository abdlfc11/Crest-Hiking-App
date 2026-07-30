const specialCharacters = ["@", "#", "$", "%", "^", "&", "*", "(", ")", "_", "+", "-", "=", "[", "]", "{", "}", "|", ";", ":", ",", ".", "<", ">", "?", "/"]
const reqLength = document.getElementById("req-length");
const reqNumber = document.getElementById("req-number");
const reqSpecial = document.getElementById("req-special");
const reqMatch = document.getElementById("req-match");

//#region Registering Specific 

function updateRequirement(element, condition) {
    element.classList.remove("valid", "invalid");

    if (condition) {
        element.classList.add("valid");
    } else {
        element.classList.add("invalid");
    }
}

export function clearRegisterEntries(username, password1, password2) {
  username.value = "";
  password1.value = "";
  password2.value = "";
}

//#endregion

//#region Validation 

export function validatePassword(p1, p2) {

    // these are the requirements 
    const lengthValid = p1.length >= 11;
    const numberValid = /\d/.test(p1);
    const thereIsSpecialCharacter = specialCharacters.some((word) =>
      p1.includes(word),
    );
    const matchValid = p1 === p2 && p1.length > 0;

    updateRequirement(reqLength, lengthValid);
    updateRequirement(reqNumber, numberValid);
    updateRequirement(reqSpecial, thereIsSpecialCharacter);
    updateRequirement(reqMatch, matchValid);

}

// validation
/**
 * 
 * @param {string} username 
 * @param {string} p1 
 * @param {string} p2 
 * @returns 
 */
export function validateRegisterInput(username, p1, p2) {
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

//#endregion


export function userFeedback(label, message, isSuccess) {
  label.textContent = message;
  label.style.color = isSuccess ? "#0f7a52" : "#ff4d4d";
  label.style.opacity = "1";
  setTimeout(() => {
          label.style.opacity = "0";
  }, 3000);
}