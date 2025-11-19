precision highp float;

varying vec2 vTexCoord;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_mode;
uniform float u_zoom;

#define MAX_STEPS 128
#define MAX_DIST 100.0
#define SURF_DIST 0.0001
#define PI 3.14159265359

// Rotation matrices
mat2 rot2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

mat3 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
}

// Smooth minimum for blending shapes
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// SDF primitives
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdOctahedron(vec3 p, float s) {
    p = abs(p);
    return (p.x + p.y + p.z - s) * 0.57735027;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

// 3D noise
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
        mix(mix(hash(p + vec3(0,0,0)), hash(p + vec3(1,0,0)), f.x),
            mix(hash(p + vec3(0,1,0)), hash(p + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(p + vec3(0,0,1)), hash(p + vec3(1,0,1)), f.x),
            mix(hash(p + vec3(0,1,1)), hash(p + vec3(1,1,1)), f.x), f.y),
        f.z);
}

// Repeat in polar coordinates
vec3 opRepeatPolar(vec3 p, float repetitions) {
    float angle = 2.0 * PI / repetitions;
    float a = atan(p.z, p.x) + angle / 2.0;
    float r = length(p.xz);
    float c = floor(a / angle);
    a = mod(a, angle) - angle / 2.0;
    p.xz = vec2(cos(a), sin(a)) * r;
    return p;
}

// Scene composition
float getDist(vec3 p) {
    float t = u_time * 0.2;

    // Mouse influence on rotation speed and shape morphing
    float mouseInfluence = length(u_mouse) * 0.5;
    float rotSpeed = 0.5 + u_mouse.x * 0.3;

    // Mode-based variations (smoother transitions)
    float modeAmount = u_mode * 0.5; // Scale down the mode influence

    // Central rotating sculpture
    vec3 p1 = p;
    p1 *= rotateY(t * rotSpeed);
    p1.xz *= rot2D(u_mouse.x * 0.5);

    // Core sphere with octahedron - subtly influenced by mouse and mode
    float coreSize = 0.4 + sin(t * 2.0) * 0.05 + mouseInfluence * 0.08;
    float core = sdSphere(p1, coreSize);
    float octa = sdOctahedron(p1, 0.5 + cos(t * 1.5) * 0.08);
    float blendCore = 0.25 + modeAmount * 0.1;
    float center = smin(core, octa, blendCore);

    // Rotating rings - thickness subtly changes
    vec3 p2 = p;
    p2.xy *= rot2D(t * 0.7 + u_mouse.y * 0.5);
    float ringThickness1 = 0.07 + sin(modeAmount * PI) * 0.02;
    float ring1 = sdTorus(p2, vec2(0.8, ringThickness1));

    vec3 p3 = p;
    p3.xz *= rot2D(t * 0.5 + modeAmount * 0.2);
    float ring2 = sdTorus(p3, vec2(1.0, 0.06));

    vec3 p4 = p;
    p4.yz *= rot2D(t * 0.3 - u_mouse.x * 0.3);
    float ring3 = sdTorus(p4, vec2(1.2, 0.04));

    // Radial spokes - keep count fixed, change properties instead
    vec3 p5 = opRepeatPolar(p, 8.0);
    float spokeOffset = 1.4 + sin(t + u_mouse.y * 2.0) * 0.2 + modeAmount * 0.15;
    p5.x -= spokeOffset;
    p5.xy *= rot2D(t + mouseInfluence);
    float spokeSize = 0.15 + sin(modeAmount * PI) * 0.05;
    float spoke = sdBox(p5, vec3(spokeSize, 0.02, 0.02));

    // Orbiting spheres - keep count fixed
    vec3 p6 = opRepeatPolar(p, 6.0);
    float orbOffset = 1.6 + sin(t * 3.0 + u_mouse.y * PI) * 0.15;
    p6.x -= orbOffset;
    p6 *= rotateY(t * 2.0 + modeAmount * 0.5);
    float orbSize = 0.12 + sin(modeAmount * PI * 0.5) * 0.03;
    float orbs = sdSphere(p6, orbSize);

    // Vertical pillars - keep count fixed
    vec3 p7 = opRepeatPolar(p, 12.0);
    p7.x -= 0.6;
    vec3 pillStart = vec3(0, -0.8, 0);
    vec3 pillEnd = vec3(0, 0.8, 0);
    float pillarThickness = 0.03 + cos(modeAmount * PI) * 0.01;
    float pillars = sdCapsule(p7, pillStart, pillEnd, pillarThickness);

    // Inner details - keep count fixed, change size
    vec3 p8 = p;
    p8 *= rotateY(-t * 1.5 - u_mouse.x * 2.0);
    p8 = opRepeatPolar(p8, 4.0);
    p8.x -= 0.5;
    float innerSize = 0.08 + sin(modeAmount * PI) * 0.03;
    float innerDetail = sdBox(p8, vec3(innerSize));

    // Additional layer that fades in/out with mode
    vec3 p9 = p;
    p9 *= rotateY(t * 0.8);
    p9 = opRepeatPolar(p9, 5.0);
    p9.x -= 1.0;
    float extraLayer = sdOctahedron(p9, 0.15);

    // Combine all elements with smooth blending
    float blendAmount = 0.18 + sin(modeAmount * PI) * 0.08;
    float d = smin(center, ring1, blendAmount);
    d = smin(d, ring2, 0.15);
    d = smin(d, ring3, 0.15);
    d = smin(d, spoke, 0.12);
    d = smin(d, orbs, 0.15);
    d = smin(d, pillars, 0.1);
    d = smin(d, innerDetail, 0.15);

    // Gradually blend in the extra layer
    float extraBlend = sin(modeAmount * PI) * 0.5;
    if(extraBlend > 0.01) {
        d = smin(d, extraLayer, 0.2 * extraBlend);
    }

    // Add noise displacement - subtle variation with mode
    float noiseIntensity = 0.02 + cos(modeAmount * PI) * 0.015;
    float displacement = noise(p * 8.0 + t + u_mouse.x) * noiseIntensity;
    d += displacement;

    return d;
}

// Ray marching
float rayMarch(vec3 ro, vec3 rd) {
    float dO = 0.0;

    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * dO;
        float dS = getDist(p);
        dO += dS;
        if(dO > MAX_DIST || abs(dS) < SURF_DIST) break;
    }

    return dO;
}

// Calculate normal
vec3 getNormal(vec3 p) {
    float d = getDist(p);
    vec2 e = vec2(0.0001, 0.0);

    vec3 n = d - vec3(
        getDist(p - e.xyy),
        getDist(p - e.yxy),
        getDist(p - e.yyx)
    );

    return normalize(n);
}

// Ambient occlusion
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    for(int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = getDist(p + h * n);
        occ += (h - d) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
}

// Soft shadows
float calcShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    for(int i = 0; i < 32; i++) {
        float h = getDist(ro + rd * t);
        res = min(res, k * h / t);
        t += clamp(h, 0.01, 0.2);
        if(res < 0.001 || t > maxt) break;
    }
    return clamp(res, 0.0, 1.0);
}

void main() {
    vec2 uv = (vTexCoord * u_resolution - u_resolution * 0.5) / u_resolution.y;

    // Camera setup with mouse control and zoom
    float camDist = (4.0 + sin(u_time * 0.1) * 0.3) / u_zoom;

    // Mouse controls camera orbit
    float camAngleX = u_time * 0.05 + u_mouse.x * 1.5;
    float camAngleY = u_mouse.y * 0.8;

    vec3 ro = vec3(
        sin(camAngleX) * cos(camAngleY) * camDist,
        sin(camAngleY) * camDist + cos(u_time * 0.07) * 0.2,
        cos(camAngleX) * cos(camAngleY) * camDist
    );

    vec3 target = vec3(0.0, 0.0, 0.0);
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(vec3(0, 1, 0), forward));
    vec3 up = cross(forward, right);
    vec3 rd = normalize(forward + uv.x * right + uv.y * up);

    // Ray march
    float d = rayMarch(ro, rd);

    vec3 col = vec3(0.0);

    if(d < MAX_DIST) {
        vec3 p = ro + rd * d;
        vec3 n = getNormal(p);
        vec3 viewDir = normalize(ro - p);

        // Enhanced multi-light setup with animation
        vec3 lightPos1 = vec3(
            3.0 + sin(u_time * 0.3) * 0.5,
            4.0 + cos(u_time * 0.4) * 0.3,
            5.0
        );
        vec3 lightPos2 = vec3(-2.0, 3.0, 3.0);
        vec3 lightPos3 = vec3(
            sin(u_time * 0.2) * 2.0,
            -2.0,
            cos(u_time * 0.2) * 2.0 + 4.0
        );

        // Main key light with soft shadows
        vec3 lightDir1 = normalize(lightPos1 - p);
        float diff1 = max(dot(n, lightDir1), 0.0);
        diff1 = pow(diff1, 0.7); // Softer falloff
        float shadow1 = calcShadow(p + n * 0.01, lightDir1, 0.1, 5.0, 12.0);

        // Fill light (softer, from opposite side)
        vec3 lightDir2 = normalize(lightPos2 - p);
        float diff2 = max(dot(n, lightDir2), 0.0) * 0.4;

        // Animated accent light
        vec3 lightDir3 = normalize(lightPos3 - p);
        float diff3 = max(dot(n, lightDir3), 0.0) * 0.25;

        // Enhanced specular with multiple highlights
        vec3 halfDir1 = normalize(lightDir1 + viewDir);
        float spec1 = pow(max(dot(n, halfDir1), 0.0), 80.0) * 1.2;

        vec3 halfDir2 = normalize(lightDir2 + viewDir);
        float spec2 = pow(max(dot(n, halfDir2), 0.0), 40.0) * 0.5;

        // Fresnel effect for elegant edge lighting
        float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 3.5);
        float rim = fresnel * 0.8;

        // Subsurface scattering approximation
        float backLight = max(dot(-lightDir1, n), 0.0);
        float sss = pow(backLight, 3.0) * 0.3;

        // Ambient occlusion with enhanced quality
        float ao = calcAO(p, n);
        ao = pow(ao, 0.8); // Soften AO

        // Material properties based on position for variation
        float materialVar = sin(p.x * 5.0) * sin(p.y * 5.0) * sin(p.z * 5.0);
        float roughness = 0.2 + materialVar * 0.1;

        // Combine lighting with sophisticated material (BRIGHTER)
        float ambient = 0.25; // Increased from 0.12
        float diffuse = diff1 * shadow1 * 1.2 + diff2 * 0.7 + diff3 * 0.5; // Boosted
        float specular = spec1 + spec2 * roughness;

        col = vec3(ambient) * ao;
        col += vec3(diffuse) * ao;
        col += vec3(specular) * (1.0 - roughness * 0.5);
        col += vec3(rim) * 0.9; // Increased rim light
        col += vec3(sss);

        // Lighter atmospheric fog
        float fog = 1.0 - exp(-d * 0.15);
        vec3 fogColor = vec3(0.03, 0.035, 0.04); // Brighter fog
        col = mix(col, fogColor, fog * 0.35); // Less fog influence

        // Subtle iridescence on edges
        float iridescence = fresnel * sin(u_time * 2.0 + p.y * 10.0) * 0.1;
        col += vec3(iridescence);

        // Reduced depth darkening
        float depthDarken = smoothstep(0.0, MAX_DIST * 0.6, d);
        col *= (1.0 - depthDarken * 0.15); // Reduced from 0.3

    } else {
        // Brighter sophisticated background
        float vertGrad = smoothstep(-0.7, 0.7, uv.y);
        float radialGrad = 1.0 - length(uv) * 0.35;

        // Brighter multi-layer gradient
        col = vec3(vertGrad * 0.12 + 0.02); // Increased from 0.05 + 0.005
        col *= radialGrad;

        // Brighter animated rays in background
        float rayAngle = atan(uv.y, uv.x);
        float rays = sin(rayAngle * 12.0 + u_time * 0.5) * 0.5 + 0.5;
        rays = pow(rays, 8.0) * 0.06; // Doubled brightness
        col += rays * radialGrad;

        // Brighter atmospheric particles
        float bgNoise = noise(vec3(uv * 3.0, u_time * 0.1));
        col += bgNoise * 0.03 * radialGrad; // Doubled
    }

    // Brighter tone mapping
    col = col / (col + vec3(0.6)); // Reduced from 0.8 to allow brighter values
    col = pow(col, vec3(0.78)); // Reduced from 0.82 for more brightness

    // Softer vignette
    float vignetteInner = 1.0 - length(uv) * 0.15; // Reduced from 0.2
    float vignetteOuter = 1.0 - length(uv) * 0.4; // Reduced from 0.5
    float vignette = mix(vignetteOuter, vignetteInner, 0.7);
    vignette = smoothstep(0.15, 1.0, vignette); // Adjusted from 0.2
    col *= vignette;

    // Subtle color grading for warmth
    col = mix(col, col * vec3(1.0, 0.98, 0.96), 0.1);

    // Fine grain for film-like quality (reduced for brightness)
    float grain = noise(vec3(uv * 1200.0, u_time)) * 0.01;
    col += grain * 0.5;

    // Subtle chromatic aberration on edges
    float aberration = length(uv) * 0.02;
    col = mix(col, col * vec3(1.0 - aberration, 1.0, 1.0 + aberration), 0.3);

    // Enhanced brightness boost
    col += smoothstep(0.7, 1.0, col) * 0.15; // Increased and lowered threshold

    // Overall brightness lift
    col *= 1.3; // 30% brighter overall

    gl_FragColor = vec4(col, 1.0);
}
