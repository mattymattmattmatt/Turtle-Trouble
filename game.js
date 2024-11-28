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
        return new Promise((resolve, reject) => {
            images[key] = new Image();
            images[key].src = imageSources[key];
            images[key].onload = () => resolve();
            images[key].onerror = () => {
                console.error(`Failed to load image: ${imageSources[key]}`);
                resolve(); // Resolve even if an image fails to load to prevent blocking
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
    background: 'assets/audio/Turtle-Trouble-Theme.mp3' // New Background Music
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

// Handle user input
const keys = {
    left: false,
    right: false,
    up: false,
    punch: false,
    sprint: false
};

// Event listeners for key presses
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
            if (!keys.punch) { // Prevent setting punch to true multiple times
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
        this.x = x; // World X
        this.y = y; // World Y
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
        this.startX = 100; // Original Starting X
        this.startY = GAME_HEIGHT - images.ground.height - 50; // Original Starting Y
        this.x = this.startX; // World X
        this.y = this.startY; // World Y
        this.width = 50;
        this.height = 50;
        this.vx = 0;
        this.vy = 0;
        this.speed = PLAYER_SPEED;
        this.jumpStrength = PLAYER_JUMP_STRENGTH;
        this.gravity = GRAVITY;
        this.onGround = false;
        this.state = 'idle'; // idle, walking, jumping, punching
        this.animationFrame = 0;
        this.frameCount = 0;
        this.coinsCollected = 0;
        this.facing = 'right'; // 'right' or 'left'
        this.lives = 3; // Player lives

        // Punch Mechanic
        this.isPunching = false;
        this.punchCooldown = false;
        this.punchDuration = 500; // in milliseconds
        this.punchStartTime = 0;

        // Sprint Mechanic
        this.isSprinting = false;
        this.stamina = 100; // Max stamina
        this.maxStamina = 100;
        this.staminaDepletionRate = 100 / 1.5; // 100 stamina in 1.5 seconds
        this.staminaRechargeRate = 100 / 1.5; // Recharges 100 stamina in 1.5 seconds

        // Invincibility after respawn
        this.isInvincible = false;
        this.invincibilityDuration = 2000; // 2 seconds
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
        // Handle sprinting
        if (keys.sprint && this.stamina > 0) {
            this.isSprinting = true;
            this.speed = PLAYER_SPEED * SPRINT_MULTIPLIER;
            this.stamina -= this.staminaDepletionRate * (deltaTime / 1000);
            if (this.stamina < 0) {
                this.stamina = 0;
            }
        } else {
            this.isSprinting = false;
            this.speed = PLAYER_SPEED;
            // Recharge stamina
            if (this.stamina < this.maxStamina && !keys.sprint) {
                this.stamina += this.staminaRechargeRate * (deltaTime / 1000);
                if (this.stamina > this.maxStamina) {
                    this.stamina = this.maxStamina;
                }
            }
        }

        // Handle horizontal movement
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

        // Handle jumping
        if (keys.up && this.onGround) {
            this.vy = -this.jumpStrength;
            this.onGround = false;
            this.state = 'jumping';
            if (isSoundEffectsOn && sounds.jump) sounds.jump.play();
        }

        // Handle punching timing
        if (this.isPunching) {
            if (currentTime - this.punchStartTime >= this.punchDuration) {
                this.isPunching = false;
                this.punchCooldown = false; // Reset cooldown after punch duration
                // Reset state based on movement
                if (this.vx === 0) {
                    this.state = 'idle';
                } else {
                    this.state = 'walking';
                }
            }
        }

        // Handle invincibility timing
        if (this.isInvincible) {
            if (currentTime - this.invincibilityStartTime >= this.invincibilityDuration) {
                this.isInvincible = false;
            }
        }

        // Apply gravity
        this.vy += this.gravity;
        this.y += this.vy;
        this.x += this.vx;

        // Prevent moving out of world bounds (left side)
        if (this.x < 0) this.x = 0;

        // Prevent moving out of world bounds (right side)
        if (this.x + this.width > WORLD_WIDTH) {
            this.x = WORLD_WIDTH - this.width;
            this.vx = 0;
        }

        // Flash effect during invincibility
        if (this.isInvincible) {
            const flashInterval = 200; // milliseconds
            if (Math.floor(currentTime / flashInterval) % 2 === 0) {
                this.visibility = 0.5; // Semi-transparent
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
        ctx.globalAlpha = this.visibility; // Apply visibility for invincibility flashing
        if (this.facing === 'left') {
            ctx.translate(this.x - cameraX + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(img, this.x - cameraX, this.y, this.width, this.height);
        }
        ctx.restore();

        // Handle walking animation frame updates only when walking
        if (this.state === 'walking') {
            this.frameCount += 1;
            if (this.frameCount >= 10) { // Adjust for animation speed
                this.frameCount = 0;
                this.animationFrame = (this.animationFrame + 1) % 2;
            }
        } else {
            // Reset to first animation frame when not walking
            this.animationFrame = 0;
            this.frameCount = 0;
        }
    }

    // Reset player to starting position and make invincible briefly
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
        this.x = x; // World X
        this.y = y; // World Y (on ground)
        this.width = 50;
        this.height = 50;
        this.vx = 0; // Current horizontal velocity
        this.vy = 0; // Vertical velocity
        this.alive = true;
        this.speed = 1.5; // Enemy movement speed
        this.state = 'idle'; // idle or chasing
        this.animationFrame = 0;
        this.frameCount = 0;
        this.facing = 'right'; // 'right' or 'left'

        // Chasing parameters
        this.chaseDistance = 200; // Start chasing if player is within 200px
        this.stopChaseDistance = 250; // Stop chasing if player is beyond 250px
    }

    initiateChase(playerX) {
        this.state = 'chasing';
        // Determine direction
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

        // Calculate distance to player
        const distance = Math.abs(playerX - this.x);

        if (this.state === 'idle') {
            if (distance <= this.chaseDistance) {
                this.initiateChase(playerX);
            }
        } else if (this.state === 'chasing') {
            if (distance > this.stopChaseDistance) {
                this.stopChase();
            } else {
                // Continue chasing
                if (playerX < this.x) {
                    this.vx = -this.speed;
                    this.facing = 'left';
                } else {
                    this.vx = this.speed;
                    this.facing = 'right';
                }
            }
        }

        // Apply gravity
        this.vy += GRAVITY;
        this.y += this.vy;
        this.x += this.vx;

        // Collision with ground
        if (this.y + this.height >= GAME_HEIGHT - images.ground.height) {
            this.y = GAME_HEIGHT - images.ground.height - this.height;
            this.vy = 0;
        }

        // Prevent enemy from moving out of world bounds
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

        // Update animation
        this.frameCount += 1;
        if (this.frameCount >= 15) { // Adjust for animation speed
            this.frameCount = 0;
            this.animationFrame = (this.animationFrame + 1) % 2;
        }
    }

    draw(cameraX) {
        if (!this.alive) return;

        // Determine which walk image to use based on animation frame
        let img;
        if (this.state === 'chasing') {
            img = this.animationFrame === 0 ? images.enemyWalk1 : images.enemyWalk2;
        } else {
            img = images.enemy; // Idle image
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

        // Handle walking animation frame updates only when chasing
        if (this.state === 'chasing') {
            // Animation handled in updateChase
        } else {
            // Reset to first animation frame when not chasing
            this.animationFrame = 0;
            this.frameCount = 0;
        }
    }
}

// Boss Class
class Boss {
    constructor(x, y) {
        this.x = x; // World X
        this.y = y; // World Y (on ground, adjusted)
        this.width = 150; // 50 * 3
        this.height = 150; // 50 * 3
        this.vx = -2; // Boss initial speed towards the left
        this.vy = 0; // Vertical velocity
        this.alive = true;
        this.speed = 2; // Boss movement speed
        this.state = 'entering'; // entering, chasing, runningAway
        this.animationFrame = 0;
        this.frameCount = 0;
        this.facing = 'left'; // 'left' or 'right'

        // Health
        this.maxHealth = 10;
        this.health = this.maxHealth;

        // Running away
        this.runAwayDuration = 2000; // 2 seconds
        this.runAwayStartTime = null;
    }

    initiateChase(playerX) {
        this.state = 'chasing';
        // Determine direction
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
        // Reverse direction to run away
        this.vx = this.facing === 'left' ? this.speed : -this.speed;
        this.runAwayStartTime = performance.now();
    }

    update(deltaTime, playerX, playerY) {
        if (!this.alive) return;

        // Boss enters the screen
        if (this.state === 'entering') {
            if (this.x <= GAME_WIDTH - this.width - 50) { // Boss stops 50px before the end
                this.initiateChase(playerX);
            }
        }

        // Chasing behavior
        if (this.state === 'chasing') {
            // Determine direction towards the player
            if (playerX < this.x) {
                this.vx = -this.speed;
                this.facing = 'left';
            } else {
                this.vx = this.speed;
                this.facing = 'right';
            }
        }

        // Running away behavior
        if (this.state === 'runningAway') {
            // Check if run away duration has passed
            if (performance.now() - this.runAwayStartTime >= this.runAwayDuration) {
                this.initiateChase(playerX);
            }
        }

        // Apply gravity
        this.vy += GRAVITY;
        this.y += this.vy;
        this.x += this.vx;

        // Collision with ground
        if (this.y + this.height >= GAME_HEIGHT - images.ground.height) {
            this.y = GAME_HEIGHT - images.ground.height - this.height;
            this.vy = 0;
        }

        // Prevent boss from moving out of world bounds
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

        // Update animation
        this.frameCount += 1;
        if (this.frameCount >= 20) { // Adjust for animation speed
            this.frameCount = 0;
            this.animationFrame = (this.animationFrame + 1) % 2;
        }
    }

    draw(cameraX) {
        if (!this.alive) return;

        // Use the enemy walking images scaled up for the boss
        let img;
        if (this.state === 'chasing' || this.state === 'runningAway') {
            img = this.animationFrame === 0 ? images.enemyWalk1 : images.enemyWalk2;
        } else {
            img = images.enemy; // Idle image
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

        // Handle walking animation frame updates only when chasing or runningAway
        if (this.state === 'chasing' || this.state === 'runningAway') {
            // Animation handled in update
        } else {
            // Reset to first animation frame when not chasing
            this.animationFrame = 0;
            this.frameCount = 0;
        }
    }
}

// Coin Class
class Coin {
    constructor(x, y) {
        this.x = x; // World X
        this.baseY = y; // Base Y position for bobbing
        this.y = y; // Current Y position
        this.width = 30;
        this.height = 30;
        this.collected = false;
        this.bobHeight = 10; // How much the coin bobs up and down
        this.bobSpeed = 0.05; // Speed of bobbing
        this.bobAngle = 0; // Current angle for sine wave
    }

    update() {
        // Animate bobbing
        this.bobAngle += this.bobSpeed;
        this.y = this.baseY + Math.sin(this.bobAngle) * this.bobHeight;
    }

    draw(cameraX) {
        if (!this.collected) {
            ctx.drawImage(images.coin, this.x - cameraX, this.y, this.width, this.height);
        }
    }
}

// Initialize game objects
let player;
let enemies = [];
let coins = [];
let platforms = [];
let boss = null; // Boss object
let bossActive = false; // Flag to check if boss is active
let gameOver = false;
let win = false;
let particles = [];
let cameraX = 0; // Camera offset

// Deadzone settings
const DEADZONE_WIDTH = 200; // Width of the deadzone from the left
const DEADZONE_RIGHT_BOUND = GAME_WIDTH - DEADZONE_WIDTH; // Right boundary of deadzone

// Initialize the game
function init() {
    player = new Player();

    // Create platforms first (needed for coin placement on platforms)
    platforms.push(new Platform(400, GAME_HEIGHT - 150, 150, 20));
    platforms.push(new Platform(700, GAME_HEIGHT - 220, 200, 20));
    platforms.push(new Platform(1000, GAME_HEIGHT - 180, 170, 20));
    platforms.push(new Platform(1300, GAME_HEIGHT - 150, 150, 20)); // Platform without enemy
    platforms.push(new Platform(1600, GAME_HEIGHT - 180, 170, 20));
    platforms.push(new Platform(2000, GAME_HEIGHT - 150, 150, 20));
    platforms.push(new Platform(2500, GAME_HEIGHT - 220, 200, 20));
    platforms.push(new Platform(3000, GAME_HEIGHT - 180, 170, 20));
    platforms.push(new Platform(3500, GAME_HEIGHT - 150, 150, 20));
    platforms.push(new Platform(4000, GAME_HEIGHT - 180, 170, 20));

    // Create enemies at specific positions (static on ground)
    enemies.push(new Enemy(500, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(800, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(1100, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(1300, GAME_HEIGHT - images.ground.height - 50)); // Enemy on ground
    enemies.push(new Enemy(1600, GAME_HEIGHT - images.ground.height - 50)); // Another enemy on ground
    enemies.push(new Enemy(2000, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(2500, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(3000, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(3500, GAME_HEIGHT - images.ground.height - 50));
    enemies.push(new Enemy(4000, GAME_HEIGHT - images.ground.height - 50));

    // **Restore Original Coin Positions**
    // Replace these positions with your original coin placements.
    // Assuming original positions were manually set, here are 20 example positions.
    coins.push(new Coin(250, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(450, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(650, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(850, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(1050, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(1250, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(1450, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(1650, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(1850, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(2050, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(2250, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(2450, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(2650, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(2850, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(3050, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(3250, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(3450, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(3650, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(3850, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(4050, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(4250, GAME_HEIGHT - images.ground.height - 50)); // Ground

    // Dynamically create Lives Counter in HUD
    const hud = document.getElementById('hud');
    // Ensure livesCounter is not duplicated
    const existingLivesCounter = document.getElementById('livesCounter');
    if (!existingLivesCounter) {
        const livesCounter = document.createElement('div');
        livesCounter.id = 'livesCounter';
        livesCounter.innerHTML = `<img src="assets/images/life-icon.png" alt="Lives" /> Lives: ${player.lives}`;
        hud.appendChild(livesCounter);
    }

    // Dynamically create Boss Health Meter in HUD
    const existingBossHealthMeter = document.getElementById('bossHealthMeter');
    if (!existingBossHealthMeter) {
        const bossHealthMeter = document.createElement('div');
        bossHealthMeter.id = 'bossHealthMeter';
        bossHealthMeter.innerHTML = `<div id="bossHealthFill"></div>`;
        hud.appendChild(bossHealthMeter);
    }
}

// Create a particle
function createParticle(x, y, color = '#FFD700') { // Default color gold
    particles.push(new Particle(x, y, color));
}

// Update particles
function updateParticles(deltaTime) {
    particles.forEach((particle, index) => {
        particle.update();
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        }
    });
}

// Game Loop with deltaTime for accurate timing
let lastTime = 0;
function gameLoop(timeStamp) {
    const deltaTime = timeStamp - lastTime;
    lastTime = timeStamp;

    update(deltaTime, timeStamp);
    render();

    if (!gameOver && !win) {
        requestAnimationFrame(gameLoop);
    } else {
        displayEndMessage();
    }
}

// Check Collisions
function checkCollisions() {
    // Check collision with enemies
    enemies.forEach(enemy => {
        if (enemy.alive && isColliding(player, enemy)) {
            if (player.isInvincible) return; // Ignore collisions if invincible

            if (player.vy > 0 && player.y + player.height - player.vy <= enemy.y) {
                // Player is falling and hits the top of the enemy
                enemy.alive = false;
                player.vy = -10; // Bounce effect
                createParticle(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#FF0000'); // Red particles
                if (isSoundEffectsOn && sounds.punch) sounds.punch.play();
            } else if (player.isPunching) {
                // Player is punching
                enemy.alive = false;
                createParticle(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#FF0000'); // Red particles
                if (isSoundEffectsOn && sounds.punch) sounds.punch.play();
            } else {
                // Player takes damage or loses a life
                if (player.lives > 0) {
                    player.lives -= 1;
                    updateHUD();
                    createParticle(player.x + player.width / 2, player.y + player.height / 2, '#000000'); // Black particles
                    if (isSoundEffectsOn && sounds.gameOver) sounds.gameOver.play();

                    // **Reset player position and camera to starting location**
                    resetPlayerPosition();
                }

                if (player.lives <= 0) {
                    gameOver = true;
                }
            }
        }
    });

    // Check collision with boss
    if (bossActive && boss.alive && isColliding(player, boss)) {
        if (player.isInvincible) return; // Ignore collisions if invincible

        if (player.vy > 0 && player.y + player.height - player.vy <= boss.y) {
            // Player is falling and hits the top of the boss
            if (boss.state !== 'runningAway') {
                boss.health -= 1; // Considered as a punch
                createParticle(boss.x + boss.width / 2, boss.y + boss.height / 2, '#FF0000'); // Red particles
                if (isSoundEffectsOn && sounds.punch) sounds.punch.play();

                if (boss.health <= 0) {
                    boss.alive = false;
                    win = true;
                    createParticle(boss.x + boss.width / 2, boss.y + boss.height / 2, '#00FF00'); // Green particles
                } else {
                    // Boss runs away
                    boss.runAway();
                }

                // Bounce effect
                player.vy = -10;
            }
        } else if (player.isPunching) {
            // Player is punching the boss
            if (boss.state !== 'runningAway') {
                boss.health -= 1;
                createParticle(boss.x + boss.width / 2, boss.y + boss.height / 2, '#FF0000'); // Red particles
                if (isSoundEffectsOn && sounds.punch) sounds.punch.play();

                if (boss.health <= 0) {
                    boss.alive = false;
                    win = true;
                    createParticle(boss.x + boss.width / 2, boss.y + boss.height / 2, '#00FF00'); // Green particles
                } else {
                    // Boss runs away
                    boss.runAway();
                }
            }
        } else {
            // Player takes damage or loses a life
            if (player.lives > 0) {
                player.lives -= 1;
                updateHUD();
                createParticle(player.x + player.width / 2, player.y + player.height / 2, '#000000'); // Black particles
                if (isSoundEffectsOn && sounds.gameOver) sounds.gameOver.play();

                // **Reset player position and camera to starting location**
                resetPlayerPosition();
            }

            if (player.lives <= 0) {
                gameOver = true;
            }
        }
    }

    // Check collision with coins
    coins.forEach(coin => {
        if (!coin.collected && isColliding(player, coin)) {
            coin.collected = true;
            player.coinsCollected++;
            createParticle(coin.x + coin.width / 2, coin.y + coin.height / 2);
            if (isSoundEffectsOn && sounds.collectCoin) sounds.collectCoin.play();
            updateHUD();

            // Check if all coins are collected to spawn the boss
            if (player.coinsCollected === 20 && !bossActive) {
                spawnBoss();
            }
        }
    });

    // Check collision with platforms
    platforms.forEach(platform => {
        if (isColliding(player, platform)) {
            if (player.vy >= 0 && player.y + player.height - player.vy <= platform.y) {
                // Player lands on top of the platform
                player.y = platform.y - player.height;
                player.vy = 0;
                player.onGround = true;
                if (!player.isPunching) {
                    if (player.vx === 0) {
                        player.state = 'idle';
                    } else {
                        player.state = 'walking';
                    }
                }
            }
        }
    });

    // Check collision with ground
    if (player.y + player.height >= GAME_HEIGHT - images.ground.height) { // Ground height from image
        player.y = GAME_HEIGHT - images.ground.height - player.height;
        player.vy = 0;
        player.onGround = true;
        if (!player.isPunching) {
            if (player.vx === 0) {
                player.state = 'idle';
            } else {
                player.state = 'walking';
            }
        }
    }
}

// Collision Detection
function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Handle collisions between enemies to prevent overlapping
function handleEnemyCollisions() {
    for (let i = 0; i < enemies.length; i++) {
        for (let j = i + 1; j < enemies.length; j++) {
            const enemyA = enemies[i];
            const enemyB = enemies[j];

            // Only consider alive enemies for collision
            if (enemyA.alive && enemyB.alive && isColliding(enemyA, enemyB)) {
                // Calculate the overlap in the x-axis
                const overlapX = (enemyA.x + enemyA.width) - enemyB.x;

                // Adjust positions to prevent overlapping
                if (enemyA.x < enemyB.x) {
                    enemyA.x -= overlapX / 2;
                    enemyB.x += overlapX / 2;
                } else {
                    enemyA.x += overlapX / 2;
                    enemyB.x -= overlapX / 2;
                }

                // Reverse their horizontal velocities to simulate a bounce effect
                enemyA.vx = -enemyA.vx;
                enemyB.vx = -enemyB.vx;

                // Update their facing directions based on new velocities
                enemyA.facing = enemyA.vx < 0 ? 'left' : 'right';
                enemyB.facing = enemyB.vx < 0 ? 'left' : 'right';
            }
        }
    }
}

// Spawn the boss after all coins are collected
function spawnBoss() {
    // Initialize boss at the far right of the world, aligned with the ground
    boss = new Boss(WORLD_WIDTH, GAME_HEIGHT - images.ground.height - 150); // Adjusted y-position
    bossActive = true;
    document.getElementById('bossHealthMeter').classList.add('show');
    updateHUD();
}

// **Reset player position and camera to starting location**
function resetPlayerPosition() {
    // Reset player's position to starting location and make invincible
    player.resetToStart();

    // Reset camera to focus on the starting location
    const desiredOffset = 100; // Pixels from the left
    cameraX = player.startX - desiredOffset;

    // Clamp cameraX within the world bounds
    if (cameraX < 0) cameraX = 0;
    if (cameraX + GAME_WIDTH > WORLD_WIDTH) cameraX = WORLD_WIDTH - GAME_WIDTH;
}

// Update Game Objects
function update(deltaTime, currentTime) {
    player.update(deltaTime, currentTime);

    enemies.forEach(enemy => {
        enemy.updateChase(player.x, player.y, deltaTime);
    });

    // Handle collisions between enemies after updating their positions
    handleEnemyCollisions();

    coins.forEach(coin => coin.update());

    // Update boss if active
    if (bossActive && boss.alive) {
        boss.update(deltaTime, player.x, player.y);
    }

    checkCollisions();

    updateParticles(deltaTime);

    // Update camera position based on player position
    // Deadzone logic to keep the player within a central area before scrolling
    const cameraOffset = DEADZONE_RIGHT_BOUND; // Define how far the player can move before the camera scrolls

    if (player.x - cameraX > cameraOffset) {
        cameraX = player.x - cameraOffset;
    }

    // Prevent camera from moving beyond the world bounds
    if (cameraX + GAME_WIDTH > WORLD_WIDTH) {
        cameraX = WORLD_WIDTH - GAME_WIDTH;
    }

    // Prevent camera from moving left beyond the world start
    if (cameraX < 0) cameraX = 0;
}

// Update HUD
function updateHUD() {
    const coinCounter = document.getElementById('coinCounter');
    coinCounter.innerHTML = `<img src="assets/images/coin-icon.png" alt="Coin" /> Coins: ${player.coinsCollected}/20`;

    // Update Stamina Meter
    const staminaFill = document.getElementById('staminaFill');
    staminaFill.style.width = `${player.stamina}%`;

    // Change color based on stamina level
    if (player.stamina > 60) {
        staminaFill.style.backgroundColor = '#00ff00'; // Green
    } else if (player.stamina > 30) {
        staminaFill.style.backgroundColor = '#ffff00'; // Yellow
    } else {
        staminaFill.style.backgroundColor = '#ff0000'; // Red
    }

    // Update Lives Counter
    const livesCounter = document.getElementById('livesCounter');
    livesCounter.innerHTML = `<img src="assets/images/life-icon.png" alt="Lives" /> Lives: ${player.lives}`;

    // Update Boss Health Meter if active
    if (bossActive && boss.alive) {
        const bossHealthFill = document.getElementById('bossHealthFill');
        const bossHealthPercentage = (boss.health / boss.maxHealth) * 100;
        bossHealthFill.style.width = `${bossHealthPercentage}%`;

        // Change color based on boss health level
        if (bossHealthPercentage > 60) {
            bossHealthFill.style.backgroundColor = '#ff0000'; // Red
        } else if (bossHealthPercentage > 30) {
            bossHealthFill.style.backgroundColor = '#ffff00'; // Yellow
        } else {
            bossHealthFill.style.backgroundColor = '#00ff00'; // Green
        }
    }
}

// Render Game
function render() {
    // Clear canvas
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw seamless background
    const bgWidth = images.background.width;
    const bgHeight = images.background.height;
    const bgCount = Math.ceil(GAME_WIDTH / bgWidth) + 1;

    for (let i = 0; i < bgCount; i++) {
        ctx.drawImage(images.background, i * bgWidth - (cameraX % bgWidth), 0, bgWidth, GAME_HEIGHT - images.ground.height);
    }

    // Draw ground
    const groundWidth = images.ground.width;
    const groundHeight = images.ground.height;
    const groundCount = Math.ceil(GAME_WIDTH / groundWidth) + 1;

    for (let i = 0; i < groundCount; i++) {
        ctx.drawImage(images.ground, i * groundWidth - (cameraX % groundWidth), GAME_HEIGHT - groundHeight, groundWidth, groundHeight);
    }

    // Draw platforms
    platforms.forEach(platform => platform.draw(cameraX));

    // Draw coins
    coins.forEach(coin => coin.draw(cameraX));

    // Draw enemies
    enemies.forEach(enemy => enemy.draw(cameraX));

    // Draw boss if active
    if (bossActive && boss.alive) {
        boss.draw(cameraX);
    }

    // Draw player
    player.draw(cameraX);

    // Draw particles
    particles.forEach(particle => particle.draw());

    // Update HUD
    updateHUD();
}

// Display End Message
function displayEndMessage() {
    const endMessage = document.getElementById('endMessage');

    if (win) {
        endMessage.innerHTML = `
            <p>You Defeated the Boss! You Win!</p>
            <button onclick="restartGame()">Restart</button>
        `;
    } else {
        endMessage.innerHTML = `
            <p>Game Over!</p>
            <button onclick="restartGame()">Try Again</button>
        `;
    }

    endMessage.classList.add('show');
}

// Toggle Music Function
function toggleMusic() {
    const toggleMusicBtn = document.getElementById('toggleMusic');
    if (isMusicOn) {
        sounds.background.pause();
        isMusicOn = false;
        toggleMusicBtn.textContent = 'Music: Off';
        toggleMusicBtn.classList.remove('active');
    } else {
        sounds.background.play();
        isMusicOn = true;
        toggleMusicBtn.textContent = 'Music: On';
        toggleMusicBtn.classList.add('active');
    }
}

// Toggle Sound Effects Function
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

// Add Event Listeners for Toggle Buttons and Start Button
document.addEventListener('DOMContentLoaded', () => {
    const toggleMusicBtn = document.getElementById('toggleMusic');
    const toggleSoundBtn = document.getElementById('toggleSound');
    const startButton = document.getElementById('startButton');
    const startScreen = document.getElementById('startScreen');

    toggleMusicBtn.addEventListener('click', toggleMusic);
    toggleSoundBtn.addEventListener('click', toggleSoundEffects);

    startButton.addEventListener('click', () => {
        // Hide Start Screen
        startScreen.style.display = 'none';

        // Play background music if music is on
        if (isMusicOn && sounds.background) {
            sounds.background.play().catch(error => {
                console.error('Failed to play background music:', error);
            });
        }

        // Start the game loop
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    });
});

// Restart Game
function restartGame() {
    // Reset game state
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

    // Create platforms first (needed for coin placement on platforms)
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

    // Create enemies again (static on ground)
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

    // **Restore Original Coin Positions**
    // Replace these positions with your original coin placements.
    // Assuming original positions were manually set, here are 20 example positions.
    coins.push(new Coin(250, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(450, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(650, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(850, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(1050, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(1250, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(1450, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(1650, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(1850, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(2050, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(2250, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(2450, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(2650, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(2850, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(3050, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(3250, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(3450, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(3650, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(3850, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(4050, GAME_HEIGHT - images.ground.height - 50)); // Ground
    coins.push(new Coin(4250, GAME_HEIGHT - images.ground.height - 50)); // Ground

    // Reset Lives Counter
    const livesCounter = document.getElementById('livesCounter');
    livesCounter.innerHTML = `<img src="assets/images/life-icon.png" alt="Lives" /> Lives: ${player.lives}`;

    // Reset Boss Health Meter
    const bossHealthMeter = document.getElementById('bossHealthMeter');
    bossHealthMeter.classList.remove('show');
    const bossHealthFill = document.getElementById('bossHealthFill');
    bossHealthFill.style.width = '100%';
    bossHealthFill.style.backgroundColor = '#ff0000'; // Reset to red

    // Hide end message
    const endMessage = document.getElementById('endMessage');
    if (endMessage) {
        endMessage.classList.remove('show');
    }

    // Restart the background music if it's on
    if (isMusicOn && sounds.background) {
        sounds.background.currentTime = 0;
        sounds.background.play().catch(error => {
            console.error('Failed to play background music:', error);
        });
    }

    // Restart the game loop
    lastTime = performance.now(); // Reset lastTime for deltaTime calculation
    requestAnimationFrame(gameLoop);
}

// Load all assets and initialize the game
loadImages()
    .then(() => {
        loadSounds();
        init();
    })
    .catch(err => console.error('Error loading assets:', err));
