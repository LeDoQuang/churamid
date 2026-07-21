'use strict';

(() => {
  const SERVER_URL =
    'https://crowd-reward-championship-trainers.trycloudflare.com';

  const queryServer =
    new URLSearchParams(window.location.search).get('server');

  const value = String(queryServer || SERVER_URL)
    .trim()
    .replace(/\/+$/, '');

  window.GAMEDAY_API_BASE = value;

  try {
    localStorage.setItem('gameday-server-url', value);
  } catch (error) {
    console.warn('Không lưu được URL server:', error);
  }
})();