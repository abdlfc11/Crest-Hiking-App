const driver = window.driver.js.driver;

/**
 * This function is responsible for creating and returning the tour for the manual routing mode 
 * @returns {object} The initialised driver instance 
 */
export function createManualRoutingTour() {
    return driver({
        popoverClass: 'app-tour-theme',
        steps: [
            {
            popover: {
                title: 'Manual Routing',
                description: 'Click on the map to plot points, with statistics being dynamically generated with each point'
            }
            },
            {
            element: '#manual-routing-actions',
            popover: {
                title: 'Routing',
                description: 'Here you can Undo or Redo a point, as well as clear your route.'
            }
            },
            {
            element: '#manual-routing-header',
            popover: {
                title: 'Actions',
                description: 'Here you can open the menu, or reset the view of the map.'
            }
            }
        ]
    })
}

/**
 * This function is responsible for creating and returning the tour for the import route panel
 * @returns {object} The initialised driver instance 
 */
export function createImportRoutePanelTour() {
    return driver({
        popoverClass: 'app-tour-theme',
        steps: [
          {
            popover: {
              title: 'Importing Routes',
              description: 'This is where you can import any of your own routes.'
            }
          },
          {
            element: '#import-route-import-method-row',
            popover: {
              title: 'Importing Routes',
              description: 'You can choose to import your routes via your saved files or via a public URL.'
            }
          },
          {
            element: '#import-route-name-route-row',
            popover: {
              title: 'Importing Routes',
              description: 'It is recommended that you name the imported route, otherwise it will be saved as the filename and date it was saved.'
            }
          },
          {
            element: '#import-route-cancel-button',
            popover: {
              title: 'Importing Routes',
              description: 'Click here if you no longer wish to import your route.'
            }
          },
          {
            element: '#import-route-submit-button',
            popover: {
              title: 'Importing Routes',
              description: 'Click here to import your route once you are finished.'
            }
          }
        ]
    })
}

export function createSavedRouteDashboardTour() {
    return driver({
        popoverClass: 'app-tour-theme',
        steps: [
          {
            popover: {
              title: 'Saved Routes',
              description: 'Here you can view your saved routes where you can download routes in either GeoJSON or GPX, load them, or delete them.'
            }
          }
        ]
    })
}

export function createAutomaticRoutingTour(onTourEnd) {
    return driver({
        popoverClass: 'app-tour-theme',
        onNext: () => {
            if (typeof onTourEnd === 'function') onTourEnd();
        },
        steps: [
            {
            popover: {
                title: 'Welcome to Crestr',
                description: 'This tour will go through automatic routing.'
            }
            },
            {
            element: '#auto-open-nav-button',
            popover: {
                title: 'The Menu',
                description: 'Pressing this button will let you navigate between settings, importing routes and your saved routes dashboard.'
            }
            },
            {
            element: '#auto-home-button',
            popover: {
                title: 'Resetting the view',
                description: 'Pressing this button will take you to the centre of the Lake District, and clear all inputs.'
            }
            },
            {
            element: '#mode-toggle',
            popover: {
                title: 'Switching modes',
                description: 'This is where you can switch between automatic routing and manual routing.'
            }
            },
            {
            element: '#search-row',
            popover: {
                title: 'Automatic Routing',
                description: 'Here you can enter locations which move the map to those locations.'
            }
            },
            {
            element: '#coordinates-area',
            popover: {
                title: 'Automatic Routing',
                description: 'Here you can enter start and end coordinates to form a route.'
            }
            },
            {
            element: '#generate-path-button',
            popover: {
                title: 'Automatic Routing',
                description: 'Pressing this button will generate the path using the coordinates you entered.'
            }
            }
        ]
    });
}

export function createSavingRoutesTour(onTourEnd) {
    return driver({
        popoverClass: 'app-tour-theme',
        onDestroyed: () => {
            if (typeof onTourEnd === 'function') onTourEnd();
        },
        steps: [
            {
            element: '#save-route-button-container',
            popover: {
                title: 'Saving Your Route',
                description: 'Click here to open a panel to save this route.'
            }
            },
            {
            element: '#route-stats',
            popover: {
                title: 'Route Statistics',
                description: "Here you can view key details of your route such as it's distance, elevation change and time taken to complete."
            }
            },
            {
            element: '#toggle-elevation-chart',
            popover: {
                title: 'Elevation Profile',
                description: 'Pressing this button will open a panel showing you an elevation profile of your route.'
            }
            }
        ]
    });
}

export function createSettingsTour() {
    return driver({
        popoverClass: 'app-tour-theme',
        steps: [
            {
                popover: {
                    title: 'App Preferences',
                    description: 'Adjust your distance units and app appearance here. We’re in Beta, so drop us a line via feedback if there are other options you want to see!'
                }
            },
            {
                element: '#delete-account-container',
                popover: {
                    title: 'Account Control',
                    description: 'If you ever need to close your account, you can manage that right here.'
                }
            },
            {
                element: '#settings-logout-button',
                popover: {
                    title: 'Log Out',
                    description: 'Securely sign out of your session whenever you’re done.'
                }
            }
        ]
    });
}