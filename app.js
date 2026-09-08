(() => {
  'use strict';
  const STORAGE_KEY = 'miniprompter-library-v1';
  const SETTINGS_KEY = 'miniprompter-settings-v1';
  const $ = id => document.getElementById(id);
  const screens = ['libraryView', 'editorView', 'prompterView'];
  let library = loadJSON(STORAGE_KEY, []);
  const DEFAULT_STYLE = {font:'system',bold:false,italic:false,underline:false,strike:false};
  const FONT_STACKS = {system:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',avenir:'"Avenir Next",Avenir,sans-serif',georgia:'Georgia,serif',helvetica:'"Helvetica Neue",Helvetica,sans-serif',menlo:'Menlo,monospace'};
  let settings = {...{speed:5,font:62,margin:8,countdown:5,cue:true,autoHide:true,mirrorH:false,mirrorV:false,textColor:'#ffffff'}, ...loadJSON(SETTINGS_KEY,{})};
  let activeId = null, scrolling = false, countdownActive = false, raf = 0, lastFrame = 0, countdownTimer = 0, wakeLock = null, toastTimer = 0;

  function loadJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function saveLibrary() { localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); }
  function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  function showScreen(id) { screens.forEach(x => $(x).hidden = x !== id); window.scrollTo(0,0); }
  function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,2200); }
  function current() { return library.find(x => x.id === activeId); }
  function escapeHTML(value) { const d=document.createElement('div'); d.textContent=value; return d.innerHTML; }
  function formatDate(value) { return new Intl.DateTimeFormat('es',{day:'2-digit',month:'short'}).format(new Date(value)); }
  function linesPerSecond(level=settings.speed) { return 2+(Math.max(1,Math.min(20,Number(level)))-1)*(18/19); }
  function updateSpeedDisplay(){ const level=Number(settings.speed); const lines=linesPerSecond(level); const label=Number.isInteger(lines)?String(lines):lines.toFixed(1).replace('.',','); $('speedOutput').value=`${level} · ${label} líneas/s`; $('speedSlider').setAttribute('aria-valuetext',`Nivel ${level}, ${label} líneas por segundo`); }
  function speechStyle(s=current()){ return {...DEFAULT_STYLE,...(s?.style||{})}; }
  function setEditorStyle(style=speechStyle()){
    const editor=$('bodyInput'); editor.style.fontFamily=FONT_STACKS[style.font]||FONT_STACKS.system; editor.style.fontWeight=style.bold?'700':'400'; editor.style.fontStyle=style.italic?'italic':'normal'; editor.style.textDecoration=[style.underline?'underline':'',style.strike?'line-through':''].filter(Boolean).join(' ')||'none';
    $('fontFamilySelect').value=style.font; [['boldButton','bold'],['italicButton','italic'],['underlineButton','underline'],['strikeButton','strike']].forEach(([id,key])=>$(id).classList.toggle('active',Boolean(style[key])));
  }
  function toggleStyle(key){ const s=current(); if(!s)return; s.style=speechStyle(s); s.style[key]=!s.style[key]; saveLibrary(); setEditorStyle(s.style); }

  function renderLibrary() {
    const q=$('searchInput').value.trim().toLocaleLowerCase('es');
    const items=library.filter(s => (s.title+' '+s.body).toLocaleLowerCase('es').includes(q)).sort((a,b)=>b.updated-a.updated);
    $('scriptGrid').innerHTML=items.map(s=>`<button class="script-card" data-id="${s.id}"><h2>${escapeHTML(s.title||'Sin título')}</h2><p>${escapeHTML(s.body||'Discurso vacío')}</p><time>${formatDate(s.updated)}</time></button>`).join('');
    $('emptyState').hidden=library.length!==0 || q!=='';
    $('scriptGrid').hidden=library.length===0 && q==='';
    document.querySelectorAll('.script-card').forEach(card => card.addEventListener('click',()=>openEditor(card.dataset.id)));
  }
  function createScript(title='Sin título',body='') { const item={id:crypto.randomUUID?.()||String(Date.now()),title,body,style:{...DEFAULT_STYLE},updated:Date.now()}; library.unshift(item); saveLibrary(); openEditor(item.id); }
  function openEditor(id) { activeId=id; const s=current(); if(!s)return; $('titleInput').value=s.title; $('bodyInput').textContent=s.body; setEditorStyle(); updateWordCount(); showScreen('editorView'); }
  function editorText(){ return $('bodyInput').innerText.replace(/\u00a0/g,' '); }
  function saveEditor() { const s=current(); if(!s)return; s.title=$('titleInput').value.trim()||'Sin título'; s.body=editorText(); s.updated=Date.now(); saveLibrary(); }
  function updateWordCount(){ const text=editorText().trim(); const n=text?text.split(/\s+/).length:0; $('wordCount').textContent=`${n} ${n===1?'palabra':'palabras'}`; $('playButton').disabled=!text; }
  function leaveEditor(){ saveEditor(); renderLibrary(); showScreen('libraryView'); }
  function openPrompter(){ saveEditor(); const s=current(); if(!s?.body.trim())return; $('prompterTitle').textContent=s.title; $('prompterText').textContent=s.body; applySettings(); resetPrompter(); showScreen('prompterView'); }
  function applySettings(){
    document.documentElement.style.setProperty('--prompt-font',settings.font+'px'); document.documentElement.style.setProperty('--prompt-margin',settings.margin+'vw'); document.documentElement.style.setProperty('--prompt-color',settings.textColor);
    $('speedSlider').value=settings.speed; updateSpeedDisplay(); $('fontSlider').value=settings.font; $('fontOutput').value=settings.font; $('marginSlider').value=settings.margin; $('marginOutput').value=settings.margin+'%'; $('textColorInput').value=settings.textColor; $('countdownSelect').value=String(settings.countdown); $('cueToggle').checked=settings.cue; $('autoHideToggle').checked=settings.autoHide;
    const style=speechStyle(); const text=$('prompterText'); text.style.fontFamily=FONT_STACKS[style.font]||FONT_STACKS.system; text.style.fontWeight=style.bold?'700':'500'; text.style.fontStyle=style.italic?'italic':'normal'; text.style.textDecoration=[style.underline?'underline':'',style.strike?'line-through':''].filter(Boolean).join(' ')||'none';
    $('scriptTransform').className='script-transform'+(settings.mirrorH?' mirrored-h':'')+(settings.mirrorV?' mirrored-v':'');
    $('mirrorHButton').classList.toggle('active',settings.mirrorH); $('mirrorVButton').classList.toggle('active',settings.mirrorV);
    $('cue').hidden=!settings.cue; $('cue').classList.toggle('right',settings.mirrorH);
  }
  function setPlayState(playing){ $('playIcon').src=playing?'icons/ui/pause-fill.svg':'icons/ui/play-fill.svg'; $('startButton').setAttribute('aria-label',playing?'Pausar':'Iniciar'); }
  function resetPrompter(){ stopScroll(); countdownActive=false; clearInterval(countdownTimer); $('countdownOverlay').hidden=true; $('scrollViewport').scrollTop=0; setPlayState(false); $('controls').classList.remove('hidden'); }
  function stopScroll(){ scrolling=false; cancelAnimationFrame(raf); raf=0; lastFrame=0; setPlayState(false); releaseWakeLock(); }
  function startCountdown(){
    if(scrolling){stopScroll();return;} requestWakeLock(); let remaining=Number(settings.countdown);
    if(remaining<=0){beginScroll();return;} const overlay=$('countdownOverlay'); overlay.hidden=false;
    countdownActive=true;
    const draw=()=>{ $('countdownNumber').textContent=remaining; const warn=remaining<=3; overlay.classList.toggle('warning',warn); $('countdownMessage').textContent=warn?'MANTÉNGASE QUIETO':''; };
    draw(); clearInterval(countdownTimer); countdownTimer=setInterval(()=>{remaining--; if(remaining<=0){clearInterval(countdownTimer);countdownActive=false;overlay.hidden=true;overlay.classList.remove('warning');beginScroll();}else draw();},1000);
  }
  function beginScroll(){ scrolling=true; setPlayState(true); if(settings.autoHide)$('controls').classList.add('hidden'); requestWakeLock(); lastFrame=performance.now(); raf=requestAnimationFrame(step); }
  function scrollRate(){ const lineHeight=parseFloat(getComputedStyle($('prompterText')).lineHeight)||settings.font*1.28; return lineHeight*linesPerSecond(); }
  function step(now){ if(!scrolling)return; const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;const viewport=$('scrollViewport');viewport.scrollTop+=scrollRate()*dt;if(viewport.scrollTop+viewport.clientHeight>=viewport.scrollHeight-2){stopScroll();$('controls').classList.remove('hidden');return;}raf=requestAnimationFrame(step); }
  function updateWakeLockStatus(message,active=false){ $('wakeLockStatus').textContent=message; $('wakeLockButton').classList.toggle('active',active); }
  async function requestWakeLock({notify=false}={}){
    if(!('wakeLock'in navigator)){ updateWakeLockStatus('Este navegador no ofrece bloqueo de pantalla.'); if(notify)toast('Instálala desde Safari para mantener la pantalla encendida'); return false; }
    try{
      if(!wakeLock||wakeLock.released){ wakeLock=await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release',()=>updateWakeLockStatus('Bloqueo liberado; se reintentará al reproducir.')); }
      updateWakeLockStatus('Pantalla encendida mientras se reproduce.',true); return true;
    }catch(error){
      updateWakeLockStatus('iOS no lo permitió. Revisa el modo de bajo consumo.');
      if(notify)toast('iOS no permitió mantener la pantalla encendida');
      return false;
    }
  }
  async function releaseWakeLock(){ if(!wakeLock||wakeLock.released)return; try{await wakeLock.release();}catch{} wakeLock=null; }
  async function fullscreen(){ try{ if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen(); else toast('Añádela a Inicio para usar toda la pantalla'); }catch{toast('Añádela a Inicio para usar toda la pantalla');} }
  function exportBackup(){ const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),scripts:library},null,2)],{type:'application/json'});const file=new File([blob],`MiniPrompter-${new Date().toISOString().slice(0,10)}.json`,{type:'application/json'});if(navigator.share&&navigator.canShare?.({files:[file]})){navigator.share({files:[file],title:'Respaldo MiniPrompter'}).catch(()=>{});}else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);} }
  async function restoreBackup(file){ try{const data=JSON.parse(await file.text());if(!Array.isArray(data.scripts))throw 0;library=data.scripts.map(s=>({id:String(s.id||Date.now()+Math.random()),title:String(s.title||'Sin título'),body:String(s.body||''),style:{...DEFAULT_STYLE,...(s.style||{})},updated:Number(s.updated)||Date.now()}));saveLibrary();renderLibrary();toast('Biblioteca restaurada');}catch{toast('El respaldo no es válido');} }
  async function importText(file){ const body=await file.text(); createScript(file.name.replace(/\.[^.]+$/,''),body); }

  $('newButton').onclick=$('emptyNewButton').onclick=()=>createScript(); $('searchInput').oninput=renderLibrary; $('editorBack').onclick=leaveEditor;
  $('titleInput').oninput=saveEditor; $('bodyInput').oninput=()=>{saveEditor();updateWordCount();}; $('playButton').onclick=openPrompter;
  $('boldButton').onclick=()=>toggleStyle('bold'); $('italicButton').onclick=()=>toggleStyle('italic'); $('underlineButton').onclick=()=>toggleStyle('underline'); $('strikeButton').onclick=()=>toggleStyle('strike');
  $('fontFamilySelect').onchange=e=>{const s=current();if(!s)return;s.style=speechStyle(s);s.style.font=e.target.value;saveLibrary();setEditorStyle(s.style);};
  $('caseSelect').onchange=e=>{const mode=e.target.value;if(!mode)return;let text=editorText();if(mode==='upper')text=text.toLocaleUpperCase('es');if(mode==='lower')text=text.toLocaleLowerCase('es');if(mode==='sentence')text=text.toLocaleLowerCase('es').replace(/(^|[.!?]\s+)([a-záéíóúüñ])/giu,(_,start,letter)=>start+letter.toLocaleUpperCase('es'));$('bodyInput').textContent=text;e.target.value='';saveEditor();updateWordCount();};
  $('deleteButton').onclick=()=>{if(!current()||!confirm('¿Eliminar este discurso?'))return;library=library.filter(s=>s.id!==activeId);saveLibrary();renderLibrary();showScreen('libraryView');};
  $('prompterBack').onclick=()=>{resetPrompter();showScreen('editorView');}; $('settingsButton').onclick=()=>$('settingsDialog').showModal(); $('startButton').onclick=startCountdown; $('restartButton').onclick=resetPrompter;
  $('speedSlider').oninput=e=>{settings.speed=Number(e.target.value);updateSpeedDisplay();saveSettings();};
  $('mirrorHButton').onclick=()=>{settings.mirrorH=!settings.mirrorH;saveSettings();applySettings();}; $('mirrorVButton').onclick=()=>{settings.mirrorV=!settings.mirrorV;saveSettings();applySettings();};
  $('fontDownButton').onclick=()=>{settings.font=Math.max(28,settings.font-2);saveSettings();applySettings();}; $('fontUpButton').onclick=()=>{settings.font=Math.min(104,settings.font+2);saveSettings();applySettings();}; $('prompterStage').addEventListener('click',e=>{if(!e.target.closest('button,input,.controls,.prompter-header'))$('controls').classList.toggle('hidden');});
  $('scrollViewport').addEventListener('pointerdown',()=>{if(scrolling)stopScroll();},{passive:true});
  $('fontSlider').oninput=e=>{settings.font=Number(e.target.value);saveSettings();applySettings();}; $('marginSlider').oninput=e=>{settings.margin=Number(e.target.value);saveSettings();applySettings();}; $('textColorInput').oninput=e=>{settings.textColor=e.target.value;saveSettings();applySettings();}; $('countdownSelect').onchange=e=>{settings.countdown=Number(e.target.value);saveSettings();}; $('cueToggle').onchange=e=>{settings.cue=e.target.checked;saveSettings();applySettings();}; $('autoHideToggle').onchange=e=>{settings.autoHide=e.target.checked;saveSettings();}; $('fullscreenButton').onclick=fullscreen; $('wakeLockButton').onclick=()=>requestWakeLock({notify:true});
  $('importTextButton').onclick=()=>$('fileInput').click(); $('fileInput').onchange=e=>{if(e.target.files[0])importText(e.target.files[0]);e.target.value='';}; $('backupButton').onclick=exportBackup; $('restoreButton').onclick=()=>$('backupInput').click(); $('backupInput').onchange=e=>{if(e.target.files[0])restoreBackup(e.target.files[0]);e.target.value='';};
  window.addEventListener('popstate',()=>{if(!$('prompterView').hidden){resetPrompter();showScreen('editorView');}else if(!$('editorView').hidden)leaveEditor();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&(scrolling||countdownActive))requestWakeLock();});
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
  applySettings();renderLibrary();
})();
