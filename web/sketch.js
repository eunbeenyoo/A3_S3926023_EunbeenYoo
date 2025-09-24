/* ======================== Spaceflight (final, no-arrows + head-turn) ======================== */
/* Assets & State */
let imgs = [];            // planets
let asteroidImgs = [];    // asteroid sprites
let planets = [];
let asteroids = [];
let worldZ;
let spacecraft;
let cockpitSound;   // 엔진(우주선) 상시 루프
let launchSound;    // 이륙음
let warningSound;   // 경고음(빨간불일 때만)

let keys = {}; // (방향키 사용 안 함)
let INIT_POS = { worldZ: 0, shipX: 0, shipY: 0 };
let surfaceImg;
let dragY = null;

/* ---------- Collision(red alert + shake) ---------- */
const COLLISION_CFG = {
  dur: 6000,
  maxShake: 30,
  flashHz: 3.5,
  cooldown: 4000
};
let COLLISION = { active: false, t0: 0, lastHit: -99999 };

/* === Cinematic hit (invisible impact during lift) === */
const HITCFG = {
  delayMin: 3600,
  delayMax: 6200,
  preTurbDur: 1600,
  preMaxJitter: 10,
  preMaxTiltDeg: 6,
  impactDur: 650,
  tumbleDur: 2800,
  recoverDur: 1200,
  blackoutDur: 420,
  relightFlashDur: 240,
  spinStartDps: 520,
  spinDamp: 0.72,
  fling: 0.010,
  speedLines: 0
};

let HIT = {
  phase: 'idle',   // idle -> impact -> tumble -> recover -> done
  t0: 0,
  impactAt: null,
  spin: 0,
  spinVel: 0,
  biasAng: 0
};

/* === Power (blackout -> relight) ========================= */
const RELIGHT = {
  flashDur: 220,
  fadeDur: 1200,
  flickerHz: 13,
  holdBlackoutMin: HITCFG.blackoutDur
};
let POWER = { state: 'on', t0: 0 }; // 'on' | 'blackout' | 'relight'

/* --- Reboot blackout controller (단순 3초 암전 전용) --- */
const REBOOT_BLACKOUT = { active: false, t0: 0, minMs: 3000 };

/* --- Arrival(빨간불/경고음 끝난 뒤 연출) --- */
const ARRIVAL = {
  active: false,
  waiting: false,  // 경고음/빨간불 종료 대기
  t0: 0,

  // 회전(인트로에서 이어받음)
  spin: 0,
  spinVel: 0,
  damp: 0.92,

  // z 접근
  targetZ: 0,

  // 리빌(별만 → 행성 등장)
  starOnlyMs: 5000,  // ★ 별만 보이는 구간 5초
  revealMs: 1800     // 왼쪽에서 오른쪽으로 마스크가 열리며 등장
};

/* --- Head-turn camera (별만 보이는 오른쪽 시야 → 왼쪽 시야로 90° 전환) --- */
const CAMERA = {
  active: false,
  yawStartDeg: 90,    // 처음 오른쪽을 바라봄 (행성 안 보임)
  yawEndDeg: 0,       // 정면(행성 방향)으로 회전
  yawMs: 2200,        // 회전 시간
  t0: 0,
  yawNow: 90
};

/* ---------- Intro state ---------- */
const INTRO = {
  active: true,
  phase: 'await',   // 'await' -> 'idle' -> 'lift' -> 'done'
  t0: 0,
  shake: 0,
  liftOffset: 0,
  vignette: 0,
  btn: { x: 0, y: 0, w: 220, h: 42, hover:false }
};
const INTRO_DUR = { idle: 1800, lift: 10000 };
const INTRO_SHAKE = { idle: 3, liftMax: 6 };

/* ---------- Ship / Camera (strafe용 변수만 남김; 방향키 삭제) ---------- */
let shipX = 0;
let shipY = 0;

/* ---------- Cockpit overlay ---------- */
let cockpitScale = 1;
let cockpitMode  = 'cover';
let cockpitOffX = 0;
let cockpitOffYNormal = -57;
let cockpitOffYFull   = 0;
let cockpitDraw = { cx:0, cy:0, w:0, h:0 };
const COCKPIT_COVER_BLEED = 1.045;

/* ---------- HUD readouts ---------- */
let hudOffsetX = 0, hudOffsetY = 0;
let hudRatioFromCenter = 0.24;
let hudTextSize = 14;
let hudAlign = 'center';
let IFACE = {
  fuel: 83, power: 73, o2: 87, co2: 0.6, cabinTemp: 20.3, cabinPress: 101.3,
  hull: 62, rad: 0.12, drift: '+0.002 AU/hr @ 217°', link: 'LOST', sync: '— — —',
  rcs: 'ONLINE', main: 'STANDBY', relVel: '0.3 m/s',
};

/* ---------- Asteroid belt ---------- */
let BELT_START_Z = 0;
let BELT_END_Z   = 0;
const ASTEROID_COUNT = 50;
const BELT_LOCK_MARGIN = 2000;
const BELT_Y_MIN = -0.60, BELT_Y_MAX = 0.60;
const VX_MIN = 0.00025, VX_MAX = 0.00200;
const VY_ABS = 0.00040;
const ROT_MIN = -0.00040, ROT_MAX = 0.00040;

/* ---------- HUD image ---------- */
let hudImg;
let showHUD = true;

/* ---------- Target lock ---------- */
let targetLock = { id: null, since: 0, lastSeen: 0, dz: Infinity, screenRect: null };

/* ---------- Window inset ---------- */
const WINDOW_INSET_X = 1.0;
const WINDOW_INSET_Y = 1.0;

/* ---------- Active Scan ---------- */
let scan = { active:false, t0:0, dur:5000, showUntil:0, result:'none' };

/* ---------- Radar UI ---------- */
const RADAR_PANEL = { xRatio: 0.00, yRatio: 0.38, wRatio: 0.52, hRatio: 0.30 };
const RADAR_CENTER_NUDGE = { x: 0, y: 0 };
const SHIP_MARKER = { offsetX: 5, offsetY: 82, size: 20 };
const RADAR_SPREAD = 1.35;
const RADAR_PX_PLANET = 9;
const RADAR_PX_AST = 4;
const RADAR_GLOW = 10;
const RADAR_AHEAD_MAX = 4500;
const RADAR_CLIP_L = -220, RADAR_CLIP_R = 12, RADAR_CLIP_T = -10, RADAR_CLIP_B = 0;
const RADAR_X_BIAS = -18;
const RADAR_CLIP_DEBUG = false;

/* ---------- Lock reticle ---------- */
const LOCK_MAX_AHEAD = 1100;
const LOCK_MIN_SIZE  = 10;
const LOCK_HYSTERESIS_MS = 450;
const LOCK_FADE_MS = 220;
const LOCK_INNER_PULSE_MS = 900;
const LOCK_COLOR = [160, 255, 220];
const LOCK_GLOW  = 'rgba(160,255,220,0.65)';

/* ---------- Slide ranges ---------- */
const SLIDE_TRIGGER_Z = 140;
const SLIDE_EXIT_Z    = -600;

/* ---------- Help panel ---------- */
const HELP_PANEL = { xRatio:-0.355, yRatio:0.375, wRatio:0.23, hRatio:0.18 };
const HELP_PAD   = { l:12, r:12, t:10, b:10 };
const HELP_TEXT_SIZE = 12;
const HELP_COLOR = [160,255,220];
const HELP_TEXT_NUDGE_X = -40;
const HELP_TEXT_NUDGE_Y = 0;

/* ======================== Helpers ======================== */
function easeInOutSine(x){ return -(Math.cos(Math.PI*x) - 1) / 2; }
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }

/* ======================== Lifecycle ======================== */
function preload() {
  for (let i = 1; i <= 6; i++) imgs.push(loadImage(`images/${i}.png`));
  for (let i = 1; i <= 5; i++) asteroidImgs.push(loadImage(`images/asteroid${i}.png`));
  spacecraft = loadImage("images/spacecraft.png");
  hudImg = loadImage("images/interface.png");
  surfaceImg = loadImage("images/surface.png");

  soundFormats('wav','mp3','ogg');
  cockpitSound = loadSound('sounds/spacecraft.wav'); // 루프
  launchSound  = loadSound('sounds/launch.wav');     // 이륙
  warningSound = loadSound('sounds/warning.wav');    // 경고
}

function setup() {
  const { w, h } = vpSize();
  const cnv = createCanvas(w, h);
  cnv.parent("app");
  pixelDensity(1);
  noSmooth();
  imageMode(CENTER);
  textFont("monospace");

  // ★엔진 사운드: 페이지 진입 즉시 자동재생(브라우저 허용 시)
  try {
    cockpitSound.setLoop(true);
    cockpitSound.setVolume(0.6);
    cockpitSound.play();
  } catch(_) {}
  // 차단 시 첫 입력에서 재개
  const resumeAudio = () => {
    try { getAudioContext().resume(); if (!cockpitSound.isPlaying()) cockpitSound.play(); } catch(_) {}
    window.removeEventListener('pointerdown', resumeAudio, {passive:true});
    window.removeEventListener('keydown', resumeAudio, {passive:true});
  };
  window.addEventListener('pointerdown', resumeAudio, {passive:true});
  window.addEventListener('keydown', resumeAudio, {passive:true});

  loadHUD();

  planets = [
    { 
      img: imgs[0], name:"P-1", x:-0.30, y:0.10, z:1200, size:500, side:"left",
      meta: {
        id: 'nyx-3d', displayName: 'Nyx-3d', type: 'Gas–ice giant',
        distanceLy: 137, tidalLock: true, similarityToEarth: 8,
        atmosphere: 'H₂ / He, methane haze', life: 'No biosigns',
        hazard: 'Severe winds, cryo-temps',
        notes: 'One side in perpetual light, the other in darkness. Narroraces of suspended liquid haze.'
      }
    },
    { img: imgs[1], name:"P-2", x:0.20, y:-0.30, z:2200, size:120, side:"right" },
    { img: imgs[2], name:"P-3", x:0.55, y:0.20,  z:3600, size:110, side:"right" },
    { img: imgs[3], name:"P-4", x:-0.40,y:-0.40, z:4200, size:150, side:"left"  },
    { img: imgs[4], name:"P-5", x:0.35, y:0.08,  z:5200, size:130, side:"right" },
    { img: imgs[5], name:"P-6", x:-0.18,y:0.32,  z:6200, size:115, side:"left"  },
  ];

  const lastZ = planets[planets.length - 1].z; // 6200
  BELT_START_Z = lastZ + 2000;        // 8200
  BELT_END_Z   = BELT_START_Z + 3000; // 11200

  initAsteroids();

  worldZ = planets[0].z - 800;
  INIT_POS.worldZ = worldZ;
  INIT_POS.shipX  = 0;
  INIT_POS.shipY  = 0;

  INTRO.t0 = millis(); // 인트로 타이머 시작
}

/* ======================== Core systems ======================== */
function startLaunch() {
  INTRO.phase = 'idle';
  INTRO.t0 = millis();

  // 이륙음
  if (launchSound) { try { launchSound.play(); } catch(_){} }

  if (cockpitSound && !cockpitSound.isPlaying()) {
    cockpitSound.setLoop(true);
    cockpitSound.setVolume(0.6);
    cockpitSound.play();
  }
}

/* --- Collision envelope & red alert --- */
function startCollision() {
  const now = millis();
  if (now - COLLISION.lastHit < COLLISION_CFG.cooldown) return;
  COLLISION.active = true;
  COLLISION.t0 = now;
  COLLISION.lastHit = now;

  IFACE.hull = max(0, IFACE.hull - int(random(1, 4)));
  IFACE.link = 'NOISE';
  IFACE.sync = 'DESYNC';

  if (warningSound) { try { warningSound.stop(); warningSound.play(); } catch(_){} }
}
function updateCollision() {
  if (!COLLISION.active) return 0;
  const t = millis() - COLLISION.t0;
  if (t >= COLLISION_CFG.dur) { COLLISION.active = false; return 0; }
  const p = constrain(t / COLLISION_CFG.dur, 0, 1);
  const env = 1 - pow(p, 2.2);
  return COLLISION_CFG.maxShake * env;
}
function drawRedAlert() {
  if (!COLLISION.active) return;
  const t = millis() - COLLISION.t0;
  const p = constrain(t / COLLISION_CFG.dur, 0, 1);
  const flash = (sin(TWO_PI * COLLISION_CFG.flashHz * p * COLLISION_CFG.dur/1000) * 0.5 + 0.5);
  const alpha = (0.25 + 0.45 * flash) * (1 - p);
  push(); noStroke(); fill(255, 30, 30, 255 * alpha); rect(0, 0, width, height); pop();
}

/* --- Power overlays (blackout / relight) --- */
function drawPowerOverlay(){
  if (POWER.state === 'blackout') {
    const t = (millis() - POWER.t0) * 0.001;
    const breathe = 0.04 * (noise(t * 0.7) - 0.5);
    const a = 240 + breathe * 255;
    push(); noStroke(); fill(0,0,0, constrain(a, 220, 255)); rect(0,0,width,height); pop();
    return;
  }

  if (POWER.state === 'relight') {
    const el = millis() - POWER.t0;

    if (el < RELIGHT.flashDur) {
      const p = el / RELIGHT.flashDur;
      const a = 255 * (1 - p);
      push(); noStroke(); fill(255,255,255, a); rect(0,0,width,height); pop();
      return;
    }

    const k = (el - RELIGHT.flashDur) / RELIGHT.fadeDur; // 0→1
    const e = easeOutCubic( constrain(k, 0, 1) );
    const flickerAmp = (1 - e) * 0.28;
    const f = Math.sin(TWO_PI * RELIGHT.flickerHz * k + random(-0.25,0.25));
    const flicker = 1 - flickerAmp * max(0, f);

    const baseAlpha = 210 * (1 - e);
    const a = constrain(baseAlpha * flicker, 0, 210);

    push(); noStroke(); fill(0,0,0, a); rect(0,0,width,height); pop();

    if (k >= 1) POWER.state = 'on';
  }
}

/* --- Scan --- */
function startScan() {
  if (scan.active) return;
  scan.active = true;
  scan.t0 = millis();
  scan.result = 'none';
  IFACE.link = 'SEARCH';
  IFACE.sync = 'SCANNING';
}
function updateScan() {
  if (!scan.active) return;
  const p = (millis() - scan.t0) / scan.dur;
  if (p >= 1) {
    scan.active = false;
    scan.showUntil = millis() + 1800;
    IFACE.link = 'LOST';
    IFACE.sync = '— — —';
  }
}
function isScanMessageVisible() { return scan.active || millis() < scan.showUntil; }
function scanProgress() { return constrain((millis() - scan.t0) / scan.dur, 0, 1); }

/* --- Viewport helper --- */
function vpSize() {
  return { w: Math.round(window.innerWidth), h: Math.round(window.innerHeight) };
}

/* ======================== Intro renderer ======================== */
function drawIntro() {
  const now = millis();
  const dt  = now - (INTRO.t0 || now);

  // 페이즈 전환
  if (INTRO.phase === 'idle' && dt >= INTRO_DUR.idle) {
    INTRO.phase = 'lift';
    INTRO.t0 = now;

    // lift 시작과 동시에 보이지 않는 충돌 예약
    HIT.phase = 'idle';
    HIT.impactAt = millis() + random(HITCFG.delayMin, HITCFG.delayMax);
    HIT.spin = 0;
    HIT.spinVel = 0;
    HIT.biasAng = random(TWO_PI);

  } else if (INTRO.phase === 'lift' && dt >= INTRO_DUR.lift) {
    INTRO.phase = 'done';
    INTRO.active = false;
    return;
  }

  // 배경
  background(8,10,20);

  // 기본 인트로 흔들림
  let shake = 0;
  if (INTRO.phase === 'idle') {
    shake = INTRO_SHAKE.idle * (0.5 + 0.5*Math.sin(frameCount*0.25));
  } else if (INTRO.phase === 'lift') {
    const p = constrain((now-INTRO.t0)/INTRO_DUR.lift, 0, 1);
    shake = lerp(INTRO_SHAKE.liftMax, 1, p);
    INTRO.liftOffset = easeOutCubic(p) * (height * 0.9);
  }

  // 히트 시퀀스(impact -> tumble -> recover)
  let extraShake = 0;
  let spinNow = 0;

  // 예약된 시간 도달 → impact 시작
  if (INTRO.phase === 'lift' && HIT.phase === 'idle' && HIT.impactAt && millis() >= HIT.impactAt) {
    HIT.phase = 'impact';
    HIT.t0 = millis();
    startCollision(); // 빨간불 + 셰이크 + 경고음
    HIT.spinVel = radians(HITCFG.spinStartDps) / 60; // 라디안/프레임
  }

  // 진행/감쇠
  if (INTRO.phase === 'lift' && HIT.phase !== 'idle' && HIT.phase !== 'done') {
    const t = millis() - HIT.t0;
    if (HIT.phase === 'impact' && t >= HITCFG.impactDur)      { HIT.phase = 'tumble';  HIT.t0 = millis(); }
    else if (HIT.phase === 'tumble' && t >= HITCFG.tumbleDur) { HIT.phase = 'recover'; HIT.t0 = millis(); }
    else if (HIT.phase === 'recover' && t >= HITCFG.recoverDur) {
      HIT.phase = 'done';

      // 암전 진입
      POWER.state = 'blackout';
      POWER.t0 = millis();

      // === ARRIVAL 준비: 경고음/빨간불이 전부 끝날 때까지 대기 ===
      ARRIVAL.waiting = true;
      ARRIVAL.active  = false;
      ARRIVAL.t0 = 0;
    }

    extraShake = updateCollision();

    if (HIT.phase === 'impact' || HIT.phase === 'tumble' || HIT.phase === 'recover') {
      HIT.spin += HIT.spinVel;
      spinNow = HIT.spin;
      const damp = (HIT.phase === 'recover') ? (HITCFG.spinDamp * 0.6) : HITCFG.spinDamp;
      HIT.spinVel *= damp;
    }
  }

  // 화면 변환 + 지면/별
  push();

  // 프리-난류(impact 직전 점점 심해지는 흔들림/기울기)
  if (INTRO.phase === 'lift' && HIT.phase === 'idle' && HIT.impactAt) {
    const remain = HIT.impactAt - millis();
    if (remain <= HITCFG.preTurbDur) {
      const r = constrain(1 - remain / HITCFG.preTurbDur, 0, 1);
      const n = (noise(frameCount * 0.06) - 0.5) * 2;
      const mag = lerp(0, HITCFG.preMaxJitter, r * r);
      const bx = Math.cos(HIT.biasAng), by = Math.sin(HIT.biasAng);
      translate(bx * mag * (0.8 + 0.4 * r), by * mag * (0.8 + 0.4 * r));
      translate(n * mag * 0.6, n * mag * 0.6);
      rotate(radians(HITCFG.preMaxTiltDeg) * (n * 0.5 + r * 0.5));
    }
  }

  const totalShake = (shake || 0) + (extraShake || 0) * 1.8;
  translate(random(-totalShake, totalShake), random(-totalShake, totalShake));
  if (spinNow) rotate(spinNow);
  if (HIT.phase === 'tumble' || HIT.phase === 'recover') {
    translate(width * HITCFG.fling * (shipX || 0.2), 0);
  }

  // 별 뒤에 지면
  drawStars();
  if (surfaceImg) {
    const s = width / surfaceImg.width;
    const drawW = Math.round(surfaceImg.width * s);
    const drawH = Math.round(surfaceImg.height * s);
    const x = 0;
    const y = Math.round(height - drawH + INTRO.liftOffset);
    imageMode(CORNER);
    noTint();
    image(surfaceImg, x, y, drawW, drawH);
  }

  pop();

  if (HIT.phase === 'tumble') drawSpeedLines(HITCFG.speedLines);

  // 상태 텍스트
  push();
  textFont('monospace'); textAlign(CENTER, TOP);
  drawingContext.shadowBlur = 6;
  drawingContext.shadowColor = 'rgba(160,255,220,0.6)';
  fill(180,255,220);
  if (INTRO.phase === 'idle') {
    textSize(14); text('Pre-Launch: Guidance nominal', width/2, 16);
  } else if (INTRO.phase === 'lift') {
    textSize(14); text('Ignition… lift-off', width/2, 16);
  }
  pop();
}

/* 속도선(튜블 중 강조) */
function drawSpeedLines(n=60){
  push();
  stroke(255, 255, 255, 60);
  strokeWeight(2);
  for (let i=0; i<n; i++){
    const x = random(width);
    const y = random(height);
    const len = random(40, 160);
    line(x, y, x - len*0.6, y + len);
  }
  pop();
}

/* ======================== Main draw ======================== */
function draw() {
  // 기본 커서
  if (!(INTRO.active && INTRO.phase === 'await')) cursor('default');

  // Intro branch
  if (INTRO.active) {
    if (INTRO.phase === 'await') {
      drawLaunchPrompt();
      drawCockpitOverlay();
      drawHelpScreen(); // 시작부터 좌하단 단축키(방향키 항목 없음)
      drawRedAlert();
      drawPowerOverlay();
      return;
    } else {
      drawIntro();
      drawCockpitOverlay();
      drawHelpScreen();
      drawRedAlert();
      drawPowerOverlay();
      maybeStartArrivalAfterWarning();
      return;
    }
  }

  // Main flight branch
  updateScan();
  const shakeAmp = updateCollision();

  // world + cockpit (shake 적용)
  push();
  translate(random(-shakeAmp, shakeAmp), random(-shakeAmp, shakeAmp));
  if (COLLISION.active) {
    const rotMax = radians( map(shakeAmp, 0, COLLISION_CFG.maxShake, 0, 3) );
    rotate(random(-rotMax, rotMax));
  }

  // ===== ARRIVAL 회전/헤드턴 진행도 계산 (별은 항상 먼저 그림) =====
  let revealStarOnly = false;
  let revealProgress = 1;
  let headTurnOffsetX = 0;

  if (ARRIVAL.active) {
    // 회전 적분 + 감쇠(360도 느낌)
    ARRIVAL.spin += ARRIVAL.spinVel;
    ARRIVAL.spinVel *= ARRIVAL.damp;
    rotate(ARRIVAL.spin);

    // 헤드턴(yaw): 오른쪽→정면
    if (CAMERA.active) {
      const t = constrain((millis() - CAMERA.t0) / CAMERA.yawMs, 0, 1);
      const e = easeOutCubic(t);
      CAMERA.yawNow = CAMERA.yawStartDeg + (CAMERA.yawEndDeg - CAMERA.yawStartDeg) * e;
      // yaw가 90°일 때 행성들은 화면 오른쪽 바깥(+X)으로 밀려나 있어야 함
      headTurnOffsetX = map(CAMERA.yawNow, CAMERA.yawEndDeg, CAMERA.yawStartDeg, 0, width * 1.25);
    }

    // z 접근(멀수록 빠름)
    const dz = ARRIVAL.targetZ - worldZ;
    const approach = Math.sign(dz) * Math.max(0.6, Math.abs(dz) * 0.04);
    worldZ += approach;

    // 리빌 단계 계산(별만 보이는 구간 → 마스크 오픈)
    const tReveal = millis() - ARRIVAL.t0 - ARRIVAL.starOnlyMs;
    if (tReveal < 0) {
      revealStarOnly = true;       // 별만 보여줌
      revealProgress = 0;
    } else {
      revealProgress = constrain(tReveal / ARRIVAL.revealMs, 0, 1);
    }

    // 종료 조건
    if (Math.abs(dz) < 2 &&
        Math.abs(ARRIVAL.spinVel) < 0.0005 &&
        revealProgress >= 1 &&
        (!CAMERA.active || Math.abs(CAMERA.yawNow - CAMERA.yawEndDeg) < 0.1)) {
      ARRIVAL.active = false;
      ARRIVAL.spin = ARRIVAL.spinVel = 0;
      worldZ = ARRIVAL.targetZ;
      CAMERA.active = false;
    }
  }

  background(8,10,20);
  drawStars(); // 별은 항상 전체 화면

  // 리빌 마스크(왼쪽→오른쪽, 행성/소행성만 클립)
  if (ARRIVAL.active && !revealStarOnly && revealProgress < 1) beginRevealClip(revealProgress);

  // === 월드(행성/소행성) === : 헤드턴 오프셋으로만 밀어줌
  push();
  translate(headTurnOffsetX, 0);
  drawAsteroidBelt();
  if (!ARRIVAL.active) checkAsteroidCollision(); // 도착 연출 중에는 충돌 무시(효과 방해 X)

  planets.sort((a, b) => (b.z - worldZ) - (a.z - worldZ));
  for (const p of planets) drawPlanet(p);
  pop();

  if (ARRIVAL.active && !revealStarOnly && revealProgress < 1) endRevealClip();

  // cockpit frame
  drawCockpitOverlay();
  pop();

  // UI (non-shaken)
  drawHelpScreen();
  drawPixelRadar();
  updateTargetLock();

  if (showHUD) {
    drawInterfaceInWindow();
    drawInterfaceCopy();
  } else if (targetLock.id) {
    if (beginWindowClip()) { drawFocusReticle(); drawPlanetInfoPanel(); endWindowClip(); }
    else { drawFocusReticle(); drawPlanetInfoPanel(); }
  }

  // 최상단: overlays
  drawRedAlert();
  drawPowerOverlay();
}

/* --- ARRIVAL 트리거: 경고음 & 빨간불 끝난 뒤 시작 --- */
function maybeStartArrivalAfterWarning(){
  if (!ARRIVAL.waiting) return;

  const redAlertOver = (millis() - COLLISION.t0) >= COLLISION_CFG.dur;
  const warnOver = warningSound ? !warningSound.isPlaying() : true;

  if (redAlertOver && warnOver) {
    ARRIVAL.waiting = false;

    // 리라이트 시작
    POWER.state = 'relight';
    POWER.t0 = millis();

    // ARRIVAL 세팅
    ARRIVAL.active   = true;
    ARRIVAL.t0       = millis();

    // 회전은 인트로에서 이어받아 감쇠
    ARRIVAL.spin     = HIT.spin;
    ARRIVAL.spinVel  = HIT.spinVel * 0.9;

    // 목표 z = 원래 자리. 멀리서부터 감속 접근
    ARRIVAL.targetZ  = INIT_POS.worldZ;
    worldZ           = ARRIVAL.targetZ - 2600;

    // 헤드턴 시작(오른쪽 90° → 정면)
    CAMERA.active = true;
    CAMERA.t0 = millis();
    CAMERA.yawNow = CAMERA.yawStartDeg;
  }
}

/* --- Power trigger helper: first planet ahead --- */
function firstPlanetAhead(maxAhead = 2200){
  let best = null, bestDz = Infinity;
  for (const p of planets){
    const dz = p.z - worldZ;
    if (dz >= 0 && dz < maxAhead && dz < bestDz) { best = p; bestDz = dz; }
  }
  return best;
}

/* ======================== World renderers ======================== */
function drawStars() {
  randomSeed(2025);
  strokeWeight(1);
  for (let i = 0; i < 260; i++) {
    stroke(random(150, 255));
    point(random(width), random(height));
  }
}

function drawPlanet(p) {
  const dz = p.z - worldZ;
  if (dz < -800) return;

  const scl = 520 / max(60, dz);
  const drawSize = constrain(p.size * scl, 6, min(width, height) * 0.8);

  let sx = width/2 + (p.x + shipX) * width * 0.6;
  let sy = height/2 + (p.y + shipY) * height * 0.6;

  if (dz < SLIDE_TRIGGER_Z) {
    const prog = map(dz, SLIDE_TRIGGER_Z, SLIDE_EXIT_Z, 0, 1, true);
    const slide = prog * (width * 0.6);
    sx += (p.side === "left" ? -slide : slide);
  }

  const a = map(dz, 4000, 200, 100, 255, true);
  tint(255, a);

  push();
  translate(sx, sy);
  const wiggle = sin(frameCount * 0.012 + p.z * 0.001) * 1.1;
  image(p.img, wiggle, 0, drawSize, drawSize);
  pop();

  noTint();
}

/* ---------- Asteroids ---------- */
function initAsteroids() {
  asteroids.length = 0;
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const vx = random(VX_MIN, VX_MAX);
    const vy = random(-VY_ABS, VY_ABS);
    const rotS = random(ROT_MIN, ROT_MAX);
    asteroids.push({
      img: random(asteroidImgs),
      x: random(-1.2, 1.2),
      y: random(BELT_Y_MIN, BELT_Y_MAX),
      z: random(BELT_START_Z, BELT_END_Z),
      size: random(28, 90),
      rot: random(TWO_PI),
      rotSpeed: rotS,
      vx, vy,
      radarOffsetX: random(-20, 20),
      radarOffsetY: random(-15, 15)
    });
  }
}
function drawAsteroidBelt() {
  const camZ = Math.min(worldZ, BELT_END_Z - BELT_LOCK_MARGIN);
  const dt = deltaTime / 1000;

  for (const A of asteroids) {
    const dz = A.z - camZ;
    if (dz < -2000 || dz > 20000) continue;

    A.x += A.vx * dt;
    A.y += A.vy * dt;

    if (A.x > 1.35)  A.x -= 2.7;
    if (A.x < -1.35) A.x += 2.7;
    if (A.y > 0.5)  A.y = -0.5;
    if (A.y < -0.5) A.y =  0.5;

    A.rot += A.rotSpeed * dt;

    const scl = 520 / max(180, dz);
    const drawSize = constrain(A.size * scl, 2, min(width, height) * 0.22);

    const sx = width/2 + A.x * width * 0.75;
    const sy = height/2 + A.y * height * 0.75;

    noTint();
    push(); translate(sx, sy); rotate(A.rot); image(A.img, 0, 0, drawSize, drawSize); pop();
  }
}

/* ---------- Asteroid-collision (disabled effects during arrival) ---------- */
function checkAsteroidCollision() {
  const cx = width / 2, cy = height / 2;
  const hitW = Math.min(width, height) * 0.28;
  const hitH = Math.min(width, height) * 0.20;
  const hx = cx - hitW/2, hy = cy - hitH/2;

  for (const A of asteroids) {
    const dz = A.z - worldZ;
    if (dz < 60 || dz > 260) continue;

    const sx = width/2 + A.x * width * 0.75;
    const sy = height/2 + A.y * height * 0.75;

    const scl = 520 / Math.max(180, dz);
    const drawSize = constrain(A.size * scl, 2, Math.min(width, height) * 0.22);

    const ax = sx - drawSize/2, ay = sy - drawSize/2, aw = drawSize, ah = drawSize;
    const overlap = !(ax + aw < hx || ax > hx + hitW || ay + ah < hy || ay > hy + hitH);

    if (overlap) { break; }
  }
}

/* ---------- Interface image inside window ---------- */
function drawInterfaceInWindow() {
  if (!hudImg) return;
  const hasCockpit = cockpitDraw.w > 0 && cockpitDraw.h > 0;
  const cx = hasCockpit ? cockpitDraw.cx : width / 2;
  const cy = hasCockpit ? cockpitDraw.cy : height / 2;
  const w  = hasCockpit ? cockpitDraw.w  : width;
  const h  = hasCockpit ? cockpitDraw.h  : height;

  const winW = w * WINDOW_INSET_X;
  const winH = h * WINDOW_INSET_Y;

  const sImg = Math.max(winW / hudImg.width, winH / hudImg.height);
  const drawW = hudImg.width * sImg;
  const drawH = hudImg.height * sImg;

  imageMode(CENTER);
  noTint();
  image(hudImg, cx, cy, drawW, drawH);
}

/* ---------- Cockpit overlay ---------- */
function drawCockpitOverlay() {
  if (!spacecraft) return;

  const baseW = (spacecraft && spacecraft.width)  ? spacecraft.width  : 144;
  const baseH = (spacecraft && spacecraft.height) ? spacecraft.height : 90;

  resetMatrix();
  imageMode(CENTER);
  noTint();

  const sBase = (cockpitMode === 'cover')
    ? Math.max(width / baseW, height / baseH)
    : Math.min(width / baseW, height / baseH);

  const s = Math.ceil(sBase * cockpitScale * COCKPIT_COVER_BLEED * 1000) / 1000;

  const drawW = Math.ceil(baseW * s) + 2;
  const drawH = Math.ceil(baseH * s) + 2;

  const cyOffset = fullscreen() ? cockpitOffYFull : cockpitOffYNormal;
  const cx = Math.round(width / 2 + cockpitOffX);
  const cy = Math.round(height / 2 + cyOffset);

  image(spacecraft, cx, cy, drawW, drawH);

  cockpitDraw.cx = cx;
  cockpitDraw.cy = cy;
  cockpitDraw.w  = drawW;
  cockpitDraw.h  = drawH;
}

/* ---------- Window clip helpers ---------- */
function getWindowRect() {
  const insetX = cockpitDraw.w * 0.085;
  const insetY = cockpitDraw.h * 0.085;
  const x = cockpitDraw.cx - cockpitDraw.w/2 + insetX;
  const y = cockpitDraw.cy - cockpitDraw.h/2 + insetY;
  const w = cockpitDraw.w - insetX*2;
  const h = cockpitDraw.h - insetY*2;
  const SAFE_TOP_PUSH = 0;
  const SAFE_BOTTOM_CROP = 120;
  return {
    x: Math.round(x),
    y: Math.round(y + SAFE_TOP_PUSH),
    w: Math.round(w),
    h: Math.round(h - SAFE_BOTTOM_CROP),
  };
}
function beginWindowClip() {
  if (cockpitDraw.w === 0) return false;
  const r = getWindowRect();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(r.x, r.y, r.w, r.h);
  drawingContext.clip();
  return true;
}
function endWindowClip() { drawingContext.restore(); }

function beginRevealClip(p){
  // p: 0→1, 왼쪽에서 오른쪽으로 열리는 가로 마스크 (행성/소행성만)
  const w = Math.round(width * easeOutCubic(constrain(p,0,1)));
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(0, 0, w, height);
  drawingContext.clip();
}
function endRevealClip(){
  drawingContext.restore();
}

/* ---------- Launch prompt (await) ---------- */
function drawLaunchPrompt() {
  background(8,10,20);
  drawStars();      // 별 먼저
  if (surfaceImg) { // 그 다음 지표(별 뒤)
    const s = width / surfaceImg.width;
    const drawW = Math.round(surfaceImg.width * s);
    const drawH = Math.round(surfaceImg.height * s);
    const x = 0;
    const y = Math.round(height - drawH);
    imageMode(CORNER);
    image(surfaceImg, x, y, drawW, drawH);
  }

  // 텍스트
  push();
  textFont('monospace'); textAlign(CENTER, CENTER);
  drawingContext.shadowBlur = 8;
  drawingContext.shadowColor = 'rgba(160,255,220,0.7)';
  fill(180,255,220);
  textSize(16);
  const title = 'MISSION COMPLETE';
  const line1 = 'Survey finished. Course set for Earth.';
  const line2 = 'Commence departure?';
  text(title, width/2, height*0.28);
  textSize(14);
  text(line1, width/2, height*0.28 + 26);
  text(line2, width/2, height*0.28 + 46);
  pop();

  // 버튼
  const bw = INTRO.btn.w, bh = INTRO.btn.h;
  const bx = Math.round(width/2 - bw/2);
  const by = Math.round(height*0.28 + 86);
  INTRO.btn.x = bx; INTRO.btn.y = by;

  const hover = (mouseX>=bx && mouseX<=bx+bw && mouseY>=by && mouseY<=by+bh);
  INTRO.btn.hover = hover;

  push();
  noStroke();
  fill(hover ? 'rgba(160,255,220,0.25)' : 'rgba(160,255,220,0.15)');
  rect(bx, by, bw, bh, 8);
  stroke(160,255,220);
  strokeWeight(1.2);
  noFill();
  rect(bx, by, bw, bh, 8);
  textAlign(CENTER, CENTER);
  noStroke();
  fill(180,255,220);
  textFont('monospace'); textSize(14);
  text('LAUNCH [Y]', bx + bw/2, by + bh/2 + 1);
  pop();

  if (INTRO.btn.hover) cursor('pointer'); else cursor('default');
}

/* ---------- UI text in big window ---------- */
function drawInterfaceCopy() {
  if (cockpitDraw.w === 0) return;

  const insetX = cockpitDraw.w * 0.085;
  const insetY = cockpitDraw.h * 0.085;
  const winX = cockpitDraw.cx - cockpitDraw.w/2 + insetX;
  const winY = cockpitDraw.cy - cockpitDraw.h/2 + insetY;
  const winW = cockpitDraw.w - insetX*2;
  const winH = cockpitDraw.h - insetY*2;

  const FUEL_BAR_BOTTOM = winY + winH * 0.3;
  const RIGHT_SAFE_X = winX + winW * 0.82;

  push();
  resetMatrix();
  noStroke();

  drawingContext.shadowBlur = 8;
  drawingContext.shadowColor = 'rgba(160,255,220,0.85)';
  fill(180, 255, 220);
  textFont('monospace');

  // LEFT readouts
  let lx = winX + winW * -0.01;
  let ly = FUEL_BAR_BOTTOM + winH * 0.04;
  const lh = 20;
  textSize(14);
  textAlign(LEFT, TOP);
  const leftLines = [
    `FUEL: ${IFACE.fuel}%   •   POWER: ${IFACE.power}%`,
    `PROP: MAIN ${IFACE.main}   |   RCS ${IFACE.rcs}`,
    `LIFE: O₂ ${IFACE.o2}%   CO₂ ${IFACE.co2}%`,
    `CABIN: ${IFACE.cabinTemp}°C   ${IFACE.cabinPress} kPa`,
    `HULL: ${IFACE.hull}%  (micrometeoroid pitting)`,
    `RADIATION: ${IFACE.rad} mSv/hr`,
    `NAV: NO FIX   |   Star match < 3%`,
    `DRIFT: ${IFACE.drift}`,
    `COMMS: LINK ${IFACE.link}   SYNC: ${IFACE.sync}`,
  ];
  leftLines.forEach((s, i) => text(s, Math.round(lx), Math.round(ly + i*lh)));

  // RIGHT short info
  let rx = RIGHT_SAFE_X - winW * -0.2;
  let ry = winY + winH * 0.28;
  textAlign(RIGHT, CENTER);
  textSize(14);
  text('Beacon: standby', Math.round(rx), Math.round(ry));
  text(`Relative vel: ${IFACE.relVel}`, Math.round(rx), Math.round(ry + 22));
  text('Proximity: dust impacts detected', Math.round(rx), Math.round(ry + 44));

  // CENTER BOTTOM (scan)
  const bcx = winX + winW/2;
  const bcy = winY + winH * 0.72;
  textAlign(CENTER, TOP);
  textSize(14);

  if (isScanMessageVisible()) {
    if (scan.active) {
      const p = scanProgress();
      text('Active scan… searching for beacon', Math.round(bcx), Math.round(bcy));

      const barW = Math.round(winW * 0.42);
      const barH = 10;
      const bx = Math.round(bcx - barW/2);
      const by = Math.round(bcy + 22);

      push();
      noStroke();
      fill(80, 140, 120, 120);
      rect(bx, by, barW, barH);
      fill(160, 255, 220, 220);
      rect(bx, by, Math.max(2, Math.round(barW * p)), barH);
      pop();

      const blink = (frameCount >> 3) % 2 === 0 ? '…' : '';
      text(`signal check${blink}`, Math.round(bcx), Math.round(by + 18));
    } else {
      text('No friendly signal detected.', Math.round(bcx), Math.round(bcy));
      text('Link LOST — retry later', Math.round(bcx), Math.round(bcy + 22));
    }
  } else {
    text('No coordinates found.', Math.round(bcx), Math.round(bcy));
    text('Passive scan running…  retarget failed', Math.round(bcx), Math.round(bcy + 22));
  }
  pop();
}

/* ---------- Help screen (좌하단 패널) ---------- */
function drawHelpScreen() {
  if (cockpitDraw.w === 0) return;

  const px = cockpitDraw.cx + cockpitDraw.w * HELP_PANEL.xRatio;
  const py = cockpitDraw.cy + cockpitDraw.h * HELP_PANEL.yRatio;
  const pw = cockpitDraw.w  * HELP_PANEL.wRatio;
  const ph = cockpitDraw.h  * HELP_PANEL.hRatio;

  const cx = px + HELP_PAD.l;
  const cy = py + HELP_PAD.t;

  push();
  resetMatrix();
  fill(HELP_COLOR[0], HELP_COLOR[1], HELP_COLOR[2]);
  drawingContext.shadowBlur = 6;
  drawingContext.shadowColor = 'rgba(160,255,220,0.65)';
  textFont('monospace');
  textSize(HELP_TEXT_SIZE);
  textAlign(LEFT, TOP);

  const L = [
  'Scroll to drift',
  '[R] reset',
  '[F] fullscreen',
  '[I] HUD on/off',
  '[S] active scan'
];
  const lh = HELP_TEXT_SIZE + 4;
  for (let i = 0; i < L.length; i++) {
    text(L[i], Math.round(cx + HELP_TEXT_NUDGE_X), Math.round(cy + HELP_TEXT_NUDGE_Y + i * lh));
  }
  pop();
}

/* ---------- Radar ---------- */
function drawPixelRadar() {
  if (cockpitDraw.w === 0) return;

  const px = cockpitDraw.cx + cockpitDraw.w * RADAR_PANEL.xRatio;
  const py = cockpitDraw.cy + cockpitDraw.h * RADAR_PANEL.yRatio;
  const pw = cockpitDraw.w  * RADAR_PANEL.wRatio;
  const ph = cockpitDraw.h  * RADAR_PANEL.hRatio;

  const RAD = Math.min(pw, ph) * 0.42;
  const rcx = px + RADAR_CENTER_NUDGE.x;
  const rcy = py + RADAR_CENTER_NUDGE.y;
  const ox = rcx + SHIP_MARKER.offsetX + 1;
  const oy = rcy + SHIP_MARKER.offsetY;

  const clipX = px + RADAR_CLIP_L;
  const clipY = py + RADAR_CLIP_T;
  const clipW = pw - (RADAR_CLIP_L + RADAR_CLIP_R);
  const clipH = ph - (RADAR_CLIP_T + RADAR_CLIP_B);
  if (clipW <= 4 || clipH <= 4) return;

  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(clipX, clipY, clipW, clipH);
  drawingContext.clip();

  if (RADAR_CLIP_DEBUG) { push(); noFill(); stroke(0,255,255,150); strokeWeight(1); rect(clipX, clipY, clipW, clipH); pop(); }

  // ship marker
  push();
  noStroke();
  drawingContext.shadowBlur = 6;
  drawingContext.shadowColor = 'rgba(80,255,120,0.9)';
  fill(60, 240, 100);
  rectMode(CENTER);
  rect(Math.round(constrain(ox, clipX + 1, clipX + clipW - 1)),
       Math.round(constrain(oy, clipY + 1, clipY + clipH - 1)),
       SHIP_MARKER.size, SHIP_MARKER.size);
  pop();

  function lateralForPlanet(p, dz) {
    const near = 500;
    let lateral = p.x * RAD * 0.85 * RADAR_SPREAD;
    let focus = map(dz, 2000, 500, 0, 1, true);
    lateral = lerp(lateral, 0, focus * 0.35);
    if (dz < near) {
      let prog = map(dz, near, -600, 0, 1, true);
      let slide = prog * (RAD * 0.9);
      lateral += (p.side === 'left' ? -slide : slide) * 0.35;
    }
    return lateral;
  }

  planets.forEach(p => {
    const dz = p.z - worldZ;
    if (dz < 0 || dz > RADAR_AHEAD_MAX) return;

    const rx = ox + lateralForPlanet(p, dz);
    const ry = oy - map(dz, 0, RADAR_AHEAD_MAX, 0, RAD * 0.9);
    const cx = constrain(rx, clipX + 1, clipX + clipW - 1);
    const cy = constrain(ry, clipY + 1, clipY + clipH - 1);

    push();
    noStroke();
    drawingContext.shadowBlur = RADAR_GLOW;
    drawingContext.shadowColor = 'rgba(255,80,80,0.95)';
    fill(255, 60, 60);
    rectMode(CENTER);
    rect(Math.round(cx), Math.round(cy), RADAR_PX_PLANET, RADAR_PX_PLANET);
    pop();
  });

  asteroids.forEach(A => {
    const dz = A.z - worldZ;
    if (dz < 0 || dz > RADAR_AHEAD_MAX) return;

    const rx = ox + (A.x * RAD * 0.9) + A.radarOffsetX;
    const ry = oy - map(dz, 0, RADAR_AHEAD_MAX, 0, RAD * 0.9) + A.radarOffsetY;
    const cx = constrain(rx, clipX + 1, clipX + clipW - 1);
    const cy = constrain(ry, clipY + 1, clipY + clipH - 1);

    push();
    noStroke();
    drawingContext.shadowBlur = 3;
    drawingContext.shadowColor = 'rgba(255,255,255,0.8)';
    fill(255);
    rectMode(CENTER);
    rect(Math.round(cx), Math.round(cy), RADAR_PX_AST, RADAR_PX_AST);
    pop();
  });

  // scan sweep
  if (scan.active) {
    const p = scanProgress();
    const turns = 2.0;
    const ang = -HALF_PI + p * TWO_PI * turns;
    push();
    stroke(80, 255, 120, 180);
    strokeWeight(2);
    const len = Math.min(pw, ph) * 0.46;
    const sx = ox, sy = oy;
    const ex = sx + Math.cos(ang) * len;
    const ey = sy + Math.sin(ang) * len;
    line(Math.round(constrain(sx, clipX + 1, clipX + clipW - 1)),
         Math.round(constrain(sy, clipY + 1, clipY + clipH - 1)),
         Math.round(constrain(ex, clipX + 1, clipX + clipW - 1)),
         Math.round(constrain(ey, clipY + 1, clipY + clipH - 1)));
    pop();
  }

  drawingContext.restore();
}

/* ---------- Target lock ---------- */
function findLockCandidate(maxAhead = LOCK_MAX_AHEAD) {
  let best = null, bestDz = Infinity;
  for (const p of planets) {
    const dz = p.z - worldZ;
    if (dz < 0 || dz > maxAhead) continue;

    const scl = 520 / Math.max(60, dz);
    const drawSize = constrain(p.size * scl, 6, Math.min(width, height) * 0.8);
    if (drawSize < LOCK_MIN_SIZE) continue;

    let sx = width/2 + (p.x + shipX) * width * 0.6;
    let sy = height/2 + (p.y + shipY) * height * 0.6;

    if (dz < SLIDE_TRIGGER_Z) {
      const prog = map(dz, SLIDE_TRIGGER_Z, SLIDE_EXIT_Z, 0, 1, true);
      const slide = prog * (width * 0.6);
      sx += (p.side === "left" ? -slide : slide);
    }

    if (dz < bestDz) {
      bestDz = dz;
      best = { planet: p, dz, rect: { x: sx - drawSize/2, y: sy - drawSize/2, w: drawSize, h: drawSize } };
    }
  }
  return best;
}
function updateTargetLock() {
  const cand = findLockCandidate();
  const now = millis();

  if (!cand) {
    if (targetLock.id && now - targetLock.lastSeen < LOCK_HYSTERESIS_MS) return;
    targetLock.id = null; targetLock.since = 0; targetLock.screenRect = null; targetLock.dz = Infinity; return;
  }

  const pid = cand.planet.meta?.id || cand.planet.name || 'unknown';
  if (targetLock.id !== pid) { targetLock.id = pid; targetLock.since = now; }
  targetLock.lastSeen   = now;
  targetLock.screenRect = cand.rect;
  targetLock.dz         = cand.dz;
}
function drawFocusReticle() {
  if (!targetLock.id || !targetLock.screenRect) return;
  const now = millis();
  const fade = constrain((now - targetLock.since) / LOCK_FADE_MS, 0, 1);
  const pulseT = (now % LOCK_INNER_PULSE_MS) / LOCK_INNER_PULSE_MS;
  const pulse = 0.5 - 0.5 * Math.cos(pulseT * TWO_PI);
  const r = targetLock.screenRect;
  const pad = Math.max(8, Math.min(r.w, r.h) * 0.06);
  const x = Math.round(r.x - pad), y = Math.round(r.y - pad);
  const w = Math.round(r.w + pad*2), h = Math.round(r.h + pad*2);

  push();
  noFill();
  stroke(LOCK_COLOR[0], LOCK_COLOR[1], LOCK_COLOR[2], 200 * fade);
  strokeWeight(2);
  drawingContext.shadowBlur = 6;
  drawingContext.shadowColor = LOCK_GLOW;
  const cw = Math.max(12, Math.min(w, h) * 0.20);
  // corner brackets
  line(x, y, x + cw, y);           line(x, y, x, y + cw);
  line(x + w, y, x + w - cw, y);   line(x + w, y, x + w, y + cw);
  line(x, y + h, x + cw, y + h);   line(x, y + h, x, y + h - cw);
  line(x + w, y + h, x + w - cw, y + h);
  line(x + w, y + h, x + w, y + h - cw);

  const innerInset = Math.round((Math.min(w,h)*0.08) + pulse*((Math.min(w,h)*0.03)));
  stroke(LOCK_COLOR[0], LOCK_COLOR[1], LOCK_COLOR[2], 140 * fade);
  strokeWeight(1);
  rectMode(CORNER);
  rect(x + innerInset, y + innerInset, w - innerInset*2, h - innerInset*2);
  pop();
}

/* ======================== Input ======================== */
function mouseWheel(e) {
  if (INTRO.active && INTRO.phase === 'await') return false;
  if (ARRIVAL.active) return false; // 리빌 중 잠금
  worldZ += e.deltaY * 0.75;
  const lockZ = BELT_END_Z - BELT_LOCK_MARGIN;
  worldZ = constrain(worldZ, 0, lockZ);
  return false;
}
function mousePressed(){
  tryFullscreen();
  if (INTRO.active && INTRO.phase === 'await') {
    const { x, y, w, h } = INTRO.btn;
    if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) startLaunch();
    return false;
  }
  if (ARRIVAL.active) return false; // 리빌 중 잠금
  dragY = mouseY;
}
function mouseDragged(){
  if (INTRO.active && INTRO.phase === 'await') return false;
  if (ARRIVAL.active) return false; // 리빌 중 잠금
  const dy = mouseY - dragY;
  worldZ += dy * 1.2;
  const lockZ = BELT_END_Z - BELT_LOCK_MARGIN;
  worldZ = constrain(worldZ, 0, lockZ);
  dragY = mouseY;
}
function mouseReleased(){ dragY = null; }

function keyPressed() {
  // Awaiting launch: only Y / Enter
  if (INTRO.active && INTRO.phase === 'await') {
    if (key === 'y' || key === 'Y' || keyCode === ENTER || keyCode === RETURN) startLaunch();
    return false;
  }

  keys[key] = true;

  if (key === 'r' || key === 'R') {
    worldZ = INIT_POS.worldZ; shipX = INIT_POS.shipX; shipY = INIT_POS.shipY; return false;
  }
  if (key === 'f' || key === 'F') {
    fullscreen(!fullscreen());
    setTimeout(()=>{ const { w, h } = vpSize(); resizeCanvas(w, h); }, 60);
    return false;
  }
  if (key === 'i' || key === 'I') { showHUD = !showHUD; return false; }
  if (key === 's' || key === 'S') { startScan(); return false; }

  return false;
}
function keyReleased() { keys[key] = false; }

/* ---------- HUD save/load ---------- */
function saveHUD() {
  try { localStorage.setItem('spaceHud', JSON.stringify({ hudOffsetX, hudOffsetY, hudTextSize, hudAlign, hudRatioFromCenter })); } catch (_) {}
}
function loadHUD() {
  try {
    const raw = localStorage.getItem('spaceHud'); if (!raw) return;
    const d = JSON.parse(raw);
    if (typeof d.hudOffsetX === 'number') hudOffsetX = d.hudOffsetX;
    if (typeof d.hudOffsetY === 'number') hudOffsetY = d.hudOffsetY;
    if (typeof d.hudTextSize === 'number') hudTextSize = d.hudTextSize;
    if (typeof d.hudAlign === 'string')   hudAlign = d.hudAlign;
    if (typeof d.hudRatioFromCenter === 'number') hudRatioFromCenter = d.hudRatioFromCenter;
  } catch (_) {}
}

/* ======================== End ======================== */
function drawPlanetInfoPanel() { /* no-op to prevent undefined reference */ }

/* ---------- Fullscreen helper ---------- */
function tryFullscreen() {
  try {
    if (!document.fullscreenElement) {
      fullscreen(true);
      setTimeout(() => { const { w, h } = vpSize(); resizeCanvas(w, h); }, 60);
    }
  } catch (_) {}
}