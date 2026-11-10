import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import useStore from '../store/useStore'
import { RACERS_CONFIG, TRACK_START_X, TRACK_FINISH_X, TRACK_LENGTH } from '../constants'
import { sfx } from '../lib/sound'

export default function ThreeScene({ realtimeChannel }) {
  const containerRef = useRef(null)
  const labelsRef = useRef(null)
  const sceneDataRef = useRef(null)
  const animFrameRef = useRef(null)

  const nickname = useStore((s) => s.nickname)
  const phase = useStore((s) => s.phase)
  const selectedRacerId = useStore((s) => s.selectedRacerId)
  const cameraMode = useStore((s) => s.cameraMode)
  const onlineUsers = useStore((s) => s.onlineUsers)
  const setPhase = useStore((s) => s.setPhase)
  const setRaceElapsed = useStore((s) => s.setRaceElapsed)
  const setFinishOrder = useStore((s) => s.setFinishOrder)
  const setBroadcastText = useStore((s) => s.setBroadcastText)
  const setRaceStartTime = useStore((s) => s.setRaceStartTime)

  // Refs to avoid stale closures
  const phaseRef = useRef(phase)
  const selectedRef = useRef(selectedRacerId)
  const cameraModeRef = useRef(cameraMode)
  const onlineUsersRef = useRef(onlineUsers)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { selectedRef.current = selectedRacerId }, [selectedRacerId])
  useEffect(() => { cameraModeRef.current = cameraMode }, [cameraMode])
  useEffect(() => { onlineUsersRef.current = onlineUsers }, [onlineUsers])

  // Move keys state (not in zustand for performance)
  const moveKeysRef = useRef({
    KeyW: false, KeyA: false, KeyS: false, KeyD: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
  })

  // Expose setMoveKey globally for D-Pad
  useEffect(() => {
    window.__setMoveKey = (code, pressed) => {
      moveKeysRef.current[code] = pressed
    }
    return () => { delete window.__setMoveKey }
  }, [])

  // Build entire Three.js scene
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x030914)
    scene.fog = new THREE.FogExp2(0x030914, 0.0062)

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    const clock = new THREE.Clock()

    const camOrbit = {
      isDragging: false,
      prevX: 0, prevY: 0,
      theta: 0.08, phi: 0.54,
      radius: 54,
      target: new THREE.Vector3(0, 1.5, 3),
    }

    // --- Lights ---
    scene.add(new THREE.AmbientLight(0x1e3a8a, 1.35))
    const hemi = new THREE.HemisphereLight(0x38bdf8, 0x091326, 1.15)
    hemi.position.set(0, 65, 0)
    scene.add(hemi)
    const dirLight = new THREE.DirectionalLight(0x67e8f9, 1.45)
    dirLight.position.set(18, 68, 28)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    const d = 68
    dirLight.shadow.camera.left = -d; dirLight.shadow.camera.right = d
    dirLight.shadow.camera.top = d; dirLight.shadow.camera.bottom = -d
    scene.add(dirLight)
    const startLight = new THREE.PointLight(0x00f2fe, 2.2, 45)
    startLight.position.set(TRACK_START_X, 9, 0)
    scene.add(startLight)
    const finishLight = new THREE.PointLight(0xf43f5e, 2.6, 50)
    finishLight.position.set(TRACK_FINISH_X, 11, 0)
    scene.add(finishLight)

    // --- Seabed & Track ---
    const floorGeo = new THREE.PlaneGeometry(320, 240, 28, 28)
    const pos = floorGeo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i); const vy = pos.getY(i)
      if (Math.abs(vy) > 22) {
        pos.setZ(i, Math.sin(vx * 0.08) * Math.cos(vy * 0.08) * 2.2)
      }
    }
    floorGeo.computeVertexNormals()
    const floorMesh = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x061325, roughness: 0.9 }))
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.position.y = -0.35
    floorMesh.receiveShadow = true
    scene.add(floorMesh)

    const trackWidth = 24
    const trackTotalLen = TRACK_LENGTH + 24
    const trackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(trackTotalLen, 0.5, trackWidth),
      new THREE.MeshStandardMaterial({ color: 0x102a49, roughness: 0.7 }),
    )
    trackMesh.position.set(0, -0.05, 0)
    trackMesh.receiveShadow = true
    scene.add(trackMesh)

    ;[-12, -6, 0, 6, 12].forEach((zPos, idx) => {
      const isOuter = idx === 0 || idx === 4
      const lineMesh = new THREE.Mesh(
        new THREE.BoxGeometry(trackTotalLen, isOuter ? 0.45 : 0.2, isOuter ? 0.45 : 0.22),
        new THREE.MeshBasicMaterial({ color: isOuter ? 0x00f2fe : 0x0284c7 }),
      )
      lineMesh.position.set(0, 0.25, zPos)
      scene.add(lineMesh)
    })

    for (let x = TRACK_START_X; x <= TRACK_FINISH_X; x += 26) {
      const isEdge = x === TRACK_START_X || x === TRACK_FINISH_X
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(isEdge ? 1.6 : 0.45, trackWidth),
        new THREE.MeshBasicMaterial({
          color: x === TRACK_FINISH_X ? 0xf43f5e : (x === TRACK_START_X ? 0x00f2fe : 0x1d4ed8),
          side: THREE.DoubleSide,
        }),
      )
      stripe.rotation.x = -Math.PI / 2
      stripe.position.set(x, 0.22, 0)
      scene.add(stripe)
    }

    // Coral crystals
    const coralCols = [0x00f2fe, 0xf43f5e, 0xa855f7, 0x10b981, 0xfbbf24]
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const rx = (Math.random() - 0.5) * 150
      const rz = side * (21 + Math.random() * 32)
      if (rz > 13 && rz < 30 && Math.abs(rx) < 42) continue
      const h = 2 + Math.random() * 5.5
      const col = coralCols[i % coralCols.length]
      const crystal = new THREE.Mesh(
        new THREE.ConeGeometry(1.1 + Math.random() * 1.4, h, 6),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.38, roughness: 0.4 }),
      )
      crystal.position.set(rx, h / 2, rz)
      scene.add(crystal)
    }

    // --- Gates ---
    const pillarGeo = new THREE.CylinderGeometry(0.55, 0.75, 9, 12)
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.3 })
    ;[-13, 13].forEach((z) => {
      const p = new THREE.Mesh(pillarGeo, pillarMat)
      p.position.set(TRACK_START_X, 4.5, z)
      scene.add(p)
    })

    const startGateBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 26, 12),
      new THREE.MeshBasicMaterial({ color: 0x00f2fe }),
    )
    startGateBar.rotation.x = Math.PI / 2
    startGateBar.position.set(TRACK_START_X + 1.6, 2.2, 0)
    scene.add(startGateBar)

    const archGroup = new THREE.Group()
    const archMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xbe123c, emissiveIntensity: 0.5 })
    ;[-13, 13].forEach((z) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.0, 12.5, 12), archMat)
      p.position.set(0, 6.25, z)
      archGroup.add(p)
    })
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 28), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }))
    topBar.position.set(0, 12.5, 0)
    archGroup.add(topBar)
    archGroup.position.set(TRACK_FINISH_X, 0, 0)
    scene.add(archGroup)

    // --- Spectator Deck ---
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(82, 0.8, 10),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 }),
    )
    deck.position.set(0, 0.3, 18.5)
    deck.receiveShadow = true
    scene.add(deck)
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(82, 0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: 0x00f2fe }),
    )
    rail.position.set(0, 2.0, 13.8)
    scene.add(rail)

    // --- Player Avatar ---
    const avatarGroup = new THREE.Group()
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.4, 24),
      new THREE.MeshBasicMaterial({ color: 0x00f2fe, side: THREE.DoubleSide }),
    )
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.82
    avatarGroup.add(ring)
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.78, 1.8, 12),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.3 }),
    )
    body.position.y = 1.7
    avatarGroup.add(body)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.25, roughness: 0.2 }),
    )
    head.position.y = 3.0
    avatarGroup.add(head)
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.42, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    )
    visor.position.set(0, 3.02, -0.52)
    avatarGroup.add(visor)
    avatarGroup.position.set(0, 0, 18)
    scene.add(avatarGroup)

    const avatarLabelEl = createWorldLabel(
      `🤿 ${nickname}`,
      'pixel-box-cyan text-[10px] px-2 py-0.5 text-white font-bold',
    )

    // --- NPC Spectators ---
    const npcSpectators = []
    const npcs = [
      { name: '복어군 🐡', x: -22, z: 17, col: 0xfbbf24, chat: '새우 가즈아!' },
      { name: '소라양 🐚', x: -10, z: 19.5, col: 0xf472b6, chat: '꽃게 정배!' },
      { name: '상어형 🦈', x: 4, z: 16.8, col: 0x60a5fa, chat: '문어 역배각!' },
      { name: '해파리 🪼', x: 18, z: 19, col: 0xc084fc, chat: '올인했다ㅋㅋ' },
    ]
    npcs.forEach((n, idx) => {
      const g = new THREE.Group()
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 12, 12),
        new THREE.MeshStandardMaterial({ color: n.col, roughness: 0.4 }),
      )
      m.position.y = 1.55
      g.add(m)
      g.position.set(n.x, 0, n.z)
      scene.add(g)
      const lbl = createWorldLabel(
        `<span class="text-cyan-300">${n.name}</span> <span class="hidden sm:inline text-white">"${n.chat}"</span>`,
        'pixel-box-subtle text-[10px] px-1.5 py-0.5',
      )
      npcSpectators.push({ group: g, labelEl: lbl, phaseOffset: idx * 1.3 })
    })

    // --- Online Player Avatars (other users) ---
    const remoteAvatars = {}

    function createRemoteAvatar(userId, nick, isRemoteAdmin = false) {
      const g = new THREE.Group()
      const rBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.7, 1.6, 10),
        new THREE.MeshStandardMaterial({ color: isRemoteAdmin ? 0xf59e0b : 0x38bdf8, roughness: 0.3 }),
      )
      rBody.position.y = 1.5
      g.add(rBody)
      const rHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.2, roughness: 0.2 }),
      )
      rHead.position.y = 2.7
      g.add(rHead)
      const rVisor = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 0.36, 0.45),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
      )
      rVisor.position.set(0, 2.72, -0.45)
      g.add(rVisor)
      g.position.set(Math.random() * 10 - 5, 0, 18)
      scene.add(g)

      const lbl = createWorldLabel(
        `🤿 ${isRemoteAdmin ? '👑 ' : ''}${nick}`,
        isRemoteAdmin
          ? 'bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full text-[9px] shadow border border-white'
          : 'bg-sky-500/80 text-white font-bold px-2 py-0.5 rounded-full text-[9px] shadow border border-sky-300/50',
      )

      remoteAvatars[userId] = { group: g, labelEl: lbl }
    }

    function removeRemoteAvatar(userId) {
      const ra = remoteAvatars[userId]
      if (ra) {
        scene.remove(ra.group)
        ra.labelEl.remove()
        delete remoteAvatars[userId]
      }
    }

    // --- Sea Creature Meshes ---
    function createSeaCreatureMesh(cfg) {
      const root = new THREE.Group()
      const mainMat = new THREE.MeshStandardMaterial({ color: cfg.colorHex, roughness: 0.32, metalness: 0.15 })
      const subMat = new THREE.MeshStandardMaterial({ color: cfg.accentHex, roughness: 0.4 })
      const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff })
      const eyePupil = new THREE.MeshBasicMaterial({ color: 0x0f172a })

      if (cfg.id === 0) {
        for (let i = 0; i < 4; i++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(1.12 - i * 0.15, 12, 12), i % 2 === 0 ? mainMat : subMat)
          seg.scale.set(1.3, 0.95, 0.9)
          seg.position.set(-i * 1.05, 1.35 - i * 0.08, 0)
          root.add(seg)
        }
        const tail = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.5, 5), subMat)
        tail.rotation.z = -Math.PI / 2
        tail.position.set(-4.0, 1.0, 0)
        root.add(tail)
      } else if (cfg.id === 1) {
        const shell = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 12), mainMat)
        shell.scale.set(1.1, 0.65, 1.42)
        shell.position.set(0, 1.3, 0)
        root.add(shell)
        ;[-1.45, 1.45].forEach((z) => {
          const claw = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72), subMat)
          claw.position.set(1.15, 1.95, z)
          root.add(claw)
        })
      } else if (cfg.id === 2) {
        const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.02, 3.6, 12), mainMat)
        bodyMesh.rotation.z = Math.PI / 2
        bodyMesh.position.set(-0.4, 1.25, 0)
        root.add(bodyMesh)
        ;[-1.3, 1.3].forEach((z) => {
          const claw = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.62, 0.85), subMat)
          claw.position.set(1.75, 1.25, z)
          root.add(claw)
        })
      } else {
        const headM = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), mainMat)
        headM.scale.set(1.12, 1.28, 1.08)
        headM.position.set(0, 2.05, 0)
        root.add(headM)
        for (let t = 0; t < 8; t++) {
          const ang = (t / 8) * Math.PI * 2
          const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.38, 1.7, 8), subMat)
          tent.position.set(Math.cos(ang) * 1.15, 0.8, Math.sin(ang) * 1.15)
          root.add(tent)
        }
      }

      ;[-0.45, 0.45].forEach((z) => {
        const ew = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), eyeWhite)
        ew.position.set(1.15, 1.9, z)
        const ep = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), eyePupil)
        ep.position.set(1.34, 1.92, z)
        root.add(ew, ep)
      })

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(1.55, 1.95, 24),
        new THREE.MeshBasicMaterial({ color: cfg.colorHex, side: THREE.DoubleSide }),
      )
      halo.rotation.x = -Math.PI / 2
      halo.position.y = 0.24
      root.add(halo)

      return root
    }

    // Build racers
    const racers = RACERS_CONFIG.map((cfg) => {
      const mesh = createSeaCreatureMesh(cfg)
      mesh.position.set(TRACK_START_X, 0, cfg.laneZ)
      scene.add(mesh)
      const labelEl = createWorldLabel(
        `${cfg.emoji} ${cfg.name}`,
        'pixel-box text-[10px] px-1.5 py-0.5 text-white font-bold',
      )
      return {
        ...cfg,
        mesh,
        labelEl,
        x: TRACK_START_X,
        currentSpeed: 0,
        boostTimer: 0,
        playerBoostTimer: 0,
        finished: false,
        finishTime: 0,
        rank: cfg.lane,
      }
    })

    // --- Bubbles ---
    const count = 220
    const bubbleGeo = new THREE.BufferGeometry()
    const bubblePositions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      bubblePositions[i * 3] = (Math.random() - 0.5) * 145
      bubblePositions[i * 3 + 1] = Math.random() * 42
      bubblePositions[i * 3 + 2] = (Math.random() - 0.5) * 85
    }
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3))
    const bubblesSystem = new THREE.Points(
      bubbleGeo,
      new THREE.PointsMaterial({ color: 0x00f2fe, size: 0.6, transparent: true, opacity: 0.6 }),
    )
    scene.add(bubblesSystem)

    const boostRings = []
    const celebrationParticles = []

    // --- Helper: World Labels ---
    function createWorldLabel(html, className) {
      const el = document.createElement('div')
      el.className = `world-label ${className}`
      el.innerHTML = html
      labelsRef.current?.appendChild(el)
      return el
    }

    function updateWorldLabelPosition(el, worldPos, yOffset = 3.6) {
      const v = worldPos.clone()
      v.y += yOffset
      v.project(camera)
      if (v.z > 1) { el.style.opacity = '0'; return }
      el.style.opacity = '1'
      el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`
      el.style.top = `${(-(v.y * 0.5) + 0.5) * window.innerHeight}px`
    }

    // --- Responsive Camera ---
    function adjustResponsiveCamera() {
      const aspect = window.innerWidth / window.innerHeight
      if (aspect < 0.75) { camera.fov = 68; camOrbit.radius = 74 }
      else if (aspect < 1.1) { camera.fov = 58; camOrbit.radius = 62 }
      else { camera.fov = 48; camOrbit.radius = 50 }
      camera.aspect = aspect
      camera.updateProjectionMatrix()
    }
    adjustResponsiveCamera()

    // --- Pointer Controls ---
    const domEl = renderer.domElement
    domEl.addEventListener('pointerdown', (e) => {
      camOrbit.isDragging = true; camOrbit.prevX = e.clientX; camOrbit.prevY = e.clientY
    })
    window.addEventListener('pointermove', (e) => {
      if (!camOrbit.isDragging) return
      camOrbit.theta -= (e.clientX - camOrbit.prevX) * 0.0065
      camOrbit.phi = Math.max(0.2, Math.min(1.32, camOrbit.phi - (e.clientY - camOrbit.prevY) * 0.0065))
      camOrbit.prevX = e.clientX; camOrbit.prevY = e.clientY
    })
    window.addEventListener('pointerup', () => { camOrbit.isDragging = false })
    domEl.addEventListener('wheel', (e) => {
      camOrbit.radius = Math.max(24, Math.min(100, camOrbit.radius + e.deltaY * 0.04))
    }, { passive: true })

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (moveKeysRef.current.hasOwnProperty(e.code)) moveKeysRef.current[e.code] = true
    })
    window.addEventListener('keyup', (e) => {
      if (moveKeysRef.current.hasOwnProperty(e.code)) moveKeysRef.current[e.code] = false
    })

    // Resize
    function onResize() {
      adjustResponsiveCamera()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // --- Boost ring spawner ---
    function spawnBoostRing(pos, colorHex) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1.35, 24),
        new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
      )
      mesh.rotation.y = Math.PI / 2
      mesh.position.set(pos.x - 1.1, pos.y + 1.4, pos.z)
      scene.add(mesh)
      boostRings.push({ mesh, age: 0 })
    }

    function spawnCelebrationFireworks(pos) {
      const cols = [0x00f2fe, 0xfacc15, 0xf43f5e, 0xa855f7, 0x4ade80]
      for (let i = 0; i < 40; i++) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 6, 6),
          new THREE.MeshBasicMaterial({ color: cols[i % cols.length] }),
        )
        m.position.set(pos.x, pos.y + 3, pos.z)
        const vel = new THREE.Vector3((Math.random() - 0.5) * 18, 8 + Math.random() * 14, (Math.random() - 0.5) * 18)
        scene.add(m)
        celebrationParticles.push({ mesh: m, vel, age: 0 })
      }
    }

    // Expose spawnBoostRing for boost button
    window.__spawnBoostRing = (racerIdx) => {
      const r = racers[racerIdx]
      if (r && !r.finished) {
        r.playerBoostTimer = 1.15
        spawnBoostRing(r.mesh.position, 0x00f2fe)
      }
    }

    // Race start handler
    window.__startRaceInScene = () => {
      racers.forEach((r) => {
        r.x = TRACK_START_X
        r.mesh.position.set(TRACK_START_X, 0, r.laneZ)
        r.currentSpeed = 0
        r.boostTimer = 0
        r.playerBoostTimer = 0
        r.finished = false
        r.finishTime = 0
        r.rank = r.lane
      })
      startGateBar.position.y = 2.2
    }

    // Reset racers for next round
    window.__resetRacers = () => {
      racers.forEach((r) => {
        r.x = TRACK_START_X
        r.mesh.position.set(TRACK_START_X, 0, r.laneZ)
        r.finished = false
        r.rank = r.lane
      })
      startGateBar.position.y = 2.2
    }

    // Reset camera
    window.__resetCameraView = () => {
      camOrbit.theta = 0.08
      camOrbit.phi = 0.54
      adjustResponsiveCamera()
    }

    // Get racer positions for minimap
    window.__getRacerPositions = () => racers.map((r) => ({
      id: r.id, x: r.x, rank: r.rank, emoji: r.emoji,
    }))

    // Avatar broadcast throttle
    let lastBroadcast = 0

    // --- ANIMATION LOOP ---
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.1)
      const elapsedTime = clock.getElapsedTime()

      // Bubbles
      const posAttr = bubblesSystem.geometry.attributes.position
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) + dt * 3.4
        if (y > 42) y = 0
        posAttr.setY(i, y)
      }
      posAttr.needsUpdate = true

      // NPCs
      npcSpectators.forEach((npc) => {
        const spd = phaseRef.current === 'RACING' ? 10 : 4
        npc.group.position.y = Math.abs(Math.sin(elapsedTime * spd + npc.phaseOffset)) * 0.6
        updateWorldLabelPosition(npc.labelEl, npc.group.position, 3.1)
      })

      // Boost rings
      for (let i = boostRings.length - 1; i >= 0; i--) {
        const b = boostRings[i]
        b.age += dt
        b.mesh.scale.addScalar(dt * 4.5)
        b.mesh.material.opacity = Math.max(0, 0.9 - b.age * 1.4)
        if (b.age > 0.65) {
          scene.remove(b.mesh)
          boostRings.splice(i, 1)
        }
      }

      // Celebration particles
      for (let i = celebrationParticles.length - 1; i >= 0; i--) {
        const p = celebrationParticles[i]
        p.age += dt
        p.vel.y -= 18 * dt
        p.mesh.position.addScaledVector(p.vel, dt)
        if (p.age > 1.8) {
          scene.remove(p.mesh)
          celebrationParticles.splice(i, 1)
        }
      }

      // --- Race Simulation ---
      if (phaseRef.current === 'RACING') {
        if (startGateBar.position.y < 10) startGateBar.position.y += dt * 16

        const raceStartTime = useStore.getState().raceStartTime
        const elapsed = (performance.now() - raceStartTime) / 1000
        setRaceElapsed(elapsed)

        racers.forEach((r) => {
          if (r.finished) return
          const progress = Math.max(0, Math.min(1, (r.x - TRACK_START_X) / TRACK_LENGTH))
          let targetSpeed = r.baseSpeed

          if (r.id === 0) {
            if (r.boostTimer > 0) { r.boostTimer -= dt; targetSpeed = r.baseSpeed * 1.85 }
            else if (Math.random() < 0.025) {
              r.boostTimer = 0.75
              spawnBoostRing(r.mesh.position, 0xff6b81)
              setBroadcastText('🦐 1번 총알 새우! 폭발적인 꼬리 스냅으로 급가속합니다!')
            } else { targetSpeed = r.baseSpeed * (0.72 + Math.random() * 0.25) }
          } else if (r.id === 1) {
            targetSpeed = r.baseSpeed * (0.95 + Math.sin(elapsedTime * 4 + r.id) * 0.07)
          } else if (r.id === 2) {
            targetSpeed = progress < 0.55 ? r.baseSpeed * 1.28 : r.baseSpeed * (0.82 + Math.random() * 0.18)
          } else {
            if (r.boostTimer > 0) { r.boostTimer -= dt; targetSpeed = r.baseSpeed * 2.05 }
            else if (Math.random() < 0.021) {
              r.boostTimer = 0.85
              spawnBoostRing(r.mesh.position, 0xa855f7)
              setBroadcastText('🐙 4번 먹물 문어! 기습 먹물 제트 분사로 순식간에 치고 나갑니다!')
            } else { targetSpeed = r.baseSpeed * (0.65 + Math.random() * 0.55) }
          }

          if (r.playerBoostTimer > 0) {
            r.playerBoostTimer -= dt
            targetSpeed *= 1.42
          }

          r.currentSpeed = THREE.MathUtils.lerp(r.currentSpeed, targetSpeed, 0.12)
          r.x += r.currentSpeed * dt

          if (r.x >= TRACK_FINISH_X) {
            r.x = TRACK_FINISH_X
            r.finished = true
            r.finishTime = elapsed
            const currentOrder = useStore.getState().finishOrder
            const newOrder = [...currentOrder, { ...r }]
            setFinishOrder(newOrder)
            if (newOrder.length === 1) {
              setBroadcastText(`🏆 1위 골인!! ${r.lane}레인 ${r.name}(${r.emoji}) 선수가 가장 먼저 결승선을 통과합니다!`)
              spawnCelebrationFireworks(r.mesh.position)
            }
          }

          r.mesh.position.x = r.x
          r.mesh.position.y = Math.abs(Math.sin(elapsedTime * 11 + r.id)) * 0.52
          r.mesh.rotation.z = Math.sin(elapsedTime * 9 + r.id) * 0.08
        })

        const sorted = [...racers].sort((a, b) => {
          if (a.finished && b.finished) return a.finishTime - b.finishTime
          if (a.finished) return -1
          if (b.finished) return 1
          return b.x - a.x
        })
        sorted.forEach((r, idx) => { r.rank = idx + 1 })

        // Check if all finished
        const finishOrder = useStore.getState().finishOrder
        if (finishOrder.length === racers.length) {
          setPhase('RESULT')
          useStore.getState().setCameraMode('finish')
          cameraModeRef.current = 'finish'
        }
      } else {
        racers.forEach((r) => {
          r.mesh.position.y = Math.sin(elapsedTime * 3 + r.id) * 0.18
          r.mesh.rotation.z = 0
        })
      }

      // Racer labels
      racers.forEach((r) => {
        const isPick = r.id === selectedRef.current
        const rankHtml = phaseRef.current === 'RACING' ? `<span class="px-1 bg-cyan-400 text-slate-950 font-bold mr-1 border border-cyan-200">${r.rank}위</span>` : ''
        const pickHtml = isPick ? `<span class="ml-1 text-amber-300 font-black">★</span>` : ''
        r.labelEl.innerHTML = `${rankHtml}${r.emoji} <span class="hidden xs:inline">${r.name}</span>${pickHtml}`
        updateWorldLabelPosition(r.labelEl, r.mesh.position, 3.5)
      })

      // --- Avatar Movement ---
      const mk = moveKeysRef.current
      let mx = 0, mz = 0
      if (mk.KeyW || mk.ArrowUp) mz -= 1
      if (mk.KeyS || mk.ArrowDown) mz += 1
      if (mk.KeyA || mk.ArrowLeft) mx -= 1
      if (mk.KeyD || mk.ArrowRight) mx += 1

      if (mx !== 0 || mz !== 0) {
        const spd = 16 * dt
        avatarGroup.position.x = Math.max(-38, Math.min(38, avatarGroup.position.x + mx * spd))
        avatarGroup.position.z = Math.max(14.8, Math.min(22.2, avatarGroup.position.z + mz * spd))
        avatarGroup.rotation.y = Math.atan2(-mx, -mz)
        avatarGroup.position.y = Math.abs(Math.sin(elapsedTime * 12)) * 0.42
      } else {
        avatarGroup.position.y = Math.sin(elapsedTime * 3) * 0.12
      }
      // Player Avatar label update with real-time bet
      const myIsAdmin = useStore.getState().isAdmin
      const currentSelected = useStore.getState().selectedRacerId
      const currentBet = useStore.getState().betAmount
      const myRacer = RACERS_CONFIG[currentSelected]
      const myBetBadge = currentBet > 0
        ? `<span class="ml-1 px-1.5 py-0.5 rounded-full bg-slate-950/85 text-amber-300 font-mono-num font-bold text-[9px] border border-amber-400/40">${myRacer?.emoji || ''} ${currentBet}🐚</span>`
        : ''
      avatarLabelEl.innerHTML = `🤿 ${myIsAdmin ? '<span class="text-amber-300 mr-0.5">👑</span>' : ''}${nickname}${myBetBadge}`
      updateWorldLabelPosition(avatarLabelEl, avatarGroup.position, 4.1)

      // Broadcast avatar position (throttled)
      const now = performance.now()
      if (now - lastBroadcast > 100 && realtimeChannel) {
        lastBroadcast = now
        realtimeChannel.broadcastAvatarMove(
          avatarGroup.position.x, avatarGroup.position.z, avatarGroup.rotation.y,
        )
      }

      // --- Remote Avatars ---
      const users = onlineUsersRef.current
      Object.entries(users).forEach(([uid, data]) => {
        if (!data.nickname || uid === realtimeChannel?.myId) return
        if (!remoteAvatars[uid]) {
          createRemoteAvatar(uid, data.nickname, data.isAdmin)
        }
        const ra = remoteAvatars[uid]
        if (data.avatarX !== undefined) {
          ra.group.position.x = THREE.MathUtils.lerp(ra.group.position.x, data.avatarX, 0.12)
          ra.group.position.z = THREE.MathUtils.lerp(ra.group.position.z, data.avatarZ || 18, 0.12)
          ra.group.rotation.y = data.avatarRotY || 0
        }
        ra.group.position.y = Math.sin(elapsedTime * 3 + uid.charCodeAt(0)) * 0.12

        const rBetBadge = data.betAmount > 0 && data.betRacerId !== undefined && data.betRacerId !== null
          ? `<span class="ml-1 px-1.5 py-0.5 rounded-full bg-slate-950/85 text-amber-300 font-mono-num font-bold text-[9px] border border-amber-400/40">${RACERS_CONFIG[data.betRacerId]?.emoji || ''} ${data.betAmount}🐚</span>`
          : ''
        ra.labelEl.innerHTML = `🤿 ${data.isAdmin ? '<span class="text-amber-300 mr-0.5">👑</span>' : ''}${data.nickname}${rBetBadge}`
        updateWorldLabelPosition(ra.labelEl, ra.group.position, 3.8)
      })

      // Remove disconnected avatars
      Object.keys(remoteAvatars).forEach((uid) => {
        if (!users[uid]) removeRemoteAvatar(uid)
      })

      // --- Camera ---
      const cm = cameraModeRef.current
      if (cm === 'spectator') {
        const tx = avatarGroup.position.x * 0.4
        camOrbit.target.lerp(new THREE.Vector3(tx, 1.5, 2), 0.08)
        const cx = camOrbit.target.x + camOrbit.radius * Math.sin(camOrbit.phi) * Math.sin(camOrbit.theta)
        const cy = camOrbit.target.y + camOrbit.radius * Math.cos(camOrbit.phi)
        const cz = camOrbit.target.z + camOrbit.radius * Math.sin(camOrbit.phi) * Math.cos(camOrbit.theta)
        camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.12)
        camera.lookAt(camOrbit.target)
      } else if (cm === 'broadcast') {
        let leadX = TRACK_START_X
        racers.forEach((r) => { if (r.x > leadX) leadX = r.x })
        const focusX = Math.min(TRACK_FINISH_X, leadX - 3)
        const distScale = window.innerWidth < 640 ? 1.32 : 1.0
        camera.position.lerp(new THREE.Vector3(focusX - 16 * distScale, 19 * distScale, 32 * distScale), 0.06)
        camOrbit.target.lerp(new THREE.Vector3(focusX + 5, 1.5, 0), 0.08)
        camera.lookAt(camOrbit.target)
      } else if (cm === 'avatar') {
        camera.position.lerp(new THREE.Vector3(avatarGroup.position.x, 8.5, avatarGroup.position.z + 14), 0.1)
        camOrbit.target.lerp(new THREE.Vector3(avatarGroup.position.x, 2.2, -2), 0.12)
        camera.lookAt(camOrbit.target)
      } else if (cm === 'finish') {
        const fo = useStore.getState().finishOrder
        const winner = fo[0] || racers[0]
        camera.position.lerp(new THREE.Vector3(TRACK_FINISH_X - 13, 9.5, (winner.laneZ || 0) + 15), 0.06)
        camOrbit.target.lerp(new THREE.Vector3(TRACK_FINISH_X, 2.0, winner.laneZ || 0), 0.08)
        camera.lookAt(camOrbit.target)
      }

      renderer.render(scene, camera)
    }

    animate()

    sceneDataRef.current = { scene, camera, renderer, racers, avatarGroup }

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      container.removeChild(renderer.domElement)
      // Clean labels
      if (labelsRef.current) labelsRef.current.innerHTML = ''
      // Clean remote avatars
      Object.keys(remoteAvatars).forEach((uid) => removeRemoteAvatar(uid))
      delete window.__setMoveKey
      delete window.__spawnBoostRing
      delete window.__startRaceInScene
      delete window.__resetRacers
      delete window.__resetCameraView
      delete window.__getRacerPositions
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div id="canvas-container" ref={containerRef} />
      <div id="labels-container" ref={labelsRef} />
    </>
  )
}
