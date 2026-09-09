(function SpaceInvaders(container, options) {
'use strict';

// Default options
options = {
    deathStar: '.auth-signin-form',
    eggButton: '.auth-signin-logo',
    scoreStorage: 'logon_best_score',
    ...options
};

const GAME_VERSION = '1.1';

const THEMES = {
    dark:  { BG: 'rgba(23, 23, 23, 1)', GRID_STROKE: 'rgba(231, 231, 231, 0.2)',
             HUD_TEXT: '#ffffff', HUD_SHADOW: 'rgba(0, 0, 0, 0.5)',
             SCORE_COLOR: '#ffdd44', SCORE_GLOW: '#ffcc00',
             COLORS: ['#4be28f', '#ffb23e', '#4b4cfc', '#ffb8f8', '#ff4949'] },
    light: { BG: 'rgba(250, 250, 250, 1)', GRID_STROKE: 'rgba(23, 23, 23, 0.2)',
             HUD_TEXT: '#111111', HUD_SHADOW: 'rgba(255, 255, 255, 0.7)',
             SCORE_COLOR: '#cc7700', SCORE_GLOW: '#ffaa00',
             COLORS: ['#1a9c5e', '#c97700', '#2020d0', '#cc33cc', '#cc1111'] }
};

class LogonBg {
    constructor(theme) {
        const t = THEMES[theme] || THEMES.dark;
        this.BG          = t.BG;
        this.GRID_STROKE = t.GRID_STROKE;
        this.HUD_TEXT    = t.HUD_TEXT;
        this.HUD_SHADOW  = t.HUD_SHADOW;
        this.SCORE_COLOR = t.SCORE_COLOR;
        this.SCORE_GLOW  = t.SCORE_GLOW;
        this.COLORS      = t.COLORS;
    }
}

const TWO_PI = Math.PI * 2;
let COLORS = THEMES.dark.COLORS;
const RND = (a=0, b=1) => a + Math.random() * (b - a);
const AUDIO = new (window.AudioContext || window.webkitAudioContext)();

// Eases a difficulty / asymptotically instead of via a hard clamp
const levelRamp = (base, span, level) => base + span * (1 - 0.85 ** (level - 1));

// Cheap Math.sin() substitute for cosmetic pulsing/flicker
const triangleWave = (phase) => {
    const t = (phase % TWO_PI) / TWO_PI;
    return 1 - Math.abs(2 * t - 1);
};

// Locales
function resolveLocale() {
    const EN = {
        GO: 'GO!',
        DEATH_STAR_DESTROYED: 'DEATH STAR DESTROYED!',
        USE_THE_FORCE: 'USE THE FORCE LUKE!',
        TOO_FAR: 'TOO FAR',
        RELOAD: 'RELOAD',
        HEALTH_PICKUP: '+HP',
        BOSS_INCOMING: 'BOSS!',
        LEVEL: n => `LEVEL ${n}`,
        SCORE: s => `Score ${s}`,
        COMBO: c => `\xd7${c} COMBO`,
        BEST:  s => `BEST ${s}`,
        QUAD:   secs => `✚ QUAD ${secs}s`,
        TRIPLE: secs => `✦ TRIPLE ${secs}s`,
        SLOW:   secs => `⧗ SLOW ${secs}s`,
        SHIELD: secs => `■ SHIELD ${secs}s`,
        BOMB_COUNT:  n => `✸ \xd7${n}`
    };
    const FR = {
        GO: "C'EST PARTI !",
        DEATH_STAR_DESTROYED: 'ETOILE DE LA MORT DETRUITE !',
        USE_THE_FORCE: 'UTILISE LA FORCE, LUKE !',
        TOO_FAR: 'TROP LOIN',
        RELOAD: 'RECHARGEMENT',
        HEALTH_PICKUP: '+PV',
        BOSS_INCOMING: 'BOSS !',
        LEVEL: n => `NIVEAU ${n}`,
        SCORE: s => `Score ${s}`,
        COMBO: c => `\xd7${c} COMBO`,
        BEST:  s => `MEILLEUR ${s}`,
        QUAD:   secs => `✚ QUADRUPLE ${secs}s`,
        TRIPLE: secs => `✦ TRIPLE ${secs}s`,
        SLOW:   secs => `⧗ RALENTIR ${secs}s`,
        SHIELD: secs => `■ BOUCLIER ${secs}s`,
        BOMB_COUNT: n => `✸ \xd7${n}`
    };
    const l = (document.documentElement.lang || navigator.language || 'en').slice(0, 2).toLowerCase();
    const LOCALES = { en: EN, fr: FR };
    return LOCALES[l] || EN;
}

const MSG = resolveLocale();

// Web Audio retro beep effects
const Sound = (() => {
    function tone(freq, type, dur, vol, freq2) {
        try {
            const osc = AUDIO.createOscillator();
            const g = AUDIO.createGain();
            osc.connect(g);
            g.connect(AUDIO.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, AUDIO.currentTime);
            freq2 && osc.frequency.exponentialRampToValueAtTime(freq2, AUDIO.currentTime + dur);
            g.gain.setValueAtTime(vol, AUDIO.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, AUDIO.currentTime + dur);
            osc.start();
            osc.stop(AUDIO.currentTime + dur);
        } catch (e) {
            // ignore
        }
    }
    return {
        shoot:   () => { tone(1600, 'sawtooth', 0.20, 0.28, 55); tone(3200, 'square', 0.03, 0.12, 900); },
        hit:     () => tone(300, 'sawtooth', 0.08, 0.25, 150),
        damage:  () => tone(120, 'square', 0.22, 0.40,  60),
        explode: () => tone(90,  'sawtooth', 0.25, 0.35,  40),
        pickup:  () => { tone(523,'sine',0.09,0.25); setTimeout(() => tone(784,'sine',0.09,0.25),90); },
        powerup: () => { [440,554,659,880].forEach((f,i) => setTimeout(()=>tone(f,'sine',0.1,0.2),i*70)); },
        bossDie: () => { for (let i=0;i<6;i++) setTimeout(() => tone(RND(80,350),'sawtooth',0.18,0.28),i*90); },
        boom: () => {
            tone(55,  'sawtooth', 1.6, 0.55, 20);
            tone(30,  'sine',     2.0, 0.50, 14);
            tone(90,  'square',   0.9, 0.35, 30);
            for (let i = 0; i < 18; i++)
                setTimeout(() => tone(RND(60, 500), 'sawtooth', RND(0.15, 0.3), 0.24), i * 70);
        },
        warp:    () => tone(180, 'sine', 0.60, 0.30, 900),
        attract: () => tone(520, 'sawtooth', 0.45, 0.22, 90),
        reflect: () => tone(1100, 'triangle', 0.12, 0.28, 2000),
        bump:    () => tone(150, 'triangle', 0.10, 0.22, 70),
        count:   () => tone(440, 'sine', 0.12, 0.30),
        go:      () => tone(880, 'square', 0.15, 0.25, 1200),
    };
})();

let canvas, ctx, dpr; // canvas and context, device pixel ratio
let W, H;        // canvas width and height in pixels
let cx, cy;      // canvas center in pixels
let screenDiag;  // Math.hypot(W, H), cached on resize
let logo;        // the easter-egg logo - superlaser fires from its center

let gridCanvas;   // offscreen cache
let gridKey = ''; // cache key for the grid background, based on canvas size and theme

const MIN_SPEED = 0.4;
const MAX_SPEED = 5;
const MAX_BOMBS = 5;

// -- Scoring constants ---------------------------------------------------
const ALIEN_POINTS = [5, 10, 20, 50]; // score per kill, indexed by alien style
const BOSS_KILL_POINTS        = 500;  // base boss kill reward at level 1, before combo multiplier
const BOOM_BONUS_POINTS       = 2000; // death-star destruction bonus
const STREAK_TRACTOR_PENALTY  = 50;   // score lost when a background streak's tractor beam catches the ship
const ALIEN_LASER_HIT_PENALTY = 100;  // score lost when an enemy laser hits the ship
const BOSS_RAM_PENALTY        = 500;  // score lost ramming the boss while shielded

// -- Game state --------------------------------------------------------------

// Active entities
// `streaks` is declared as a Streaks instance further below, next to the class
let explosions;         // active explosions
let shockwaves  = [];   // expanding rings from the death-star boom
let ship        = null; // player-controlled ship
let shipRespawn = null; // { x, y, targetX, targetY, age, dur } while a replacement ship flies in from the HUD
let aliens      = [];   // active alien swarm
let boss        = null; // active boss alien
let lasers      = [];   // player shots
let alienLasers = [];   // enemy shots
let borderAliens = [];  // aliens that spawn on the form's perimeter
let borderTrainT = 0;   // shared perimeter cursor for the alien train
let screenFlash  = 0;   // full-screen white flash countdown for the boom

// Scoring and game flow
let score             = 0;  // increments with each alien kill, displayed in the HUD
let frame             = 0;  // increments each animation frame, used for timing
let lastShot          = 0;  // frameNow of the last player shot, used to throttle fire rate
let burstShots        = 0;  // consecutive laser shots fired without a break, capped below
let reloadUntil       = 0;  // frameNow until which firing is locked out after maxing the burst
let tooFarMsgAt       = 0;  // Date.now() of the last "too far to bomb" popup, throttles spam
let forceMsgAt        = 0;  // frameNow of the last "Use the Force" popup, throttles spam
let shipHp            = 0;  // reserve ships in the hangar - real lives = shipHp + 1 (the reserve, plus the one currently flying)
let healthPacks       = []; // health pack pickups that spawn on the form, restore HP when collected
let nextHealthPackAt  = 0;  // frameNow of the next health pack spawn
let borderTrainCount  = 10; // number of aliens in the perimeter train, grows per boss kill
let maxAlienLasers    = 1;  // grows +1 per boss kill
let levelNumber       = 1;  // increments each boss kill, drives speed and alien count

// Match lifecycle
let gameStartAt  = 0;     // frameNow of the match start, used to delay the first level
let finalScore   = null;  // final score at game over, used to display the end-of-game HUD
let finalScoreAt = 0;     // frameNow of the final score, used to delay the end-of-game HUD
let gameOver     = false; // true once the ship has been destroyed, used to delay the end-of-game HUD
let gameEnding   = false; // true once the ship has been destroyed and the final score has been displayed, used to delay the end-of-game HUD
let floatScores  = [];    // floating score popups that appear when aliens are destroyed, fade out and disappear
let shakeAmt     = 0;  // screen shake countdown, used to emphasize explosions and the death-star boom
let shipHitFlash = 0;  // countdown for the ship hit flash effect
let combo        = 1;  // score multiplier that grows with each alien kill, resets on ship hit
let comboTimer   = 0;  // countdown for the combo multiplier, resets on alien kill, resets combo to 1 when it reaches 0
let levelAnnouncement = null; // { text, age } of the current level announcement, displayed in the HUD
let countdown    = -1; // countdown timer for the start of the next level, displayed in the HUD
let countdownAt  = 0;  // frameNow of the countdown start, used to delay the countdown display
let frameNow     = 0;  // current frame number, used for timing and cooldowns
let started      = false; // true once the first level has started, used to delay the first level until the player is ready

// Input keys
let keys;

// -- Streak ------------------------------------------------------------------
// Radial light trail that shoots outward from the screen center
// - inhibits the player from shooting when on a streak
// - it is used to telegraph the death-star superlaser

class Streak {
    constructor(d) { this.spawn(d); }

    spawn(d) {
        this.angle     = RND() * TWO_PI;
        this.cosA      = Math.cos(this.angle);
        this.sinA      = Math.sin(this.angle);
        this.speed     = RND(2, 4.5) * dpr;
        this.len       = RND(40, 110) * dpr;
        this.dist      = RND(20, 60)  * dpr;
        this.color     = COLORS[Math.floor(RND() * COLORS.length)];
        this.alpha     = RND(0.65, 1);
        this.width     = RND(1.2, 2.4) * dpr;
        this.maxDist   = Math.hypot(cx, cy) * 1.15;
        this.countdown = d ? Math.floor(RND() * 180) : Math.floor(RND(20, 100));
    }

    update(dt) {
        if ((this.countdown -= dt) > 0)
            return;
        this.dist += this.speed * dt;
        if (this.dist - this.len > this.maxDist)
            this.spawn(false);
    }

    draw() {
        if (this.countdown > 0)
            return;
        const fadeStart = this.maxDist * 0.55;
        let alpha = this.alpha;
        if (this.dist > fadeStart)
            alpha *= Math.max(0, 1 - (this.dist - fadeStart) / (this.maxDist - fadeStart));
        if (alpha <= 0)
            return;
        const tail = Math.max(0, this.dist - this.len);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth   = this.width;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + this.cosA * tail,      cy + this.sinA * tail);
        ctx.lineTo(cx + this.cosA * this.dist, cy + this.sinA * this.dist);
        ctx.stroke();
        ctx.restore();
    }
}

// Background streak field
class Streaks {
    constructor() {
        this.list = [];
    }

    init() {
        this.list = Array.from({ length: 11 }, () => new Streak(true));
    }

    // Animate existing streaks; add one every 75 frames up to 16
    update(dt) {
        this.list.forEach(s => {
            s.update(dt);
            s.draw();
        });
        if (frame % 75 === 0 && this.list.length < 16)
            this.list.push(new Streak(false));
    }
}

const streaks = new Streaks();

// -- Ship power-up pickups ---------------------------------------------------

class Powerups {
    constructor() {
        this.reset();
    }

    // Resets all power-up state; nextAt defaults to "due immediately"
    reset(nextAt = 0) {
        this.active      = [];     // PowerUp instances currently on the field
        this.nextAt      = nextAt; // frameNow of the next spawn
        this.quadUntil   = 0;      // frameNow until which the ship fires 4 shots at once
        this.tripleUntil = 0;      // frameNow until which the ship fires 3 shots at once
        this.shieldUntil = 0;      // frameNow until which the ship is invulnerable to alien hits
        this.slowUntil   = 0;      // frameNow until which time is slowed
        this.bombs       = [];     // in-flight homing bombs
        this.bombQueue   = 0;      // number of bombs queued to fire next
    }

    // Spawns a power-up on a timer (skipping types already active or on
    // field), then updates/draws them and applies the effect on pickup
    update(dt) {
        if (started && this.active.length < 2 && frameNow >= this.nextAt) {
            const usedIds = new Set(this.active.map(p => p.id));
            if (this.shieldUntil > frameNow) usedIds.add('shield');
            if (this.tripleUntil > frameNow) usedIds.add('triple');
            if (this.quadUntil   > frameNow) usedIds.add('quad');
            if (this.slowUntil   > frameNow) usedIds.add('slow');
            if (this.bombs.length > 0 || this.bombQueue > 0) usedIds.add('bomb');
            const available = POWERUP_TYPES.filter(t => !usedIds.has(t.id));
            if (available.length > 0) {
                this.active.push(new PowerUp(available[Math.floor(RND() * available.length)]));
                this.nextAt = frameNow + RND(20000, 40000);
            }
        }

        for (let i = this.active.length - 1; i >= 0; i--) {
            const pu = this.active[i];
            pu.update(dt);
            if (ship && Math.hypot(ship.x - pu.x, ship.y - pu.y) < pu.r + 16 * dpr) {
                switch (pu.id) {
                case 'shield': this.shieldUntil = frameNow + 20000; break; // 20 sec
                case 'triple': this.tripleUntil = frameNow + 10000; break; // 10 sec
                case 'quad': this.quadUntil = frameNow + 10000; break; // 10 sec
                case 'slow': this.slowUntil = frameNow + 10000; break; // 10 sec
                case 'bomb': this.bombQueue = MAX_BOMBS; break;
                }
                // remove shield if another power-up is active
                if (pu.id !== 'shield')
                    this.shieldUntil = 0;
                floatScores.push({
                    x: pu.x,
                    y: pu.y,
                    val: pu.id.toUpperCase() + '!',
                    age: 0,
                    color: pu.color
                });
                Sound.powerup();
                this.active.splice(i, 1);
                this.nextAt = frameNow + RND(15000, 25000);
            }
            else {
                pu.dead
                    ? this.active.splice(i, 1)
                    : pu.draw();
            }
        }
    }

    // Updates/draws bombs already in flight, removing any that detonated
    updateBombs(dt) {
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            this.bombs[i].update(dt);
            this.bombs[i].dead
                ? this.bombs.splice(i, 1)
                : this.bombs[i].draw();
        }
    }
}

const powerups = new Powerups();

// -- Death-star superlaser ---------------------------------------------------
// Locks onto the ship, then fires a heavy beam.
// Triggers on a 2-minute cooldown (only while HP > 7) or every 5000 points

class Beam {
    constructor() {
        this.angle = 0; // locked firing angle, set when aiming ends
        this.ox = 0; // fixed origin (logo center), cached when aiming starts
        this.oy = 0;
        this.reset();
    }

    // Resets the triggers/state; nextAt defaults to "due immediately"
    reset(nextAt = 0) {
        this.nextAt        = nextAt; // frameNow of the next cooldown-based trigger
        this.nextScoreAt   = 5000;   // next score milestone that also triggers it
        this.nextAllowedAt = 0;      // hard floor on the next trigger
        this.state         = null;   // null | 'aiming' | 'locked' | 'firing'
        this.stateAt       = 0;      // frameNow the current state began
        this.hit           = false;  // guards against multiple damage ticks per firing
    }

    // Runs the trigger check and the aiming -> locked -> firing state machine
    update() {
        if (!(started && ship && logo))
            return;
        const gapReady      = frameNow >= this.nextAllowedAt;
        const cooldownReady = frameNow >= this.nextAt && shipHp > 7;
        const scoreReady    = score >= this.nextScoreAt;
        if (!this.state && gapReady && (cooldownReady || scoreReady)) {
            this.state   = 'aiming';
            this.stateAt = frameNow;
            const origin = form.getLogoCenter();
            this.ox = origin.x;
            this.oy = origin.y;
            // Reset both triggers so the other one doesn't immediately
            // re-fire the beam right after this one finishes, and enforce
            // at least a 1-minute floor before any beam can fire again
            this.nextAt        = frameNow + 120000;
            this.nextScoreAt   = (Math.floor(score / 5000) + 1) * 5000;
            this.nextAllowedAt = frameNow + 60000;
        }
        if (this.state === 'aiming') {
            const elapsed = frameNow - this.stateAt;
            // Continuously re-aim at the ship's live position; drawing reads
            // this.angle, so keeping it live here is what makes the tracking
            // beam visibly follow the ship each frame
            this.angle = Math.atan2(ship.y - this.oy, ship.x - this.ox);
            this.draw();
            // After 3 seconds of aiming, the beam locks in
            if (elapsed > 3000) {
                this.state   = 'locked';
                this.stateAt = frameNow;
                Sound.count();
                shakeAmt = Math.max(shakeAmt, 6);
            }
        }
        else if (this.state === 'locked') {
            // Direction is committed but not yet damaging
            // a fair warning window to get off the line before the actual blast fires
            const elapsed = frameNow - this.stateAt;
            this.draw();
            // The locked-aiming warning window starts at 0.3s
            // and shortens 50ms per level, down to a 50ms floor
            // before the beam fires
            const lockDelay = Math.max(50, 300 - (levelNumber - 1) * 50);
            if (elapsed > lockDelay) {
                this.state   = 'firing';
                this.stateAt = frameNow;
                Sound.explode();
                shakeAmt = Math.max(shakeAmt, 15);
            }
        }
        else if (this.state === 'firing') {
            // Draw the beam and check for ship hit
            const elapsed = frameNow - this.stateAt;
            // Beam is on for 0.5 seconds, then the beam ends
            if (elapsed < 500) {
                this.draw();
                // this.angle is locked for the whole firing phase, so its
                // sin/cos are computed once here and reused below instead
                // of recalculating the same trig call for the hit test
                const cosA = Math.cos(this.angle);
                const sinA = Math.sin(this.angle);
                // Hit test: perpendicular distance from the ship to the locked beam line
                if (!this.hit) {
                    const dx = ship.x - this.ox;
                    const dy = ship.y - this.oy;
                    const along      = dx * cosA + dy * sinA;
                    const perpSigned = dx * sinA - dy * cosA;
                    const perp       = Math.abs(perpSigned);
                    if (along > 0 && perp < 16 * dpr) {
                        // Ship is hit by the beam: lose 3 HP
                        this.hit = true;
                        const side = perpSigned < 0 ? -1 : 1;
                        Spaceship.loseShip(3, ship.x, ship.y, 24, 20, {
                            ejX: -sinA * side, ejY: cosA * side,
                            offset: 20 * dpr, turns: 5, spinDir: side
                        });
                    }
                }
            }
            else {
                this.state = null;
                this.hit   = false;
                // nextAt/nextScoreAt were already reset when this
                // sequence started, so both triggers are fresh from here
            }
        }
    }

    draw() {
        const len = screenDiag;
        if (this.state === 'aiming') {
            const pulse = triangleWave(frameNow * 0.02);
            ctx.save();
            ctx.lineCap     = 'round';
            ctx.globalAlpha = 0.55 * pulse;
            ctx.strokeStyle = '#66ff66';
            ctx.lineWidth   = 2 * dpr;
            ctx.shadowColor = '#88ff88';
            ctx.shadowBlur  = 10 * dpr;
            ctx.beginPath();
            ctx.moveTo(this.ox, this.oy);
            ctx.lineTo(this.ox + Math.cos(this.angle) * len, this.oy + Math.sin(this.angle) * len);
            ctx.stroke();
            ctx.restore();
        }
        else if (this.state === 'locked') {
            // Direction is committed but not yet damaging
            const period  = TWO_PI / 0.06;
            const flicker = (frameNow % period) < period / 2 ? 1 : 0.4;
            ctx.save();
            ctx.lineCap     = 'round';
            ctx.globalAlpha = 0.9 * flicker;
            ctx.strokeStyle = '#ccffcc';
            ctx.lineWidth   = 3 * dpr;
            ctx.shadowColor = '#66ff66';
            ctx.shadowBlur  = 16 * dpr;
            ctx.beginPath();
            ctx.moveTo(this.ox, this.oy);
            ctx.lineTo(this.ox + Math.cos(this.angle) * len, this.oy + Math.sin(this.angle) * len);
            ctx.stroke();
            ctx.restore();
        }
        else if (this.state === 'firing') {
            const cosA = Math.cos(this.angle);
            const sinA = Math.sin(this.angle);
            const ex = this.ox + cosA * len;
            const ey = this.oy + sinA * len;
            // Death Star superlaser's triple-beam release, merging into one
            const mergeDist = 130 * dpr;
            const mx = this.ox + cosA * mergeDist;
            const my = this.oy + sinA * mergeDist;
            const perpX  = -sinA, perpY = cosA;
            const spread = 24 * dpr;
            ctx.save();
            ctx.lineCap     = 'round';
            ctx.strokeStyle = '#aaffaa';
            ctx.shadowColor = '#33ff33';
            ctx.shadowBlur  = 22 * dpr;
            ctx.lineWidth   = 7 * dpr;
            ctx.globalAlpha = 0.85;
            [-1, 0, 1].forEach(k => {
                ctx.beginPath();
                ctx.moveTo(this.ox + perpX * spread * k, this.oy + perpY * spread * k);
                ctx.lineTo(mx, my);
                ctx.stroke();
            });
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = '#aaffaa';
            ctx.lineWidth   = 12 * dpr;
            ctx.shadowBlur  = 22 * dpr;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = 6 * dpr;
            ctx.shadowBlur  = 0;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.restore();
        }
    }
}

const beam = new Beam();

// -- Explosion ----------------------------------------------------------------
// Burst of colored particles on impact

class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.age = 0;
        this.life = 40;
        this.particles = Array.from({ length: 18 }, () => {
            const a = RND() * TWO_PI;
            return {
                a,
                cosA: Math.cos(a),
                sinA: Math.sin(a),
                spd: RND(1.5, 5) * dpr,
                r: RND(2, 5) * dpr,
                color: COLORS[Math.floor(RND() * COLORS.length)],
                ox: 0,
                oy: 0
            };
        });
    }

    update(dt) {
        this.age += dt;
        this.particles.forEach(p => {
            p.ox += p.cosA * p.spd * dt;
            p.oy += p.sinA * p.spd * dt;
            p.spd *= 0.88 ** dt;
        });
    }

    draw() {
        const t = this.age / this.life;
        ctx.save();
        this.particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, (1 - t / 0.85)) * 0.9;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(this.x + p.ox, this.y + p.oy, p.r * (1 - t * 0.5), 0, TWO_PI);
            ctx.fill();
        });
        ctx.restore();
    }

    get dead() {
        return this.age >= this.life;
    }

    // Updates/draws every active explosion, culling any that finished
    static updateAll(dt) {
        for (let i = explosions.length - 1; i >= 0; i--) {
            explosions[i].update(dt);
            explosions[i].draw();
            if (explosions[i].dead)
                explosions.splice(i, 1);
        }
    }
}

// -- Shockwave ------------------------------------------------------------
// Expanding light ring used for the death-star boom; supports a startup
// delay so a few rings can be layered to grow one after another.

class Shockwave {
    constructor(x, y, delay = 0) {
        this.x    = x;
        this.y    = y;
        this.age  = -delay;
        this.life = 70;
        this.r    = 0;
    }

    update(dt) {
        this.age += dt;
        if (this.age < 0)
            return;
        this.r = (this.age / this.life) * 320 * dpr;
        // The expanding ring wipes out any alien it sweeps over
        for (let i = aliens.length - 1; i >= 0; i--) {
            const al = aliens[i];
            if (!al) continue;
            if (Math.hypot(al.x - this.x, al.y - this.y) < this.r) {
                explosions.push(new Explosion(al.x, al.y));
                const pts = (ALIEN_POINTS[al.style] ?? 5) * combo;
                score += pts;
                combo = Math.min(16, combo + 1);
                comboTimer = 150;
                floatScores.push({
                    x: al.x,
                    y: al.y,
                    val: `+${pts}`,
                    age: 0
                });
                aliens.splice(i, 1);
            }
        }
        for (let i = borderAliens.length - 1; i >= 0; i--) {
            if (Math.hypot(borderAliens[i].x - this.x, borderAliens[i].y - this.y) < this.r) {
                explosions.push(new Explosion(borderAliens[i].x, borderAliens[i].y));
                const pts = (ALIEN_POINTS[borderAliens[i].style] ?? 5) * combo;
                score += pts;
                combo = Math.min(16, combo + 1);
                comboTimer = 150;
                floatScores.push({
                    x: borderAliens[i].x,
                    y: borderAliens[i].y,
                    val: `+${pts}`,
                    age: 0
                });
                borderAliens.splice(i, 1);
            }
        }
    }

    draw() {
        if (this.age < 0)
            return;
        const t = this.age / this.life;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t) * 0.85;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = (16 * (1 - t) + 2) * dpr;
        ctx.shadowColor = '#ffcc66';
        ctx.shadowBlur  = 30 * dpr;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
    }

    get dead() {
        return this.age >= this.life;
    }

    // Updates/draws every active shockwave ring, culling any that finished
    static updateAll(dt) {
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            shockwaves[i].update(dt);
            shockwaves[i].draw();
            if (shockwaves[i].dead)
                shockwaves.splice(i, 1);
        }
    }
}

// -- Supernova bar --------------------------------------------------------
// Final capstone of the death-star boom: after the shockwave rings

class SupernovaBar {
    constructor(x, y, delay = 0) {
        this.x = x;
        this.y = y;
        this.age = -delay;
        this.growLife = 26; // frames to reach full width
        this.holdLife = 14; // frames held at full brightness
        this.fadeLife = 34; // frames to fade out
        this.half     = 0;
    }

    get totalLife() {
        return this.growLife + this.holdLife + this.fadeLife;
    }

    update(dt) {
        this.age += dt;
        if (this.age < 0)
            return;
        const maxHalf = W / 2 + 40 * dpr;
        this.half = Math.min(1, this.age / this.growLife) * maxHalf;
        // The extending bar wipes out anything roughly level with it
        for (let i = aliens.length - 1; i >= 0; i--) {
            const al = aliens[i];
            if (!al) continue;
            if (Math.abs(al.y - this.y) < 20 * dpr && Math.abs(al.x - this.x) < this.half) {
                explosions.push(new Explosion(al.x, al.y));
                const pts = (ALIEN_POINTS[al.style] ?? 5) * combo;
                score += pts;
                combo = Math.min(16, combo + 1);
                comboTimer = 150;
                floatScores.push({
                    x: al.x,
                    y: al.y,
                    val: `+${pts}`,
                    age: 0
                });
                aliens.splice(i, 1);
            }
        }
        for (let i = borderAliens.length - 1; i >= 0; i--) {
            if (Math.abs(borderAliens[i].y - this.y) < 20 * dpr && Math.abs(borderAliens[i].x - this.x) < this.half) {
                explosions.push(new Explosion(borderAliens[i].x, borderAliens[i].y));
                const pts = (ALIEN_POINTS[borderAliens[i].style] ?? 5) * combo;
                score += pts;
                combo = Math.min(16, combo + 1);
                comboTimer = 150;
                floatScores.push({
                    x: borderAliens[i].x,
                    y: borderAliens[i].y,
                    val: `+${pts}`,
                    age: 0
                });
                borderAliens.splice(i, 1);
            }
        }
    }

    draw() {
        if (this.age < 0)
            return;
        let alpha;
        if (this.age < this.growLife) {
            alpha = this.age / this.growLife;
        } else if (this.age < this.growLife + this.holdLife) {
            alpha = 1;
        } else {
            const ft = (this.age - this.growLife - this.holdLife) / this.fadeLife;
            alpha = Math.max(0, 1 - ft);
        }
        if (alpha <= 0)
            return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 16 * dpr;
        ctx.shadowColor = '#ccffcc';
        ctx.shadowBlur  = 60 * dpr;
        ctx.beginPath();
        ctx.moveTo(this.x - this.half, this.y);
        ctx.lineTo(this.x + this.half, this.y);
        ctx.stroke();
        ctx.strokeStyle = '#eaffea';
        ctx.lineWidth   = 4 * dpr;
        ctx.shadowBlur  = 0;
        ctx.beginPath();
        ctx.moveTo(this.x - this.half, this.y);
        ctx.lineTo(this.x + this.half, this.y);
        ctx.stroke();
        ctx.restore();
    }

    get dead() {
        return this.age >= this.totalLife;
    }
}

// -- Shared helpers -----------------------------------------------------------

// Returns true if any border was hit; mutates obj.x/y/vx/vy in place.
function bounceBorders(obj, pad) {
    let hit = false;
    if (obj.x < pad)     { obj.x = pad;     obj.vx =  Math.abs(obj.vx); hit = true; }
    if (obj.x > W - pad) { obj.x = W - pad; obj.vx = -Math.abs(obj.vx); hit = true; }
    if (obj.y < pad)     { obj.y = pad;     obj.vy =  Math.abs(obj.vy); hit = true; }
    if (obj.y > H - pad) { obj.y = H - pad; obj.vy = -Math.abs(obj.vy); hit = true; }
    return hit;
}

// Wraps obj.x/y around the opposite screen edge (Asteroids-style); mutates in place.
function wrapEdges(obj) {
    if (obj.x < 0) obj.x = W;
    if (obj.x > W) obj.x = 0;
    if (obj.y < 0) obj.y = H;
    if (obj.y > H) obj.y = 0;
}

// The logon form reskinned as the death-star sphere during play
class Form {
    constructor() {
        this.el      = null; // the .auth-signin-form DOM element
        this.rect    = null; // cached metrics {x,y,w,h,cx,cy} in canvas space
        this.craters = [];   // scorch decals currently on the sphere
    }

    // Reflects obj's velocity off the form's surface, mutates obj.x/y/vx/vy in place.
    bounce(obj, margin, mutate = true) {
        const r = this.rect;
        if (!r) return false;
        // Default logon = rectangle
        if (!started) {
            const inX = obj.x > r.x - margin && obj.x < r.x + r.w + margin;
            const inY = obj.y > r.y - margin && obj.y < r.y + r.h + margin;
            if (!inX || !inY) // outside rectangle
                return false;
            if (mutate) {
                const overlapL = obj.x - (r.x - margin);
                const overlapR = (r.x + r.w + margin) - obj.x;
                const overlapT = obj.y - (r.y - margin);
                const overlapB = (r.y + r.h + margin) - obj.y;
                const min = Math.min(overlapL, overlapR, overlapT, overlapB);
                if (min === overlapL || min === overlapR) {
                    obj.vx = (min === overlapL ? -Math.abs(obj.vx) : Math.abs(obj.vx));
                    obj.x += obj.vx * 2;
                }
                else {
                    obj.vy = (min === overlapT ? -Math.abs(obj.vy) : Math.abs(obj.vy));
                    obj.y += obj.vy * 2;
                }
            }
        }
        // death star = sphere
        else {
            const rx = r.w/2 + margin;
            const ry = r.h/2 + margin;
            const nx = (obj.x - r.cx) / rx;
            const ny = (obj.y - r.cy) / ry;
            if (nx*nx + ny*ny >= 1) // outside circle
                return false;
            if (mutate) {
                // Surface normal of the ellipse at the nearest point, normalized
                let normX = nx / rx,
                    normY = ny / ry;
                const nlen = Math.hypot(normX, normY) || 1;
                normX /= nlen;
                normY /= nlen;
                const dot = obj.vx*normX + obj.vy*normY;
                obj.vx -= 2 * dot * normX;
                obj.vy -= 2 * dot * normY;
                obj.x += normX * 4 * dpr;
                obj.y += normY * 4 * dpr;
            }
        }
        return true;
    }

    // Point-in-zone test built on bounce(), without mutating anything
    inZone(x, y, margin = 0) {
        return this.bounce({x,y}, margin, false);
    }

    // Updates the cached form metrics (position and size) in canvas space
    updateMetrics() {
        if (!this.el) return;
        const r = this.el.getBoundingClientRect();
        this.rect = {
            x: r.left * dpr,
            y: r.top * dpr,
            w: r.width * dpr,
            h: r.height * dpr,
        };
        this.rect.cx = this.rect.x + this.rect.w/2;
        this.rect.cy = this.rect.y + this.rect.h/2;
    }

    // Center of the logo in canvas space - the superlaser fires from here
    getLogoCenter() {
        if (!logo)
            return null;
        const r = logo.getBoundingClientRect();
        return {
            x: (r.left + r.width  / 2) * dpr,
            y: (r.top  + r.height / 2) * dpr,
        };
    }

    // Bombs the death-star form
    addCrater(x, y) {
        if (!this.el || !this.rect)
            return;
        // Luke's torpedo down the exhaust port
        // if the bomb lands on the form's core, trigger a full-on Death-Star-style boom
        const coreR = this.rect.w * 0.1;
        if (Math.hypot(x - this.rect.cx, y - this.rect.cy) < coreR) {
            this.triggerBoom();
            return;
        }
        // Otherwise, drop a crater decal at the impact point - a miss on the
        // core, so a Ben Kenobi-style nudge (throttled so it doesn't spam)
        if (frameNow - forceMsgAt > 4000) {
            forceMsgAt = frameNow;
            floatScores.push({
                x: x,
                y: y - 16 * dpr,
                val: MSG.USE_THE_FORCE,
                age: 0,
                color: '#aaddff'
            });
        }
        const px = Math.min(100, Math.max(0, ((x - this.rect.x) / this.rect.w) * 100));
        const py = Math.min(100, Math.max(0, ((y - this.rect.y) / this.rect.h) * 100));
        const size = RND(10, 18);
        const crater = document.createElement('div');
        Object.assign(crater.style, {
            position:      'absolute',
            left:          `${px}%`,
            top:           `${py}%`,
            width:         `${size}%`,
            height:        `${size}%`,
            transform:     'translate(-50%, -50%)',
            borderRadius:  '50%',
            background:    'radial-gradient(circle at 40% 35%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0) 80%)',
            boxShadow:     'inset 0 0 6px rgba(0,0,0,0.9)',
            pointerEvents: 'none',
        });
        this.el.appendChild(crater);
        this.craters.push(crater);
        // Limit the number of craters
        if (this.craters.length >= 40)
            this.craters.shift().remove();
    }

    // Removes all crater decals from the form
    clearCraters() {
        this.craters.forEach(c => c.remove());
        this.craters = [];
    }

    // Big Death-Star-style destruction once a bomb lands square on the form's core
    triggerBoom() {
        const fx = this.rect ? this.rect.cx : cx;
        const fy = this.rect ? this.rect.cy : cy;
        const spread = this.rect ? this.rect.w/2 : 60 * dpr;
        for (let i = 0; i < 5; i++) {
            const a = RND(0, TWO_PI);
            const d = RND(0, spread);
            explosions.push(new Explosion(fx + Math.cos(a) * d, fy + Math.sin(a) * d));
        }
        shockwaves.push(new Shockwave(fx, fy, 0));
        shockwaves.push(new Shockwave(fx, fy, 10));
        shockwaves.push(new Shockwave(fx, fy, 22));
        shockwaves.push(new Shockwave(fx, fy, 34));
        shockwaves.push(new Shockwave(fx, fy, 56));
        // Final capstone: a horizontal supernova bar once the rings have played out
        const supernovaDelay = 85; // frames, must match the SupernovaBar delay below
        shockwaves.push(new SupernovaBar(fx, fy, supernovaDelay));
        // The real login form fades out through the blast, is fully invisible by
        // the time the supernova bar hits, and fades back in once it's over
        if (this.el) {
            const frameMs         = 1000 / 60;
            const supernovaStart  = supernovaDelay * frameMs;
            const supernovaLife   = 74; // grow + hold + fade, from SupernovaBar
            const supernovaEnd    = (supernovaDelay + supernovaLife) * frameMs;
            this.el.style.setProperty('transition', `opacity ${supernovaStart}ms ease-in`);
            this.el.style.setProperty('opacity', '0');
            setTimeout(() => {
                if (!started)
                    return; // game already ended - setForm(1, 1) owns opacity now
                this.el.style.setProperty('transition', 'opacity 600ms ease-out');
                this.el.style.setProperty('opacity', '0.4'); // back to the normal in-game dim
                setTimeout(() => this.el.style.removeProperty('transition'), 600);
            }, supernovaEnd);
        }
        screenFlash = 40;
        shakeAmt = Math.max(shakeAmt, 45);
        score += BOOM_BONUS_POINTS;
        floatScores.push({ x: fx, y: fy, val: `+${BOOM_BONUS_POINTS}`, age: 0 });
        levelAnnouncement = { text: MSG.DEATH_STAR_DESTROYED, age: 0 };
        Sound.boom();
        this.clearCraters();
        // Nothing left to bomb
        powerups.bombs.forEach(b => b.dead = true);
        powerups.bombQueue = 0;
        // no superlaser for at least 1 minute after a boom
        beam.nextAllowedAt = Math.max(beam.nextAllowedAt, frameNow + 60000);
    }

    // Injects the .logon-death-star look once; toggled onto the logon form while
    // the game is running so it reads as a Death-Star-style sphere obstacle
    injectStyle() {
        if (document.getElementById('logon-death-star-style'))
            return;
        const style = document.createElement('style');
        style.id = 'logon-death-star-style';
        style.textContent = `
.logon-death-star {
    border-radius: 50% !important;
    overflow: hidden;
    position: relative;
    background:
        radial-gradient(circle at 32% 26%, rgba(255,255,255,0.35), rgba(255,255,255,0) 22%),
        radial-gradient(circle at 38% 32%, #cfd4d9 0%, #9aa1a8 30%, #6b7178 55%, #3c4046 78%, #202226 100%) !important;
    box-shadow: 0 0 40px rgba(0,0,0,0.6), inset -22px -22px 60px rgba(0,0,0,0.55);
}
.logon-death-star::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 49%;
    height: 3%;
    background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.35));
    box-shadow: 0 0 4px rgba(0,0,0,0.6);
    pointer-events: none;
}`;
        document.head.appendChild(style);
    }
}

const form = new Form();

// -- Spaceship ----------------------------------------------------------------
// Player-controlled ship with pixel-art sprite
// - rotates and accelerates with arrow keys
// - wraps around the screen edges (Asteroids-style)
// - collides with the logon form (Death Star) and bounces off
// - spacebar fires a laser shot, limited to 1 shot per 8 frames

class Spaceship {
    static sprite      = null;
    static spriteGrey  = null; // pre-filtered greyscale copy, used for spent HP icons

    // A random screen corner, facing the center
    static randomCornerSpawn() {
        const margin = 90 * dpr;
        const spread = 60 * dpr;
        const corners = [
            { sx:  1, sy:  1 }, // top-left
            { sx: -1, sy:  1 }, // top-right
            { sx:  1, sy: -1 }, // bottom-left
            { sx: -1, sy: -1 }, // bottom-right
        ];
        const c = corners[Math.floor(RND() * corners.length)];
        const dx = RND(margin, margin + spread);
        const dy = RND(margin, margin + spread);
        const x = c.sx > 0 ? dx : W - dx;
        const y = c.sy > 0 ? dy : H - dy;
        const angle = Math.atan2(cy - y, cx - x);
        return { x, y, angle };
    }

    // Builds pixel-art sprites
    static buildSprite() {
        if (Spaceship.sprite) return;
        const pw = Math.ceil(3 * dpr);
        const ROWS = [
            '......R......',
            '.....GWG.....',
            '.....GWG.....',
            '.....GWG.....',
            '.....GWG.....',
            '....GWWWG....',
            '...RGWWWGR...',
            '...WGWWWGW...',
            '..GWGWWWGWG..',
            '.GWWGBBBGWWG.',
            'RWWWGBBBGWWWR',
            'GGGG.BBB.GGGG',
        ];
        const SC   = { W: '#ffffff', R: '#dd2222', B: '#3399cc', G: '#aaaaaa' };
        const cols = ROWS[0].length;
        const rows = ROWS.length;
        const oc   = document.createElement('canvas');
        oc.width   = cols * pw;
        oc.height  = rows * pw;
        const c    = oc.getContext('2d');
        ROWS.forEach((row, ri) => {
            [...row].forEach((ch, ci) => {
                const col = SC[ch];
                if (!col) return;
                c.fillStyle = col;
                c.fillRect(ci * pw, ri * pw, pw, pw);
            });
        });
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(cols * pw / 2, rows * pw / 2, pw * 2.3, 0, TWO_PI);
        c.fill();
        c.fillStyle    = '#333333';
        c.font         = `bold ${Math.round(pw * 4)}px sans-serif`;
        c.textAlign    = 'center';
        c.textBaseline = 'middle';
        c.fillText('S', cols * pw / 2, rows * pw / 2);
        Spaceship.sprite = { img: oc, ox: cols * pw / 2, oy: rows * pw / 2 };

        // Pre-render a greyscale copy too, for spent-HP HUD icons
        const goc = document.createElement('canvas');
        goc.width  = oc.width;
        goc.height = oc.height;
        const gc = goc.getContext('2d');
        gc.filter = 'grayscale(1)';
        gc.drawImage(oc, 0, 0);
        Spaceship.spriteGrey = { img: goc, ox: Spaceship.sprite.ox, oy: Spaceship.sprite.oy };
    }

    constructor(x, y, angle) {
        const spd = 2 * dpr;
        const a = angle ?? Math.PI / 4;
        this.x = x ?? 48 * dpr;
        this.y = y ?? 48 * dpr;
        this.vx = Math.cos(a) * spd;
        this.vy = Math.sin(a) * spd;

        this.angle = a;
        this.turnRate = 0; // current angular velocity (rad/frame), ramps up/down for precise steering
        this.flamePhase = 0;
        this.scale = 1;

        this.wasOnStreak = false;
        this.tractorRemaining = 0; // frames left locked in the streak's tractor beam
        this.preTractorSpeed = 0; // speed to restore once the tractor beam releases the ship

        this.spinRemaining = 0; // radians left in a knockback spin, e.g. from the superlaser
        this.spinDir       = 1; // +1 or -1, rotation direction of the current spin
        this.knockVx       = 0; // fixed travel velocity while spinning, ignores steering
        this.knockVy       = 0;

        this.autopilotTimer = 0; // frames left until the post-game autopilot picks a new heading nudge
    }

    update(dt) {
        this.flamePhase += 0.12 * dt;

        // Knockback spin in progress: tumble the visual angle independent of
        // steering while drifting along the fixed ejection velocity, then
        // hand control back once the spin runs out
        if (this.spinRemaining > 0) {
            const spinRate = (TWO_PI * 5) / 90; // 5 full turns over ~90 frames
            const step = Math.min(this.spinRemaining, spinRate * dt);
            this.angle += step * this.spinDir;
            this.spinRemaining -= step;
            this.vx = this.knockVx;
            this.vy = this.knockVy;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            wrapEdges(this);
            return;
        }

        if (this.tractorRemaining > 0) {
            // Tractor beam: controls locked
            this.tractorRemaining -= dt;
            this.turnRate = 0;
            if (this.tractorRemaining > 0) {
                const pullSpeed = 1.2 * dpr;
                const dx = cx - this.x, dy = cy - this.y;
                const d  = Math.hypot(dx, dy) || 1;
                this.vx = (dx / d) * pullSpeed;
                this.vy = (dy / d) * pullSpeed;
            }
            else {
                // Beam released: restore the velocity the ship had before capture
                this.vx = Math.cos(this.angle) * this.preTractorSpeed;
                this.vy = Math.sin(this.angle) * this.preTractorSpeed;
            }
        }
        else if (!started && countdown < 0) {
            // Game over autopilot
            this.autopilot(dt);
        }
        else {
            // Turn rate ramps up/down rather than snapping to a fixed speed
            const maxTurnRate = 0.06;
            const turnAccel   = 0.006;
            if (started && keys.ArrowLeft)
                this.turnRate = Math.max(-maxTurnRate, this.turnRate - turnAccel * dt);
            else if (started && keys.ArrowRight)
                this.turnRate = Math.min(maxTurnRate, this.turnRate + turnAccel * dt);
            else
                this.turnRate *= 0.8 ** dt;
            this.angle += this.turnRate * dt;

            const spd = Math.hypot(this.vx, this.vy);
            let newSpd = spd;
            if (started && keys.ArrowUp)
                newSpd = Math.min(MAX_SPEED * dpr, spd + 0.05 * dpr * dt);
            if (started && keys.ArrowDown)
                newSpd = Math.max(MIN_SPEED * dpr, spd - 0.04 * dpr * dt);
            this.vx = Math.cos(this.angle) * newSpd;
            this.vy = Math.sin(this.angle) * newSpd;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // wrap around screen edges (Asteroids-style)
        wrapEdges(this);

        // Streak overlap: grow & score
        const dxc = this.x - cx, dyc = this.y - cy;
        const hitStreak = streaks.list.find(sk => {
            if (sk.countdown > 0)
                return false;
            const along = dxc * sk.cosA + dyc * sk.sinA;
            const tail  = Math.max(0, sk.dist - sk.len);
            if (along < tail || along > sk.dist)
                return false;
            const perp = Math.abs(dxc * sk.sinA - dyc * sk.cosA);
            return perp < sk.width / 2 + 5 * dpr;
        });
        const onStreak = !!hitStreak;

        this.scale += ((onStreak ? 0.5 : 1) - this.scale) * 0.1 * dt;

        // Tractor beam
        if (onStreak && !this.wasOnStreak && started) {
            // shield active ?
            if (powerups.shieldUntil > frameNow) {
                explosions.push(new Explosion(this.x, this.y));
                hitStreak.spawn(false);
            }
            else { // freeze ship
                score = Math.max(0, score - STREAK_TRACTOR_PENALTY);
                this.tractorRemaining += hitStreak.len / hitStreak.speed;
                this.preTractorSpeed = Math.hypot(this.vx, this.vy); // restored on release
                Sound.attract();
            }
        }

        this.wasOnStreak = onStreak;

        // Login form bounce - the form renders as a sphere, so treat it as one
        if (form.bounce(this, 20 * dpr)) {
            this.angle = Math.atan2(this.vy, this.vx);
            explosions.push(new Explosion(this.x, this.y));
            Sound.bump();
        }
    }

    // shipHp management: lose a ship, trigger respawn or knockback spin
    // real lives = shipHp reserve + 1 current ship
    static loseShip(amount, x, y, flash, shake, knockback) {
        shipHp -= amount;
        combo = 1;
        comboTimer = 0;
        shipHitFlash = flash;
        shakeAmt = Math.max(shakeAmt, shake);
        Sound.damage();
        explosions.push(new Explosion(x, y));
        // Respawn
        if (!knockback && shipHp >= 0) {
            Game.startShipRespawn();
            ship = null;
            // Clear immediate threats for the incoming replacement
            lasers = [];
            alienLasers = [];
            aliens = [];
            streaks.list = [];
            // Bombs (in flight and queued) don't carry over to the new ship
            powerups.bombs = [];
            powerups.bombQueue = 0;
        }
        // Spin effect
        else if (knockback) {
            const { ejX, ejY, offset, turns, spinDir } = knockback;
            ship.x += ejX * offset;
            ship.y += ejY * offset;
            ship.knockVx = ejX * MAX_SPEED * dpr;
            ship.knockVy = ejY * MAX_SPEED * dpr;
            ship.spinDir = spinDir;
            ship.spinRemaining = TWO_PI * turns;
        }
    }

    // Autopilot behavior after the game ends
    autopilot(dt) {
        this.autopilotTimer -= dt;
        if (this.autopilotTimer <= 0) {
            this.autopilotTimer = 300;
            this.angle += RND(-0.8, 0.8);
            this.vx = Math.cos(this.angle) * 2 * dpr;
            this.vy = Math.sin(this.angle) * 2 * dpr;
        }
    }

    draw() {
        const pw = 3 * dpr;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2);
        ctx.scale(this.scale, this.scale);

        // 4 nozzle exhausts - suppress left (<0) or right (>0) side when steering
        const flicker  = 0.4 + 0.6 * triangleWave(this.flamePhase);
        const spdRatio = Math.min(1, Math.hypot(this.vx, this.vy) / (MAX_SPEED * dpr));
        const flameLen = pw * 6 * flicker * (0.25 + 0.75 * spdRatio);
        const nozzleY  = Spaceship.sprite.oy;
        const turnL = keys.ArrowLeft;
        const turnR = keys.ArrowRight;
        for (const ex of [-4 * pw, -pw, pw, 4 * pw]) {
            if ((turnL && ex<0) || (turnR && ex>0))
                continue;
            const grad = ctx.createLinearGradient(ex, nozzleY, ex, nozzleY + flameLen);
            grad.addColorStop(0,   '#ffee00');
            grad.addColorStop(0.4, '#ff8800');
            grad.addColorStop(1,   'rgba(255,100,0,0)');
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.moveTo(ex - pw * 0.6, nozzleY);
            ctx.lineTo(ex,            nozzleY + flameLen);
            ctx.lineTo(ex + pw * 0.6, nozzleY);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.drawImage(Spaceship.sprite.img, -Spaceship.sprite.ox, -Spaceship.sprite.oy);
        if (shipHitFlash > 0) {
            ctx.globalAlpha = Math.min(1, shipHitFlash / 8) * 0.75;
            ctx.fillStyle   = '#ffffff';
            ctx.fillRect(-Spaceship.sprite.ox, -Spaceship.sprite.oy, Spaceship.sprite.img.width, Spaceship.sprite.img.height);
        }

        // Shield halo: pulsating bubble, flashes orange when < 5 s remain
        if (powerups.shieldUntil > frameNow) {
            const remaining = (powerups.shieldUntil - frameNow) / 30000;
            const pulse     = 0.25 + 0.60 * triangleWave(this.flamePhase * 2.8);
            const r         = 34 * dpr;
            const warning   = remaining < 5 / 30;
            const hueStr    = warning ? '255,160,60' : '68,170,255';
            const rimStr    = warning ? '255,200,100' : '130,210,255';
            // Filled translucent dome
            const grad = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
            grad.addColorStop(0,   `rgba(${hueStr},0)`);
            grad.addColorStop(0.7, `rgba(${hueStr},${(pulse * 0.07).toFixed(2)})`);
            grad.addColorStop(1,   `rgba(${hueStr},${(pulse * 0.30).toFixed(2)})`);
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.fill();
            // Glowing rim
            ctx.shadowColor = `rgba(${hueStr},1)`;
            ctx.shadowBlur  = Math.round(16 * dpr * pulse);
            ctx.strokeStyle = `rgba(${rimStr},${(0.5 + 0.5 * pulse).toFixed(2)})`;
            ctx.lineWidth   = 2 * dpr;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, TWO_PI);
            ctx.stroke();
            ctx.shadowBlur  = 0;
        }

        // Queued bombs trailing behind the nozzle in ship-local space
        if (powerups.bombQueue > 0) {
            const baseY = Spaceship.sprite.oy + 10 * dpr;
            ctx.shadowColor = '#ff8800';
            for (let i = 0; i < powerups.bombQueue; i++) {
                // Triangle wave instead of a sine - up to 10 of these per
                // frame while bombs are queued
                const bp = 0.2 + 0.8 * triangleWave(this.flamePhase * 1.5 + i * 0.9);
                ctx.globalAlpha = bp;
                ctx.shadowBlur  = Math.round(8 * dpr * bp);
                ctx.fillStyle   = i % 2 === 0 ? '#ff8800' : '#ffcc00';
                ctx.beginPath();
                ctx.arc(0, baseY + i * 11 * dpr, 4 * dpr, 0, TWO_PI);
                ctx.fill();
            }
            ctx.shadowBlur  = 0;
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    // Updates/draws the ship's laser shots, resolving collisions against the
    // boss, regular aliens, border aliens, and enemy bullets (interception)
    updateLasers(dt) {
        for (let i = lasers.length - 1; i >= 0; i--) {
            const laser = lasers[i];
            laser.update(dt);
            let laserHit = false;
            // Boss hit
            if (!laserHit && boss && Math.hypot(boss.x - laser.x, boss.y - laser.y) < 35 * dpr) {
                boss.hp--;
                boss.hitFlash = 10;
                shakeAmt = Math.max(shakeAmt, 3);
                Sound.hit();
                laserHit = true;
            }
            // Regular alien hit
            if (!laserHit) {
                for (let j = aliens.length - 1; j >= 0; j--) {
                    if (Math.hypot(aliens[j].x - laser.x, aliens[j].y - laser.y) < 22 * dpr) {
                        explosions.push(new Explosion(aliens[j].x, aliens[j].y));
                        const pts = (ALIEN_POINTS[aliens[j].style] ?? 5) * combo;
                        score += pts;
                        combo = Math.min(16, combo + 1);
                        comboTimer = 150;
                        const comboTag = combo > 2 ? ' \xd7' + (combo - 1) : '';
                        floatScores.push({
                            x: aliens[j].x,
                            y: aliens[j].y,
                            val: `+${pts}${comboTag}`,
                            age: 0
                        });
                        Sound.hit();
                        aliens.splice(j, 1);
                        laserHit = true;
                        break;
                    }
                }
            }
            // Border alien hit
            if (!laserHit) {
                for (let j = 0; j < borderAliens.length; j++) {
                    if (Math.hypot(borderAliens[j].x - laser.x, borderAliens[j].y - laser.y) < 22 * dpr) {
                        explosions.push(new Explosion(borderAliens[j].x, borderAliens[j].y));
                        const pts = (ALIEN_POINTS[borderAliens[j].style] ?? 5) * combo;
                        score += pts;
                        combo = Math.min(16, combo + 1); comboTimer = 150;
                        const bx = borderAliens[j].x, by = borderAliens[j].y, ep = 20 * dpr;
                        const dists = [by - ep, H - ep - by, bx - ep, W - ep - bx]; // top bottom left right
                        const mi = dists.indexOf(Math.min(...dists));
                        const [fdx, fdy] = [[0,1],[0,-1],[1,0],[-1,0]][mi];
                        const cTag = combo > 2 ? ' \xd7' + (combo - 1) : '';
                        floatScores.push({
                            x: bx,
                            y: by,
                            val: `+${pts}${cTag}`,
                            age: 0,
                            dx: fdx,
                            dy: fdy
                        });
                        Sound.hit();
                        borderAliens.splice(j, 1);
                        laserHit = true;
                        break;
                    }
                }
            }
            // Intercept alien bullets
            if (!laserHit) {
                for (let k = alienLasers.length - 1; k >= 0; k--) {
                    if (Math.hypot(alienLasers[k].x - laser.x, alienLasers[k].y - laser.y) < 14 * dpr) {
                        explosions.push(new Explosion(alienLasers[k].x, alienLasers[k].y));
                        alienLasers.splice(k, 1);
                        Sound.hit();
                        laserHit = true;
                        break;
                    }
                }
            }
            laserHit || laser.dead
                ? lasers.splice(i, 1)
                : laser.draw();
        }
    }
}

// -- Alien pixel art data -----------------------------------------------------
// Each style has two animation frames (legs/arms alternating)

const ALIEN_EYE_COLORS = ['#ff5555', '#55ffff', '#ffff55', '#ff55ff'];

const ALIEN_STYLES = [
    [ // 0: Crab (5 pts)
        ['..XX....XX.',
         '...X...X...',
         '..XXXXXXX..',
         '.XXO.XO.XX.',
         'XXXXXXXXXXX',
         'X.XXXXXXX.X',
         'X..X...X..X',
         '..XX...XX..'],
        ['.XX....XX..',
         '...X...X...',
         '..XXXXXXX..',
         '.XX.OX.OXX.',
         'XXXXXXXXXXX',
         'X.XXXXXXX.X',
         'X.X.....X.X',
         '..XX...XX..']
    ],
    [ // 1: Squid (10 pts)
        ['....XXX....',
         '.XXXXXXXXX.',
         'XX..OX..OXX',
         'XXXXXXXXXXX',
         '.X.X.X.X.X.',
         '..XX...XX..',
         '.X.......X.',
         'X.........X'],
        ['....XXX....',
         '.XXXXXXXXX.',
         'XXO..XO..XX',
         'XXXXXXXXXXX',
         '.X.X.X.X.X.',
         '.XX.....XX.',
         'X.........X',
         '.X.......X.']
    ],
    [ // 2: Spider (20 pts)
        ['.X........X',
         '.X.XXXXX.X.',
         '..XXXXXXX..',
         '.XX.OX.OXX.',
         'XXXXXXXXXXX',
         '.XX.....XX.',
         '..X.....X..',
         'XXX.....XXX'],
        ['X........X.',
         '.X.XXXXX.X.',
         '..XXXXXXX..',
         '.XXO.XO.XX.',
         'XXXXXXXXXXX',
         '.XX.....XX.',
         '.X.......X.',
         '..XX...XX..']
    ],
    [ // 3: Bug (50 pts)
        ['...XXXXX...',
         '..XXXXXXX..',
         '.XX.OX.OXX.',
         'XXXXXXXXXXX',
         'X.XXXXXXX.X',
         '.X.X...X.X.',
         'X...X.X...X',
         'X.........X'],
        ['...XXXXX...',
         '..XXXXXXX..',
         '.XXO.XO.XX.',
         'XXXXXXXXXXX',
         'X.XXXXXXX.X',
         '.X.X...X.X.',
         '.X.X...X.X.',
         'X.........X']
    ],
];

// -- Alien --------------------------------------------------------------------
// Roaming enemy that drifts toward the ship and fires red lasers
// - randomly changes direction and speed every 1-2 seconds
// - bounces off the window edges
// - collides with the ship, causing damage and destroying itself
// - fires a red laser at the ship if in range, with a cooldown

class Alien {
    constructor(x, y) {
        this.x = x ?? (cx + RND(-100, 100));
        this.y = y ?? (cy + RND(-100, 100));
        this.vx = RND(-1.5, 1.5) * dpr;
        this.vy = RND(-1.5, 1.5) * dpr;
        if (Math.abs(this.vx) < 0.4 * dpr)
            this.vx = 0.7 * dpr * (RND() < 0.5 ? 1 : -1);
        if (Math.abs(this.vy) < 0.4 * dpr)
            this.vy = 0.7 * dpr * (RND() < 0.5 ? 1 : -1);
        this.nextTurn  = Math.floor(RND(60, 140));
        this.animFrame = 0;
        this.style     = Math.floor(RND() * ALIEN_STYLES.length);
        this.color     = COLORS[Math.floor(RND() * COLORS.length)];
        this.eyeColor     = ALIEN_EYE_COLORS[this.style];
        this.shotCooldown = Math.floor(RND(120, 240));
    }

    static frameSprites = {};

    // Builds (and caches) the pre-rendered canvas for one style/color/frame
    // combo, so it's drawn once per unique combo instead of re-rasterized
    // every time an instance needs it
    static buildFrame(style, color, eyeColor, f) {
        const key = `${style}-${color}-${f}`;
        let a = Alien.frameSprites[key];
        if (a) return a;
        const art  = ALIEN_STYLES[style][f];
        const pw   = Math.ceil(3.5 * dpr);
        const cols = art[0].length;
        const rows = art.length;
        const oc   = document.createElement('canvas');
        oc.width  = cols * pw;
        oc.height = rows * pw;
        const c = oc.getContext('2d');
        const colorMap = { X: color, O: eyeColor };
        art.forEach((row, ri) => {
            for (let ci = 0; ci < row.length; ci++) {
                const col = colorMap[row[ci]];
                if (col) {
                    c.fillStyle = col;
                    c.fillRect(ci * pw, ri * pw, pw, pw);
                }
            }
        });
        a = Alien.frameSprites[key] = {
            img: oc,
            w: cols * pw,
            h: rows * pw,
            ox: cols * pw / 2, // half-width/height, precomputed so draw() doesn't recompute per frame
            oy: rows * pw / 2
        };
        return a;
    }

    update(dt) {
        this.animFrame += dt;
        // Randomly change direction and speed, with a slight attraction to the ship
        if ((this.nextTurn -= dt) <= 0) {
            this.vx += RND(-0.8, 0.8) * dpr;
            this.vy += RND(-0.8, 0.8) * dpr;
            if (ship) {
                const dx = ship.x - this.x;
                const dy = ship.y - this.y;
                const d  = Math.hypot(dx, dy);
                if (d > 0) {
                    this.vx += (dx / d) * 0.4 * dpr;
                    this.vy += (dy / d) * 0.4 * dpr;
                }
            }
            const spd = Math.hypot(this.vx, this.vy);
            const tgt = RND(0.8, 2) * dpr;
            this.vx = (this.vx / spd) * tgt;
            this.vy = (this.vy / spd) * tgt;
            this.nextTurn = Math.floor(RND(60, 150));
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // When no boss is active, reaching the border joins the alien train
        // limiting the number of border aliens to avoid overcrowding
        const { pad, total } = BorderAlien.perimeter();
        if (!boss && borderAliens.length < borderTrainCount*5 &&
            (this.x <= pad || this.x >= W - pad || this.y <= pad || this.y >= H - pad)) {
            this.x = Math.min(Math.max(this.x, pad), W - pad);
            this.y = Math.min(Math.max(this.y, pad), H - pad);
            const touchT = BorderAlien.perimeterParam(this.x, this.y);
            const offset = ((touchT - borderTrainT) % total + total) % total;
            borderAliens.push(new BorderAlien(offset, this));
            const ox = form.rect ? form.rect.cx : cx;
            const oy = form.rect ? form.rect.cy : cy;
            aliens.push(new Alien(ox, oy));
            this.dead = true;
            return;
        }
        // Boss fight in progress: bounce normally
        bounceBorders(this, pad);
        // Shoot at ship if in range
        if (ship && started && alienLasers.length < maxAlienLasers && (this.shotCooldown -= dt) <= 0) {
            this.shotCooldown = Math.floor(RND(150, 300));
            const a = Math.atan2(ship.y - this.y, ship.x - this.x);
            alienLasers.push(new AlienLaser(this.x, this.y, a));
        }
        // Collision with ship: lose HP, destroy alien or bounce off shield
        if (ship && Math.hypot(ship.x - this.x, ship.y - this.y) < 28 * dpr) {
            if (powerups.shieldUntil > frameNow) {
                const dx = this.x - ship.x, dy = this.y - ship.y;
                const d  = Math.hypot(dx, dy) || 1;
                this.vx  = (dx / d) * 4 * dpr;
                this.vy  = (dy / d) * 4 * dpr;
                explosions.push(new Explosion(this.x, this.y));
            }
            else {
                Spaceship.loseShip(1, this.x, this.y, 16, 6);
                this.dead = true;
            }
        }
    }

    draw() {
        const f = Math.floor(this.animFrame / 25) % 2;
        const { img, ox, oy } = Alien.buildFrame(this.style, this.color, this.eyeColor, f);
        const pulse = 0.6 + 0.4 * triangleWave(this.animFrame * 0.12);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.drawImage(img, this.x - ox, this.y - oy);
        ctx.restore();
    }
}

// -- Border alien -------------------------------------------------------------
// Aliens that travel in a train along the full window perimeter
// - do not fire at the ship, but ram damage is applied on contact
// - the train is a shared "cursor" along the perimeter, each alien has an offset

class BorderAlien extends Alien {
    constructor(offset, source) {
        super();
        // copy styles from source
        if (source) {
            this.style     = source.style;
            this.color     = source.color;
            this.eyeColor  = source.eyeColor;
            this.animFrame = source.animFrame;
        }
        this.offset = offset; // px ahead of the train head
        this.shotCooldown = Math.floor(RND(200, 400));
        this.canShoot = false; // only designated shooters fire, set by BorderAlien.spawn()
    }

    static speed; // cached levelRamp() result, refreshed via BorderAlien.refreshSpeed() whenever levelNumber changes
    static refreshSpeed() {
        BorderAlien.speed = levelRamp(1, 2, levelNumber) * dpr; // eases toward 3 * dpr
    }

    // Shared perimeter geometry (inset by `pad` from the screen edges) used
    // by every border-alien position/spawn/join calculation
    static perimeter() {
        const pad   = 20 * dpr;
        const topW  = W - 2 * pad;
        const sideH = H - 2 * pad;
        return { pad, topW, sideH, total: 2 * (topW + sideH) };
    }

    update(dt) {
        this.animFrame += dt;
        // Position along the perimeter from the shared train cursor
        const { pad, topW, sideH, total } = BorderAlien.perimeter();
        const prevX = this.x, prevY = this.y;
        let t = ((borderTrainT + this.offset) % total + total) % total;
        if (t < topW) {
            this.x = pad + t;
            this.y = pad;
        }
        else if ((t -= topW) < sideH) {
            this.x = W - pad;
            this.y = pad + t;
        }
        else if ((t -= sideH) < topW) {
            this.x = W - pad - t;
            this.y = H - pad;
        }
        else {
            this.x = pad;
            this.y = H - pad - (t - topW);
        }
        // Derive real velocity from the perimeter motion
        if (dt > 0) {
            this.vx = (this.x - prevX) / dt;
            this.vy = (this.y - prevY) / dt;
        }
        // Only designated shooters fire, same cooldown/aim logic as a regular alien
        if (this.canShoot && ship && started && alienLasers.length < maxAlienLasers && (this.shotCooldown -= dt) <= 0) {
            this.shotCooldown = Math.floor(RND(150, 300));
            const a = Math.atan2(ship.y - this.y, ship.x - this.x);
            alienLasers.push(new AlienLaser(this.x, this.y, a));
        }
        // Ram damage on contact with ship
        if (ship && started && Math.hypot(ship.x - this.x, ship.y - this.y) < 28 * dpr) {
            // shield absorbs the hit
            if (powerups.shieldUntil > frameNow)
                explosions.push(new Explosion(this.x, this.y));
            else // HP-1
                Spaceship.loseShip(1, this.x, this.y, 16, 6);
            // Remove the alien from the train
            const idx = borderAliens.indexOf(this);
            borderAliens.splice(idx, 1);
        }
    }

    // Builds a fresh border-alien train around the screen perimeter and
    // randomly designates a handful of them as shooters
    static spawn(count) {
        const { total: perim } = BorderAlien.perimeter();
        const train = Array.from({ length: count }, (_, i) => new BorderAlien(i * (perim / count)));
        const shooterCount = Math.min(levelNumber, train.length);
        const shooters = new Set();
        while (shooters.size < shooterCount)
            shooters.add(Math.floor(RND() * train.length));
        train.forEach((a, i) => { a.canShoot = shooters.has(i); });
        return train;
    }

    // Inverse of BorderAlien's own t -> (x, y) perimeter mapping: projects a
    // point onto whichever edge it's nearest and returns its perimeter
    // parameter, so a newly-joined alien can be spliced into the train
    // without a visible jump.
    static perimeterParam(x, y) {
        const { pad, topW, sideH } = BorderAlien.perimeter();
        const dTop    = Math.abs(y - pad);
        const dRight  = Math.abs(x - (W - pad));
        const dBottom = Math.abs(y - (H - pad));
        const dLeft   = Math.abs(x - pad);
        const min = Math.min(dTop, dRight, dBottom, dLeft);
        if (min === dTop)
            return Math.min(topW, Math.max(0, x - pad));
        if (min === dRight)
            return topW + Math.min(sideH, Math.max(0, y - pad));
        if (min === dBottom)
            return topW + sideH + Math.min(topW, Math.max(0, (W - pad) - x));
        return topW + sideH + topW + Math.min(sideH, Math.max(0, (H - pad) - y));
    }
}

// -- Laser --------------------------------------------------------------------
// Player projectile (cyan, fast)

class Laser {
    constructor(x, y, angle) {
        this.x     = x;
        this.y     = y;
        this.angle = angle;
        this.cosA  = Math.cos(angle);
        this.sinA  = Math.sin(angle);
        this.spd   = 14 * dpr;
        this.len   = 32 * dpr;
    }

    update(dt) {
        this.x += this.cosA * this.spd * dt;
        this.y += this.sinA * this.spd * dt;
    }

    draw() {
        const tx = this.x - this.cosA * this.len;
        const ty = this.y - this.sinA * this.len;
        ctx.save();
        ctx.lineCap     = 'round';
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#88ffff';
        ctx.lineWidth   = 7 * dpr;
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ccffff';
        ctx.lineWidth   = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.restore();
    }
}

// -- Alien laser --------------------------------------------------------------
// Enemy projectile (red, slower)
// - while the ship's shield is up, it steers toward the ship instead of flying straight,
//   so the reflect mechanic lands more.

class AlienLaser {
    constructor(x, y, angle) {
        this.x     = x;
        this.y     = y;
        this.angle = angle;
        this.cosA  = Math.cos(angle);
        this.sinA  = Math.sin(angle);
        this.spd   = 5 * dpr;
        this.len   = 36 * dpr;
    }

    update(dt) {
        // change direction toward ship while shield is up
        if (ship && powerups.shieldUntil > frameNow) {
            const desired  = Math.atan2(ship.y - this.y, ship.x - this.x);
            const diff     = Math.atan2(Math.sin(desired - this.angle), Math.cos(desired - this.angle));
            const turnRate = 0.05;
            this.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
            this.cosA = Math.cos(this.angle); // recache
            this.sinA = Math.sin(this.angle);
        }
        this.x += this.cosA * this.spd * dt;
        this.y += this.sinA * this.spd * dt;
    }

    draw() {
        const tx = this.x - this.cosA * this.len;
        const ty = this.y - this.sinA * this.len;
        ctx.save();
        ctx.lineCap     = 'round';
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#ff2222';
        ctx.lineWidth   = 9 * dpr;
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffaaaa';
        ctx.lineWidth   = 3 * dpr;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.restore();
    }

    get dead() {
        // Check if the laser is outside the viewport
        return this.x < -this.len || this.x > W + this.len ||
               this.y < -this.len || this.y > H + this.len;
    }

    // Updates/draws every enemy laser in flight, resolving hits on the ship:
    // reflected off an active shield, otherwise a direct hit that costs HP
    static updateAll(alienDt) {
        for (let i = alienLasers.length - 1; i >= 0; i--) {
            const al = alienLasers[i];
            if (!al) continue;
            al.update(alienDt);
            const shieldR = 34 * dpr;
            const hitR = (powerups.shieldUntil > frameNow) ? shieldR : 18 * dpr;
            if (ship && Math.hypot(ship.x - al.x, ship.y - al.y) < hitR) {
                if (powerups.shieldUntil > frameNow) {
                    // Reflect off shield circle surface
                    const nx = al.x - ship.x, ny = al.y - ship.y;
                    const nd = Math.hypot(nx, ny) || 1;
                    const inDx = al.cosA, inDy = al.sinA;
                    const dot = inDx * (nx / nd) + inDy * (ny / nd);
                    const rx = ship.x + (nx / nd) * shieldR;
                    const ry = ship.y + (ny / nd) * shieldR;
                    lasers.push(new Laser(rx, ry, Math.atan2(inDy - 2 * dot * (ny / nd), inDx - 2 * dot * (nx / nd))));
                    explosions.push(new Explosion(rx, ry));
                    Sound.reflect();
                }
                else {
                    score = Math.max(0, score - ALIEN_LASER_HIT_PENALTY);
                    Spaceship.loseShip(1, ship.x, ship.y, 16, 6);
                }
                alienLasers.splice(i, 1);
            }
            else {
                al.dead
                    ? alienLasers.splice(i, 1)
                    : al.draw();
            }
        }
    }
}

// -- Bomb -------------------------------------------------------------------
// Fast homing projectile launched on pickup
// Targets the boss if present, otherwise a random point on the form's surface

class Bomb {
    constructor(x, y, angle) {
        this.x      = x;
        this.y      = y;
        this.angle  = angle;
        this.cosA   = Math.cos(angle); // recached in update() whenever angle turns
        this.sinA   = Math.sin(angle);
        this.spd    = 9 * dpr;
        this.vx     = this.cosA * this.spd;
        this.vy     = this.sinA * this.spd;
        this.age    = 0;
        this.r      = 7 * dpr;
        this.trail  = [];
        this.dead   = false;
        this.target = null;
    }

    update(dt) {
        this.age += dt;
        // Continuously track target: the boss takes priority when present
        let nearest = null, nearestD = Infinity;
        if (boss) {
            nearest  = boss;
            nearestD = Math.hypot(boss.x - this.x, boss.y - this.y);
        }
        // otherwise find a random point on the form's surface
        // 10% chance it's the exact core, like a lucky proton torpedo shot
        else if (form.rect) {
            if (!this.target) {
                if (RND() < 0.1) {
                    // core center
                    this.target = {
                        x: form.rect.cx,
                        y: form.rect.cy,
                        vx: 0,
                        vy: 0
                    };
                }
                else {
                    // outside the core
                    const a = RND(0, TWO_PI);
                    const r = RND(0.15, 0.9) * form.rect.w/2;
                    this.target = {
                        x: form.rect.cx + r * Math.cos(a),
                        y: form.rect.cy + r * Math.sin(a),
                        vx: 0,
                        vy: 0
                    };
                }
            }
            nearest  = this.target;
            nearestD = Math.hypot(this.target.x - this.x, this.target.y - this.y);
        }
        const turnRate = 0.12;
        if (nearest) {
            // Lead the target
            const lead = Math.min(60, nearestD / this.spd);
            const px   = nearest.x + (nearest.vx || 0) * lead;
            const py   = nearest.y + (nearest.vy || 0) * lead;
            // Turn toward the lead point at a capped rate
            const desired = Math.atan2(py - this.y, px - this.x);
            const diff    = Math.atan2(Math.sin(desired - this.angle), Math.cos(desired - this.angle));
            this.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
            this.cosA = Math.cos(this.angle);
            this.sinA = Math.sin(this.angle);
        }
        const maxSpd = nearest ? Math.min(13 * dpr, turnRate * nearestD * 0.5) : 13 * dpr;
        this.spd = Math.min(maxSpd, this.spd + 0.15 * dpr * dt);
        this.vx = this.cosA * this.spd;
        this.vy = this.sinA * this.spd;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 18)
            this.trail.shift();

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        wrapEdges(this);

        if ((nearest && nearestD < 22 * dpr) || this.age > 600)
            this.explode();
    }

    explode() {
        // No longer harms aliens/border-aliens
        // only the boss and the form take damage
        const radius = 90 * dpr;
        if (boss && Math.hypot(boss.x - this.x, boss.y - this.y) < radius) {
            boss.hp -= 2;
            boss.hitFlash = 15;
        }
        if (form.inZone(this.x, this.y, radius))
            form.addCrater(this.x, this.y);
        for (let k = 0; k < 7; k++)
            explosions.push(new Explosion(
                this.x + RND(-35, 35) * dpr,
                this.y + RND(-35, 35) * dpr));
        shakeAmt = Math.max(shakeAmt, 10);
        Sound.bossDie();
        this.dead = true;
    }

    draw() {
        const pulse = 0.4 + 0.6 * triangleWave(this.age * 0.3);
        ctx.save();
        for (let i = 0; i < this.trail.length; i++) {
            const tp = (i + 1) / this.trail.length;
            ctx.globalAlpha = tp * 0.55;
            ctx.fillStyle   = i % 2 === 0 ? '#ff8800' : '#ffcc00';
            ctx.beginPath();
            ctx.arc(this.trail[i].x, this.trail[i].y, this.r * tp * 0.6, 0, TWO_PI);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur  = Math.round(14 * dpr * pulse);
        ctx.fillStyle   = '#ffcc00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, TWO_PI);
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth   = 2 * dpr;
        ctx.stroke();
        ctx.restore();
    }
}

// -- Boss alien ---------------------------------------------------------------
// Large enemy with HP bar above
// - spawns at a random location when border aliens are cleared
// - fires a triple spread shot toward the ship every 50 frames
// - rams the ship for heavy damage, or bounces off the shield

const BOSS_PALETTES = [
    { X:'#3399ff', H:'#aaddff', D:'#114488', O:'#ffaa00', G:'#44ff88', C:'#00ccff', L:'#88ff22' },
    { X:'#ff4422', H:'#ffaa88', D:'#881100', O:'#ffff00', G:'#ff88aa', C:'#ff8844', L:'#ffdd00' },
    { X:'#cc44ff', H:'#ddaaff', D:'#441188', O:'#ff44ff', G:'#aa44ff', C:'#ee55ff', L:'#cc88ff' },
    { X:'#ffcc00', H:'#ffee88', D:'#885500', O:'#ff8800', G:'#ffff44', C:'#ffcc44', L:'#ff9900' },
];

class BossAlien {
    constructor() {
        const minDist = Math.min(W, H) * 0.45;
        do {
            this.x = RND(W * 0.1, W * 0.9);
            this.y = RND(H * 0.1, H * 0.9);
        }
        while (ship && Math.hypot(ship.x - this.x, ship.y - this.y) < minDist);

        this.vx           = 0;
        this.vy           = 0;
        this.maxHp        = Math.round(levelRamp(5, 18, levelNumber)); // eases toward 23 HP
        this.hp           = this.maxHp;
        this.hitFlash     = 0;
        this.animFrame    = 0;
        this.shotCooldown = 60;
        this.paletteIdx   = (levelNumber - 1) % BOSS_PALETTES.length;
        this.palette      = BOSS_PALETTES[this.paletteIdx];
    }

    static frameSprites = {};

    // Builds (and caches) the pre-rendered canvas for one animation frame of
    // one palette, so it's drawn once per unique frame/palette pairing
    // instead of re-rasterized every time an instance needs it
    static buildFrame(f, palette, pidx) {
        const key = f + '-' + (pidx || 0);
        const b = BossAlien.frameSprites[key];
        if (b) return b;
        const art = [
            [ // frame 0
                '.....XXXXX.....',
                '...XXXXXXXXX...',
                '..XHXXXXXXXHX..',
                '.XXXXXXXXXXXXX.',
                'XOXOXOXOXOXOXOX',
                '.DXCCCCCCCCCXD.',
                '..LLLLLLLLLLL..',
                '...LLLLLLLLL...',
            ],
            [ // frame 1
                '.....XXXXX.....',
                '...XXXXXXXXX...',
                '..XHXXXXXXXHX..',
                '.XXXXXXXXXXXXX.',
                'XGXGXGXGXGXGXGX',
                '.DXCCCCCCCCCXD.',
                '..LLLLLLLLLLL..',
                '...LLLLLLLLL...',
            ],
        ][f];
        const pw   = Math.ceil(6 * dpr);
        const cols = art[0].length;
        const rows = art.length;
        const oc   = document.createElement('canvas');
        oc.width   = cols * pw;
        oc.height  = rows * pw;
        const c    = oc.getContext('2d');
        const colorMap = palette ?? BOSS_PALETTES[0];
        art.forEach((row, ri) => {
            for (let ci = 0; ci < row.length; ci++) {
                const col = colorMap[row[ci]];
                if (col) {
                    c.fillStyle = col;
                    c.fillRect(ci * pw, ri * pw, pw - 1, pw - 1);
                }
            }
        });
        const result = {
            img: oc,
            w: cols * pw,
            h: rows * pw,
            ox: cols * pw / 2, // half-width/height, precomputed so draw() doesn't recompute per frame
            oy: rows * pw / 2
        };
        BossAlien.frameSprites[key] = result;
        return result;
    }

    update(dt) {
        this.animFrame += dt;
        if (this.hitFlash > 0)
            this.hitFlash -= dt;
        // Home in on the ship
        if (ship) {
            const dx = ship.x - this.x;
            const dy = ship.y - this.y;
            const d  = Math.hypot(dx, dy);
            if (d > 0) {
                this.vx += (dx / d) * 0.05 * dpr * dt;
                this.vy += (dy / d) * 0.05 * dpr * dt;
            }
        }
        // Cap speed
        const spd = Math.hypot(this.vx, this.vy);
        const max = 1.0 * dpr;
        if (spd > max) {
            this.vx = (this.vx / spd) * max;
            this.vy = (this.vy / spd) * max;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        bounceBorders(this, 50 * dpr);
        // Triple spread shot toward the ship
        if (ship && alienLasers.length < maxAlienLasers && (this.shotCooldown -= dt) <= 0) {
            this.shotCooldown = 50;
            const a = Math.atan2(ship.y - this.y, ship.x - this.x);
            for (const spread of [-0.22, 0, 0.22])
                alienLasers.push(new AlienLaser(this.x, this.y, a + spread));
        }
        // Ram damage: hurt ship heavily / or bounce off shield, -1 boss HP, -500 score
        if (ship && Math.hypot(ship.x - this.x, ship.y - this.y) < 44 * dpr) {
            if (powerups.shieldUntil > frameNow) {
                const dx = this.x - ship.x, dy = this.y - ship.y;
                const d  = Math.hypot(dx, dy) || 1;
                this.vx += (dx / d) * 2.5 * dpr;
                this.vy += (dy / d) * 2.5 * dpr;
                score   = Math.max(0, score - BOSS_RAM_PENALTY);
                this.hp = Math.max(0, this.hp - 1);
                this.hitFlash = 10;
                explosions.push(new Explosion(this.x, this.y));
            }
            // If the shield is down, the ship takes heavy damage and is knocked away from the boss
            else {
                this.hp = Math.max(0, this.hp - 2);
                explosions.push(new Explosion(this.x, this.y));
                // Ram: always knocked away and spun
                const dx = ship.x - this.x, dy = ship.y - this.y;
                const d  = Math.hypot(dx, dy) || 1;
                Spaceship.loseShip(2, ship.x, ship.y, 20, 10, {
                    ejX: dx / d, ejY: dy / d,
                    offset: 50 * dpr, turns: 2, spinDir: RND() < 0.5 ? -1 : 1
                });
            }
        }
    }

    draw() {
        const f = Math.floor(this.animFrame / 20) % 2;
        const { img, w, h, ox, oy } = BossAlien.buildFrame(f, this.palette, this.paletteIdx);
        ctx.save();
        ctx.globalAlpha = this.hitFlash > 0 ? 1 : (0.70 + 0.30 * triangleWave(this.animFrame * 0.1));
        ctx.drawImage(img, this.x - ox, this.y - oy);
        // White flash overlay on hit
        if (this.hitFlash > 0) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle   = '#ffffff';
            ctx.fillRect(this.x - ox, this.y - oy, w, h);
        }
        // Dome cockpit: glowing iris tracking the ship
        const eyeX = this.x;
        const eyeY = this.y - h * 0.3;
        const eyeR = 9 * dpr;
        let   pdx = 0;
        let   pdy = 0;
        if (ship) {
            const dx = ship.x - this.x;
            const dy = ship.y - this.y;
            const d  = Math.hypot(dx, dy) || 1;
            pdx = (dx / d) * 3.5 * dpr;
            pdy = (dy / d) * 3.5 * dpr;
        }
        const pulse = 0.2 + 0.8 * triangleWave(this.animFrame * 0.15);
        ctx.globalAlpha = 0.7 * pulse;
        ctx.strokeStyle = '#ff0044';
        ctx.lineWidth   = 2 * dpr;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, eyeR, 0, TWO_PI);
        ctx.stroke();
        const grad = ctx.createRadialGradient(eyeX + pdx, eyeY + pdy, 0, eyeX, eyeY, eyeR);
        grad.addColorStop(0,   'rgba(255,0,68,0.9)');
        grad.addColorStop(0.4, 'rgba(255,80,0,0.5)');
        grad.addColorStop(1,   'rgba(255,0,68,0)');
        ctx.globalAlpha = pulse;
        ctx.fillStyle   = grad;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, eyeR, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath();
        ctx.arc(eyeX + pdx, eyeY + pdy, 2 * dpr, 0, TWO_PI);
        ctx.fill();
        // Dashed targeting beam flashes when about to fire
        if (ship && this.shotCooldown < 20) {
            ctx.globalAlpha = (1 - this.shotCooldown / 20) * 0.5;
            ctx.strokeStyle = '#ff0044';
            ctx.lineWidth   = dpr;
            ctx.setLineDash([4 * dpr, 4 * dpr]);
            ctx.beginPath();
            ctx.moveTo(eyeX, eyeY);
            ctx.lineTo(ship.x, ship.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        // HP bar above sprite
        const barW = w * 0.8;
        const barH = 5 * dpr;
        const barX = this.x - barW / 2;
        const barY = this.y - oy - 9 * dpr;
        const hpColor = this.hp >= this.maxHp * 0.6 ? '#44ff44' : this.hp >= this.maxHp * 0.25 ? '#ffff44' : '#ff4444';
        ctx.globalAlpha = 0.85;
        ctx.fillStyle   = '#333333';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
        ctx.restore();
    }
}

// -- Health pack --------------------------------------------------------------
// Floating green + pickup that restores 1 HP when touched

class HealthPack {
    constructor() {
        // Spawn outside the logon form
        const pad = 20 * dpr;
        do {
            this.x = RND(pad, W - pad);
            this.y = RND(pad, H - pad);
        }
        while (form.inZone(this.x, this.y, 20 * dpr));

        this.vx  = RND(-0.4, 0.4) * dpr;
        this.vy  = RND(-0.4, 0.4) * dpr;
        this.age = 0;
        this.r   = 11 * dpr;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.age += dt;
        bounceBorders(this, 20 * dpr);
        // Bounce off the logon form
        form.bounce(this, this.r);
    }

    draw() {
        const s = this.r;
        const pulse = 0.5 + 0.5 * triangleWave(this.age * 0.1);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.translate(this.x, this.y);
        ctx.fillStyle   = '#44ff88';
        ctx.fillRect(-s * 0.5,  -s * 0.18, s,        s * 0.36);
        ctx.fillRect(-s * 0.18, -s * 0.5,  s * 0.36, s);
        ctx.restore();
    }

    get dead() { return this.age > 1500; }
}

// -- Power-up -----------------------------------------------------------------
// Collectible diamond: shield, quad shot, triple shot, time slow, or bomb

const POWERUP_TYPES = [
    { id: 'shield', label: '\u25a0', color: '#44aaff', glow: '#0088ff' },
    { id: 'quad',   label: '\u271a', color: '#ffee00', glow: '#ffcc00' },
    { id: 'triple', label: '\u2726', color: '#ff88ff', glow: '#ff44ff' },
    { id: 'slow',   label: '\u29d7', color: '#88ff44', glow: '#44ff00' },
    { id: 'bomb',   label: '\u2738', color: '#ff8800', glow: '#ff4400' }
];

class PowerUp {
    constructor(type) {
        const pad = 30 * dpr;
        do {
            this.x = RND(pad, W - pad);
            this.y = RND(pad, H - pad);
        }
        while (form.inZone(this.x, this.y, 30 * dpr));

        this.vx   = RND(-0.5, 0.5) * dpr;
        this.vy   = RND(-0.5, 0.5) * dpr;
        this.age  = 0;
        this.r    = 13 * dpr;
        const t   = type ?? POWERUP_TYPES[Math.floor(RND() * POWERUP_TYPES.length)];
        this.id    = t.id;
        this.label = t.label;
        this.color = t.color;
        this.glow  = t.glow;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.age += dt;
        bounceBorders(this, 20 * dpr);
    }

    draw() {
        const pulse = 0.6 + 0.4 * triangleWave(this.age * 0.12);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.age * 0.04);
        ctx.shadowColor = this.glow;
        ctx.shadowBlur  = 14 * dpr;
        const r = this.r;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth   = 2.5 * dpr;
        ctx.stroke();
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = pulse * 0.3;
        ctx.fillStyle   = this.glow;
        ctx.fill();
        ctx.globalAlpha = pulse;
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = this.color;
        ctx.font        = `bold ${Math.round(11 * dpr)}px sans-serif`;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, 0, 0);
        ctx.restore();
    }

    get dead() { return this.age > 900; }
}

// -- Game class ---------------------------------------------------------------
// Handles the main game loop, input, and state management

class Game extends LogonBg {
    constructor() {
        super(window.localStorage.getItem('themeBase') || 'dark');
        COLORS = this.COLORS;
        form.injectStyle();
        Game.progress = Game.loadProgress(); // { score, level }

        // Create and layer the canvas behind all existing children
        canvas = document.createElement('canvas');
        Object.assign(canvas.style, {
            position: 'absolute',
            inset:    '0',
            width:    '100%',
            height:   '100%',
            zIndex:   '0',
            display:  'block'
        });
        container.prepend(canvas);
        [...container.children].forEach(e => {
            if (e !== canvas) {
                e.style.position = 'relative';
                e.style.zIndex   = '1';
            }
        });
        ctx = canvas.getContext('2d');
        dpr = window.devicePixelRatio ?? 1;
        BorderAlien.refreshSpeed();
        form.el = container.querySelector(options.deathStar);
        logo    = container.querySelector(options.eggButton);

        // Initialize background particles
        streaks.init();
        explosions = [];
        shockwaves = [];
        screenFlash = 0;
        form.clearCraters();

        // Reset all game state
        ship         = null;
        aliens       = [];
        boss         = null;
        lasers       = [];
        alienLasers  = [];
        borderAliens = [];
        borderTrainT = 0;
        score        = 0;
        frame        = 0;
        lastShot     = 0;
        burstShots   = 0;
        reloadUntil  = 0;
        tooFarMsgAt  = 0;
        forceMsgAt   = 0;
        shipHp       = 0;
        healthPacks  = [];
        nextHealthPackAt = 0;
        levelNumber  = 1;
        gameStartAt  = 0;
        finalScore   = null;
        finalScoreAt = 0;
        gameOver     = false;
        floatScores  = [];
        shakeAmt     = 0;
        shipHitFlash = 0;
        combo        = 1;
        comboTimer   = 0;
        countdown    = -1;
        levelAnnouncement = null;
        borderTrainCount = 10;
        BorderAlien.refreshSpeed();
        powerups.reset();
        beam.reset();

        // Input state
        keys = {
            ArrowLeft: false,
            ArrowRight: false,
            ArrowUp: false,
            ArrowDown: false
        };
        started = false;

        window.addEventListener('resize', () => this.resize());
        document.addEventListener('keydown', e => this.onKeyDown(e));
        document.addEventListener('keyup',   e => this.onKeyUp(e));
        logo?.addEventListener('click', () => this.onLogoClick());
        this.resize();

        requestAnimationFrame(ts => this.animate(ts));
    }

    static progress; // { score, level }

    // Reads back saved { score, level }, tagged with GAME_VERSION; anything
    // missing, corrupt, or from an older version is wiped and reset
    static loadProgress() {
        try {
            const saved = JSON.parse(localStorage.getItem(options.scoreStorage));
            if (saved && saved.version === GAME_VERSION)
                return saved;
        }
        catch (e) { /* reset new version */ }
        localStorage.removeItem(options.scoreStorage);
        return { score: 0, level: 0 };
    }

    // Pre-renders every sprite (ship, all alien style/color/frame combos,
    // both boss frames per palette) once up front, so no sprite is ever
    // rasterized mid-frame during gameplay
    prepareAllSprites() {
        Spaceship.buildSprite();
        for (let s = 0; s < ALIEN_STYLES.length; s++) {
            const eyeColor = ALIEN_EYE_COLORS[s];
            for (const color of COLORS) {
                Alien.buildFrame(s, color, eyeColor, 0);
                Alien.buildFrame(s, color, eyeColor, 1);
            }
        }
        BOSS_PALETTES.forEach((p, i) => {
            BossAlien.buildFrame(0, p, i);
            BossAlien.buildFrame(1, p, i);
        });
    }

    // Persists the current best score/level, tagged with GAME_VERSION
    static saveProgress(score = 0, level = 0) {
        Game.progress.version = GAME_VERSION;
        Game.progress.score = Math.max(Game.progress.score, score);
        Game.progress.level = Math.max(Game.progress.level, level);
        localStorage.setItem(options.scoreStorage, JSON.stringify(Game.progress));
    }

    resize() {
        canvas.width  = W = (container.clientWidth  || container.innerWidth)  * dpr;
        canvas.height = H = (container.clientHeight || container.innerHeight) * dpr;
        cx = W / 2;
        cy = H / 2;
        screenDiag = Math.hypot(W, H);
        form.updateMetrics();
    }

    drawGrid() {
        const key = `${W},${H},${this.BG},${this.GRID_STROKE}`;
        if (gridKey !== key) {
            gridCanvas = document.createElement('canvas');
            gridCanvas.width  = W;
            gridCanvas.height = H;
            gridKey = key;
            const gc = gridCanvas.getContext('2d');
            gc.fillStyle = this.BG;
            gc.fillRect(0, 0, W, H);
            const maxR = Math.hypot(cx, cy) * 1.4;
            gc.strokeStyle = this.GRID_STROKE;
            gc.lineWidth   = 0.7 * dpr;
            gc.beginPath();
            for (let i = 0; i < 48; i++) {
                const a = (i / 48) * TWO_PI;
                gc.moveTo(cx, cy);
                gc.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
            }
            gc.stroke();
        }
        ctx.drawImage(gridCanvas, 0, 0);
    }

    applyColors(theme) {
        const t          = THEMES[theme] || THEMES.dark;
        this.BG          = t.BG;
        this.GRID_STROKE = t.GRID_STROKE;
        this.HUD_TEXT    = t.HUD_TEXT;
        this.HUD_SHADOW  = t.HUD_SHADOW;
        this.SCORE_COLOR = t.SCORE_COLOR;
        this.SCORE_GLOW  = t.SCORE_GLOW;
        this.COLORS      = t.COLORS;
        COLORS           = t.COLORS;
    }

    setForm(opacity, scale) {
        if (!form.el)
            return;
        form.el.style.setProperty('opacity', `${opacity}`);
        form.el.style.setProperty('transform', `scale(${scale})`);
        form.el.style.setProperty('filter', scale < 1 ? 'blur(1.5px)' : '');
        // In-game the form renders as a Death-Star-style sphere obstacle
        form.el.style.removeProperty('width');
        form.el.style.removeProperty('height');
        if (scale < 1) {
            const diameter = Math.min(form.el.offsetWidth, form.el.offsetHeight);
            form.el.style.setProperty('width',  `${diameter}px`);
            form.el.style.setProperty('height', `${diameter}px`);
            form.el.classList.add('logon-death-star');
        }
        else {
            form.el.classList.remove('logon-death-star');
            form.clearCraters();
        }
        this.setCursor(scale < 1);
        form.updateMetrics();
    }

    // Swaps the OS pointer for a translucent dot while playing
    setCursor(active) {
        if (active) {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'>` +
                `<circle cx='10' cy='10' r='7' fill='white' fill-opacity='0.35' stroke='black' stroke-opacity='0.35' stroke-width='2'/></svg>`;
            document.body.style.setProperty('cursor', `url("data:image/svg+xml,${encodeURIComponent(svg)}") 10 10, auto`);
        }
        else {
            document.body.style.removeProperty('cursor');
        }
    }

    // Toggle game on/off - called by easter egg/logo click
    onLogoClick() {
        if (gameOver)
            return;
        if (countdown >= 0) {
            countdown = -1;
            started = false;
            ship = null;
            this.setForm(1, 1);
            this.applyColors(this.savedTheme || 'dark');
            return;
        }
        if (started) {
            // Stop the game and show final score
            finalScore   = score;
            finalScoreAt = Date.now();
            ship         = null;
            aliens       = [];
            boss         = null;
            lasers       = [];
            alienLasers  = [];
            borderAliens = [];
            healthPacks  = [];
            powerups.active = [];
            started  = false;
            Game.saveProgress(score, levelNumber);
            score       = 0;
            combo       = 1;
            comboTimer  = 0;
            powerups.shieldUntil = 0;
            explosions.length = 0;
            shockwaves.length  = 0;
            screenFlash        = 0;
            this.setForm(1, 1);
            this.applyColors(this.savedTheme || 'dark');
        }
        else {
            this.savedTheme = localStorage.getItem('themeBase') || 'dark';
            this.applyColors('dark');
            // Animate form to game-mode size, then start
            form.el?.style.setProperty('transition', 'opacity 300ms ease, transform 300ms ease');
            this.setForm(0.4, 0.5);
            this.prepareAllSprites();
            setTimeout(() => {
                form.el?.style.removeProperty('transition');
                gameEnding       = false;
                maxAlienLasers   = 1;
                started          = false;
                finalScore       = null;
                score            = 0;
                aliens           = [];
                boss             = null;
                gameStartAt      = 0;
                shipHp           = 5;
                countdown        = 3;
                countdownAt      = Date.now();
                nextHealthPackAt = countdownAt + 25000;
                powerups.nextAt  = countdownAt + 12000;
                beam.reset(countdownAt + 120000);
                levelNumber      = 1;
                borderTrainCount = 10;
                BorderAlien.refreshSpeed();
                borderTrainT     = 0;
                combo            = 1;
                comboTimer       = 0;
                powerups.active      = [];
                powerups.shieldUntil = 0;
                powerups.bombs       = [];
                powerups.bombQueue   = 0;
                form.updateMetrics();
                // Spawn the ship in a random screen corner, facing the center
                const { x: sx, y: sy, angle: spawnAngle } = Spaceship.randomCornerSpawn();
                ship = new Spaceship(sx, sy, spawnAngle);
                Sound.warp();
                borderAliens = BorderAlien.spawn(borderTrainCount);
            }, 310);
        }
    }

    // Handle keydown events for movement, shooting, and game control
    onKeyDown(e) {
        // Game over or not started yet
        if (!started)
            return;
        // Space fires a laser if the ship isn't locked in a tractor beam
        if (e.key === ' ') {
            e.preventDefault();
            // not using frameNow here because keydown can fire multiple times per frame
            const now = Date.now();
            if (ship && started && ship.tractorRemaining <= 0 && now - lastShot > 120 && now >= reloadUntil) {
                lastShot = now;
                const r = 18 * dpr; // spawn offset from ship center
                if (powerups.bombQueue > 0) {
                    // Bombs only launch close to the death star's core
                    // too far away and the queued bomb just stays frozen/held
                    const originX = form.rect ? form.rect.cx : cx;
                    const originY = form.rect ? form.rect.cy : cy;
                    const bombRange = form.rect ? form.rect.w * 1.5 : 300 * dpr;
                    if (Math.hypot(ship.x - originX, ship.y - originY) <= bombRange) {
                        powerups.bombs.push(new Bomb(
                            ship.x + r * Math.cos(ship.angle),
                            ship.y + r * Math.sin(ship.angle),
                            ship.angle));
                        powerups.bombQueue--;
                        Sound.shoot();
                    }
                    else if (now - tooFarMsgAt > 1000) {
                        tooFarMsgAt = now;
                        floatScores.push({
                            x: ship.x,
                            y: ship.y - 24 * dpr,
                            val: MSG.TOO_FAR,
                            age: 0,
                            color: '#ff6666'
                        });
                    }
                }
                else {
                    const angles = powerups.quadUntil > now
                        ? [ship.angle, ship.angle + Math.PI / 2, ship.angle + Math.PI, ship.angle - Math.PI / 2]
                        : (powerups.tripleUntil > now
                        ? [ship.angle - 0.22, ship.angle, ship.angle + 0.22]
                        : [ship.angle]);
                    angles.forEach(a => lasers.push(new Laser(
                        ship.x + r * Math.cos(a),
                        ship.y + r * Math.sin(a), a)));
                    Sound.shoot();
                    // Fresh manual press
                    if (!e.repeat) {
                        burstShots = 0;
                    }
                    // Auto-repeat keydown: count toward burst limit
                    else if (++burstShots >= 10) {
                        burstShots  = 0;
                        reloadUntil = now + 800;
                        floatScores.push({
                            x: ship.x,
                            y: ship.y - 24 * dpr,
                            val: MSG.RELOAD,
                            age: 0,
                            color: '#ff6666'
                        });
                    }
                }
            }
            return;
        }
        // Esc stops the game
        if (e.key === 'Escape') {
            this.onLogoClick();
            return;
        }
        if (e.key in keys) {
            e.preventDefault();
            keys[e.key] = true;
        }
    }

    // Handle keyup events to stop movement
    onKeyUp(e) {
        if (started && e.key in keys) {
            e.preventDefault();
            keys[e.key] = false;
        }
    }

    // Spawns aliens up to the level's target count, then updates/draws them,
    // removing any that died
    updateAliens(alienDt) {
        // Don't backfill while a death-star boom is sweeping the field
        // new aliens spawn at screen center, right where the blast already
        // reaches, so they'd just die instantly in a rapid spawn/score loop
        if (started && shockwaves.length === 0) {
            const elapsed = frameNow - gameStartAt;
            const target  = boss ? 1 : (elapsed < 20000 ? 1 : Math.min(levelNumber, 5));
            while (aliens.length < target)
                aliens.push(new Alien());
        }
        for (let i = aliens.length - 1; i >= 0; i--) {
            const al = aliens[i];
            if (!al) continue;
            al.update(alienDt);
            al.dead
                ? aliens.splice(i, 1)
                : al.draw();
        }
    }

    // Spawns the boss once the border-alien train is exhausted,
    // updates/draws it, and handles its death: reward, level increment, fresh border train
    updateBoss(alienDt) {
        if (started && !boss && !borderAliens.length) {
            boss = new BossAlien();
            levelAnnouncement = { text: MSG.BOSS_INCOMING, age: 0 };
            Sound.warp();
        }
        if (!boss)
            return;
        boss.update(alienDt);
        if (boss.hp > 0) {
            boss.draw();
            return;
        }
        // Boss defeated: reward, advance the level, field a fresh border train
        for (let i = 0; i < 5; i++)
            explosions.push(new Explosion(
                boss.x + RND(-30, 30) * dpr,
                boss.y + RND(-30, 30) * dpr
            ));
        const bossPts = BOSS_KILL_POINTS * levelNumber;
        score += bossPts;
        floatScores.push({
            x: boss.x,
            y: boss.y,
            val: `+${bossPts}`,
            age: 0
        });
        shakeAmt = Math.max(shakeAmt, 10);
        Sound.bossDie();
        boss = null;
        levelNumber++;
        BorderAlien.refreshSpeed();
        levelAnnouncement = { text: MSG.LEVEL(levelNumber), age: 0 };
        borderTrainCount = Math.min(30, borderTrainCount + 2);
        maxAlienLasers = Math.round(levelRamp(1, 5, levelNumber)); // eases toward 6 concurrent shots
        borderTrainT = 0;
        borderAliens = BorderAlien.spawn(borderTrainCount);
    }

    // Moves the border-alien train around the perimeter and draws it
    updateBorderTrain(alienDt) {
        borderTrainT += BorderAlien.speed * alienDt;
        borderAliens.forEach(a => {
            a.update(alienDt);
            a.draw();
        });
    }

    // Spawns health packs on a timer, then updates/draws them and heals the
    // ship on pickup
    updateHealthPacks(dt) {
        if (started && healthPacks.length < 2 && frameNow >= nextHealthPackAt) {
            healthPacks.push(new HealthPack());
            nextHealthPackAt = frameNow + RND(20000, 35000);
        }
        for (let i = healthPacks.length - 1; i >= 0; i--) {
            const pack = healthPacks[i];
            pack.update(dt);
            if (ship && Math.hypot(ship.x - pack.x, ship.y - pack.y) < pack.r + 16 * dpr) {
                shipHp = Math.min(10, shipHp + 1);
                Sound.pickup();
                floatScores.push({
                    x: pack.x,
                    y: pack.y,
                    val: MSG.HEALTH_PICKUP,
                    age: 0,
                    color: '#44ff88'
                });
                healthPacks.splice(i, 1);
            }
            else {
                pack.dead
                    ? healthPacks.splice(i, 1)
                    : pack.draw();
            }
        }
    }

    // Updates/draws impact explosions and death-star boom shockwaves
    updateEffects(dt) {
        for (let i = explosions.length - 1; i >= 0; i--) {
            explosions[i].update(dt);
            explosions[i].dead
                ? explosions.splice(i, 1)
                : explosions[i].draw();
        }
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            shockwaves[i].update(dt);
            shockwaves[i].dead
                ? shockwaves.splice(i, 1)
                : shockwaves[i].draw();
        }
    }

    // Decays the combo timer, ship hit flash, death-star boom screen flash,
    // and screen shake (applied as a CSS translate on the canvas element)
    updateTimers(dt) {
        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0)
                combo = 1;
        }
        if (shipHitFlash > 0)
            shipHitFlash -= dt;
        if (screenFlash > 0)
            screenFlash -= dt;
        if (shakeAmt > 0.5) {
            const sx = (RND() - 0.5) * 2 * shakeAmt;
            const sy = (RND() - 0.5) * 2 * shakeAmt;
            canvas.style.transform = `translate(${sx}px,${sy}px)`;
            shakeAmt *= 0.8 ** dt;
        }
        else {
            shakeAmt = 0;
            canvas.style.transform = '';
        }
    }

    // 3-2-1-GO! countdown before a level starts; flips `started` and stamps
    // gameStartAt the instant it reaches GO
    updateCountdown() {
        if (countdown < 0)
            return;
        const elapsed = frameNow - countdownAt;
        const newVal  = Math.max(0, 3 - Math.floor(elapsed / 900));
        if (newVal < countdown) {
            countdown = newVal;
            if (countdown > 0) {
                Sound.count();
            }
            else {
                started = true;
                gameStartAt = frameNow;
                form.updateMetrics();
                Sound.go();
            }
        }
        if (countdown === 0 && elapsed > 3100)
            countdown = -1;
    }

    // Main animation loop; called via requestAnimationFrame
    animate(ts = 0) {
        frameNow = Date.now();
        // dt = 1.0 at 60 fps; capped to avoid huge jumps after tab sleep
        const dt = this._ts ? Math.min((ts - this._ts) / (1000 / 60), 3) : 1;
        this._ts = ts;
        frame++;

        this.updateTimers(dt);
        // alienDt is reduced when time-slow power-up is active
        const alienDt = powerups.slowUntil > frameNow ? dt * 0.3 : dt;
        this.updateCountdown();

        this.drawGrid();
        streaks.update(dt);

        if (ship) {
            ship.update(dt);
            ship.draw();
            ship.updateLasers(dt);
        }
        else {
            this.updateShipRespawn(dt);
        }

        this.updateAliens(alienDt);
        this.updateBoss(alienDt);
        this.updateBorderTrain(alienDt);
        this.updateHealthPacks(dt);

        powerups.update(dt);
        beam.update();
        powerups.updateBombs(dt);

        AlienLaser.updateAll(alienDt);
        Explosion.updateAll(dt);
        Shockwave.updateAll(dt);

        this.updateFloatScores(dt);
        this.checkGameOver();
        this.updateGameEnding();

        this.drawFinalScore();
        this.drawLevelAnnouncement(dt);
        this.drawCountdownOverlay();
        this.drawScreenFlash();

        // Request the next animation frame
        requestAnimationFrame(ts => this.animate(ts));
    }

    // Center-screen "LEVEL n" / "BOSS!" banner; fades in, holds, fades out
    drawLevelAnnouncement(dt) {
        if (!levelAnnouncement)
            return;
        levelAnnouncement.age += dt;
        if (levelAnnouncement.age >= 150) {
            levelAnnouncement = null;
            return;
        }
        const ta    = levelAnnouncement.age;
        const alpha = ta < 30 ? ta / 30 : ta > 120 ? Math.max(0, 1 - (ta - 120) / 30) : 1;
        ctx.save();
        ctx.globalAlpha  = alpha;
        ctx.font         = `bold ${Math.round(48 * dpr)}px monospace`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor  = '#88ffff';
        ctx.shadowBlur   = 16 * dpr;
        ctx.fillStyle    = '#ffffff';
        ctx.fillText(levelAnnouncement.text, cx, cy);
        ctx.restore();
    }

    // Center-screen 3-2-1-GO! overlay, pulsing in/out each number
    drawCountdownOverlay() {
        if (countdown < 0)
            return;
        const cElapsed = frameNow - countdownAt;
        const cText    = countdown > 0 ? `${countdown}` : MSG.GO;
        const cPhase   = cElapsed % 900;
        const cAlpha   = countdown > 0
            ? (cPhase < 200 ? cPhase / 200 : cPhase > 700 ? 1 - (cPhase - 700) / 200 : 1)
            : Math.max(0, 1 - (cElapsed - 2700) / 400);
        ctx.save();
        ctx.globalAlpha  = Math.max(0, Math.min(1, cAlpha));
        ctx.font         = `bold ${Math.round(72 * dpr)}px monospace`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor  = countdown > 0 ? '#ffdd44' : '#88ffff';
        ctx.shadowBlur   = 20 * dpr;
        ctx.fillStyle    = countdown > 0 ? '#ffdd44' : '#88ffff';
        ctx.fillText(cText, cx, cy);
        ctx.restore();
    }

    // Death-star boom screen flash - topmost so it washes out the frame
    drawScreenFlash() {
        if (screenFlash <= 0)
            return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, screenFlash / 40);
        ctx.fillStyle   = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    // Ages/draws floating "+N" score popups, culling ones past their lifetime
    updateFloatScores(dt) {
        ctx.save();
        ctx.font         = `bold ${Math.round(14 * dpr)}px monospace`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        for (let i = floatScores.length - 1; i >= 0; i--) {
            const f = floatScores[i];
            f.age += dt;
            if (f.age > 120) {
                floatScores.splice(i, 1);
                continue;
            }
            const alpha = f.age < 90 ? 1 : 1 - (f.age - 90) / 30;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = f.color || this.SCORE_COLOR;
            ctx.fillText(f.val,
                f.x + (f.dx ??  0) * f.age * 0.5 * dpr,
                f.y + (f.dy ?? -1) * f.age * 0.5 * dpr);
        }
        ctx.restore();
    }

    // Ends the match once ship HP is depleted, then draws the HUD while playing
    checkGameOver() {
        if (!started)
            return;
        // Real lives = shipHp + 1
        // negative means game over
        if (shipHp < 0) {
            finalScore   = score;
            finalScoreAt = frameNow;
            Game.saveProgress(score, levelNumber);
            gameOver    = true;
            started     = false;
            gameEnding  = true;
            lasers      = [];
            alienLasers = [];
            healthPacks = [];
            powerups.reset();
        }
        this.drawHUD();
    }

    // Chain-explodes whatever enemies remain after game over, then resets
    // the form and theme once the field is clear
    updateGameEnding() {
        if (!gameEnding)
            return;
        if (frame % 10 === 0) {
            const victims = [...aliens, ...borderAliens];
            boss && victims.push(boss);
            if (victims.length > 0) {
                const v  = victims[Math.floor(RND() * victims.length)];
                explosions.push(new Explosion(v.x, v.y));
                const ai = aliens.indexOf(v);
                const bi = borderAliens.indexOf(v);
                if (ai >= 0)
                    aliens.splice(ai, 1);
                else if (bi >= 0)
                    borderAliens.splice(bi, 1);
                else
                    boss = null;
            }
        }
        // When all enemies are gone, reset the form and theme
        if (aliens.length === 0 && borderAliens.length === 0 && !boss) {
            gameEnding = false;
            gameOver   = false;
            this.setForm(1, 1);
            this.applyColors(this.savedTheme || 'dark');
        }
    }

    // HUD: HP mini-ships (left) and score (right)
    // Screen position of HP mini-ship icon `i` in the HUD, shared with the
    // respawn-flight animation so they always agree
    static hpIconPos(i) {
        const pad = 18 * dpr;
        const hsz = Math.round(16 * dpr);
        return { x: pad + i * (hsz + 2 * dpr) + hsz / 2, y: pad + hsz / 2 };
    }

    // Starts the destroy-and-replace animation: a fresh ship flies in from
    // the last still-lit HP icon to the same kind of spot the very first
    // ship used - a random screen corner, facing the center
    static startShipRespawn() {
        const { x, y } = Game.hpIconPos(shipHp - 1); // last still-lit icon after the hit
        const { x: targetX, y: targetY, angle } = Spaceship.randomCornerSpawn();
        shipRespawn = { x, y, targetX, targetY, angle, age: 0, dur: 45 };
    }

    // Advances/draws the replacement-ship flight animation
    updateShipRespawn(dt) {
        if (!shipRespawn)
            return;
        shipRespawn.age += dt;
        const t = Math.min(1, shipRespawn.age / shipRespawn.dur);
        const ease = t * t * (3 - 2 * t); // smoothstep
        const x = shipRespawn.x + (shipRespawn.targetX - shipRespawn.x) * ease;
        const y = shipRespawn.y + (shipRespawn.targetY - shipRespawn.y) * ease;
        if (Spaceship.sprite) {
            ctx.save();
            ctx.globalAlpha = 0.4 + 0.6 * ease;
            ctx.shadowColor = '#88ffff';
            ctx.shadowBlur  = 12 * dpr;
            ctx.translate(x, y);
            ctx.rotate(shipRespawn.angle + Math.PI / 2);
            ctx.scale(0.35 + 0.65 * ease, 0.35 + 0.65 * ease);
            ctx.drawImage(Spaceship.sprite.img, -Spaceship.sprite.ox, -Spaceship.sprite.oy);
            ctx.restore();
        }
        if (t >= 1) {
            ship = new Spaceship(shipRespawn.targetX, shipRespawn.targetY, shipRespawn.angle);
            Sound.warp();
            shipRespawn = null;
        }
    }

    drawHUD() {
        const pad = 18 * dpr;
        const fs  = Math.round(20 * dpr);
        ctx.save();
        // HP mini-ships
        // colored for remaining HP, greyed out once spent
        const hsz = Math.round(16 * dpr);
        if (Spaceship.sprite) {
            const iscale = hsz / Math.max(Spaceship.sprite.img.width, Spaceship.sprite.img.height);
            for (let i = 0; i < 10; i++) {
                const spent  = i >= shipHp;
                const sprite = spent ? Spaceship.spriteGrey : Spaceship.sprite;
                const { x: cx2, y: cy2 } = Game.hpIconPos(i);
                ctx.globalAlpha = spent ? 0.35 : 1;
                ctx.drawImage(sprite.img,
                    cx2 - sprite.ox * iscale, cy2 - sprite.oy * iscale,
                    sprite.img.width * iscale, sprite.img.height * iscale);
            }
            ctx.globalAlpha = 1;
        }
        // Score (top-right)
        ctx.font = `bold ${fs}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillStyle = this.HUD_SHADOW;
        ctx.fillText(MSG.SCORE(score), W - pad + 2 * dpr, pad + 2 * dpr);
        ctx.fillStyle = this.HUD_TEXT;
        ctx.fillText(MSG.SCORE(score), W - pad, pad);
        // Level indicator under the score
        const levelFs = Math.round(13 * dpr);
        const levelY  = pad + fs + 2 * dpr;
        ctx.font = `${levelFs}px monospace`;
        ctx.fillStyle = this.HUD_SHADOW;
        ctx.fillText(MSG.LEVEL(levelNumber), W - pad + dpr, levelY + dpr);
        ctx.fillStyle = this.HUD_TEXT;
        ctx.fillText(MSG.LEVEL(levelNumber), W - pad, levelY);
        // Active power-up icons (bottom-left); combo streak on its own row
        // underneath, with fixed space reserved so the icon row never jumps
        const comboFs   = Math.round(15 * dpr);
        const comboRowH = comboFs + 4 * dpr;
        let   iconX  = pad;
        const iconY  = H - pad - Math.round(18 * dpr) - comboRowH;
        ctx.font = `${Math.round(13 * dpr)}px monospace`;
        ctx.textBaseline = 'bottom';
        ctx.shadowBlur   = 0;
        const drawPU = (label, col) => {
            ctx.fillStyle = col;
            ctx.textAlign = 'left';
            ctx.fillText(label, iconX, iconY);
            iconX += ctx.measureText(label).width + 8 * dpr;
        };
        if (combo > 1) {
            ctx.font = `bold ${comboFs}px monospace`;
            ctx.textAlign   = 'left';
            ctx.fillStyle   = '#ffdd44';
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur  = 6 * dpr;
            ctx.fillText(MSG.COMBO(combo), pad, H - pad);
            ctx.shadowBlur  = 0;
            ctx.font = `${Math.round(13 * dpr)}px monospace`;
        }
        if (powerups.quadUntil > frameNow)
            drawPU(MSG.QUAD(Math.ceil((powerups.quadUntil - frameNow) / 1000)), '#ffee00');
        if (powerups.shieldUntil > frameNow)
            drawPU(MSG.SHIELD(Math.ceil((powerups.shieldUntil - frameNow) / 1000)), '#44aaff');
        if (powerups.tripleUntil > frameNow)
            drawPU(MSG.TRIPLE(Math.ceil((powerups.tripleUntil - frameNow) / 1000)), '#ff88ff');
        if (powerups.slowUntil > frameNow)
            drawPU(MSG.SLOW(Math.ceil((powerups.slowUntil - frameNow) / 1000)), '#88ff44');
        if (powerups.bombs.length > 0)
            drawPU(MSG.BOMB_COUNT(powerups.bombs.length), '#ff8800');
        ctx.restore();
    }

    // Show final score above the ship after game ends
    drawFinalScore() {
        if (finalScore === null)
            return;
        const elapsed = frameNow - finalScoreAt;
        const total   = 60000;
        if (!gameOver && elapsed > total) {
            finalScore = null;
            return;
        }
        const alpha = gameOver ? 1 : (elapsed < total - 2000 ? 1 : (total - elapsed) / 2000);
        const ox = ship ? ship.x : cx;
        const oy = ship ? ship.y - 40 * dpr : cy;
        const fs = Math.round(18 * dpr);
        ctx.save();
        ctx.globalAlpha  = alpha;
        ctx.font         = `bold ${fs}px monospace`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor  = this.SCORE_GLOW;
        ctx.shadowBlur   = 14 * dpr;
        ctx.fillStyle    = this.SCORE_COLOR;
        ctx.fillText(finalScore, ox, oy);
        // Draw best score above the ship
        if (ship && Game.progress.score > 0) {
            const best = MSG.BEST(Game.progress.score);
            ctx.font         = `bold ${Math.round(13 * dpr)}px monospace`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle    = this.HUD_SHADOW;
            ctx.fillText(best, ship.x + dpr, ship.y + 28 * dpr + dpr);
            ctx.fillStyle    = this.SCORE_COLOR;
            ctx.fillText(best, ship.x, ship.y + 28 * dpr);
        }
        ctx.restore();
    }
}

new Game();

})(document.body); // end of IIFE
