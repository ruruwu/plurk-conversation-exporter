const preview = document.getElementById('preview');
const status = document.getElementById('status');
const includeAuthor = document.getElementById('includeAuthor');
const includeImages = document.getElementById('includeImages');

let lastResult = null;

function setStatus(message, tone = '') {
  status.textContent = message;
  status.className = tone ? `status ${tone}` : 'status';
}

function applyPlainTextSyntax(value, part) {
  if (!value) return '';

  let text = value;
  const marks = new Set(part.marks || []);

  // Use portable Markdown-like syntax for plain-text exports.
  if (marks.has('code')) text = `\`${text}\``;
  if (marks.has('bold')) text = `**${text}**`;
  if (marks.has('italic')) text = `*${text}*`;
  if (marks.has('strike')) text = `~~${text}~~`;
  // Markdown has no universal underline syntax; HTML notation is the most
  // portable representation while still remaining readable as plain text.
  if (marks.has('underline')) text = `<u>${text}</u>`;
  if (marks.has('sup')) text = `<sup>${text}</sup>`;
  if (marks.has('sub')) text = `<sub>${text}</sub>`;

  if (part.href && value.trim()) {
    text = `[${text}](${part.href})`;
  }

  return text;
}

function wrapRichText(value, part) {
  let html = escapeHtml(value).replaceAll('\n', '<br>');
  const marks = new Set(part.marks || []);

  if (marks.has('code')) html = `<code>${html}</code>`;
  if (marks.has('bold')) html = `<strong>${html}</strong>`;
  if (marks.has('italic')) html = `<em>${html}</em>`;
  if (marks.has('underline')) html = `<u>${html}</u>`;
  if (marks.has('strike')) html = `<s>${html}</s>`;
  if (marks.has('sup')) html = `<sup>${html}</sup>`;
  if (marks.has('sub')) html = `<sub>${html}</sub>`;

  if (part.href) {
    html = `<a href="${escapeHtml(part.href)}">${html}</a>`;
  }

  return html;
}

function buildPlainText(result) {
  const imageIndexMap = getImageIndexMap(result);

  return result.items.map(item => {
    const author = includeAuthor.checked && item.author ? `【${item.author}】\n` : '';
    const bodyParts = [];
    for (let index = 0; index < item.parts.length;) {
      const part = item.parts[index];
      if (part.linkPreviewHref) {
        const href = part.linkPreviewHref;
        const previewParts = [];
        while (index < item.parts.length && item.parts[index].linkPreviewHref === href) {
          previewParts.push(item.parts[index]);
          index += 1;
        }
        const previewText = previewParts.map(previewPart => {
          if (previewPart.type === 'text') {
            return applyPlainTextSyntax(previewPart.value, { ...previewPart, href: '' });
          }
          if (previewPart.type === 'image' && includeImages.checked) {
            const imageNumber = imageIndexMap.get(previewPart.src);
            return imageNumber ? `[圖片${imageNumber}]` : '[圖片]';
          }
          return '';
        }).join('').trim();
        if (previewText) bodyParts.push(`[${previewText}](${href})`);
        continue;
      }

      if (part.type === 'text') bodyParts.push(applyPlainTextSyntax(part.value, part));
      if (part.type === 'image' && includeImages.checked) {
        const imageNumber = imageIndexMap.get(part.src);
        bodyParts.push(imageNumber ? `[圖片${imageNumber}]` : '[圖片]');
      }
      index += 1;
    }
    const body = bodyParts.join('');

    return `${author}${body.trim()}`.trim();
  }).filter(Boolean).join('\n\n');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildRichPart(part, imageSrcMap, imageStyle, suppressLink = false) {
  if (part.type === 'text') {
    return wrapRichText(part.value, suppressLink ? { ...part, href: '' } : part);
  }

  if (part.type === 'image' && includeImages.checked) {
    const src = imageSrcMap.get(part.src) || part.src;
    const alt = escapeHtml(part.alt || '');
    const imageHtml = `<img class="inline-emote" src="${escapeHtml(src)}" alt="${alt}" style="${imageStyle}">`;
    return !suppressLink && part.href
      ? `<a href="${escapeHtml(part.href)}">${imageHtml}</a>`
      : imageHtml;
  }

  return '';
}

function buildHtml(result, imageSrcMap = new Map(), options = {}) {
  const imageStyle = options.preserveImageSize
    ? 'height:auto;vertical-align:middle;'
    : 'max-width:120px;max-height:120px;height:auto;vertical-align:middle;';

  const entries = result.items.map(item => {
    const author = includeAuthor.checked && item.author
      ? `<p class="plurk-author" style="margin:0 0 4px;font-weight:700;"><strong>【${escapeHtml(item.author)}】</strong></p>`
      : '';

    const bodyParts = [];
    for (let index = 0; index < item.parts.length;) {
      const part = item.parts[index];
      if (part.linkPreviewHref) {
        const href = part.linkPreviewHref;
        const previewParts = [];
        while (index < item.parts.length && item.parts[index].linkPreviewHref === href) {
          previewParts.push(item.parts[index]);
          index += 1;
        }
        const previewHtml = previewParts
          .map(previewPart => buildRichPart(previewPart, imageSrcMap, imageStyle, true))
          .join('');
        bodyParts.push(`<a href="${escapeHtml(href)}">${previewHtml}</a>`);
        continue;
      }

      bodyParts.push(buildRichPart(part, imageSrcMap, imageStyle));
      index += 1;
    }
    const body = bodyParts.join('');

    return `<div class="plurk-entry" style="margin:0 0 18px;">${author}<p class="plurk-body" style="margin:0;line-height:1.6;">${body}</p></div>`;
  }).join('');

  return `<div class="plurk-conversation">${entries}</div>`;
}

function isPlurkThumbnailUrl(url) {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split('/').pop() || '';
    return parsed.hostname.toLowerCase() === 'images.plurk.com' && filename.startsWith('mx_');
  } catch (_) {
    return false;
  }
}

function getOriginalImageSrcMap(result) {
  const imageSrcMap = new Map();
  for (const item of result.items) {
    for (const part of item.parts) {
      if (part.type === 'image' && part.src && part.href && isPlurkThumbnailUrl(part.src)) {
        imageSrcMap.set(part.src, part.href);
      }
    }
  }
  return imageSrcMap;
}

function renderPreview() {
  if (!lastResult) {
    preview.innerHTML = '';
    return;
  }
  preview.innerHTML = buildHtml(lastResult);
}

function collectImageUrls(result) {
  const urls = new Set();
  if (!includeImages.checked) return [];

  for (const item of result.items) {
    for (const part of item.parts) {
      if (part.type === 'image' && part.src) urls.add(part.src);
    }
  }
  return [...urls];
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractConversation() {
  setStatus('擷取中…');
  const tab = await getActiveTab();

  if (!tab?.id || !tab.url?.includes('plurk.com')) {
    setStatus('請先打開 Plurk 頁面。', 'error');
    return;
  }

  try {
    let response;

    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PLURK_CONVERSATION' });
    } catch (error) {
      // A newly installed/reloaded extension is not injected into tabs that were
      // already open. Inject content.js on demand, then retry once.
      if (!String(error?.message || '').includes('Receiving end does not exist')) {
        throw error;
      }

      setStatus('重新連接 Plurk 頁面…');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PLURK_CONVERSATION' });
    }

    if (!response?.ok) throw new Error(response?.error || '擷取失敗');

    lastResult = response.data;
    renderPreview();
    setStatus(`已擷取 ${lastResult.items.length} 則內容。`);
  } catch (error) {
    setStatus(`擷取失敗：${error.message}`, 'error');
  }
}

async function copyRichForGoogleDocs() {
  if (!lastResult) return setStatus('請先擷取交流。');

  try {
    // Google Docs commonly strips data: images from pasted HTML. Keep the
    // original absolute HTTPS image URLs in the clipboard HTML so Docs can
    // fetch/import them itself.
    const html = buildHtml(lastResult);
    const plainText = buildPlainText(lastResult);
    const total = collectImageUrls(lastResult).length;

    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' })
    });

    await navigator.clipboard.write([clipboardItem]);

    if (total === 0) {
      setStatus('已複製富文字，可直接貼到 Google Docs。');
    } else {
      setStatus(`已複製格式化內容；包含 ${total} 個圖片來源，圖片是否顯示取決於目標編輯器。`);
    }
  } catch (error) {
    console.error(error);
    setStatus(`富文字複製失敗：${error.message}`);
  }
}

async function copyRichPreservingImageSize() {
  if (!lastResult) return setStatus('請先擷取交流。');

  try {
    const html = buildHtml(lastResult, new Map(), { preserveImageSize: true });
    const plainText = buildPlainText(lastResult);
    const total = collectImageUrls(lastResult).length;
    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' })
    });

    await navigator.clipboard.write([clipboardItem]);
    setStatus(total === 0
      ? '已複製含格式內容；內容沒有圖片或表符。'
      : `已複製含格式內容；包含 ${total} 個圖片來源，未限制複製內容中的圖片尺寸。`);
  } catch (error) {
    console.error(error);
    setStatus(`複製含格式內容失敗：${error.message}`, 'error');
  }
}

async function copyRichWithOriginalImages() {
  if (!lastResult) return setStatus('請先擷取交流。');

  try {
    const imageSrcMap = getOriginalImageSrcMap(lastResult);
    const html = buildHtml(lastResult, imageSrcMap, { preserveImageSize: true });
    const plainText = buildPlainText(lastResult);
    const total = collectImageUrls(lastResult).length;
    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' })
    });

    await navigator.clipboard.write([clipboardItem]);
    setStatus(`已複製含格式內容；已將 ${imageSrcMap.size} 張 Plurk 縮圖改用原圖 URL${total ? `，共 ${total} 個圖片來源` : ''}。`);
  } catch (error) {
    console.error(error);
    setStatus(`複製原圖格式內容失敗：${error.message}`, 'error');
  }
}

// DOCX reliable mode: package the conversation and its image bytes into a
// self-contained OOXML file. No remote image URL is needed after export.
const DOCX_EMU_PER_PX = 9525;

function xmlEscape(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value) {
  return Uint8Array.of(value & 255, (value >>> 8) & 255);
}

function uint32(value) {
  return Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function createStoredZip(files, type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const checksum = crc32(data);
    const localHeader = concatBytes([
      uint32(0x04034b50), uint16(20), uint16(0x0800), uint16(0),
      uint16(0), uint16(0), uint32(checksum), uint32(data.length),
      uint32(data.length), uint16(name.length), uint16(0), name
    ]);
    localParts.push(localHeader, data);

    centralParts.push(concatBytes([
      uint32(0x02014b50), uint16(20), uint16(20), uint16(0x0800),
      uint16(0), uint16(0), uint16(0), uint32(checksum),
      uint32(data.length), uint32(data.length), uint16(name.length),
      uint16(0), uint16(0), uint16(0), uint16(0), uint32(0),
      uint32(offset), name
    ]));
    offset += localHeader.length + data.length;
  }

  const central = concatBytes(centralParts);
  const end = concatBytes([
    uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length),
    uint16(files.length), uint32(central.length), uint32(offset), uint16(0)
  ]);
  return new Blob([...localParts, central, end], {
    type
  });
}

async function normalizeDocxImage(blob) {
  const type = (blob.type || '').toLowerCase();
  if (type.includes('png')) return { blob, extension: 'png', contentType: 'image/png' };
  if (type.includes('jpeg') || type.includes('jpg')) {
    return { blob, extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (type.includes('gif')) return { blob, extension: 'gif', contentType: 'image/gif' };

  // Word/Google Docs support for WebP and SVG varies. Rasterize those formats
  // to PNG so the exported file remains portable.
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await canvas.convertToBlob({ type: 'image/png' });
  return { blob: png, extension: 'png', contentType: 'image/png' };
}

async function getImageDimensions(blob) {
  const bitmap = await createImageBitmap(blob);
  const dimensions = { width: bitmap.width || 1, height: bitmap.height || 1 };
  bitmap.close();
  return dimensions;
}

function docxRunProperties(part = {}) {
  const marks = new Set(part.marks || []);
  const properties = [];
  if (marks.has('bold')) properties.push('<w:b/>');
  if (marks.has('italic')) properties.push('<w:i/>');
  if (marks.has('underline')) properties.push('<w:u w:val="single"/>');
  if (marks.has('strike')) properties.push('<w:strike/>');
  if (marks.has('sup')) properties.push('<w:vertAlign w:val="superscript"/>');
  if (marks.has('sub')) properties.push('<w:vertAlign w:val="subscript"/>');
  if (marks.has('code')) properties.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>');
  if (part.href) properties.push('<w:color w:val="0563C1"/><w:u w:val="single"/>');
  return properties.length ? `<w:rPr>${properties.join('')}</w:rPr>` : '';
}

function docxTextRuns(part) {
  const properties = docxRunProperties(part);
  return String(part.value || '').split('\n').map((line, index) => {
    const br = index ? '<w:r><w:br/></w:r>' : '';
    return `${br}<w:r>${properties}<w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`;
  }).join('');
}

function docxImageRun(image, drawingId, alt = '') {
  const maxPixels = 120;
  const scale = Math.min(1, maxPixels / image.width, maxPixels / image.height);
  const cx = Math.max(1, Math.round(image.width * scale * DOCX_EMU_PER_PX));
  const cy = Math.max(1, Math.round(image.height * scale * DOCX_EMU_PER_PX));
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${drawingId}" name="Image ${drawingId}" descr="${xmlEscape(alt)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="Image ${drawingId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${image.relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

async function buildDocx(result) {
  const files = [];
  const images = new Map();
  const imageUrls = collectImageUrls(result);
  const contentTypes = new Set();
  let failedImages = 0;

  for (let index = 0; index < imageUrls.length; index += 1) {
    const url = imageUrls[index];
    setStatus(`DOCX：嵌入圖片 ${index + 1}/${imageUrls.length}…`);
    try {
      const normalized = await normalizeDocxImage(await fetchImageBlob(url));
      const dimensions = await getImageDimensions(normalized.blob);
      const number = images.size + 1;
      const filename = `image${number}.${normalized.extension}`;
      const relationshipId = `rIdImage${number}`;
      images.set(url, { filename, relationshipId, ...dimensions });
      contentTypes.add(`<Default Extension="${normalized.extension}" ContentType="${normalized.contentType}"/>`);
      files.push({ name: `word/media/${filename}`, data: new Uint8Array(await normalized.blob.arrayBuffer()) });
    } catch (error) {
      failedImages += 1;
      console.warn('DOCX 圖片嵌入失敗：', url, error);
    }
  }

  const relationships = [];
  for (const image of images.values()) {
    relationships.push(`<Relationship Id="${image.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${image.filename}"/>`);
  }

  const hyperlinkIds = new Map();
  function hyperlinkId(url) {
    if (!hyperlinkIds.has(url)) hyperlinkIds.set(url, `rIdLink${hyperlinkIds.size + 1}`);
    return hyperlinkIds.get(url);
  }

  let drawingId = 1;
  const paragraphs = [];
  for (const item of result.items) {
    if (includeAuthor.checked && item.author) {
      paragraphs.push(`<w:p><w:pPr><w:spacing w:before="0" w:after="40" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">【${xmlEscape(item.author)}】</w:t></w:r></w:p>`);
    }

    const runs = [];
    function docxPartContents(part) {
      if (part.type === 'text') return docxTextRuns(part);
      if (part.type === 'image' && includeImages.checked) {
        const image = images.get(part.src);
        return image
          ? docxImageRun(image, drawingId++, part.alt)
          : `<w:r><w:t xml:space="preserve">${xmlEscape(part.alt ? `[圖片：${part.alt}]` : '[圖片]')}</w:t></w:r>`;
      }
      return '';
    }

    for (let index = 0; index < item.parts.length;) {
      const part = item.parts[index];
      if (part.linkPreviewHref) {
        const href = part.linkPreviewHref;
        const previewParts = [];
        while (index < item.parts.length && item.parts[index].linkPreviewHref === href) {
          previewParts.push(item.parts[index]);
          index += 1;
        }
        const contents = previewParts.map(docxPartContents).join('');
        runs.push(contents
          ? `<w:hyperlink r:id="${hyperlinkId(href)}" w:history="1">${contents}</w:hyperlink>`
          : '');
        continue;
      }

      let contents = docxPartContents(part);
      if (contents && part.href) {
        contents = `<w:hyperlink r:id="${hyperlinkId(part.href)}" w:history="1">${contents}</w:hyperlink>`;
      }
      runs.push(contents);
      index += 1;
    }
    paragraphs.push(`<w:p><w:pPr><w:spacing w:before="0" w:after="160" w:line="276" w:lineRule="auto"/></w:pPr>${runs.join('')}</w:p>`);
  }

  for (const [url, id] of hyperlinkIds) {
    relationships.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(url)}" TargetMode="External"/>`);
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${paragraphs.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[...contentTypes].join('')}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;

  files.push(
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/_rels/document.xml.rels', data: relsXml }
  );
  return { blob: createStoredZip(files), embedded: images.size, failed: failedImages };
}

function safeDocxFilename(result) {
  const pid = String(result.pid || 'conversation').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `Plurk-Conversation-${pid}.docx`;
}

async function exportDocx() {
  if (!lastResult) return setStatus('請先擷取交流。');
  try {
    const { blob, embedded, failed } = await buildDocx(lastResult);
    const url = URL.createObjectURL(blob);
    try {
      await chrome.downloads.download({ url, filename: safeDocxFilename(lastResult), saveAs: true });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    setStatus(failed
      ? `DOCX 已匯出；嵌入 ${embedded} 張圖片，${failed} 張改為文字標記。`
      : `DOCX 已匯出；已嵌入 ${embedded} 張圖片 / 表符。`);
  } catch (error) {
    console.error(error);
    setStatus(`DOCX 匯出失敗：${error.message}`);
  }
}


function getImageIndexMap(result) {
  const map = new Map();
  let index = 1;
  for (const item of result.items) {
    for (const part of item.parts) {
      if (part.type !== 'image' || !part.src || map.has(part.src)) continue;
      map.set(part.src, index);
      index += 1;
    }
  }
  return map;
}

function extensionForBlob(blob, url = '') {
  const type = (blob.type || '').toLowerCase();
  if (type.includes('gif')) return 'gif';
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('svg')) return 'svg';
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (match) return match[1].toLowerCase();
  } catch (_) {}
  return 'png';
}

async function fetchImageBlob(url) {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'force-cache'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (blob.type.startsWith('image/')) return blob;

  // Plurk's emoticon CDN sometimes serves valid image bytes as the generic
  // application/octet-stream type. Detect the real format from its signature
  // instead of rejecting those files based only on the response header.
  const header = new Uint8Array(await blob.slice(0, 512).arrayBuffer());
  const is = (...bytes) => bytes.every((byte, index) => header[index] === byte);
  let detectedType = '';

  if (is(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    detectedType = 'image/png';
  } else if (is(0xff, 0xd8, 0xff)) {
    detectedType = 'image/jpeg';
  } else if (
    is(0x47, 0x49, 0x46, 0x38, 0x37, 0x61) ||
    is(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)
  ) {
    detectedType = 'image/gif';
  } else if (
    is(0x52, 0x49, 0x46, 0x46) &&
    header[8] === 0x57 && header[9] === 0x45 &&
    header[10] === 0x42 && header[11] === 0x50
  ) {
    detectedType = 'image/webp';
  } else {
    const prefix = new TextDecoder().decode(header).replace(/^\uFEFF/, '').trimStart();
    if (/^(?:<\?xml[\s\S]*?)?<svg(?:\s|>)/i.test(prefix)) {
      detectedType = 'image/svg+xml';
    }
  }

  if (!detectedType) throw new Error(`不是可辨識的圖片：${blob.type || '無 Content-Type'}`);
  return new Blob([blob], { type: detectedType });
}

async function downloadImageAssets() {
  if (!lastResult) return setStatus('請先擷取交流。');

  const imageIndexMap = getImageIndexMap(lastResult);
  const urls = includeImages.checked ? [...imageIndexMap.keys()] : [];
  if (!urls.length) return setStatus('這則交流沒有可下載的圖片 / 表符。');

  const files = [];
  const manifestLines = [
    'Plurk 圖片與表符對照表',
    '',
    '純文字中的 [圖片編號] 對應 ZIP 內 images/ 資料夾的檔案。',
    ''
  ];
  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const imageNumber = imageIndexMap.get(url);
    const label = `圖片${imageNumber}`;
    setStatus(`下載圖片 ${i + 1}/${urls.length}…`);
    try {
      const blob = await fetchImageBlob(url);
      const ext = extensionForBlob(blob, url);
      const filename = `images/${label}.${ext}`;
      files.push({ name: filename, data: new Uint8Array(await blob.arrayBuffer()) });
      manifestLines.push(`[圖片${imageNumber}] -> ${filename}`);
      manifestLines.push('狀態：已下載', '');
      downloaded += 1;
    } catch (error) {
      failed += 1;
      manifestLines.push(`[圖片${imageNumber}] -> images/${label}.(檔案類型未知)`);
      manifestLines.push('狀態：下載失敗', '');
      console.warn('圖片下載失敗：', url, error);
    }
  }

  manifestLines.push(`總數：${urls.length}`, `成功：${downloaded}`, `失敗：${failed}`);
  files.push({ name: '圖片對照表.txt', data: manifestLines.join('\n') });

  const zipBlob = createStoredZip(files, 'application/zip');
  const zipUrl = URL.createObjectURL(zipBlob);
  try {
    await chrome.downloads.download({
      url: zipUrl,
      filename: 'Plurk-Conversation-Images.zip',
      saveAs: true
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(zipUrl), 30000);
  }

  if (failed === 0) {
    setStatus(`已打包 ${downloaded} 張圖片與表符。`);
  } else {
    setStatus(`已打包 ${downloaded} 張圖片與表符；${failed} 張下載失敗。`, 'error');
  }
}

document.getElementById('extract').addEventListener('click', extractConversation);
document.getElementById('copyRich').addEventListener('click', copyRichForGoogleDocs);
document.getElementById('copyRichOriginalSize').addEventListener('click', copyRichPreservingImageSize);
document.getElementById('copyRichOriginalImages').addEventListener('click', copyRichWithOriginalImages);
document.getElementById('exportDocx').addEventListener('click', exportDocx);

document.getElementById('copyText').addEventListener('click', async () => {
  if (!lastResult) return setStatus('請先擷取交流。');
  try {
    const text = buildPlainText(lastResult);
    await navigator.clipboard.writeText(text);
    setStatus('已複製純文字。');
  } catch (error) {
    setStatus(`純文字複製失敗：${error.message}`);
  }
});

includeAuthor.addEventListener('change', renderPreview);
includeImages.addEventListener('change', renderPreview);


document.getElementById('downloadImages').addEventListener('click', downloadImageAssets);
