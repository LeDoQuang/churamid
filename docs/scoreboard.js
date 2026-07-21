'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const API_BASE=window.GAMEDAY_API_BASE||'';const apiUrl=path=>API_BASE?`${API_BASE}${path}`:path;
const labels={registration:'Đang mở phòng chờ',running:'Sự kiện đang diễn ra',paused:'Sự kiện đang tạm dừng',ended:'Sự kiện đã kết thúc'};
function render(data){
  $('#eventStatus').textContent=labels[data.event.status]||data.event.status;
  $('#stateDot').style.background=data.event.status==='running'?'var(--green)':data.event.status==='ended'?'var(--red)':'var(--gold)';
  $('#updatedAt').textContent=`Cập nhật ${new Date().toLocaleTimeString('vi-VN')}`;
  const finished=data.teams.filter(t=>t.completionMs!=null).slice(0,3);
  $('#podium').innerHTML=finished.length?finished.map((t,i)=>`<article><span>Hạng ${i+1}</span><b>${esc(t.name)}</b><small>Hoàn thành trong ${esc(t.completionText)}</small></article>`).join(''):'<article><span>Đang chờ</span><b>Chưa có đội hoàn thành</b><small>Thứ hạng sẽ xuất hiện tại đây.</small></article>';
  $('#rows').innerHTML=data.teams.map((t,i)=>`<div class="row"><div class="rank">${t.completionMs!=null?t.rank:'—'}</div><div class="team"><b>${esc(t.name)}</b><small>${esc(t.status)}</small></div><div class="progress"><b>${t.completionMs!=null?'Đã hoàn thành':t.stage?`Tầng ${t.stage}`:'Phòng chờ'}</b><small>${t.completionMs==null?`Thời gian hiện tại ${esc(t.elapsedText)}`:new Date(t.finishedAt).toLocaleString('vi-VN')}</small></div><div class="online ${t.playerCount>=3&&t.online===t.playerCount?'good':''}">${t.online}/${t.playerCount||4}</div><div class="time">${esc(t.completionText==='—'?t.elapsedText:t.completionText)}</div></div>`).join('');
  $('#empty').hidden=data.teams.length>0;
}
async function load(){try{const r=await fetch(apiUrl('/api/public/scoreboard'),{cache:'no-store'});const d=await r.json();if(d.ok)render(d)}catch{$('#eventStatus').textContent='Mất kết nối máy chủ'}}
load();setInterval(load,2000);
