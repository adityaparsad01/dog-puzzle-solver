// Interactive screenshot cropper for mobile and desktop.
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .crop-wrap{position:relative;width:100%;max-width:700px;margin:12px auto;background:#2b2528;border-radius:12px;overflow:hidden;touch-action:none;user-select:none}
    .crop-wrap canvas{display:block;width:100%;max-height:520px;object-fit:contain;margin:0;background:#2b2528}
    .crop-help{text-align:center;font-size:13px;color:#765b68;margin:8px 0}
    .crop-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px}
    .crop-actions button{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;background:#8f4960;color:white}
    .crop-actions .crop-primary{background:#2563eb}
  `;
  document.head.appendChild(style);

  const input=$('imageInput'), preview=$('scanPreview');
  let img=null, crop=null, drag=null;

  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function getCanvas(){return $('cropCanvas')}

  function draw(){
    const c=getCanvas(); if(!c||!img||!crop)return;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    ctx.drawImage(img,0,0,c.width,c.height);
    ctx.fillStyle='rgba(0,0,0,.48)';
    ctx.fillRect(0,0,c.width,crop.y);
    ctx.fillRect(0,crop.y,crop.x,crop.h);
    ctx.fillRect(crop.x+crop.w,crop.y,c.width-crop.x-crop.w,crop.h);
    ctx.fillRect(0,crop.y+crop.h,c.width,c.height-crop.y-crop.h);
    ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(3,c.width/260);ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);
    const hs=Math.max(9,c.width/45);ctx.fillStyle='#2563eb';
    [[crop.x,crop.y],[crop.x+crop.w,crop.y],[crop.x,crop.y+crop.h],[crop.x+crop.w,crop.y+crop.h]].forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,hs/2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke()});
  }

  function initialCrop(c){
    const pad=Math.round(Math.min(c.width,c.height)*.12);
    crop={x:pad,y:pad,w:c.width-pad*2,h:c.height-pad*2};
  }

  function point(e){
    const c=getCanvas(),r=c.getBoundingClientRect();
    return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};
  }
  function hit(p){
    const hs=Math.max(24,getCanvas().width/18);
    const pts=[[crop.x,crop.y,'nw'],[crop.x+crop.w,crop.y,'ne'],[crop.x,crop.y+crop.h,'sw'],[crop.x+crop.w,crop.y+crop.h,'se']];
    for(const [x,y,k] of pts)if(Math.hypot(p.x-x,p.y-y)<hs)return k;
    if(p.x>=crop.x&&p.x<=crop.x+crop.w&&p.y>=crop.y&&p.y<=crop.y+crop.h)return 'move';
    return null;
  }

  function pointerDown(e){
    e.preventDefault();const p=point(e),type=hit(p);if(!type)return;
    getCanvas().setPointerCapture?.(e.pointerId);
    drag={type,sx:p.x,sy:p.y,orig:{...crop}};
  }
  function pointerMove(e){
    if(!drag)return;e.preventDefault();const p=point(e),o=drag.orig,MIN=30;
    let x=o.x,y=o.y,w=o.w,h=o.h,dx=p.x-drag.sx,dy=p.y-drag.sy;
    if(drag.type==='move'){x=clamp(o.x+dx,0,getCanvas().width-o.w);y=clamp(o.y+dy,0,getCanvas().height-o.h)}
    else if(drag.type==='nw'){x=clamp(o.x+dx,0,o.x+o.w-MIN);y=clamp(o.y+dy,0,o.y+o.h-MIN);w=o.x+o.w-x;h=o.y+o.h-y}
    else if(drag.type==='ne'){y=clamp(o.y+dy,0,o.y+o.h-MIN);w=clamp(o.w+dx,MIN,getCanvas().width-o.x);h=o.y+o.h-y}
    else if(drag.type==='sw'){x=clamp(o.x+dx,0,o.x+o.w-MIN);w=o.x+o.w-x;h=clamp(o.h+dy,MIN,getCanvas().height-o.y)}
    else if(drag.type==='se'){w=clamp(o.w+dx,MIN,getCanvas().width-o.x);h=clamp(o.h+dy,MIN,getCanvas().height-o.y)}
    crop={x,y,w,h};draw();
  }
  function pointerUp(){drag=null}

  function showCrop(image){
    img=image;
    const max=1400,scale=Math.min(1,max/img.width),c=$('previewCanvas');
    c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
    // Keep the existing detector canvas available but hide it during cropping.
    c.hidden=true;
    const old=preview.querySelector('.crop-wrap');if(old)old.remove();
    const wrap=document.createElement('div');wrap.className='crop-wrap';
    const cc=document.createElement('canvas');cc.id='cropCanvas';cc.width=c.width;cc.height=c.height;
    wrap.appendChild(cc);preview.insertBefore(wrap,preview.firstChild);
    const help=document.createElement('div');help.className='crop-help';help.textContent='Drag inside to move. Drag the blue corners to crop only the puzzle grid.';preview.insertBefore(help,wrap.nextSibling);
    let actions=preview.querySelector('.crop-actions');
    if(actions)actions.remove();
    actions=document.createElement('div');actions.className='crop-actions';
    actions.innerHTML='<button id="resetCrop">↺ Reset Crop</button><button id="cropDetect" class="crop-primary">✂️ Crop & Detect</button><button id="cancelCrop">Cancel</button>';
    preview.appendChild(actions);
    initialCrop(cc);draw();
    cc.addEventListener('pointerdown',pointerDown);cc.addEventListener('pointermove',pointerMove);cc.addEventListener('pointerup',pointerUp);cc.addEventListener('pointercancel',pointerUp);
    $('resetCrop').onclick=()=>{initialCrop(cc);draw()};
    $('cancelCrop').onclick=()=>{preview.hidden=true};
    $('cropDetect').onclick=()=>cropAndDetect();
    preview.hidden=false;
    $('status').textContent='Screenshot loaded. Crop the puzzle grid, then tap Crop & Detect.';
  }

  function cropAndDetect(){
    if(!img||!crop)return;
    const src=$('cropCanvas'),out=$('previewCanvas'),ctx=out.getContext('2d');
    const sx=crop.x,sy=crop.y,sw=crop.w,sh=crop.h;
    out.width=Math.max(1,Math.round(sw));out.height=Math.max(1,Math.round(sh));
    ctx.clearRect(0,0,out.width,out.height);
    ctx.drawImage(src,sx,sy,sw,sh,0,0,out.width,out.height);
    out.hidden=false;
    const wrap=preview.querySelector('.crop-wrap');if(wrap)wrap.remove();
    const help=preview.querySelector('.crop-help');if(help)help.remove();
    const actions=preview.querySelector('.crop-actions');if(actions)actions.remove();
    $('status').textContent='Cropped screenshot ready. Detecting grid...';
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
