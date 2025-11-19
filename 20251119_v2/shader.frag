precision highp float;

varying vec2 vTexCoord;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

// Noise functions
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 0.0;

    for (int i = 0; i < 6; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Distance field functions
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdStar(vec2 p, float r, int n, float m) {
    float an = 3.141592653 / float(n);
    float en = 3.141592653 / m;
    vec2 acs = vec2(cos(an), sin(an));
    vec2 ecs = vec2(cos(en), sin(en));

    float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
    p = length(p) * vec2(cos(bn), abs(sin(bn)));
    p -= r * acs;
    p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
    return length(p) * sign(p.x);
}

float sdHexagon(vec2 p, float r) {
    const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
    p = abs(p);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
}

float sdVesica(vec2 p, float r, float d) {
    p = abs(p);
    float b = sqrt(r * r - d * d);
    return ((p.y - b) * d > p.x * b) ? length(p - vec2(0.0, b)) : length(p - vec2(-d, 0.0)) - r;
}

// Rotation matrix
vec2 rotate(vec2 p, float a) {
    return vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
}

// Kaleidoscope effect
vec2 kaleidoscope(vec2 p, float segments) {
    float angle = atan(p.y, p.x);
    float radius = length(p);
    float slice = 3.141592653 * 2.0 / segments;
    angle = mod(angle, slice);
    angle = abs(angle - slice * 0.5);
    return vec2(cos(angle), sin(angle)) * radius;
}

void main() {
    vec2 st = vTexCoord;
    st.y = 1.0 - st.y;

    // Adjust for aspect ratio
    vec2 coord = st * vec2(u_resolution.x / u_resolution.y, 1.0);
    vec2 center = vec2(u_resolution.x / u_resolution.y * 0.5, 0.5);
    vec2 p = coord - center;

    // Apply kaleidoscope effect
    vec2 kp = kaleidoscope(p, 8.0);

    // Create flowing background with domain warping
    vec2 q = vec2(0.0);
    q.x = fbm(coord * 2.0 + u_time * 0.2);
    q.y = fbm(coord * 2.0 + vec2(1.0));

    vec2 r = vec2(0.0);
    r.x = fbm(coord * 2.0 + q + vec2(1.7, 9.2) + u_time * 0.15);
    r.y = fbm(coord * 2.0 + q + vec2(8.3, 2.8) + u_time * 0.1);

    float f = fbm(coord * 3.0 + r);

    // Create complex mandala with multiple geometric shapes
    float shapes = 1.0;

    // Rotating stars at different scales
    for (float i = 0.0; i < 3.0; i++) {
        vec2 sp = rotate(kp, u_time * (0.1 + i * 0.05));
        float starSize = 0.15 + i * 0.08;
        float star = sdStar(sp, starSize, 5, 2.5);
        shapes = min(shapes, abs(star) - 0.005);
    }

    // Add hexagonal patterns
    for (float i = 0.0; i < 4.0; i++) {
        vec2 hp = rotate(kp, -u_time * 0.08 + i * 0.5);
        float hexSize = 0.08 + i * 0.06;
        float hex = sdHexagon(hp, hexSize);
        shapes = min(shapes, abs(hex) - 0.003);
    }

    // Add vesica shapes (sacred geometry)
    for (float i = 0.0; i < 3.0; i++) {
        vec2 vp = rotate(kp, u_time * 0.05 + i * 1.047);
        float vesica = sdVesica(vp, 0.2 + i * 0.05, 0.1);
        shapes = min(shapes, abs(vesica) - 0.004);
    }

    // Add concentric circles with varying thickness
    float dist = length(p);
    float circles = 1.0;
    for (float i = 0.0; i < 12.0; i++) {
        float radius = 0.05 + i * 0.05 + sin(u_time * 0.5 + i * 0.3) * 0.02;
        float thickness = 0.002 + sin(u_time + i) * 0.001;
        float circle = abs(dist - radius) - thickness;
        circles = min(circles, circle);
    }

    // Create spiral patterns
    float angle = atan(p.y, p.x);
    float spiral = 0.0;
    for (float i = 0.0; i < 5.0; i++) {
        float spiralAngle = angle + dist * 10.0 - u_time + i * 1.256;
        spiral += sin(spiralAngle * 3.0) * exp(-dist * 2.0) * 0.2;
    }

    // Create radial waves
    float radialWaves = 0.0;
    for (float i = 1.0; i < 8.0; i++) {
        float wave = sin(dist * 20.0 - u_time * 2.0 + i);
        float radial = sin(angle * (i * 2.0) + u_time * i * 0.3);
        radialWaves += wave * radial * exp(-dist * 1.5) / i;
    }

    // Start with subtle background
    float color = f * 0.15;

    // Add geometric shapes with thin lines
    float shapeGlow = exp(-shapes * 30.0) * 0.8;
    color += shapeGlow;
    color += (1.0 - smoothstep(0.0, 0.006, shapes)) * 0.75;

    // Add circles with thin lines
    color += (1.0 - smoothstep(0.0, 0.003, circles)) * 0.85;
    color += exp(-circles * 50.0) * 0.5;

    // Add spiral and radial patterns
    color += spiral * 0.35;
    color += radialWaves * 0.3;

    // Add flowing grid distorted by noise
    vec2 grid = fract(coord * 15.0 + vec2(sin(u_time * 0.2), cos(u_time * 0.3)));
    grid = abs(grid - 0.5) * 2.0;
    float gridPattern = min(grid.x, grid.y);
    gridPattern = smoothstep(0.02, 0.0, gridPattern - fbm(coord * 5.0) * 0.3);
    color += gridPattern * 0.18;

    // Add particle-like dots
    float dots = 0.0;
    for (float i = 0.0; i < 16.0; i++) {
        float a = i * 0.393 + u_time * 0.1;
        float r = 0.2 + sin(u_time * 0.5 + i) * 0.1;
        vec2 dotPos = vec2(cos(a), sin(a)) * r;
        float dot = length(kp - dotPos);
        dots += smoothstep(0.015, 0.005, dot);
    }
    color += dots * 0.38;

    // Apply gentle vignette - balanced throughout
    float vignette = smoothstep(0.1, 0.5, dist);
    color *= vignette * 0.4 + 0.5;

    // Balanced contrast for crisp shapes
    color = pow(color, 1.3);
    color = smoothstep(0.15, 0.82, color);

    // Balanced brightness
    color *= 0.75;

    // Output black and white
    gl_FragColor = vec4(vec3(color), 1.0);
}
