import type { SessionState } from './messaging'

const DOCK_ID = 'tt-edge-dock'
const POS_KEY = 'tonkatsu.edgeDock.pos'
/** Legacy per-page key — migrate once into extension storage. */
const LEGACY_POS_KEY = 'tonkatsu.edgeDock.pos'

type DockSide = 'left' | 'right'

type DockPos = {
  side: DockSide
  /** 0–1 vertical position of bubble center */
  topRatio: number
}

export type EdgeDockControls = {
  setSession: (state: SessionState) => void
  setHostBlocked: (message: string | null) => void
  destroy: () => void
}

const BUBBLE = 48
const PEEK = 12
const EDGE_NEAR = 22
const DRAG_THRESHOLD = 5
const DEFAULT_POS: DockPos = { side: 'right', topRatio: 0.42 }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function normalizePos(raw: Partial<DockPos> | null | undefined): DockPos | null {
  if (!raw) return null
  const side = raw.side === 'left' || raw.side === 'right' ? raw.side : null
  if (!side) return null
  const ratio = Number(raw.topRatio)
  return {
    side,
    topRatio: clamp(Number.isFinite(ratio) ? ratio : DEFAULT_POS.topRatio, 0.08, 0.92),
  }
}

function readLegacyLocalPos(): DockPos | null {
  try {
    const raw = localStorage.getItem(LEGACY_POS_KEY)
    if (!raw) return null
    return normalizePos(JSON.parse(raw) as Partial<DockPos>)
  } catch {
    return null
  }
}

async function loadPos(): Promise<DockPos> {
  try {
    const result = await browser.storage.local.get(POS_KEY)
    const saved = normalizePos(result[POS_KEY] as Partial<DockPos> | undefined)
    if (saved) return saved
  } catch {
    // fall through to legacy / default
  }

  const legacy = readLegacyLocalPos()
  if (legacy) {
    void savePos(legacy)
    try {
      localStorage.removeItem(LEGACY_POS_KEY)
    } catch {
      // ignore
    }
    return legacy
  }

  return { ...DEFAULT_POS }
}

async function savePos(pos: DockPos): Promise<void> {
  const next = normalizePos(pos) ?? DEFAULT_POS
  try {
    await browser.storage.local.set({ [POS_KEY]: next })
  } catch {
    // ignore quota / restricted contexts
  }
}

function labelFor(state: SessionState, active: boolean): string {
  if (state.status === 'running') {
    return `翻译中 ${state.done}/${state.total} · 点击取消`
  }
  if (state.status === 'error') {
    return `失败：${state.message}`
  }
  return active ? '翻译中 · 点击取消' : '点击启动翻译'
}

export function bindEdgeDock(options: {
  onToggle: (nextActive: boolean) => void | Promise<void>
}): EdgeDockControls {
  document.getElementById(DOCK_ID)?.remove()

  let pos: DockPos = { ...DEFAULT_POS }
  let active = false
  let expanded = false
  let nearEdge = false
  let dragging = false
  let suppressClick = false
  let lastState: SessionState = { status: 'idle' }
  let hostBlockedMessage: string | null = null

  const host = document.createElement('div')
  host.id = DOCK_ID
  host.setAttribute('data-tt-ui', '1')
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = `
    :host { all: initial; }
    .bubble {
      position: fixed;
      z-index: 2147483645;
      width: ${BUBBLE}px;
      height: ${BUBBLE}px;
      border-radius: 50%;
      padding: 0;
      border: 2px solid rgba(31, 26, 20, 0.18);
      background: #2a2420;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
      cursor: grab;
      overflow: hidden;
      transition:
        transform 0.2s ease,
        filter 0.2s ease,
        box-shadow 0.2s ease,
        border-color 0.2s ease,
        opacity 0.2s ease;
      user-select: none;
      -webkit-user-drag: none;
      touch-action: none;
    }
    .bubble:active { cursor: grabbing; }
    .bubble img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
      pointer-events: none;
    }
    .bubble[data-active="0"] {
      filter: grayscale(0.35) brightness(0.78) contrast(0.92);
      opacity: 0.88;
      border-color: rgba(255, 255, 255, 0.12);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
    }
    .bubble[data-active="1"] {
      filter: grayscale(0) brightness(1.08) contrast(1.08);
      opacity: 1;
      border-color: #c45c26;
      box-shadow:
        0 0 0 3px rgba(196, 92, 38, 0.35),
        0 8px 22px rgba(196, 92, 38, 0.35);
    }
    .bubble[data-error="1"] {
      filter: grayscale(0) brightness(1) contrast(1.05);
      opacity: 1;
      border-color: #b42318;
      box-shadow:
        0 0 0 3px rgba(180, 35, 24, 0.35),
        0 8px 22px rgba(180, 35, 24, 0.28);
    }
    .bubble[data-blocked="1"] {
      filter: grayscale(0.7) brightness(0.72);
      opacity: 0.72;
      cursor: not-allowed;
      border-color: rgba(109, 98, 86, 0.45);
    }
    .bubble[data-dragging="1"] {
      transition: none;
      opacity: 1;
    }
  `

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'bubble'
  button.dataset.active = '0'
  button.dataset.error = '0'
  button.dataset.blocked = '0'
  button.dataset.side = pos.side
  button.dataset.open = '0'
  button.setAttribute('aria-label', '炸猪排翻译')
  button.title = '点击启动翻译'

  const img = document.createElement('img')
  img.alt = ''
  img.width = BUBBLE
  img.height = BUBBLE
  try {
    img.src = browser.runtime.getURL('/icon-48.png')
  } catch {
    // keep empty circle if icon unavailable
  }
  button.appendChild(img)

  const syncOpen = () => {
    const open = dragging || expanded || nearEdge
    button.dataset.open = open ? '1' : '0'
    layout()
  }

  const layout = () => {
    const open = button.dataset.open === '1'
    const top = clamp(window.innerHeight * pos.topRatio, BUBBLE, window.innerHeight - BUBBLE)
    button.style.top = `${top - BUBBLE / 2}px`

    if (pos.side === 'right') {
      button.style.left = 'auto'
      button.style.right = '0'
      button.style.transform = open
        ? `translateX(-8px)`
        : `translateX(calc(100% - ${PEEK}px))`
    } else {
      button.style.right = 'auto'
      button.style.left = '0'
      button.style.transform = open
        ? `translateX(8px)`
        : `translateX(calc(-100% + ${PEEK}px))`
    }
    button.dataset.side = pos.side
  }

  button.addEventListener('mouseenter', () => {
    expanded = true
    syncOpen()
  })
  button.addEventListener('mouseleave', () => {
    if (!dragging) {
      expanded = false
      syncOpen()
    }
  })

  button.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false
      return
    }
    if (hostBlockedMessage) {
      button.title = hostBlockedMessage
      return
    }
    void options.onToggle(!active)
  })

  let dragStartX = 0
  let dragStartY = 0
  let originTop = 0
  let moved = false

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    dragging = true
    moved = false
    suppressClick = false
    button.dataset.dragging = '1'
    dragStartX = event.clientX
    dragStartY = event.clientY
    originTop = window.innerHeight * pos.topRatio
    button.setPointerCapture(event.pointerId)
    syncOpen()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return
    const dx = event.clientX - dragStartX
    const dy = event.clientY - dragStartY
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      moved = true
      suppressClick = true
    }

    const nextTop = clamp(originTop + dy, BUBBLE, window.innerHeight - BUBBLE)
    pos = {
      ...pos,
      topRatio: nextTop / window.innerHeight,
      side: event.clientX < window.innerWidth / 2 ? 'left' : 'right',
    }

    button.style.top = `${nextTop - BUBBLE / 2}px`
    if (pos.side === 'right') {
      button.style.left = 'auto'
      button.style.right = '0'
      button.style.transform = 'translateX(-8px)'
    } else {
      button.style.right = 'auto'
      button.style.left = '0'
      button.style.transform = 'translateX(8px)'
    }
    button.dataset.side = pos.side
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!dragging) return
    dragging = false
    button.dataset.dragging = '0'
    try {
      button.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    if (moved) void savePos(pos)
    expanded = button.matches(':hover')
    syncOpen()
  }

  button.addEventListener('pointerdown', onPointerDown)
  button.addEventListener('pointermove', onPointerMove)
  button.addEventListener('pointerup', onPointerUp)
  button.addEventListener('pointercancel', onPointerUp)

  const onMouseMove = (event: MouseEvent) => {
    if (dragging) return
    nearEdge =
      pos.side === 'right'
        ? event.clientX >= window.innerWidth - EDGE_NEAR
        : event.clientX <= EDGE_NEAR
    syncOpen()
  }

  const onResize = () => layout()

  shadow.append(style, button)
  document.documentElement.appendChild(host)
  window.addEventListener('mousemove', onMouseMove, { passive: true })
  window.addEventListener('resize', onResize)
  syncOpen()

  // Restore remembered height/side from extension storage (cross-site).
  void loadPos().then((saved) => {
    if (dragging) return
    pos = saved
    layout()
  })

  return {
    setSession(state: SessionState) {
      lastState = state
      active = state.status === 'running'
      button.dataset.active = active ? '1' : '0'
      button.dataset.error = state.status === 'error' ? '1' : '0'
      if (hostBlockedMessage) {
        button.title = hostBlockedMessage
        button.setAttribute('aria-label', hostBlockedMessage)
        return
      }
      const label = labelFor(state, active)
      button.title = label
      button.setAttribute('aria-label', label)
    },
    setHostBlocked(message: string | null) {
      hostBlockedMessage = message
      button.dataset.blocked = message ? '1' : '0'
      if (message) {
        button.title = message
        button.setAttribute('aria-label', message)
      } else {
        const label = labelFor(lastState, active)
        button.title = label
        button.setAttribute('aria-label', label)
      }
    },
    destroy() {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      host.remove()
    },
  }
}
