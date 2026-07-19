'use strict';

const qs = new URLSearchParams(location.search);
const PLAYER_ID = Math.max(1, Math.min(4, Number(qs.get('player') || 1)));
const APP_CONFIG=window.GAMEDAY_CONFIG||{};
const API_STORAGE_KEY='gameday-api-base';
function normalizeApiBase(value){
  let v=String(value||'').trim();
  if(!v)return'';
  if(!/^https?:\/\//i.test(v))v=`https://${v}`;
  try{const u=new URL(v);return`${u.protocol}//${u.host}${u.pathname.replace(/\/+$/,'')}`;}catch{return''}
}
let API_BASE='';
try{
  const fromQuery=normalizeApiBase(qs.get('server'));
  const fromSaved=normalizeApiBase(localStorage.getItem(API_STORAGE_KEY));
  const fromConfig=normalizeApiBase(APP_CONFIG.API_BASE);
  API_BASE=fromQuery||fromSaved||fromConfig;
  if(fromQuery)localStorage.setItem(API_STORAGE_KEY,fromQuery);
}catch{API_BASE=normalizeApiBase(qs.get('server')||APP_CONFIG.API_BASE)}
const SAME_ORIGIN_SERVER=!API_BASE&&(location.port==='3000'||location.hostname==='localhost'||location.hostname==='127.0.0.1');
function apiUrl(path){return API_BASE?`${API_BASE}${path}`:path}
const TOKEN_KEY=`gameday-player-${PLAYER_ID}`;
let CLIENT_TOKEN;
try{CLIENT_TOKEN=sessionStorage.getItem(TOKEN_KEY)||((globalThis.crypto?.randomUUID?.())||`${Date.now()}-${Math.random().toString(36).slice(2)}`);sessionStorage.setItem(TOKEN_KEY,CLIENT_TOKEN)}catch{CLIENT_TOKEN=(globalThis.crypto?.randomUUID?.())||`${Date.now()}-${Math.random().toString(36).slice(2)}`}
const COLORS = ['#55d68b','#54a8ff','#b878ff','#ff9f55'];
const NAMES = ['Ranger','Orc','Dark Oracle','Fallen Angel'];
const MAP_NAMES = ['Phòng chờ','Tượng mã bí ẩn','Chạy thoát khỏi xác ướp','Hoàng đế trở về'];
const MAP_OBJECTIVES = [
  'Chờ đủ bốn thành viên',
  'Tìm bốn tượng khác biệt và giải đúng mật mã của tượng Sư Tử',
  'Đưa quả cầu tới cổng tầng 3 và chạy qua cửa',
  'Gạt hai cần, lấy chìa khóa và mở rương kho báu',
];
const STAGE_DESCRIPTIONS = [
  '',
  'Mười hai tượng mèo đứng thành vòng tròn. Bốn tượng có đặc điểm khác biệt; vị trí giờ của chúng là bốn số mở khóa.',
  'Quả cầu làm người cầm di chuyển chậm hơn. Chuyền cho đồng đội để né Golem và mang cầu tới cánh cửa tầng 3.',
  'P1 nhìn toàn bộ mê cung và chỉ đường. Hai người tìm hai cần gạt, người còn lại vào phòng lấy chìa khóa. Sau đó chỉ cần một người mang chìa tới rương.',
];

const ui = {
  canvas: document.getElementById('game'),
  mapTitle: document.getElementById('mapTitle'), objective: document.getElementById('objective'),
  roleDot: document.getElementById('roleDot'), roleText: document.getElementById('roleText'), onlineText: document.getElementById('onlineText'), timeText: document.getElementById('timeText'), cheatChip: document.getElementById('cheatChip'), connectionChip:document.getElementById('connectionChip'), connectionText:document.getElementById('connectionText'),
  mapProgress: document.getElementById('mapProgress'), interaction: document.getElementById('interaction'), toast: document.getElementById('toast'), controls: document.getElementById('controls'),
  lobby: document.getElementById('lobby'), roleAvatar: document.getElementById('roleAvatar'), lobbyRole: document.getElementById('lobbyRole'), roleDesc: document.getElementById('roleDesc'), slots: document.getElementById('slots'), readyBtn: document.getElementById('readyBtn'), waitingText: document.getElementById('waitingText'),
  stageIntro: document.getElementById('stageIntro'), stageEyebrow: document.getElementById('stageEyebrow'), stageName: document.getElementById('stageName'), stageDescription: document.getElementById('stageDescription'), countdown: document.getElementById('countdown'),
  resetOverlay: document.getElementById('resetOverlay'), resetReason: document.getElementById('resetReason'), resetCount: document.getElementById('resetCount'),
  inspectPanel: document.getElementById('inspectPanel'), inspectImage: document.getElementById('inspectImage'), inspectTitle: document.getElementById('inspectTitle'),
  keypad: document.getElementById('keypad'), codeDisplay: document.getElementById('codeDisplay'), keyGrid: document.getElementById('keyGrid'), keyFeedback: document.getElementById('keyFeedback'), clearCode: document.getElementById('clearCode'), submitCode: document.getElementById('submitCode'),
  winOverlay: document.getElementById('winOverlay'), finalTime: document.getElementById('finalTime'), restartBtn: document.getElementById('restartBtn'),
  mobileControls:document.getElementById('mobileControls'),joystick:document.getElementById('joystick'),joystickKnob:document.getElementById('joystickKnob'),mobileMain:document.getElementById('mobileMain'),mobileAlt:document.getElementById('mobileAlt'),mobileThird:document.getElementById('mobileThird'),
  serverSetup:document.getElementById('serverSetup'),serverUrlInput:document.getElementById('serverUrlInput'),connectServerBtn:document.getElementById('connectServerBtn'),useSameOriginBtn:document.getElementById('useSameOriginBtn'),serverStatus:document.getElementById('serverStatus'),
};
const ctx = ui.canvas.getContext('2d');
let W=1280,H=720,DPR=1,state=null,lastStatePhase='',lastStage=0,ready=false,codeInput='',cam={x:0,y:0},toastTimer=0;
let lastRender=performance.now(), animTime=0, frameDt=0;
let renderPlayers=[],renderMap2Golems=[],renderMap3Golems=[],renderBall=null;
const smoothCache=new Map();
const keys = new Set();
const pendingActions = [];
let cheatBuffer='';
let movementNeutralLock=true;
let touchMove={up:false,down:false,left:false,right:false};
let inputSeq=0,lastInputSignature='',lastInputAt=0,inputInFlight=false,inputQueued=false;
let pollFailures=0,pollTimer=0,stateRequestId=0,lastRevision=-1,connectionStarted=false;

const SRC = {
  floor:'assets/floor.png',wall:'assets/wall.png',glyph:'assets/wall_glyph.png',torch:'assets/torch.png',
  cat_normal:'assets/cat_normal.png',cat_red_nose:'assets/cat_red_nose.png',cat_square:'assets/cat_square.png',cat_yellow_eyes:'assets/cat_yellow_eyes.png',cat_swapped_collar:'assets/cat_swapped_collar.png',
  sphinx_closed:'assets/sphinx_closed.png',sphinx_open:'assets/sphinx_open.png',key:'assets/key.png',
  ball:'assets/ball.png',mud:'assets/mud.png',door2:'assets/door2.png',door3:'assets/door3.png',lever:'assets/lever.png',chest:'assets/chest.png',spike:'assets/spike_asset.png',
  p1_idle:'assets/p1_idle.png',p1_walk:'assets/p1_walk.png',p2_idle:'assets/p2_idle.png',p2_walk:'assets/p2_walk.png',p3_idle:'assets/p3_idle.png',p3_walk:'assets/p3_walk.png',p4_idle:'assets/p4_idle.png',p4_walk:'assets/p4_walk.png',
  golem_idle:'assets/golem_idle.png',golem_walk:'assets/golem_walk.png',golem2_idle:'assets/golem2_idle.png',golem2_walk:'assets/golem2_walk.png',golem3_idle:'assets/golem3_idle.png',golem3_walk:'assets/golem3_walk.png',
};
const IMG={};
const PLAYER_META=[
  {idleW:153,idle:5,walkW:153,walk:12},
  {idleW:136,idle:9,walkW:136,walk:12},
  {idleW:156,idle:7,walkW:155,walk:12},
  {idleW:158,idle:7,walkW:156,walk:12},
];
const GOLEM_META=[{w:151,idle:5,walk:12},{w:138,idle:5,walk:12},{w:148,idle:5,walk:12}];
const SHEET_META={door2:{w:166,h:180,frames:6},door3:{w:168,h:190,frames:6},lever:{w:162,h:160,frames:4},chest:{w:143,h:150,frames:4},torch:{w:118,h:100,frames:4}};

function smoothPoint(key,x,y,dt,threshold){
  let v=smoothCache.get(key);
  if(!v||Math.hypot(x-v.x,y-v.y)>threshold){v={x,y};smoothCache.set(key,v);return{x,y}}
  const k=1-Math.exp(-dt*22);v.x+=(x-v.x)*k;v.y+=(y-v.y)*k;return{x:v.x,y:v.y};
}
function updateVisuals(dt){
  if(!state){renderPlayers=[];renderMap2Golems=[];renderMap3Golems=[];renderBall=null;return}
  const unitThreshold=state.stage===3?3.2:360;
  renderPlayers=(state.players||[]).map(p=>({...p,...smoothPoint(`s${state.stage}-p${p.id}`,p.x,p.y,dt,unitThreshold)}));
  renderMap2Golems=(state.map2?.golems||[]).map((g,i)=>({...g,...smoothPoint(`s2-g${i}`,g.x,g.y,dt,360)}));
  renderMap3Golems=(state.map3?.golems||[]).map((g,i)=>({...g,...smoothPoint(`s3-g${i}`,g.x,g.y,dt,3.2)}));
  renderBall=state.map2?.ball?{...state.map2.ball,...smoothPoint('s2-ball',state.map2.ball.x,state.map2.ball.y,dt,420)}:null;
}
function cameraEase(rate=12){return 1-Math.exp(-frameDt*rate)}

function resize(){
  const r=ui.canvas.getBoundingClientRect();const coarse=matchMedia('(pointer:coarse)').matches;DPR=Math.min(coarse?1.35:2,window.devicePixelRatio||1);W=r.width;H=r.height;
  ui.canvas.width=Math.max(1,Math.round(W*DPR));ui.canvas.height=Math.max(1,Math.round(H*DPR));
}
addEventListener('resize',resize);resize();

function preload(){return Promise.all(Object.entries(SRC).map(([k,src])=>new Promise(res=>{const im=new Image();im.decoding='async';im.onload=()=>{IMG[k]=im;res()};im.onerror=()=>{IMG[k]=null;res()};im.src=src})))}

function fmt(s){s=Math.max(0,Math.floor(s||0));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function showToast(text,kind=''){clearTimeout(toastTimer);ui.toast.textContent=text;ui.toast.className=`toast show ${kind}`;toastTimer=setTimeout(()=>ui.toast.className='toast',1800)}
function panel(el,on){el.classList.toggle('show',on);el.setAttribute?.('aria-hidden',String(!on))}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>panel(document.getElementById(b.dataset.close),false)));

function updateRoleUI(){
  ui.roleDot.style.background=COLORS[PLAYER_ID-1];ui.roleText.textContent=`P${PLAYER_ID}`;
  ui.roleAvatar.src=`assets/avatar_p${PLAYER_ID}.png`;ui.lobbyRole.textContent=`P${PLAYER_ID} · ${NAMES[PLAYER_ID-1]}`;ui.roleDesc.textContent=PLAYER_ID===1?'Chỉ huy ở tầng 3, thành viên thường ở tầng 1 và 2':`Thành viên thám hiểm số ${PLAYER_ID}`;
}
updateRoleUI();

function buildKeypad(){
  [1,2,3,4,5,6,7,8,9,0].forEach(n=>{const b=document.createElement('button');b.type='button';b.textContent=n;if(n===0)b.className='zero-key';b.addEventListener('click',()=>appendDigit(String(n)));ui.keyGrid.appendChild(b)});
}
function updateCode(){ui.codeDisplay.textContent=[0,1,2,3].map(i=>codeInput[i]||'—').join(' ')}
function appendDigit(d){if(codeInput.length<4){codeInput+=d;updateCode()}}
function clearCode(){codeInput='';updateCode();ui.keyFeedback.textContent='';ui.keyFeedback.className='key-feedback'}
async function submitCode(){
  if(codeInput.length!==4){ui.keyFeedback.textContent='Cần nhập đủ bốn số.';ui.keyFeedback.className='key-feedback bad';return}
  const r=await post('/api/code',{player:PLAYER_ID,code:codeInput});
  if(r.ok){ui.keyFeedback.textContent='Mật mã chính xác!';ui.keyFeedback.className='key-feedback good';setTimeout(()=>panel(ui.keypad,false),350)}
  else{ui.keyFeedback.textContent='Sai mật mã.';ui.keyFeedback.className='key-feedback bad';codeInput='';updateCode()}
}
buildKeypad();ui.clearCode.addEventListener('click',clearCode);ui.submitCode.addEventListener('click',submitCode);

async function fetchJson(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),options.timeout||2500);
  try{
    const headers={...(options.headers||{}),'X-Player-Token':CLIENT_TOKEN};
    const response=await fetch(url,{...options,headers,signal:controller.signal,cache:'no-store'});
    const data=await response.json().catch(()=>({ok:false,error:`HTTP ${response.status}`}));
    return{...data,httpStatus:response.status};
  }catch(error){return{ok:false,error:error.name==='AbortError'?'Hết thời gian chờ':error.message,httpStatus:0}}
  finally{clearTimeout(timer)}
}
async function post(url,data){return fetchJson(apiUrl(url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})}
ui.readyBtn.addEventListener('click',async()=>{
  const r=await post('/api/ready',{player:PLAYER_ID,ready:true});
  if(r.ok){ready=true;ui.readyBtn.textContent='Đã sẵn sàng';ui.readyBtn.disabled=true}else showToast(r.message||'Không thể giữ vị trí người chơi.','bad');
});
ui.restartBtn.addEventListener('click',async()=>{const r=await post('/api/restart',{player:PLAYER_ID});if(r.ok)location.reload();else showToast(r.message||'Chỉ P1 có thể đưa đội về phòng chờ.','bad')});

function action(name){pendingActions.push(name);flushInput(true)}
addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.key&&e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    cheatBuffer=(cheatBuffer+e.key.toLowerCase()).slice(-40);
    if(cheatBuffer.endsWith('ledoquangdeptrais1tg')){action('cheat');cheatBuffer='';showToast('Đã gửi lệnh thử nghiệm.','good')}
  }
  if(ui.keypad.classList.contains('show')){
    if(/^Digit\d$/.test(e.code)&&!e.repeat)appendDigit(e.code.slice(-1));
    if(e.code==='Backspace'&&!e.repeat){codeInput=codeInput.slice(0,-1);updateCode()}
    if(e.code==='Enter'&&!e.repeat)submitCode();
    if(e.code==='Escape')panel(ui.keypad,false);
    return;
  }
  if(ui.inspectPanel.classList.contains('show')){if(e.code==='Escape'||e.code==='KeyE')panel(ui.inspectPanel,false);return}
  keys.add(e.code);
  if(e.repeat)return;
  if(e.code==='Space'&&state?.stage===2)action('pass');
  if(e.code==='KeyE'){
    if(state?.stage===1)interactMap1();
    else if(state?.stage===3)action(PLAYER_ID===1?'clear':'interact');
  }
  if(state?.stage===3&&PLAYER_ID===1){
    if(e.code==='Enter')action('mark');
    if(e.code==='KeyQ')action('danger');
  }
});
addEventListener('keyup',e=>{keys.delete(e.code);flushInput(true)});

function resetLocalInput(){keys.clear();touchMove={up:false,down:false,left:false,right:false};movementNeutralLock=true;ui.joystickKnob.style.transform='translate(0,0)';flushInput(true)}
addEventListener('blur',resetLocalInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetLocalInput();clearTimeout(pollTimer);scheduleStatePoll(document.hidden?450:20)});
addEventListener('pagehide',()=>{try{navigator.sendBeacon(apiUrl('/api/disconnect'),new Blob([JSON.stringify({player:PLAYER_ID,token:CLIENT_TOKEN})],{type:'text/plain;charset=UTF-8'}))}catch{}});

function inputState(){
  const movement={
    up:keys.has('KeyW')||keys.has('ArrowUp')||touchMove.up,
    down:keys.has('KeyS')||keys.has('ArrowDown')||touchMove.down,
    left:keys.has('KeyA')||keys.has('ArrowLeft')||touchMove.left,
    right:keys.has('KeyD')||keys.has('ArrowRight')||touchMove.right,
  };
  const any=movement.up||movement.down||movement.left||movement.right;
  if(!state||state.phase!=='playing')return{up:false,down:false,left:false,right:false};
  if(movementNeutralLock){if(!any)movementNeutralLock=false;return{up:false,down:false,left:false,right:false}}
  return movement;
}
async function flushInput(force=false){
  const input=inputState(),actions=pendingActions.splice(0),signature=JSON.stringify(input),now=Date.now();
  if(!force&&!actions.length&&signature===lastInputSignature&&now-lastInputAt<500)return;
  if(inputInFlight){pendingActions.unshift(...actions);inputQueued=true;return}
  inputInFlight=true;lastInputSignature=signature;lastInputAt=now;
  const seq=++inputSeq;
  await post('/api/input',{player:PLAYER_ID,input,actions,seq});
  inputInFlight=false;
  if(inputQueued||pendingActions.length){inputQueued=false;flushInput(true)}
}
setInterval(()=>flushInput(false),70);

function setConnection(mode,text){ui.connectionText.textContent=text;ui.connectionChip.classList.toggle('ok',mode==='ok');ui.connectionChip.classList.toggle('warn',mode!=='ok')}
function scheduleStatePoll(delay){clearTimeout(pollTimer);pollTimer=setTimeout(pollState,delay)}
async function pollState(){
  const requestId=++stateRequestId;
  const result=await fetchJson(apiUrl(`/api/state?player=${PLAYER_ID}&t=${Date.now()}`),{timeout:3000});
  if(requestId!==stateRequestId)return;
  if(result.httpStatus===409){setConnection('warn','Vị trí đang được dùng');ui.waitingText.textContent=result.message||'Vị trí này đang mở ở thiết bị khác.';scheduleStatePoll(1500);return}
  if(result.httpStatus>=200&&result.httpStatus<300&&Number.isFinite(result.revision)){
    pollFailures=0;setConnection('ok','Trực tuyến');
    if(result.revision>=lastRevision){lastRevision=result.revision;state=result;handleState()}
    scheduleStatePoll(document.hidden?450:90);
  }else{
    pollFailures++;setConnection('warn',pollFailures>2?'Đang kết nối lại':'Mạng chậm');
    scheduleStatePoll(Math.min(2500,250*Math.pow(1.6,pollFailures)));
  }
}

function setMobileButton(button,label,handler,visible=true){button.hidden=!visible;button.textContent=label;button.onclick=visible?handler:null}
function updateMobileControls(){
  if(!state)return;
  if(state.stage===1){setMobileButton(ui.mobileMain,'Tương tác',interactMap1);setMobileButton(ui.mobileAlt,'',null,false);setMobileButton(ui.mobileThird,'',null,false)}
  else if(state.stage===2){setMobileButton(ui.mobileMain,'Chuyền cầu',()=>action('pass'));setMobileButton(ui.mobileAlt,'',null,false);setMobileButton(ui.mobileThird,'',null,false)}
  else if(state.stage===3&&PLAYER_ID===1){setMobileButton(ui.mobileMain,'Đánh dấu',()=>action('mark'));setMobileButton(ui.mobileAlt,'Nguy hiểm',()=>action('danger'));setMobileButton(ui.mobileThird,'Xóa dấu',()=>action('clear'))}
  else if(state.stage===3){setMobileButton(ui.mobileMain,'Tương tác',()=>action('interact'));setMobileButton(ui.mobileAlt,'',null,false);setMobileButton(ui.mobileThird,'',null,false)}
}
let joyPointer=null;
function updateJoystick(e){
  const r=ui.joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.31,len=Math.hypot(dx,dy)||1,k=Math.min(1,max/len),x=dx*k,y=dy*k;
  ui.joystickKnob.style.transform=`translate(${x}px,${y}px)`;
  const dead=max*.28;touchMove={up:y<-dead,down:y>dead,left:x<-dead,right:x>dead};flushInput(true);
}
ui.joystick.addEventListener('pointerdown',e=>{joyPointer=e.pointerId;ui.joystick.setPointerCapture(e.pointerId);updateJoystick(e)});
ui.joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)updateJoystick(e)});
function releaseJoystick(e){if(joyPointer!==null&&(!e||e.pointerId===joyPointer)){joyPointer=null;touchMove={up:false,down:false,left:false,right:false};ui.joystickKnob.style.transform='translate(0,0)';flushInput(true)}}
ui.joystick.addEventListener('pointerup',releaseJoystick);ui.joystick.addEventListener('pointercancel',releaseJoystick);ui.joystick.addEventListener('lostpointercapture',releaseJoystick);


function handleState(){
  if(!state)return;
  ui.onlineText.textContent=`${state.connectedCount}/4`;ui.timeText.textContent=fmt(state.totalElapsed);ui.cheatChip.classList.toggle('show',state.cheat);
  ui.mapTitle.textContent=MAP_NAMES[state.stage]||MAP_NAMES[0];ui.objective.innerHTML=`<small>Mục tiêu</small><b>${MAP_OBJECTIVES[state.stage]}</b>`;
  updateSlots();updateProgress();updateOverlay();updateControls();updateMobileControls();
  const selfState=state.players?.[PLAYER_ID-1];if(state.phase==='lobby'&&selfState&&!selfState.ready){ready=false;ui.readyBtn.disabled=false;ui.readyBtn.textContent='Sẵn sàng'}
  if(Array.isArray(state.events))for(const ev of state.events){
    if(ev.type==='toast')showToast(ev.text,ev.kind);
    if(ev.type==='reset'){ui.resetReason.textContent=ev.reason||'Cả đội phải quay lại.'}
    if(ev.type==='win')ui.finalTime.textContent=fmt(state.totalElapsed);
  }
  if(lastStage!==state.stage){smoothCache.clear();cam.x=0;cam.y=0;pendingActions.length=0;keys.clear();touchMove={up:false,down:false,left:false,right:false};movementNeutralLock=true;ui.joystickKnob.style.transform='translate(0,0)';}
  if(lastStatePhase!==state.phase&&state.phase==='playing')movementNeutralLock=true;
  lastStatePhase=state.phase;lastStage=state.stage;
}
function updateSlots(){
  ui.slots.innerHTML='';
  (state?.players||[]).forEach(p=>{const d=document.createElement('div');d.className=`slot ${p.online?'online':''} ${p.ready?'ready':''}`;d.innerHTML=`P${p.id}<br>${p.online?(p.ready?'Sẵn sàng':'Đã kết nối'):'Chưa mở'}`;ui.slots.appendChild(d)});
  ui.waitingText.textContent=`${state?.readyCount||0}/4 thành viên đã sẵn sàng`;
}
function updateProgress(){
  const spans=ui.mapProgress.querySelectorAll('span');spans.forEach((s,i)=>s.classList.toggle('active',state?.stage===i+1));
}
function updateOverlay(){
  panel(ui.lobby,state.phase==='lobby');
  const intro=state.phase==='countdown'||state.phase==='transition';panel(ui.stageIntro,intro);
  if(intro){
    const st=state.phase==='transition'?state.transitionTo:state.stage;
    ui.stageEyebrow.textContent=`Tầng ${st}`;ui.stageName.textContent=MAP_NAMES[st];ui.stageDescription.textContent=STAGE_DESCRIPTIONS[st];
    ui.countdown.textContent=state.phase==='transition'?`Đang chuyển tới tầng ${st}`:Math.max(1,Math.ceil(state.countdown));
  }
  panel(ui.resetOverlay,state.phase==='resetting');if(state.phase==='resetting'){ui.resetReason.textContent=state.message||'Cả đội phải chơi lại.';ui.resetCount.textContent=Math.max(1,Math.ceil(state.countdown||state.map2?.caughtTimer||1))}
  panel(ui.winOverlay,state.phase==='done');if(state.phase==='done')ui.finalTime.textContent=fmt(state.totalElapsed);
}
function updateControls(){
  if(state?.stage===3&&PLAYER_ID===1)ui.controls.innerHTML='<b>WASD / Mũi tên</b> di chuyển con trỏ · <b>Enter</b> đánh dấu · <b>Q</b> cảnh báo · <b>E</b> xóa';
  else if(state?.stage===2)ui.controls.innerHTML='<b>WASD / Mũi tên</b> di chuyển · <b>Space</b> chuyền cầu';
  else ui.controls.innerHTML='<b>WASD / Mũi tên</b> di chuyển · <b>E</b> tương tác';
}

function interactMap1(){
  if(!state||state.stage!==1||state.phase!=='playing')return;
  const p=state.players[PLAYER_ID-1],m=state.map1;if(!p||!m)return;
  let best=null,bd=Infinity;
  for(const c of m.cats){const d=Math.hypot(p.x-c.x,p.y-c.y);if(d<bd){bd=d;best=c}}
  const ds=Math.hypot(p.x-900,p.y-640);
  if(ds<165){codeInput='';updateCode();ui.keyFeedback.textContent='';panel(ui.keypad,true);return}
  if(best&&bd<125){
    const key=best.feature?`cat_${best.feature}`:'cat_normal';ui.inspectImage.src=SRC[key]||SRC.cat_normal;ui.inspectTitle.textContent=`Tượng tại vị trí ${best.hour} giờ`;panel(ui.inspectPanel,true);
  }
}

function setupCtx(){ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='medium'}
function drawSheet(img,frame,fw,fh,x,y,w,h,flip=1,alpha=1){if(!img)return;const rx=Math.round(x),ry=Math.round(y),rw=Math.round(w),rh=Math.round(h);ctx.save();ctx.globalAlpha=alpha;ctx.translate(rx,ry);ctx.scale(flip,1);ctx.drawImage(img,frame*fw,0,fw,fh,-rw/2,-rh,rw,rh);ctx.restore()}
function drawTrimmed(name,frame,x,y,w,h,flip=1,alpha=1){const img=IMG[name],meta=SHEET_META[name];if(!img||!meta)return;drawSheet(img,frame,meta.w,meta.h,x,y,w,h,flip,alpha)}

function drawPlayer(p,screenX,screenY,scale=1,label=true){
  if(p.escaped)return;
  const i=p.id-1,m=PLAYER_META[i],moving=Math.hypot(p.vx,p.vy)>8,key=`p${p.id}_${moving?'walk':'idle'}`,img=IMG[key],fw=moving?m.walkW:m.idleW,frames=moving?m.walk:m.idle;
  const h=104*scale,w=h*(fw/200),frame=Math.floor((p.anim||0)*(moving?11:6))%frames;
  ctx.save();ctx.globalAlpha=1;ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(screenX,screenY,w*.26,w*.09,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(2,3*scale);ctx.beginPath();ctx.ellipse(screenX,screenY-3*scale,w*.33,w*.12,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  drawSheet(img,frame,fw,200,screenX,screenY,w,h,p.facing||1,1);
  if(label){ctx.font=`700 ${12*scale}px system-ui`;ctx.textAlign='center';ctx.fillStyle=p.color;ctx.strokeStyle='#000b';ctx.lineWidth=3;ctx.strokeText(`P${p.id}`,screenX,screenY-h-5);ctx.fillText(`P${p.id}`,screenX,screenY-h-5)}
}
function drawGolem(g,x,y,scale=1){const m=GOLEM_META[g.model],moving=g.state==='chase'||Math.hypot(g.homeX-g.x,g.homeY-g.y)>.1,key=`golem${g.model?g.model+1:''}_${moving?'walk':'idle'}`,img=IMG[key],frames=moving?m.walk:m.idle,h=108*scale,w=h*(m.w/200),frame=Math.floor((g.anim||0)*(moving?9:5))%frames;ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(x,y,w*.25,w*.09,0,0,Math.PI*2);ctx.fill();drawSheet(img,frame,m.w,200,x,y,w,h,g.facing||1);if(moving){ctx.fillStyle='#ff6257';ctx.font=`700 ${17*scale}px system-ui`;ctx.textAlign='center';ctx.fillText('!',x,y-h-4)}}
function drawTorch(x,y,size=70){const m=SHEET_META.torch,fr=Math.floor(animTime*10)%m.frames;drawTrimmed('torch',fr,x,y,size*1.18,size,1,1)}
function tileImage(img,x,y,w,h,alpha=1){if(!img)return;ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(img,Math.round(x),Math.round(y),Math.round(w),Math.round(h));ctx.restore()}
function sx(x){return Math.round(x-cam.x)}function sy(y){return Math.round(y-cam.y)}

function drawMap1(){
  const self=renderPlayers[PLAYER_ID-1],m=state.map1;if(!self||!m)return;
  const worldW=1800,worldH=1200;const tx=clamp(self.x-W*.5,0,Math.max(0,worldW-W)),ty=clamp(self.y-H*.54,0,Math.max(0,worldH-H));const ce=cameraEase(11);cam.x+=(tx-cam.x)*ce;cam.y+=(ty-cam.y)*ce;
  ctx.fillStyle='#9d763c';ctx.fillRect(0,0,W,H);const t=92;
  for(let x=-(cam.x%t)-t;x<W+t;x+=t)for(let y=-(cam.y%t)-t;y<H+t;y+=t)tileImage(IMG.floor,x,y,t,t,.92);
  // outer walls
  const wall=72;for(let x=-(cam.x%t)-t;x<W+t;x+=t){tileImage(IMG.wall,x,sy(0),t,wall);tileImage(IMG.wall,x,sy(worldH-wall),t,wall)}
  for(let y=-(cam.y%t)-t;y<H+t;y+=t){tileImage(IMG.wall,sx(0),y,wall,t);tileImage(IMG.wall,sx(worldW-wall),y,wall,t)}
  for(let wx=170;wx<worldW-100;wx+=280){drawTorch(sx(wx),sy(74),68);drawTorch(sx(wx),sy(worldH-20),68)}
  // clock ring
  ctx.save();ctx.translate(sx(900),sy(640));ctx.strokeStyle='rgba(246,200,84,.52)';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,0,590,360,0,0,Math.PI*2);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='rgba(255,235,160,.25)';ctx.beginPath();ctx.ellipse(0,0,520,300,0,0,Math.PI*2);ctx.stroke();for(let h=1;h<=12;h++){const a=(h%12)*Math.PI/6-Math.PI/2,x=Math.cos(a)*625,y=Math.sin(a)*385;ctx.fillStyle='#e7bd59';ctx.font='700 18px system-ui';ctx.textAlign='center';ctx.fillText(String(h),x,y+6)}ctx.restore();
  const entities=[];m.cats.forEach(c=>entities.push({y:c.y,type:'cat',v:c}));renderPlayers.forEach(p=>entities.push({y:p.y,type:'player',v:p}));entities.push({y:640,type:'sphinx'});entities.sort((a,b)=>a.y-b.y);
  for(const e of entities){
    if(e.type==='cat'){const c=e.v,key=c.feature?`cat_${c.feature}`:'cat_normal',im=IMG[key]||IMG.cat_normal;const h=155,w=h*(im?.width/im?.height||1);tileImage(im,sx(c.x)-w/2,sy(c.y)-h,w,h)}
    else if(e.type==='sphinx'){const im=m.solved?IMG.sphinx_open:IMG.sphinx_closed;const h=238,w=h*(im?.width/im?.height||1);tileImage(im,sx(900)-w/2,sy(690)-h,w,h)}
    else drawPlayer(e.v,sx(e.v.x),sy(e.v.y),1);
  }
  updateMap1Prompt(self,m);
}
function updateMap1Prompt(p,m){
  let best=null,bd=Infinity;for(const c of m.cats){const d=Math.hypot(p.x-c.x,p.y-c.y);if(d<bd){bd=d;best=c}}
  const ds=Math.hypot(p.x-900,p.y-640);if(ds<165)ui.interaction.innerHTML='<kbd>E</kbd> Nhập mật mã';else if(best&&bd<125)ui.interaction.innerHTML='<kbd>E</kbd> Xem kỹ tượng';else ui.interaction.textContent='';
}

function drawMap2(){
  const self=renderPlayers[PLAYER_ID-1],m=state.map2;if(!self||!m)return;const worldW=5520,top=120,bottom=790;const tx=clamp(self.x-W*.4,0,worldW-W);cam.x+=(tx-cam.x)*cameraEase(11);cam.y=0;
  ctx.fillStyle='#a47d42';ctx.fillRect(0,0,W,H);const t=92;for(let x=-(cam.x%t)-t;x<W+t;x+=t)for(let y=top-20;y<H;y+=t)tileImage(IMG.floor,x,y,t,t,.95);
  for(let x=-(cam.x%t)-t;x<W+t;x+=t){tileImage(IMG.wall,x,0,t,86);tileImage(IMG.wall,x,H-82,t,82)}
  for(let wx=Math.ceil((cam.x-100)/330)*330;wx<cam.x+W+100;wx+=330)drawTorch(wx-cam.x,92,66);
  m.muds.forEach(md=>{const x=md.x-cam.x;if(x<-100||x>W+100)return;const h=md.r*1.32,w=md.r*2.4;tileImage(IMG.mud,x-w/2,md.y-h*.65,w,h)});
  // cửa tầng 3
  const doorX=5260-cam.x,doorY=410;
  ctx.save();
  ctx.fillStyle='#000';
  // Chỉ phủ đúng lòng cửa, không tràn ra ngoài khung đá.
  ctx.fillRect(Math.round(doorX-43),Math.round(doorY-174),86,174);
  ctx.restore();
  const df=Math.round((m.doorProgress||0)*5);drawTrimmed('door2',df,doorX,doorY,215,245,1,1);
  const ents=[...renderMap2Golems.map(g=>({y:g.y,type:'g',v:g})),...renderPlayers.map(p=>({y:p.y,type:'p',v:p}))].sort((a,b)=>a.y-b.y);
  ents.forEach(e=>e.type==='g'?drawGolem(e.v,e.v.x-cam.x,e.v.y,1):drawPlayer(e.v,e.v.x-cam.x,e.v.y,1));
  if(IMG.ball&&renderBall){const b=renderBall,h=35,w=h*IMG.ball.width/IMG.ball.height;tileImage(IMG.ball,b.x-cam.x-w/2,b.y-h/2,w,h)}
  const holder=renderPlayers[(m.holder||0)];if(holder&&PLAYER_ID-1===m.holder&&!m.delivered){ctx.save();ctx.setLineDash([8,8]);ctx.strokeStyle='rgba(255,231,145,.42)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(holder.x-cam.x,holder.y,420,0,Math.PI*2);ctx.stroke();ctx.restore()}
  const progress=clamp((m.ball?.x||0)/worldW,0,1);ctx.fillStyle='#0008';ctx.fillRect(20,H-36,W-40,7);ctx.fillStyle='#efc34f';ctx.fillRect(20,H-36,(W-40)*progress,7);
  if(m.delivered)ui.interaction.innerHTML='<b>Cửa đã mở — cả đội đi qua</b>';else if(PLAYER_ID-1===m.holder)ui.interaction.innerHTML='<kbd>Space</kbd> Chuyền quả cầu';else ui.interaction.textContent='';
}

function drawMap3(){
  const m=state.map3;if(!m)return;if(PLAYER_ID===1)drawCommander(m);else drawExplorer(m,renderPlayers[PLAYER_ID-1]);
}
function drawMap3Tile(x,y,s,gx,gy,wall){if(wall){tileImage(IMG.wall,x,y,s,s,.82);ctx.fillStyle='#0005';ctx.fillRect(x,y+s*.72,s,s*.28)}else{tileImage(IMG.floor,x,y,s,s,.9);ctx.fillStyle=(gx+gy)%2?'#00000014':'#ffffff06';ctx.fillRect(x,y,s,s)}}
function drawLever(cell,on,x,y,s){const fr=on?3:0;drawTrimmed('lever',fr,x+s*.5,y+s*.98,s*.72,s*.8,1,1);ctx.fillStyle=on?'#8affac':'#ffd572';ctx.font=`700 ${s*.18}px system-ui`;ctx.textAlign='center';ctx.fillText(on?'ON':'E',x+s*.5,y+s*.18)}
function drawDoor3At(progress,x,y,s){const fr=Math.round(clamp(progress,0,1)*5);ctx.fillStyle='#000';ctx.fillRect(Math.round(x+s*.22),Math.round(y+s*.18),Math.round(s*.56),Math.round(s*.9));drawTrimmed('door3',fr,x+s*.5,y+s*.98,s*.92,s*1.05,1,1)}
function drawChest(progress,x,y,s){const fr=Math.round(clamp(progress||0,0,1)*3);drawTrimmed('chest',fr,x+s*.5,y+s*.95,s*.9,s*.76,1,1)}
function drawSpike(t,x,y,s,active){ctx.save();ctx.globalAlpha=active?1:.42;if(IMG.spike)ctx.drawImage(IMG.spike,Math.round(x+s*.08),Math.round(y+s*.2),Math.round(s*.84),Math.round(s*.58));ctx.restore()}
function drawMarker(mark,x,y,s){ctx.save();ctx.strokeStyle=mark.type==='danger'?'#ff5d55':'#ffe274';ctx.fillStyle=mark.type==='danger'?'#ff5d5533':'#ffe27433';ctx.lineWidth=Math.max(2,s*.05);ctx.beginPath();ctx.arc(x+s*.5,y+s*.5,s*.3,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font=`700 ${s*.28}px system-ui`;ctx.textAlign='center';ctx.fillText(mark.type==='danger'?'!':'◆',x+s*.5,y+s*.59);ctx.restore()}
function drawCommander(m){
  const pad=18,s=Math.min((W-pad*2)/39,(H-110)/25),ox=(W-39*s)/2,oy=88+(H-100-25*s)/2;
  ctx.fillStyle='#080604';ctx.fillRect(0,0,W,H);
  for(let y=0;y<25;y++)for(let x=0;x<39;x++)drawMap3Tile(ox+x*s,oy+y*s,s,x,y,m.maze[y][x]===1);
  m.traps.forEach(t=>drawSpike(t,ox+t.x*s,oy+t.y*s,s,((state.elapsed+t.phase)%2.37)<.75));
  m.markers.forEach(v=>drawMarker(v,ox+v.x*s,oy+v.y*s,s));
  m.leverCells.forEach((c,i)=>drawLever(c,m.leverOn[i],ox+c.x*s,oy+c.y*s,s));
  drawDoor3At(m.keyDoorProgress,ox+16*s,oy+12*s,s);
  if(!m.keyTaken&&IMG.key){const h=s*.65,w=h*IMG.key.width/IMG.key.height;tileImage(IMG.key,ox+(19.5)*s-w/2,oy+(12.5)*s-h/2,w,h)}
  drawChest(m.chestProgress,ox+37*s,oy+23*s,s);
  renderMap3Golems.forEach(g=>drawGolem(g,ox+g.x*s,oy+g.y*s,s/82));
  renderPlayers.forEach(p=>drawPlayer(p,ox+p.x*s,oy+p.y*s,s/82,true));
  const c=m.cursor;ctx.save();ctx.strokeStyle='#fff4a3';ctx.lineWidth=Math.max(2,s*.07);ctx.setLineDash([s*.2,s*.12]);ctx.strokeRect(ox+c.x*s+s*.08,oy+c.y*s+s*.08,s*.84,s*.84);ctx.restore();
  ui.interaction.innerHTML='<kbd>Enter</kbd> Đánh dấu · <kbd>Q</kbd> Cảnh báo · <kbd>E</kbd> Xóa';
}
function drawExplorer(m,self){
  const tile=84,worldW=39*tile,worldH=25*tile,tx=clamp(self.x*tile-W/2,0,Math.max(0,worldW-W)),ty=clamp(self.y*tile-H/2,0,Math.max(0,worldH-H));const ce=cameraEase(13);cam.x+=(tx-cam.x)*ce;cam.y+=(ty-cam.y)*ce;ctx.fillStyle='#060403';ctx.fillRect(0,0,W,H);
  const minX=clamp(Math.floor(cam.x/tile)-1,0,38),maxX=clamp(Math.ceil((cam.x+W)/tile)+1,0,38),minY=clamp(Math.floor(cam.y/tile)-1,0,24),maxY=clamp(Math.ceil((cam.y+H)/tile)+1,0,24);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)drawMap3Tile(x*tile-cam.x,y*tile-cam.y,tile,x,y,m.maze[y][x]===1);
  m.traps.forEach(t=>drawSpike(t,t.x*tile-cam.x,t.y*tile-cam.y,tile,((state.elapsed+t.phase)%2.37)<.75));
  m.markers.forEach(v=>drawMarker(v,v.x*tile-cam.x,v.y*tile-cam.y,tile));
  m.leverCells.forEach((c,i)=>drawLever(c,m.leverOn[i],c.x*tile-cam.x,c.y*tile-cam.y,tile));
  drawDoor3At(m.keyDoorProgress,16*tile-cam.x,12*tile-cam.y,tile);
  if(!m.keyTaken&&IMG.key){const h=tile*.7,w=h*IMG.key.width/IMG.key.height;tileImage(IMG.key,19.5*tile-cam.x-w/2,12.5*tile-cam.y-h/2,w,h)}
  drawChest(m.chestProgress,37*tile-cam.x,23*tile-cam.y,tile);
  const ents=[...renderMap3Golems.map(g=>({y:g.y,type:'g',v:g})),...renderPlayers.slice(1).map(p=>({y:p.y,type:'p',v:p}))].sort((a,b)=>a.y-b.y);ents.forEach(e=>e.type==='g'?drawGolem(e.v,e.v.x*tile-cam.x,e.v.y*tile-cam.y,1):drawPlayer(e.v,e.v.x*tile-cam.x,e.v.y*tile-cam.y,1));
  // vùng nhìn hẹp: phủ gradient tối, giữ nguyên hình ảnh ở tâm.
  if(!state.cheat){const px=self.x*tile-cam.x,py=self.y*tile-cam.y,r=4.45*tile;ctx.save();const g=ctx.createRadialGradient(px,py,r*.32,px,py,r);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.62,'rgba(0,0,0,.12)');g.addColorStop(.84,'rgba(0,0,0,.72)');g.addColorStop(1,'rgba(0,0,0,.97)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore()}
  let prompt='';m.leverCells.forEach((c,i)=>{if(Math.hypot(self.x-(c.x+.5),self.y-(c.y+.5))<1.1)prompt=`<kbd>E</kbd> ${m.leverOn[i]?'Trả':'Gạt'} cần ${i?'B':'A'}`});if(m.keyTaken&&!m.chestOpen&&Math.hypot(self.x-37.5,self.y-23.5)<1.8)prompt='<kbd>E</kbd> Mở rương kho báu';ui.interaction.innerHTML=prompt;
}

function render(now){
  const dt=Math.min(.05,(now-lastRender)/1000);lastRender=now;frameDt=dt;animTime+=dt;updateVisuals(dt);setupCtx();
  if(!state){ctx.fillStyle='#100b06';ctx.fillRect(0,0,W,H);ctx.fillStyle='#f0c45a';ctx.font='700 20px system-ui';ctx.textAlign='center';ctx.fillText('Đang kết nối máy chủ...',W/2,H/2)}
  else if(state.stage===1)drawMap1();else if(state.stage===2)drawMap2();else if(state.stage===3)drawMap3();else{ctx.fillStyle='#100b06';ctx.fillRect(0,0,W,H)}
  requestAnimationFrame(render);
}
function showServerSetup(message=''){
  ui.serverUrlInput.value=API_BASE||'';
  ui.serverStatus.textContent=message;
  ui.serverStatus.className='server-status';
  panel(ui.serverSetup,true);
}
async function connectToServer(useSameOrigin=false){
  const candidate=useSameOrigin?'':normalizeApiBase(ui.serverUrlInput.value);
  if(!useSameOrigin&&!candidate){ui.serverStatus.textContent='Địa chỉ server không hợp lệ.';ui.serverStatus.className='server-status bad';return}
  ui.connectServerBtn.disabled=true;ui.serverStatus.textContent='Đang kiểm tra server...';ui.serverStatus.className='server-status';
  const previous=API_BASE;API_BASE=candidate;
  const health=await fetchJson(apiUrl('/health'),{timeout:6000});
  if(health.ok){
    try{if(API_BASE)localStorage.setItem(API_STORAGE_KEY,API_BASE);else localStorage.removeItem(API_STORAGE_KEY)}catch{}
    ui.serverStatus.textContent='Kết nối thành công.';ui.serverStatus.className='server-status good';
    panel(ui.serverSetup,false);pollFailures=0;lastRevision=-1;connectionStarted=true;scheduleStatePoll(20);
  }else{
    API_BASE=previous;ui.serverStatus.textContent=`Không kết nối được: ${health.error||health.message||'server không phản hồi'}`;ui.serverStatus.className='server-status bad';
  }
  ui.connectServerBtn.disabled=false;
}
ui.connectServerBtn.addEventListener('click',()=>connectToServer(false));
ui.useSameOriginBtn.addEventListener('click',()=>connectToServer(true));
ui.serverUrlInput.addEventListener('keydown',e=>{if(e.key==='Enter')connectToServer(false)});
ui.connectionChip.addEventListener('click',()=>showServerSetup(API_BASE?'Có thể dán URL tunnel mới rồi kết nối lại.':'Nhập URL server để bắt đầu.'));
function initConnection(){
  if(API_BASE||SAME_ORIGIN_SERVER){connectionStarted=true;scheduleStatePoll(20)}
  else showServerSetup('Trang đang chạy trên GitHub Pages nên cần URL HTTPS của server trên máy m.');
}
preload().then(()=>{requestAnimationFrame(render);initConnection()});
