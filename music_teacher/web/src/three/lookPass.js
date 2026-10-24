// טשטוש עומק שדה עדין בתקריבים: מה שרחוק או קרוב מדי ממישור המיקוד מטושטש מעט (כמו מצלמת וידאו בצילום תקריב).
// קורא את עומק הסצנה מ-GTAOPass (אותה מצלמה ואותו גודל), לכן פועל רק כשסגירת הסביבה דלוקה.
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const shader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    texel: { value: new THREE.Vector2(1, 1) },
    near: { value: 1 },
    far: { value: 600 },
    focus: { value: 60 }, // מרחק המיקוד מהמצלמה (יחידות סצנה)
    range: { value: 20 }, // חצי עובי תחום החדות
    maxBlur: { value: 3 }, // רדיוס טשטוש מרבי בפיקסלים
    amount: { value: 0 }, // 0 = כבוי (מצלמה רחבה), 1 = תקריב
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 texel;
    uniform float near; uniform float far; uniform float focus; uniform float range; uniform float maxBlur; uniform float amount;
    varying vec2 vUv;
    float linDepth(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (amount < 0.01) { gl_FragColor = c; return; }
      float dist = linDepth(texture2D(tDepth, vUv).x);
      float coc = clamp((abs(dist - focus) - range) / focus, 0.0, 1.0) * maxBlur * amount;
      if (coc < 0.35) { gl_FragColor = c; return; }
      vec4 sum = c; float wsum = 1.0;
      for (int i = 0; i < 12; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / 12.0) * coc;
        float a = fi * 2.399963;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r * texel;
        // לא שואבים צבע מפיקסלים חדים וקרובים יותר (שלא "יזלוג" טשטוש על האצבעות)
        float dd = linDepth(texture2D(tDepth, uv).x);
        float w = dd < dist - range ? 0.0 : 1.0;
        sum += texture2D(tDiffuse, uv) * w; wsum += w;
      }
      gl_FragColor = sum / wsum;
    }`,
};

export function createLookPass() {
  return new ShaderPass(shader); // pass.uniforms = עותק משלו של הערכים
}
