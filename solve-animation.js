// Animated solver: visually places foxes one row at a time so solving feels live.
(function(){
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function animatedSolve(){
    dogs.fill(-1);
    $('solution').style.display='none';
    $('status').textContent=`🧠 Analyzing ${size}×${size} board...`;
    render();
    await sleep(450);

    if(board.some(row=>row.some(cell=>cell===null))){
      $('status').textContent='⚠️ Please paint every cell before solving.';
      render();
      return;
    }

    const cs=colors();
    const cols=new Set(),usedColors=new Set();
    let nodes=0;
    function legal(r,c){
      if(cols.has(c)||usedColors.has(board[r][c]))return false;
      for(let rr=0;rr<size;rr++){
        if(dogs[rr]>=0&&Math.abs(rr-r)<=1&&Math.abs(dogs[rr]-c)<=1)return false;
      }
      return true;
    }

    function chooseRow(){
      let br=-1,bc=[];
      for(let r=0;r<size;r++){
        if(dogs[r]>=0)continue;
        const a=[];
        for(let c=0;c<size;c++)if(legal(r,c))a.push(c);
        if(!a.length)return {row:r,candidates:[]};
        if(br<0||a.length<bc.length){br=r;bc=a}
      }
      return {row:br,candidates:bc};
    }

    async function dfs(n){
      nodes++;
      if(n===size)return true;
      const choice=chooseRow(),r=choice.row;
      if(!choice.candidates.length)return false;

      $('status').textContent=`🧠 Solving... Row ${r+1}/${size} • ${nodes.toLocaleString()} checks`;
      render();
      await sleep(180);

      for(const c of choice.candidates){
        dogs[r]=c;cols.add(c);usedColors.add(board[r][c]);
        $('status').textContent=`🔎 Testing Row ${r+1}, Column ${c+1}...`;
        render();
        await sleep(120);
        if(await dfs(n+1))return true;
        cols.delete(c);usedColors.delete(board[r][c]);dogs[r]=-1;
        $('status').textContent=`↩️ Backtracking from Row ${r+1}...`;
        render();
        await sleep(100);
      }
      return false;
    }

    const solved=await dfs(0);
    if(solved){
      $('status').textContent=`✅ Solution found for ${size}×${size} (${nodes.toLocaleString()} search nodes)`;
      $('solution').textContent=dogs.map((c,r)=>`Row ${r+1} → Column ${c+1} → ${cs[board[r][c]][0]}`).join('\n');
      $('solution').style.display='block';
      render();
    }else{
      $('status').textContent=`❌ No solution found for ${size}×${size}`;
      render();
    }
  }

  $('solve').onclick=animatedSolve;
})();
