// game.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game dimensions
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

// Adjusted game settings
const PLAYER_SPEED = 2; // Slowed down from 3
const PLAYER_JUMP_STRENGTH = 12; // Slowed down from 15
const GRAVITY = 0.5; // Slowed down from 0.7

// Load images
const images = {};
const imageSources = {
    idle: 'assets/images/turtle-idle.png',
    walk1: 'assets/images/turtle-walk1.png',
    walk2: 'assets/images/turtle-walk2.png',
    jump: 'assets/images/turtle-jump.png',
    punch: 'assets/images/turtle-punch.png',
    enemy: 'assets/images/bad-turtle.png',
    coin: 'assets/images/coin.png',
    background: 'assets/images/background.png',
    ground: 'assets/images/ground.png',
    platform: 'assets/images/platform.png', // New platform image
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
            init(); // Start the game once all images are loaded
        }
    };
}

// Load audio (Optional)
const sounds = {};
const soundSources = {
    jump: 'assets/audio/jump.wav',
    punch: 'assets/audio/punch.wav',
    collectCoin: 'assets/audio/collect-coin.wav',
    gameOver: 'assets/audio/game-over.wav'
};

for (let key in soundSources) {
    sounds[key] = new Audio(soundSources[key]);
}

// Handle user input
const keys = {
    left: false,
    right: false,
    up: false,
    punch: false
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
            keys.punch = true;
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
        this.x = 100; // World X
        this.y = GAME_HEIGHT - 150; // World Y (above ground)
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
    }

    update() {
        // Handle horizontal movement
        if (keys.left) {
            this.vx = -this.speed;
            if (this.onGround) this.state = 'walking';
        } else if (keys.right) {
            this.vx = this.speed;
            if (this.onGround) this.state = 'walking';
        } else {
            this.vx = 0;
            if (this.onGround && !keys.punch) this.state = 'idle';
        }

        // Handle jumping
        if (keys.up && this.onGround) {
            this.vy = -this.jumpStrength;
            this.onGround = false;
            this.state = 'jumping';
            if (sounds.jump) sounds.jump.play();
        }

        // Handle punching
        if (keys.punch && this.onGround) {
            this.state = 'punching';
            // To prevent continuous punching, implement a cooldown or animation lock
            if (sounds.punch) sounds.punch.play();
        }

        // Apply gravity
        this.vy += this.gravity;
        this.y += this.vy;
        this.x += this.vx;

        // Prevent moving out of world bounds (left side)
        if (this.x < 0) this.x = 0;

        // Handle animation frames
        this.frameCount++;
        if (this.frameCount >= 10) { // Adjust for animation speed
            this.frameCount = 0;
            this.animationFrame = (this.animationFrame + 1) % 2;
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
        ctx.drawImage(img, this.x - cameraX, this.y, this.width, this.height);
    }
}

// Enemy Class
class Enemy {
    constructor(x, y) {
        this.x = x; // World X
        this.y = y; // World Y
        this.width = 50;
        this.height = 50;
        this.vx = -2; // Enemy speed moving left
        this.alive = true;
    }

    update() {
        this.x += this.vx;

        // Remove enemy if it goes off-screen (left side)
        if (this.x + this.width < 0) {
            this.alive = false;
        }
    }

    draw(cameraX) {
        if (this.alive) {
            ctx.drawImage(images.enemy, this.x - cameraX, this.y, this.width, this.height);
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

    // Create enemies at specific positions
    enemies.push(new Enemy(500, GAME_HEIGHT - 100));
    enemies.push(new Enemy(800, GAME_HEIGHT - 100));
    enemies.push(new Enemy(1100, GAME_HEIGHT - 100));

    // Place 20 coins strategically
    for (let i = 1; i <= 20; i++) {
        let coinX = 200 + i * 100; // Adjust spacing as needed
        let coinY = GAME_HEIGHT - 200 - (i % 5) * 30; // Vary the height
        coins.push(new Coin(coinX, coinY));
    }

    // Create platforms
    platforms.push(new Platform(400, GAME_HEIGHT - 150, 150, 20));
    platforms.push(new Platform(700, GAME_HEIGHT - 220, 200, 20));
    platforms.push(new Platform(1000, GAME_HEIGHT - 180, 170, 20));

    requestAnimationFrame(gameLoop);
}

// Create a particle
function createParticle(x, y, color = '#FFD700') { // Default color gold
    particles.push(new Particle(x, y, color));
}

// Update particles
function updateParticles() {
    particles.forEach((particle, index) => {
        particle.update();
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        }
    });
}

// Game Loop
function gameLoop() {
    update();
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
                if (sounds.punch) sounds.punch.play();
            } else if (keys.punch) {
                // Player is punching
                enemy.alive = false;
                createParticle(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#FF0000'); // Red particles
                if (sounds.punch) sounds.punch.play();
            } else {
                // Player takes damage or game over
                gameOver = true;
                createParticle(player.x + player.width / 2, player.y + player.height / 2, '#000000'); // Black particles
                if (sounds.gameOver) sounds.gameOver.play();
            }
        }
    });

    // Check collision with coins
    coins.forEach(coin => {
        if (!coin.collected && isColliding(player, coin)) {
            coin.collected = true;
            player.coinsCollected++;
            createParticle(coin.x + coin.width / 2, coin.y + coin.height / 2);
            if (sounds.collectCoin) sounds.collectCoin.play();
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
                if (player.vx === 0 && !keys.punch) {
                    player.state = 'idle';
                }
            }
        }
    });

    // Check collision with ground
    if (player.y + player.height >= GAME_HEIGHT - 50) { // Ground is at GAME_HEIGHT - 50
        player.y = GAME_HEIGHT - 50 - player.height;
        player.vy = 0;
        player.onGround = true;
        if (player.vx === 0 && !keys.punch) {
            player.state = 'idle';
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
function update() {
    player.update();

    enemies.forEach(enemy => enemy.update());
    enemies = enemies.filter(enemy => enemy.alive); // Remove dead enemies

    coins.forEach(coin => coin.update());

    platforms.forEach(platform => {
        // Platforms are static; no update needed unless they move
    });

    checkCollisions();

    updateParticles();

    // Update camera position based on player position
    if (player.x - cameraX > DEADZONE_RIGHT_BOUND) {
        cameraX = player.x - DEADZONE_RIGHT_BOUND;
    }

    // Optional: Prevent camera from moving left beyond the world start
    if (cameraX < 0) cameraX = 0;
}

// Update HUD
function updateHUD() {
    const coinCounter = document.getElementById('coinCounter');
    coinCounter.innerHTML = `<img src="assets/images/coin-icon.png" alt="Coin" /> Coins: ${player.coinsCollected}/20`;
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
    platforms.forEach(platform => platform.draw(cameraX));

    // Draw coins
    coins.forEach(coin => coin.draw(cameraX));

    // Draw enemies
    enemies.forEach(enemy => enemy.draw(cameraX));

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

    // Create enemies again
    enemies.push(new Enemy(500, GAME_HEIGHT - 100));
    enemies.push(new Enemy(800, GAME_HEIGHT - 100));
    enemies.push(new Enemy(1100, GAME_HEIGHT - 100));

    // Place 20 coins strategically
    for (let i = 1; i <= 20; i++) {
        let coinX = 200 + i * 100; // Adjust spacing as needed
        let coinY = GAME_HEIGHT - 200 - (i % 5) * 30; // Vary the height
        coins.push(new Coin(coinX, coinY));
    }

    // Create platforms
    platforms.push(new Platform(400, GAME_HEIGHT - 150, 150, 20));
    platforms.push(new Platform(700, GAME_HEIGHT - 220, 200, 20));
    platforms.push(new Platform(1000, GAME_HEIGHT - 180, 170, 20));

    // Hide end message
    if (endMessage) {
        endMessage.classList.remove('show');
    }

    // Restart the game loop
    requestAnimationFrame(gameLoop);
}
