// ###########
// IMPORTS 
// ###########

import { switchToRegistering } from "./auth.js";

// ###########
// CONSTANTS / VARIABLES
// ###########

const createAccountHeroButton = document.getElementById('hero-create-account-button')

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
    createAccountHeroButton.addEventListener('click', switchToRegistering)
}