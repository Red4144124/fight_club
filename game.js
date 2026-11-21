"use strict";
var Kontakt;
(function (Kontakt) {
    Kontakt.MOVES = {
        jaw: { label: 'В ЧЕЛЮСТЬ', detail: 'Прямой в голову', damage: [17, 25], cost: 18, chance: .79, reach: 465, speed: 7, target: 'head', pose: 'jaw' },
        elbow: { label: 'ЛОКТЕМ', detail: 'Ближняя дистанция', damage: [14, 21], cost: 15, chance: .86, reach: 320, speed: 8, target: 'head', pose: 'elbow' },
        knee: { label: 'КОЛЕНОМ', detail: 'Удар в корпус', damage: [18, 26], cost: 22, chance: .76, reach: 330, speed: 6, target: 'body', pose: 'knee' },
        sweep: { label: 'ПОДСЕЧКА', detail: 'Опустить на колено', damage: [7, 12], cost: 17, chance: .83, reach: 355, speed: 5, target: 'leg', pose: 'sweep' },
        throw: { label: 'БРОСОК', detail: 'Нужен близкий контакт', damage: [19, 27], cost: 27, chance: .71, reach: 255, speed: 4, target: 'body', pose: 'sweep' },
        guard: { label: 'БЛОК', detail: 'Снижает получаемый урон', damage: [0, 0], cost: 0, chance: 1, reach: 0, speed: 10, target: 'none', pose: 'idle' },
        approach: { label: 'ШАГ ВПЕРЁД', detail: 'Сократить дистанцию', damage: [0, 0], cost: 0, chance: 1, reach: 0, speed: 12, target: 'none', pose: 'idle' },
        retreat: { label: 'ОТСТУПИТЬ', detail: 'Увеличить дистанцию', damage: [0, 0], cost: 0, chance: 1, reach: 0, speed: 12, target: 'none', pose: 'idle' },
        recover: { label: 'ПОДНЯТЬСЯ', detail: 'Вернуться в стойку', damage: [0, 0], cost: 0, chance: 1, reach: 0, speed: 13, target: 'none', pose: 'kneel' }
    };
    function fighter(id, name, kit, build) {
        const hp = build === 'power' ? 118 : build === 'slim' ? 94 : 106;
        return { id, name, kit, build, x: id === 0 ? 402 : 878, facing: id === 0 ? 1 : -1, hp, maxHp: hp, stamina: 100, guard: false, kneelTurns: 0,
            pose: 'idle', offsetX: 0, offsetY: 0, scaleX: 1, angle: 0, blood: 0, shirtBlood: 0, gloveBlood: 0, faceBlood: 0,
            bruises: 0, abrasions: 0, hurt: 0, down: false };
    }
    Kontakt.fighter = fighter;
    function newBattle(mode, hero, enemy) {
        return { fighters: [fighter(0, hero.name, hero.kit, hero.build), fighter(1, enemy.name, enemy.kit, enemy.build)],
            round: 1, mode, busy: false, over: false, winner: null, pending: null, eventLog: ['Соперники вышли на арену.'] };
    }
    Kontakt.newBattle = newBattle;
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    Kontakt.clamp = clamp;
    function distance(a, b) { return Math.abs(a.x - b.x); }
    Kontakt.distance = distance;
    function chooseBot(bot, player) {
        if (bot.kneelTurns > 0)
            return 'recover';
        const dist = distance(bot, player), r = Math.random();
        if (dist > 420)
            return 'approach';
        if (bot.hp < 28 && r < .18)
            return 'retreat';
        if (bot.stamina < 20)
            return r < .55 ? 'guard' : 'approach';
        if (dist < 235 && r < .21)
            return 'throw';
        if (dist < 315 && r < .38)
            return 'elbow';
        if (dist < 355 && r < .51)
            return 'sweep';
        return r < .55 ? 'jaw' : r < .82 ? 'knee' : 'guard';
    }
    Kontakt.chooseBot = chooseBot;
    function initiative(f, m) { return Kontakt.MOVES[m].speed + (f.build === 'slim' ? 1.1 : 0) + Math.random() * 1.5; }
    Kontakt.initiative = initiative;
    function roll(f, def, m) {
        const d = Kontakt.MOVES[m];
        if (m === 'guard')
            return { hit: false, damage: 0, crit: false, blocked: false, interrupted: false, message: `${f.name} ставит блок.`, target: 'none', knockdown: false };
        if (m === 'recover')
            return { hit: false, damage: 0, crit: false, blocked: false, interrupted: false, message: `${f.name} поднимается и возвращает стойку.`, target: 'none', knockdown: false };
        if (m === 'approach' || m === 'retreat')
            return { hit: false, damage: 0, crit: false, blocked: false, interrupted: false, message: `${f.name} ${m === 'approach' ? 'сближается' : 'отступает'}.`, target: 'none', knockdown: false };
        const dist = distance(f, def);
        if (dist > d.reach)
            return { hit: false, damage: 0, crit: false, blocked: false, interrupted: false, message: `${f.name}: слишком далеко для «${d.label.toLowerCase()}»!`, target: d.target, knockdown: false };
        const tired = f.stamina < d.cost;
        const hitChance = clamp(d.chance - (tired ? .19 : 0) - (def.guard ? .13 : 0) + (def.kneelTurns > 0 ? .12 : 0), .2, .98);
        const hit = Math.random() < hitChance;
        const crit = hit && Math.random() < (.08 + (m === 'jaw' ? .12 : 0));
        const base = d.damage[0] + Math.random() * (d.damage[1] - d.damage[0]);
        let damage = hit ? Math.round(base * (crit ? 1.45 : 1) * (f.build === 'power' ? 1.13 : 1) * (tired ? .65 : 1) * (def.guard ? .40 : 1)) : 0;
        const knockdown = hit && m === 'sweep';
        let message = hit ? `${f.name}: ${d.label.toLowerCase()} — ${damage} урона${crit ? ' · КРИТ!' : ''}${def.guard ? ' · БЛОК' : ''}.` : `${f.name}: ${d.label.toLowerCase()} — промах.`;
        if (knockdown)
            message += ` ${def.name} опускается на колено!`;
        return { hit, damage, crit, blocked: !!def.guard, interrupted: false, message, target: d.target, knockdown };
    }
    Kontakt.roll = roll;
    function apply(state, actor, def, m, o) {
        if (m === 'guard') {
            actor.guard = true;
            actor.stamina = clamp(actor.stamina + 16, 0, 100);
            return;
        }
        if (m === 'recover') {
            actor.kneelTurns = 0;
            actor.pose = 'idle';
            actor.stamina = clamp(actor.stamina + 15, 0, 100);
            return;
        }
        if (m === 'approach' || m === 'retreat') {
            const step = m === 'approach' ? 85 : -75;
            const sign = Math.sign(def.x - actor.x);
            let nx = actor.x + sign * step;
            if (m === 'approach')
                nx = actor.x + sign * Math.min(85, Math.max(0, distance(actor, def) - 195));
            actor.x = clamp(nx, 215, 1065);
            actor.stamina = clamp(actor.stamina + 10, 0, 100);
            return;
        }
        actor.stamina = clamp(actor.stamina - Kontakt.MOVES[m].cost, 0, 100);
        if (!o.hit)
            return;
        def.hp = Math.max(0, def.hp - o.damage);
        def.hurt = 1;
        def.blood += 1;
        def.shirtBlood = clamp(def.shirtBlood + (m === 'knee' || m === 'throw' ? 3 : 2), 0, 14);
        def.faceBlood = clamp(def.faceBlood + (m === 'jaw' || m === 'elbow' ? 3 : 1), 0, 14);
        if (m === 'elbow' || m === 'throw')
            def.abrasions = clamp(def.abrasions + 2, 0, 12);
        if (m === 'jaw')
            def.bruises = clamp(def.bruises + 1, 0, 9);
        actor.gloveBlood = clamp(actor.gloveBlood + (m === 'jaw' || m === 'elbow' ? 4 : 2), 0, 14);
        if (m === 'sweep') {
            def.kneelTurns = 1;
            def.pose = 'kneel';
        }
        if (def.hp <= 0) {
            def.down = true;
            def.kneelTurns = 0;
        }
    }
    Kontakt.apply = apply;
})(Kontakt || (Kontakt = {}));
var Kontakt;
(function (Kontakt) {
    class AudioFX {
        constructor() {
            this.ctx = null;
            this.enabled = true;
        }
        init() { if (!this.enabled)
            return; try {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                this.ctx = AC ? new AC() : null;
            }
            void this.ctx?.resume();
        }
        catch (e) {
            console.warn(e);
        } }
        toggle() { this.enabled = !this.enabled; if (this.enabled)
            this.init(); return this.enabled; }
        tone(f, d, type, vol = .07, end) {
            const c = this.ctx;
            if (!this.enabled || !c)
                return;
            const osc = c.createOscillator(), g = c.createGain(), now = c.currentTime;
            osc.type = type;
            osc.frequency.setValueAtTime(f, now);
            osc.frequency.exponentialRampToValueAtTime(end || Math.max(40, f * .4), now + d);
            g.gain.setValueAtTime(vol, now);
            g.gain.exponentialRampToValueAtTime(.0001, now + d);
            osc.connect(g).connect(c.destination);
            osc.start(now);
            osc.stop(now + d + .02);
        }
        noise(d = .16, vol = .12, cutoff = 900) {
            const c = this.ctx;
            if (!c || !this.enabled)
                return;
            const len = Math.ceil(c.sampleRate * d), buf = c.createBuffer(1, len, c.sampleRate), a = buf.getChannelData(0);
            for (let i = 0; i < len; i++)
                a[i] = (Math.random() * 2 - 1) * (1 - i / len);
            const src = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain();
            src.buffer = buf;
            filter.type = 'lowpass';
            filter.frequency.value = cutoff;
            g.gain.value = vol;
            src.connect(filter).connect(g).connect(c.destination);
            src.start();
            src.stop(c.currentTime + d);
        }
        move(kind) {
            if (!this.enabled)
                return;
            if (kind === 'guard') {
                this.tone(250, .1, 'triangle', .045, 130);
                return;
            }
            if (kind === 'approach' || kind === 'retreat' || kind === 'recover') {
                this.noise(.075, .035, 450);
                return;
            }
            this.noise(.15, .05, 1800);
        }
        hit(crit = false) { this.noise(crit ? .36 : .23, crit ? .27 : .19, crit ? 640 : 850); this.tone(crit ? 190 : 160, .21, 'sawtooth', crit ? .14 : .1, 49); }
        miss() { this.noise(.09, .02, 2000); }
        finish() { this.tone(130, .55, 'sawtooth', .16, 42); this.noise(.54, .08, 390); }
    }
    Kontakt.AudioFX = AudioFX;
})(Kontakt || (Kontakt = {}));
var Kontakt;
(function (Kontakt) {
    function assetUrl(name) { return (window.__KONTAKT_ASSETS__ || {})[name] || 'assets/' + name; }
    Kontakt.assetUrl = assetUrl;
    const P = {
        idle: { face: [281, 106], shirt: [244, 217], glove: [344, 139], leg: [209, 357] },
        jaw: { face: [203, 120], shirt: [213, 216], glove: [424, 125], leg: [221, 345] },
        elbow: { face: [270, 101], shirt: [244, 204], glove: [394, 137], leg: [300, 358] },
        knee: { face: [229, 93], shirt: [228, 197], glove: [296, 127], leg: [253, 365] },
        sweep: { face: [204, 248], shirt: [246, 321], glove: [102, 451], leg: [384, 431] },
        kneel: { face: [308, 264], shirt: [316, 362], glove: [281, 455], leg: [357, 460] }
    };
    function rnd(i, s) { const v = Math.sin(i * 39.135 + s * 78.3) * 45758.55; return v - Math.floor(v); }
    function ellipse(ctx, x, y, rx, ry, color, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
    class ArenaView {
        constructor(host) {
            this.game = null;
            this.scene = null;
            this.mode = 'canvas';
            this.stageImg = new Image();
            this.images = {};
            this.sprites = [];
            this.shadows = [];
            this.spots = [];
            this.particles = [];
            this.shake = 0;
            this.flash = 0;
            this.last = 0;
            this.state = null;
            this.ready = false;
            this.W = 1280;
            this.H = 720;
            this.host = host;
            this.canvas = document.createElement('canvas');
            this.canvas.width = this.W;
            this.canvas.height = this.H;
            this.canvas.className = 'arena-render';
            this.fxCanvas = document.createElement('canvas');
            this.fxCanvas.width = this.W;
            this.fxCanvas.height = this.H;
            this.fxCanvas.className = 'arena-effects';
            this.ctx = this.canvas.getContext('2d', { alpha: false });
            this.fx = this.fxCanvas.getContext('2d');
            const ph = window.Phaser;
            if (ph) {
                try {
                    this.initPhaser(ph);
                    return;
                }
                catch (e) {
                    console.warn('WebGL/Phaser unavailable, switching to canvas', e);
                    this.host.innerHTML = '';
                }
            }
            this.initCanvas();
        }
        initCanvas() {
            this.mode = 'canvas';
            this.host.appendChild(this.canvas);
            this.ready = true;
            this.stageImg.src = assetUrl('arena.webp');
            for (const kit of ['a', 'b'])
                for (const pose of ['idle', 'jaw', 'elbow', 'knee', 'sweep', 'kneel']) {
                    const im = new Image();
                    this.images[`${kit}_${pose}`] = im;
                    im.src = assetUrl(`fighter_${kit}_${pose}.webp`);
                }
        }
        initPhaser(Phaser) {
            const self = this;
            this.mode = 'phaser';
            this.game = new Phaser.Game({ type: Phaser.AUTO, width: 1280, height: 720, parent: this.host,
                backgroundColor: '#0b121b', antialias: true, pixelArt: false, transparent: false,
                scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
                scene: { preload: function () {
                        this.load.image('arena', assetUrl('arena.webp'));
                        for (const k of ['a', 'b'])
                            for (const pose of ['idle', 'jaw', 'elbow', 'knee', 'sweep', 'kneel'])
                                this.load.image(`${k}_${pose}`, assetUrl(`fighter_${k}_${pose}.webp`));
                    }, create: function () {
                        self.scene = this;
                        this.add.image(640, 360, 'arena').setDisplaySize(1280, 720).setDepth(0);
                        for (let i = 0; i < 2; i++) {
                            const sh = this.add.ellipse(0, 658, 260, 32, 0x080e13, .56).setDepth(1);
                            self.shadows.push(sh);
                            const image = this.add.image(0, 666, 'a_idle').setOrigin(.5, 1).setDepth(2 + i);
                            self.sprites.push(image);
                        }
                        self.host.appendChild(self.fxCanvas);
                        self.ready = true;
                    }, update: function () { } } });
        }
        reset() { this.spots = []; this.particles = []; this.flash = 0; this.shake = 0; }
        impact(def, kind, hit, crit = false) {
            if (!hit)
                return;
            const y = kind === 'head' ? 338 : kind === 'body' ? 467 : 577;
            const x = def.x + def.facing * 30;
            this.shake = crit ? 17 : 10;
            this.flash = crit ? .21 : .10;
            const n = crit ? 36 : 24;
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 1.6 + (def.facing === 1 ? -Math.PI * .8 : -Math.PI * .35), v = 2 + Math.random() * 9;
                this.particles.push({ x, y, vx: Math.cos(a) * v, vy: -3 + Math.sin(a) * v, r: 1.2 + Math.random() * 3.5, life: 60 + Math.random() * 35, max: 90, red: true });
            }
            for (let i = 0; i < 5; i++)
                this.spots.push({ x: def.x + Math.random() * 160 - 80, y: 660 + Math.random() * 48, rx: 3 + Math.random() * 18, ry: 2 + Math.random() * 4, rot: Math.random(), alpha: .33 + Math.random() * .36 });
            if (this.spots.length > 170)
                this.spots.splice(0, 30);
        }
        woundOverlay(ctx, f) {
            const s = P[f.pose];
            ctx.save();
            ctx.translate(f.x + f.offsetX, f.down ? Math.min(700, 666 + f.offsetY) : 666 + f.offsetY);
            ctx.rotate(f.angle);
            ctx.scale(f.facing * (f.build === 'power' ? 1.06 : f.build === 'slim' ? .93 : 1), 1);
            ctx.translate(-232, -465);
            ctx.scale(464 / 512, 465 / 512);
            // orbital bruising - purple under visible eye, naturally layered into face
            for (let j = 0; j < f.bruises; j++) {
                const a = .19 + Math.min(.19, f.bruises * .04);
                ellipse(ctx, s.face[0] + 7 + j * .38, s.face[1] + 8, 18 + j * .8, 12 + j * .5, `rgba(49,20,83,${a})`, .08);
                ellipse(ctx, s.face[0] + 6, s.face[1] + 6, 8, 6, `rgba(66,33,101,${.22 + f.bruises * .035})`);
            }
            // superficial abrasions and reddish scratches
            for (let i = 0; i < f.abrasions; i++) {
                const x = s.face[0] - 6 + rnd(i, 2) * 28, y = s.face[1] + 11 + rnd(i, 6) * 23;
                ctx.strokeStyle = 'rgba(141,32,45,.72)';
                ctx.lineWidth = 1.8 + rnd(i, 1) * 1.7;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + 5 + rnd(i, 4) * 7, y + 3 + rnd(i, 8) * 7);
                ctx.stroke();
            }
            // chin blood, streaks accumulate and drip
            for (let i = 0; i < f.faceBlood; i++) {
                const x = s.face[0] - 2 + rnd(i, 17) * 21, y = s.face[1] + 17 + rnd(i, 5) * 10;
                ellipse(ctx, x, y, 2.8 + rnd(i, 3) * 3.1, 7 + rnd(i, 6) * 13, `rgba(155,19,31,${.5 + rnd(i, 9) * .32})`, rnd(i, 21) * .25);
            }
            // fabric stains with distinct pools and fine spatter
            for (let i = 0; i < f.shirtBlood; i++) {
                const x = s.shirt[0] - 40 + rnd(i, 12) * 76, y = s.shirt[1] - 45 + rnd(i, 24) * 88;
                ellipse(ctx, x, y, 8 + rnd(i, 21) * 15, 5 + rnd(i, 22) * 9, `rgba(104,12,23,${.43 + rnd(i, 42) * .31})`, rnd(i, 5) * 1.8);
                if (i % 2 === 0)
                    ellipse(ctx, x + 8, y + 6, 3, 4 + rnd(i, 3) * 5, 'rgba(189,34,44,.40)');
            }
            // blood on wrapped hands
            for (let i = 0; i < f.gloveBlood; i++) {
                const x = s.glove[0] - 11 + rnd(i, 7) * 23, y = s.glove[1] - 10 + rnd(i, 14) * 20;
                ellipse(ctx, x, y, 2.7 + rnd(i, 4) * 4, 3 + rnd(i, 8) * 5, `rgba(151,15,27,${.56 + rnd(i, 99) * .27})`);
            }
            ctx.restore();
        }
        drawGround(ctx) {
            for (const s of this.spots) {
                ellipse(ctx, s.x, s.y, s.rx, s.ry, `rgba(112,9,20,${s.alpha})`, s.rot);
            }
        }
        drawParticles(ctx, dt) {
            for (const p of this.particles) {
                p.life -= dt * .08;
                p.x += p.vx * dt / 16.7;
                p.y += p.vy * dt / 16.7;
                p.vy += .35 * dt / 16.7;
                if (p.y > 680 && p.vy > 0) {
                    p.life = 0;
                    this.spots.push({ x: p.x, y: Math.min(708, p.y), rx: p.r * 2, ry: 1 + rnd(p.x, 9) * 2, rot: 0, alpha: .28 });
                }
                if (p.life > 0)
                    ellipse(ctx, p.x, p.y, p.r, p.r * .85, `rgba(177,16,30,${Math.min(.9, p.life / 75)})`);
            }
            this.particles = this.particles.filter(x => x.life > 0 && x.x > 0 && x.x < 1280);
        }
        frame(state, t) {
            this.state = state;
            const dt = Math.min(34, t - (this.last || t));
            this.last = t;
            if (!this.ready)
                return;
            if (this.mode === 'phaser') {
                const sc = this.scene;
                for (const i of [0, 1]) {
                    const f = state.fighters[i], sprite = this.sprites[i];
                    if (!sprite)
                        continue;
                    const key = `${f.kit}_${f.pose}`;
                    if (sprite.texture.key !== key)
                        sprite.setTexture(key);
                    sprite.setPosition(f.x + f.offsetX, 666 + f.offsetY);
                    const w = 464 * (f.build === 'power' ? 1.06 : f.build === 'slim' ? .93 : 1);
                    sprite.setDisplaySize(w, 465);
                    sprite.setFlipX(f.facing === -1);
                    sprite.setRotation(f.angle);
                    this.shadows[i].setPosition(f.x + f.offsetX, 662).setAlpha(f.down ? .2 : .56);
                }
                const fx = this.fx;
                fx.setTransform(1, 0, 0, 1, 0, 0);
                fx.clearRect(0, 0, 1280, 720);
                if (this.shake > 1) {
                    sc.cameras.main.setScroll(Math.sin(t * .07) * this.shake * .2, Math.cos(t * .11) * this.shake * .1);
                }
                else
                    sc.cameras.main.setScroll(0, 0);
                this.drawGround(fx);
                for (const f of state.fighters)
                    this.woundOverlay(fx, f);
                this.drawParticles(fx, dt);
                if (this.flash > .01) {
                    fx.fillStyle = `rgba(255,237,212,${this.flash})`;
                    fx.fillRect(0, 0, 1280, 720);
                }
            }
            else {
                const ctx = this.ctx;
                ctx.clearRect(0, 0, 1280, 720);
                ctx.save();
                ctx.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake * .55);
                if (this.stageImg.complete && this.stageImg.naturalWidth)
                    ctx.drawImage(this.stageImg, 0, 0, 1280, 720);
                else {
                    ctx.fillStyle = '#15242d';
                    ctx.fillRect(0, 0, 1280, 720);
                }
                this.drawGround(ctx);
                for (const f of state.fighters) {
                    const width = 464 * (f.build === 'power' ? 1.06 : f.build === 'slim' ? .93 : 1);
                    ellipse(ctx, f.x + f.offsetX, 668, 115, .12 * width, 'rgba(3,8,12,.42)');
                    ctx.save();
                    ctx.translate(f.x + f.offsetX, 666 + f.offsetY);
                    ctx.rotate(f.angle);
                    ctx.scale(f.facing, 1);
                    const img = this.images[`${f.kit}_${f.pose}`];
                    if (img?.complete && img.naturalWidth)
                        ctx.drawImage(img, -width / 2, -465, width, 465);
                    ctx.restore();
                    this.woundOverlay(ctx, f);
                }
                this.drawParticles(ctx, dt);
                if (this.flash > .01) {
                    ctx.fillStyle = `rgba(255,237,212,${this.flash})`;
                    ctx.fillRect(0, 0, 1280, 720);
                }
                ctx.restore();
            }
            this.shake *= .83;
            this.flash *= .77;
        }
    }
    Kontakt.ArenaView = ArenaView;
})(Kontakt || (Kontakt = {}));
var Kontakt;
(function (Kontakt) {
    const q = (selector) => document.querySelector(selector);
    const stage = q('#stage');
    const view = new Kontakt.ArenaView(stage);
    const audio = new Kontakt.AudioFX();
    let battle = Kontakt.newBattle('ai', { name: 'РЭЙНА', kit: 'a', build: 'athletic' }, { name: 'СЭЙБЛ', kit: 'b', build: 'power' });
    let selectedKit = 'a', selectedBuild = 'athletic', selectedMode = 'ai';
    let roundRunning = false;
    let hitStopMs = 92;
    function say(message, highlight = false) {
        const area = q('#combatLog');
        const n = document.createElement('div');
        n.className = 'log-entry' + (highlight ? ' hot' : '');
        n.textContent = message;
        area.prepend(n);
        while (area.children.length > 8)
            area.lastElementChild?.remove();
    }
    function setBar(id, pct) { const e = q(id); e.style.width = Kontakt.clamp(pct, 0, 100) + '%'; }
    function setText(id, t) { q(id).textContent = t; }
    function updateHUD() {
        const [p1, p2] = battle.fighters;
        for (const [f, i] of [[p1, 1], [p2, 2]]) {
            setText(`#name${i}`, f.name);
            setText(`#hpText${i}`, `${f.hp} / ${f.maxHp}`);
            setText(`#stText${i}`, `${Math.round(f.stamina)} EN`);
            setBar(`#hp${i}`, 100 * f.hp / f.maxHp);
            setBar(`#st${i}`, f.stamina);
            setText(`#damage${i}`, f.bruises + f.abrasions + f.faceBlood > 0 ? `ТРАВМЫ · ${f.bruises} СИН. / ${f.abrasions} ССАД.` : 'БЕЗ ПОВРЕЖДЕНИЙ');
        }
        setText('#round', String(battle.round).padStart(2, '0'));
        setText('#distance', `${Math.round(Kontakt.distance(p1, p2))} PX`);
        setText('#modeLabel', battle.mode === 'ai' ? 'VS CPU' : '2 ИГРОКА');
        const kneeler = p1.kneelTurns > 0 ? p1 : p2.kneelTurns > 0 ? p2 : null;
        const status = battle.over ? 'БОЙ ЗАВЕРШЁН' : kneeler ? `${kneeler.name}: НА КОЛЕНЕ` : (battle.busy ? 'ОБМЕН УДАРАМИ' : 'ВЫБЕРИ ПРИЁМ');
        setText('#statusText', status);
    }
    function updateButtons() {
        const active = battle.mode === 'local' && battle.pending ? battle.fighters[1] : battle.fighters[0];
        const kneeling = active.kneelTurns > 0;
        document.querySelectorAll('[data-move]').forEach(b => {
            b.disabled = battle.busy || battle.over || (kneeling && b.dataset.move !== 'recover') || (!kneeling && b.dataset.move === 'recover');
        });
        const recover = q('#recoverButton');
        recover.hidden = !kneeling;
        const turn = battle.mode === 'local' && battle.pending ? 'ИГРОК 2' : battle.mode === 'local' ? 'ИГРОК 1' : 'ТВОЙ ХОД';
        setText('#turnActor', kneeling ? 'ВОССТАНОВЛЕНИЕ СТОЙКИ' : turn);
        setText('#turnHelp', kneeling ? `${active.name} потерял равновесие. Подъём занимает весь ход.` :
            battle.mode === 'local' && battle.pending ? 'Приём первого игрока скрыт. Выбери ответ.' : 'Выбери удар, защиту или движение.');
        updateHUD();
    }
    function resetBattle() {
        const name = (q('#fighterName').value || 'РЭЙНА').trim().slice(0, 16) || 'РЭЙНА';
        const rivalKit = selectedKit === 'a' ? 'b' : 'a';
        battle = Kontakt.newBattle(selectedMode, { name, kit: selectedKit, build: selectedBuild }, { name: rivalKit === 'b' ? 'СЭЙБЛ' : 'РЭЙНА', kit: rivalKit, build: 'power' });
        audio.init();
        view.reset();
        roundRunning = false;
        q('#intro').classList.add('is-hidden');
        q('#gameOver').classList.add('is-hidden');
        q('#combatLog').replaceChildren();
        say('Бойцы на арене. Первый раунд.');
        updateButtons();
    }
    const delay = (ms) => new Promise(r => window.setTimeout(r, ms));
    function animate(duration, onUpdate) {
        return new Promise(resolve => { const t0 = performance.now(); function tick(now) { const p = Kontakt.clamp((now - t0) / duration, 0, 1); onUpdate(p); if (p >= 1)
            resolve();
        else
            requestAnimationFrame(tick); } requestAnimationFrame(tick); });
    }
    function approachTarget(a, b, move) {
        const step = move === 'approach' ? Math.min(85, Math.max(0, Kontakt.distance(a, b) - 195)) : -75;
        return Kontakt.clamp(a.x + Math.sign(b.x - a.x) * step, 215, 1065);
    }
    async function playAction(actor, def, move) {
        const data = Kontakt.MOVES[move];
        const result = Kontakt.roll(actor, def, move);
        const startX = actor.x, endX = (move === 'approach' || move === 'retreat') ? approachTarget(actor, def, move) : startX;
        let contacted = false;
        const dur = move === 'sweep' ? 880 : move === 'throw' ? 920 : move === 'recover' ? 650 : move === 'guard' ? 510 : move === 'approach' || move === 'retreat' ? 550 : 760;
        const lunge = (move === 'jaw' ? 88 : move === 'elbow' ? 52 : move === 'knee' ? 52 : move === 'sweep' ? 70 : move === 'throw' ? 76 : 0);
        audio.move(move);
        await animate(dur + (result.hit ? hitStopMs : 0), (r) => {
            const p = r >= .53 ? Math.max(0, (r * dur + hitStopMs) / (dur + hitStopMs)) : r * (dur + hitStopMs) / dur;
            const z = Kontakt.clamp(p, 0, 1);
            actor.pose = (z > .18 && z < .77) ? data.pose : (actor.kneelTurns > 0 ? 'kneel' : 'idle');
            if (move === 'recover')
                actor.pose = z < .6 ? 'kneel' : 'idle';
            if (move === 'guard')
                actor.pose = 'idle';
            if (move === 'approach' || move === 'retreat')
                actor.offsetX = (endX - startX) * (z * z * (3 - 2 * z));
            else
                actor.offsetX = Math.sign(def.x - actor.x) * lunge * Math.sin(Math.PI * Kontakt.clamp((z - .1) / .78, 0, 1));
            actor.offsetY = (move === 'knee' ? -5 * Math.sin(Math.PI * z) : move === 'sweep' ? 28 * Math.sin(Math.PI * z) : 0);
            if (move === 'sweep')
                actor.angle = -actor.facing * .025 * Math.sin(Math.PI * z);
            if (!contacted && z >= .5) {
                contacted = true;
                if (move !== 'approach' && move !== 'retreat')
                    Kontakt.apply(battle, actor, def, move, result);
                if (result.hit) {
                    if (move !== 'guard' && move !== 'approach' && move !== 'retreat') {
                        def.offsetX = Math.sign(def.x - actor.x) * (result.crit ? 45 : 26);
                        def.offsetY = move === 'sweep' ? 34 : move === 'throw' ? 20 : 0;
                        if (move === 'throw')
                            def.angle = -def.facing * .63;
                        if (result.knockdown)
                            def.pose = 'kneel';
                        view.impact(def, result.target, true, result.crit);
                        audio.hit(result.crit);
                    }
                }
                else if (!['guard', 'approach', 'retreat', 'recover'].includes(move))
                    audio.miss();
                updateHUD();
                say(result.message, result.hit);
            }
            if (contacted && z > .56) {
                const back = (1 - Kontakt.clamp((z - .56) / .42, 0, 1));
                if (!def.down) {
                    def.offsetX *= Math.max(.15, back);
                    if (move !== 'sweep' && move !== 'throw')
                        def.offsetY *= back;
                    def.angle *= back;
                }
            }
        });
        actor.offsetX = 0;
        actor.offsetY = 0;
        actor.angle = 0;
        if (move === 'approach' || move === 'retreat') {
            actor.x = endX;
            actor.stamina = Kontakt.clamp(actor.stamina + 10, 0, 100);
            actor.offsetX = 0;
        }
        actor.pose = actor.kneelTurns > 0 ? 'kneel' : 'idle';
        if (!def.down) {
            def.offsetX = 0;
            def.angle = 0;
            def.offsetY = 0;
            def.pose = def.kneelTurns > 0 ? 'kneel' : 'idle';
        }
    }
    async function fallKO(f) {
        f.pose = 'kneel';
        audio.finish();
        say(`${f.name} падает на настил. НОКАУТ!`, true);
        await animate(950, p => {
            const ease = 1 - Math.pow(1 - p, 3);
            f.angle = -f.facing * 1.42 * ease;
            f.offsetX = f.facing * -95 * ease;
            f.offsetY = 100 * Math.sin(Math.PI * .5 * ease);
        });
    }
    async function doRound(first, second) {
        if (roundRunning)
            return;
        roundRunning = true;
        battle.busy = true;
        updateButtons();
        for (const f of battle.fighters)
            f.guard = false;
        const jobs = [
            [battle.fighters[0], battle.fighters[1], first],
            [battle.fighters[1], battle.fighters[0], second]
        ];
        jobs.sort((a, b) => Kontakt.initiative(b[0], b[2]) - Kontakt.initiative(a[0], a[2]));
        for (const [actor, def, move] of jobs) {
            if (actor.down || def.down)
                break;
            if (actor.kneelTurns > 0 && move !== 'recover') {
                // A successful sweep has interrupted the already committed action.
                say(`${actor.name} теряет атаку: сбит с ног.`, true);
                continue;
            }
            await playAction(actor, def, move);
            if (actor.down || def.down)
                break;
            await delay(110);
        }
        for (const f of battle.fighters)
            f.stamina = Kontakt.clamp(f.stamina + 8, 0, 100);
        const [p1, p2] = battle.fighters;
        if (p1.down || p2.down) {
            battle.over = true;
            battle.winner = p1.down && p2.down ? null : p1.down ? 1 : 0;
            await fallKO(p1.down ? p1 : p2);
            setText('#winner', battle.winner === null ? 'НИЧЬЯ' : `ПОБЕДИЛ ${battle.fighters[battle.winner].name}`);
            q('#gameOver').classList.remove('is-hidden');
            setText('#winnerDetails', `Раундов: ${battle.round}. Получено повреждений: ${p1.blood + p2.blood}.`);
        }
        else
            battle.round++;
        battle.busy = false;
        roundRunning = false;
        updateButtons();
    }
    function chooseMove(move) {
        if (battle.busy || battle.over || roundRunning)
            return;
        audio.init();
        const p1 = battle.fighters[0], p2 = battle.fighters[1];
        if (battle.mode === 'local' && !battle.pending) {
            battle.pending = p1.kneelTurns > 0 ? 'recover' : move;
            say('Игрок 1 выбрал приём. Передай управление игроку 2.');
            updateButtons();
            return;
        }
        const first = battle.mode === 'local' ? (battle.pending || 'guard') : (p1.kneelTurns > 0 ? 'recover' : move);
        const second = battle.mode === 'local' ? (p2.kneelTurns > 0 ? 'recover' : move) : Kontakt.chooseBot(p2, p1);
        battle.pending = null;
        void doRound(first, second);
    }
    // UI
    document.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => chooseMove(b.dataset.move)));
    document.querySelectorAll('[data-kit]').forEach(b => b.addEventListener('click', () => {
        selectedKit = b.dataset.kit;
        document.querySelectorAll('[data-kit]').forEach(el => el.classList.toggle('chosen', el === b));
        q('#introFighter').src = Kontakt.assetUrl(`fighter_${selectedKit}_idle.webp`);
    }));
    document.querySelectorAll('[data-build]').forEach(b => b.addEventListener('click', () => {
        selectedBuild = b.dataset.build;
        document.querySelectorAll('[data-build]').forEach(el => el.classList.toggle('chosen', el === b));
    }));
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
        selectedMode = b.dataset.mode;
        document.querySelectorAll('[data-mode]').forEach(el => el.classList.toggle('chosen', el === b));
    }));
    q('#startButton').addEventListener('click', resetBattle);
    q('#rematch').addEventListener('click', resetBattle);
    q('#editButton').addEventListener('click', () => { if (roundRunning)
        return; q('#intro').classList.remove('is-hidden'); });
    q('#soundButton').addEventListener('click', () => { const enabled = audio.toggle(); setText('#soundButton', enabled ? 'ЗВУК: ВКЛ' : 'ЗВУК: ВЫКЛ'); });
    document.addEventListener('keydown', (e) => {
        if (e.target instanceof HTMLInputElement)
            return;
        if (!q('#intro').classList.contains('is-hidden'))
            return;
        const seq = ['jaw', 'elbow', 'knee', 'sweep', 'throw', 'guard', 'approach', 'retreat'];
        if (/^[1-8]$/.test(e.key)) {
            e.preventDefault();
            chooseMove(seq[Number(e.key) - 1]);
        }
        if (e.key.toLowerCase() === 'r') {
            chooseMove('recover');
        }
    });
    const render = (t) => { view.frame(battle, t); requestAnimationFrame(render); };
    requestAnimationFrame(render);
    updateHUD();
    updateButtons();
    window.__KONTAKT_DEBUG = {
        battle: () => battle, view: () => view, choose: (move) => chooseMove(move), start: resetBattle,
        setHP: (id, hp) => { battle.fighters[id].hp = hp; updateHUD(); },
        forceKneel: (id) => { const f = battle.fighters[id]; f.kneelTurns = 1; f.pose = 'kneel'; updateButtons(); },
        version: '0.6.0'
    };
})(Kontakt || (Kontakt = {}));
