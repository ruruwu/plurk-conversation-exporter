function normalizeText(text) {
  return text.replace(/\u00a0/g, ' ');
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value, location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (_) {
    return '';
  }
}

function parsePlainTextSyntax(value) {
  const parts = [];
  const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|--([^-\n]+)--|\*([^*\n]+)\*/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(value))) {
    if (match.index > cursor) {
      parts.push({ type: 'text', value: value.slice(cursor, match.index), marks: [], href: '' });
    }

    if (match[1] !== undefined) {
      parts.push({ type: 'text', value: match[1], marks: [], href: match[2] });
    } else if (match[3] !== undefined) {
      parts.push({ type: 'text', value: match[3], marks: ['bold'], href: '' });
    } else if (match[4] !== undefined) {
      parts.push({ type: 'text', value: match[4], marks: ['underline'], href: '' });
    } else if (match[5] !== undefined) {
      parts.push({ type: 'text', value: match[5], marks: ['strike'], href: '' });
    } else {
      parts.push({ type: 'text', value: match[6], marks: ['italic'], href: '' });
    }
    cursor = pattern.lastIndex;
  }

  if (cursor < value.length) {
    parts.push({ type: 'text', value: value.slice(cursor), marks: [], href: '' });
  }
  return parts.length ? parts : [{ type: 'text', value, marks: [], href: '' }];
}

function parseInlineNodes(root) {
  const parts = [];

  function getMarks(el, inherited) {
    const marks = new Set(inherited || []);
    const tag = el.tagName;

    if (tag === 'STRONG' || tag === 'B') marks.add('bold');
    if (tag === 'EM' || tag === 'I') marks.add('italic');
    if (tag === 'U') marks.add('underline');
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') marks.add('strike');
    if (tag === 'CODE' || tag === 'TT') marks.add('code');
    if (tag === 'SUP') marks.add('sup');
    if (tag === 'SUB') marks.add('sub');

    // Plurk or user styles may express formatting through inline CSS instead
    // of semantic tags. Preserve the common text styles as well.
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : el.style;
    if (style) {
      const weight = String(style.fontWeight || '').toLowerCase();
      if (weight === 'bold' || Number.parseInt(weight, 10) >= 600) marks.add('bold');

      const fontStyle = String(style.fontStyle || '').toLowerCase();
      if (fontStyle === 'italic' || fontStyle === 'oblique') marks.add('italic');

      const decoration = String(style.textDecoration || style.textDecorationLine || '').toLowerCase();
      if (decoration.includes('underline')) marks.add('underline');
      if (decoration.includes('line-through')) marks.add('strike');
    }

    return [...marks];
  }

  function walk(node, marks = [], href = '', linkPreviewHref = '') {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = normalizeText(node.textContent || '');
      if (value) {
        if (!marks.length && !href && !linkPreviewHref) {
          parts.push(...parsePlainTextSyntax(value));
        } else {
          parts.push({ type: 'text', value, marks, href, linkPreviewHref });
        }
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node;
    const nextMarks = getMarks(el, marks);
    const nextHref = el.tagName === 'A' && el.href ? safeHttpUrl(el.href) || href : href;
    const isPlurkLinkPreview = el.tagName === 'A' &&
      el.matches('a.ex_link.meta.plink') &&
      /^https?:\/\/(?:www\.)?plurk\.com\/p\//i.test(nextHref);
    const nextLinkPreviewHref = isPlurkLinkPreview ? nextHref : linkPreviewHref;

    if (el.tagName === 'IMG') {
      parts.push({
        type: 'image',
        src: el.currentSrc || el.src || '',
        alt: el.alt || el.title || '',
        href: nextHref,
        linkPreviewHref: nextLinkPreviewHref
      });
      return;
    }

    if (el.tagName === 'BR') {
      parts.push({ type: 'text', value: '\n', marks: [], href: '', linkPreviewHref: nextLinkPreviewHref });
      return;
    }

    for (const child of el.childNodes) {
      walk(child, nextMarks, nextHref, nextLinkPreviewHref);
    }
  }

  walk(root);
  return parts;
}

function firstText(root, selectors) {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return '';
}

function firstElement(root, selectors) {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function extractEntry(root, type, meta = {}) {
  const author = firstText(root, [
    '.name',
    '.nick_name',
    '.display_name',
    '.user_name',
    'a[href*="/user/"]',
    'a[href^="/"]'
  ]);

  const content = firstElement(root, [
    '.content',
    '.text_holder',
    '.plurk_content',
    '.response_content',
    '.content_raw',
    '[data-role="content"]'
  ]);

  if (!content) return null;

  const parts = parseInlineNodes(content);
  const meaningful = parts.some(
    part => part.type === 'image' || (part.type === 'text' && part.value.trim())
  );
  if (!meaningful) return null;

  return { type, author, parts, ...meta };
}

function isVisible(element) {
  if (!element) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         !element.classList.contains('hide');
}

function getActiveResponseList() {
  const lists = [...document.querySelectorAll('.list-container .list')];

  // Prefer a visible response list. Plurk may leave old/hidden response DOM
  // in the page when switching between plurks on the timeline.
  const visible = lists.find(list =>
    isVisible(list) &&
    list.querySelector('[data-type="response"][data-rid][data-pid]')
  );

  return visible ||
    lists.find(list => list.querySelector('[data-type="response"][data-rid][data-pid]')) ||
    null;
}

function getConversationPid(responseList) {
  const response = responseList?.querySelector(
    '[data-type="response"][data-rid][data-pid]'
  );
  if (response?.dataset?.pid) return String(response.dataset.pid);

  // Permalink layout: the main plurk itself has data-type="plurk" + data-pid.
  const permalinkMain = document.querySelector(
    '[data-type="plurk"][data-pid]:not([data-rid])'
  );
  if (permalinkMain?.dataset?.pid) return String(permalinkMain.dataset.pid);

  return '';
}

function findMainPlurk(pid) {
  if (!pid) return null;

  // Permalink / standalone page.
  const permalinkMain = document.querySelector(
    `[data-type="plurk"][data-pid="${CSS.escape(pid)}"]:not([data-rid])`
  );
  if (permalinkMain) return permalinkMain;

  // Timeline / river layout. The content node has an ID tied directly to pid.
  const riverMain = document.getElementById(`plurk_cnt_${pid}`);
  if (riverMain) return riverMain;

  return null;
}

function collectResponseNodes(pid, responseList) {
  if (!pid) return [];

  // Both layouts expose a canonical response list in .list-container .list.
  // Prefer it so legacy duplicate response DOM elsewhere on the timeline is
  // ignored completely.
  if (responseList) {
    const canonical = [
      ...responseList.querySelectorAll(
        `[data-type="response"][data-rid][data-pid="${CSS.escape(pid)}"]`
      )
    ];
    if (canonical.length) return canonical;
  }

  // Fallback for a future Plurk layout change. De-duplicate ONLY by data-rid.
  // Different response IDs are always preserved, even when text/images match.
  const all = [
    ...document.querySelectorAll(
      `[data-type="response"][data-rid][data-pid="${CSS.escape(pid)}"]`
    )
  ];

  const seenRids = new Set();
  return all.filter(node => {
    const rid = String(node.dataset.rid || '');
    if (!rid || seenRids.has(rid)) return false;
    seenRids.add(rid);
    return true;
  });
}

function extractConversationFromPage() {
  const items = [];
  const responseList = getActiveResponseList();
  const pid = getConversationPid(responseList);

  if (!pid) {
    throw new Error('找不到目前噗文的 data-pid。請確認噗文或回覆區已載入。');
  }

  // 1) Main post: locate by the same pid as the response thread.
  const main = findMainPlurk(pid);
  if (main) {
    const entry = extractEntry(main, 'main', { pid });
    if (entry) items.push(entry);
  }

  // 2) Responses: use Plurk's real response identity (data-rid).
  // Never compare response contents. Identical replies with different rids
  // are legitimate and must all be preserved.
  const responseNodes = collectResponseNodes(pid, responseList);
  const seenRids = new Set();

  for (const node of responseNodes) {
    const rid = String(node.dataset.rid || '');
    if (!rid || seenRids.has(rid)) continue;
    seenRids.add(rid);

    const entry = extractEntry(node, 'response', { pid, rid });
    if (entry) items.push(entry);
  }

  if (!items.length) {
    throw new Error('已找到噗文 ID，但沒有擷取到可輸出的內容。');
  }

  return {
    url: location.href,
    title: document.title,
    pid,
    items
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'EXTRACT_PLURK_CONVERSATION') return;

  try {
    const data = extractConversationFromPage();
    sendResponse({ ok: true, data });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
});
