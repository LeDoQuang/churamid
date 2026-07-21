'use strict';
const $=s=>document.querySelector(s);
const message=$('#message');
const API_BASE=window.GAMEDAY_API_BASE||'';
const apiUrl=path=>API_BASE?`${API_BASE}${path}`:path;
if(!API_BASE&&location.hostname.endsWith('.github.io'))show('Link này chưa có địa chỉ server. Hãy mở link do ban tổ chức cung cấp.');
function show(text,good=false){message.textContent=text||'';message.className=`message${good?' good':''}`}
async function api(path,options={}){
  try{
    const r=await fetch(apiUrl(path),{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
    const d=await r.json().catch(()=>({}));
    return{...d,status:r.status};
  }catch(e){
    return{ok:false,message:'Không kết nối được máy chủ.'};
  }
}
function saveLogin(data){
  sessionStorage.setItem('gameday-session',data.session);
  sessionStorage.setItem('gameday-profile',JSON.stringify(data.profile));
  location.href='./game.html';
}
$('#playerForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const button=e.submitter;
  button.disabled=true;
  show('Đang đăng nhập...');
  const r=await api('/api/auth/team',{
    method:'POST',
    body:JSON.stringify({
      account:$('#teamAccount').value.trim(),
      password:$('#teamPassword').value,
      playerName:$('#playerName').value.trim()
    })
  });
  button.disabled=false;
  if(r.ok){show('Đăng nhập thành công.',true);saveLogin(r)}
  else show(r.message||'Không thể đăng nhập.');
});
