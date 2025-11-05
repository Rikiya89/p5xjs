// UI から調整する花束の設定値
let flowerSettings = {
  petals: 42,
  petalSize: 50,
  geometry: 'box',
  centerSize: 90,
  rotationSpeed: 1,
  triangles: 24
};

// 花オブジェクトと浮遊パーティクルの配列
let flowers = [];
let particles = [];

function setup() {
  // 画面サイズに合わせた正方形キャンバスを作り初期化
  let canvasSize = min(windowWidth, 800);
  if (windowWidth <= 768) {
    canvasSize = windowWidth; // モバイルでは幅いっぱい
  }

  let canvas = createCanvas(canvasSize, canvasSize, WEBGL);
  canvas.parent('canvas-container');
  smooth();
  colorMode(HSB, 360, 100, 100, 100);

  // UI コントロールを初期化
  setupControls();

  // 最初の花束を生成
  generateFlower();
}

function windowResized() {
  // ウィンドウサイズに合わせてキャンバスを調整
  let canvasSize = min(windowWidth, 800);
  if (windowWidth <= 768) {
    canvasSize = windowWidth; // モバイルでは幅いっぱい
  }
  resizeCanvas(canvasSize, canvasSize);
}

function setupControls() {
  // DOM コントロールを紐付けてスライダー変更を即時反映
  // 花びら数スライダー
  let petalsSlider = document.getElementById('petals');
  let petalsVal = document.getElementById('petals-val');
  petalsSlider.addEventListener('input', function() {
    flowerSettings.petals = parseInt(this.value);
    petalsVal.textContent = this.value;
  });

  // 花の大きさ（中心）スライダー
  let centerSlider = document.getElementById('center');
  let centerVal = document.getElementById('center-val');
  centerSlider.addEventListener('input', function() {
    flowerSettings.centerSize = parseInt(this.value);
    centerVal.textContent = this.value;
  });

  // 三角形リングのスライダー
  let trianglesSlider = document.getElementById('triangles');
  let trianglesVal = document.getElementById('triangles-val');
  trianglesSlider.addEventListener('input', function() {
    flowerSettings.triangles = parseInt(this.value);
    trianglesVal.textContent = this.value;
  });

  // 回転速度スライダー
  let rotSlider = document.getElementById('rotation');
  let rotVal = document.getElementById('rot-val');
  rotSlider.addEventListener('input', function() {
    const speed = parseFloat(this.value);
    flowerSettings.rotationSpeed = speed;
    rotVal.textContent = speed.toFixed(1);
  });

  // 再生成ボタン
  document.getElementById('generate').addEventListener('click', generateFlower);

  // 保存ボタン
  document.getElementById('save-image').addEventListener('click', function() {
    saveCanvas('flower-arrangement', 'png');
  });
}

function generateFlower() {
  // 5 本の花と周囲パーティクルを用意
  flowers = [];
  particles = [];

  // 大きさと位置を変えて花を追加
  // 中央の主役の花（最大）
  flowers.push(new Flower(
    0, -50, 0,
    flowerSettings.centerSize,
    flowerSettings.petals,
    flowerSettings.triangles
  ));

  // 左上の中サイズの花
  flowers.push(new Flower(
    -120, -150, 30,
    flowerSettings.centerSize * 0.7,
    Math.floor(flowerSettings.petals * 0.8),
    Math.floor(flowerSettings.triangles * 0.8)
  ));

  // 右上の中サイズの花
  flowers.push(new Flower(
    130, -120, -40,
    flowerSettings.centerSize * 0.75,
    Math.floor(flowerSettings.petals * 0.85),
    Math.floor(flowerSettings.triangles * 0.8)
  ));

  // 左下の小さな花
  flowers.push(new Flower(
    -80, 80, 50,
    flowerSettings.centerSize * 0.5,
    Math.floor(flowerSettings.petals * 0.6),
    Math.floor(flowerSettings.triangles * 0.6)
  ));

  // 右下の小さな花
  flowers.push(new Flower(
    100, 60, -30,
    flowerSettings.centerSize * 0.55,
    Math.floor(flowerSettings.petals * 0.65),
    Math.floor(flowerSettings.triangles * 0.6)
  ));

  // 浮遊パーティクルを生成
  for (let i = 0; i < 30; i++) {
    particles.push({
      pos: createVector(random(-400, 400), random(-400, 400), random(-200, 200)),
      vel: createVector(random(-0.5, 0.5), random(-1, -0.2), random(-0.5, 0.5)),
      size: random(2, 6),
      rotation: random(TWO_PI),
      rotSpeed: random(-0.05, 0.05)
    });
  }
}

function draw() {
  // 軌道操作とアニメーション付きで花束を描画
  background(0);

  // マウス操作で回転・ズームできる orbitControl を有効化
  orbitControl();

  // 少し傾けて見やすくする
  rotateX(PI / 10);

  // 花の描画処理を呼び出す
  for (let flower of flowers) {
    flower.display(frameCount * flowerSettings.rotationSpeed);
  }

  // パーティクルを更新して描画
  updateParticles();
  drawParticles();
}

// 花びらを球状に配置する Flower クラス
class Flower {
  constructor(x, y, z, radius = 100, petals = 40, triangles = 24) {
    this.pos = createVector(x, y, z);
    this.r = radius;
    this.petals = [];
    this.fx = [];
    this.triangles = triangles;

    // 花びらを生成
    for (let i = 0; i < petals; i++) {
      const ga = radians(137.5) * i;
      const u = map(i, 0, petals - 1, -1, 1);
      const phi = acos(u);
      const theta = ga;
      const dir = this.sphericalDir(theta, phi);
      const len = this.r * random(0.85, 1.15);
      const width = random(6, 12);
      const phase = random(TWO_PI);
      this.petals.push({ dir, len, width, phase });
    }

    // 効果用パーティクルを生成
    for (let i = 0; i < 120; i++) {
      const a = random(TWO_PI);
      const b = acos(random(-0.4, 0.4));
      const base = this.sphericalDir(a, b).mult(this.r * random(1.05, 1.35));
      const speed = random(0.002, 0.006);
      const phase = random(TWO_PI);
      this.fx.push({ base, speed, phase });
    }
  }

  sphericalDir(theta, phi) {
    // 球座標の角度を単位ベクトルに変換
    return createVector(
      sin(phi) * cos(theta),
      cos(phi),
      sin(phi) * sin(theta)
    );
  }

  drawCenter(t) {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    const pulse = 10 + 3 * sin(t * 0.02);
    noStroke();
    fill(0, 0, 100, 40);
    sphere(pulse);
    pop();
  }

  drawPetals(t) {
    stroke(0, 0, 100, 90);
    fill(0, 0, 100, 8);
    for (const p of this.petals) {
      push();
      translate(this.pos.x, this.pos.y, this.pos.z);
      const yaw = atan2(p.dir.x, p.dir.z);
      const pitch = -asin(p.dir.y);
      rotateY(yaw);
      rotateX(pitch);
      const len = p.len * (1 + 0.05 * sin(t * 0.01 + p.phase));
      const w = p.width;
      beginShape(TRIANGLE_STRIP);
      const seg = 16;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const z = lerp(6, len, u);
        const amp = w * (1 - u) ** 1.2;
        const sway = 0.3 * sin((t * 0.008 + p.phase) + u * 4.0);
        const xL = -amp + sway;
        const xR = amp + sway;
        vertex(xL, 0, z);
        vertex(xR, 0, z);
      }
      endShape();
      push();
      translate(0, 0, len);
      noStroke();
      fill(0, 0, 100, 90);
      sphere(1.8);
      pop();
      pop();
    }
  }

  drawFx(t) {
    noFill();
    stroke(0, 0, 100, 60);
    for (const q of this.fx) {
      push();
      const rot = t * q.speed + q.phase;
      const x = q.base.x * cos(rot) - q.base.z * sin(rot);
      const z = q.base.x * sin(rot) + q.base.z * cos(rot);
      const y = q.base.y;
      translate(this.pos.x + x, this.pos.y + y, this.pos.z + z);
      point(0, 0, 0);
      line(0, 0, 0, 0, 0, -3);
      pop();
    }
  }

  drawTriangleRing(t) {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    rotateY(t * 0.003);
    stroke(0, 0, 100, 90);
    fill(0, 0, 100, 10);
    const R = this.r * 2.2;
    for (let i = 0; i < this.triangles; i++) {
      push();
      rotateY((TWO_PI / this.triangles) * i);
      translate(R, 0, 0);
      beginShape();
      vertex(-40, -10, 20);
      vertex(80, 30, 0);
      vertex(-80, 30, 0);
      endShape(CLOSE);
      pop();
    }
    pop();
  }

  display(t) {
    this.drawFx(t);
    this.drawPetals(t);
    this.drawCenter(t);
    this.drawTriangleRing(t);
  }
}

function updateParticles() {
  // 浮遊パーティクルを動かし離れすぎたものを再配置
  for (let p of particles) {
    p.pos.add(p.vel);
    p.rotation += p.rotSpeed;

    // 下に落ちすぎた粒を上に戻す
    if (p.pos.y > 300) {
      p.pos.y = -300;
      p.pos.x = random(-300, 300);
      p.pos.z = random(-100, 100);
    }
  }
}

function drawParticles() {
  // 雰囲気づけの葉状パーティクルを描画
  for (let p of particles) {
    push();
    translate(p.pos.x, p.pos.y, p.pos.z);
    rotateZ(p.rotation);

    // 葉の形を描く
    fill(0);
    stroke(0, 0, 100, 60);
    strokeWeight(0.5);

    beginShape();
    for (let t = 0; t < TWO_PI; t += PI/2) {
      let r = p.size * sin(t * 2);
      vertex(r * cos(t), r * sin(t));
    }
    endShape(CLOSE);

    pop();
  }
}
