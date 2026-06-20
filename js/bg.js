// Hidaka Komik — "Ink Void" background
// Drifting smoke-like purple/magenta particles over a sparse starfield.
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 12;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  function makeSpriteTexture() {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }
  const spriteTex = makeSpriteTexture();

  const starCount = 350;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 60;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 60;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 5;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.06,
    map: spriteTex,
    transparent: true,
    opacity: 0.8,
    color: 0xe8d9ff,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const inkCount = 70;
  const inkGeo = new THREE.BufferGeometry();
  const inkPos = new Float32Array(inkCount * 3);
  const inkSpeed = new Float32Array(inkCount);
  const inkPhase = new Float32Array(inkCount);
  const colors = [
    new THREE.Color(0xb026ff),
    new THREE.Color(0x7c3aed),
    new THREE.Color(0xff4fd8)
  ];
  const inkColor = new Float32Array(inkCount * 3);

  for (let i = 0; i < inkCount; i++) {
    inkPos[i * 3] = (Math.random() - 0.5) * 30;
    inkPos[i * 3 + 1] = (Math.random() - 0.5) * 24;
    inkPos[i * 3 + 2] = (Math.random() - 0.5) * 18 - 4;
    inkSpeed[i] = 0.05 + Math.random() * 0.12;
    inkPhase[i] = Math.random() * Math.PI * 2;
    const c = colors[Math.floor(Math.random() * colors.length)];
    inkColor[i * 3] = c.r;
    inkColor[i * 3 + 1] = c.g;
    inkColor[i * 3 + 2] = c.b;
  }
  inkGeo.setAttribute('position', new THREE.BufferAttribute(inkPos, 3));
  inkGeo.setAttribute('color', new THREE.BufferAttribute(inkColor, 3));

  const inkMat = new THREE.PointsMaterial({
    size: 3.2,
    map: spriteTex,
    transparent: true,
    opacity: 0.16,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const ink = new THREE.Points(inkGeo, inkMat);
  scene.add(ink);

  let mouseX = 0, mouseY = 0;
  let targetX = 0, targetY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!e.touches.length) return;
    mouseX = (e.touches[0].clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.touches[0].clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    const pos = ink.geometry.attributes.position.array;
    for (let i = 0; i < inkCount; i++) {
      const idx = i * 3;
      pos[idx] += Math.sin(t * inkSpeed[i] + inkPhase[i]) * 0.003;
      pos[idx + 1] += inkSpeed[i] * 0.01;
      if (pos[idx + 1] > 14) pos[idx + 1] = -14;
    }
    ink.geometry.attributes.position.needsUpdate = true;
    ink.rotation.z = t * 0.005;

    stars.rotation.y = t * 0.003;

    targetX += (mouseX - targetX) * 0.02;
    targetY += (mouseY - targetY) * 0.02;
    camera.position.x = targetX * 0.6;
    camera.position.y = -targetY * 0.4;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();