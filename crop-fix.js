// Mobile-friendly screenshot cropper. User selects the puzzle grid manually, then detection runs once.
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .crop-wrap{position:relative;width:100%;max-width:700px;margin:12px auto 0;background:transparent;border-radius:12px;overflow:hidden;display:flex;justify-content:center;align-items:center;touch-action:none;user-select:none;-webkit-user-select:none}
    .crop-wrap canvas{display:block;margin:auto;background:transparent;touch-action:none;user-select:none;-webkit-user-select:none;max-width:100%}
    .crop-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px}
    .crop-actions button{border:0;border-radius:10px;padding:11px 15px;font-weight:700;cursor:pointer;background:#8f4960;color:white;min-height:44px;touch-action:manipulation}
    .crop-actions .crop-primary{background:#2563eb}
    .crop-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,16px);z-index:9999;max-width:min(92vw,520px);padding:10px 14px;border-radius:12px;background:#563747;color:white;font-size:14px;font-weight:700;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.22);opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease}
    .crop-toast.show{opacity:1;transform:translate(-50%,0)}
    @media(max-width:600px){.crop-wrap{max-height:58vh;min-height:0;overflow:hidden}.crop-wrap canvas{width:auto!important;max-width:100%!important;max-height:58vh!important;height:auto!important}.crop-actions{margin-top:12px}.crop-actions button{padding:11px 12px;font-size:14px}.crop-toast{bottom:16px;font-size:13px}}
  `;
  document.head.appendChild(style);

  const input=$('imageInput'), preview=$('scanPreview');
  let img=null, crop=null, drag=null;

  function showToast(message,duration=3000){
    let toast=document.querySelector('.crop-toast');
    if(!toast){toast=document.createElement('div');toast.className='crop-toast';document.body.appendChild(toast)}
    toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),duration);
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function getCanvas(){return $('cropCanvas')}

  function draw(){
    const c=getCanvas();if(!c||!img||!crop)return;
    const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
    ctx.fillStyle='rgba(0,0,0,.50)';
    ctx.fillRect(0,0,c.width,crop.y);ctx.fillRect(0,crop.y,crop.x,crop.h);ctx.fillRect(crop.x+crop.w,crop.y,c.width-crop.x-crop.w,crop.h);ctx.fillRect(0,crop.y+crop.h,c.width,c.height-crop.y-crop.h);

    // Red border marks the exact area that will be sent to the detector.
    ctx.strokeStyle='#ff2b2b';ctx.lineWidth=Math.max(4,c.width/180);ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);
    const hs=Math.max(22,c.width/22);
    const pts=[[crop.x,crop.y],[crop.x+crop.w,crop.y],[crop.x,crop.y+crop.h],[crop.x+crop.w,crop.y+crop.h]];
    for(const [x,y] of pts){ctx.beginPath();ctx.arc(x,y,hs/2,0,Math.PI*2);ctx.fillStyle='#ff2b2b';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke()}
  }

  // Detect the actual colored puzzle grid before showing the crop handles.
  // We look for a long sequence of similarly-sized horizontal color bands,
  // then use the matching vertical bands inside that row range.
  function autoDetectCrop(c){
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
    const w=c.width,h=c.height,d=ctx.getImageData(0,0,w,h).data;
    const bg=[d[0],d[1],d[2]], mask=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,r=d[i],g=d[i+1],b=d[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b);
      const sat=(mx-mn)/Math.max(mx,1),dist=Math.hypot(r-bg[0],g-bg[1],b-bg[2]);
      mask[y*w+x]=(sat>.06&&dist>28)?1:0;
    }
    const rowScore=new Int32Array(h);
    for(let y=0;y<h;y++){let s=0;for(let x=0;x<w;x++)s+=mask[y*w+x];rowScore[y]=s}
    function getRuns(values,threshold,minLen){const out=[];let s=-1;for(let i=0;i<=values.length;i++){const on=i<values.length&&values[i]>=threshold;if(on&&s<0)s=i;if(!on&&s>=0){if(i-s>=minLen)out.push([s,i-1]);s=-1}}return out}
    let rows=getRuns(rowScore,Math.max(12,Math.floor(w*.18)),5);
    let bestRows=[];
    for(let i=0;i<rows.length;i++){
      const group=[rows[i]];
      for(let j=i+1;j<rows.length;j++){
        const prev=group[group.length-1],cur=rows[j],gap=cur[0]-prev[1]-1;
        const ph=prev[1]-prev[0]+1,ch=cur[1]-cur[0]+1;
        if(gap>12||ch<ph*.45||ch>ph*1.8)break;
        group.push(cur);
      }
      if(group.length>bestRows.length)bestRows=group;
    }
    if(bestRows.length<4||bestRows.length>12)return false;
    const y0=bestRows[0][0],y1=bestRows[bestRows.length-1][1],boardH=y1-y0+1;
    const colScore=new Int32Array(w);
    for(let x=0;x<w;x++){let s=0;for(let y=y0;y<=y1;y++)s+=mask[y*w+x];colScore[x]=s}
    const cols=getRuns(colScore,Math.max(12,Math.floor(boardH*.18)),5);
    if(cols.length!==bestRows.length)return false;
    const widths=cols.map(v=>v[1]-v[0]+1),heights=bestRows.map(v=>v[1]-v[0]+1);
    const med=a=>{const q=a.slice().sort((x,y)=>x-y);return q[Math.floor(q.length/2)]};
    const mw=med(widths),mh=med(heights);
    if(widths.some(v=>Math.abs(v-mw)>mw*.45)||heights.some(v=>Math.abs(v-mh)>mh*.45))return false;
    const x0=cols[0][0],x1=cols[cols.length-1][1];
    const pad=Math.max(4,Math.round(Math.min(mw,mh)*.10));
    crop={x:clamp(x0-pad,0,w-1),y:clamp(y0-pad,0,h-1),w:clamp(x1-x0+1+pad*2,1,w),h:clamp(y1-y0+1+pad*2,1,h)};
    return true;
  }

  function initialCrop(c){
    // Prefer the actual colored puzzle grid. If it cannot be confidently found,
    // retain the small full-screenshot fallback so manual cropping still works.
    if(!autoDetectCrop(c)){
      const padX=Math.round(c.width*.025),padY=Math.round(c.height*.025);
      crop={x:padX,y:padY,w:c.width-padX*2,h:c.height-padY*2};
    }
  }
  function point(e){const c=getCanvas(),r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*(c.width/r.width),y:(e.clientY-r.top)*(c.height/r.height)}}
  function hit(p){const c=getCanvas(),hs=Math.max(35,c.width*.065),pts=[[crop.x,crop.y,'nw'],[crop.x+crop.w,crop.y,'ne'],[crop.x,crop.y+crop.h,'sw'],[crop.x+crop.w,crop.y+crop.h,'se']];for(const [x,y,k] of pts)if(Math.hypot(p.x-x,p.y-y)<=hs)return k;if(p.x>=crop.x&&p.x<=crop.x+crop.w&&p.y>=crop.y&&p.y<=crop.y+crop.h)return'move';return null}
  function pointerDown(e){e.preventDefault();const p=point(e),type=hit(p);if(!type)return;const c=getCanvas();try{c.setPointerCapture(e.pointerId)}catch(_){}drag={type,sx:p.x,sy:p.y,orig:{...crop}}}
  function pointerMove(e){if(!drag)return;e.preventDefault();const c=getCanvas(),p=point(e),o=drag.orig,MIN=Math.max(60,Math.min(c.width,c.height)*.12);let x=o.x,y=o.y,w=o.w,h=o.h,dx=p.x-drag.sx,dy=p.y-drag.sy;if(drag.type==='move'){x=clamp(o.x+dx,0,c.width-o.w);y=clamp(o.y+dy,0,c.height-o.h)}else if(drag.type==='nw'){x=clamp(o.x+dx,0,o.x+o.w-MIN);y=clamp(o.y+dy,0,o.y+o.h-MIN);w=o.x+o.w-x;h=o.y+o.h-y}else if(drag.type==='ne'){y=clamp(o.y+dy,0,o.y+o.h-MIN);w=clamp(o.w+dx,MIN,c.width-o.x);h=o.y+o.h-y}else if(drag.type==='sw'){x=clamp(o.x+dx,0,o.x+o.w-MIN);w=o.x+o.w-x;h=clamp(o.h+dy,MIN,c.height-o.y)}else if(drag.type==='se'){w=clamp(o.w+dx,MIN,c.width-o.x);h=clamp(o.h+dy,MIN,c.height-o.y)}crop={x,y,w,h};draw()}
  function pointerUp(e){if(e){try{getCanvas().releasePointerCapture(e.pointerId)}catch(_){}}drag=null}

  function showCrop(image){
    img=image;const c=$('previewCanvas'),maxW=Math.min(1100,window.innerWidth*.92),maxH=Math.min(620,window.innerHeight*.58),scale=Math.min(1,maxW/img.width,maxH/img.height);
    c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.hidden=true;
    const old=preview.querySelector('.crop-wrap');if(old)old.remove();const wrap=document.createElement('div');wrap.className='crop-wrap';const cc=document.createElement('canvas');cc.id='cropCanvas';cc.width=c.width;cc.height=c.height;cc.style.width=c.width+'px';cc.style.height=c.height+'px';wrap.appendChild(cc);preview.insertBefore(wrap,preview.firstChild);
    let actions=preview.querySelector('.crop-actions');if(actions)actions.remove();actions=document.createElement('div');actions.className='crop-actions';actions.innerHTML='<button id="resetCrop">↺ Reset</button><button id="cropDetect" class="crop-primary">✂️ Crop & Detect</button><button id="cancelCrop">Cancel</button>';preview.appendChild(actions);
    initialCrop(cc);draw();cc.addEventListener('pointerdown',pointerDown,{passive:false});cc.addEventListener('pointermove',pointerMove,{passive:false});cc.addEventListener('pointerup',pointerUp,{passive:false});cc.addEventListener('pointercancel',pointerUp,{passive:false});cc.addEventListener('lostpointercapture',()=>{drag=null});
    $('resetCrop').onclick=()=>{initialCrop(cc);draw();showToast('↺ Board detection reset.')};$('cancelCrop').onclick=()=>{preview.hidden=true};$('cropDetect').onclick=()=>cropAndDetect();preview.hidden=false;showToast('🔴 Board detected. Adjust the red corners if needed, then tap Crop & Detect.',3500)
  }

  function cropAndDetect(){
    if(!img||!crop)return;const src=$('cropCanvas'),out=$('previewCanvas'),ctx=out.getContext('2d'),scaleX=img.width/src.width,scaleY=img.height/src.height,sx=crop.x*scaleX,sy=crop.y*scaleY,sw=crop.w*scaleX,sh=crop.h*scaleY;
    out.width=Math.max(1,Math.round(sw));out.height=Math.max(1,Math.round(sh));ctx.clearRect(0,0,out.width,out.height);ctx.drawImage(img,sx,sy,sw,sh,0,0,out.width,out.height);out.hidden=true;
    const wrap=preview.querySelector('.crop-wrap');if(wrap)wrap.remove();const actions=preview.querySelector('.crop-actions');if(actions)actions.remove();preview.hidden=true;$('status').textContent='Cropped screenshot ready. Detecting grid...';showToast('🔍 Detecting puzzle grid...',1800);if(typeof window.detectBoard==='function')window.detectBoard()
  }

  input.onchange=e=>{const file=e.target.files?.[0];if(!file)return;$('scanName').textContent=file.name;const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>showCrop(image);image.src=reader.result};reader.readAsDataURL(file)};
})();
