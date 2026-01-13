precision highp float;

varying vec2 vTexCoord;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

#define PI 3.14159265359
#define TAU 6.28318530718

// Color palette
const vec3 col0 = vec3(0.212, 0.176, 0.471);
const vec3 col1 = vec3(0.322, 0.247, 0.639);
const vec3 col2 = vec3(0.569, 0.424, 0.800);
const vec3 col3 = vec3(0.741, 0.631, 0.898);
const vec3 col4 = vec3(0.784, 0.753, 0.914);
const vec3 col5 = vec3(0.518, 0.729, 0.906);
const vec3 col6 = vec3(0.318, 0.416, 0.831);
const vec3 col7 = vec3(0.200, 0.247, 0.529);
const vec3 col8 = vec3(0.161, 0.188, 0.224);
const vec3 col9 = vec3(0.157, 0.212, 0.192);

vec3 getColor(float t) {
  t = fract(t) * 10.0;
  int idx = int(floor(t));
  float f = fract(t);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // Smoother interpolation

  vec3 c1, c2;
  if (idx == 0) { c1 = col0; c2 = col1; }
  else if (idx == 1) { c1 = col1; c2 = col2; }
  else if (idx == 2) { c1 = col2; c2 = col3; }
  else if (idx == 3) { c1 = col3; c2 = col4; }
  else if (idx == 4) { c1 = col4; c2 = col5; }
  else if (idx == 5) { c1 = col5; c2 = col6; }
  else if (idx == 6) { c1 = col6; c2 = col7; }
  else if (idx == 7) { c1 = col7; c2 = col8; }
  else if (idx == 8) { c1 = col8; c2 = col9; }
  else { c1 = col9; c2 = col0; }

  return mix(c1, c2, f);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = rot * p * 2.0;
    amplitude *= 0.5;
  }
  return value;
}

mat2 rotate2D(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

// Smooth ring with glow
float glowRing(vec2 p, float r, float thickness, float glow) {
  float d = abs(length(p) - r);
  float ring = smoothstep(thickness, 0.0, d);
  float glowEffect = smoothstep(glow, 0.0, d) * 0.5;
  return ring + glowEffect;
}

float softCircle(vec2 p, float r, float softness) {
  return smoothstep(r + softness, r - softness * 0.5, length(p));
}

// Elegant petal shape
float petal(vec2 p, float width, float length) {
  p.y += length * 0.3;
  float d = pow(abs(p.x) / width, 2.0) + pow(p.y / length, 2.0);
  return smoothstep(1.0, 0.8, d);
}

// Beautiful lotus with layered glowing petals
float lotus(vec2 p, float scale, float time) {
  p *= scale;
  float r = length(p);
  float angle = atan(p.y, p.x);
  float pattern = 0.0;

  float bloom = sin(time * 0.25) * 0.12 + 0.88;

  // Outer glow petals
  for (int i = 0; i < 12; i++) {
    float a = float(i) * TAU / 12.0 + time * 0.08;
    vec2 rotP = rotate2D(a) * p;
    float pet = petal(rotP, 0.12 * bloom, 0.6 * bloom);
    pattern += pet * 0.2;
  }

  // Middle petals - counter rotate
  for (int i = 0; i < 8; i++) {
    float a = float(i) * TAU / 8.0 - time * 0.1 + 0.2;
    vec2 rotP = rotate2D(a) * p;
    float pet = petal(rotP, 0.1 * bloom, 0.45 * bloom);
    pattern += pet * 0.35;
  }

  // Inner petals
  for (int i = 0; i < 6; i++) {
    float a = float(i) * TAU / 6.0 + time * 0.12;
    vec2 rotP = rotate2D(a) * p;
    float pet = petal(rotP, 0.08 * bloom, 0.3 * bloom);
    pattern += pet * 0.5;
  }

  // Glowing center
  float centerGlow = softCircle(p, 0.1, 0.12);
  float centerCore = softCircle(p, 0.05, 0.04);
  pattern += centerGlow * 0.8 + centerCore * 1.5;

  // Center ring detail
  pattern += glowRing(p, 0.07, 0.004, 0.02) * 0.3;

  return min(pattern, 1.0);
}

// Flowing energy ripples
float energyRipples(vec2 p, float time) {
  float r = length(p);
  float angle = atan(p.y, p.x);
  float ripples = 0.0;

  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float t = fract(time * 0.12 + fi * 0.33);
    float radius = t * 1.6;
    float width = 0.06 * (1.0 - t * 0.5);

    float wave = smoothstep(width, 0.0, abs(r - radius));
    wave *= smoothstep(0.0, 0.15, t) * (1.0 - t);

    // Wavy edge
    float waveEdge = sin(angle * 8.0 + time + fi * 2.0) * 0.015 * (1.0 - t);
    wave *= 1.0 + waveEdge;

    ripples += wave * (0.4 - fi * 0.1);
  }

  return ripples;
}

// Elegant spiraling aurora
float aurora(vec2 p, float time) {
  float r = length(p);
  float angle = atan(p.y, p.x);
  float aurora = 0.0;

  // Flowing spiral bands
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float dir = fi == 0.0 ? 1.0 : -1.0;

    float spiral = angle * dir + log(r + 0.15) * 2.5 + time * 0.3 * dir + fi * PI;
    float band = sin(spiral * 1.5) * 0.5 + 0.5;
    band = pow(band, 3.0);

    // Soft fade
    band *= smoothstep(1.4, 0.2, r) * smoothstep(0.05, 0.25, r);

    aurora += band * 0.2;
  }

  return aurora;
}

// Sacred eye with beautiful iris
float sacredEye(vec2 p, float scale, float time) {
  p *= scale;
  float pattern = 0.0;
  float r = length(p);
  float angle = atan(p.y, p.x);

  float breathe = 1.0 + sin(time * 0.35) * 0.06;

  // Soft outer glow
  float outerGlow = length(p * vec2(0.8, 1.8 * breathe));
  pattern += smoothstep(1.0, 0.6, outerGlow) * smoothstep(0.4, 0.55, outerGlow) * 0.2;

  // Almond shape
  float almond = length(p * vec2(1.0, 2.2 * breathe));
  pattern += smoothstep(0.62, 0.55, almond) * smoothstep(0.32, 0.4, almond) * 0.4;

  // Beautiful iris gradient
  float irisR = 0.3 + sin(time * 0.4) * 0.015;
  float iris = smoothstep(irisR, irisR - 0.08, r) * smoothstep(0.08, 0.14, r);

  // Iris color bands
  float irisBands = sin(angle * 24.0 + r * 30.0 - time * 1.5) * 0.5 + 0.5;
  irisBands = pow(irisBands, 2.0);
  irisBands *= smoothstep(irisR, 0.15, r) * smoothstep(0.08, 0.15, r);

  pattern += iris * 0.5 + irisBands * 0.15;

  // Deep pupil
  float pupilSize = 0.07 + sin(time * 0.8) * 0.01;
  float pupil = softCircle(p, pupilSize, 0.02);
  float pupilCore = softCircle(p, pupilSize * 0.5, 0.01);
  pattern += pupil * 1.0 + pupilCore * 0.5;

  // Orbiting light sparkle
  float sparkleAngle = time * 0.4;
  vec2 sparklePos = vec2(cos(sparkleAngle), sin(sparkleAngle)) * 0.035;
  pattern += softCircle(p - sparklePos, 0.012, 0.015) * 0.8;

  // Secondary sparkle
  vec2 sparklePos2 = vec2(cos(sparkleAngle + 2.5), sin(sparkleAngle + 2.5)) * 0.025;
  pattern += softCircle(p - sparklePos2, 0.008, 0.01) * 0.4;

  return min(pattern, 1.0);
}

// Delicate mandala
float mandala(vec2 p, float scale, float time) {
  p *= scale;
  float r = length(p);
  float angle = atan(p.y, p.x);
  float pattern = 0.0;

  // Outer decorative ring
  float outerWave = sin(angle * 24.0 + time * 0.2) * 0.02;
  pattern += glowRing(p, 1.0 + outerWave, 0.004, 0.015) * 0.25;

  // Rotating petal layers
  float petals1 = sin(angle * 16.0 + time * 0.2) * 0.5 + 0.5;
  petals1 = pow(petals1, 4.0);
  petals1 *= smoothstep(1.0, 0.5, r) * smoothstep(0.25, 0.45, r);
  pattern += petals1 * 0.3;

  // Counter-rotating inner petals
  float petals2 = sin(angle * 8.0 - time * 0.25) * 0.5 + 0.5;
  petals2 = pow(petals2, 3.0);
  petals2 *= smoothstep(0.5, 0.15, r) * smoothstep(0.0, 0.18, r);
  pattern += petals2 * 0.4;

  // Breathing rings
  float ring1 = 0.35 + sin(time * 0.5) * 0.015;
  float ring2 = 0.6 + sin(time * 0.4 + 1.0) * 0.02;
  float ring3 = 0.85 + sin(time * 0.35 + 2.0) * 0.025;

  pattern += glowRing(p, ring1, 0.003, 0.012) * 0.3;
  pattern += glowRing(p, ring2, 0.003, 0.012) * 0.25;
  pattern += glowRing(p, ring3, 0.003, 0.012) * 0.2;

  return min(pattern, 1.0);
}

// Ethereal light beams
float lightBeams(vec2 p, float time) {
  float angle = atan(p.y, p.x);
  float r = length(p);
  float beams = 0.0;

  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float beamAngle = fi * TAU / 6.0 + time * 0.05;

    // Soft beam with shimmer
    float shimmer = sin(r * 6.0 - time * 1.5 + fi * 1.1) * 0.25 + 0.75;
    float beam = cos(angle - beamAngle);
    beam = pow(max(beam, 0.0), 30.0);
    beam *= smoothstep(1.8, 0.1, r);
    beam *= shimmer;

    // Fade at center
    beam *= smoothstep(0.0, 0.15, r);

    beams += beam;
  }

  return beams * 0.08;
}

// Magical particles
float magicParticles(vec2 p, float time) {
  float particles = 0.0;

  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float t = time * 0.15 + fi * 0.85;
    float phase = fi * 2.3;

    // Elegant orbital paths
    float orbitA = 0.35 + sin(fi * 0.6) * 0.2;
    float orbitB = 0.5 + cos(fi * 0.8) * 0.25;
    float speed = 0.25 + fi * 0.03;

    vec2 pos = vec2(
      sin(t * speed + phase) * orbitA,
      cos(t * speed * 0.7 + phase) * orbitB
    );

    // Gentle floating motion
    pos += vec2(sin(t * 1.5 + fi * 2.0), cos(t * 1.3 + fi * 1.7)) * 0.04;

    // Twinkling brightness
    float twinkle = sin(time * 2.5 + fi * 1.9) * 0.5 + 0.5;
    twinkle = pow(twinkle, 1.5);

    // Particle with halo
    float size = 0.006 + twinkle * 0.005;
    float glow = softCircle(p - pos, size, 0.03) * (0.4 + twinkle * 0.6);
    float core = softCircle(p - pos, size * 0.4, 0.008) * twinkle;

    particles += glow + core * 0.5;
  }

  return particles;
}

// Seed of life pattern
float seedOfLife(vec2 p, float scale, float time) {
  p *= scale;
  float pattern = 0.0;

  float pulse = 1.0 + sin(time * 0.4) * 0.02;

  // Center circle
  pattern += glowRing(p, pulse, 0.004, 0.015);

  // 6 surrounding circles
  for (int i = 0; i < 6; i++) {
    float angle = float(i) * TAU / 6.0 + time * 0.03;
    vec2 offset = vec2(cos(angle), sin(angle)) * pulse;
    pattern += glowRing(p - offset, 1.0, 0.004, 0.015);
  }

  return min(pattern, 1.0) * 0.4;
}

float breathe(float time) {
  float breath = sin(time * 0.28) * 0.5 + 0.5;
  breath = pow(breath, 1.3);
  return 0.75 + breath * 0.25;
}

void main() {
  vec2 uv = vTexCoord;
  uv.y = 1.0 - uv.y;

  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;

  float time = u_time * 0.2;
  float breath = breathe(u_time);

  // Flowing cosmic background
  vec2 flowDir = vec2(sin(time * 0.15), cos(time * 0.12)) * 0.08;
  vec2 q = vec2(fbm(p * 0.5 + flowDir + time * 0.02), fbm(p * 0.5 + vec2(3.0, 2.0) + time * 0.025));
  float flow = fbm(p * 0.7 + 1.5 * q + flowDir);
  flow = flow * 0.5 + 0.5;

  // Smooth animated rotation
  float rot1 = time * 0.035 + sin(time * 0.08) * 0.015;
  float rot2 = -time * 0.025 + cos(time * 0.06) * 0.012;
  vec2 rotP = rotate2D(rot1) * p;
  vec2 rotP2 = rotate2D(rot2) * p;

  // Calculate beautiful patterns
  float lotusPattern = lotus(rotP, 1.3, time);
  float ripples = energyRipples(p, time);
  float auroraPattern = aurora(rotP2, time);
  float eyePattern = sacredEye(p - vec2(0.0, 0.1), 1.4, time);
  float mandalaPattern = mandala(rotP, 0.75, time);
  float beams = lightBeams(p, time);
  float particles = magicParticles(p, time);
  float seedPattern = seedOfLife(rotP2 * 0.4, 0.4, time);

  // Deep cosmic base
  vec3 color = col8 * 0.08;

  // Rich nebula background
  float nebulaDepth = fbm(p * 1.0 + time * 0.04);
  vec3 nebula1 = mix(col0 * 0.3, col7 * 0.4, flow);
  vec3 nebula2 = mix(col9 * 0.2, col1 * 0.25, nebulaDepth);
  vec3 nebula = mix(nebula1, nebula2, 0.5);
  color = mix(color, nebula, 0.5);

  // Subtle color gradient
  float vertGrad = p.y * 0.15 + 0.5;
  color = mix(color, col0 * 0.15, vertGrad * 0.3);

  // Energy ripples
  vec3 rippleColor = mix(col2, col5, ripples);
  color += rippleColor * ripples * 0.35 * breath;

  // Aurora spirals
  vec3 auroraColor = mix(col1 * 0.8, col5, auroraPattern);
  color += auroraColor * auroraPattern * 0.25;

  // Light beams
  vec3 beamColor = mix(col3, col5, 0.5);
  color += beamColor * beams * breath;

  // Lotus flower
  vec3 lotusInner = mix(col2 * 0.6, col3 * 0.9, lotusPattern);
  vec3 lotusOuter = mix(col4, col5, lotusPattern * 0.5);
  vec3 lotusColor = mix(lotusInner, lotusOuter, lotusPattern);
  color = mix(color, lotusColor, lotusPattern * 0.4);

  // Mandala
  vec3 mandalaColor = mix(col1 * 0.7, col6 * 0.8, mandalaPattern);
  color += mandalaColor * mandalaPattern * 0.12;

  // Sacred eye
  vec3 eyeInner = mix(col4, col5, eyePattern);
  vec3 eyeOuter = mix(col3, col6, eyePattern * 0.5);
  vec3 eyeColor = mix(eyeInner, eyeOuter, eyePattern);
  color = mix(color, eyeColor, eyePattern * 0.32);

  // Seed of Life
  vec3 seedColor = mix(col4, col5, 0.6);
  color += seedColor * seedPattern * 0.08;

  // Magic particles
  vec3 particleColor = mix(col4, col5, 0.7);
  color += particleColor * particles * 0.5;

  // Central divine radiance
  float glowSize = 0.1 + sin(time * 0.5) * 0.025;
  float centerGlow = softCircle(p, glowSize, 0.35);
  float innerGlow = softCircle(p, glowSize * 0.4, 0.12);
  float coreGlow = softCircle(p, glowSize * 0.15, 0.05);

  vec3 glowColor = mix(col4, col5, sin(time * 0.35) * 0.5 + 0.5);
  color += glowColor * centerGlow * 0.12 * breath;
  color += glowColor * innerGlow * 0.1;
  color += (glowColor + vec3(0.1)) * coreGlow * 0.08;

  // Elegant halo rings
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float haloR = 0.38 + fi * 0.28 + sin(time * 0.3 + fi * 0.7) * 0.02;
    float halo = glowRing(p, haloR, 0.003, 0.01);
    vec3 haloColor = getColor(flow * 0.2 + fi * 0.08 + time * 0.01);
    color += haloColor * halo * 0.08;
  }

  // Soft radial glow
  float radialGlow = 1.0 - smoothstep(0.0, 1.1, length(p));
  radialGlow = pow(radialGlow, 3.0);
  color += mix(col3, col5, radialGlow) * radialGlow * 0.06 * breath;

  // Elegant vignette
  float vignette = 1.0 - dot(p * 0.35, p * 0.35);
  vignette = smoothstep(-0.5, 0.75, vignette);
  color *= 0.3 + 0.7 * vignette;

  // Fade to deep darkness
  float edge = smoothstep(1.85, 0.35, length(p));
  color = mix(col8 * 0.05, color, edge);

  // Final color refinement
  color = pow(color, vec3(0.92));

  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
