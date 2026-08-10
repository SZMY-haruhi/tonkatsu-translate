import { BILINGUAL_CLASS_NAME } from '@tonkatsu-translate/render';

const IGNORE_CLOSEST = `.${BILINGUAL_CLASS_NAME}, .tt-selection-bubble, #tt-edge-dock, [data-tt-ui]`;
const MAX_SELECTION_CHARS = 2000;

export function bindSelectionTranslate(options: {
  enabled: () => boolean;
  translate: (text: string) => Promise<string>;
}): () => void {
  let bubble: HTMLDivElement | null = null;
  let requestId = 0;

  const removeBubble = () => {
    bubble?.remove();
    bubble = null;
  };

  const onMouseUp = async () => {
    if (!options.enabled()) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    let text = selection.toString().trim();
    if (text.length < 1) return;
    if (text.length > MAX_SELECTION_CHARS) {
      text = text.slice(0, MAX_SELECTION_CHARS);
    }

    const anchor = selection.anchorNode;
    const anchorEl =
      anchor instanceof Element ? anchor : anchor?.parentElement ?? null;
    if (anchorEl?.closest(IGNORE_CLOSEST)) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    removeBubble();

    const currentId = ++requestId;
    const current = document.createElement('div');
    current.className = 'tt-selection-bubble';
    current.setAttribute('data-tt-ui', '1');
    current.innerHTML = `
      <div class="tt-selection-bubble__body">翻译中…</div>
      <div class="tt-selection-bubble__actions">
        <button type="button" data-act="copy">复制</button>
        <button type="button" data-act="close">关闭</button>
      </div>
    `;
    Object.assign(current.style, {
      position: 'fixed',
      zIndex: '2147483646',
      left: `${Math.max(8, Math.min(window.innerWidth - 280, rect.left))}px`,
      top: `${Math.min(window.innerHeight - 120, rect.bottom + 8)}px`,
      width: '260px',
      background: '#fffaf2',
      color: '#1f1a14',
      border: '1px solid #ddd2c3',
      borderRadius: '10px',
      boxShadow: '0 8px 24px rgba(0,0,0,.12)',
      padding: '10px',
      font: '13px/1.4 "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    } as Partial<CSSStyleDeclaration>);

    const actions = current.querySelector(
      '.tt-selection-bubble__actions',
    ) as HTMLElement | null;
    if (actions) {
      Object.assign(actions.style, {
        display: 'flex',
        gap: '8px',
        marginTop: '8px',
      } as Partial<CSSStyleDeclaration>);
    }
    current.querySelectorAll('button').forEach((btn) => {
      Object.assign((btn as HTMLButtonElement).style, {
        border: '1px solid #ddd2c3',
        borderRadius: '6px',
        background: '#fff',
        padding: '4px 8px',
        cursor: 'pointer',
        font: 'inherit',
      } as Partial<CSSStyleDeclaration>);
    });

    document.documentElement.appendChild(current);
    bubble = current;
    const body = current.querySelector(
      '.tt-selection-bubble__body',
    ) as HTMLElement;

    current.addEventListener('click', async (event) => {
      const target = event.target as HTMLElement;
      const act = target.getAttribute('data-act');
      if (act === 'close') removeBubble();
      if (act === 'copy' && body.textContent) {
        try {
          await navigator.clipboard.writeText(body.textContent);
        } catch {
          // ignore clipboard failures
        }
      }
    });

    try {
      const translated = await options.translate(text);
      if (requestId !== currentId || bubble !== current) return;
      body.textContent = translated;
    } catch (error) {
      if (requestId !== currentId || bubble !== current) return;
      body.textContent =
        error instanceof Error ? error.message : '划词翻译失败';
    }
  };

  const onMouseDown = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (target?.closest('.tt-selection-bubble')) return;
    removeBubble();
  };

  const onDocMouseUp = () => {
    window.setTimeout(() => {
      void onMouseUp();
    }, 10);
  };

  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onDocMouseUp);

  return () => {
    requestId += 1;
    removeBubble();
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mouseup', onDocMouseUp);
  };
}
