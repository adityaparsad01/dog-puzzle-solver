/* Tray-first detector for Logic Riddle. Detect the board container, then its cells. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

  function largestTray(data,w,h){
    const m=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
      m[y*w+x]=(r>248&&g>248&&b>248&&Math.max(r,g,b)-Math.min(r,g,b)<8)?1:0;
    }
    const seen=new Uint8Array(w*h),q=new Int32Array(w*h);let best=null,bestArea=0;
    for(let sy=0;sy<h;sy++)for(let sx=0;sx<w;sx++){
      const s=sy*w+sx;if(!m[s]||seen[s])continue;
      let head=0,tail=0,minX=sx,maxX=sx,minY=sy,maxY=sy;q[tail++]=s;seen[s]=1;
      while(head<tail){
        const p=q[head++],y=Math.floor(p/w),x=p-y*w;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        if(x>0&&m[p-1]&&!seen[p-1]){seen[p-1]=1;q[tail++]=p-1}
        if(x<w-1&&m[p+1]&&!seen[p+1]){seen[p+1]=1;q[tail++]=p+1}
        if(y>0&&m[p-w]&&!seen[p-w]){seen[p-w]=1;q[tail++]=p-w}
        if(y<h-1&&m[p+w]&&!seen[p+w]){seen[p+w]=1;q[tail++]=p+w}
      }
      if(tail>bestArea&&maxX-minX>250&&maxY-minY>250){bestArea=tail;best={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};}
    }
    return best;
  }

  function runs(score,threshold){
    const out=[];let s=-1;
    for(let i=0;i<=score.length;i++){
      const on=i<score.length&&score[i]>=threshold;
      if(on&&s<0)s=i;
      if(!on&&s>=0){if(i-s>=4)out.push([s,i-1]);s=-1;}
    }
    return out;
  }

  function regions(board,n){
    const reg=Array.from({length:n},()=>Array(n).fill(-1));let id=0;
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){
      if(reg[r][c]>=0)continue;
      const color=board[r][c],q=[[r,c]];reg[r][c]=id;
      for(let h=0;h<q.length;h++){
        const [y,x]=q[h];
        for(const [dy,dx] of [[-1,0],[1,0],[0,-1],[0,1]]){
          const ny=y+dy,nx=x+dx;
          if(ny>=0&&ny<n&&nx>=0&&nx<n&&reg[ny][nx]<0&&board[ny][nx]===color){reg[ny][nx]=id;q.push([ny,nx]);}
        }
      }
      id++;
    }
    return {regions:reg,count:id};
  }

  function detect(){
    const src=$('previewCanvas');
    if(!src||!src.width){if($('status'))$('status').textContent='⚠️ Upload a screenshot first.';return;}
    const w=src.width,h=src.height,ctx=src.getContext('2d',{willReadFrequently:true});
    const data=ctx.getImageData(0,0,w,h).data;
    const tray=largestTray(data,w,h);
    if(!tray){$('status').textContent='⚠️ Board tray not found. Crop around the complete puzzle board.';return;}

    // The white tray gives us a stable coordinate system. Detect every colored
    // tile by its distance from white, not by saturation or page background.
    const mask=new Uint8Array(tray.w*tray.h);
    for(let y=0;y<tray.h;y++)for(let x=0;x<tray.w;x++){
      const i=((tray.y+y)*w+(tray.x+x))*4;
      mask[y*tray.w+x]=(dist([data[i],data[i+1],data[i+2]],[255,255,255])>18)?1:0;
    }
    const rs=new Int32Array(tray.h),cs=new Int32Array(tray.w);
    for(let y=0;y<tray.h;y++)for(let x=0;x<tray.w;x++)if(mask[y*tray.w+x]){rs[y]++;cs[x]++;}

    // Each row/column is a solid tile band separated by a narrow white gap.
    // We deliberately do NOT merge nearby runs because the gaps are the grid.
    let rows=[],cols=[];
    for(const frac of [.30,.20,.10,.05]){rows=runs(rs,Math.max(5,Math.floor(tray.w*frac)));if(rows.length>=4&&rows.length<=12)break;}
    if(rows.length<4||rows.length>12){$('status').textContent=`⚠️ Could not detect grid rows (${rows.length}).`;return;}
    const n=rows.length;
    for(const frac of [.30,.20,.10,.05]){cols=runs(cs,Math.max(5,Math.floor(tray.h*frac)));if(cols.length===n)break;}
    if(cols.length!==n){$('status').textContent=`⚠️ Grid mismatch: ${n} rows × ${cols.length} columns.`;return;}

    // Sample the center of each tile. These RGB values are the actual game
    // colors, so connected regions can be reconstructed after sampling.
    const samples=[];
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){
      const [ya,yb]=rows[r],[xa,xb]=cols[c],cx=Math.round((xa+xb)/2),cy=Math.round((ya+yb)/2);
      let vals=[];
      const rx=Math.max(2,Math.floor((xb-xa+1)*.18)),ry=Math.max(2,Math.floor((yb-ya+1)*.18));
      for(let y=Math.max(ya,cy-ry);y<=Math.min(yb,cy+ry);y++)for(let x=Math.max(xa,cx-rx);x<=Math.min(xb,cx+rx);x++){
        const i=((tray.y+y)*w+(tray.x+x))*4;vals.push([data[i],data[i+1],data[i+2]]);
      }
      const avg=[0,1,2].map(k=>Math.round(vals.reduce((s,v)=>s+v[k],0)/vals.length));
      samples.push(avg);
    }

    // Tight clustering. Colors in the game are flat fills; using a small
    // threshold preserves visually similar but distinct region colors.
    const palette=[];
    const ids=samples.map(rgb=>{
      let k=-1,bd=Infinity;
      for(let i=0;i<palette.length;i++){const d=dist(rgb,palette[i]);if(d<bd){bd=d;k=i;}}
      if(k<0||bd>20){palette.push(rgb.slice());return palette.length-1;}
      palette[k]=palette[k].map((v,i)=>Math.round((v+rgb[i])/2));return k;
    });
    const board=Array.from({length:n},(_,r)=>ids.slice(r*n,(r+1)*n));
    let rd=regions(board,n);

    // If anti-aliasing changed a few center samples, classify all samples again
    // against stable palette means before rejecting the screenshot.
    if(rd.count!==n){
      const ids2=samples.map(rgb=>{let k=0,bd=Infinity;palette.forEach((p,i)=>{const d=dist(rgb,p);if(d<bd){bd=d;k=i;}});return k;});
      const board2=Array.from({length:n},(_,r)=>ids2.slice(r*n,(r+1)*n)),rd2=regions(board2,n);
      if(rd2.count===n)rd=rd2,rd.board=board2;
    }
    if(rd.count!==n){$('status').textContent=`⚠️ Detected ${n}×${n}, but found ${rd.count} regions. Crop the complete board.`;return;}

    const finalBoard=rd.board||board;
    const toHex=rgb=>`#${rgb.map(v=>v.toString(16).padStart(2,'0')).join('')}`;
    const names=palette.map((p,i)=>[`Color ${i+1}`,toHex(p)]);
    window.applyDetectedBoard(n,finalBoard,names,rd.regions);
    $('status').textContent=`✓ Detected ${n}×${n} board with ${n} regions.`;
  }
  window.detectBoard=detect;
})();
