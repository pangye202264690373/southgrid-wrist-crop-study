'use strict';
const $ = id => document.getElementById(id);
const data = window.STUDY;
if (!data?.streams?.length) throw new Error('处理数据尚未生成，请等待 data.js 完成。');
const video = $('atlas');
const definitions = [
  ['stretch','直接缩放','640×480 → 224×224；宽高比例改变','原视野 100%'],
  ['letterbox','等比缩放 + 补边','640×480 → 224×168；上下补黑边','原视野 100%'],
  ['center','中心 224 裁切','224×224 原像素；不做缩放','原视野 16.3%'],
  ['offset','固定偏移 224 裁切','224×224 原像素；不跟踪、不缩放','原视野 16.3%'],
  ['context','中心 448 → 224','更大裁切区域，再缩小至 224×224','原视野 65.3%']
];
let current, index=0, generation=0, still=null, stillIndex=null, displayedMediaTime=0;
const sessions=[...new Map(data.streams.map(s=>[s.session,s])).values()].sort((a,b)=>b.task.localeCompare(a.task)||a.session.localeCompare(b.session));
const name = task => '验电笔点位操作';
const storageKey='southgrid-wrist-review-v1';
let reviews={};try{reviews=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{}
const fmt = seconds => {const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
function download(blob, filename){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);}
function findIndex(time){let lo=0,hi=current.timestamps.length;while(lo<hi){const mid=(lo+hi)>>1;if(current.timestamps[mid]<=time+0.0001)lo=mid+1;else hi=mid;}return Math.max(0,lo-1);}
function updateStatus(i){index=i;$('timeline').value=i;$('time').textContent=`${fmt(current.timestamps[i])} / ${fmt(current.last_frame_time)}`;$('frame-count').textContent=`帧 ${i+1} / ${current.frames}`;}
function draw(src){
  if(!current||!src)return;
  const source=$('source'),ctx=source.getContext('2d');ctx.drawImage(src,0,0,640,480,0,0,640,480);
  $('head').getContext('2d').drawImage(src,640,0,640,480,0,0,640,480);
  if($('boxes').checked){
    for(const [key,color,label] of [['context','#bca4ff','448'],['center','#f4bf54','中心 224'],['offset','#59e3bb','偏移 224']]){
      const [x,y,w,h]=current.boxes[key];ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(key==='context'?[8,5]:[]);ctx.strokeRect(x+.5,y+.5,w,h);ctx.setLineDash([]);
      ctx.font='13px sans-serif';const labelW=ctx.measureText(label).width+12;
      ctx.fillStyle=color;ctx.fillRect(x,y+2,labelW,21);ctx.fillStyle='#142322';ctx.fillText(label,x+6,y+17);
    }
  }
  definitions.forEach(([id],k)=>{$('canvas-'+id).getContext('2d').drawImage(src,k*224,480,224,224,0,0,224,224);});
}
function renderVideo(time){if(still)return;if(video.readyState>=2){draw(video);displayedMediaTime=time??video.currentTime;updateStatus(findIndex(displayedMediaTime));}}
function frameLoop(_,meta){renderVideo(meta.mediaTime);video.requestVideoFrameCallback(frameLoop);}
if('requestVideoFrameCallback' in video)video.requestVideoFrameCallback(frameLoop);
else video.addEventListener('timeupdate',()=>renderVideo(video.currentTime));
video.addEventListener('seeked',()=>{if(!still)renderVideo(video.currentTime);});
video.addEventListener('play',()=>{$('play').textContent='Ⅱ 暂停';});
video.addEventListener('pause',()=>{$('play').textContent='▶ 播放';});
video.addEventListener('ended',()=>{$('play').textContent='↻ 重播';});
video.addEventListener('error',()=>{$('mode').textContent='视频无法加载。请保留 assets 文件夹，或使用附带的本地启动器打开。';$('play').disabled=true;});
function clearStill(){still=null;stillIndex=null;$('mode').textContent='网页压缩预览 · CRF 22 · 精细比较请选无损关键帧';document.querySelectorAll('#keyframes .active').forEach(b=>b.classList.remove('active'));}
function seek(i){generation++;video.pause();clearStill();i=Math.max(0,Math.min(current.frames-1,i));updateStatus(i);video.currentTime=current.timestamps[i]+0.0005;}
async function showStill(sample){
  video.pause();const request=++generation;const image=new Image();image.src=sample.image;
  try{await image.decode();if(request!==generation)return;still=image;stillIndex=sample.index;video.currentTime=sample.time+0.0005;draw(still);updateStatus(sample.index);$('mode').textContent='无损 PNG 关键帧 · 编码前 RGB · 所有视图同帧';document.querySelectorAll('#keyframes button').forEach(b=>b.classList.toggle('active',Number(b.dataset.index)===sample.index));}catch{$('mode').textContent='无损关键帧加载失败，请检查 assets 文件夹。';}
}
async function togglePlay(){
  if(!video.paused){video.pause();return;}
  generation++;if(still){const target=stillIndex;clearStill();video.currentTime=current.timestamps[target]+.0005;}
  if(video.ended||video.currentTime>=current.last_frame_time)video.currentTime=0;
  try{await video.play();}catch{$('mode').textContent='播放未启动，请再次点击播放。';}
}
function saveReview(){
  reviews[current.key]={task:current.task,session:current.session,camera:current.camera,coverage:$('coverage').value,preferred:$('preferred').value,notes:$('notes').value,observed_frame:index,observed_time_s:current.timestamps[index],updated_at:new Date().toISOString()};
  try{localStorage.setItem(storageKey,JSON.stringify(reviews));$('saved-status').textContent='已保存在此浏览器';}catch{$('saved-status').textContent='浏览器不允许保存，请导出记录';}
}
function loadReview(){const r=reviews[current.key]||{};for(const id of ['coverage','preferred','notes'])$(id).value=r[id]||'';$('saved-status').textContent=r.updated_at?'已载入此视角的观察记录':'未填写';}
function select(session,cam='hand_right'){
  generation++;video.pause();clearStill();$('play').textContent='▶ 播放';current=data.streams.find(s=>s.session===session&&s.camera===cam);updateStatus(0);$('play').disabled=true;
  document.querySelectorAll('.episode').forEach(b=>b.classList.toggle('active',b.dataset.session===session));
  document.querySelectorAll('#cameras button').forEach(b=>b.classList.toggle('active',b.dataset.cam===cam));
  const isRight=cam==='hand_right';
  $('record-title').textContent=name(current.task)+' / '+(isRight?'右腕视角':'左腕视角');
  $('record-meta').textContent=`${session} · ${current.frames.toLocaleString()} 帧 · ${current.last_frame_time.toFixed(2)} 秒 · 640×480 → 224×224`;
  $('scene-note').textContent=isRight?'先看拿取和归位，再检查上方端子附近的笔尖；中心裁切可能留下笔身，却裁掉笔尖。':'侧面视角能补充笔尖与端子的相对位置。请检查遮挡、反光，以及动作中目标是否离开固定裁切框。';
  $('finding-title').textContent=isRight?'笔尖不一定在中心':'侧面视角补充接触位置';
  $('finding').textContent=isRight?'预览关键帧中，笔尖和端子位于画面上方。中心裁切可能截掉接触区域；向上偏移能保留它，但拿取和归位时仍需检查覆盖。':'中心与偏移框都可能容纳侧面接触区域。比较是否能同时看见笔尖、目标端子和两者之间的间隙。';
  if(current.session==='20261020_195440'&&isRight){
    $('finding-title').textContent='固定偏移也有边界';
    $('finding').textContent='这条录制的操作位置较低。示例关键帧中，笔尖接近向上偏移框的下边缘，中心裁切也能保留操作区域。请检查完整过程，比较哪种范围更稳妥。';
    $('scene-note').textContent='注意约 48.7 秒：不要只看局部像素是否更大，也要检查笔尖与端子离裁切边界还有多少余量。';
  }
  $('roi-coord').textContent=`(${current.boxes.offset[0]}, ${current.boxes.offset[1]})`;
  $('timeline').max=current.frames-1;
  $('keyframes').replaceChildren();
  for(const sample of current.samples){const b=document.createElement('button');b.textContent=sample.time.toFixed(1)+'s';b.dataset.index=sample.index;b.addEventListener('click',()=>showStill(sample));$('keyframes').append(b);}
  definitions.forEach(([id])=>{$('download-'+id).href=current.videos[id];$('download-'+id).download=`${current.key}_${id}_224.mp4`;});
  const a=current.audit;
  $('audit').replaceChildren();
  for(const line of [
    `来源：${current.source_path}`,
    `当前腕部：${a.frames} 帧全部保留；缺失引用文件 ${a.missing_files}；JPEG 解码失败 ${a.decode_failures}。`,
    `源相机计数器跳号 ${a.source_counter_gaps}；重复源帧编号 ${a.repeated_source_ids}；最长相邻帧间隔 ${a.max_interval_ms.toFixed(2)} ms。已有采集间隙保持原样，不插帧填补。`,
    `头部匹配最大时间差 ${current.head_max_delta_ms.toFixed(2)} ms；五种腕部输出采用同一原始帧与同一时间戳。`,
    `输出校验：5 个 224×224 视频及 1 个同步预览视频均逐帧解码，帧数与原始腕部记录一致。`,
    `“完整”指源录制中全部已记录图像从头到尾保留，并非断言采集阶段从未掉帧。`,
    `四条录制均为任务 3；本网页仅保留任务与录制编号，绝对服务器路径已移除。`
  ]){const p=document.createElement('p');p.textContent=line;$('audit').append(p);}
  loadReview();
  video.src=current.atlas;video.playbackRate=Number($('rate').value);video.load();
  const key=current.key;
  video.onloadeddata=()=>{if(current.key!==key)return;$('play').disabled=false;showStill(current.samples[current.default_sample_index??4]);};
}
sessions.forEach((s,i)=>{const b=document.createElement('button');b.className='episode';b.dataset.session=s.session;b.innerHTML=`<span class="num">0${i+1}</span><span><b>${name(s.task)}</b><small>${s.session} · ${s.last_frame_time.toFixed(1)}s</small></span>`;b.addEventListener('click',()=>select(s.session,current.camera));$('episodes').append(b);});
definitions.forEach(([id,title,desc,foot],i)=>{const card=document.createElement('article');card.className='tile';card.innerHTML=`<div class="tile-head"><b>0${i+1}</b>${title}</div><div class="tile-desc">${desc}</div><div class="tile-canvas-wrap"><canvas id="canvas-${id}" width="224" height="224" aria-label="${title}后的224乘224画面"></canvas></div><div class="tile-foot"><span>${foot}</span><a id="download-${id}" download>下载 MP4 ↗</a></div>`;$('tiles').append(card);});
$('play').addEventListener('click',togglePlay);
$('start').addEventListener('click',()=>{generation++;clearStill();video.currentTime=0;video.play().catch(()=>{$('mode').textContent='请点击播放以开始。';});});
$('prev').addEventListener('click',()=>seek(index-1));$('next').addEventListener('click',()=>seek(index+1));
$('timeline').addEventListener('input',e=>{generation++;seek(Number(e.target.value));});
$('rate').addEventListener('change',e=>video.playbackRate=Number(e.target.value));
$('boxes').addEventListener('change',()=>draw(still||video));
document.querySelectorAll('#cameras button').forEach(b=>b.addEventListener('click',()=>select(current.session,b.dataset.cam)));
document.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>{document.documentElement.style.setProperty('--zoom',b.dataset.zoom);document.querySelectorAll('[data-zoom]').forEach(x=>x.classList.toggle('active',x===b));}));
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();togglePlay();}if(e.code==='ArrowLeft'){e.preventDefault();seek(index-1);}if(e.code==='ArrowRight'){e.preventDefault();seek(index+1);}});
for(const id of ['coverage','preferred','notes'])$(id).addEventListener('input',saveReview);
$('export-review').addEventListener('click',()=>{saveReview();download(new Blob([JSON.stringify({study:'wrist_crop_study',reviews},null,2)],{type:'application/json'}),'腕部裁切-观察记录.json');});
$('save-png').addEventListener('click',()=>{
  const canvas=document.createElement('canvas');canvas.width=1120;canvas.height=300;const ctx=canvas.getContext('2d');ctx.fillStyle='#142322';ctx.fillRect(0,0,1120,300);ctx.fillStyle='#e9f1ec';ctx.font='13px sans-serif';ctx.fillText(`${current.session} / ${current.camera} / ${fmt(current.timestamps[index])} / ${still?'编码前无损关键帧':'视频解码帧'}`,12,21);
  definitions.forEach(([id,title],i)=>{ctx.fillText(title,i*224+10,50);ctx.drawImage($('canvas-'+id),i*224,66);});canvas.toBlob(blob=>download(blob,`${current.key}_frame_${index}.png`));
});
select(sessions[0].session);
