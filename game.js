 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/game.js b/game.js
index 5d68af3bef01d3d9a8fc15e8724f4c2db84a4b14..3431d826d1a0664a0fd503ee87952095cdbedb5d 100644
--- a/game.js
+++ b/game.js
@@ -100,62 +100,118 @@ const keys = {
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

 

-document.addEventListener('keyup', (e) => {

-    switch(e.code) {

-        case 'KeyA': keys.left = false; break;

-        case 'KeyD': keys.right = false; break;

-        case 'KeyW':

-        case 'Space': keys.up = false; break;

-        case 'ControlLeft':

-        case 'ControlRight': keys.punch = false; break;

-        case 'ShiftLeft':

-        case 'ShiftRight': keys.sprint = false; break;

-    }

-});

+document.addEventListener('keyup', (e) => {
+    switch(e.code) {
+        case 'KeyA': keys.left = false; break;
+        case 'KeyD': keys.right = false; break;
+        case 'KeyW':
+        case 'Space': keys.up = false; break;
+        case 'ControlLeft':
+        case 'ControlRight': keys.punch = false; break;
+        case 'ShiftLeft':
+        case 'ShiftRight': keys.sprint = false; break;
+    }
+});
+
+// Mobile touch controls
+let touchSide = null;
+let touchStartTime = 0;
+const tapThreshold = 200;
+const doubleTapTimeout = 300;
+const lastTap = { left: 0, right: 0 };
+
+const getTouchSide = (x) => {
+    const width = canvas.getBoundingClientRect().width;
+    if (x < width / 3) return 'left';
+    if (x > (2 * width) / 3) return 'right';
+    return 'middle';
+};
+
+canvas.addEventListener('touchstart', (e) => {
+    if (e.touches.length > 1) return;
+    const touch = e.touches[0];
+    const side = getTouchSide(touch.clientX);
+    touchSide = side;
+    touchStartTime = Date.now();
+
+    if (side === 'left') {
+        keys.left = true;
+        if (Date.now() - lastTap.left < doubleTapTimeout) keys.sprint = true;
+    } else if (side === 'right') {
+        keys.right = true;
+        if (Date.now() - lastTap.right < doubleTapTimeout) keys.sprint = true;
+    } else {
+        keys.up = true;
+        setTimeout(() => { keys.up = false; }, 150);
+    }
+});
+
+canvas.addEventListener('touchend', () => {
+    const now = Date.now();
+    if (touchSide === 'left') {
+        keys.left = false;
+        if (now - touchStartTime < tapThreshold) lastTap.left = now;
+    } else if (touchSide === 'right') {
+        keys.right = false;
+        if (now - touchStartTime < tapThreshold) lastTap.right = now;
+    } else if (touchSide === 'middle') {
+        keys.up = false;
+    }
+    keys.sprint = false;
+    touchSide = null;
+});
+
+canvas.addEventListener('touchcancel', () => {
+    keys.left = false;
+    keys.right = false;
+    keys.up = false;
+    keys.sprint = false;
+    touchSide = null;
+});
 

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

 
EOF
)
