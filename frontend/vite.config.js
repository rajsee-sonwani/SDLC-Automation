import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Required for WebContainers (needs SharedArrayBuffer / cross-origin isolation).
    // 'credentialless' rather than 'require-corp': both give us cross-origin
    // isolation, but require-corp additionally blocks every no-CORS subresource
    // that doesn't send CORP -- which includes cdn.tailwindcss.com (verified: it
    // sends neither CORP nor CORS headers, so `crossorigin` wouldn't help). That
    // silently broke Tailwind inside the generated-app preview iframes, making
    // every generated app render unstyled.
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
})
