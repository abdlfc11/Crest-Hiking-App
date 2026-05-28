// ###########
// IMPORTS 
// ###########

// ###########
// CONSTANTS / VARIABLES
// ###########

const createAccountHeroButton = document.getElementById('hero-create-account-button')
const registerLink = document.getElementById("register-link")
const loginLink = document.getElementById("login-link")

document.querySelectorAll('.about-group-header-button').forEach(headerButton => {
    headerButton.addEventListener('click', () => {
        const group = headerButton.closest('.about-group');
        group.classList.toggle('open')
    })
});

// ###########
// ADDING EVENT LISTENERS
// ###########

if (createAccountHeroButton) {
    createAccountHeroButton.disabled = true
}
if (registerLink) {
    registerLink.disabled = true
}
if (loginLink) {
    loginLink.disabled = true
}