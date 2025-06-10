const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_WIDTH = canvas.width; // 1200
const GAME_HEIGHT = canvas.height; // 600
const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = GAME_HEIGHT;

const PLAYER_SPEED = 2;
const SPRINT_MULTIPLIER = 1.5;
const PLAYER_JUMP_STRENGTH = 14;
const GRAVITY = 0.5;

// Load images
const images = {};
const imageSources = {
    idle: 'assets/images/turtle-idle.png',
    walk1: 'assets/images/turtle-walk1.png',
    walk2: 'assets/images/turtle-walk2.png',
    jump: 'assets/images/turtle-jump.png',
    punch: 'assets/images/turtle-punch.png',
    enemy: 'assets/images/bad-turtle.png',
    enemyWalk1: 'assets/images/Bad-turtle-walk1.png',
    enemyWalk2: 'assets/images/Bad-turtle-walk2.png',
    boss: 'assets/images/boss.png',
    bossWalk1: 'assets/images/boss-walk1.png',
    bossWalk2: 'assets/images/boss-walk2.png',
    coin: 'assets/images/coin.png',
    background: 'assets/images/background.png',
    ground: 'assets/images/ground.png',
    platform: 'assets/images/platform.png',
    coinIcon: 'assets/images/coin-icon.png',
    lifeIcon: 'assets/images/life-icon.png'
};

const loadImages = () => {
    const promises = Object.keys(imageSources).map(key => {
        return new Promise((resolve) => {
            images[key] = new Image();
            images[key].src = imageSources[key];
            images[key].onload = () => resolve();
            images[key].onerror = () => {
                console.error(`Failed to load image: ${imageSources[key]}`);
                alert(`Failed to load ${key} image. Check file paths.`);
                resolve();
            };
        });
    });
    return Promise.all(promises);
};

// Load audio
const sounds = {};
const soundSources = {
    jump: 'assets/audio/jump.wav',
    punch: 'assets/audio/punch.wav',
    collectCoin: 'assets/audio/collect-coin.wav',
    gameOver: 'assets/audio/game-over.wav',
    background: 'assets/audio/Turtle-Trouble-Theme.mp3',
    bosstrack: 'assets/audio/bosstrack.mp3'
};

let isMusicOn = true;
let isSoundEffectsOn = true;

const loadSounds = () => {
    Object.keys(soundSources).forEach(key => {
        sounds[key] = new Audio(soundSources[key]);
        if (key === 'background' || key === 'bosstrack') {
            sounds[key].loop = true;
            sounds[key].volume = key === 'background' ? 0.4 : 0.6;
        } else {
            sounds[key].volume = 1.0;
        }
    });
};

// Pause and debug
let paused = false;
let debug = false;

document.getElementById('pauseButton').addEventListener('click', () => {
    paused = !paused;
    document.getElementById('pauseButton').textContent = paused ? 'Resume' : 'Pause';
    if (paused && isMusicOn) {
        sounds.background.pause();
        if (bossActive && sounds.bosstrack) sounds.bosstrack.pause();
    } else if (!paused && isMusicOn) {
        if (bossActive && sounds.bosstrack) {
            sounds.bosstrack.play().catch(err => console.error(err));
        } else {
            sounds.background.play().catch(err => console.error(err));
        }
    }
});

// Input handling
const keys = {
    left: false,
    right: false,
    up: false,
    punch: false,
    sprint: false
};

document.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'KeyA': keys.left = true; break;
        case 'KeyD': keys.right = true; break;
        case 'KeyW':
        case 'Space': keys.up = true; break;
        case 'ControlLeft':
        case 'ControlRight':
            if (!keys.punch) {
                keys.punch = true;
                player.initiatePunch();
            }
            break;
        case 'ShiftLeft':
        case 'ShiftRight': keys.sprint = true; break;
        case 'F1': debug = !debug; break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'KeyA': keys.left = false; break;
        case 'KeyD': keys.right = false; break;
        case 'KeyW':
        case 'Space': keys.up = false; break;
        case 'ControlLeft':
        case 'ControlRight': keys.punch = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': keys.sprint = false; break;
    }
});

// Particle Class
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.alpha = 1;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.03;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Platform {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw(cameraX) {
        ctx.drawImage(images.platform, this.x - cameraX, this.y, this.width, this.height);
    }
}

class Player {
    constructor() {
        this.startX = 100;
        this.startY = GAME_HEIGHT - images.ground.height - 50;
        this.x = this.startX;
        this.y = this.startY;
        this.width = 50;
        this.height = 50;
        this.vx = 0;
        this.vy = 0;
        this.speed = PLAYER_SPEED;
        this.jumpStrength = PLAYER_JUMP_STRENGTH;
        this.gravity = GRAVITY;
        this.onGround = false;
        this.state = 'idle';
        this.animationFrame = 0;
        this.frameCount = 0;
        this.coinsCollected = 0;
        this.facing = 'right';
        this.lives = 3;

        this.isPunching = false;
        this.punchDuration = 500;
        this.punchCooldownDuration = 750;
        this.punchStartTime = 0;
        this.punchCooldownEndTime = 0;

        this.isSprinting = false;
        this.stamina = 100;
        this.maxStamina = 100;
        this.staminaDepletionRate = 100 / 1.5; // Depletes in 1.5 seconds
        this.staminaRechargeRate = 100 / 3;    // Recharges in 3 seconds

        this.isInvincible = false;
        this.invincibilityDuration = 2000;
        this.invincibilityStartTime = 0;
    }

    initiatePunch() {
        if (!this.isPunching && performance.now() >= this.punchCooldownEndTime) {
            this.isPunching = true;
            this.state = 'punching';
            this.punchStartTime = performance.now();
            if (isSoundEffectsOn && sounds.punch) sounds.punch.play();
        }
    }

    update(deltaTime, currentTime) {
        // Sprinting and stamina logic (only affected by Shift)
        if (keys.sprint && this.stamina > 0) {
            this.isSprinting = true;
            this.speed = PLAYER_SPEED * SPRINT_MULTIPLIER;
            this.stamina -= this.staminaDepletionRate * (deltaTime / 1000);
            if (this.stamina < 0) this.stamina = 0;
        } else {
            this.isSprinting = false;
            this.speed = PLAYER_SPEED;
            if (this.stamina < this.maxStamina) {
                this.stamina += this.staminaRechargeRate * (deltaTime / 1000);
                if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
            }
        }

        if (keys.left) {
            this.vx = -this.speed;
            this.facing = 'left';
            if (this.onGround && !this.isPunching) this.state = 'walking';
        } else if (keys.right) {
            this.vx = this.speed;
            this.facing = 'right';
            if (this.onGround && !this.isPunching) this.state = 'walking';
        } else {
            this.vx = 0;
            if (this.onGround && !this.isPunching) this.state = 'idle';
        }

        if (keys.up && this.onGround) {
            this.vy = -this.jumpStrength;
            this.onGround = false;
            this.state = 'jumping';
            if (isSoundEffectsOn && sounds.jump) sounds.jump.play();
        }

        if (this.isPunching && currentTime - this.punchStartTime >= this.punchDuration) {
            this.isPunching = false;
            this.punchCooldownEndTime = currentTime + this.punchCooldownDuration;
            this.state = (this.vx === 0) ? 'idle' : 'walking';
        }

        if (this.isInvincible && currentTime - this.invincibilityStartTime >= this.invincibilityDuration) {
            this.isInvincible = false;
        }

        this.vy += this.gravity;
        this.y += this.vy;
        this.x += this.vx;

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > WORLD_WIDTH) this.x = WORLD_WIDTH - this.width;
    }

    draw(cameraX) {
        let img;
        switch(this.state) {
            case 'idle': img = images.idle; break;
            case 'walking': img = this.animationFrame === 0 ? images.walk1 : images.walk2; break;
            case 'jumping': img = images.jump; break;
            case 'punching': img = images.punch; break;
            default: img = images.idle;
        }

        ctx.save();
        if (this.isInvincible) {
            ctx.globalAlpha = (Math.floor(currentTime / 200) % 2 === 0) ? 0.5 : 1;
        }
        if (this.facing === 'left') {
            ctx.translate(this.x - cameraX + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(img, this.x - cameraX, this.y, this.width, this.height);
        }
        ctx.restore();

        if (this.state === 'walking') {
            this.frameCount += 1;
            if (this.frameCount >= 10) {
                this.frameCount = 0;
                this.animationFrame = (this.animationFrame + 1) % 2;
            }
        } else {
            this.frameCount = 0;
            this.animationFrame = 0;
        }

        if (debug) {
            ctx.strokeStyle = 'red';
            ctx.strokeRect(this.x - cameraX, this.y, this.width, this.height);
        }
    }

    resetToCamera() {
        this.x = cameraX + 50;
        this.y = GAME_HEIGHT - images.ground.height - this.height;
        this.vx = 0;
        this.vy = 0;
        this.onGround = true;
        this.state = 'idle';
        this.isInvincible = true;
        this.invincibilityStartTime = performance.now();
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 50;
        this.vx = 0;
        this.vy = 0;
        this.alive = true;
        this.speed = 1.5;
        this.state = 'idle';
        this.animationFrame = 0;
        this.frameCount = 0;
        this.facing = 'right';
        this.chaseDistance = 250;
        this.stopChaseDistance = 300;
    }

    initiateChase(playerX) {
        this.state = 'chasing';
        if (playerX < this.x) {
            this.vx = -this.speed;
            this.facing = 'left';
        } else {
            this.vx = this.speed;
            this.facing = 'right';
        }
    }

    stopChase() {
        this.state = 'idle';
        this.vx = 0;
    }

    updateChase(playerX, playerY, deltaTime) {
        if (!this.alive) return;
        const distance = Math.abs(playerX - this.x);

        if (this.state === 'idle' && distance <= this.chaseDistance) {
            this.initiateChase(playerX);
        } else if (this.state === 'chasing' && distance > this.stopChaseDistance) {
            this.stopChase();
        } else if (this.state === 'chasing') {
            if (playerX < this.x) {
                this.vx = -this.speed;
                this.facing = 'left';
            } else {
                this.vx = this.speed;
                this.facing = 'right';
            }
        }

        this.vy += GRAVITY;
        this.y += this.vy;
        this.x += this.vx;

        if (this.x < 0) {
            this.x = 0;
            this.vx = this.speed;
            this.facing = 'right';
        }
        if (this.x + this.width > WORLD_WIDTH) {
            this.x = WORLD_WIDTH - this.width;
            this.vx = -this.speed;
            this.facing = 'left';
        }

        this.frameCount += 1;
        if (this.frameCount >= 15) {
            this.frameCount = 0;
            this.animationFrame = (this.animationFrame + 1) % 2;
        }
    }

    draw(cameraX) {
        if (!this.alive) return;
        let img = (this.state === 'chasing') ? 
            (this.animationFrame === 0 ? images.enemyWalk1 : images.enemyWalk2) : 
            images.enemy;

        ctx.save();
        if (this.facing === 'left') {
            ctx.translate(this.x - cameraX + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(img, this.x - cameraX, this.y, this.width, this.height);
        }
        ctx.restore();

        if (debug) {
            ctx.strokeStyle = 'yellow';
            ctx.strokeRect(this.x - cameraX, this.y, this.width, this.height);
        }
    }
}

class Boss {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 150;
        this.height = 150;
        this.vx = 0;
        this.vy = 0;
        this.alive = true;
        this.speed = 2.5;
        this.state = 'chasing';
        this.animationFrame = 0;
        this.frameCount = 0;
        this.facing = 'left';
        this.maxHealth = 10;
        this.health = this.maxHealth;
        this.runAwayDuration = 2000;
        this.runAwayStartTime = null;
        this.jumpCooldown = 3000;
        this.lastJumpTime = 0;

        this.hitBox = { xOffset: 45, yOffset: 45, width: 60, height: 60 };
    }

    update(deltaTime, playerX) {
        if (!this.alive) return;

        if (this.state === 'chasing') {
            if (playerX < this.x) {
                this.vx = -this.speed;
                this.facing = 'left';
            } else {
                this.vx = this.speed;
                this.facing = 'right';
            }
            if (Math.random() < 0.02 && performance.now() - this.lastJumpTime >= this.jumpCooldown) {
                this.vy = -12;
                this.lastJumpTime = performance.now();
            }
        } else if (this.state === 'runningAway' && 
            performance.now() - this.runAwayStartTime >= this.runAwayDuration) {
            this.state = 'chasing';
            this.vx = playerX < this.x ? -this.speed : this.speed;
            this.facing = playerX < this.x ? 'left' : 'right';
        }

        this.vy += GRAVITY;
        this.y += this.vy;
        this.x += this.vx;

        if (this.x < 0) {
            this.x = 0;
            this.vx = this.speed;
            this.facing = 'right';
        }
        if (this.x + this.width > WORLD_WIDTH) {
            this.x = WORLD_WIDTH - this.width;
            this.vx = -this.speed;
            this.facing = 'left';
        }

        this.frameCount += 1;
        if (this.frameCount >= 20) {
            this.frameCount = 0;
            this.animationFrame = (this.animationFrame + 1) % 2;
        }
    }

    runAway() {
        this.state = 'runningAway';
        this.vx = this.facing === 'left' ? this.speed : -this.speed;
        this.runAwayStartTime = performance.now();
    }

    draw(cameraX) {
        if (!this.alive) return;
        let img = (this.state === 'chasing' || this.state === 'runningAway') ?
            (this.animationFrame === 0 ? images.bossWalk1 : images.bossWalk2) :
            images.boss;

        ctx.save();
        if (this.facing === 'left') {
            ctx.translate(this.x - cameraX + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(img, this.x - cameraX, this.y, this.width, this.height);
        }
        ctx.restore();

        if (debug) {
            const hitBox = this.getHitBox();
            ctx.strokeStyle = 'purple';
            ctx.strokeRect(hitBox.x - cameraX, hitBox.y, hitBox.width, hitBox.height);
        }
    }

    getHitBox() {
        return {
            x: this.x + this.hitBox.xOffset,
            y: this.y + this.hitBox.yOffset,
            width: this.hitBox.width,
            height: this.hitBox.height
        };
    }
}

class Coin {
    constructor(x, y) {
        this.x = x;
        this.baseY = y;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.collected = false;
        this.bobHeight = 10;
        this.bobSpeed = 0.05;
        this.bobAngle = 0;
    }

    update() {
        this.bobAngle += this.bobSpeed;
        this.y = this.baseY + Math.sin(this.bobAngle) * this.bobHeight;
    }

    draw(cameraX) {
        if (!this.collected) {
            ctx.drawImage(images.coin, this.x - cameraX, this.y, this.width, this.height);
        }
    }
}

let player;
let enemies = [];
let coins = [];
let platforms = [];
let boss = null;
let bossActive = false;
let gameOver = false;
let win = false;
let particles = [];
let cameraX = 0;

const DEADZONE_WIDTH = 200;
const DEADZONE_RIGHT_BOUND = GAME_WIDTH - DEADZONE_WIDTH;

function init() {
    player = new Player();

    platforms.push(new Platform(400, GAME_HEIGHT - 150, 150, 20));
    platforms.push(new Platform(700, GAME_HEIGHT - 220, 200, 20));
    platforms.push(new Platform(1000, GAME_HEIGHT - 180, 170, 20));
    platforms.push(new Platform(1300, GAME_HEIGHT - 150, 150, 20));
    platforms.push(new Platform(1600, GAME_HEIGHT - 180, 170, 20));
    platforms.push(new Platform(2000, GAME_HEIGHT - 150, 150, 20));
    platforms.push(new Platform(2500, GAME_HEIGHT - 220, 200, 20));
    platforms.push(new Platform(3000, GAME_HEIGHT - 180, 170, 20));
    platforms.push(new Platform(3500, GAME_HEIGHT - 150, 150, 20));
    platforms.push(new Platform(4000, GAME_HEIGHT - 180, 170, 20));

    enemies.push(new Enemy(500, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(800, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(1100, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(1300, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(1600, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(2000, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(2500, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(3000, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(3500, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(4000, GAME_HEIGHT - images.ground.height - 50));

    coins.push(new Coin(250, GAME_HEIGHT - images.ground.height - 100));
    coins.push(new Coin(450, GAME_HEIGHT - images.ground.height - 80));
    coins.push(new Coin(650, GAME_HEIGHT - images.ground.height - 60));
    coins.push(new Coin(420, GAME_HEIGHT - 180));
    coins.push(new Coin(750, GAME_HEIGHT - 250));
    coins.push(new Coin(1020, GAME_HEIGHT - 210));
    coins.push(new Coin(1320, GAME_HEIGHT - 180));
    coins.push(new Coin(1650, GAME_HEIGHT - 200));
    coins.push(new Coin(1850, GAME_HEIGHT - 100));
    coins.push(new Coin(2050, GAME_HEIGHT - 180));
    coins.push(new Coin(2250, GAME_HEIGHT - 100));
    coins.push(new Coin(2450, GAME_HEIGHT - 240));
    coins.push(new Coin(2650, GAME_HEIGHT - 120));
    coins.push(new Coin(2850, GAME_HEIGHT - 200));
    coins.push(new Coin(3050, GAME_HEIGHT - 220));
    coins.push(new Coin(3250, GAME_HEIGHT - 160));
    coins.push(new Coin(3450, GAME_HEIGHT - 120));
    coins.push(new Coin(3650, GAME_HEIGHT - 180));
    coins.push(new Coin(3850, GAME_HEIGHT - 100));
    coins.push(new Coin(4050, GAME_HEIGHT - 140));
}

function createParticle(x, y, color = '#FFD700') {
    for (let i = 0; i < 5; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].alpha <= 0) particles.splice(i, 1);
  
