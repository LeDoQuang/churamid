'use strict';
(()=>{
  const params=new URLSearchParams(location.search);let value=params.get('server')||localStorage.getItem('gameday-server-url')||'';
  value=String(value).trim().replace(/\/+$/,'');
  if(value&&!/^https?:\/\//i.test(value))value='';
  if(value)localStorage.setItem('gameday-server-url',value);
  window.GAMEDAY_API_BASE=value;
})();
