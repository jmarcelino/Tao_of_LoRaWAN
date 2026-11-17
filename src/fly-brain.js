import * as THREE from "three";
import { OBJLoader } from "../assets/vendor/OBJLoader.js";

export class FlyBrainScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.slide = canvas.closest(".slide--handovers");
    this.active = false;
    this.ready = false;
    this.frame = 0;
    this.lastTime = 0;
    this.elapsed = 0;
    this.pointer = new THREE.Vector2();
    this.pointerTarget = new THREE.Vector2();
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.motionQuery.matches;
    this.modelUrl = "./assets/vfb-banc-brain.obj";

    this.handlePointer = event => {
      if (this.reducedMotion) return;
      const bounds = this.slide.getBoundingClientRect();
      this.pointerTarget.set(
        ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
        ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
      );
    };
    this.handleMotion = event => {
      this.reducedMotion = event.matches;
      this.pointerTarget.set(0, 0);
      this.pointer.set(0, 0);
      this.stop();
      if (this.active) this.start();
    };
    this.handleVisibility = () => {
      if (document.hidden) this.stop();
      else if (this.active) this.start();
    };

    this.slide.addEventListener("pointermove", this.handlePointer, { passive: true });
    this.motionQuery.addEventListener("change", this.handleMotion);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  async initialise() {
    if (this.initialising) return this.initialising;
    this.initialising = (async () => {
      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          alpha: true,
          antialias: true,
          powerPreference: "low-power"
        });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
        this.camera.position.set(0, 0, 12);
        this.brain = new THREE.Group();
        this.scene.add(this.brain);

        this.scene.add(new THREE.HemisphereLight(0xc5e6e4, 0x101b27, 1.5));
        const key = new THREE.DirectionalLight(0xfce1b6, 2.2);
        key.position.set(-3, 5, 8);
        this.scene.add(key);
        const rim = new THREE.DirectionalLight(0x6fb8bd, 1.8);
        rim.position.set(6, 1, -3);
        this.scene.add(rim);

        const surface = new THREE.MeshPhongMaterial({
          color: 0x3b626d,
          emissive: 0x102b35,
          specular: 0xaf915f,
          shininess: 42,
          transparent: true,
          opacity: 0.54,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const wire = new THREE.MeshBasicMaterial({
          color: 0xd7ba82,
          wireframe: true,
          transparent: true,
          opacity: 0.14,
          depthWrite: false
        });
        const points = new THREE.PointsMaterial({
          color: 0xfce1b6,
          size: 0.026,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.34,
          depthWrite: false
        });

        const model = await new OBJLoader().loadAsync(this.modelUrl);
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const scale = 7.2 / size.x;
        model.scale.setScalar(scale);
        model.position.copy(center).multiplyScalar(-scale);

        const meshes = [];
        model.traverse(object => { if (object.isMesh) meshes.push(object); });
        meshes.forEach(object => {
          object.geometry.computeVertexNormals();
          object.material = surface;
          object.add(new THREE.Mesh(object.geometry, wire));
          object.add(new THREE.Points(object.geometry, points));
        });

        this.brain.add(model);
        this.createSignals(model, meshes, scale);
        this.brain.rotation.set(-0.1, -0.18, 0.025);
        this.ready = true;
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.slide);
        this.resize();
        this.slide.classList.add("brain-ready");
        this.render(performance.now());
      } catch {
        this.slide.classList.add("brain-fallback-only");
        this.stop();
      }
    })();
    return this.initialising;
  }

  createSignals(model, meshes, scale) {
    let seed = 0x62726169;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };

    const edges = new Map();
    meshes.forEach((object, meshIndex) => {
      object.updateMatrix();
      const positions = object.geometry.attributes.position;
      const index = object.geometry.index;
      const triangleCount = (index ? index.count : positions.count) / 3;
      const vertex = vertexIndex => new THREE.Vector3()
        .fromBufferAttribute(positions, vertexIndex)
        .applyMatrix4(object.matrix);

      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const offset = triangle * 3;
        const ids = [0, 1, 2].map(corner => index ? index.getX(offset + corner) : offset + corner);
        for (let edge = 0; edge < 3; edge += 1) {
          const first = ids[edge];
          const second = ids[(edge + 1) % 3];
          const key = `${meshIndex}:${Math.min(first, second)}:${Math.max(first, second)}`;
          if (edges.has(key)) continue;
          const a = vertex(first);
          const b = vertex(second);
          const length = a.distanceTo(b) * scale;
          if (length >= 0.045) edges.set(key, { a, b, length });
        }
      }
    });

    const selected = [...edges.values()]
      .map(edge => ({ ...edge, score: edge.length * (0.65 + random() * 0.7) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 96);

    this.signalPaths = selected.map(edge => ({
      a: edge.a,
      b: edge.b,
      phase: random(),
      speed: 0.18 + random() * 0.22,
      colour: random() > 0.22 ? [1.0, 0.82, 0.5] : [0.48, 0.88, 0.9]
    }));

    const count = this.signalPaths.length;
    const routeGeometry = new THREE.BufferGeometry().setFromPoints(
      this.signalPaths.flatMap(path => [path.a, path.b])
    );
    const routes = new THREE.LineSegments(routeGeometry, new THREE.LineBasicMaterial({
      color: 0xd7ba82,
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    }));
    const headGeometry = new THREE.BufferGeometry();
    headGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    headGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 6), 3).setUsage(THREE.DynamicDrawUsage));
    trailGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 6), 3).setUsage(THREE.DynamicDrawUsage));

    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = 64;
    spriteCanvas.height = 64;
    const context = spriteCanvas.getContext("2d");
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.18, "rgba(255,255,255,.95)");
    glow.addColorStop(0.45, "rgba(255,255,255,.28)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(spriteCanvas);

    this.signalHeads = new THREE.Points(headGeometry, new THREE.PointsMaterial({
      map: sprite,
      size: 0.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    }));
    this.signalTrails = new THREE.LineSegments(trailGeometry, new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.88,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    }));
    model.add(routes, this.signalTrails, this.signalHeads);
  }

  updateSignals() {
    if (!this.signalHeads) return;
    const headPositions = this.signalHeads.geometry.attributes.position;
    const headColours = this.signalHeads.geometry.attributes.color;
    const trailPositions = this.signalTrails.geometry.attributes.position;
    const trailColours = this.signalTrails.geometry.attributes.color;

    this.signalPaths.forEach((path, index) => {
      const progress = (this.elapsed * path.speed + path.phase) % 1;
      const trailStart = Math.max(0, progress - 0.2);
      const strength = Math.pow(Math.sin(Math.PI * progress), 0.55);
      const x = path.a.x + (path.b.x - path.a.x) * progress;
      const y = path.a.y + (path.b.y - path.a.y) * progress;
      const z = path.a.z + (path.b.z - path.a.z) * progress;
      const tailX = path.a.x + (path.b.x - path.a.x) * trailStart;
      const tailY = path.a.y + (path.b.y - path.a.y) * trailStart;
      const tailZ = path.a.z + (path.b.z - path.a.z) * trailStart;

      headPositions.setXYZ(index, x, y, z);
      headColours.setXYZ(index,
        path.colour[0] * strength * 1.7,
        path.colour[1] * strength * 1.7,
        path.colour[2] * strength * 1.7
      );
      trailPositions.setXYZ(index * 2, tailX, tailY, tailZ);
      trailPositions.setXYZ(index * 2 + 1, x, y, z);
      trailColours.setXYZ(index * 2, 0, 0, 0);
      trailColours.setXYZ(index * 2 + 1,
        path.colour[0] * strength,
        path.colour[1] * strength,
        path.colour[2] * strength
      );
    });

    headPositions.needsUpdate = true;
    headColours.needsUpdate = true;
    trailPositions.needsUpdate = true;
    trailColours.needsUpdate = true;
  }

  resize() {
    if (!this.renderer || !this.ready) return;
    const width = this.slide.clientWidth;
    const height = this.slide.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = aspect;
    this.camera.position.z = aspect < 0.85 ? 15 : 12;
    this.camera.updateProjectionMatrix();

    if (aspect < 0.85) {
      this.brain.scale.setScalar(0.58);
      this.brain.position.set(0.2, 2.35, 0);
    } else if (aspect < 1.2) {
      this.brain.scale.setScalar(0.86);
      this.brain.position.set(1.1, 1.15, 0);
    } else {
      this.brain.scale.setScalar(0.94);
      this.brain.position.set(2.2, 0.3, 0);
    }
    this.render(performance.now());
  }

  setActive(active) {
    this.active = active;
    if (!active) {
      this.stop();
      return;
    }
    this.initialise().then(() => this.start());
  }

  start() {
    if (!this.ready || !this.active || document.hidden) return;
    if (this.reducedMotion) {
      this.render(performance.now());
      return;
    }
    if (!this.frame) {
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(time => this.render(time));
    }
  }

  stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  render(time) {
    if (!this.ready || !this.renderer) return;
    this.frame = 0;
    const delta = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    if (!this.reducedMotion && this.active) this.elapsed += delta;

    this.pointer.lerp(this.pointerTarget, 0.035);
    this.brain.rotation.y = -0.18 + Math.sin(this.elapsed * 0.2) * 0.15 + this.pointer.x * 0.055;
    this.brain.rotation.x = -0.1 + Math.cos(this.elapsed * 0.16) * 0.035 + this.pointer.y * 0.035;
    this.updateSignals();
    this.renderer.render(this.scene, this.camera);

    if (this.active && !this.reducedMotion && !document.hidden) {
      this.frame = requestAnimationFrame(next => this.render(next));
    }
  }
}
