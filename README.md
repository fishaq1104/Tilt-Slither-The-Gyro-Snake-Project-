# Tilt Slither

Tilt Slither is a modern Snake game built for mobile browsers with motion controls.
Instead of tapping keys, you tilt your phone to steer the snake.

## Features

- Motion steering via Device Orientation / Device Motion APIs
- Adaptive control hints (tilt on sensor devices, keyboard on unsupported devices)
- Smooth tilt input with dead-zone filtering and turn cooldown tuning
- Score + local best score persistence
- Responsive full-screen canvas with animated neon styling
- Keyboard fallback controls for desktop testing
- Pause/resume support (HUD button, Space, or P)

## Controls

- Mobile: tilt left/right/up/down to turn
- Desktop fallback: Arrow keys or WASD
- Pause/Resume: HUD Pause button, Space, or P
- Avoid walls and your own body
- Eat fruit to grow and increase speed

## Quick Start

This project is plain HTML/CSS/JS, no build step required.

1. Open `index.html` in a browser, or serve the folder with any static file server.
2. On iOS/Safari, tap Start and allow motion permissions when prompted.
3. Keep your phone roughly level for better calibration.

Example local server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Files

- `index.html`: game shell, overlays, and HUD
- `styles.css`: visual style and responsive layout
- `app.js`: game loop, snake logic, rendering, and sensor input

## Notes

- Best score is stored in `localStorage` under `tilt-slither-best`.
- If sensors are unavailable, keyboard controls still work.
