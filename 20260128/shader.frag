precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec2 uv = vTexCoord;
  vec2 center = uv - 0.5;
  float dist = length(center);

  // Subtle chromatic aberration
  float aberration = 0.002;
  float r = texture2D(uTexture, uv + vec2(aberration, 0.0)).r;
  float g = texture2D(uTexture, uv).g;
  float b = texture2D(uTexture, uv - vec2(aberration, 0.0)).b;
  vec4 color = vec4(r, g, b, 1.0);

  // Simple 4-tap bloom
  float bs = 0.004;
  vec4 bloom = vec4(0.0);
  bloom += texture2D(uTexture, uv + vec2(-bs, 0.0));
  bloom += texture2D(uTexture, uv + vec2(bs, 0.0));
  bloom += texture2D(uTexture, uv + vec2(0.0, -bs));
  bloom += texture2D(uTexture, uv + vec2(0.0, bs));
  bloom *= 0.25;
  color.rgb += bloom.rgb * 0.25;

  // Fast pulsing center glow
  float pulse = 0.5 + 0.5 * sin(uTime * 1.5);
  float centerGlow = smoothstep(0.5, 0.0, dist) * pulse * 0.08;
  color.rgb += vec3(0.4, 0.3, 0.7) * centerGlow;

  // Soft vignette
  float vignette = smoothstep(0.85, 0.3, dist);
  color.rgb *= vignette;

  // Color grading - boost blues/purples
  color.r *= 0.94;
  color.b *= 1.1;

  // Lift shadows
  color.rgb = color.rgb * 0.95 + 0.02;

  gl_FragColor = vec4(color.rgb, 1.0);
}
