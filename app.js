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
  let activeId = null, scrolling = false, countdownActive = false, raf = 0, lastFrame = 0, scrollPosition = 0, countdownTimer = 0, wakeLock = null, toastTimer = 0, savedRange = null;

  function loadJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function saveLibrary() { localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); }
  function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  function showScreen(id) {
    if(id==='editorView'){
      $('libraryView').hidden=false; $('libraryView').inert=true; $('editorView').hidden=false; $('prompterView').hidden=true;
    }else{
      screens.forEach(x => $(x).hidden = x !== id); $('libraryView').inert=false;
    }
    window.scrollTo(0,0);
  }
  function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,2200); }
  function current() { return library.find(x => x.id === activeId); }
  function escapeHTML(value) { const d=document.createElement('div'); d.textContent=value; return d.innerHTML; }
  function formatDate(value) { return new Intl.DateTimeFormat('es',{day:'2-digit',month:'short'}).format(new Date(value)); }
  function linesPerSecond(level=settings.speed) { return .5+(Math.max(1,Math.min(20,Number(level)))-1)*(19.5/19); }
  function updateRangeProgress(input){ const min=Number(input.min)||0; const max=Number(input.max)||100; const value=Number(input.value); const progress=max===min?0:(value-min)/(max-min)*100; input.style.setProperty('--range-progress',`${progress}%`); }
  function updateSpeedDisplay(){ const level=Number(settings.speed); const lines=linesPerSecond(level); const label=Number.isInteger(lines)?String(lines):lines.toFixed(1).replace('.',','); $('speedOutput').value=`${level} · ${label} líneas/s`; $('speedSlider').setAttribute('aria-valuetext',`Nivel ${level}, ${label} líneas por segundo`); updateRangeProgress($('speedSlider')); }
  function speechStyle(s=current()){ return {...DEFAULT_STYLE,...(s?.style||{})}; }
  function sanitizeHTML(value=''){
    const template=document.createElement('template'); template.innerHTML=String(value);
    const allowed=new Set(['BR','DIV','P','B','STRONG','I','EM','U','S','STRIKE','FONT','SPAN']);
    [...template.content.querySelectorAll('*')].forEach(element=>{
      if(!allowed.has(element.tagName)){ element.replaceWith(...element.childNodes); return; }
      const face=element.tagName==='FONT'?element.getAttribute('face'):null;
      const style=element.tagName==='SPAN'?element.getAttribute('style'):null;
      [...element.attributes].forEach(attribute=>element.removeAttribute(attribute.name));
      if(face&&/^[\w\s"',.-]{1,100}$/.test(face))element.setAttribute('face',face);
      if(style){
        const probe=document.createElement('span'); probe.setAttribute('style',style); const safe=[];
        if(probe.style.fontFamily&&/^[\w\s"',.-]{1,100}$/.test(probe.style.fontFamily))safe.push(`font-family:${probe.style.fontFamily}`);
        if(['bold','700'].includes(probe.style.fontWeight))safe.push('font-weight:700');
        if(probe.style.fontStyle==='italic')safe.push('font-style:italic');
        if(probe.style.textDecorationLine){ const decoration=probe.style.textDecorationLine.split(/\s+/).filter(x=>x==='underline'||x==='line-through').join(' '); if(decoration)safe.push(`text-decoration:${decoration}`); }
        if(safe.length)element.setAttribute('style',safe.join(';'));
      }
    });
    return template.innerHTML;
  }
  function speechHTML(s){
    if(s?.html)return sanitizeHTML(s.html);
    let html=escapeHTML(s?.body||'').replace(/\n/g,'<br>'); const style=speechStyle(s);
    if(style.font&&style.font!=='system')html=`<font face="${style.font==='avenir'?'Avenir Next':style.font==='helvetica'?'Helvetica Neue':style.font}">${html}</font>`;
    if(style.bold)html=`<b>${html}</b>`; if(style.italic)html=`<i>${html}</i>`; if(style.underline)html=`<u>${html}</u>`; if(style.strike)html=`<s>${html}</s>`;
    return html;
  }
  function rangeBelongsToEditor(range){ const node=range?.commonAncestorContainer; return Boolean(node&&$('bodyInput').contains(node.nodeType===Node.ELEMENT_NODE?node:node.parentNode)); }
  function rememberSelection(){ const selection=getSelection(); if(selection?.rangeCount&&rangeBelongsToEditor(selection.getRangeAt(0))){ savedRange=selection.getRangeAt(0).cloneRange(); updateFormatButtons(); } }
  function restoreSelection(){ if(!savedRange||!rangeBelongsToEditor(savedRange))return false; const selection=getSelection(); selection.removeAllRanges(); selection.addRange(savedRange); return !savedRange.collapsed; }
  function updateFormatButtons(){
    const node=savedRange?.startContainer; const element=node&&(node.nodeType===Node.ELEMENT_NODE?node:node.parentElement); if(!element||!$('bodyInput').contains(element)){['boldButton','italicButton','underlineButton','strikeButton'].forEach(id=>$(id).classList.remove('active'));return;}
    const style=getComputedStyle(element); const active={boldButton:Number.parseInt(style.fontWeight,10)>=600,italicButton:style.fontStyle==='italic',underlineButton:style.textDecorationLine.includes('underline'),strikeButton:style.textDecorationLine.includes('line-through')};
    Object.entries(active).forEach(([id,value])=>{ $(id).classList.toggle('active',value); $(id).setAttribute('aria-pressed',String(value)); });
  }
  function applyInlineCommand(command,value=null){
    if(!restoreSelection()){toast('Selecciona el texto que quieres modificar');return;}
    const range=getSelection().getRangeAt(0), editor=$('bodyInput'), walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT), parts=[]; let node;
    while((node=walker.nextNode()))if(range.intersectsNode(node)){ const start=node===range.startContainer?range.startOffset:0; const end=node===range.endContainer?range.endOffset:node.data.length; if(end>start)parts.push({node,start,end}); }
    const wrappers=[];
    parts.forEach(part=>{ let selectedNode=part.node; if(part.end<selectedNode.data.length)selectedNode.splitText(part.end); if(part.start>0)selectedNode=selectedNode.splitText(part.start); const span=document.createElement('span');
      if(command==='bold')span.style.fontWeight='700'; if(command==='italic')span.style.fontStyle='italic'; if(command==='underline')span.style.textDecoration='underline'; if(command==='strikeThrough')span.style.textDecoration='line-through'; if(command==='fontName')span.style.fontFamily=value;
      selectedNode.replaceWith(span); span.appendChild(selectedNode); wrappers.push(span);
    });
    if(!wrappers.length){toast('Selecciona el texto que quieres modificar');return;}
    const newRange=document.createRange(); newRange.setStartBefore(wrappers[0]); newRange.setEndAfter(wrappers.at(-1)); const selection=getSelection(); selection.removeAllRanges(); selection.addRange(newRange); savedRange=newRange.cloneRange(); saveEditor(); updateFormatButtons();
  }
  function changeSelectedCase(mode){
    if(!restoreSelection()){toast('Selecciona el texto que quieres modificar');return;}
    const range=getSelection().getRangeAt(0), editor=$('bodyInput'), walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT); const nodes=[]; let node;
    while((node=walker.nextNode()))if(range.intersectsNode(node))nodes.push(node);
    let capitalize=true;
    nodes.forEach(textNode=>{ const start=textNode===range.startContainer?range.startOffset:0; const end=textNode===range.endContainer?range.endOffset:textNode.data.length; const selected=textNode.data.slice(start,end); let replacement;
      if(mode==='upper')replacement=selected.toLocaleUpperCase('es');
      else if(mode==='lower')replacement=selected.toLocaleLowerCase('es');
      else { replacement=''; for(const character of selected.toLocaleLowerCase('es')){ if(capitalize&&/\p{L}/u.test(character)){replacement+=character.toLocaleUpperCase('es');capitalize=false;}else replacement+=character; if(/[.!?]/.test(character))capitalize=true; } }
      textNode.data=textNode.data.slice(0,start)+replacement+textNode.data.slice(end);
    });
    savedRange=range.cloneRange(); saveEditor(); updateWordCount(); updateFormatButtons();
  }

  function renderLibrary() {
    const q=$('searchInput').value.trim().toLocaleLowerCase('es');
    const items=library.filter(s => (s.title+' '+s.body).toLocaleLowerCase('es').includes(q)).sort((a,b)=>b.updated-a.updated);
    $('scriptGrid').innerHTML=items.map(s=>`<button class="script-card" data-id="${s.id}"><h2>${escapeHTML(s.title||'Sin título')}</h2><p>${escapeHTML(s.body||'Discurso vacío')}</p><time>${formatDate(s.updated)}</time></button>`).join('');
    $('emptyState').hidden=library.length!==0 || q!=='';
    $('scriptGrid').hidden=library.length===0 && q==='';
    document.querySelectorAll('.script-card').forEach(card => card.addEventListener('click',()=>openEditor(card.dataset.id)));
  }
  function createScript(title='Sin título',body='') { const item={id:crypto.randomUUID?.()||String(Date.now()),title,body,html:'',style:{...DEFAULT_STYLE},updated:Date.now()}; library.unshift(item); saveLibrary(); openEditor(item.id); }
  function openEditor(id) { activeId=id; const s=current(); if(!s)return; $('titleInput').value=s.title; $('bodyInput').innerHTML=speechHTML(s); savedRange=null; $('fontFamilySelect').value='system'; updateFormatButtons(); updateWordCount(); showScreen('editorView'); }
  function editorText(){ return $('bodyInput').innerText.replace(/\u00a0/g,' '); }
  function saveEditor() { const s=current(); if(!s)return; s.title=$('titleInput').value.trim()||'Sin título'; s.body=editorText(); s.html=sanitizeHTML($('bodyInput').innerHTML); s.updated=Date.now(); saveLibrary(); }
  function updateWordCount(){ const text=editorText().trim(); const n=text?text.split(/\s+/).length:0; $('wordCount').textContent=`${n} ${n===1?'palabra':'palabras'}`; $('playButton').disabled=!text; }
  function leaveEditor(){ saveEditor(); renderLibrary(); showScreen('libraryView'); }
  function openPrompter(){ saveEditor(); const s=current(); if(!s?.body.trim())return; $('prompterTitle').textContent=s.title; $('prompterText').innerHTML=speechHTML(s); showScreen('prompterView'); applySettings(); resetPrompter(); }
  function applySettings(){
    document.documentElement.style.setProperty('--prompt-font',settings.font+'px'); document.documentElement.style.setProperty('--prompt-margin',settings.margin+'vw'); document.documentElement.style.setProperty('--prompt-color',settings.textColor);
    $('speedSlider').value=settings.speed; updateSpeedDisplay(); $('fontSlider').value=settings.font; updateRangeProgress($('fontSlider')); $('fontOutput').value=settings.font; $('marginSlider').value=settings.margin; updateRangeProgress($('marginSlider')); $('marginOutput').value=settings.margin+'%'; $('textColorInput').value=settings.textColor; $('countdownSelect').value=String(settings.countdown); $('cueToggle').checked=settings.cue; $('autoHideToggle').checked=settings.autoHide;
    const text=$('prompterText'); text.style.fontFamily=FONT_STACKS.system; text.style.fontWeight='500'; text.style.fontStyle='normal'; text.style.textDecoration='none';
    $('scriptTransform').className='script-transform'+(settings.mirrorH?' mirrored-h':'')+(settings.mirrorV?' mirrored-v':'');
    $('mirrorHButton').classList.toggle('active',settings.mirrorH); $('mirrorVButton').classList.toggle('active',settings.mirrorV);
    $('cue').hidden=!settings.cue; $('cue').classList.toggle('right',settings.mirrorH);
    if(!$('prompterView').hidden&&!scrolling)positionFirstLine();
  }
  function setPlayState(playing){ $('playIcon').src=playing?'icons/ui/pause-fill.svg':'icons/ui/play-fill.svg'; $('startButton').setAttribute('aria-label',playing?'Pausar':'Iniciar'); }
  function positionFirstLine(){ const viewport=$('scrollViewport'), text=$('prompterText'), controls=$('controls'); const lineHeight=parseFloat(getComputedStyle(text).lineHeight)||settings.font*1.28; const controlsHeight=controls.getBoundingClientRect().height; text.style.paddingTop=Math.max(100,viewport.clientHeight-controlsHeight-lineHeight-28)+'px'; }
  function resetPrompter(){ stopScroll(); countdownActive=false; clearInterval(countdownTimer); $('countdownOverlay').hidden=true; $('controls').classList.remove('hidden'); positionFirstLine(); scrollPosition=0; $('scrollViewport').scrollTop=0; setPlayState(false); }
  function stopScroll(){ scrolling=false; cancelAnimationFrame(raf); raf=0; lastFrame=0; setPlayState(false); releaseWakeLock(); }
  function startCountdown(){
    if(scrolling){stopScroll();return;} requestWakeLock(); let remaining=Number(settings.countdown);
    if(remaining<=0){beginScroll();return;} const overlay=$('countdownOverlay'); overlay.hidden=false;
    countdownActive=true;
    const draw=()=>{ $('countdownNumber').textContent=remaining; const warn=remaining<=3; overlay.classList.toggle('warning',warn); $('countdownMessage').textContent=warn?'MANTÉNGASE QUIETO':''; };
    draw(); clearInterval(countdownTimer); countdownTimer=setInterval(()=>{remaining--; if(remaining<=0){clearInterval(countdownTimer);countdownActive=false;overlay.hidden=true;overlay.classList.remove('warning');beginScroll();}else draw();},1000);
  }
  function beginScroll(){ scrolling=true; scrollPosition=$('scrollViewport').scrollTop; setPlayState(true); if(settings.autoHide)$('controls').classList.add('hidden'); requestWakeLock(); lastFrame=performance.now(); raf=requestAnimationFrame(step); }
  function scrollRate(){ const lineHeight=parseFloat(getComputedStyle($('prompterText')).lineHeight)||settings.font*1.28; return lineHeight*linesPerSecond(); }
  function step(now){ if(!scrolling)return; const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;const viewport=$('scrollViewport');scrollPosition+=scrollRate()*dt;viewport.scrollTop=scrollPosition;if(viewport.scrollTop+viewport.clientHeight>=viewport.scrollHeight-2){stopScroll();$('controls').classList.remove('hidden');return;}raf=requestAnimationFrame(step); }
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
  async function restoreBackup(file){ try{const data=JSON.parse(await file.text());if(!Array.isArray(data.scripts))throw 0;library=data.scripts.map(s=>({id:String(s.id||Date.now()+Math.random()),title:String(s.title||'Sin título'),body:String(s.body||''),html:typeof s.html==='string'?sanitizeHTML(s.html):'',style:{...DEFAULT_STYLE,...(s.style||{})},updated:Number(s.updated)||Date.now()}));saveLibrary();renderLibrary();toast('Biblioteca restaurada');}catch{toast('El respaldo no es válido');} }
  async function importText(file){ const body=await file.text(); createScript(file.name.replace(/\.[^.]+$/,''),body); }

  $('newButton').onclick=$('emptyNewButton').onclick=()=>createScript(); $('searchInput').oninput=renderLibrary; $('editorBack').onclick=leaveEditor;
  $('titleInput').oninput=saveEditor; $('bodyInput').oninput=()=>{saveEditor();updateWordCount();}; $('playButton').onclick=openPrompter;
  [['boldButton','bold'],['italicButton','italic'],['underlineButton','underline'],['strikeButton','strikeThrough']].forEach(([id,command])=>{ $(id).addEventListener('pointerdown',event=>event.preventDefault()); $(id).onclick=()=>applyInlineCommand(command); });
  $('fontFamilySelect').onchange=e=>{const faces={system:'-apple-system',avenir:'Avenir Next',georgia:'Georgia',helvetica:'Helvetica Neue',menlo:'Menlo'};applyInlineCommand('fontName',faces[e.target.value]||faces.system);};
  $('caseSelect').onchange=e=>{if(e.target.value)changeSelectedCase(e.target.value);e.target.value='';};
  document.addEventListener('selectionchange',rememberSelection);
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
  window.addEventListener('resize',()=>{if(!$('prompterView').hidden&&!scrolling){positionFirstLine();$('scrollViewport').scrollTop=0;}});
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
  applySettings();renderLibrary();
})();
