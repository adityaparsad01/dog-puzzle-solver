// Mobile-friendly screenshot cropper with automatic outer-grid detection.
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .crop-wrap{position:relative;width:100%;max-width:700px;margin:12px auto;background:#2b2528;border-radius:12px;overflow:auto;display:flex;justify-content:center;align-items:center;touch-action:none;user-select:none;-webkit-user-select:none}
    .crop-wrap canvas{display:block;margin:auto;background:#2b2528;touch-action:none;user-select:none;-webkit-user-select:none}
    .crop-help{text-align:center;font-size:13px;color:#765b68;margin:8px 0;line-height:1.4}
    .crop-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px}
    .crop-actions button{border:0;border-radius:10px;padding:11px 15px;font-weight:700;cursor:pointer;background:#8f4960;color:white;min-height:44px;touch-action:manipulation}
    .crop-actions .crop-primary{background:#2563eb}
    @media(max-width:600px){
      .crop-wrap{max-height:62vh;min-height:260px;overflow:hidden}
      .crop-wrap canvas{max-width:none!important;max-height:none!important}
      .crop-help{font-size:12px;padding:0 8px}
      .crop-actions button{padding:11px 12px;font-size:14px}
    }
  `;
  document.head.appendChild(style);

  const input=$('imageInput'), preview=$('scanPreview');
  let img=null, crop=null, drag=null, sourceScale=1;

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

  // Find the largest square-like rectangle dominated by the puzzle's colored cells.
  // This runs before manual cropping, so the crop box opens around the main grid.
  function autoDetectOuterGrid(c){
    const ctx=c.getContext('2d',{willReadFrequently:true});
    const maxDim=700, scale=Math.max(1,Math.ceil(Math.max(c.width,c.height)/maxDim));
    const w=Math.max(1,Math.floor(c.width/scale)),h=Math.max(1,Math.floor(c.height/scale));
    const tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;
    const tctx=tmp.getContext('2d',{willReadFrequently:true});
    tctx.drawImage(c,0,0,w,h);
    const data=tctx.getImageData(0,0,w,h).data;
    const row=new Float32Array(h),col=new Float32Array(w);

    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
      const sat=mx?((mx-mn)/mx):0;
      // Puzzle cells are strongly colored; this excludes most white UI/background.
      if(sat>.16&&mx>80&&mx-mn>28){row[y]++;col[x]++;}
    }
    for(let y=0;y<h;y++)row[y]/=w;
    for(let x=0;x<w;x++)col[x]/=h;

    function bestBand(values,minFrac){
      let best=null,start=-1,sum=0;
      for(let i=0;i<=values.length;i++){
        const good=i<values.length&&values[i]>.055;
        if(good&&start<0){start=i;sum=0}
        if(good)sum+=values[i];
        if(!good&&start>=0){
          const end=i,len=end-start,avg=sum/len;
          if(len>=values.length*minFrac&&(!best||avg*len>best.avg*best.len))best={start,end,len,avg};
          start=-1;
        }
      }
      return best;
    }

    const rb=bestBand(row,.18), cb=bestBand(col,.18);
    if(!rb||!cb)return false;

    let x=cb.start*scale,y=rb.start*scale;
    let wpx=(cb.end-cb.start)*scale,hpx=(rb.end-rb.start)*scale;
    const minSide=Math.min(wpx,hpx);

    // Expand/shrink toward a square because Logic Riddle boards are square.
    const cx=x+wpx/2,cy=y+hpx/2;
    const side=Math.max(minSide,Math.min(c.width,c.height)*.18);
    x=cx-side/2;y=cy-side/2;wpx=side;hpx=side;
    const margin=Math.max(2,Math.min(c.width,c.height)*.012);
    x=clamp(x-margin,0,c.width);y=clamp(y-margin,0,c.height);
    wpx=Math.min(c.width-x,wpx+margin*2);hpx=Math.min(c.height-y,hpx+margin*2);

    // Reject implausible detections such as a tiny colored icon or a text strip.
    if(wpx<c.width*.22||hpx<c.height*.12)return false;
    crop={x,y,w:wpx,h:hpx};
    return true;
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
    const maxW=Math.min(1100,window.innerWidth*0.92),maxH=Math.min(620,window.innerHeight*0.62);
    sourceScale=Math.min(1,maxW/img.width,maxH/img.height);
    c.width=Math.max(1,Math.round(img.width*sourceScale));c.height=Math.max(1,Math.round(img.height*sourceScale));c.hidden=true;

    const old=preview.querySelector('.crop-wrap');if(old)old.remove();
    const wrap=document.createElement('div');wrap.className='crop-wrap';
    const cc=document.createElement('canvas');cc.id='cropCanvas';cc.width=c.width;cc.height=c.height;
    cc.style.width=c.width+'px';cc.style.height=c.height+'px';wrap.appendChild(cc);preview.insertBefore(wrap,preview.firstChild);

    const help=document.createElement('div');help.className='crop-help';
    help.textContent='🤖 Grid auto-detected. Adjust the blue corners if needed, then tap Crop & Detect.';
    preview.insertBefore(help,wrap.nextSibling);

    let actions=preview.querySelector('.crop-actions');if(actions)actions.remove();
    actions=document.createElement('div');actions.className='crop-actions';
    actions.innerHTML='<button id="resetCrop">↺ Reset</button><button id="autoCrop">🎯 Auto Grid</button><button id="cropDetect" class="crop-primary">✂️ Crop & Detect</button><button id="cancelCrop">Cancel</button>';
    preview.appendChild(actions);

    if(!autoDetectOuterGrid(cc))initialCrop(cc);
    draw();
    cc.addEventListener('pointerdown',pointerDown,{passive:false});cc.addEventListener('pointermove',pointerMove,{passive:false});cc.addEventListener('pointerup',pointerUp,{passive:false});cc.addEventListener('pointercancel',pointerUp,{passive:false});cc.addEventListener('lostpointercapture',()=>{drag=null});
    $('resetCrop').onclick=()=>{initialCrop(cc);draw()};
    $('autoCrop').onclick=()=>{if(!autoDetectOuterGrid(cc)){initialCrop(cc);$('status').textContent='⚠️ Could not confidently detect the outer grid. Please adjust the crop manually.'}else{$('status').textContent='🎯 Main puzzle grid detected. Check the corners, then crop.'}draw()};
    $('cancelCrop').onclick=()=>{preview.hidden=true};
    $('cropDetect').onclick=()=>cropAndDetect();
    preview.hidden=false;
    $('status').textContent='Screenshot loaded. Main puzzle grid was auto-detected. Check the blue corners, then tap Crop & Detect.';
  }

  function cropAndDetect(){
    if(!img||!crop)return;
    const src=$('cropCanvas'),out=$('previewCanvas'),ctx=out.getContext('2d');
    const sx=crop.x,sy=crop.y,sw=crop.w,sh=crop.h;
    out.width=Math.max(1,Math.round(sw));out.height=Math.max(1,Math.round(sh));
    ctx.clearRect(0,0,out.width,out.height);ctx.drawImage(src,sx,sy,sw,sh,0,0,out.width,out.height);out.hidden=false;
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
