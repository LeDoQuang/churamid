'use strict';
const GAMEDAY_VERSION='V13.16';

const hashParams=new URLSearchParams(location.hash.slice(1));
if(hashParams.get('session')){
  sessionStorage.setItem('gameday-session',hashParams.get('session'));
  try{const raw=decodeURIComponent(escape(atob(hashParams.get('profile')||'')));if(raw)sessionStorage.setItem('gameday-profile',raw)}catch{}
  history.replaceState(null,'',location.pathname+location.search);
}
const SESSION_TOKEN=sessionStorage.getItem('gameday-session')||'';
let PROFILE={};try{PROFILE=JSON.parse(sessionStorage.getItem('gameday-profile')||'{}')}catch{}
if(!SESSION_TOKEN){location.replace('./');throw new Error('No session')}
const IS_OBSERVER=PROFILE.role==='observer'||PROFILE.role==='admin-observer';
let PLAYER_ID=Math.max(1,Math.min(4,Number(PROFILE.playerId||1)));
const API_BASE=window.GAMEDAY_API_BASE||'';
function apiUrl(path){return API_BASE?`${API_BASE}${path}`:path}
const CLIENT_ID=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9._:-]/g,'');
const COLORS = ['#55d68b','#54a8ff','#b878ff','#ff9f55'];
const NAMES = ['Ranger','Orc','Dark Oracle','Fallen Angel'];
const DISPLAY_NAMES=Array.from({length:4},(_,i)=>PROFILE.players?.[i]||`Người chơi ${i+1}`);
const MAP_NAMES = ['Phòng chờ','Tượng mã bí ẩn','Chạy thoát khỏi xác ướp','Hoàng đế trở về'];
const MAP_OBJECTIVES = [
  'Chờ ban tổ chức mở sự kiện',
  'Tìm bốn tượng thần mèo khác biệt và giải mật mã',
  'Chuyền quả cầu vàng, né xác ướp và đưa cầu tới cuối con đường',
  'Phối hợp gạt cần, lấy chìa khóa và mở rương báu',
];
const RULES = {
  1:{title:'MAP 1',lines:[
    'Mật mã gồm 4 chữ số tượng trưng cho vị trí của 4 tượng thần mèo khác biệt so với những tượng còn lại.',
    '“Mèo luôn nhìn thời gian thuận theo chiều kim đồng hồ”.',
    'Hãy chú ý vào màu sắc và những chi tiết nổi bật.'
  ]},
  2:{title:'MAP 2',lines:[
    'Quả cầu vàng luôn bị các xác ướp canh giữ nghiêm ngặt, chúng sẽ bám theo kẻ cầm nó.',
    'Kẻ cầm quả cầu vàng sẽ di chuyển chậm hơn những người còn lại, vì thế cả đội hãy chuyền cầu liên tục để né tránh xác ướp.',
    'Trên đường đi có nhiều bẫy, cả đội hãy né tránh và chạy thẳng đến cuối con đường - nơi có tượng sư tử và đặt quả cầu vào đó.'
  ]},
  3:{title:'MAP 3',lines:[
    '“Sự liên kết là sức mạnh” - chỉ 1 người chơi nhìn thấy toàn bộ bản đồ và vị trí chính xác của các cạm bẫy, cần gạt và nơi cất giữ chìa khóa. Người ấy có khả năng dẫn lối và đánh dấu đường đi cho những người chơi còn lại.',
    'Những người chơi còn lại di chuyển theo hướng dẫn của người chỉ huy, gạt thành công các cần gạt để mở cửa lối vào khu vực chứa chìa khóa.',
    'Công dụng của chìa khóa là mở khóa rương báu, hãy chú ý vào những phía góc bàn đổ.',
    '“Các xác ướp luôn theo sát mọi động tĩnh của bạn, đừng để chúng phát hiện”.'
  ]}
};
function ruleHtml(stage=0,showHeading=true){
  const stages=stage&&RULES[stage]?[stage]:[1,2,3];
  return stages.map(n=>`<section class="rule-block ${n===stage?'active':''}">${showHeading?`<h3>${RULES[n].title}</h3>`:''}${RULES[n].lines.map(line=>`<p>${line}</p>`).join('')}</section>`).join('');
}
const ROMAN=['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
function roman(n){return ROMAN[Number(n)]||String(n||'')}

const ui = {
  canvas: document.getElementById('game'),
  mapTitle: document.getElementById('mapTitle'), objective: document.getElementById('objective'), teamNameText:document.getElementById('teamNameText'), playerNameText:document.getElementById('playerNameText'), logoutBtn:document.getElementById('logoutBtn'), lobbyTeamName:document.getElementById('lobbyTeamName'),
  roleDot: document.getElementById('roleDot'), roleText: document.getElementById('roleText'), onlineText: document.getElementById('onlineText'), timeText: document.getElementById('timeText'), cheatChip: document.getElementById('cheatChip'), connectionChip:document.getElementById('connectionChip'), connectionText:document.getElementById('connectionText'),
  mapProgress: document.getElementById('mapProgress'), interaction: document.getElementById('interaction'), toast: document.getElementById('toast'), controls: document.getElementById('controls'),
  lobby: document.getElementById('lobby'), roleAvatar: document.getElementById('roleAvatar'), lobbyRole: document.getElementById('lobbyRole'), roleDesc: document.getElementById('roleDesc'), slots: document.getElementById('slots'), readyBtn: document.getElementById('readyBtn'), fullscreenBtn:document.getElementById('fullscreenBtn'), waitingText: document.getElementById('waitingText'),
  stageIntro: document.getElementById('stageIntro'), stageEyebrow: document.getElementById('stageEyebrow'), stageName: document.getElementById('stageName'), stageDescription: document.getElementById('stageDescription'), countdown: document.getElementById('countdown'),
  resetOverlay: document.getElementById('resetOverlay'), resetReason: document.getElementById('resetReason'), resetCount: document.getElementById('resetCount'),
  inspectPanel: document.getElementById('inspectPanel'), inspectImage: document.getElementById('inspectImage'), inspectTitle: document.getElementById('inspectTitle'),
  keypad: document.getElementById('keypad'), codeDisplay: document.getElementById('codeDisplay'), keyGrid: document.getElementById('keyGrid'), keyFeedback: document.getElementById('keyFeedback'), clearCode: document.getElementById('clearCode'), submitCode: document.getElementById('submitCode'),
  winOverlay: document.getElementById('winOverlay'), finalTime: document.getElementById('finalTime'), restartBtn: document.getElementById('restartBtn'),
  mobileControls:document.getElementById('mobileControls'),joystick:document.getElementById('joystick'),joystickKnob:document.getElementById('joystickKnob'),mobileMain:document.getElementById('mobileMain'),mobileAlt:document.getElementById('mobileAlt'),mobileThird:document.getElementById('mobileThird'),
  serverSetup:document.getElementById('serverSetup'),serverUrlInput:document.getElementById('serverUrlInput'),connectServerBtn:document.getElementById('connectServerBtn'),useSameOriginBtn:document.getElementById('useSameOriginBtn'),serverStatus:document.getElementById('serverStatus'),
  installGuide:document.getElementById('installGuide'),closeInstallGuide:document.getElementById('closeInstallGuide'),rulesBtn:document.getElementById('rulesBtn'),rulesModal:document.getElementById('rulesModal'),rulesTitle:document.getElementById('rulesTitle'),rulesContent:document.getElementById('rulesContent'),closeRulesBtn:document.getElementById('closeRulesBtn'), observerBar:document.getElementById('observerBar'),observerView:document.getElementById('observerView'),eventOverlay:document.getElementById('eventOverlay'),eventOverlayEyebrow:document.getElementById('eventOverlayEyebrow'),eventOverlayTitle:document.getElementById('eventOverlayTitle'),eventOverlayText:document.getElementById('eventOverlayText'),
};
const ctx = ui.canvas.getContext('2d',{alpha:false,desynchronized:true})||ui.canvas.getContext('2d');
let W=1280,H=720,DPR=1,CSS_W=1280,CSS_H=720,VIEW_SCALE=1,state=null,lastStatePhase='',lastStage=0,ready=false,codeInput=[],cam={x:0,y:0},toastTimer=0;
let lastRender=performance.now(),lastPaint=0,animTime=0,frameDt=0;
let renderPlayers=[],renderMap2Golems=[],renderMap3Golems=[],renderBall=null;
const smoothCache=new Map();
const keys = new Set();
const pendingActions = [];
let cheatBuffer='';
let movementNeutralLock=true;
let touchMove={up:false,down:false,left:false,right:false};
let inputSeq=0,actionSeq=0,lastInputSignature='',lastInputAt=0,inputInFlight=false,inputQueued=false;
let pollFailures=0,pollTimer=0,stateRequestId=0,lastRevision=-1,lastInstanceId='',lastStageRevision=-1,connectionStarted=false,gameSocket=null,socketRetryTimer=0,socketFailures=0,usingPollFallback=false,lastSocketMessageAt=0;
let viewportLock=null,viewportResizeTimer=0,lastOrientation=innerWidth>=innerHeight?'landscape':'portrait';
let selfVisual=null,lastStateReceivedAt=performance.now(),lastUiSignature='',lastInteractionHtml='';
let commanderBg=null,commanderBgKey='',map1Bg=null;

const SRC = {
  floor:'assets/floor.webp',wall:'assets/wall.webp',glyph:'assets/wall_glyph.webp',torch:'assets/torch.webp',
  cat_normal:'assets/cat_normal.webp',cat_red_nose:'assets/cat_red_nose.webp',cat_square:'assets/cat_square.webp',cat_yellow_eyes:'assets/cat_yellow_eyes.webp',cat_swapped_collar:'assets/cat_swapped_collar.webp',
  sphinx_closed:'assets/sphinx_closed.webp',sphinx_open:'assets/sphinx_open.webp',key:'assets/key.webp',
  ball:'assets/ball.webp',mud:'assets/mud.webp',door2:'assets/door2.webp',door3:'assets/door3.webp',lever:'assets/lever.webp',chest:'assets/chest.webp',
  p1_idle:'assets/p1_idle.webp',p1_walk:'assets/p1_walk.webp',p2_idle:'assets/p2_idle.webp',p2_walk:'assets/p2_walk.webp',p3_idle:'assets/p3_idle.webp',p3_walk:'assets/p3_walk.webp',p4_idle:'assets/p4_idle.webp',p4_walk:'assets/p4_walk.webp',
  golem_idle:'assets/golem_idle.webp',golem_walk:'assets/golem_walk.webp',golem2_idle:'assets/golem2_idle.webp',golem2_walk:'assets/golem2_walk.webp',golem3_idle:'assets/golem3_idle.webp',golem3_walk:'assets/golem3_walk.webp',
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

function localMoveDirection(){
  const x=((keys.has('KeyD')||keys.has('ArrowRight')||touchMove.right)?1:0)-((keys.has('KeyA')||keys.has('ArrowLeft')||touchMove.left)?1:0);
  const y=((keys.has('KeyS')||keys.has('ArrowDown')||touchMove.down)?1:0)-((keys.has('KeyW')||keys.has('ArrowUp')||touchMove.up)?1:0);
  const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d,moving:!!(x||y)};
}
function smoothPoint(key,x,y,dt,threshold,rate=22){
  let v=smoothCache.get(key);
  if(!v||Math.hypot(x-v.x,y-v.y)>threshold){v={x,y};smoothCache.set(key,v);return{x,y}}
  const k=1-Math.exp(-dt*rate);v.x+=(x-v.x)*k;v.y+=(y-v.y)*k;return{x:v.x,y:v.y};
}
function localEllipseHit(px,py,cx,cy,rx,ry){const dx=(px-cx)/rx,dy=(py-cy)/ry;return dx*dx+dy*dy<1}
function localMap1Blocked(x,y,m){
  const prX=23,prY=16;
  if(x<72+prX||x>1800-72-prX||y<72+prY||y>1200-72-prY)return true;
  if(localEllipseHit(x,y,900,690,76+prX,31+prY))return true;
  for(const c of m?.cats||[])if(localEllipseHit(x,y,c.x,c.y-5,34+prX,18+prY))return true;
  return false;
}
function localMap2Blocked(x,y,m){
  const doorX=5260,doorY=410;
  if(x<40||x>doorX+12||y<120||y>790)return true;
  if(x>doorX-72){
    const inside=Math.abs(y-doorY)<86;
    if(!inside)return true;
    if(!m?.delivered&&x>doorX-42)return true;
  }
  return false;
}
function localMap3Blocked(x,y,m){
  const r=.24,maze=m?.maze;if(!maze)return false;
  for(const [px,py] of [[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]]){
    const cx=Math.floor(px),cy=Math.floor(py);
    if(cy<0||cy>=maze.length||cx<0||cx>=maze[0].length||maze[cy][cx]!==0)return true;
    if(!m.keyDoorOpen&&cx===16&&cy===12)return true;
  }
  return false;
}
function localBlocked(stage,x,y){
  if(state?.cheat)return false;
  if(stage===1)return localMap1Blocked(x,y,state.map1);
  if(stage===2)return localMap2Blocked(x,y,state.map2);
  if(stage===3)return localMap3Blocked(x,y,state.map3);
  return false;
}
function localMoveSpeed(p){
  let speed=state.stage===3?3.9:state.stage===2?250:245;
  if(state.stage===2){
    const m=state.map2;
    if(m?.holder===PLAYER_ID-1&&!m.ballPass&&!m.delivered)speed*=.76;
    if((m?.muds||[]).some(md=>Math.hypot(selfVisual.x-md.x,selfVisual.y-md.y)<md.r))speed*=.48;
  }
  if(state.stage===3&&(state.map3?.muds||[]).some(md=>Math.hypot(selfVisual.x-md.x,selfVisual.y-md.y)<md.r))speed*=.52;
  return speed*(state.cheat?2.15:1);
}
function predictSelf(p,dt,d){
  if(!selfVisual||selfVisual.stage!==state.stage||p.escaped){
    selfVisual={stage:state.stage,x:p.x,y:p.y,vx:0,vy:0,blockedX:false,blockedY:false};
  }
  if(state.stage===3&&PLAYER_ID===1){
    selfVisual.x=p.x;selfVisual.y=p.y;selfVisual.vx=0;selfVisual.vy=0;return;
  }
  const canPredict=state.phase==='playing'&&!p.escaped;
  const speed=localMoveSpeed(p);
  selfVisual.vx=canPredict?d.x*speed:0;
  selfVisual.vy=canPredict?d.y*speed:0;
  if(!canPredict||!d.moving){selfVisual.vx=0;selfVisual.vy=0;return;}

  const totalX=selfVisual.vx*dt,totalY=selfVisual.vy*dt;
  const maxStep=state.stage===3?.075:7;
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(totalX),Math.abs(totalY))/maxStep));
  selfVisual.blockedX=false;selfVisual.blockedY=false;
  for(let i=0;i<steps;i++){
    const nx=selfVisual.x+totalX/steps;
    if(!localBlocked(state.stage,nx,selfVisual.y))selfVisual.x=nx;else{selfVisual.vx=0;selfVisual.blockedX=true;}
    const ny=selfVisual.y+totalY/steps;
    if(!localBlocked(state.stage,selfVisual.x,ny))selfVisual.y=ny;else{selfVisual.vy=0;selfVisual.blockedY=true;}
  }
  if(state.stage===1){selfVisual.x=clamp(selfVisual.x,10,1790);selfVisual.y=clamp(selfVisual.y,10,1190)}
  else if(state.stage===2){selfVisual.x=clamp(selfVisual.x,40,state.map2?.delivered?5270:5218);selfVisual.y=clamp(selfVisual.y,120,790)}
  else if(state.stage===3){selfVisual.x=clamp(selfVisual.x,.5,38.5);selfVisual.y=clamp(selfVisual.y,.5,24.5)}
}

function updateVisuals(dt){
  if(!state){renderPlayers=[];renderMap2Golems=[];renderMap3Golems=[];renderBall=null;selfVisual=null;return}
  const unitThreshold=state.stage===3?3.2:360;
  const receiveAge=Math.min(.12,(performance.now()-lastStateReceivedAt)/1000);
  renderPlayers=(state.players||[]).map(p=>{
    const isSelf=!IS_OBSERVER&&p.id===PLAYER_ID;
    if(!isSelf){
      const tx=p.x+(p.vx||0)*Math.min(.07,receiveAge),ty=p.y+(p.vy||0)*Math.min(.07,receiveAge);
      return{...p,...smoothPoint(`s${state.stage}-p${p.id}`,tx,ty,dt,unitThreshold,IS_OBSERVER?14:22)};
    }
    const d=localMoveDirection();
    predictSelf(p,dt,d);
    const serverX=p.x,serverY=p.y;
    const dx=serverX-selfVisual.x,dy=serverY-selfVisual.y,error=Math.hypot(dx,dy);
    const stage3=state.stage===3,hardSnap=stage3?5.5:420;
    const teleported=error>hardSnap||((state.phase==='resetting'||state.phase==='briefing')&&error>(stage3 ? 0.8 : 80));
    if(teleported){
      selfVisual.x=serverX;selfVisual.y=serverY;selfVisual.vx=p.vx||0;selfVisual.vy=p.vy||0;
    }else{
      const moving=d.moving&&state.phase==='playing'&&!movementNeutralLock;
      // Hiệu chỉnh dần và giới hạn số pixel mỗi frame để gói mạng đến trễ
      // không kéo nhân vật giật đùng một lần. Khi chạm tường vẫn bám server nhanh hơn.
      const rateX=selfVisual.blockedX?12:(moving?2.8:14);
      const rateY=selfVisual.blockedY?12:(moving?2.8:14);
      const alphaX=1-Math.exp(-dt*rateX),alphaY=1-Math.exp(-dt*rateY);
      const maxCorrection=stage3 ? 0.055 : 5.5,epsilon=stage3 ? 0.004 : 0.2;
      if(Math.abs(dx)>epsilon)selfVisual.x+=clamp(dx*alphaX,-maxCorrection,maxCorrection);
      if(Math.abs(dy)>epsilon)selfVisual.y+=clamp(dy*alphaY,-maxCorrection,maxCorrection);
      if(!moving){selfVisual.vx=0;selfVisual.vy=0;}
    }
    return{...p,x:selfVisual.x,y:selfVisual.y,vx:selfVisual.vx,vy:selfVisual.vy};
  });
  renderMap2Golems=(state.map2?.golems||[]).map((g,i)=>({...g,...smoothPoint(`s2-g${i}`,g.x,g.y,dt,360,IS_OBSERVER?14:22)}));
  renderMap3Golems=(state.map3?.golems||[]).map((g,i)=>({...g,...smoothPoint(`s3-g${i}`,g.x,g.y,dt,3.2,IS_OBSERVER?14:22)}));
  renderBall=state.map2?.ball?{...state.map2.ball,...smoothPoint('s2-ball',state.map2.ball.x,state.map2.ball.y,dt,420,IS_OBSERVER?14:22)}:null;
}
function cameraEase(rate=12){return 1-Math.exp(-frameDt*rate)}

function isMobileView(){return matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0||innerWidth<=900}
function viewportSize(){
  const vv=globalThis.visualViewport;
  return{width:Math.max(1,Math.round(vv?.width||innerWidth||document.documentElement.clientWidth)),height:Math.max(1,Math.round(vv?.height||innerHeight||document.documentElement.clientHeight))};
}
function resize(force=false){
  const mobile=isMobileView(),raw=viewportSize(),orientation=raw.width>=raw.height?'landscape':'portrait';
  if(!viewportLock||force||orientation!==lastOrientation||!mobile){viewportLock={...raw};lastOrientation=orientation}
  else if(!state||state.phase==='lobby')viewportLock={...raw};
  else{
    const dw=Math.abs(raw.width-viewportLock.width)/Math.max(1,viewportLock.width),dh=Math.abs(raw.height-viewportLock.height)/Math.max(1,viewportLock.height);
    if(dw>.14||dh>.18)viewportLock={...raw};
  }
  CSS_W=viewportLock.width;CSS_H=viewportLock.height;
  document.documentElement.style.setProperty('--app-w',`${CSS_W}px`);document.documentElement.style.setProperty('--app-h',`${CSS_H}px`);
  ui.app?.style?.setProperty?.('width',`${CSS_W}px`);
  ui.canvas.style.width=`${CSS_W}px`;ui.canvas.style.height=`${CSS_H}px`;
  DPR=Math.min(mobile?2:1.75,window.devicePixelRatio||1);
  if(mobile&&CSS_W>CSS_H){H=720;W=H*(CSS_W/CSS_H);VIEW_SCALE=CSS_H/H}
  else{W=CSS_W;H=CSS_H;VIEW_SCALE=1}
  ui.canvas.width=Math.max(1,Math.round(CSS_W*DPR));ui.canvas.height=Math.max(1,Math.round(CSS_H*DPR));
}
function scheduleResize(force=false){clearTimeout(viewportResizeTimer);viewportResizeTimer=setTimeout(()=>resize(force),force?0:180)}
addEventListener('resize',()=>scheduleResize(false),{passive:true});
addEventListener('orientationchange',()=>scheduleResize(true),{passive:true});
globalThis.visualViewport?.addEventListener('resize',()=>scheduleResize(false),{passive:true});
resize(true);

function preload(){return Promise.all(Object.entries(SRC).map(([k,src])=>new Promise(res=>{const im=new Image();im.decoding='async';im.onload=()=>{IMG[k]=im;res()};im.onerror=()=>{IMG[k]=null;res()};im.src=src})))}

function fmt(s){s=Math.max(0,Math.floor(s||0));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function showToast(text,kind=''){clearTimeout(toastTimer);ui.toast.textContent=text;ui.toast.className=`toast show ${kind}`;toastTimer=setTimeout(()=>ui.toast.className='toast',1800)}
function panel(el,on){if(!el)return;el.classList.toggle('show',on);el.setAttribute?.('aria-hidden',String(!on))}
function bindPress(el,handler){
  if(!el)return;
  let lastPointerAt=-Infinity;
  el.addEventListener('pointerdown',e=>{
    if(e.isPrimary===false)return;
    if(typeof e.button==='number'&&e.button!==0)return;
    lastPointerAt=performance.now();
    e.preventDefault();
    e.stopPropagation();
    handler(e);
  },{passive:false});
  el.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    if(performance.now()-lastPointerAt>700)handler(e);
  },{passive:false});
}
function setInteraction(html=''){if(html===lastInteractionHtml)return;lastInteractionHtml=html;ui.interaction.innerHTML=html}
document.querySelectorAll('[data-close]').forEach(b=>bindPress(b,()=>panel(document.getElementById(b.dataset.close),false)));
['gesturestart','gesturechange','gestureend'].forEach(name=>document.addEventListener(name,e=>e.preventDefault(),{passive:false}));
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{
  if(e.target.closest?.('#app')&&!e.target.closest?.('.card,.install-card,.inspect-panel,.keypad-card,.rules-card'))e.preventDefault();
},{passive:false});

function updateRoleUI(){
  if(ui.roleDot)ui.roleDot.style.background=COLORS[PLAYER_ID-1];
  if(ui.roleText)ui.roleText.textContent='';
  ui.roleAvatar.src=`assets/avatar_p${PLAYER_ID}.webp`;
  ui.lobbyRole.textContent=IS_OBSERVER?'Người quan sát':(PROFILE.playerName||DISPLAY_NAMES[PLAYER_ID-1]);
  ui.roleDesc.textContent=IS_OBSERVER?'Chế độ chỉ xem — không điều khiển nhân vật':`${NAMES[PLAYER_ID-1]} · ${PLAYER_ID===1?'Chỉ huy ở tầng 3':'Thành viên thám hiểm'}`;
  if(ui.teamNameText)ui.teamNameText.textContent=PROFILE.teamName||'IDEA GAMEDAY 2026';
  if(ui.playerNameText)ui.playerNameText.textContent=IS_OBSERVER?'Quan sát':(PROFILE.playerName||DISPLAY_NAMES[PLAYER_ID-1]);
  if(ui.lobbyTeamName)ui.lobbyTeamName.textContent=PROFILE.teamName||'Phòng của đội';
}
updateRoleUI();
if(!IS_OBSERVER&&ui.observerBar)ui.observerBar.hidden=true;

function buildKeypad(){
  ui.keyGrid.innerHTML='';
  for(let n=1;n<=12;n++){
    const b=document.createElement('button');b.type='button';b.textContent=roman(n);b.dataset.value=String(n);
    b.addEventListener('click',()=>appendChoice(n));ui.keyGrid.appendChild(b);
  }
}
function updateCode(){ui.codeDisplay.textContent=[0,1,2,3].map(i=>codeInput[i]?roman(codeInput[i]):'—').join('  ')}
function appendChoice(n){if(codeInput.length<4&&!codeInput.includes(n)){codeInput.push(n);updateCode()}}
function clearCode(){codeInput=[];updateCode();ui.keyFeedback.textContent='';ui.keyFeedback.className='key-feedback'}
async function submitCode(){
  if(codeInput.length!==4){ui.keyFeedback.textContent='Cần chọn đủ bốn số La Mã.';ui.keyFeedback.className='key-feedback bad';return}
  const r=await post('/api/code',{player:PLAYER_ID,code:[...codeInput]});
  if(r.ok){ui.keyFeedback.textContent='Mật mã chính xác!';ui.keyFeedback.className='key-feedback good';setTimeout(()=>panel(ui.keypad,false),350)}
  else{ui.keyFeedback.textContent='Sai mật mã.';ui.keyFeedback.className='key-feedback bad';codeInput=[];updateCode()}
}
buildKeypad();ui.clearCode.addEventListener('click',clearCode);ui.submitCode.addEventListener('click',submitCode);

async function fetchJson(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),options.timeout||2500);
  try{
    const headers={...(options.headers||{}),'X-Session-Token':SESSION_TOKEN};
    const response=await fetch(url,{...options,headers,signal:controller.signal,cache:'no-store'});
    const data=await response.json().catch(()=>({ok:false,error:`HTTP ${response.status}`}));
    if(response.status===401){sessionStorage.removeItem('gameday-session');sessionStorage.removeItem('gameday-profile');setTimeout(()=>location.replace('./'),50)}
    return{...data,httpStatus:response.status};
  }catch(error){return{ok:false,error:error.name==='AbortError'?'Hết thời gian chờ':error.message,httpStatus:0}}
  finally{clearTimeout(timer)}
}
async function post(url,data){return fetchJson(apiUrl(url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})}
ui.readyBtn.addEventListener('click',async()=>{
  if(IS_OBSERVER||!state||state.phase!=='lobby')return;
  ui.readyBtn.disabled=true;ui.readyBtn.textContent='Đang gửi...';
  const r=await post('/api/ready',{player:PLAYER_ID,ready:true,clientId:CLIENT_ID});
  if(r.ok){ready=true;ui.readyBtn.textContent=r.started?'Đang bắt đầu...':'Đã bấm bắt đầu'}
  else{ui.readyBtn.disabled=false;ui.readyBtn.textContent='Bắt đầu';showToast(r.message||'Không thể xác nhận bắt đầu.','bad')}
});
function isStandalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
async function enterFullscreen(){
  if(isStandalone()){showToast('Game đang chạy ở chế độ ứng dụng.','good');return}
  const el=document.documentElement,fn=el.requestFullscreen||el.webkitRequestFullscreen;
  if(!fn){panel(ui.installGuide,true);return}
  try{
    await fn.call(el);
    try{await screen.orientation?.lock?.('landscape')}catch{}
    scheduleResize(true);
  }catch{panel(ui.installGuide,true)}
}
if(ui.fullscreenBtn){ui.fullscreenBtn.textContent=isStandalone()?'Đang toàn màn hình':((document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen)?'Toàn màn hình':'Ẩn thanh Safari');ui.fullscreenBtn.addEventListener('click',enterFullscreen)}
ui.closeInstallGuide?.addEventListener('click',()=>panel(ui.installGuide,false));
function openRules(){
  if(!ui.rulesModal||!ui.rulesTitle||!ui.rulesContent)return;
  const st=state?.stage||0;
  ui.rulesTitle.textContent=st?(MAP_NAMES[st]||'Luật chơi'):'Luật chơi';
  ui.rulesContent.innerHTML=ruleHtml(st,false);
  const card=ui.rulesModal.querySelector('.rules-card');
  if(card)card.scrollTop=0;
  panel(ui.rulesModal,true);
}
bindPress(ui.rulesBtn,openRules);
bindPress(ui.closeRulesBtn,()=>panel(ui.rulesModal,false));
function normalizeServerUrl(value){
  const v=String(value||'').trim().replace(/\/+$/,'');
  if(!/^https?:\/\//i.test(v))return'';
  try{const u=new URL(v);return`${u.protocol}//${u.host}`}catch{return''}
}
async function testServerUrl(base){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  try{const r=await fetch(`${base}/health?t=${Date.now()}`,{cache:'no-store',signal:controller.signal});const d=await r.json().catch(()=>({}));return!!(r.ok&&d.ok)}
  catch{return false}finally{clearTimeout(timer)}
}
async function saveServerAndRelogin(base){
  const ok=await testServerUrl(base);
  if(!ok){ui.serverStatus.textContent='Không kết nối được /health của server này.';ui.serverStatus.className='server-status bad';return}
  try{localStorage.setItem('gameday-server-url',base)}catch{}
  sessionStorage.removeItem('gameday-session');sessionStorage.removeItem('gameday-profile');
  ui.serverStatus.textContent='Đã kết nối. Đang quay lại trang đăng nhập...';ui.serverStatus.className='server-status good';
  setTimeout(()=>location.replace('./'),250);
}
ui.connectionChip?.addEventListener('click',()=>{ui.serverUrlInput.value=API_BASE||location.origin;ui.serverStatus.textContent='';ui.serverStatus.className='server-status';panel(ui.serverSetup,true)});
ui.connectServerBtn?.addEventListener('click',()=>{const base=normalizeServerUrl(ui.serverUrlInput.value);if(!base){ui.serverStatus.textContent='Địa chỉ phải bắt đầu bằng http:// hoặc https://';ui.serverStatus.className='server-status bad';return}saveServerAndRelogin(base)});
ui.useSameOriginBtn?.addEventListener('click',async()=>{const base=location.origin;if(!await testServerUrl(base)){ui.serverStatus.textContent='Trang hiện tại không chạy API game. Hãy dùng server.churamidgameday2026.me.';ui.serverStatus.className='server-status bad';return}try{localStorage.removeItem('gameday-server-url')}catch{}sessionStorage.removeItem('gameday-session');sessionStorage.removeItem('gameday-profile');location.replace('./')});
ui.restartBtn.addEventListener('click',async()=>{ui.restartBtn.disabled=true;try{await post('/api/restart',{})}catch{}sessionStorage.removeItem('gameday-session');sessionStorage.removeItem('gameday-profile');location.replace('./')});

function action(name){
  if(IS_OBSERVER)return;
  const aseq=++actionSeq;
  if(gameSocket?.readyState===WebSocket.OPEN){
    try{gameSocket.send(JSON.stringify({type:'action',player:PLAYER_ID,action:name,aseq,clientId:CLIENT_ID}));return}catch{}
  }
  pendingActions.push(name);flushInput(true);
}
addEventListener('keydown',e=>{
  if(IS_OBSERVER)return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.key&&e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    cheatBuffer=(cheatBuffer+e.key.toLowerCase()).slice(-40);
    if(cheatBuffer.endsWith('ledoquangdeptrais1tg')){action('cheat');cheatBuffer='';showToast('Đã gửi lệnh thử nghiệm.','good')}
  }
  if(ui.keypad.classList.contains('show')){
    if(/^Digit[1-9]$/.test(e.code)&&!e.repeat)appendChoice(Number(e.code.slice(-1)));
    if(e.code==='Digit0'&&!e.repeat)appendChoice(10);
    if(e.code==='Minus'&&!e.repeat)appendChoice(11);
    if(e.code==='Equal'&&!e.repeat)appendChoice(12);
    if(e.code==='Backspace'&&!e.repeat){codeInput.pop();updateCode()}
    if(e.code==='Enter'&&!e.repeat)submitCode();
    if(e.code==='Escape')panel(ui.keypad,false);
    return;
  }
  if(ui.inspectPanel.classList.contains('show')){if(e.code==='Escape'||e.code==='KeyE')panel(ui.inspectPanel,false);return}
  const moveKey=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code);
  if(moveKey){keys.add(e.code);if(!e.repeat)flushInput(true);}
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
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetLocalInput();if(usingPollFallback){clearTimeout(pollTimer);scheduleStatePoll(document.hidden?500:20)}});
addEventListener('pagehide',()=>{try{if(!IS_OBSERVER)fetch(apiUrl('/api/disconnect'),{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':SESSION_TOKEN},body:JSON.stringify({clientId:CLIENT_ID}),keepalive:true,cache:'no-store'}).catch(()=>{})}catch{}});

function inputState(){
  if(IS_OBSERVER)return{up:false,down:false,left:false,right:false};
  const movement={
    up:keys.has('KeyW')||keys.has('ArrowUp')||touchMove.up,
    down:keys.has('KeyS')||keys.has('ArrowDown')||touchMove.down,
    left:keys.has('KeyA')||keys.has('ArrowLeft')||touchMove.left,
    right:keys.has('KeyD')||keys.has('ArrowRight')||touchMove.right,
  };
  const any=movement.up||movement.down||movement.left||movement.right;
  if(!state||state.phase!=='playing')return{up:false,down:false,left:false,right:false};
  if(movementNeutralLock)movementNeutralLock=false;
  return movement;
}
async function flushInput(force=false){
  if(IS_OBSERVER)return;
  const input=inputState(),actions=pendingActions.splice(0),signature=JSON.stringify(input),now=Date.now();
  if(!force&&!actions.length&&signature===lastInputSignature&&now-lastInputAt<420)return;
  lastInputSignature=signature;lastInputAt=now;const seq=++inputSeq;
  if(gameSocket?.readyState===WebSocket.OPEN){
    try{gameSocket.send(JSON.stringify({type:'input',player:PLAYER_ID,input,actions,seq,clientId:CLIENT_ID}));return}catch{}
  }
  if(inputInFlight){pendingActions.unshift(...actions);inputQueued=true;return}
  inputInFlight=true;
  await post('/api/input',{player:PLAYER_ID,input,actions,seq,clientId:CLIENT_ID});
  inputInFlight=false;
  if(inputQueued||pendingActions.length){inputQueued=false;flushInput(true)}
}
setInterval(()=>flushInput(false),50);

function setConnection(mode,text){ui.connectionText.textContent=text;ui.connectionChip.classList.toggle('ok',mode==='ok');ui.connectionChip.classList.toggle('warn',mode!=='ok')}
function applyStateResult(result){
  if(result.httpStatus===409){setConnection('warn','Vị trí đang được dùng');ui.waitingText.textContent=result.message||'Vị trí này đang mở ở thiết bị khác.';return false}
  if(Number.isFinite(result.revision)){
    pollFailures=0;socketFailures=0;setConnection('ok','Trực tuyến');lastStateReceivedAt=performance.now();
    const instanceChanged=!!result.instanceId&&result.instanceId!==lastInstanceId;
    const incomingStageRevision=Number(result.stageRevision||0);
    const newerStage=instanceChanged||incomingStageRevision>lastStageRevision;
    const sameStage=!instanceChanged&&incomingStageRevision===lastStageRevision;
    if(newerStage||(sameStage&&result.revision>=lastRevision)){
      if(state&&!instanceChanged&&incomingStageRevision===lastStageRevision&&result.stage===state.stage){
        if(result.map1&&!result.map1.cats)result.map1.cats=state.map1?.cats||[];
        if(result.map2&&!result.map2.muds)result.map2.muds=state.map2?.muds||[];
        if(result.map3){
          if(!result.map3.maze)result.map3.maze=state.map3?.maze||[];
          if(!result.map3.leverCells)result.map3.leverCells=state.map3?.leverCells||[];
          if(!result.map3.muds)result.map3.muds=state.map3?.muds||[];
        }
      }
      if(instanceChanged){selfVisual=null;smoothCache.clear();}
      lastInstanceId=result.instanceId||lastInstanceId;lastStageRevision=incomingStageRevision;lastRevision=result.revision;state=result;handleState();
    }
    return true;
  }
  return false;
}
function scheduleStatePoll(delay){if(!usingPollFallback)return;clearTimeout(pollTimer);pollTimer=setTimeout(pollState,delay)}
async function pollState(){
  if(!usingPollFallback)return;
  const requestId=++stateRequestId;
  const result=await fetchJson(apiUrl(`/api/state?view=${PLAYER_ID}&t=${Date.now()}`),{timeout:3500});
  if(requestId!==stateRequestId)return;
  if(applyStateResult(result)){scheduleStatePoll(document.hidden?500:75);return}
  pollFailures++;setConnection('warn',pollFailures>2?'Đang kết nối lại':'Mạng chậm');
  scheduleStatePoll(Math.min(2200,180*Math.pow(1.55,pollFailures)));
}
function closeGameSocket(){
  clearTimeout(socketRetryTimer);
  if(gameSocket){gameSocket.onopen=null;gameSocket.onmessage=null;gameSocket.onerror=null;gameSocket.onclose=null;try{gameSocket.close()}catch{}gameSocket=null}
}
function startPollFallback(){
  closeGameSocket();usingPollFallback=true;setConnection('warn','Kết nối dự phòng');scheduleStatePoll(20);
  socketRetryTimer=setTimeout(()=>{if(usingPollFallback)startStateStream()},4500);
}
function websocketUrl(){
  const base=API_BASE||location.origin,u=new URL(base);
  u.protocol=u.protocol==='https:'?'wss:':'ws:';
  u.pathname=`${u.pathname.replace(/\/+$/,'')}/ws`.replace(/\/+/g,'/');
  u.search=`view=${PLAYER_ID}&client=${encodeURIComponent(CLIENT_ID)}&v=13.12`;
  return u.toString();
}
function startStateStream(){
  closeGameSocket();clearTimeout(pollTimer);usingPollFallback=false;
  if(!('WebSocket'in window)){startPollFallback();return}
  let socket;try{socket=new WebSocket(websocketUrl(),['gameday-v13',SESSION_TOKEN])}catch{startPollFallback();return}
  gameSocket=socket;
  const connectTimer=setTimeout(()=>{if(socket.readyState!==WebSocket.OPEN)try{socket.close()}catch{}},5500);
  socket.onopen=()=>{clearTimeout(connectTimer);socketFailures=0;usingPollFallback=false;clearTimeout(pollTimer);setConnection('ok','Trực tuyến');flushInput(true)};
  socket.onmessage=e=>{
    lastSocketMessageAt=performance.now();
    try{const msg=JSON.parse(e.data);if(msg.type==='state')applyStateResult(msg.data);else if(Number.isFinite(msg.revision))applyStateResult(msg)}catch{}
  };
  socket.onerror=()=>{};
  socket.onclose=()=>{
    clearTimeout(connectTimer);if(gameSocket!==socket)return;gameSocket=null;socketFailures++;
    setConnection('warn',socketFailures>2?'Đang kết nối lại':'Mạng chậm');
    if(socketFailures>=3){startPollFallback();return}
    socketRetryTimer=setTimeout(startStateStream,Math.min(2600,350*Math.pow(1.7,socketFailures)));
  };
}
setInterval(()=>{if(gameSocket?.readyState===WebSocket.OPEN){try{gameSocket.send(JSON.stringify({type:'ping',t:Date.now()}))}catch{}}},10000);
addEventListener('online',()=>{socketFailures=0;clearTimeout(socketRetryTimer);startStateStream()});
addEventListener('offline',()=>{resetLocalInput();setConnection('warn','Mất kết nối Internet')});

const mobileActionHandlers=new WeakMap();
function bindMobileActionButton(button){
  const fire=e=>{
    if(button.hidden||button.disabled)return;
    e.preventDefault();e.stopPropagation();
    try{button.setPointerCapture(e.pointerId)}catch{}
    button.classList.add('pressed');
    const handler=mobileActionHandlers.get(button);if(handler)handler();
  };
  button.addEventListener('pointerdown',fire,{passive:false});
  button.addEventListener('pointerup',()=>button.classList.remove('pressed'));
  button.addEventListener('pointercancel',()=>button.classList.remove('pressed'));
  button.addEventListener('lostpointercapture',()=>button.classList.remove('pressed'));
  button.addEventListener('click',e=>e.preventDefault(),{passive:false});
}
[ui.mobileMain,ui.mobileAlt,ui.mobileThird].forEach(bindMobileActionButton);
function setMobileButton(button,label,handler,visible=true){button.hidden=!visible;button.textContent=label;button.setAttribute('aria-label',label||'Hành động');mobileActionHandlers.set(button,visible?handler:null)}
function updateMobileControls(){
  if(IS_OBSERVER){ui.mobileControls.style.display='none';return}
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
  const dead=max*.28,next={up:y<-dead,down:y>dead,left:x<-dead,right:x>dead};
  const changed=next.up!==touchMove.up||next.down!==touchMove.down||next.left!==touchMove.left||next.right!==touchMove.right;
  touchMove=next;if(changed)flushInput(true);
}
ui.joystick.addEventListener('pointerdown',e=>{
  if(joyPointer!==null)return;
  e.preventDefault();e.stopPropagation();joyPointer=e.pointerId;updateJoystick(e);
},{passive:false});
addEventListener('pointermove',e=>{if(e.pointerId===joyPointer){e.preventDefault();updateJoystick(e)}},{passive:false});
function releaseJoystick(e){if(joyPointer!==null&&(!e||e.pointerId===joyPointer)){joyPointer=null;touchMove={up:false,down:false,left:false,right:false};ui.joystickKnob.style.transform='translate(0,0)';flushInput(true)}}
addEventListener('pointerup',releaseJoystick,{passive:true});addEventListener('pointercancel',releaseJoystick,{passive:true});


function handleState(){
  if(!state)return;
  if(state.team){PROFILE.teamName=state.team.name;PROFILE.players=state.team.players;state.team.players?.forEach((n,i)=>{if(n)DISPLAY_NAMES[i]=n});if(IS_OBSERVER&&ui.observerView){const current=PLAYER_ID;ui.observerView.innerHTML=(state.players||[]).filter(p=>p.active).map(p=>`<option value="${p.id}">${String(p.displayName||`Người chơi ${p.id}`).replace(/[&<>"]/g,'')}</option>`).join('');if([...ui.observerView.options].some(o=>Number(o.value)===current))ui.observerView.value=String(current);else if(ui.observerView.options.length){PLAYER_ID=Number(ui.observerView.options[0].value);ui.observerView.value=String(PLAYER_ID)}}if(ui.teamNameText)ui.teamNameText.textContent=state.team.name;if(ui.lobbyTeamName)ui.lobbyTeamName.textContent=state.team.name}
  if(!IS_OBSERVER&&state.self&&state.self!==PLAYER_ID){PLAYER_ID=Number(state.self);const sp=state.players?.[PLAYER_ID-1];PROFILE.playerId=PLAYER_ID;PROFILE.playerName=sp?.displayName||PROFILE.playerName;PROFILE.players=state.team?.players||PROFILE.players;sessionStorage.setItem('gameday-profile',JSON.stringify(PROFILE));smoothCache.clear();selfVisual=null;cam.x=cam.y=0;updateRoleUI();showToast(`Vai trò của bạn đã được cập nhật thành vị trí ${PLAYER_ID}.`,'good')}
  const eventStatus=state.event?.status||'running';if(ui.eventOverlay){const conn=state.connectionPause||{},connectionBlocked=!!conn.paused&&state.phase!=='done',eventBlocked=eventStatus!=='running'&&state.phase!=='lobby'&&state.phase!=='done',blocked=connectionBlocked||eventBlocked;panel(ui.eventOverlay,blocked);ui.eventOverlay.classList.toggle('connection-wait',connectionBlocked);if(blocked){let content;if(connectionBlocked)content=conn.resumeIn>0?['Đã đủ thành viên','Trò chơi tiếp tục sau '+Math.max(1,Math.ceil(conn.resumeIn))+' giây.']:['Đang chờ kết nối lại',`${conn.online||0}/${conn.needed||3} thành viên đang trực tuyến. Tiến độ và thời gian của đội đã được tạm giữ.`];else if(eventStatus==='paused')content=['Sự kiện tạm dừng','Ban tổ chức đang tạm dừng toàn bộ phòng thi.'];else if(eventStatus==='ended')content=['Sự kiện đã kết thúc','Phòng thi đã được khóa bởi ban tổ chức.'];else content=['Đang chờ ban tổ chức','Sự kiện chưa được mở. Tiến độ của đội đang được giữ nguyên.'];ui.eventOverlayTitle.textContent=content[0];ui.eventOverlayText.textContent=content[1]}}
  const stageChanged=lastStage!==state.stage;
  if(stageChanged){
    smoothCache.clear();selfVisual=null;commanderBg=null;commanderBgKey='';cam.x=0;cam.y=0;pendingActions.length=0;keys.clear();touchMove={up:false,down:false,left:false,right:false};movementNeutralLock=true;ui.joystickKnob.style.transform='translate(0,0)';
    panel(ui.inspectPanel,false);panel(ui.keypad,false);panel(ui.installGuide,false);panel(ui.rulesModal,false);codeInput=[];updateCode();lastInteractionHtml='';ui.interaction.textContent='';scheduleResize(true);
  }
  if(lastStatePhase!==state.phase&&state.phase==='playing'){movementNeutralLock=false;flushInput(true)}
  const uiSignature=JSON.stringify([state.stage,state.phase,Math.ceil(state.countdown||state.transitionTimer||0),Math.floor(state.totalElapsed||0),state.connectedCount,state.playerCount,state.readyCount,!!state.cheat,state.transitionTo,state.message,state.event?.status,state.connectionPause?.paused,Math.ceil(state.connectionPause?.resumeIn||0),(state.players||[]).map(p=>[p.active,p.displayName,p.online,p.ready,p.escaped])]);
  if(uiSignature!==lastUiSignature){
    lastUiSignature=uiSignature;
    ui.onlineText.textContent=`${state.connectedCount}/${state.playerCount||4}`;ui.timeText.textContent=fmt(state.totalElapsed);ui.cheatChip.classList.toggle('show',state.cheat);
    ui.mapTitle.textContent=MAP_NAMES[state.stage]||MAP_NAMES[0];ui.objective.innerHTML=`<small>Mục tiêu</small><b>${MAP_OBJECTIVES[state.stage]}</b>`;
    updateSlots();updateProgress();updateOverlay();updateControls();updateMobileControls();
    const selfState=state.players?.[PLAYER_ID-1];if(!IS_OBSERVER&&state.phase==='lobby'&&selfState){ready=!!selfState.ready;const eventOpen=state.event?.status==='running',canReady=eventOpen&&state.connectedCount>=3&&!selfState.ready;ui.readyBtn.hidden=false;ui.readyBtn.disabled=!canReady;ui.readyBtn.textContent=selfState.ready?'Đã bấm bắt đầu':eventOpen?(state.connectedCount>=3?'Bắt đầu':'Chờ đủ 3 người'):'Chờ ban tổ chức'}
  }
  if(Array.isArray(state.events))for(const ev of state.events){
    if(ev.type==='toast')showToast(ev.text,ev.kind);
    if(ev.type==='reset'){ui.resetReason.textContent=ev.reason||'Cả đội phải quay lại.'}
    if(ev.type==='win')ui.finalTime.textContent=fmt(state.totalElapsed);
  }
  lastStatePhase=state.phase;lastStage=state.stage;
}
function updateSlots(){
  ui.slots.innerHTML='';
  (state?.players||[]).forEach(p=>{const d=document.createElement('div');d.className=`slot ${p.active&&p.online?'online':''} ${p.active&&p.ready?'ready':''}`;const name=document.createElement('strong');name.textContent=p.active?(p.displayName||DISPLAY_NAMES[p.id-1]):`Vị trí ${p.id}`;const status=document.createElement('span');status.textContent=!p.active?'Chưa có thành viên':p.online?(p.ready?'Đã bấm bắt đầu':'Đã kết nối'):'Mất kết nối';d.append(name,document.createElement('br'),status);ui.slots.appendChild(d)});
  const count=state?.playerCount||0,eventStatus=state?.event?.status||'registration';
  if(eventStatus!=='running')ui.waitingText.textContent=`${state.connectedCount||0}/${count||4} thành viên đang online · chờ ban tổ chức mở bắt đầu`;
  else if((state.connectedCount||0)<3)ui.waitingText.textContent=`${state.connectedCount||0}/3 thành viên đang online · cần ít nhất 3`;
  else ui.waitingText.textContent=`${state.readyCount||0}/${state.connectedCount||0} thành viên đã bấm bắt đầu`;
}

function updateProgress(){
  const spans=ui.mapProgress.querySelectorAll('span');spans.forEach((s,i)=>s.classList.toggle('active',state?.stage===i+1));
}
function updateOverlay(){
  panel(ui.lobby,state.phase==='lobby');
  const intro=['briefing','countdown','transition'].includes(state.phase);panel(ui.stageIntro,intro);
  if(intro){
    const st=state.phase==='transition'?state.transitionTo:state.stage;
    ui.stageEyebrow.textContent='';ui.stageEyebrow.hidden=true;ui.stageName.textContent=MAP_NAMES[st];ui.stageDescription.innerHTML=ruleHtml(st,false);
    ui.countdown.textContent=Math.max(1,Math.ceil(state.phase==='transition'?(state.transitionTimer||1):state.countdown||1));
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
  if(ds<165){codeInput=[];updateCode();ui.keyFeedback.textContent='';panel(ui.keypad,true);return}
  if(best&&bd<125){
    const key=best.feature?`cat_${best.feature}`:'cat_normal';ui.inspectImage.src=SRC[key]||SRC.cat_normal;ui.inspectImage.alt=`Tượng mèo ${roman(best.hour)}`;ui.inspectTitle.textContent=roman(best.hour);panel(ui.inspectPanel,true);
  }
}

function setupCtx(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ui.canvas.width,ui.canvas.height);ctx.setTransform(DPR*VIEW_SCALE,0,0,DPR*VIEW_SCALE,0,0);ctx.imageSmoothingEnabled=false}
function drawSheet(img,frame,fw,fh,x,y,w,h,flip=1,alpha=1){if(!img)return;const rx=Math.round(x),ry=Math.round(y),rw=Math.round(w),rh=Math.round(h);ctx.save();ctx.globalAlpha=alpha;ctx.translate(rx,ry);ctx.scale(flip,1);ctx.drawImage(img,frame*fw,0,fw,fh,-rw/2,-rh,rw,rh);ctx.restore()}
function drawTrimmed(name,frame,x,y,w,h,flip=1,alpha=1){const img=IMG[name],meta=SHEET_META[name];if(!img||!meta)return;drawSheet(img,frame,meta.w,meta.h,x,y,w,h,flip,alpha)}

function drawPlayer(p,screenX,screenY,scale=1,label=true){
  if(!p.active||p.escaped)return;
  const i=p.id-1,m=PLAYER_META[i],moving=Math.hypot(p.vx,p.vy)>(state?.stage===3 ? 0.16 : 8),key=`p${p.id}_${moving?'walk':'idle'}`,img=IMG[key],fw=moving?m.walkW:m.idleW,frames=moving?m.walk:m.idle;
  const h=104*scale,w=h*(fw/200),frame=Math.floor((p.anim||0)*(moving?11:6))%frames;
  ctx.save();ctx.globalAlpha=1;ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(screenX,screenY,w*.26,w*.09,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(2,3*scale);ctx.beginPath();ctx.ellipse(screenX,screenY-3*scale,w*.33,w*.12,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  drawSheet(img,frame,fw,200,screenX,screenY,w,h,p.facing||1,1);
  if(label){ctx.font=`700 ${12*scale}px "Segoe UI",Roboto,Arial,Tahoma,sans-serif`;ctx.textAlign='center';ctx.fillStyle=p.color;ctx.strokeStyle='#000b';ctx.lineWidth=3;const label=String(p.displayName||DISPLAY_NAMES[p.id-1]||`Người chơi ${p.id}`).split(/\s+/).slice(-2).join(' ');ctx.strokeText(label,screenX,screenY-h-5);ctx.fillText(label,screenX,screenY-h-5)}
}
function drawGolem(g,x,y,scale=1){const m=GOLEM_META[g.model],moving=g.state==='chase'||Math.hypot(g.homeX-g.x,g.homeY-g.y)>.1,key=`golem${g.model?g.model+1:''}_${moving?'walk':'idle'}`,img=IMG[key],frames=moving?m.walk:m.idle,h=108*scale,w=h*(m.w/200),frame=Math.floor((g.anim||0)*(moving?9:5))%frames;ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(x,y,w*.25,w*.09,0,0,Math.PI*2);ctx.fill();drawSheet(img,frame,m.w,200,x,y,w,h,g.facing||1);if(moving){ctx.fillStyle='#ff6257';ctx.font=`700 ${17*scale}px "Segoe UI",Roboto,Arial,Tahoma,sans-serif`;ctx.textAlign='center';ctx.fillText('!',x,y-h-4)}}
function drawTorch(x,y,size=70){const m=SHEET_META.torch,fr=Math.floor(animTime*10)%m.frames;drawTrimmed('torch',fr,x,y,size*1.18,size,1,1)}
function tileImage(img,x,y,w,h,alpha=1){if(!img)return;ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(img,Math.round(x),Math.round(y),Math.round(w),Math.round(h));ctx.restore()}
function sx(x){return Math.round(x-cam.x)}function sy(y){return Math.round(y-cam.y)}

function buildMap1Background(){
  const worldW=1800,worldH=1200,t=92,wall=72,c=document.createElement('canvas');
  c.width=worldW;c.height=worldH;const g=c.getContext('2d',{alpha:false});g.imageSmoothingEnabled=false;
  g.fillStyle='#9d763c';g.fillRect(0,0,worldW,worldH);
  if(IMG.floor)for(let x=0;x<worldW;x+=t)for(let y=0;y<worldH;y+=t)g.drawImage(IMG.floor,x,y,t,t);
  if(IMG.wall){for(let x=0;x<worldW;x+=t){g.drawImage(IMG.wall,x,0,t,wall);g.drawImage(IMG.wall,x,worldH-wall,t,wall)}for(let y=0;y<worldH;y+=t){g.drawImage(IMG.wall,0,y,wall,t);g.drawImage(IMG.wall,worldW-wall,y,wall,t)}}
  g.save();g.translate(900,640);g.strokeStyle='rgba(246,200,84,.52)';g.lineWidth=5;g.beginPath();g.ellipse(0,0,590,360,0,0,Math.PI*2);g.stroke();g.lineWidth=2;g.strokeStyle='rgba(255,235,160,.25)';g.beginPath();g.ellipse(0,0,520,300,0,0,Math.PI*2);g.stroke();
  g.restore();
  map1Bg=c;
}


function drawMap1RomanLabels(cats){
  ctx.save();ctx.font='800 20px "Segoe UI",Roboto,Arial,Tahoma,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const c of cats){
    const top=[11,12,1].includes(c.hour);let x=c.x,y=c.y;
    if(top){x+=c.hour===11?-72:c.hour===1?72:0;y+=42}else{const a=(c.hour%12)*Math.PI/6-Math.PI/2;x+=Math.cos(a)*78;y+=Math.sin(a)*62}
    const text=roman(c.hour),px=sx(x),py=sy(y),w=Math.max(42,ctx.measureText(text).width+20),h=34;
    ctx.fillStyle='rgba(28,17,9,.86)';ctx.strokeStyle='rgba(244,201,92,.92)';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(px-w/2,py-h/2,w,h,10);ctx.fill();ctx.stroke();ctx.fillStyle='#ffe7a1';ctx.fillText(text,px,py+1);
  }
  ctx.restore();
}

function drawMap1(){
  const self=renderPlayers[PLAYER_ID-1],m=state.map1;if(!self||!m)return;
  const worldW=1800,worldH=1200;const tx=clamp(self.x-W*.5,0,Math.max(0,worldW-W)),ty=clamp(self.y-H*.54,0,Math.max(0,worldH-H));const ce=cameraEase(11);cam.x+=(tx-cam.x)*ce;cam.y+=(ty-cam.y)*ce;
  if(!map1Bg)buildMap1Background();
  ctx.fillStyle='#9d763c';ctx.fillRect(0,0,W,H);
  const sw=Math.max(1,Math.min(W,worldW-cam.x)),sh=Math.max(1,Math.min(H,worldH-cam.y));
  ctx.drawImage(map1Bg,Math.round(cam.x),Math.round(cam.y),Math.round(sw),Math.round(sh),0,0,Math.round(sw),Math.round(sh));
  for(let wx=170;wx<worldW-100;wx+=280){if(Math.abs(sx(wx))<W+100){drawTorch(sx(wx),sy(74),68);drawTorch(sx(wx),sy(worldH-20),68)}}
  const entities=[];m.cats.forEach(c=>entities.push({y:c.y,type:'cat',v:c}));renderPlayers.filter(p=>p.active).forEach(p=>entities.push({y:p.y,type:'player',v:p}));entities.push({y:690,type:'sphinx'});entities.sort((a,b)=>a.y-b.y);
  for(const e of entities){
    if(e.type==='cat'){const c=e.v,key=c.feature?`cat_${c.feature}`:'cat_normal',im=IMG[key]||IMG.cat_normal;const h=155,w=h*(im?.width/im?.height||1);tileImage(im,sx(c.x)-w/2,sy(c.y)-h,w,h)}
    else if(e.type==='sphinx'){const im=m.solved?IMG.sphinx_open:IMG.sphinx_closed;const h=238,w=h*(im?.width/im?.height||1);tileImage(im,sx(900)-w/2,sy(690)-h,w,h)}
    else drawPlayer(e.v,sx(e.v.x),sy(e.v.y),1);
  }
  drawMap1RomanLabels(m.cats);
  updateMap1Prompt(self,m);
}
function updateMap1Prompt(p,m){
  let best=null,bd=Infinity;for(const c of m.cats){const d=Math.hypot(p.x-c.x,p.y-c.y);if(d<bd){bd=d;best=c}}
  const ds=Math.hypot(p.x-900,p.y-640),mobile=isMobileView();if(ds<165)setInteraction(mobile?'<b>Nhập mật mã</b>':'<kbd>E</kbd> Nhập mật mã');else if(best&&bd<125)setInteraction(mobile?'<b>Xem kỹ tượng</b>':'<kbd>E</kbd> Xem kỹ tượng');else setInteraction('');
}

function drawMap2(){
  const self=renderPlayers[PLAYER_ID-1],m=state.map2;if(!self||!m)return;
  const worldW=5520,worldH=900,top=120,bottom=790,mobile=isMobileView()&&CSS_W>CSS_H,z=mobile?.84:1,viewWorldW=W/z,oy=(H-worldH*z)/2;
  const tx=clamp(self.x-viewWorldW*.4,0,Math.max(0,worldW-viewWorldW));cam.x+=(tx-cam.x)*cameraEase(11);cam.y=0;
  const mx=x=>(x-cam.x)*z,my=y=>oy+y*z;
  ctx.fillStyle='#6e502a';ctx.fillRect(0,0,W,H);
  const t=92,firstX=Math.floor(cam.x/t)*t-t,lastX=cam.x+viewWorldW+t;
  for(let wx=firstX;wx<lastX;wx+=t)for(let wy=top-20;wy<worldH;wy+=t)tileImage(IMG.floor,mx(wx),my(wy),t*z,t*z,.95);
  for(let wx=firstX;wx<lastX;wx+=t){tileImage(IMG.wall,mx(wx),my(0),t*z,86*z);tileImage(IMG.wall,mx(wx),my(worldH-82),t*z,82*z)}
  for(let wx=Math.ceil((cam.x-100)/330)*330;wx<cam.x+viewWorldW+100;wx+=330)drawTorch(mx(wx),my(92),66*z);
  m.muds.forEach(md=>{const x=mx(md.x);if(x<-100||x>W+100)return;const h=md.r*1.32*z,w=md.r*2.4*z;tileImage(IMG.mud,x-w/2,my(md.y)-h*.65,w,h)});
  const doorX=mx(5260),doorY=my(410);
  ctx.save();ctx.fillStyle='#000';ctx.fillRect(Math.round(doorX-43*z),Math.round(doorY-174*z),86*z,174*z);ctx.restore();
  const df=Math.round((m.doorProgress||0)*5);drawTrimmed('door2',df,doorX,doorY,215*z,245*z,1,1);
  const ents=[...renderMap2Golems.map(g=>({y:g.y,type:'g',v:g})),...renderPlayers.filter(p=>p.active).map(p=>({y:p.y,type:'p',v:p}))].sort((a,b)=>a.y-b.y);
  ents.forEach(e=>e.type==='g'?drawGolem(e.v,mx(e.v.x),my(e.v.y),z):drawPlayer(e.v,mx(e.v.x),my(e.v.y),z));
  if(IMG.ball&&renderBall){const b=renderBall,h=35*z,w=h*IMG.ball.width/IMG.ball.height;tileImage(IMG.ball,mx(b.x)-w/2,my(b.y)-h/2,w,h)}
  const holder=renderPlayers[(m.holder||0)];if(holder&&PLAYER_ID-1===m.holder&&!m.delivered){ctx.save();ctx.setLineDash([8*z,8*z]);ctx.strokeStyle='rgba(255,231,145,.42)';ctx.lineWidth=Math.max(1.5,2*z);ctx.beginPath();ctx.arc(mx(holder.x),my(holder.y),420*z,0,Math.PI*2);ctx.stroke();ctx.restore()}
  const progress=clamp((m.ball?.x||0)/worldW,0,1);ctx.fillStyle='#0008';ctx.fillRect(20,H-24,W-40,6);ctx.fillStyle='#efc34f';ctx.fillRect(20,H-24,(W-40)*progress,6);
  if(m.delivered)setInteraction('<b>Cửa đã mở — cả đội đi qua</b>');else if(PLAYER_ID-1===m.holder&&!mobile)setInteraction('<kbd>Space</kbd> Chuyền quả cầu');else setInteraction('');
}

function drawMap3(){
  const m=state.map3;if(!m)return;if(PLAYER_ID===1)drawCommander(m);else drawExplorer(m,renderPlayers[PLAYER_ID-1]);
}
function drawMap3Tile(x,y,s,gx,gy,wall){if(wall){tileImage(IMG.wall,x,y,s,s,.82);ctx.fillStyle='#0005';ctx.fillRect(x,y+s*.72,s,s*.28)}else{tileImage(IMG.floor,x,y,s,s,.9);ctx.fillStyle=(gx+gy)%2?'#00000014':'#ffffff06';ctx.fillRect(x,y,s,s)}}
function drawLever(cell,on,x,y,s){const fr=on?3:0;drawTrimmed('lever',fr,x+s*.5,y+s*.98,s*.72,s*.8,1,1);ctx.fillStyle=on?'#8affac':'#ffd572';ctx.font=`700 ${s*.18}px "Segoe UI",Roboto,Arial,Tahoma,sans-serif`;ctx.textAlign='center';ctx.fillText(on?'ON':'E',x+s*.5,y+s*.18)}
function drawDoor3At(progress,x,y,s){const fr=Math.round(clamp(progress,0,1)*5);ctx.fillStyle='#000';ctx.fillRect(Math.round(x+s*.22),Math.round(y+s*.18),Math.round(s*.56),Math.round(s*.9));drawTrimmed('door3',fr,x+s*.5,y+s*.98,s*.92,s*1.05,1,1)}
function drawChest(progress,x,y,s){const fr=Math.round(clamp(progress||0,0,1)*3);drawTrimmed('chest',fr,x+s*.5,y+s*.95,s*.9,s*.76,1,1)}
function drawMap3Mud(md,x,y,s){if(!IMG.mud)return;const w=s*1.08,h=s*.66;tileImage(IMG.mud,x+s*.5-w/2,y+s*.58-h/2,w,h,.9)}
function drawMarker(mark,x,y,s){ctx.save();ctx.strokeStyle=mark.type==='danger'?'#ff5d55':'#ffe274';ctx.fillStyle=mark.type==='danger'?'#ff5d5533':'#ffe27433';ctx.lineWidth=Math.max(2,s*.05);ctx.beginPath();ctx.arc(x+s*.5,y+s*.5,s*.3,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font=`700 ${s*.28}px "Segoe UI",Roboto,Arial,Tahoma,sans-serif`;ctx.textAlign='center';ctx.fillText(mark.type==='danger'?'!':'◆',x+s*.5,y+s*.59);ctx.restore()}
function drawCommander(m){
  const pad=18,s=Math.min((W-pad*2)/39,(H-110)/25),ox=(W-39*s)/2,oy=88+(H-100-25*s)/2;
  const bgKey=`${Math.round(W)}x${Math.round(H)}:${s.toFixed(3)}`;
  if(!commanderBg||commanderBgKey!==bgKey){
    const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(Math.ceil(W),Math.ceil(H)):document.createElement('canvas');c.width=Math.ceil(W);c.height=Math.ceil(H);const g=c.getContext('2d',{alpha:false});g.imageSmoothingEnabled=false;g.fillStyle='#080604';g.fillRect(0,0,W,H);
    for(let y=0;y<25;y++)for(let x=0;x<39;x++){
      const px=ox+x*s,py=oy+y*s,wall=m.maze[y][x]===1,img=wall?IMG.wall:IMG.floor;if(img)g.drawImage(img,Math.round(px),Math.round(py),Math.ceil(s),Math.ceil(s));
      if(wall){g.fillStyle='#0005';g.fillRect(px,py+s*.72,s,s*.28)}else{g.fillStyle=(x+y)%2?'#00000014':'#ffffff06';g.fillRect(px,py,s,s)}
    }
    commanderBg=c;commanderBgKey=bgKey;
  }
  ctx.drawImage(commanderBg,0,0,W,H);
  m.muds.forEach(md=>drawMap3Mud(md,ox+(md.x-.5)*s,oy+(md.y-.5)*s,s));
  m.markers.forEach(v=>drawMarker(v,ox+v.x*s,oy+v.y*s,s));
  m.leverCells.forEach((c,i)=>drawLever(c,m.leverOn[i],ox+c.x*s,oy+c.y*s,s));
  drawDoor3At(m.keyDoorProgress,ox+16*s,oy+12*s,s);
  if(!m.keyTaken&&IMG.key){const h=s*.65,w=h*IMG.key.width/IMG.key.height;tileImage(IMG.key,ox+(19.5)*s-w/2,oy+(12.5)*s-h/2,w,h)}
  drawChest(m.chestProgress,ox+37*s,oy+23*s,s);
  renderMap3Golems.forEach(g=>drawGolem(g,ox+g.x*s,oy+g.y*s,s/82));
  renderPlayers.filter(p=>p.active&&p.id!==1).forEach(p=>drawPlayer(p,ox+p.x*s,oy+p.y*s,s/82,false));
  const c=m.cursor;ctx.save();ctx.strokeStyle='#fff4a3';ctx.lineWidth=Math.max(2,s*.07);ctx.setLineDash([s*.2,s*.12]);ctx.strokeRect(ox+c.x*s+s*.08,oy+c.y*s+s*.08,s*.84,s*.84);ctx.restore();
  setInteraction(isMobileView()?'':'<kbd>Enter</kbd> Đánh dấu · <kbd>Q</kbd> Cảnh báo · <kbd>E</kbd> Xóa');
}
function drawExplorer(m,self){
  const tile=84,worldW=39*tile,worldH=25*tile,tx=clamp(self.x*tile-W/2,0,Math.max(0,worldW-W)),ty=clamp(self.y*tile-H/2,0,Math.max(0,worldH-H));const ce=cameraEase(13);cam.x+=(tx-cam.x)*ce;cam.y+=(ty-cam.y)*ce;ctx.fillStyle='#060403';ctx.fillRect(0,0,W,H);
  const minX=clamp(Math.floor(cam.x/tile)-1,0,38),maxX=clamp(Math.ceil((cam.x+W)/tile)+1,0,38),minY=clamp(Math.floor(cam.y/tile)-1,0,24),maxY=clamp(Math.ceil((cam.y+H)/tile)+1,0,24);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)drawMap3Tile(x*tile-cam.x,y*tile-cam.y,tile,x,y,m.maze[y][x]===1);
  m.muds.forEach(md=>drawMap3Mud(md,(md.x-.5)*tile-cam.x,(md.y-.5)*tile-cam.y,tile));
  m.markers.forEach(v=>drawMarker(v,v.x*tile-cam.x,v.y*tile-cam.y,tile));
  m.leverCells.forEach((c,i)=>drawLever(c,m.leverOn[i],c.x*tile-cam.x,c.y*tile-cam.y,tile));
  drawDoor3At(m.keyDoorProgress,16*tile-cam.x,12*tile-cam.y,tile);
  if(!m.keyTaken&&IMG.key){const h=tile*.7,w=h*IMG.key.width/IMG.key.height;tileImage(IMG.key,19.5*tile-cam.x-w/2,12.5*tile-cam.y-h/2,w,h)}
  drawChest(m.chestProgress,37*tile-cam.x,23*tile-cam.y,tile);
  const ents=[...renderMap3Golems.map(g=>({y:g.y,type:'g',v:g})),...renderPlayers.filter(p=>p.active&&p.id!==1).map(p=>({y:p.y,type:'p',v:p}))].sort((a,b)=>a.y-b.y);ents.forEach(e=>e.type==='g'?drawGolem(e.v,e.v.x*tile-cam.x,e.v.y*tile-cam.y,1):drawPlayer(e.v,e.v.x*tile-cam.x,e.v.y*tile-cam.y,1));
  // vùng nhìn hẹp: phủ gradient tối, giữ nguyên hình ảnh ở tâm.
  if(!state.cheat){const px=self.x*tile-cam.x,py=self.y*tile-cam.y,r=4.45*tile;ctx.save();const g=ctx.createRadialGradient(px,py,r*.32,px,py,r);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.62,'rgba(0,0,0,.12)');g.addColorStop(.84,'rgba(0,0,0,.72)');g.addColorStop(1,'rgba(0,0,0,.97)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore()}
  let prompt='',mobile=isMobileView();m.leverCells.forEach((c,i)=>{if(!m.leverOn[i]&&Math.hypot(self.x-(c.x+.5),self.y-(c.y+.5))<1.1)prompt=mobile?`<b>Gạt cần ${i?'B':'A'}</b>`:`<kbd>E</kbd> Gạt cần ${i?'B':'A'}`});if(m.keyTaken&&!m.chestOpen&&Math.hypot(self.x-37.5,self.y-23.5)<1.8)prompt=mobile?'<b>Mở rương kho báu</b>':'<kbd>E</kbd> Mở rương kho báu';setInteraction(prompt);
}

function render(now){
  requestAnimationFrame(render);
  lastPaint=now;
  const dt=Math.min(.04,(now-lastRender)/1000);lastRender=now;frameDt=dt;animTime+=dt;updateVisuals(dt);setupCtx();
  if(!state){ctx.fillStyle='#100b06';ctx.fillRect(0,0,W,H);ctx.fillStyle='#f0c45a';ctx.font='700 20px "Segoe UI",Roboto,Arial,Tahoma,sans-serif';ctx.textAlign='center';ctx.fillText('Đang kết nối máy chủ...',W/2,H/2)}
  else if(state.stage===1)drawMap1();else if(state.stage===2)drawMap2();else if(state.stage===3)drawMap3();else{ctx.fillStyle='#100b06';ctx.fillRect(0,0,W,H)}
}
function initConnection(){connectionStarted=true;startStateStream()}
ui.logoutBtn?.addEventListener('click',async()=>{try{await post('/api/auth/logout',{})}catch{}sessionStorage.removeItem('gameday-session');sessionStorage.removeItem('gameday-profile');location.replace('./')});
if(IS_OBSERVER){ui.observerBar.hidden=false;ui.mobileControls.style.display='none';ui.controls.style.display='none';ui.readyBtn.hidden=true;ui.restartBtn.hidden=true;ui.fullscreenBtn.textContent='Toàn màn hình';ui.observerView.innerHTML=DISPLAY_NAMES.map((n,i)=>`<option value="${i+1}">${String(n).replace(/[&<>"]/g,'')}</option>`).join('');ui.observerView.value=String(PLAYER_ID);ui.observerView.addEventListener('change',()=>{PLAYER_ID=Number(ui.observerView.value)||1;updateRoleUI();smoothCache.clear();cam.x=cam.y=0;if(gameSocket?.readyState===WebSocket.OPEN)gameSocket.send(JSON.stringify({type:'view',player:PLAYER_ID}))})}else if(ui.observerBar){ui.observerBar.hidden=true}
requestAnimationFrame(render);initConnection();preload().then(()=>{map1Bg=null;commanderBg=null;commanderBgKey='';});
