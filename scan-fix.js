// Reliable screenshot board detector for Logic Riddle.
// Uses color projections instead of connected-cell clustering so board sizes
// remain stable across 4x4 through 15x15.
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
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
      const sat=mx?((mx-mn)/mx)*255:0;
      // Crucial: require meaningful saturation even for palette-near pixels.
      // The game's beige background is close to pink/yellow in RGB distance,
      // so distance-only matching incorrectly marks most of the screenshot.
      mask[y*w+x]=(sat>52&&mx>105)?1:0;
    }
    return mask;
  }

  function bands(values,threshold,minLen){
    const out=[];let start=-1;
    for(let i=0;i<=values.length;i++){
      const good=i<values.length&&values[i]>=threshold;
      if(good&&start<0)start=i;
      if(!good&&start>=0){
        if(i-start>=minLen)out.push([start,i-1]);
        start=-1;
      }
    }
    return out;
  }

  function smooth(values,r){
    const out=new Float32Array(values.length);
    let sum=0;
    for(let i=0;i<values.length;i++){
      sum+=values[i];
      if(i-r-1>=0)sum-=values[i-r-1];
      out[i]=sum/(Math.min(values.length-1,i+r)-Math.max(0,i-r)+1);
    }
    // second pass gives a centered moving average, avoiding edge bias
    const out2=new Float32Array(values.length);sum=0;
    for(let i=0;i<values.length;i++){
      sum+=out[i];
      if(i-r-1>=0)sum-=out[i-r-1];
      out2[i]=sum/(Math.min(values.length-1,i+r)-Math.max(0,i-r)+1);
    }
    return out2;
  }

  function detect(){
    const src=$('previewCanvas');
    if(!src||!src.width||!src.height){$('status').textContent='⚠️ No screenshot is ready for detection.';return}

    const maxW=900,scale=Math.min(1,maxW/src.width);
    const w=Math.max(1,Math.round(src.width*scale)),h=Math.max(1,Math.round(src.height*scale));
    const work=document.createElement('canvas');work.width=w;work.height=h;
    const ctx=work.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0,w,h);
    const data=ctx.getImageData(0,0,w,h).data,mask=classifyMask(data,w,h);
    const xr=new Float32Array(w),yr=new Float32Array(h);

    for(let x=0;x<w;x++){let n=0;for(let y=0;y<h;y++)n+=mask[y*w+x];xr[x]=n/h}
    for(let y=0;y<h;y++){let n=0;for(let x=0;x<w;x++)n+=mask[y*w+x];yr[y]=n/w}

    const radius=Math.max(2,Math.round(Math.min(w,h)/180));
    const xs=smooth(xr,radius),ys=smooth(yr,radius);
    // A real board cell occupies a large fraction of its column/row. UI icons
    // do not form a long repeated sequence, so 0.10 is intentionally conservative.
    const minBand=Math.max(3,Math.round(Math.min(w,h)/180));
    let xb=bands(xs,.10,minBand),yb=bands(ys,.10,minBand);

    // On screenshots with very light compression, slightly relax the threshold.
    if(xb.length<4||yb.length<4){xb=bands(xs,.065,minBand);yb=bands(ys,.065,minBand)}

    function centers(a){return a.map(r=>(r[0]+r[1])/2)}
    let xc=centers(xb),yc=centers(yb);
    if(xc.length!==yc.length){
      const target=Math.min(xc.length,yc.length);
      // Keep the most central contiguous sequence when one edge has a partial band.
      xc=xc.slice(0,target);yc=yc.slice(0,target);
    }

    const n=xc.length;
    if(n<4||n>15){
      $('status').textContent=`⚠️ Could not determine board size. Detected ${xc.length} columns × ${yc.length} rows.`;
      return;
    }

    // Validate spacing. Board centers form an almost uniform sequence.
    function spacing(a){const d=[];for(let i=1;i<a.length;i++)d.push(a[i]-a[i-1]);return d}
    const dx=spacing(xc),dy=spacing(yc);
    const avgX=dx.reduce((s,v)=>s+v,0)/Math.max(1,dx.length),avgY=dy.reduce((s,v)=>s+v,0)/Math.max(1,dy.length);
    const spreadX=Math.max(...dx)/Math.min(...dx),spreadY=Math.max(...dy)/Math.min(...dy);
    if(spreadX>1.45||spreadY>1.45||Math.abs(avgX-avgY)/Math.max(avgX,avgY)>.25){
      $('status').textContent='⚠️ Grid bands were found but spacing is inconsistent. Crop closer to the puzzle grid and try again.';
      return;
    }

    size=n;
    $('size').value=String(n);
    board=Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>{
      const x=Math.round(xc[c]),y=Math.round(yc[r]),i=(y*w+x)*4,rgb=[data[i],data[i+1],data[i+2]];
      let bi=0,bd=Infinity;
      palette.forEach((p,k)=>{const d=dist3(rgb,p);if(d<bd){bd=d;bi=k}});
      return bi;
    }));
    dogs=Array(n).fill(-1);selected=0;
    $('scanPreview').hidden=true;
    $('status').textContent=`📷 Screenshot scanned successfully. Detected ${n}×${n}. Check the colors, then press Solve.`;
    legend();render();
  }

  window.detectBoard=detect;
  $('detectButton').onclick=detect;
})();
