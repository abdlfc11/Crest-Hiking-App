// ###########
// CONSTANTS / VARIABLES
// ###########

document.querySelectorAll('.about-group-header-button').forEach(headerButton => {
    headerButton.addEventListener('click', () => {
        const group = headerButton.closest('.about-group');
        group.classList.toggle('open')
    })
});