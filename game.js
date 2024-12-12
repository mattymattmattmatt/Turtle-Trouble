// game.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game dimensions
const GAME_WIDTH = canvas.width; // 1200
const GAME_HEIGHT = canvas.height; // 600

// World dimensions
const WORLD_WIDTH = 5000; // Total width of the game world in pixels
const WORLD_HEIGHT = GAME_HEIGHT; // Matches the canvas height

// Game settings
const PLAYER_SPEED = 2; // Normal walking speed
const SPRINT_MULTIPLIER = 1.5; // Sprint speed multiplier
const PLAYER_JUMP_STRENGTH = 12; // Jump strength
const GRAVITY = 0.5; // Gravity strength

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
    coin: 'assets/images/coin.png',
    background: 'assets/images/background.png',
    ground: 'assets/images/ground.png',
    platform: 'assets/images/platform.png',
    coinIcon: 'assets/images/coin-icon.png',
    lifeIcon: 'assets/images/life-icon.png' // Life icon for HUD
};

// Load all images using Promises
const loadImages = () => {
    const promises = Object.keys(imageSources).map(key => {
        return new Promise((resolve) => {
            images[key] = new Image();
            images[key].src = imageSources[key];
            images[key].onload = () => resolve();
            images[key].onerror = () => {
                console.error(`Failed to load image: ${imageSources[key]}`);
                resolve(); // Resolve even if an image fails to load
            };
        });
    });
    return Promise.all(promises);
};

// Load audio (Including Background Music)
const sounds = {};
const soundSources = {
    jump: 'assets/audio/jump.wav',
    punch: 'assets/audio/punch.wav',
    collectCoin: 'assets/audio/collect-coin.wav',
    gameOver: 'assets/audio/game-over.wav',
    background: 'assets/audio/Turtle-Trouble-Theme.mp3' // Background Music
};

// Flags to track audio settings
let isMusicOn = true;
let isSoundEffectsOn = true;

// Load all sounds
const loadSounds = () => {
    Object.keys(soundSources).forEach(key => {
        sounds[key] = new Audio(soundSources[key]);
        if (key === 'background') {
            sounds[key].loop = true; // Loop the background music
            sounds[key].volume = 0.4; // Set volume to 40%
        } else {
            sounds[key].volume = 1.0; // Default volume for sound effects
        }
    });
};

// Pause functionality
let paused = false;

document.getElementById('pauseButton').addEventListener('click', () => {
    paused = !paused;
    document.getElementById('pauseButton').textContent = paused ? 'Resume' : 'Pause';
});

// Handle user input
const keys = {
    left: false,
    right: false,
    up: false,
    punch: false,
    sprint: false
};

document.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'KeyA':
            keys.left = true;
            break;
        case 'KeyD':
            keys.right = true;
            break;
        case 'KeyW':
        case 'Space':
            keys.up = true;
            break;
        case 'ControlLeft':
        case 'ControlRight':
            if (!keys.punch) {
                keys.punch = true;
                player.initiatePunch();
            }
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.sprint = true;
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'KeyA':
            keys.left = false;
            break;
        case 'KeyD':
            keys.right = false;
            break;
        case 'KeyW':
        case 'Space':
            keys.up = false;
            break;
        case 'ControlLeft':
        case 'ControlRight':
            keys.punch = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.sprint = false;
            break;
    }
});

// Particle Class
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.alpha = 1;
        this.color = color;
        this.size = Math.random() * 3 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.02;
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

// Platform Class
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

// Player Class
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
        this.punchCooldown = false;
        this.punchDuration = 500;
        this.punchStartTime = 0;

        this.isSprinting = false;
        this.stamina = 100;
        this.maxStamina = 100;
        this.staminaDepletionRate = 100 / 1.5;
        this.staminaRechargeRate = 100 / 1.5;

        this.isInvincible = false;
        this.invincibilityDuration = 2000;
        this.invincibilityStartTime = 0;
    }

    initiatePunch() {
        if (!this.isPunching && !this.punchCooldown) {
            this.isPunching = true;
            this.punchCooldown = true;
            this.state = 'punching';
            this.punchStartTime = performance.now();
            if (isSoundEffectsOn && sounds.punch) sounds.punch.play();
        }
    }

    update(deltaTime, currentTime) {
        if (keys.sprint && this.stamina > 0) {
            this.isSprinting = true;
            this.speed = PLAYER_SPEED * SPRINT_MULTIPLIER;
            this.stamina -= this.staminaDepletionRate * (deltaTime / 1000);
            if (this.stamina < 0) this.stamina = 0;
        } else {
            this.isSprinting = false;
            this.speed = PLAYER_SPEED;
            if (this.stamina < this.maxStamina && !keys.sprint) {
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

        if (this.isPunching) {
            if (currentTime - this.punchStartTime >= this.punchDuration) {
                this.isPunching = false;
                this.punchCooldown = false;
                this.state = (this.vx === 0) ? 'idle' : 'walking';
            }
        }

        if (this.isInvincible) {
            if (currentTime - this.invincibilityStartTime >= this.invincibilityDuration) {
                this.isInvincible = false;
            }
        }

        this.vy += this.gravity;
        this.y += this.vy;
        this.x += this.vx;

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > WORLD_WIDTH) {
            this.x = WORLD_WIDTH - this.width;
            this.vx = 0;
        }

        if (this.isInvincible) {
            const flashInterval = 200;
            if (Math.floor(currentTime / flashInterval) % 2 === 0) {
                this.visibility = 0.5;
            } else {
                this.visibility = 1;
            }
        } else {
            this.visibility = 1;
        }
    }

    draw(cameraX) {
        let img;
        switch(this.state) {
            case 'idle':
                img = images.idle;
                break;
            case 'walking':
                img = this.animationFrame === 0 ? images.walk1 : images.walk2;
                break;
            case 'jumping':
                img = images.jump;
                break;
            case 'punching':
                img = images.punch;
                break;
            default:
                img = images.idle;
        }

        ctx.save();
        ctx.globalAlpha = this.visibility;
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
            this.animationFrame = 0;
            this.frameCount = 0;
        }
    }

    resetToStart() {
        this.x = this.startX;
        this.y = this.startY;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.state = 'idle';
        this.isInvincible = true;
        this.invincibilityStartTime = performance.now();
    }
}

// Enemy Class
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

        if (this.state === 'idle') {
            if (distance <= this.chaseDistance) {
                this.initiateChase(playerX);
            }
        } else if (this.state === 'chasing') {
            if (distance > this.stopChaseDistance) {
                this.stopChase();
            } else {
                if (playerX < this.x) {
                    this.vx = -this.speed;
                    this.facing = 'left';
                } else {
                    this.vx = this.speed;
                    this.facing = 'right';
                }
            }
        }

        this.vy += GRAVITY;
        this.y += this.vy;
        this.x += this.vx;

        if (this.y + this.height >= GAME_HEIGHT - images.ground.height) {
            this.y = GAME_HEIGHT - images.ground.height - this.height;
            this.vy = 0;
        }

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

        let img;
        if (this.state === 'chasing') {
            img = this.animationFrame === 0 ? images.enemyWalk1 : images.enemyWalk2;
        } else {
            img = images.enemy;
        }

        ctx.save();
        if (this.facing === 'left') {
            ctx.translate(this.x - cameraX + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(img, this.x - cameraX, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}

// Boss Class
class Boss {
    constructor(x, y) {
        this.x = x; 
        this.y = y; 
        this.width = 150; 
        this.height = 150; 
        this.vx = -2; 
        this.vy = 0; 
        this.alive = true;
        this.speed = 2; 
        this.state = 'entering'; 
        this.animationFrame = 0;
        this.frameCount = 0;
        this.facing = 'left'; 
        this.maxHealth = 10;
        this.health = this.maxHealth;
        this.runAwayDuration = 2000; 
        this.runAwayStartTime = null;

        // Custom hitbox
        this.hitBox = {xOffset: 30, yOffset: 40, width: 90, height: 90};
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

    runAway() {
        this.state = 'runningAway';
        this.vx = this.facing === 'left' ? this.speed : -this.speed;
        this.runAwayStartTime = performance.now();
    }

    update(deltaTime, playerX) {
        if (!this.alive) return;

        // Boss enters the screen
        if (this.state === 'entering') {
            if (this.x <= GAME_WIDTH - this.width - 50) {
                this.initiateChase(playerX);
            }
        }

        if (this.state === 'chasing') {
            if (playerX < this.x) {
                this.vx = -this.speed;
                this.facing = 'left';
            } else {
                this.vx = this.speed;
                this.facing = 'right';
            }
        }

        if (this.state === 'runningAway') {
            if (performance.now() - this.runAwayStartTime >= this.runAwayDuration) {
                this.initiateChase(playerX);
            }
        }

        this.vy += GRAVITY;
        this.y += this.vy;
        this.x += this.vx;

        if (this.y + this.height >= GAME_HEIGHT - images.ground.height) {
            this.y = GAME_HEIGHT - images.ground.height - this.height;
            this.vy = 0;
        }

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

    draw(cameraX) {
        if (!this.alive) return;

        let img;
        // Animate the boss in all states except if there's a hypothetical idle (not used here)
        if (this.state === 'chasing' || this.state === 'runningAway' || this.state === 'entering') {
            img = this.animationFrame === 0 ? images.enemyWalk1 : images.enemyWalk2;
        } else {
            img = images.enemy;
        }

        ctx.save();
        if (this.facing === 'left') {
            ctx.translate(this.x - cameraX + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(img, this.x - cameraX, this.y, this.width, this.height);
        }
        ctx.restore();
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

// Coin Class
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

    // Exactly 20 coins:
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
    
    const hud = document.getElementById('hud');
    const existingLivesCounter = document.getElementById('livesCounter');
    if (!existingLivesCounter) {
        const livesCounter = document.createElement('div');
        livesCounter.id = 'livesCounter';
        livesCounter.innerHTML = `<img src="assets/images/life-icon.png" alt="Lives" /> Lives: ${player.lives}`;
        hud.appendChild(livesCounter);
    }

    const existingBossHealthMeter = document.getElementById('bossHealthMeter');
    if (!existingBossHealthMeter) {
        const bossHealthMeter = document.createElement('div');
        bossHealthMeter.id = 'bossHealthMeter';
        bossHealthMeter.innerHTML = `<div id="bossHealthFill"></div>`;
        hud.appendChild(bossHealthMeter);
    }
}

function createParticle(x, y, color = '#FFD700') {
    particles.push(new Particle(x, y, color));
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].alpha <= 0) {
            particles.splice(i, 1);
        }
    }
}

let lastTime = 0;
function gameLoop(timeStamp) {
    const deltaTime = timeStamp - lastTime;
    lastTime = timeStamp;

    if (!paused && !gameOver && !win) {
        update(deltaTime, timeStamp);
    }
    render();

    // If gameOver or win are true, show the message now, do not request new frames
    if (gameOver || win) {
        displayEndMessage();
    } else {
        requestAnimationFrame(gameLoop);
    }
}

function checkCollisions() {
    enemies.forEach(enemy => {
        if (enemy.alive && rectCollision(player, enemy)) {
            if (player.isInvincible) return;

            if (player.vy > 0 && player.y + player.height - player.vy <= enemy.y) {
                enemy.alive = false;
                player.vy = -10;
                createParticle(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#FF0000');
                if (isSoundEffectsOn && sounds.punch) sounds.punch.play();
            } else if (player.isPunching) {
                enemy.alive = false;
                createParticle(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#FF0000');
                if (isSoundEffectsOn && sounds.punch) sounds.punch.play();
            } else {
                if (player.lives > 0) {
                    player.lives -= 1;
                    updateHUD();
                    createParticle(player.x + player.width / 2, player.y + player.height / 2, '#000000');
                    if (isSoundEffectsOn && sounds.gameOver) sounds.gameOver.play();
                    resetPlayerPosition();
                }

                if (player.lives <= 0) {
                    gameOver = true;
                }
            }
        }
    });

    if (bossActive && boss && boss.alive) {
        const bossBox = boss.getHitBox();
        if (rectCollision(player, bossBox)) {
            if (player.isInvincible) return;

            if (player.vy > 0 && player.y + player.height - player.vy <= bossBox.y) {
                if (boss.state !== 'runningAway') {
                    boss.health -= 1; 
                    createParticle(boss.x + boss.width / 2, boss.y + boss.height / 2, '#FF0000');
                    if (isSoundEffectsOn && sounds.punch) sounds.punch.play();

                    if (boss.health <= 0) {
                        boss.alive = false;
                        win = true;
                        createParticle(boss.x + boss.width / 2, boss.y + boss.height / 2, '#00FF00');
                    } else {
                        boss.runAway();
                    }

                    player.vy = -10;
                }
            } else if (player.isPunching) {
                if (boss.state !== 'runningAway') {
                    boss.health -= 1;
                    createParticle(boss.x + boss.width / 2, boss.y + boss.height / 2, '#FF0000');
                    if (isSoundEffectsOn && sounds.punch) sounds.punch.play();

                    if (boss.health <= 0) {
                        boss.alive = false;
                        win = true;
                        createParticle(boss.x + boss.width / 2, boss.y + boss.height / 2, '#00FF00');
                    } else {
                        boss.runAway();
                    }
                }
            } else {
                if (player.lives > 0) {
                    player.lives -= 1;
                    updateHUD();
                    createParticle(player.x + player.width / 2, player.y + player.height / 2, '#000000');
                    if (isSoundEffectsOn && sounds.gameOver) sounds.gameOver.play();
                    resetPlayerPosition();
                }

                if (player.lives <= 0) {
                    gameOver = true;
                }
            }
        }
    }

    coins.forEach(coin => {
        if (!coin.collected && rectCollision(player, coin)) {
            coin.collected = true;
            player.coinsCollected++;
            createParticle(coin.x + coin.width / 2, coin.y + coin.height / 2);
            if (isSoundEffectsOn && sounds.collectCoin) sounds.collectCoin.play();
            updateHUD();

            if (player.coinsCollected >= 20 && !bossActive) {
                spawnBoss();
            }
        }
    });

    platforms.forEach(platform => {
        if (rectCollision(player, platform)) {
            if (player.vy >= 0 && player.y + player.height - player.vy <= platform.y) {
                player.y = platform.y - player.height;
                player.vy = 0;
                player.onGround = true;
                if (!player.isPunching) {
                    player.state = player.vx === 0 ? 'idle' : 'walking';
                }
            }
        }
    });

    if (player.y + player.height >= GAME_HEIGHT - images.ground.height) {
        player.y = GAME_HEIGHT - images.ground.height - player.height;
        player.vy = 0;
        player.onGround = true;
        if (!player.isPunching) {
            player.state = player.vx === 0 ? 'idle' : 'walking';
        }
    }
}

function rectCollision(r1, r2) {
    return (r1.x < r2.x + r2.width &&
            r1.x + r1.width > r2.x &&
            r1.y < r2.y + r2.height &&
            r1.y + r1.height > r2.y);
}

function handleEnemyCollisions() {
    for (let i = 0; i < enemies.length; i++) {
        for (let j = i + 1; j < enemies.length; j++) {
            const enemyA = enemies[i];
            const enemyB = enemies[j];

            if (enemyA.alive && enemyB.alive && rectCollision(enemyA, enemyB)) {
                const overlapX = (enemyA.x + enemyA.width) - enemyB.x;

                if (enemyA.x < enemyB.x) {
                    enemyA.x -= overlapX / 2;
                    enemyB.x += overlapX / 2;
                } else {
                    enemyA.x += overlapX / 2;
                    enemyB.x -= overlapX / 2;
                }

                enemyA.vx = -enemyA.vx;
                enemyB.vx = -enemyB.vx;
                enemyA.facing = enemyA.vx < 0 ? 'left' : 'right';
                enemyB.facing = enemyB.vx < 0 ? 'left' : 'right';
            }
        }
    }
}

function spawnBoss() {
    boss = new Boss(WORLD_WIDTH, GAME_HEIGHT - images.ground.height - 150);
    bossActive = true;
    document.getElementById('bossHealthMeter').classList.add('show');
    updateHUD();
}

function resetPlayerPosition() {
    player.resetToStart();
    const desiredOffset = 100;
    cameraX = player.startX - desiredOffset;
    if (cameraX < 0) cameraX = 0;
    if (cameraX + GAME_WIDTH > WORLD_WIDTH) cameraX = WORLD_WIDTH - GAME_WIDTH;
}

function update(deltaTime, currentTime) {
    player.update(deltaTime, currentTime);

    enemies.forEach(enemy => {
        enemy.updateChase(player.x, player.y, deltaTime);
    });

    handleEnemyCollisions();

    coins.forEach(coin => coin.update());

    if (bossActive && boss.alive) {
        boss.update(deltaTime, player.x);
    }

    checkCollisions();
    updateParticles();

    const cameraOffset = DEADZONE_RIGHT_BOUND;
    if (player.x - cameraX > cameraOffset) {
        cameraX = player.x - cameraOffset;
    }
    if (cameraX + GAME_WIDTH > WORLD_WIDTH) {
        cameraX = WORLD_WIDTH - GAME_WIDTH;
    }
    if (cameraX < 0) cameraX = 0;
}

function updateHUD() {
    const coinCounter = document.getElementById('coinCounter');
    coinCounter.innerHTML = `<img src="assets/images/coin-icon.png" alt="Coin" /> Coins: ${player.coinsCollected}/20`;

    const staminaFill = document.getElementById('staminaFill');
    staminaFill.style.width = `${player.stamina}%`;

    if (player.stamina > 60) {
        staminaFill.style.backgroundColor = '#00ff00';
    } else if (player.stamina > 30) {
        staminaFill.style.backgroundColor = '#ffff00';
    } else {
        staminaFill.style.backgroundColor = '#ff0000';
    }

    const livesCounter = document.getElementById('livesCounter');
    livesCounter.innerHTML = `<img src="assets/images/life-icon.png" alt="Lives" /> Lives: ${player.lives}`;

    if (bossActive && boss.alive) {
        const bossHealthFill = document.getElementById('bossHealthFill');
        const bossHealthPercentage = (boss.health / boss.maxHealth) * 100;
        bossHealthFill.style.width = `${bossHealthPercentage}%`;

        if (bossHealthPercentage > 60) {
            bossHealthFill.style.backgroundColor = '#ff0000';
        } else if (bossHealthPercentage > 30) {
            bossHealthFill.style.backgroundColor = '#ffff00';
        } else {
            bossHealthFill.style.backgroundColor = '#00ff00';
        }
    }
}

function render() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const bgWidth = images.background.width;
    const bgHeight = images.background.height;
    const bgCount = Math.ceil(GAME_WIDTH / bgWidth) + 1;
    for (let i = 0; i < bgCount; i++) {
        ctx.drawImage(images.background, i * bgWidth - (cameraX % bgWidth), 0, bgWidth, GAME_HEIGHT - images.ground.height);
    }

    const groundWidth = images.ground.width;
    const groundHeight = images.ground.height;
    const groundCount = Math.ceil(GAME_WIDTH / groundWidth) + 1;
    for (let i = 0; i < groundCount; i++) {
        ctx.drawImage(images.ground, i * groundWidth - (cameraX % groundWidth), GAME_HEIGHT - groundHeight, groundWidth, groundHeight);
    }

    platforms.forEach(platform => platform.draw(cameraX));
    coins.forEach(coin => coin.draw(cameraX));
    enemies.forEach(enemy => enemy.draw(cameraX));

    if (bossActive && boss.alive) {
        boss.draw(cameraX);
    }

    player.draw(cameraX);
    particles.forEach(particle => particle.draw());
    updateHUD();
}

function displayEndMessage() {
    const endMessage = document.getElementById('endMessage');
    if (win) {
        endMessage.innerHTML = `
            <p>You Defeated the Boss! You Win!</p>
            <button onclick="restartGame()">Restart</button>
        `;
    } else if (gameOver) {
        endMessage.innerHTML = `
            <p>Game Over!</p>
            <button onclick="restartGame()">Try Again</button>
        `;
    }
    endMessage.classList.remove('hidden');
}

function toggleMusic() {
    const toggleMusicBtn = document.getElementById('toggleMusic');
    if (isMusicOn) {
        sounds.background.pause();
        isMusicOn = false;
        toggleMusicBtn.textContent = 'Music: Off';
        toggleMusicBtn.classList.remove('active');
    } else {
        sounds.background.play().catch(err=>console.error(err));
        isMusicOn = true;
        toggleMusicBtn.textContent = 'Music: On';
        toggleMusicBtn.classList.add('active');
    }
}

function toggleSoundEffects() {
    const toggleSoundBtn = document.getElementById('toggleSound');
    if (isSoundEffectsOn) {
        isSoundEffectsOn = false;
        toggleSoundBtn.textContent = 'Sound Effects: Off';
        toggleSoundBtn.classList.remove('active');
    } else {
        isSoundEffectsOn = true;
        toggleSoundBtn.textContent = 'Sound Effects: On';
        toggleSoundBtn.classList.add('active');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleMusicBtn = document.getElementById('toggleMusic');
    const toggleSoundBtn = document.getElementById('toggleSound');
    const startButton = document.getElementById('startButton');
    const startScreen = document.getElementById('startScreen');

    toggleMusicBtn.addEventListener('click', toggleMusic);
    toggleSoundBtn.addEventListener('click', toggleSoundEffects);

    startButton.addEventListener('click', () => {
        startScreen.style.display = 'none';
        if (isMusicOn && sounds.background) {
            sounds.background.play().catch(error => console.error('Failed to play background music:', error));
        }
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    });
});

function restartGame() {
    player = new Player();
    enemies = [];
    coins = [];
    platforms = [];
    boss = null;
    bossActive = false;
    particles = [];
    gameOver = false;
    win = false;
    cameraX = 0;

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

    // Exactly 20 coins again:
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

    const livesCounter = document.getElementById('livesCounter');
    livesCounter.innerHTML = `<img src="assets/images/life-icon.png" alt="Lives" /> Lives: ${player.lives}`;

    const bossHealthMeter = document.getElementById('bossHealthMeter');
    bossHealthMeter.classList.remove('show');
    const bossHealthFill = document.getElementById('bossHealthFill');
    bossHealthFill.style.width = '100%';
    bossHealthFill.style.backgroundColor = '#ff0000'; 

    const endMessage = document.getElementById('endMessage');
    if (endMessage) {
        endMessage.classList.add('hidden');
    }

    if (isMusicOn && sounds.background) {
        sounds.background.currentTime = 0;
        sounds.background.play().catch(error => console.error(error));
    }

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Load assets and init
loadImages()
    .then(() => {
        loadSounds();
        init();
    })
    .catch(err => console.error('Error loading assets:', err));
