// Mobile-friendly screenshot cropper with reliable automatic outer-grid detection.
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .crop-wrap{position:relative;width:100%;max-width:700px;margin:12px auto;background:#2b2528;border-radius:12px;overflow:auto;display:flex;justify-content:center;align-items:center;touch-action:none;user-select:none;-webkit-user-select:none}
    .crop-wrap canvas{display:block;margin:auto;background:#2b2528;touch-action:none;user-select:none;-webkit-user-select:none}
    .crop-help{text-align:center;font-size:13px;color:#765b68;margin:8px 0;line-height:1.4}
    .crop-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;margin-top:10px}
    .crop-actions button{border:0;border-radius:10px;padding:11px 13px;font-weight:700;cursor:pointer;background:#8f4960;color:white;min-height:44px;touch-action:manipulation}
    .crop-actions .crop-primary{background:#2563eb}
    .crop-actions .crop-auto{background:#16804b}
    @media(max-width:600px){
      .crop-wrap{max-height:62vh;min-height:260px;overflow:hidden}
      .crop-wrap canvas{max-width:none!important;max-height:none!important}
      .crop-help{font-size:12px;padding:0 8px}
      .crop-actions button{padding:11px 9px;font-size:13px}
    }
  `;
  document.head.appendChild(style);

  const input=$('imageInput'),preview=$('scanPreview');
  let img=null,crop=null,drag=null;

  const PALETTE=[
    [255,164,189],[114,158,223],[191,212,73],[63,137,78],[255,226,132],
    [159,90,157],[205,58,110],[94,225,211],[255,177,102],[88,113,214],
    [239,138,112],[85,184,169],[143,121,201],[215,170,66],[107,184,232]
  ];

  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function getCanvas(){return $('cropCanvas')}

  function draw(){
    const c=getCanvas();if(!c||!img||!crop)return;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
    ctx.fillStyle='rgba(0,0,0,.50)';
    ctx.fillRect(0,0,c.width,crop.y);
    ctx.fillRect(0,crop.y,crop.x,crop.h);
    ctx.fillRect(crop.x+crop.w,crop.y,c.width-crop.x-crop.w,crop.h);
    ctx.fillRect(0,crop.y+crop.h,c.width,c.height-crop.y-crop.h);
    ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(3,c.width/260);ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);
    const hs=Math.max(22,c.width/22);
    for(const [x,y] of [[crop.x,crop.y],[crop.x+crop.w,crop.y],[crop.x,crop.y+crop.h],[crop.x+crop.w,crop.y+crop.h]]){
      ctx.beginPath();ctx.arc(x,y,hs/2,0,Math.PI*2);ctx.fillStyle='#2563eb';ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
    }
  }

  function initialCrop(c){
    const pad=Math.round(Math.min(c.width,c.height)*.10);
    crop={x:pad,y:pad,w:c.width-pad*2,h:c.height-pad*2};
  }

  function colorMask(data,w,h){
    const mask=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
      let d2=Infinity;
      for(const p of PALETTE){const dr=r-p[0],dg=g-p[1],db=b-p[2],v=dr*dr+dg*dg+db*db;if(v<d2)d2=v}
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx?((mx-mn)/mx)*255:0;
      mask[y*w+x]=(d2<82*82 || (sat>42&&mx>145&&d2<125*125))?1:0;
    }
    return mask;
  }

  // Binary dilation with a sliding window. It bridges the 6-10px gaps between
  // individual cells without requiring OpenCV or another external library.
  function dilate(mask,w,h,r){
    const a=new Uint8Array(w*h),b=new Uint8Array(w*h),span=r*2+1;
    for(let y=0;y<h;y++){
      let sum=0;
      for(let x=0;x<w+r;x++){
        if(x<w)sum+=mask[y*w+x];
        const remove=x-span;
        if(remove>=0)sum-=mask[y*w+remove];
        const out=x-r;
        if(out>=0&&out<w)a[y*w+out]=sum>0?1:0;
      }
    }
    for(let x=0;x<w;x++){
      let sum=0;
      for(let y=0;y<h+r;y++){
        if(y<h)sum+=a[y*w+x];
        const remove=y-span;
        if(remove>=0)sum-=a[remove*w+x];
        const out=y-r;
        if(out>=0&&out<h)b[out*w+x]=sum>0?1:0;
      }
    }
    return b;
  }

  function findOuterGrid(c){
    const maxDim=760,scale=Math.max(1,Math.ceil(Math.max(c.width,c.height)/maxDim));
    const w=Math.max(1,Math.floor(c.width/scale)),h=Math.max(1,Math.floor(c.height/scale));
    const tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;
    const tctx=tmp.getContext('2d',{willReadFrequently:true});tctx.drawImage(c,0,0,w,h);
    const data=tctx.getImageData(0,0,w,h).data,mask=colorMask(data,w,h);
    const radius=Math.max(3,Math.min(8,Math.round(Math.min(w,h)/90)));
    const blob=dilate(mask,w,h,radius);
    const seen=new Uint8Array(w*h),stack=new Int32Array(w*h);
    let best=null;

    for(let sy=0;sy<h;sy++)for(let sx=0;sx<w;sx++){
      const start=sy*w+sx;
      if(!blob[start]||seen[start])continue;
      let sp=0;stack[sp++]=start;seen[start]=1;
      let area=0,minX=sx,maxX=sx,minY=sy,maxY=sy;
      while(sp){
        const p=stack[--sp],y=Math.floor(p/w),x=p-y*w;area++;
        if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
        if(x>0){const q=p-1;if(blob[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}
        if(x+1<w){const q=p+1;if(blob[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}
        if(y>0){const q=p-w;if(blob[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}
        if(y+1<h){const q=p+w;if(blob[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}
      }
      const bw=maxX-minX+1,bh=maxY-minY+1,ratio=bw/bh,fill=area/(bw*bh),minSide=Math.min(bw,bh);
      if(minSide<120||ratio<.72||ratio>1.28||fill<.40)continue;
      // Strongly prefer large square regions. Board pixels are repeated across
      // hundreds of cells, while hearts/icons/text form much smaller regions.
      const square=1-Math.abs(1-ratio);
      const score=area*square*fill;
      if(!best||score>best.score)best={x:minX,y:minY,w:bw,h:bh,score};
    }
    if(!best)return null;
    const pad=Math.max(6,Math.round(Math.min(best.w,best.h)*.035));
    const x=clamp(best.x*scale-pad,0,c.width-20),y=clamp(best.y*scale-pad,0,c.height-20);
    const right=clamp((best.x+best.w)*scale+pad,x+20,c.width),bottom=clamp((best.y+best.h)*scale+pad,y+20,c.height);
    return {x,y,w:right-x,h:bottom-y};
  }

  function autoDetectOuterGrid(){
    const c=getCanvas();if(!c||!img)return false;
    const found=findOuterGrid(c);
    if(!found)return false;
    crop=found;draw();
    $('status').textContent='✨ Main puzzle grid detected automatically. Check the blue corners, then tap Crop & Detect.';
    return true;
  }

  function point(e){
    const c=getCanvas(),r=c.getBoundingClientRect();
    return {x:(e.clientX-r.left)*(c.width/r.width),y:(e.clientY-r.top)*(c.height/r.height)};
  }

  function hit(p){
    const c=getCanvas(),hs=Math.max(35,c.width*.065);
    const pts=[[crop.x,crop.y,'nw'],[crop.x+crop.w,crop.y,'ne'],[crop.x,crop.y+crop.h,'sw'],[crop.x+crop.w,crop.y+crop.h,'se']];
    for(const [x,y,k] of pts)if(Math.hypot(p.x-x,p.y-y)<=hs)return k;
    if(p.x>=crop.x&&p.x<=crop.x+crop.w&&p.y>=crop.y&&p.y<=crop.y+crop.h)return 'move';
    return null;
  }

  function pointerDown(e){
    e.preventDefault();const p=point(e),type=hit(p);if(!type)return;
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

  function pointerUp(e){if(e){try{getCanvas().releasePointerCapture(e.pointerId)}catch(_){}}drag=null}

  function showCrop(image){
    img=image;
    const c=$('previewCanvas');
    const maxW=Math.min(1100,window.innerWidth*.92),maxH=Math.min(620,window.innerHeight*.62);
    const scale=Math.min(1,maxW/img.width,maxH/img.height);
    c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.hidden=true;

    const old=preview.querySelector('.crop-wrap');if(old)old.remove();
    const wrap=document.createElement('div');wrap.className='crop-wrap';
    const cc=document.createElement('canvas');cc.id='cropCanvas';cc.width=c.width;cc.height=c.height;
    cc.style.width=c.width+'px';cc.style.height=c.height+'px';wrap.appendChild(cc);preview.insertBefore(wrap,preview.firstChild);

    const help=document.createElement('div');help.className='crop-help';
    help.textContent='🤖 The main puzzle grid is detected automatically. Drag the blue corners to fine-tune it.';
    preview.insertBefore(help,wrap.nextSibling);

    let actions=preview.querySelector('.crop-actions');if(actions)actions.remove();
    actions=document.createElement('div');actions.className='crop-actions';
    actions.innerHTML='<button id="autoCrop" class="crop-auto">🎯 Auto Grid</button><button id="resetCrop">↺ Reset</button><button id="cropDetect" class="crop-primary">✂️ Crop & Detect</button><button id="cancelCrop">Cancel</button>';
    preview.appendChild(actions);

    const ok=autoDetectOuterGrid();
    if(!ok){initialCrop(cc);$('status').textContent='Screenshot loaded. Auto Grid could not confidently find the board. Adjust the crop manually, or tap Auto Grid again.'}
    draw();
    cc.addEventListener('pointerdown',pointerDown,{passive:false});cc.addEventListener('pointermove',pointerMove,{passive:false});cc.addEventListener('pointerup',pointerUp,{passive:false});cc.addEventListener('pointercancel',pointerUp,{passive:false});cc.addEventListener('lostpointercapture',()=>{drag=null});

    $('autoCrop').onclick=()=>{
      if(!autoDetectOuterGrid())$('status').textContent='⚠️ Auto Grid could not find the main puzzle board. Please crop it manually.';
    };
    $('resetCrop').onclick=()=>{initialCrop(cc);draw();$('status').textContent='Crop reset. Adjust the blue corners, then tap Crop & Detect.'};
    $('cancelCrop').onclick=()=>{preview.hidden=true};
    $('cropDetect').onclick=()=>cropAndDetect();
    preview.hidden=false;
  }

  function cropAndDetect(){
    if(!img||!crop)return;
    const src=getCanvas(),out=$('previewCanvas'),ctx=out.getContext('2d');
    out.width=Math.max(1,Math.round(crop.w));out.height=Math.max(1,Math.round(crop.h));
    ctx.clearRect(0,0,out.width,out.height);ctx.drawImage(src,crop.x,crop.y,crop.w,crop.h,0,0,out.width,out.height);out.hidden=false;
    const wrap=preview.querySelector('.crop-wrap');if(wrap)wrap.remove();
    const help=preview.querySelector('.crop-help');if(help)help.remove();
    const actions=preview.querySelector('.crop-actions');if(actions)actions.remove();
    $('status').textContent='Cropped screenshot ready. Detecting board...';
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
