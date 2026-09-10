// Reliable screenshot board detector for Logic Riddle.
// The previous detector tried to infer individual connected components, which
// could merge/split cells and produce wrong board sizes. This version derives
// the grid from repeated colored bands, so 8x8, 9x9 ... 15x15 remain distinct.
(function(){
  const palette=[
    [255,164,189],[114,158,223],[191,212,73],[63,137,78],[255,226,132],
    [159,90,157],[205,58,110],[94,225,211],[255,177,102],[88,113,214],
    [239,138,112],[85,184,169],[143,121,201],[215,170,66],[107,184,232]
  ];

  function dist3(a,b){
    const dr=a[0]-b[0],dg=a[1]-b[1],db=a[2]-b[2];
    return Math.sqrt(dr*dr+dg*dg+db*db);
  }

  function classifyMask(data,w,h){
    const mask=new Uint8Array(w*h);
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const i=(y*w+x)*4;
        const rgb=[data[i],data[i+1],data[i+2]];
        let best=Infinity;
        for(const p of palette)best=Math.min(best,dist3(rgb,p));
        const mx=Math.max(rgb[0],rgb[1],rgb[2]);
        const mn=Math.min(rgb[0],rgb[1],rgb[2]);
        const sat=mx?((mx-mn)/mx)*255:0;
        // Known game colors are preferred; saturation fallback handles small
        // rendering differences/compression while avoiding pale background.
        mask[y*w+x]=(best<82 || (sat>42 && mx>145 && best<125))?1:0;
      }
    }
    return mask;
  }

  function projectionBands(mask,w,h,axis){
    const vals=axis==='x'?new Float32Array(w):new Float32Array(h);
    if(axis==='x'){
      for(let x=0;x<w;x++){
        let n=0; for(let y=0;y<h;y++)n+=mask[y*w+x];
        vals[x]=n/h;
      }
    }else{
      for(let y=0;y<h;y++){
        let n=0; for(let x=0;x<w;x++)n+=mask[y*w+x];
        vals[y]=n/w;
      }
    }

    // Small holes from rounded cell corners are smoothed with a moving average.
    const smooth=new Float32Array(vals.length), radius=Math.max(2,Math.round(Math.min(w,h)/250));
    let acc=0;
    const q=[];
    for(let i=0;i<vals.length;i++){
      q.push(vals[i]);acc+=vals[i];
      if(q.length>radius*2+1)acc-=q.shift();
      smooth[i]=acc/q.length;
    }

    const threshold=0.12;
    const runs=[]; let start=-1;
    for(let i=0;i<smooth.length;i++){
      if(smooth[i]>=threshold){
        if(start<0)start=i;
      }else if(start>=0){
        if(i-start>=Math.max(5,Math.round(Math.min(w,h)/90)))runs.push([start,i-1]);
        start=-1;
      }
    }
    if(start>=0&&smooth.length-start>=Math.max(5,Math.round(Math.min(w,h)/90)))runs.push([start,smooth.length-1]);

    // Remove tiny accidental edge runs and keep bands that are reasonably cell-like.
    return runs.filter(r=>r[1]-r[0]+1>=Math.max(10,Math.round(Math.min(w,h)/45)));
  }

  function mergeNearBands(bands,gap){
    if(!bands.length)return bands;
    const out=[bands[0].slice()];
    for(let i=1;i<bands.length;i++){
      const last=out[out.length-1],cur=bands[i];
      if(cur[0]-last[1]-1<=gap)last[1]=cur[1];
      else out.push(cur.slice());
    }
    return out;
  }

  function detect(){
    const src=$('previewCanvas');
    if(!src||!src.width||!src.height){
      $('status').textContent='⚠️ No screenshot is ready for detection.';
      return;
    }

    const maxW=1000,scale=Math.min(1,maxW/src.width);
    const w=Math.max(1,Math.round(src.width*scale));
    const h=Math.max(1,Math.round(src.height*scale));
    const work=document.createElement('canvas');work.width=w;work.height=h;
    const ctx=work.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0,w,h);
    const data=ctx.getImageData(0,0,w,h).data;
    const mask=classifyMask(data,w,h);

    let xb=projectionBands(mask,w,h,'x');
    let yb=projectionBands(mask,w,h,'y');
    xb=mergeNearBands(xb,Math.max(2,Math.round(Math.min(w,h)/120)));
    yb=mergeNearBands(yb,Math.max(2,Math.round(Math.min(w,h)/120)));

    // Cell bands should be similar in size. Try the cleanest square grid from
    // the detected bands rather than accepting a partial row/column sequence.
    function bandCenters(bands){return bands.map(([a,b])=>(a+b)/2)}
    const xc=bandCenters(xb),yc=bandCenters(yb);
    const candidates=[];
    for(let skipX=0;skipX<2;skipX++)for(let skipY=0;skipY<2;skipY++){
      const xs=xc.slice(skipX),ys=yc.slice(skipY);
      const n=Math.min(xs.length,ys.length);
      if(n<4||n>15||xs.length!==ys.length)continue;
      const dx=[],dy=[];
      for(let i=1;i<n;i++){dx.push(xs[i]-xs[i-1]);dy.push(ys[i]-ys[i-1]);}
      const mdx=dx.reduce((a,b)=>a+b,0)/Math.max(1,dx.length);
      const mdy=dy.reduce((a,b)=>a+b,0)/Math.max(1,dy.length);
      const varX=dx.reduce((s,v)=>s+(v-mdx)**2,0)/Math.max(1,dx.length);
      const varY=dy.reduce((s,v)=>s+(v-mdy)**2,0)/Math.max(1,dy.length);
      const ratio=Math.min(mdx,mdy)/Math.max(mdx,mdy);
      const score=ratio/(1+Math.sqrt(varX+varY)/Math.max(1,(mdx+mdy)/2));
      candidates.push({score,n,xs,ys});
    }

    let best=candidates.sort((a,b)=>b.score-a.score)[0];

    // Fallback: select the longest equal-length run of bands.
    if(!best){
      const n=Math.min(xb.length,yb.length);
      if(n>=4&&n<=15)best={n,xs:xc.slice(0,n),ys:yc.slice(0,n)};
    }

    if(!best||best.n<4||best.n>15){
      $('status').textContent=`⚠️ Could not determine the board grid. Detected ${xb.length} columns × ${yb.length} rows of colored bands.`;
      return;
    }

    const n=best.n;
    size=n;
    $('size').value=String(n);

    // Build each cell from its center. Ignore the outer crop border and use
    // the pixel color closest to the game's fixed palette.
    board=Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>{
      const x=Math.max(0,Math.min(w-1,Math.round(best.xs[c])));
      const y=Math.max(0,Math.min(h-1,Math.round(best.ys[r])));
      const i=(y*w+x)*4,rgb=[data[i],data[i+1],data[i+2]];
      let bi=0,bd=Infinity;
      palette.forEach((p,k)=>{const d=dist3(rgb,p);if(d<bd){bd=d;bi=k}});
      return bi;
    }));

    dogs=Array(n).fill(-1);
    selected=0;
    $('scanPreview').hidden=true;
    $('status').textContent=`📷 Screenshot scanned successfully. Detected ${n}×${n}. Check the colors, then press Solve.`;
    legend();
    render();
  }

  window.detectBoard=detect;
  $('detectButton').onclick=detect;
})();
