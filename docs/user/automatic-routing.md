

## Explanation of the panels during Automatic Route Generation


<p align="center">
  <img width="1470" height="833" alt="image" src="https://files.catbox.moe/ukxayk.jpeg" />
  <br>
  <sub>An image clearly showing each of the 4 distinct panels on the automatic route generation mode</sub>
</p>

### Automatic and Manual toggles (In Red)
This part of the UI is where you can easily switch between Automatic Route Generation and Manual Route Creation. 
I often switch to manual routing whilst in automatic route generation when I find a more appealing path, and to reflect that the app fully handles switching modes smoothly.
If you switch modes whilst a route is already loaded, the route is wiped and the UI is refreshed to include the new manual routing elements (more on that below)

### Main Routing Panel (In Yellow)
This part of the UI is where you generate a route from. It includes:
- the start and end coordinate entries as well as the corresponding set coordinate buttons. 
- a clear path button, which differs from the home button in that it doesn't zoom out to the centre of Cumbria, allowing you to continue routing without being disrupted.


It shares two things with the manual routing panel, of which are:
- the home button
- the menu button



The home button clears all paths and entries and zooms out to the centre of the Lake District, allowing you to reset your session.
The menu button (as the name suggests) opens a menu from the left hand side where you can access settings as well as the saved routes dashboards, where you can load, delete, and most importantly, export your created routes.

### Route Stats Panel (In Green)
This part of the UI is where you can view the details of your created or loaded routes. 

It includes core details such as:

- ETA: This is calculated using Naismith's rule and is different depending on descent or ascent
- Distance: This is calculated via a complex web mercator equation I had to scour the internet for, I might make a blog post about it
- Elevation Change: The elevation used for this is **_somewhat_** accurate ([NASA SRTM data for those interested](https://www.earthdata.nasa.gov/data/instruments/srtm)). Better, more accurate datasets are being explored
- Elevation profile: This was made available via chart.js and an image of an example of an elevation profile can be seen below
<img width="1047" height="278" alt="image" src="https://github.com/user-attachments/assets/e8f44d82-001a-41a2-8b4a-f637e359b7d7" />

### Save Route Panel (In Purple)
This part of the UI is where you can save a route to the database. 
<br>
It instantly registers the route and loads it dynamically into the saved routes dashboard ready to be downloaded in either GPX or GeoJSON format


_**Note**: the file format dropdown is due to be deleted as users can load both types from the Saved Routes Dashboard_



## Setting coordinates

You can either enter coordinates directly, or use the set coord buttons, which allow you to click a point on the map to place a coordinate into the corresponding start / end entry

Examples can be seen below:

### Using the Set Start/End Coordinate Buttons
<img width="1469" height="835" alt="image" src="https://github.com/user-attachments/assets/37d88ee7-2247-4723-8bab-1c06d49b3621" />

As can be seen above, these two buttons correspond to their own entries. 
When clicking either entry, the cursor will turn into a crosshair and the next click on the map will enter the relevant coordinate into the desired entry.
For cleaner UI and a better UX, the current active entry is always highlighted via a blue border, as well as a relevant placeholder message, as can be seen below.


<img width="1470" height="834" alt="image" src="https://github.com/user-attachments/assets/919d961d-703f-4b23-80ee-713c9bcd6952" />


Pressing the highlighted buttons above will retrieve the coordinates in the middle of the map, shown by the crosshair (which is also highlighted), and place them into their respective start or end coodinate entries