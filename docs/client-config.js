'use strict';

(() => {
  const DEFAULT_SERVER_URL = 'https://server.churamidgameday2026.me';
  const params = new URLSearchParams(window.location.search);

  let value = params.get('server')
    || localStorage.getItem('gameday-server-url')
    || DEFAULT_SERVER_URL
    || '';

  value = String(value).trim().replace(/\/+$/, '');
  if (value && !/^https?:\/\//i.test(value)) value = '';

  if (value) {
    try {
      localStorage.setItem('gameday-server-url', value);
    } catch (error) {
      console.warn('Không lưu được URL máy chủ:', error);
    }
  }

  window.GAMEDAY_API_BASE = value;
})();
