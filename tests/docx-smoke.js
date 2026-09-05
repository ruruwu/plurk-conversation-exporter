const fs = require('fs');
const vm = require('vm');

const elements = new Map();
const pngFixture = new Blob([
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
], { type: 'application/octet-stream' });
let responseBlob = pngFixture;
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      checked: true,
      textContent: '',
      innerHTML: '',
      addEventListener() {}
    });
  }
  return elements.get(id);
}

const context = vm.createContext({
  Blob,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  Set,
  Map,
  URL,
  console,
  setTimeout,
  fetch: async () => ({ ok: true, blob: async () => responseBlob }),
  createImageBitmap: async () => ({ width: 1, height: 1, close() {} }),
  document: { getElementById: element },
  chrome: {
    tabs: {},
    scripting: {},
    downloads: { download: async () => 1 }
  },
  navigator: { clipboard: {} }
});

vm.runInContext(fs.readFileSync('popup.js', 'utf8'), context, { filename: 'popup.js' });

const fixture = {
  pid: 'docx-smoke',
  items: [
    {
      author: '測試者',
      parts: [
        { type: 'text', value: '中文內容與 ', marks: [] },
        { type: 'text', value: '粗體', marks: ['bold'] },
        { type: 'text', value: '斜體', marks: ['italic'] },
        { type: 'text', value: '底線', marks: ['underline'] },
        { type: 'text', value: '刪除線', marks: ['strike'] },
        { type: 'text', value: '\n第二行與連結', marks: [], href: 'https://www.plurk.com/' },
        { type: 'image', src: 'https://emos.plurk.com/test.png', alt: '測試表符' }
      ]
    },
    {
      author: '另一位使用者',
      parts: [{ type: 'text', value: 'DOCX smoke test completed.', marks: ['italic'] }]
    }
  ]
};

(async () => {
  context.__fixture = fixture;
  const signatures = [
    [pngFixture, 'image/png'],
    [new Blob([Buffer.from('GIF89a')], { type: 'application/octet-stream' }), 'image/gif'],
    [new Blob([Uint8Array.of(0xff, 0xd8, 0xff, 0xe0)], { type: 'application/octet-stream' }), 'image/jpeg'],
    [new Blob([Buffer.from('RIFF0000WEBP')], { type: 'application/octet-stream' }), 'image/webp'],
    [new Blob([Buffer.from('<?xml version="1.0"?><svg></svg>')], { type: 'application/octet-stream' }), 'image/svg+xml']
  ];
  for (const [blob, expectedType] of signatures) {
    responseBlob = blob;
    const detectedBlob = await vm.runInContext("fetchImageBlob('https://emos.plurk.com/test')", context);
    if (detectedBlob.type !== expectedType) {
      throw new Error(`octet-stream detection failed: expected ${expectedType}, got ${detectedBlob.type}`);
    }
  }
  responseBlob = pngFixture;
  const result = await vm.runInContext('buildDocx(__fixture)', context);
  if (result.embedded !== 1 || result.failed !== 0) {
    throw new Error(`DOCX image embedding failed: ${JSON.stringify(result)}`);
  }
  fs.writeFileSync(process.argv[2] || 'docx-smoke.docx', Buffer.from(await result.blob.arrayBuffer()));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
