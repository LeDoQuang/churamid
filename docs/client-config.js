'use strict';

(() => {
  const params = new URLSearchParams(window.location.search);
  let value = params.get('server')
    || localStorage.getItem('gameday-server-url')
    || '';

  value = String(value).trim().replace(/\/+$/, '');
  if (value && !/^https?:\/\//i.test(value)) value = '';

  window.GAMEDAY_API_BASE = value;
})();
