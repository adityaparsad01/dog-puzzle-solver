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
    @media(max-width:600px){
      .crop-wrap{max-height:58vh;min-height:0;overflow:hidden}
      .crop-wrap canvas{width:auto!important;max-width:100%!important;max-height:58vh!important;height:auto!important}
      .crop-actions{margin-top:12px}
      .crop-actions button{padding:11px 12px;font-size:14px}
      .crop-toast{bottom:16px;font-size:13px}
    }
  `;
  document.head.appendChild(style);

  const input=$('imageInput'), preview=$('scanPreview');
  let img=null, crop=null, drag=null;

  function showToast(message,duration=3000){
    let toast=document.querySelector('.crop-toast');
    if(!toast){
      toast=document.createElement('div');
      toast.className='crop-toast';
      document.body.appendChild(toast);
    }
    toast.textContent=message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer=setTimeout(()=>toast.classList.remove('show'),duration);
  }

  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function getCanvas(){return $('cropCanvas')}

  function draw(){
    const c=getCanvas(); if(!c||!img||!crop)return;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    ctx.drawImage(img,0,0,c.width,c.height);

    ctx.fillStyle='rgba(0,0,0,.50)';
    ctx.fillRect(0,0,c.width,crop.y);
    ctx.fillRect(0,crop.y,crop.x,crop.h);
    ctx.fillRect(crop.x+crop.w,crop.y,c.width-crop.x-crop.w,crop.h);
    ctx.fillRect(0,crop.y+crop.h,c.width,c.height-crop.y-crop.h);

    ctx.strokeStyle='#fff';
    ctx.lineWidth=Math.max(3,c.width/260);
    ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);

    const hs=Math.max(22,c.width/22);
    const pts=[[crop.x,crop.y],[crop.x+crop.w,crop.y],[crop.x,crop.y+crop.h],[crop.x+crop.w,crop.y+crop.h]];
    for(const [x,y] of pts){
      ctx.beginPath();ctx.arc(x,y,hs/2,0,Math.PI*2);
      ctx.fillStyle='#2563eb';ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
    }
  }

  function initialCrop(c){
    const pad=Math.round(Math.min(c.width,c.height)*.10);
    crop={x:pad,y:pad,w:c.width-pad*2,h:c.height-pad*2};
  }

  function point(e){
    const c=getCanvas(),r=c.getBoundingClientRect();
    return {x:(e.clientX-r.left)*(c.width/r.width),y:(e.clientY-r.top)*(c.height/r.height)};
  }

  function hit(p){
    const c=getCanvas();
    const hs=Math.max(35,c.width*.065);
    const pts=[[crop.x,crop.y,'nw'],[crop.x+crop.w,crop.y,'ne'],[crop.x,crop.y+crop.h,'sw'],[crop.x+crop.w,crop.y+crop.h,'se']];
    for(const [x,y,k] of pts)if(Math.hypot(p.x-x,p.y-y)<=hs)return k;
    if(p.x>=crop.x&&p.x<=crop.x+crop.w&&p.y>=crop.y&&p.y<=crop.y+crop.h)return 'move';
    return null;
  }

  function pointerDown(e){
    e.preventDefault();
    const p=point(e),type=hit(p);if(!type)return;
    const c=getCanvas();try{c.setPointerCapture(e.pointerId)}catch(_){ }
    drag={type,sx:p.x,sy:p.y,orig:{...crop}};
  }

  function pointerMove(e){
    if(!drag)return;e.preventDefault();
    const c=getCanvas(),p=point(e),o=drag.orig,MIN=Math.max(60,Math.min(c.width,c.height)*.12);
    let x=o.x,y=o.y,w=o.w,h=o.h,dx=p.x-drag.sx,dy=p.y-drag.sy;
    if(drag.type==='move'){x=clamp(o.x+dx,0,c.width-o.w);y=clamp(o.y+dy,0,c.height-o.h)}
    else if(drag.type==='nw'){x=clamp(o.x+dx,0,o.x+o.w-MIN);y=clamp(o.y+dy,0,o.y+o.h-MIN);w=o.x+o.w-x;h=o.y+o.h-y}
    else if(drag.type==='ne'){y=clamp(o.y+dy,0,o.y+o.h-MIN);w=clamp(o.w+dx,MIN,c.width-o.x);h=o.y+o.h-y}
    else if(drag.type==='sw'){x=clamp(o.x+dx,0,o.x+o.w-MIN);w=o.x+o.w-x;h=clamp(o.h+dy,MIN,c.height-o.y)}
    else if(drag.type==='se'){w=clamp(o.w+dx,MIN,c.width-o.x);h=clamp(o.h+dy,MIN,c.height-o.y)}
    crop={x,y,w,h};draw();
  }

  function pointerUp(e){if(e){try{getCanvas().releasePointerCapture(e.pointerId)}catch(_){ }}drag=null}

  function showCrop(image){
    img=image;
    const c=$('previewCanvas');
    const maxW=Math.min(1100,window.innerWidth*0.92),maxH=Math.min(620,window.innerHeight*0.58);
    const scale=Math.min(1,maxW/img.width,maxH/img.height);
    c.width=Math.max(1,Math.round(img.width*scale));
    c.height=Math.max(1,Math.round(img.height*scale));
    c.hidden=true;

    const old=preview.querySelector('.crop-wrap');if(old)old.remove();
    const wrap=document.createElement('div');wrap.className='crop-wrap';
    const cc=document.createElement('canvas');
    cc.id='cropCanvas';cc.width=c.width;cc.height=c.height;
    cc.style.width=c.width+'px';cc.style.height=c.height+'px';
    wrap.appendChild(cc);preview.insertBefore(wrap,preview.firstChild);

    let actions=preview.querySelector('.crop-actions');if(actions)actions.remove();
    actions=document.createElement('div');actions.className='crop-actions';
    actions.innerHTML='<button id="resetCrop">↺ Reset</button><button id="cropDetect" class="crop-primary">✂️ Crop & Detect</button><button id="cancelCrop">Cancel</button>';
    preview.appendChild(actions);

    initialCrop(cc);
    draw();
    cc.addEventListener('pointerdown',pointerDown,{passive:false});
    cc.addEventListener('pointermove',pointerMove,{passive:false});
    cc.addEventListener('pointerup',pointerUp,{passive:false});
    cc.addEventListener('pointercancel',pointerUp,{passive:false});
    cc.addEventListener('lostpointercapture',()=>{drag=null});
    $('resetCrop').onclick=()=>{initialCrop(cc);draw();showToast('↺ Crop reset.')};
    $('cancelCrop').onclick=()=>{preview.hidden=true};
    $('cropDetect').onclick=()=>cropAndDetect();
    preview.hidden=false;
    showToast('Adjust the blue corners around the puzzle, then tap Crop & Detect.',3500);
  }

  function cropAndDetect(){
    if(!img||!crop)return;
    const src=$('cropCanvas'),out=$('previewCanvas'),ctx=out.getContext('2d');
    const scaleX=img.width/src.width,scaleY=img.height/src.height;
    const sx=crop.x*scaleX,sy=crop.y*scaleY;
    const sw=crop.w*scaleX,sh=crop.h*scaleY;
    // Use the original image pixels for detection. The display canvas is
    // intentionally downscaled on mobile, which can blur the small gaps
    // between adjacent puzzle cells and merge components.
    out.width=Math.max(1,Math.round(sw));out.height=Math.max(1,Math.round(sh));
    ctx.clearRect(0,0,out.width,out.height);
    ctx.drawImage(img,sx,sy,sw,sh,0,0,out.width,out.height);
    out.hidden=true;
    const wrap=preview.querySelector('.crop-wrap');if(wrap)wrap.remove();
    const actions=preview.querySelector('.crop-actions');if(actions)actions.remove();
    preview.hidden=true;
    $('status').textContent='Cropped screenshot ready. Detecting grid...';
    showToast('🔍 Detecting puzzle grid...',1800);
    if(typeof window.detectBoard==='function')window.detectBoard();
  }

  input.onchange=e=>{
    const file=e.target.files?.[0];if(!file)return;
    $('scanName').textContent=file.name;
    const reader=new FileReader();
    reader.onload=()=>{const image=new Image();image.onload=()=>showCrop(image);image.src=reader.result};
    reader.readAsDataURL(file);
  };
})();
