// game.js

// Get the canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game dimensions
const GAME_WIDTH = canvas.width; // 1200
const GAME_HEIGHT = canvas.height; // 600

// World dimensions
const WORLD_WIDTH = 5000; // Total width of the game world in pixels

// Game settings
const PLAYER_SPEED = 2; // Normal walking speed
const SPRINT_MULTIPLIER = 1.5; // Sprint speed multiplier
const PLAYER_JUMP_STRENGTH = 14; // Increased Jump Strength
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
    coinIcon: 'assets/images/coin-icon.png'
};

// Load all images
let loadedImages = 0;
const totalImages = Object.keys(imageSources).length;

for (let key in imageSources) {
    images[key] = new Image();
    images[key].src = imageSources[key];
    images[key].onload = () => {
        loadedImages++;
        if (loadedImages === totalImages) {
            // Enable the start button after all images are loaded
            const startButton = document.getElementById('startButton');
            if (startButton) {
                startButton.disabled = false;
            }
        }
    };
}

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
for (let key in soundSources) {
    sounds[key] = new Audio(soundSources[key]);
    if (key === 'background') {
        sounds[key].loop = true; // Loop the background music
        sounds[key].volume = 0.4; // Set volume to 40%
    } else {
        sounds[key].volume = 1.0; // Default volume for sound effects
    }
}

// Flags to track game state
let player;
let enemies = [];
let coins = [];
let platforms = [];
let gameOver = false;
let win = false;
let particles = []; // Declare particles once
let cameraX = 0; // Camera offset

// Deadzone settings
const DEADZONE_WIDTH = 200; // Width of the deadzone from the left
const DEADZONE_RIGHT_BOUND = GAME_WIDTH - DEADZONE_WIDTH; // Right boundary of deadzone

// Handle user input
const keys = {
    left: false,
    right: false,
    up: false,
    punch: false,
    sprint: false
};

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
        ctx.arc(this.x - cameraX, this.y, this.size, 0, Math.PI * 2);
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

    draw() {
        ctx.drawImage(images.platform, this.x - cameraX, this.y, this.width, this.height);
    }
}

// Player Class
class Player {
    constructor() {
        this.x = 100; // World X
        this.y = GAME_HEIGHT - 150; // World Y (above ground or on platform)
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
    }

    draw() {
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
}

// Enemy Class
class Enemy {
    constructor(x, y) {
        this.x = x; // World X
        this.y = y; // World Y (on ground)
        this.width = 50;
        this.height = 50;
        this.vx = 0; // Current horizontal velocity
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

        // Move enemy
        this.x += this.vx;

        // Prevent enemy from moving out of world bounds
        if (this.x < 0) {
            this.x = 0;
            this.vx = 0;
        }
        if (this.x + this.width > WORLD_WIDTH) {
            this.x = WORLD_WIDTH - this.width;
            this.vx = 0;
        }
    }

    draw() {
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
            this.frameCount += 1;
            if (this.frameCount >= 15) { // Adjust for animation speed
                this.frameCount = 0;
                this.animationFrame = (this.animationFrame + 1) % 2;
            }
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

    draw() {
        if (!this.collected) {
            ctx.drawImage(images.coin, this.x - cameraX, this.y, this.width, this.height);
        }
    }
}

// Function to create a particle
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
        ctx.drawImage(images.background, i * bgWidth - (cameraX % bgWidth), 0, bgWidth, GAME_HEIGHT - 50);
    }

    // Draw ground
    const groundWidth = images.ground.width;
    const groundHeight = images.ground.height;
    const groundCount = Math.ceil(GAME_WIDTH / groundWidth) + 1;

    for (let i = 0; i < groundCount; i++) {
        ctx.drawImage(images.ground, i * groundWidth - (cameraX % groundWidth), GAME_HEIGHT - 50, groundWidth, groundHeight);
    }

    // Draw platforms
    platforms.forEach(platform => platform.draw());

    // Draw coins
    coins.forEach(coin => coin.draw());

    // Draw enemies
    enemies.forEach(enemy => enemy.draw());

    // Draw player
    player.draw();

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
            <p>You Collected All Coins! You Win!</p>
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

// Restart Game
function restartGame() {
    // Reset game state
    player = new Player();
    enemies = [];
    coins = [];
    platforms = [];
    particles = [];
    gameOver = false;
    win = false;
    cameraX = 0;

    // Initialize game objects
    init();

    // Hide end message
    const endMessage = document.getElementById('endMessage');
    if (endMessage) {
        endMessage.classList.remove('show');
    }

    // Reset background music
    if (isMusicOn) {
        sounds.background.currentTime = 0;
        sounds.background.play();
    }

    // Reset lastTime for deltaTime calculation
    lastTime = 0;

    // Restart the game loop
    requestAnimationFrame(gameLoop);
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

// Initialize the game
function init() {
    player = new Player();

    // Create platforms first (needed for coin placement on platforms)
    platforms = []; // Reset platforms array
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

    // Calculate enemy Y-position to be on the ground
    const ENEMY_HEIGHT = 50; // Enemy height
    const enemyY = GAME_HEIGHT - 50 - ENEMY_HEIGHT; // Ground level is at GAME_HEIGHT - 50

    // Create enemies at specific positions (on ground)
    enemies = []; // Reset enemies array
    enemies.push(new Enemy(500, enemyY));
    enemies.push(new Enemy(800, enemyY));
    enemies.push(new Enemy(1100, enemyY));
    enemies.push(new Enemy(1300, enemyY));
    enemies.push(new Enemy(1600, enemyY));
    enemies.push(new Enemy(2000, enemyY));
    enemies.push(new Enemy(2500, enemyY));
    enemies.push(new Enemy(3000, enemyY));
    enemies.push(new Enemy(3500, enemyY));
    enemies.push(new Enemy(4000, enemyY));

    // Place 20 coins strategically (some on ground, some on platforms)
    coins = []; // Reset coins array
    for (let i = 1; i <= 20; i++) {
        let coinX = 200 + i * 200; // Increased spacing to spread out coins

        // Alternate between ground and platform placement
        let coinY;
        if (i % 5 === 0) { // Every 5th coin on a platform
            // Find a platform to place the coin on
            if (platforms.length > 0) {
                let platform = platforms[i % platforms.length];
                coinY = platform.y - 40; // Place the coin slightly above the platform
            } else {
                coinY = GAME_HEIGHT - 200;
            }
        } else {
            coinY = GAME_HEIGHT - 100; // On ground
        }

        coins.push(new Coin(coinX, coinY));
    }

    // Set up key event listeners after initializing the player
    setupKeyListeners();

    // Start the game loop
    requestAnimationFrame(gameLoop);
}

// Function to set up key event listeners
function setupKeyListeners() {
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
                player.isSprinting = true;
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
                player.isSprinting = false;
                break;
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
                // Player takes damage or game over
                gameOver = true;
                createParticle(player.x + player.width / 2, player.y + player.height / 2, '#000000'); // Black particles
                if (isSoundEffectsOn && sounds.gameOver) sounds.gameOver.play();
            }
        }
    });

    // Check collision with coins
    coins.forEach(coin => {
        if (!coin.collected && isColliding(player, coin)) {
            coin.collected = true;
            player.coinsCollected++;
            createParticle(coin.x + coin.width / 2, coin.y + coin.height / 2);
            if (isSoundEffectsOn && sounds.collectCoin) sounds.collectCoin.play();
            if (player.coinsCollected === 20) {
                win = true;
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
    if (player.y + player.height >= GAME_HEIGHT - 50) { // Ground is at GAME_HEIGHT - 50
        player.y = GAME_HEIGHT - 50 - player.height;
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

// Update Game Objects
function update(deltaTime, currentTime) {
    player.update(deltaTime, currentTime);

    enemies.forEach(enemy => {
        enemy.updateChase(player.x, player.y, deltaTime);
    });

    coins.forEach(coin => coin.update());

    // Platforms are static; no update needed

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

// Start Game Function
function startGame() {
    console.log("Start Game button clicked"); // Debugging line

    // Hide Start Screen
    const startScreen = document.getElementById('startScreen');
    startScreen.classList.add('hidden');

    // Show Game Elements
    const gameContainer = document.getElementById('gameContainer');
    const controlsContainer = document.getElementById('controlsContainer');
    const audioControls = document.getElementById('audioControls');

    if (gameContainer && controlsContainer && audioControls) {
        gameContainer.classList.remove('hidden');
        controlsContainer.classList.remove('hidden');
        audioControls.classList.remove('hidden');
    }

    // Start Background Music
    if (isMusicOn && sounds.background) {
        sounds.background.play().catch((error) => {
            console.error("Failed to play background music:", error);
        });
    }

    // Initialize Game Objects
    init();
}

// Add Event Listeners for Toggle Buttons
function setupAudioControls() {
    const toggleMusicBtn = document.getElementById('toggleMusic');
    const toggleSoundBtn = document.getElementById('toggleSound');

    if (toggleMusicBtn && toggleSoundBtn) {
        toggleMusicBtn.addEventListener('click', toggleMusic);
        toggleSoundBtn.addEventListener('click', toggleSoundEffects);
    }
}

// Add Event Listener for Start Button
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    // Disable the start button until images are loaded
    startButton.disabled = true;

    // Add click event listener to start the game
    startButton.addEventListener('click', startGame);

    // Setup audio controls (buttons are hidden initially)
    setupAudioControls();
});
