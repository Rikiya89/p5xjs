# Flower Arrangement - WebGL Interactive Game

An interactive 3D flower arrangement generator built with p5.js and WebGL, featuring geometric dandelion-style flowers in black and white.

## Features

- **Interactive 3D Flowers**: Three dandelion-style flower heads with radiating stems
- **Customizable Parameters**: Real-time control over flower characteristics
- **Organic Branch System**: Curved branches connecting multiple flowers using bezier curves
- **Decorative Elements**: Spiral leaves along stems and floating particles
- **Geometric Base**: Pyramid-style pot/base
- **Black & White Theme**: Minimalist monochrome aesthetic
- **WebGL Rendering**: Smooth 3D rotation and lighting effects

## Controls

### Sliders
- **Petals** (3-16): Number of radiating stems per flower head
- **Petal Size** (20-100): Length of the radiating stems
- **Center Size** (10-60): Size of the center sphere of each flower
- **Rotation Speed** (0-5): Speed of 3D rotation animation
- **Geometry**: Shape selector (reserved for future variations)

### Buttons
- **GENERATE NEW FLOWER**: Creates a new flower arrangement with current settings
- **SAVE IMAGE**: Download the current flower as PNG

## Project Structure

```
.
├── index.html          # Main HTML with UI controls
├── sketch.js           # p5.js sketch with flower generation logic
├── .gitignore          # Git ignore file
└── README.md           # This file
```

## Technical Details

### Flower Structure
- **Dandelion Flowers**: Spherical distribution of stems with end spheres
- **Three Flower Heads**: Main flower at top, two smaller flowers on side branches
- **Radiating Stems**: Each stem radiates from center sphere in 3D space
- **Spherical Distribution**: Uses spherical coordinates (theta, phi) for natural stem placement

### Branch System
- **Main Stem**: Vertical stem from base to top flower
- **Side Branches**: Curved branches using bezier curves with control points
- **Organic Curves**: 3D bezier curves for natural-looking branch connections

### Visual Elements
- **Geometric Base**: 4-sided pyramid cone as pot
- **Spiral Leaves**: 6 decorative spiral-shaped leaves along stems
- **Floating Particles**: 15 animated leaf-like particles drifting downward
- **Lighting**: Ambient and directional lighting for depth

### Color Scheme
- **Black Background**: #000000
- **White Elements**: #FFFFFF (flowers, stems, particles)
- **Gray Accents**: Various shades for center spheres and base

## Usage

1. Open `index.html` in a modern web browser
2. Adjust the controls to customize your flower
3. Click "GENERATE NEW FLOWER" to create a new arrangement
4. Click "SAVE IMAGE" to download your creation

## Concept

Based on the concept art featuring:
- Multiple spherical flower heads with radiating structures
- Organic curved stems and branches
- Decorative leaves with spiral patterns
- Geometric base element
- Floating particles/petals in the environment
- Monochromatic black and white aesthetic

## Technologies

- **p5.js**: Creative coding library for interactive graphics
- **WebGL**: 3D rendering via p5.js WEBGL mode
- **Vanilla JavaScript**: DOM manipulation for UI controls
- **HTML5 Canvas**: Rendering surface

## Browser Compatibility

Works best in modern browsers with WebGL support:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

This project is open source and available for educational and creative purposes.
