# Tilt Slither

Tilt Slither is a modern Snake game built for mobile browsers with motion controls.
Instead of tapping keys, you tilt your phone to steer the snake.

The GAME:

https://fishaq1104.github.io/Tilt-Slither-The-Gyro-Snake-Project-/

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


## Files

- `index.html`: game shell, overlays, and HUD
- `styles.css`: visual style and responsive layout
- `app.js`: game loop, snake logic, rendering, and sensor input

