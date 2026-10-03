const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER || undefined });
  try {
    const page = await browser.newPage();
    const report = await page.evaluate(async () => {
      const results = { userAgent: navigator.userAgent, types: {} };
      for (const mime of ['video/quicktime', 'video/mp4;codecs=avc1.42001E', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8']) {
        const supported = MediaRecorder.isTypeSupported(mime);
        const result = results.types[mime] = { supported };
        if (!supported) continue;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0,0,8,8);
        const stream = canvas.captureStream(15), chunks = [];
        let url, timer, video;
        try {
          const recorder = new MediaRecorder(stream, { mimeType: mime });
          recorder.ondataavailable = e => chunks.push(e.data);
          const done = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = reject; });
          recorder.start();
          timer = setInterval(() => { ctx.clearRect(0,0,32,32); ctx.fillStyle = 'red'; ctx.fillRect(0,0,8,8); }, 50);
          await new Promise(resolve => setTimeout(resolve, 400)); recorder.stop(); await done;
          clearInterval(timer);
          const blob = new Blob(chunks, { type: mime }); url = URL.createObjectURL(blob);
          video = document.createElement('video'); video.muted = true; video.src = url;
          await Promise.race([new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = reject; }), new Promise((_, reject) => setTimeout(() => reject(new Error('Decode timeout')), 5000))]);
          const seeked = new Promise((resolve, reject) => { video.onseeked = resolve; video.onerror = reject; });
          video.currentTime = 0.15;
          await Promise.race([seeked, new Promise((_, reject) => setTimeout(() => reject(new Error('Seek timeout')), 5000))]);
          ctx.clearRect(0,0,32,32); ctx.drawImage(video,0,0);
          result.decodedBackgroundAlpha = ctx.getImageData(24,24,1,1).data[3];
          result.decodedForegroundAlpha = ctx.getImageData(4,4,1,1).data[3];
          result.bytes = blob.size;
        } catch (error) { result.error = String(error); }
        finally { clearInterval(timer); stream.getTracks().forEach(t => t.stop()); if (url) URL.revokeObjectURL(url); video?.remove(); }
      }
      return results;
    });
    fs.mkdirSync('test-results', { recursive: true });
    fs.writeFileSync('test-results/capabilities.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
