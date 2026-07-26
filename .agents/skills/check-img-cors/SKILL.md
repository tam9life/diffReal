---
name: check-img-cors
description: Inspect, implement, or extend diffReal's Puppeteer browser-context request path with Chromium web security intentionally disabled. Use when fetching authenticated or cross-origin URLs from a loaded page, diagnosing CORS-related resource failures, or adding inspection of images, text, HTML, JSON, audio, video, documents, and other response types while preserving browser cookies and session state.
---

# Check Image CORS

Use the repository's browser session as a general cross-origin resource client. Preserve the intentional CORS bypass unless the user explicitly asks to change the security model.

## Inspect the current path

1. Read `cli/index.js` before editing.
2. Confirm Chromium starts with both existing flags:

   ```js
   '--disable-web-security',
   '--disable-features=IsolateOrigins,site-per-process',
   ```

3. Confirm `userDataDir` remains persistent so authenticated cookies and browser state can be reused.
4. Distinguish the three stages:
   - Navigate to the page with `page.goto()`.
   - Discover target resource URLs in the rendered DOM or network activity.
   - Request each resource inside `page.evaluate()` with `credentials: 'include'`.

Do not describe Puppeteer or Stealth as the mechanism that bypasses CORS. The decisive mechanism in this repository is Chromium's `--disable-web-security` flag. Stealth only changes automation-detection signals.

## Implement a browser-context request

Resolve relative URLs against the loaded page and return structured diagnostics as well as content. Use this pattern for moderate-size responses:

```js
const result = await page.evaluate(async ({ url, init }) => {
  try {
    const absoluteUrl = new URL(url, document.baseURI).href;
    const response = await fetch(absoluteUrl, {
      ...init,
      credentials: 'include',
    });
    const contentType = response.headers.get('content-type') || '';

    let body;
    let encoding;
    if (contentType.includes('application/json')) {
      body = await response.json();
      encoding = 'json';
    } else if (contentType.startsWith('text/') || contentType.includes('html') || contentType.includes('xml')) {
      body = await response.text();
      encoding = 'text';
    } else {
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      body = btoa(binary);
      encoding = 'base64';
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      contentType,
      encoding,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}, { url: targetUrl, init: requestInit });
```

Keep request methods, headers, and bodies configurable when the task requires more than `GET`. Do not log authorization headers, cookies, signed query strings, or response bodies containing secrets.

## Select handling by resource type

- Text, HTML, XML, CSS, and JavaScript: use `response.text()`.
- JSON: use `response.json()`, falling back to text when the payload is malformed.
- Images, fonts, PDFs, and small audio/video files: use `arrayBuffer()` and Base64 when passing data through `page.evaluate()`.
- Large audio/video or unknown-size binary files: do not Base64 the entire body in the renderer. Capture the original browser response with Puppeteer's response/CDP APIs or stream to a bounded temporary file.
- Media playlists and segmented video: inspect the page's network responses for manifest and segment URLs instead of assuming the `<video src>` value is the complete media file.
- Blob URLs: read them inside the page that owns the Blob; they are not reusable as ordinary Node.js URLs.

Preserve the original URL, final response URL, HTTP status, content type, byte size, and failure message so downstream inspectors can explain omissions.

## Discover resources

Choose discovery based on the requested content:

- Images: inspect `img.currentSrc`, `srcset`, lazy-load data attributes, `<picture>`, computed CSS backgrounds, and relevant network responses.
- Text: inspect rendered DOM text when visual content matters; fetch document or API URLs when source payload matters.
- Video/audio: inspect `currentSrc`, `<source>` elements, performance entries, and network responses for manifests and segments.
- API/document requests: accept an explicit URL or observe matching `fetch`/XHR responses.

Register network listeners before `page.goto()` when the task depends on resources loaded during initial navigation. Deduplicate normalized absolute URLs.

## Diagnose failures

Report the failing stage instead of silently skipping it:

1. Navigation failure or challenge page.
2. Resource URL not discovered.
3. Browser-context `fetch` rejected.
4. HTTP non-success status.
5. Missing authentication or cookie-policy restriction.
6. Response decoding, size, or downstream inspection failure.

Remember that disabling browser CORS does not override server-side authorization, expired signed URLs, hotlink protection, request-method restrictions, bot mitigation, or unavailable resources. Reproduce the request in the same page/session before concluding that CORS is the cause.

## Preserve repository intent

- Keep the existing web-security flags when implementing this workflow.
- Reuse the persistent browser profile and page context for authenticated targets.
- Do not silently replace browser-context fetches with plain Node.js fetches; doing so can lose browser cookies, challenge state, service-worker behavior, and browser-generated headers.
- Avoid unrelated changes to classification logic when extending resource acquisition.
- Add focused diagnostics and tests for the requested resource type.
- Treat removal of the CORS bypass, sandbox policy changes, and credential propagation changes as separate decisions requiring an explicit user request.
