/**
 * SNSHero Revolution - Service Worker (Media Cache Only)
 * 이미지 및 사운드 에셋만 영구 캐싱하고,
 * HTML, JS 번들, CSS, JSON, API 등 모든 코드/데이터는 실시간 네트워크에서 즉시 받아옵니다.
 */

const MEDIA_CACHE_NAME = 'snshero-media-v24-20261123-shield-icon';

// 정적 이미지 에셋만 캐싱 (iOS Safari AVPlayer의 HTTP 206 Range 오디오 스트림 충돌 원천 차단!)
const MEDIA_EXT_REGEX = /\.(png|jpg|jpeg|webp|gif|svg|ico|avif)(\?.*)?$/i;

function isValidMediaResponse(res) {
  if (!res || res.status !== 200) return false;
  if (res.type !== 'basic' && res.type !== 'cors') return false;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) return false;
  return true;
}

self.addEventListener('install', (event) => {
  // 새 서비스 워커 즉시 활성화
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // 구버전 캐시 또는 미디어 캐시가 아닌 구 캐시 정리
          if (key !== MEDIA_CACHE_NAME) {
            console.log('[SW] Deleting stale non-media cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // GET 요청만 처리하고, 네비게이션·Range 부분 요청·오디오/비디오 스트림은 브라우저 표준 스택으로 직접 통과
  if (
    request.method !== 'GET' ||
    request.mode === 'navigate' ||
    request.headers.has('range') ||
    request.destination === 'audio' ||
    request.destination === 'video'
  ) {
    return;
  }

  const url = new URL(request.url);

  // 외부 도메인(Google Analytics, GTM, AdSense 등) 요청은 서비스 워커가 절대 가로채지 않고 브라우저 직접 통과
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1. 캐릭터 상반신(busts/upper-hd), 컷아웃, 브랜드/아이콘 및 홍보 스크린샷 에셋: Network-First 전략 (업데이트된 이미지 즉시 반영)
  if (
    url.pathname.includes('/hs-assets/characters/busts/') ||
    url.pathname.includes('/hs-assets/characters/cutouts/') ||
    url.pathname.includes('/hs-assets/upper-hd/') ||
    url.pathname.includes('/hs-assets/bosses/') ||
    url.pathname.includes('/hs-assets/screenshots/') ||
    url.pathname.includes('/hs-assets/brand/') ||
    url.pathname === '/favicon.png' ||
    url.pathname === '/icon.png'
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (isValidMediaResponse(networkResponse)) {
            const responseClone = networkResponse.clone();
            caches
              .open(MEDIA_CACHE_NAME)
              .then((cache) => cache.put(request, responseClone))
              .catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return (isValidMediaResponse(cachedResponse) ? cachedResponse : null) || new Response(null, { status: 404 });
          });
        })
    );
    return;
  }

  // 2. 그 외 정적 이미지 파일: Cache-First 전략 (200 OK 정상 이미지만 안전하게 캐싱·반환)
  if (MEDIA_EXT_REGEX.test(url.pathname) || MEDIA_EXT_REGEX.test(url.href)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (isValidMediaResponse(cachedResponse)) {
          return cachedResponse;
        }
        return fetch(request)
          .then((networkResponse) => {
            if (isValidMediaResponse(networkResponse)) {
              const responseClone = networkResponse.clone();
              caches
                .open(MEDIA_CACHE_NAME)
                .then((cache) => cache.put(request, responseClone))
                .catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => {
            return new Response(null, { status: 404 });
          });
      })
    );
    return;
  }

  // 2. 그 외 모든 리소스 (HTML, JS, CSS, JSON, API, WebSocket 등):
  // 서비스 워커가 인터셉트하지 않고 브라우저 표준 네트워크 스택으로 즉시 전달 (Pass-through)
  // fetch(request, { cache: 'no-store' })로 인한 navigation TypeError 및 503 반환 원천 차단
  return;
});

// ─── Web Push Notification Handlers ────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: 'SNS히어로 (SNSHero)',
    body: '새로운 랭킹 대전 및 이벤트 소식이 도착했습니다!',
    icon: '/hs-assets/brand/pwa-icon-192.png',
    badge: '/hs-assets/brand/pwa-icon-192.png',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text();
    }
  }

  // iOS(WebKit Safari PWA)는 actions 및 vibrate를 지원하지 않으며 포함 시 TypeError가 발생하여 알림이 취소됩니다.
  const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent || '') || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  const origin = self.location ? self.location.origin : '';
  const iconUrl = (data.icon && data.icon.startsWith('http')) ? data.icon : (origin + (data.icon || '/hs-assets/brand/pwa-icon-192.png'));
  const badgeUrl = (data.badge && data.badge.startsWith('http')) ? data.badge : (origin + (data.badge || '/hs-assets/brand/pwa-icon-192.png'));

  const options = {
    body: data.body || '',
    icon: iconUrl,
    badge: badgeUrl,
    data: data.data || { url: '/' },
    tag: data.tag || ('snshero-' + Date.now()),
  };

  // Android/데스크톱에서만 actions, vibrate 확장
  if (!isIOS) {
    options.vibrate = [100, 50, 100];
    options.actions = [
      { action: 'open', title: '게임 접속하기' }
    ];
  }

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(data.title || 'SNS히어로', options);
      } catch (err) {
        // iOS WebKit TypeError 방어: 미지원 필드 전면 제거 후 최소 옵션으로 강제 표시
        try {
          await self.registration.showNotification(data.title || 'SNS히어로', {
            body: data.body || '',
            data: data.data || { url: '/' },
          });
        } catch (fallbackErr) {
          console.error('[SW] Notification fallback error:', fallbackErr);
        }
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
