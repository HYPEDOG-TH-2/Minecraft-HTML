// Prevent browser right-click context menu everywhere so Right-Click always places blocks
    window.addEventListener('contextmenu', e => e.preventDefault());

    const SUPABASE_URL='https://oivmvbnwtscwzgffckkc.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY='sb_publishable_735bLBrectMrUug6P7ciqA_uJ88ilEl';
    const multiplayerClient=window.supabase&&window.supabase.createClient
      ?window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY)
      :null;

    const soundDataCache=new Map();
    const activeSounds=new Set();
    function makeSoundData(kind,blockId=0,toolType='hand') {
      const softWood=blockId===6||blockId===10;
      const sandy=blockId===2||blockId===7||blockId===28;
      const material=softWood?'wood':sandy?'sand':'stone';
      const cacheKey=kind==='mine'?`${kind}-${material}-${toolType}-${Math.floor(Math.random()*5)}`:kind==='break'?`${kind}-${material}`:kind;
      if (soundDataCache.has(cacheKey)) return soundDataCache.get(cacheKey);
      const sampleRate=22050;
      const duration=kind==='craft'?0.32:kind==='start'?0.28:kind==='pickup'?0.2:kind==='mine'?0.085:kind==='break'?0.12:kind==='ui'?0.075:0.14;
      const sampleCount=Math.floor(sampleRate*duration), dataBytes=sampleCount*2;
      const wav=new ArrayBuffer(44+dataBytes), header=new DataView(wav), samples=new DataView(wav);
      const minePitchOffset=(Math.random()-0.5)*30;
      const writeText=(offset,value)=>{for(let i=0;i<value.length;i++)header.setUint8(offset+i,value.charCodeAt(i));};
      writeText(0,'RIFF'); header.setUint32(4,36+dataBytes,true); writeText(8,'WAVE');
      writeText(12,'fmt '); header.setUint32(16,16,true); header.setUint16(20,1,true);
      header.setUint16(22,1,true); header.setUint32(24,sampleRate,true); header.setUint32(28,sampleRate*2,true);
      header.setUint16(32,2,true); header.setUint16(34,16,true); writeText(36,'data'); header.setUint32(40,dataBytes,true);
      for (let i=0;i<sampleCount;i++) {
        const t=i/sampleRate;
        let value=0, envelope=0;
        if (kind==='mine') {
          const base=softWood?220:sandy?155:toolType==='pickaxe'?285:175;
          const pitch=base+minePitchOffset;
          envelope=Math.min(1,t/0.002)*Math.exp(-t*34);
          const metallic=toolType==='pickaxe'?Math.sin(2*Math.PI*(pitch*1.9)*t)*0.16:0;
          value=(Math.sin(2*Math.PI*pitch*t)*0.5+metallic+(Math.random()*2-1)*(softWood?0.22:0.42))*envelope;
        } else if (kind==='break') {
          const base=softWood?165:sandy?105:125;
          envelope=Math.min(1,t/0.004)*Math.exp(-t*25);
          value=(Math.sin(2*Math.PI*(base-55*t/duration)*t)*0.65+(Math.random()*2-1)*0.5)*envelope;
        } else if (kind==='place'||kind==='drop') {
          const start=kind==='place'?175:125, finish=kind==='place'?65:58;
          const phase=2*Math.PI*(start*t+(finish-start)*t*t/(2*duration));
          envelope=Math.min(1,t/0.004)*Math.exp(-t*21);
          value=(Math.sin(phase)*0.8+(Math.random()*2-1)*0.28)*envelope;
        } else if (kind==='pickup') {
          envelope=Math.min(1,t/0.008)*Math.exp(-t*5);
          value=Math.sin(2*Math.PI*760*t)*0.45;
          if (t>0.055) value+=Math.sin(2*Math.PI*1080*(t-0.055))*0.55;
          value*=envelope;
        } else if (kind==='craft') {
          const notes=[[440,0,0.105],[554,0.075,0.11],[659,0.15,0.16]];
          for (const [frequency,start,length] of notes) {
            const noteTime=t-start;
            if (noteTime>=0&&noteTime<length) value+=Math.sin(2*Math.PI*frequency*noteTime)*Math.min(1,noteTime/0.006)*Math.exp(-noteTime*7)*0.42;
          }
        } else if (kind==='start') {
          envelope=Math.min(1,t/0.01)*Math.exp(-t*3.3);
          value=Math.sin(2*Math.PI*660*t)*0.42;
          if (t>0.08) value+=Math.sin(2*Math.PI*880*(t-0.08))*0.48;
          value*=envelope;
        } else {
          envelope=Math.min(1,t/0.002)*Math.exp(-t*40);
          value=(Math.sin(2*Math.PI*(750-180*t/duration)*t)*0.7+(Math.random()*2-1)*0.2)*envelope;
        }
        samples.setInt16(44+i*2,Math.max(-1,Math.min(1,value*0.78))*32767,true);
      }
      const bytes=new Uint8Array(wav), dataUrl=`data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
      soundDataCache.set(cacheKey,dataUrl);
      return dataUrl;
    }
    function playSound(kind,blockId=0,toolType='hand') {
      try {
        const audio=new Audio(makeSoundData(kind,blockId,toolType));
        audio.volume=1;
        activeSounds.add(audio);
        audio.addEventListener('ended',()=>activeSounds.delete(audio),{once:true});
        const playing=audio.play();
        if (playing&&playing.catch) playing.catch(()=>activeSounds.delete(audio));
      } catch (_) {}
    }

    // --- 1. PROCEDURAL 16x16 PIXEL TEXTURES ---
    function makeTex(base, shades, extraFn = null) {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const ctx = c.getContext('2d');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 16, 16);
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          if (Math.random() > 0.42) {
            ctx.fillStyle = shades[Math.floor(Math.random() * shades.length)];
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      if (extraFn) extraFn(ctx);
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    const TEX = {
      grassTop: makeTex('#4C9A2A', ['#3E8220', '#5CB338']),
      grassSide: makeTex('#79553A', ['#63432C', '#8C6648'], ctx => {
        ctx.fillStyle = '#4C9A2A';
        ctx.fillRect(0, 0, 16, 4);
        for (let x = 0; x < 16; x++) {
          if (Math.random() > 0.3) ctx.fillRect(x, 4, 1, Math.floor(Math.random() * 3));
        }
      }),
      dryGrassTop: makeTex('#A38A50', ['#8D7744','#B49A5C','#C0A66A'], ctx => {
        ctx.fillStyle='#75643B'; [[2,4],[7,2],[12,6],[5,11],[14,13],[9,8]].forEach(([x,y])=>ctx.fillRect(x,y,1,2));
        ctx.fillStyle='#D1BA7B'; ctx.fillRect(3,7,2,1); ctx.fillRect(10,3,2,1); ctx.fillRect(6,14,3,1);
      }),
      dryGrassSide: makeTex('#8E7145', ['#755A37','#A58950','#B79A5D'], ctx => {
        ctx.fillStyle='#A88D51'; ctx.fillRect(0,0,16,4);
        ctx.fillStyle='#6D5735'; ctx.fillRect(0,4,16,2); ctx.fillRect(0,13,16,3);
        ctx.fillStyle='#C2A86D'; ctx.fillRect(2,1,4,1); ctx.fillRect(10,2,3,1);
      }),
      dirt: makeTex('#79553A', ['#63432C', '#8C6648']),
      stone: makeTex('#7D7D7D', ['#686868', '#919191'], ctx => {
        ctx.fillStyle='#5E5E5E'; ctx.fillRect(3,4,3,1); ctx.fillRect(6,5,1,2);
        ctx.fillRect(10,11,3,1); ctx.fillRect(9,12,1,2);
        ctx.fillStyle='#A0A0A0'; ctx.fillRect(1,13,2,1); ctx.fillRect(12,2,2,1);
      }),
      cobble: makeTex('#696969', ['#4E4E4E', '#858585'], ctx => {
        ctx.fillStyle='#414141';
        ctx.fillRect(0,5,16,1); ctx.fillRect(0,11,16,1);
        ctx.fillRect(4,0,1,5); ctx.fillRect(11,6,1,5); ctx.fillRect(7,12,1,4);
        ctx.fillStyle='#929292'; ctx.fillRect(1,2,2,1); ctx.fillRect(6,8,3,1); ctx.fillRect(12,13,2,1);
      }),
      planks: makeTex('#A88754', ['#917243', '#BA9966'], ctx => {
        ctx.fillStyle = '#7A5E35';
        ctx.fillRect(0, 3, 16, 1);
        ctx.fillRect(0, 7, 16, 1);
        ctx.fillRect(0, 11, 16, 1);
        ctx.fillRect(0, 15, 16, 1);
      }),
      logSide: makeTex('#664C33', ['#523B26', '#7A5D41'], ctx => {
        ctx.fillStyle='#493522'; [2,7,13].forEach(x=>ctx.fillRect(x,0,1,16));
        ctx.fillStyle='#8A6A45'; [4,10].forEach(x=>ctx.fillRect(x,1,1,14));
      }),
      logTop: makeTex('#9E815B', ['#876C49', '#B39670'], ctx => {
        ctx.fillStyle='#775B3D'; ctx.fillRect(3,3,10,1); ctx.fillRect(3,12,10,1); ctx.fillRect(3,4,1,8); ctx.fillRect(12,4,1,8);
        ctx.fillStyle='#C1A47B'; ctx.fillRect(6,6,4,1); ctx.fillRect(6,9,4,1); ctx.fillRect(5,7,1,2); ctx.fillRect(10,7,1,2);
      }),
      sand: makeTex('#DBD3A0', ['#CFC58E', '#E6DFB3'], ctx => {
        ctx.fillStyle='#BBAF79'; [[2,3],[11,2],[6,8],[14,11],[3,14],[9,13]].forEach(([x,y])=>ctx.fillRect(x,y,1,1));
        ctx.fillStyle='#F0E8BE'; ctx.fillRect(5,2,2,1); ctx.fillRect(12,7,2,1); ctx.fillRect(1,10,2,1);
      }),
      bricks: makeTex('#964B3B', ['#7D3B2D', '#AD5A49'], ctx => {
        ctx.fillStyle = '#C8C2B8';
        ctx.fillRect(0, 3, 16, 1); ctx.fillRect(0, 7, 16, 1);
        ctx.fillRect(0, 11, 16, 1); ctx.fillRect(0, 15, 16, 1);
        ctx.fillRect(7, 0, 1, 4); ctx.fillRect(3, 4, 1, 4);
        ctx.fillRect(11, 4, 1, 4); ctx.fillRect(7, 8, 1, 4);
      }),
      glass: makeTex('#DDF4FF', ['#EBF9FF'], ctx => {
        ctx.clearRect(2, 2, 12, 12);
        ctx.fillStyle = 'rgba(200, 240, 255, 0.25)';
        ctx.fillRect(2, 2, 12, 12);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(3, 3, 3, 1);
        ctx.fillRect(3, 4, 1, 2);
      }),
      leaves: makeTex('#2D6E1E', ['#1F5213', '#3B8729']),
      autumnLeaves: makeTex('#A87935', ['#8A5A28','#C08A3F','#D6A34E'], ctx => {
        ctx.fillStyle='#E0B55C'; [[2,3],[10,2],[6,7],[13,9],[3,12],[9,14]].forEach(([x,y])=>ctx.fillRect(x,y,2,1));
        ctx.fillStyle='#714923'; ctx.fillRect(5,4,2,2); ctx.fillRect(11,12,2,1);
      }),
      winterLeaves: makeTex('#C9DEE8', ['#AAC7D5','#DDEBF0','#F3F9FC'], ctx => {
        ctx.fillStyle='#FFFFFF'; [[2,3],[8,2],[12,5],[4,8],[10,11],[2,13],[14,14]].forEach(([x,y])=>ctx.fillRect(x,y,2,1));
        ctx.fillStyle='#8EAFBF'; ctx.fillRect(7,5,2,1); ctx.fillRect(5,12,2,1); ctx.fillRect(12,9,2,1);
      }),
      diamond: makeTex('#7D7D7D', ['#686868', '#919191'], ctx => {
        ctx.fillStyle = '#4EE2EC';
        ctx.fillRect(3, 4, 3, 2); ctx.fillRect(10, 3, 2, 3);
        ctx.fillRect(6, 10, 3, 3); ctx.fillRect(11, 11, 2, 2);
      }),
      bedrock: makeTex('#2A2A2A', ['#141414', '#424242']),
      deepstone: makeTex('#45434A', ['#36343A', '#59565D']),
      coalOre: makeTex('#777777', ['#686868', '#898989'], ctx => { for (let i=0;i<5;i++) { ctx.fillStyle='#252525'; ctx.fillRect((i*7+2)%15,(i*5+1)%15,2,2); } }),
      ironOre: makeTex('#777777', ['#686868', '#898989'], ctx => { for (let i=0;i<5;i++) { ctx.fillStyle='#B87352'; ctx.fillRect((i*7+2)%15,(i*5+1)%15,2,2); } }),
      goldOre: makeTex('#777777', ['#686868', '#898989'], ctx => { for (let i=0;i<5;i++) { ctx.fillStyle='#F2C744'; ctx.fillRect((i*7+2)%15,(i*5+1)%15,2,2); } }),
      torch: makeTex('#9A692F', ['#70471F', '#C68E45'], ctx => { ctx.fillStyle='#FFE37A'; ctx.fillRect(6,1,4,4); ctx.fillStyle='#FFF4B0'; ctx.fillRect(7,1,2,2); ctx.fillStyle='#58351D'; ctx.fillRect(7,5,2,10); ctx.fillStyle='#C18A42'; ctx.fillRect(6,8,1,6); }),
      furnaceSide: makeTex('#666666', ['#555555','#7A7A7A'], ctx => {
        ctx.fillStyle='#383838'; ctx.fillRect(2,2,12,1); ctx.fillRect(2,13,12,1);
        ctx.fillStyle='#888888'; ctx.fillRect(3,4,2,1); ctx.fillRect(11,10,2,1);
      }),
      furnaceTop: makeTex('#777777', ['#666666','#898989'], ctx => {
        ctx.fillStyle='#4C4C4C'; ctx.fillRect(2,2,12,1); ctx.fillRect(2,13,12,1); ctx.fillRect(2,3,1,10); ctx.fillRect(13,3,1,10);
        ctx.fillStyle='#969696'; ctx.fillRect(5,5,6,6); ctx.fillStyle='#5B5B5B'; ctx.fillRect(6,6,4,4);
      }),
      furnaceFront: makeTex('#686868', ['#565656','#7B7B7B'], ctx => {
        ctx.fillStyle='#393939'; ctx.fillRect(3,3,10,8); ctx.fillStyle='#171717'; ctx.fillRect(4,4,8,6);
        ctx.fillStyle='#D66A22'; ctx.fillRect(6,7,4,2); ctx.fillStyle='#FFD04A'; ctx.fillRect(7,6,2,2);
        ctx.fillStyle='#949494'; ctx.fillRect(2,12,12,2); ctx.fillRect(4,11,8,1);
      }),
      craftSide: makeTex('#A88754', ['#917243','#BA9966'], ctx => {
        ctx.fillStyle='#65492B'; ctx.fillRect(0,2,16,2); ctx.fillRect(0,13,16,2);
        ctx.fillStyle='#C39B60'; ctx.fillRect(2,5,12,1); ctx.fillRect(2,9,12,1);
        ctx.fillStyle='#785632'; ctx.fillRect(4,6,1,3); ctx.fillRect(11,6,1,3);
      }),
      craftTop: makeTex('#B89662', ['#A5824D','#C9A674'], ctx => {
        ctx.fillStyle='#76552E'; ctx.fillRect(1,1,14,1); ctx.fillRect(1,14,14,1); ctx.fillRect(1,2,1,12); ctx.fillRect(14,2,1,12);
        ctx.fillStyle='#E0C28A'; ctx.fillRect(4,4,8,1); ctx.fillRect(4,11,8,1); ctx.fillRect(4,5,1,6); ctx.fillRect(11,5,1,6);
        ctx.fillStyle='#77552F'; ctx.fillRect(7,6,2,4); ctx.fillRect(5,7,6,2);
      }),
      sapling: makeTex('#315820', ['#315820','#315820'], ctx => {
        ctx.clearRect(0,0,16,16);
        ctx.fillStyle='#6A4A2B'; ctx.fillRect(7,8,2,7); ctx.fillRect(5,11,2,1); ctx.fillRect(9,10,2,1);
        ctx.fillStyle='#2D7B22'; ctx.fillRect(6,3,4,5); ctx.fillRect(4,5,8,3); ctx.fillRect(3,6,2,2); ctx.fillRect(11,4,2,3);
        ctx.fillStyle='#64B53D'; ctx.fillRect(6,4,2,2); ctx.fillRect(10,5,2,1); ctx.fillRect(5,7,2,1);
      }),
      gravel: makeTex('#817E78', ['#696661','#A29E96'], ctx => {
        ctx.fillStyle='#5C5954'; [[2,3],[8,2],[12,5],[4,9],[10,12],[14,9],[6,14]].forEach(([x,y])=>ctx.fillRect(x,y,2,2));
        ctx.fillStyle='#C0BBB0'; [[5,2],[12,2],[1,12],[9,7],[13,14]].forEach(([x,y])=>ctx.fillRect(x,y,1,1));
      }),
      mossy: makeTex('#66665B', ['#53564A','#858477'], ctx => {
        ctx.fillStyle='#315D25'; ctx.fillRect(2,2,4,2); ctx.fillRect(9,3,3,2); ctx.fillRect(5,8,4,2); ctx.fillRect(11,11,3,3); ctx.fillRect(1,13,3,2);
        ctx.fillStyle='#527C38'; ctx.fillRect(3,3,2,1); ctx.fillRect(10,4,2,1); ctx.fillRect(6,9,2,1);
        ctx.fillStyle='#3B3B35'; ctx.fillRect(0,7,16,1); ctx.fillRect(7,0,1,7); ctx.fillRect(12,8,1,8);
      }),
      copperOre: makeTex('#777777', ['#686868','#898989'], ctx => {
        ctx.fillStyle='#B96B43'; [[2,3],[9,2],[12,6],[4,8],[10,12],[3,13]].forEach(([x,y])=>{ctx.fillRect(x,y,3,2);});
        ctx.fillStyle='#E09A63'; ctx.fillRect(3,3,1,1); ctx.fillRect(10,2,1,1); ctx.fillRect(5,9,1,1);
      }),
      emeraldOre: makeTex('#777777', ['#686868','#898989'], ctx => {
        ctx.fillStyle='#1E9B58'; [[2,3],[9,2],[12,7],[4,9],[10,12]].forEach(([x,y])=>{ctx.fillRect(x,y,3,2);});
        ctx.fillStyle='#7DFFC2'; ctx.fillRect(3,3,1,1); ctx.fillRect(10,2,1,1); ctx.fillRect(5,9,1,1);
      }),
      obsidian: makeTex('#211A35', ['#171326','#302548'], ctx => {
        ctx.fillStyle='#463767'; ctx.fillRect(2,2,4,1); ctx.fillRect(9,5,5,1); ctx.fillRect(4,11,3,1);
        ctx.fillStyle='#10101A'; ctx.fillRect(1,7,3,2); ctx.fillRect(11,12,3,2); ctx.fillRect(7,4,1,4);
      }),
      snow: makeTex('#E8F5FF', ['#D1E8F6','#FFFFFF'], ctx => {
        ctx.fillStyle='#A9D0E5'; ctx.fillRect(0,13,16,3); ctx.fillRect(3,11,5,2); ctx.fillRect(11,12,3,1);
        ctx.fillStyle='#FFFFFF'; ctx.fillRect(2,3,3,1); ctx.fillRect(10,6,4,1); ctx.fillRect(6,8,2,1);
      }),
      snowTop: makeTex('#F7FCFF', ['#E8F5FC','#FFFFFF'], ctx => {
        ctx.fillStyle='#D5EAF5'; ctx.fillRect(1,2,2,1); ctx.fillRect(11,3,2,1); ctx.fillRect(5,5,1,1);
        ctx.fillRect(13,8,1,2); ctx.fillRect(3,10,2,1); ctx.fillRect(8,12,2,1); ctx.fillRect(1,14,1,1);
        ctx.fillStyle='#FFFFFF'; ctx.fillRect(2,3,1,1); ctx.fillRect(12,4,1,1); ctx.fillRect(6,6,1,1); ctx.fillRect(9,13,1,1);
      }),
      granite: makeTex('#9C6555', ['#875244','#B47763'], ctx => {
        ctx.fillStyle='#70483D'; ctx.fillRect(3,3,3,2); ctx.fillRect(10,4,4,2); ctx.fillRect(5,11,4,2);
        ctx.fillStyle='#D18A73'; ctx.fillRect(2,8,2,1); ctx.fillRect(11,12,3,1); ctx.fillRect(7,5,2,1);
      }),
      sandstone: makeTex('#D8C38A', ['#C9B47A','#E6D29B'], ctx => {
        ctx.fillStyle='#B6A06D'; ctx.fillRect(0,4,16,1); ctx.fillRect(0,11,16,1);
        ctx.fillStyle='#E8D8AA'; ctx.fillRect(2,2,5,1); ctx.fillRect(9,7,5,1); ctx.fillRect(4,14,7,1);
      }),
      stoneBricks: makeTex('#777777', ['#686868','#898989'], ctx => {
        ctx.fillStyle='#454545'; ctx.fillRect(0,7,16,1); ctx.fillRect(7,0,1,7); ctx.fillRect(3,8,1,8); ctx.fillRect(12,8,1,8);
        ctx.fillStyle='#A2A2A2'; ctx.fillRect(2,3,3,1); ctx.fillRect(9,11,2,1);
      }),
      mossyBricks: makeTex('#68705A', ['#565E4B','#7A8068'], ctx => {
        ctx.fillStyle='#40443A'; ctx.fillRect(0,7,16,1); ctx.fillRect(7,0,1,7); ctx.fillRect(3,8,1,8); ctx.fillRect(12,8,1,8);
        ctx.fillStyle='#35612C'; ctx.fillRect(1,2,4,2); ctx.fillRect(9,3,3,2); ctx.fillRect(5,10,5,2); ctx.fillRect(13,13,2,2);
        ctx.fillStyle='#80A45A'; ctx.fillRect(2,3,2,1); ctx.fillRect(7,11,2,1);
      }),
      polishedGranite: makeTex('#BC806B', ['#A96E5A','#D2947D'], ctx => {
        ctx.fillStyle='#774A3D'; ctx.fillRect(3,3,10,1); ctx.fillRect(3,12,10,1); ctx.fillRect(3,4,1,8); ctx.fillRect(12,4,1,8);
        ctx.fillStyle='#E2A18A'; ctx.fillRect(5,5,6,1); ctx.fillRect(5,10,6,1); ctx.fillRect(5,6,1,4); ctx.fillRect(10,6,1,4);
      }),
      basalt: makeTex('#34343A', ['#25252B','#494950'], ctx => {
        ctx.fillStyle='#1D1D22'; ctx.fillRect(3,0,2,16); ctx.fillRect(10,0,1,16);
        ctx.fillStyle='#62626A'; ctx.fillRect(1,3,2,1); ctx.fillRect(6,8,3,1); ctx.fillRect(12,13,3,1);
      }),
      chestSide: makeTex('#8A552C', ['#704323','#A66B38'], ctx => {
        ctx.fillStyle='#58361F'; ctx.fillRect(0,2,16,2); ctx.fillRect(0,12,16,2);
        ctx.fillStyle='#C28A4A'; ctx.fillRect(2,5,12,1); ctx.fillRect(2,9,12,1);
        ctx.fillStyle='#6A4024'; ctx.fillRect(4,6,1,3); ctx.fillRect(11,6,1,3);
      }),
      chestFront: makeTex('#8A552C', ['#704323','#A66B38'], ctx => {
        ctx.fillStyle='#57351F'; ctx.fillRect(1,2,14,2); ctx.fillRect(1,12,14,2);
        ctx.fillStyle='#B7783D'; ctx.fillRect(2,4,12,8); ctx.fillStyle='#714322'; ctx.fillRect(3,5,10,6);
        ctx.fillStyle='#E1B64D'; ctx.fillRect(7,5,2,5); ctx.fillRect(6,7,4,2);
        ctx.fillStyle='#FFE18A'; ctx.fillRect(7,6,1,2); ctx.fillStyle='#4A2B18'; ctx.fillRect(1,3,1,10); ctx.fillRect(14,3,1,10);
      }),
      chestTop: makeTex('#9A6133', ['#754724','#B8793D'], ctx => {
        ctx.fillStyle='#58361F'; ctx.fillRect(1,1,14,1); ctx.fillRect(1,14,14,1); ctx.fillRect(1,2,1,12); ctx.fillRect(14,2,1,12);
        ctx.fillStyle='#C28A4A'; ctx.fillRect(3,4,10,1); ctx.fillRect(3,10,10,1); ctx.fillRect(3,5,1,5); ctx.fillRect(12,5,1,5);
      }),
      water: makeTex('#397FAE', ['#2D6E9E','#4E94C2','#79B5D7'], ctx => {
        ctx.fillStyle='#A9DFF0'; ctx.fillRect(1,3,5,1); ctx.fillRect(9,7,5,1); ctx.fillRect(4,12,4,1);
        ctx.fillStyle='#24618E'; ctx.fillRect(7,1,2,1); ctx.fillRect(13,13,2,1);
      }),
      cactus: makeTex('#367B3D', ['#2C6934','#438C49','#5CA653'], ctx => {
        ctx.fillStyle='#1F582C'; ctx.fillRect(3,0,2,16); ctx.fillRect(11,0,2,16);
        ctx.fillStyle='#8CCB65'; ctx.fillRect(5,1,1,14); ctx.fillRect(13,2,1,12);
        ctx.fillStyle='#E6E7AE'; [[2,3],[7,6],[10,11],[4,13],[13,4]].forEach(([x,y])=>ctx.fillRect(x,y,1,1));
      }),
      campfire: makeTex('#51402E', ['#3E3024','#72583A','#927044'], ctx => {
        ctx.fillStyle='#30271F'; ctx.fillRect(1,11,14,4);
        ctx.fillStyle='#684B31'; ctx.fillRect(2,9,12,2); ctx.fillRect(4,7,8,2);
        ctx.fillStyle='#C34C21'; ctx.fillRect(5,4,6,5); ctx.fillRect(7,2,3,3);
        ctx.fillStyle='#F7A72D'; ctx.fillRect(6,5,4,4); ctx.fillRect(8,3,2,3);
        ctx.fillStyle='#FFE775'; ctx.fillRect(7,6,2,2);
      }),
      redstoneDust: makeSprite(ctx=>{
        ctx.fillStyle='#64151E'; ctx.fillRect(0,7,16,2); ctx.fillRect(7,0,2,16);
        ctx.fillStyle='#A71D2B'; ctx.fillRect(2,6,3,4); ctx.fillRect(11,6,3,4); ctx.fillRect(6,2,4,3); ctx.fillRect(6,11,4,3);
        ctx.fillStyle='#D62C38'; ctx.fillRect(6,6,4,4);
      }),
      redstoneDustLit: makeSprite(ctx=>{
        ctx.fillStyle='#FF3D37'; ctx.fillRect(0,7,16,2); ctx.fillRect(7,0,2,16);
        ctx.fillStyle='#FFAA58'; ctx.fillRect(2,6,3,4); ctx.fillRect(11,6,3,4); ctx.fillRect(6,2,4,3); ctx.fillRect(6,11,4,3);
        ctx.fillStyle='#FFF09B'; ctx.fillRect(6,6,4,4);
      }),
      leverOff: makeSprite(ctx=>{
        ctx.fillStyle='#33251B'; ctx.fillRect(3,12,10,3);
        ctx.fillStyle='#9A7045'; ctx.fillRect(7,6,2,7); ctx.fillStyle='#D1B17A'; ctx.fillRect(6,4,4,3);
      }),
      leverOn: makeSprite(ctx=>{
        ctx.fillStyle='#33251B'; ctx.fillRect(3,12,10,3);
        ctx.fillStyle='#C49A50'; ctx.fillRect(7,7,2,6); ctx.fillStyle='#FFE47D'; ctx.fillRect(6,4,4,3);
      }),
      lampOff: makeTex('#554C42',['#6F6251','#403A35'],ctx=>{
        ctx.fillStyle='#302A25'; ctx.fillRect(1,1,14,14); ctx.fillStyle='#806D4E'; ctx.fillRect(3,3,10,10);
        ctx.fillStyle='#B08B4B'; ctx.fillRect(5,5,6,6); ctx.fillStyle='#D0B76A'; ctx.fillRect(6,6,4,4);
      }),
      lampLit: makeTex('#F5C45C',['#FFE58A','#F39B45'],ctx=>{
        ctx.fillStyle='#704525'; ctx.fillRect(1,1,14,14); ctx.fillStyle='#FFCF68'; ctx.fillRect(3,3,10,10);
        ctx.fillStyle='#FFF2B0'; ctx.fillRect(5,5,6,6); ctx.fillStyle='#FFFFFF'; ctx.fillRect(7,7,2,2);
      }),
      door: makeTex('#8A552C',['#704323','#A66B38'],ctx=>{
        // Pixel-art oak door: outer frame, inset panels, cross rails and brass handle.
        ctx.fillStyle='#4F301C'; ctx.fillRect(0,0,16,16);
        ctx.fillStyle='#A87340'; ctx.fillRect(2,0,12,16);
        ctx.fillStyle='#704323'; ctx.fillRect(3,1,1,14); ctx.fillRect(12,1,1,14);
        ctx.fillStyle='#B98249'; ctx.fillRect(4,1,8,14);
        ctx.fillStyle='#59371F'; ctx.fillRect(4,2,8,4); ctx.fillRect(4,9,8,4);
        ctx.fillStyle='#8A552C'; ctx.fillRect(5,3,6,2); ctx.fillRect(5,10,6,2);
        ctx.fillStyle='#C28A4A'; ctx.fillRect(5,3,5,1); ctx.fillRect(5,10,5,1);
        ctx.fillStyle='#4D2E1A'; ctx.fillRect(2,7,12,1);
        ctx.fillStyle='#E4B94F'; ctx.fillRect(11,7,2,2); ctx.fillStyle='#FFF0A0'; ctx.fillRect(11,7,1,1);
      }),
      redstoneOre: makeTex('#55515A',['#403C45','#716B72'],ctx=>{
        ctx.fillStyle='#7A1A25'; [[2,3],[10,2],[5,8],[12,10],[2,13],[9,14]].forEach(([x,y])=>ctx.fillRect(x,y,3,2));
        ctx.fillStyle='#D52B35'; ctx.fillRect(3,3,1,1); ctx.fillRect(11,2,1,1); ctx.fillRect(6,8,1,1); ctx.fillRect(13,10,1,1);
      })
    };

    const BLOCKS = [
      { id: 1, name: 'Grass', color: '#4C9A2A', solid: true, transparent: false, dropItem: 2, mat: [
        new THREE.MeshLambertMaterial({ map: TEX.grassSide }), new THREE.MeshLambertMaterial({ map: TEX.grassSide }),
        new THREE.MeshLambertMaterial({ map: TEX.grassTop }), new THREE.MeshLambertMaterial({ map: TEX.dirt }),
        new THREE.MeshLambertMaterial({ map: TEX.grassSide }), new THREE.MeshLambertMaterial({ map: TEX.grassSide })
      ]},
      { id: 2, name: 'Dirt', color: '#79553A', solid: true, transparent: false, mat: new THREE.MeshLambertMaterial({ map: TEX.dirt }) },
      { id: 3, name: 'Stone', color: '#7D7D7D', solid: true, transparent: false, dropItem: 4, requiredPickaxe: 1, mat: new THREE.MeshLambertMaterial({ map: TEX.stone }) },
      { id: 4, name: 'Cobble', color: '#696969', solid: true, transparent: false, requiredPickaxe: 1, mat: new THREE.MeshLambertMaterial({ map: TEX.cobble }) },
      { id: 5, name: 'Planks', color: '#A88754', solid: true, transparent: false, preferredTool:'axe', mat: new THREE.MeshLambertMaterial({ map: TEX.planks }) },
      { id: 6, name: 'Log', color: '#664C33', solid: true, transparent: false, preferredTool:'axe', mat: [
        new THREE.MeshLambertMaterial({ map: TEX.logSide }), new THREE.MeshLambertMaterial({ map: TEX.logSide }),
        new THREE.MeshLambertMaterial({ map: TEX.logTop }), new THREE.MeshLambertMaterial({ map: TEX.logTop }),
        new THREE.MeshLambertMaterial({ map: TEX.logSide }), new THREE.MeshLambertMaterial({ map: TEX.logSide })
      ]},
      { id: 7, name: 'Sand', color: '#DBD3A0', solid: true, transparent: false, mat: new THREE.MeshLambertMaterial({ map: TEX.sand }) },
      { id: 8, name: 'Bricks', color: '#964B3B', solid: true, transparent: false, mat: new THREE.MeshLambertMaterial({ map: TEX.bricks }) },
      { id: 9, name: 'Glass', color: '#88C8E8', solid: true, transparent: true, mat: new THREE.MeshLambertMaterial({ map: TEX.glass, transparent: true, opacity: 0.78 }) },
      { id: 10, name: 'Leaves', color: '#2D6E1E', solid: true, transparent: true, mat: new THREE.MeshLambertMaterial({ map: TEX.leaves }) },
      { id: 11, name: 'Diamond Ore', color: '#4EE2EC', solid: true, transparent: false, dropItem: 103, requiredPickaxe: 3, mat: new THREE.MeshLambertMaterial({ map: TEX.diamond }) },
      { id: 12, name: 'Bedrock', color: '#2A2A2A', solid: true, transparent: false, unbreakable: true, mat: new THREE.MeshLambertMaterial({ map: TEX.bedrock }) },
      { id: 13, name: 'Deepslate', color: '#45434A', solid: true, transparent: false, dropItem: 13, requiredPickaxe: 2, mat: new THREE.MeshLambertMaterial({ map: TEX.deepstone }) },
      { id: 14, name: 'Coal Ore', color: '#555555', solid: true, transparent: false, dropItem: 100, requiredPickaxe: 1, mat: new THREE.MeshLambertMaterial({ map: TEX.coalOre }) },
      { id: 15, name: 'Iron Ore', color: '#B87352', solid: true, transparent: false, dropItem: 101, requiredPickaxe: 2, mat: new THREE.MeshLambertMaterial({ map: TEX.ironOre }) },
      { id: 16, name: 'Gold Ore', color: '#F2C744', solid: true, transparent: false, dropItem: 102, requiredPickaxe: 2, mat: new THREE.MeshLambertMaterial({ map: TEX.goldOre }) },
      { id: 17, name: 'Furnace', color: '#555555', solid: true, transparent: false, mat: [
        new THREE.MeshLambertMaterial({ map:TEX.furnaceSide }), new THREE.MeshLambertMaterial({ map:TEX.furnaceSide }),
        new THREE.MeshLambertMaterial({ map:TEX.furnaceTop }), new THREE.MeshLambertMaterial({ map:TEX.cobble }),
        new THREE.MeshLambertMaterial({ map:TEX.furnaceSide }), new THREE.MeshLambertMaterial({ map:TEX.furnaceFront })
      ] },
      { id: 18, name: 'Crafting Table', color: '#A88754', solid: true, transparent: false, preferredTool:'axe', mat: [
        new THREE.MeshLambertMaterial({ map:TEX.craftSide }), new THREE.MeshLambertMaterial({ map:TEX.craftSide }),
        new THREE.MeshLambertMaterial({ map:TEX.craftTop }), new THREE.MeshLambertMaterial({ map:TEX.planks }),
        new THREE.MeshLambertMaterial({ map:TEX.craftSide }), new THREE.MeshLambertMaterial({ map:TEX.craftSide })
      ] },
      { id: 19, name: 'Torch', color: '#F6D66A', solid: true, transparent: false, mat: new THREE.MeshLambertMaterial({ map: TEX.torch }) },
      { id: 20, name: 'Sapling', color: '#4C9A2A', solid: true, transparent: true, mat: new THREE.MeshLambertMaterial({ map: TEX.sapling, transparent:true }) },
      { id: 21, name: 'Gravel', color: '#817E78', solid: true, transparent: false, mat: new THREE.MeshLambertMaterial({ map:TEX.gravel }) },
      { id: 22, name: 'Mossy Cobble', color: '#66665B', solid: true, transparent: false, requiredPickaxe:1, mat: new THREE.MeshLambertMaterial({ map:TEX.mossy }) },
      { id: 23, name: 'Copper Ore', color: '#B96B43', solid: true, transparent: false, dropItem:111, requiredPickaxe:1, mat: new THREE.MeshLambertMaterial({ map:TEX.copperOre }) },
      { id: 24, name: 'Emerald Ore', color: '#1E9B58', solid: true, transparent: false, dropItem:112, requiredPickaxe:2, mat: new THREE.MeshLambertMaterial({ map:TEX.emeraldOre }) },
      { id: 25, name: 'Obsidian', color: '#211A35', solid: true, transparent: false, requiredPickaxe:4, mat: new THREE.MeshLambertMaterial({ map:TEX.obsidian }) },
      { id: 26, name: 'Snow', color: '#E8F5FF', solid: true, transparent: false, mat: [
        new THREE.MeshLambertMaterial({map:TEX.snow}), new THREE.MeshLambertMaterial({map:TEX.snow}),
        new THREE.MeshLambertMaterial({map:TEX.snowTop}), new THREE.MeshLambertMaterial({map:TEX.snow}),
        new THREE.MeshLambertMaterial({map:TEX.snow}), new THREE.MeshLambertMaterial({map:TEX.snow})
      ] },
      { id: 27, name: 'Granite', color: '#9C6555', solid: true, transparent: false, requiredPickaxe:1, mat: new THREE.MeshLambertMaterial({ map:TEX.granite }) },
      { id: 28, name: 'Sandstone', color: '#D8C38A', solid: true, transparent: false, mat: new THREE.MeshLambertMaterial({ map:TEX.sandstone }) },
      { id: 29, name: 'Stone Bricks', color: '#777777', solid: true, transparent: false, requiredPickaxe:1, mat: new THREE.MeshLambertMaterial({ map:TEX.stoneBricks }) },
      { id: 30, name: 'Mossy Stone Bricks', color: '#68705A', solid: true, transparent: false, requiredPickaxe:1, mat: new THREE.MeshLambertMaterial({ map:TEX.mossyBricks }) },
      { id: 31, name: 'Polished Granite', color: '#BC806B', solid: true, transparent: false, requiredPickaxe:1, mat: new THREE.MeshLambertMaterial({ map:TEX.polishedGranite }) },
      { id: 32, name: 'Basalt', color: '#34343A', solid: true, transparent: false, requiredPickaxe:2, mat: new THREE.MeshLambertMaterial({ map:TEX.basalt }) },
      { id: 33, name: 'Chest', color: '#8A552C', solid: true, transparent: false, preferredTool:'axe', mat: [
        new THREE.MeshLambertMaterial({ map:TEX.chestSide }), new THREE.MeshLambertMaterial({ map:TEX.chestSide }),
        new THREE.MeshLambertMaterial({ map:TEX.chestTop }), new THREE.MeshLambertMaterial({ map:TEX.planks }),
        new THREE.MeshLambertMaterial({ map:TEX.chestSide }), new THREE.MeshLambertMaterial({ map:TEX.chestFront })
      ] },
      { id: 34, name: 'Water', color: '#4B91BD', solid: false, transparent: true, unbreakable: true,
        mat: new THREE.MeshLambertMaterial({ map:TEX.water, transparent:true, opacity:0.68, depthWrite:false }) },
      { id: 35, name: 'Cactus', color: '#3C8745', solid: true, transparent: false, mat: new THREE.MeshLambertMaterial({ map:TEX.cactus }) },
      { id: 36, name: 'Campfire', color: '#D36A2C', solid: true, transparent: false, mat: new THREE.MeshLambertMaterial({ map:TEX.campfire, emissive:0x2A1000 }) },
      { id: 37, name:'Redstone Dust', color:'#A71D2B', solid:false, transparent:true, mat:new THREE.MeshLambertMaterial({map:TEX.redstoneDust,transparent:true}) },
      { id: 38, name:'Lever', color:'#9A7045', solid:false, transparent:true, mat:new THREE.MeshLambertMaterial({map:TEX.leverOff,transparent:true}) },
      { id: 39, name:'Redstone Lamp', color:'#D0B76A', solid:true, transparent:false, mat:new THREE.MeshLambertMaterial({map:TEX.lampOff}) },
      { id: 40, name:'Lit Redstone Lamp', color:'#FFE58A', solid:true, transparent:false, dropItem:39, mat:new THREE.MeshLambertMaterial({map:TEX.lampLit,emissive:0xD36A18,emissiveIntensity:0.9}) },
      { id: 41, name:'Lever On', color:'#FFE47D', solid:false, transparent:true, dropItem:38, mat:new THREE.MeshLambertMaterial({map:TEX.leverOn,transparent:true,emissive:0x815016}) },
      { id: 42, name:'Powered Redstone Dust', color:'#FF3D37', solid:false, transparent:true, dropItem:37, mat:new THREE.MeshLambertMaterial({map:TEX.redstoneDustLit,transparent:true,emissive:0xA80A15}) },
      { id: 43, name:'Redstone Ore', color:'#A52A32', solid:true, transparent:false, dropItem:37, requiredPickaxe:3, mat:new THREE.MeshLambertMaterial({map:TEX.redstoneOre}) },
      { id: 44, name:'Wooden Door', color:'#96602F', solid:true, transparent:true, preferredTool:'axe', geometry:new THREE.BoxGeometry(1,1,0.12), mat:new THREE.MeshLambertMaterial({map:TEX.door}) },
      { id: 45, name:'Oak Stairs', color:'#A88754', solid:true, transparent:false, preferredTool:'axe', geometry:(()=>{const shape=new THREE.Shape();shape.moveTo(-0.5,-0.5);shape.lineTo(0.5,-0.5);shape.lineTo(0.5,0.5);shape.lineTo(0,0.5);shape.lineTo(0,0);shape.lineTo(-0.5,0);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});g.translate(0,0,-0.5);g.rotateY(-Math.PI/2);return g;})(), mat:new THREE.MeshLambertMaterial({map:TEX.planks}) },
      { id: 46, name:'Wooden Door Top', color:'#96602F', solid:true, transparent:true, preferredTool:'axe', geometry:new THREE.BoxGeometry(1,1,0.12), mat:new THREE.MeshLambertMaterial({map:TEX.door}) }
    ];

    const BLOCK_BY_ID = {};
    const ITEM_INFO = {};
    BLOCKS.forEach(b => { BLOCK_BY_ID[b.id] = b; ITEM_INFO[b.id] = { id:b.id, name:b.name, color:b.color, blockId:b.id }; });
    delete ITEM_INFO[40]; delete ITEM_INFO[41]; delete ITEM_INFO[42]; delete ITEM_INFO[46];
    [
      { id:100, name:'Coal', color:'#272727' }, { id:101, name:'Raw Iron', color:'#B87352' },
      { id:102, name:'Raw Gold', color:'#F2C744' }, { id:103, name:'Diamond', color:'#4EE2EC' },
      { id:104, name:'Stick', color:'#9A7045' }, { id:105, name:'Wood Pickaxe', color:'#A88754', toolLevel:1, toolType:'pickaxe' },
      { id:106, name:'Stone Pickaxe', color:'#777777', toolLevel:2, toolType:'pickaxe' },
      { id:107, name:'Iron Pickaxe', color:'#C5C5C5', toolLevel:3, toolType:'pickaxe' },
      { id:108, name:'Diamond Pickaxe', color:'#4EE2EC', toolLevel:4, toolType:'pickaxe' },
      { id:109, name:'Iron Ingot', color:'#D9D9D9' },
      { id:110, name:'Gold Ingot', color:'#F2C744' },
      { id:111, name:'Raw Copper', color:'#B96B43' }, { id:112, name:'Emerald', color:'#1E9B58' },
      { id:113, name:'Copper Ingot', color:'#D27B4B' },
      { id:114, name:'Wood Axe', color:'#A9773F', toolLevel:1, toolType:'axe' },
      { id:115, name:'Stone Axe', color:'#8E8E8E', toolLevel:2, toolType:'axe' },
      { id:116, name:'Iron Axe', color:'#BFC9CE', toolLevel:3, toolType:'axe' },
      { id:117, name:'Diamond Axe', color:'#16B9C7', toolLevel:4, toolType:'axe' },
      { id:118, name:'Raw Meat', color:'#B84D53', foodValue:2 },
      { id:119, name:'Cooked Meat', color:'#9A4F2E', foodValue:6, healValue:2 },
      { id:120, name:'Purified Water Bottle', color:'#42AFC6', thirstValue:8, coolValue:1.5 },
      { id:121, name:'Herbal Poultice', color:'#79A957', healValue:6 },
      { id:122, name:'Warmth Stew', color:'#C9833F', foodValue:6, healValue:1, temperatureValue:2 },
      { id:123, name:'Wool', color:'#E8E0D1' },
      { id:124, name:'Wool Cap', color:'#C9BFAE', equipmentSlot:'head', armor:1, insulation:1 },
      { id:125, name:'Wool Coat', color:'#8B654D', equipmentSlot:'chest', armor:3, insulation:2 },
      { id:126, name:'Wool Trousers', color:'#6A6978', equipmentSlot:'legs', armor:2, insulation:1 },
      { id:127, name:'Wool Boots', color:'#684D3B', equipmentSlot:'feet', armor:1, insulation:1 },
      { id:128, name:'Iron Helmet', color:'#B9C1C4', equipmentSlot:'head', armor:2, insulation:0 },
      { id:129, name:'Iron Chestplate', color:'#B9C1C4', equipmentSlot:'chest', armor:5, insulation:0 },
      { id:130, name:'Iron Leggings', color:'#A2AAAD', equipmentSlot:'legs', armor:4, insulation:0 },
      { id:131, name:'Iron Boots', color:'#929A9D', equipmentSlot:'feet', armor:2, insulation:0 },
      { id:132, name:'Empty Glass Bottle', color:'#B7E3E7' },
      { id:133, name:'Dirty Water Bottle', color:'#806C45' }
    ].forEach(item => ITEM_INFO[item.id] = { ...item, blockId:null });

    const BLOCK_HARDNESS = {
      1:0.6, 2:0.5, 3:1.5, 4:2, 5:2, 6:2, 7:0.5, 8:2, 9:0.3, 10:0.2,
      11:3, 12:Infinity, 13:3.5, 14:3, 15:3, 16:3, 17:3.5, 18:2.5,
      19:0.2, 20:0.1, 21:0.6, 22:2, 23:3, 24:3, 25:18, 26:0.2, 27:1.5,
      28:0.8, 29:1.5, 30:1.5, 31:1.5, 32:2.5, 33:2.5, 34:0.1, 35:0.45, 36:0.6,
      37:0.1, 38:0.5, 39:0.3, 40:0.3, 41:0.5, 42:0.1, 43:3
    };

    function makeSprite(draw) {
      const canvas=document.createElement('canvas'); canvas.width=16; canvas.height=16;
      const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,16,16); draw(ctx);
      const texture=new THREE.CanvasTexture(canvas);
      texture.magFilter=THREE.NearestFilter; texture.minFilter=THREE.NearestFilter;
      if (THREE.sRGBEncoding !== undefined) texture.encoding=THREE.sRGBEncoding;
      return texture;
    }

    const ITEM_TEXTURES = {
      1:TEX.grassTop, 2:TEX.dirt, 3:TEX.stone, 4:TEX.cobble, 5:TEX.planks,
      6:TEX.logTop, 7:TEX.sand, 8:TEX.bricks, 9:TEX.glass, 10:TEX.leaves,
      11:TEX.diamond, 12:TEX.bedrock, 13:TEX.deepstone, 14:TEX.coalOre,
      15:TEX.ironOre, 16:TEX.goldOre, 17:TEX.furnaceFront, 18:TEX.craftTop,
      19:TEX.torch, 20:TEX.sapling, 21:TEX.gravel, 22:TEX.mossy,
      23:TEX.copperOre, 24:TEX.emeraldOre, 25:TEX.obsidian, 26:TEX.snowTop, 27:TEX.granite,
      28:TEX.sandstone, 29:TEX.stoneBricks, 30:TEX.mossyBricks, 31:TEX.polishedGranite, 32:TEX.basalt, 33:TEX.chestFront, 34:TEX.water, 35:TEX.cactus, 36:TEX.campfire,
      37:TEX.redstoneDust, 38:TEX.leverOff, 39:TEX.lampOff, 43:TEX.redstoneOre,
      100:makeSprite(ctx=>{
        ctx.fillStyle='#161616'; ctx.fillRect(4,4,8,8); ctx.fillRect(6,2,5,12); ctx.fillRect(2,6,12,5);
        ctx.fillStyle='#555'; ctx.fillRect(5,4,2,2); ctx.fillRect(9,9,2,2);
      }),
      101:makeSprite(ctx=>{
        ctx.fillStyle='#7D4935'; ctx.fillRect(3,5,10,7); ctx.fillRect(5,3,7,2); ctx.fillRect(2,8,2,3);
        ctx.fillStyle='#D08A63'; ctx.fillRect(4,6,7,2); ctx.fillRect(8,9,3,2);
      }),
      102:makeSprite(ctx=>{
        ctx.fillStyle='#9A6B1B'; ctx.fillRect(3,5,10,7); ctx.fillRect(5,3,7,2); ctx.fillRect(2,8,2,3);
        ctx.fillStyle='#FFE36A'; ctx.fillRect(4,6,7,2); ctx.fillRect(8,9,3,2);
      }),
      103:makeSprite(ctx=>{
        ctx.fillStyle='#138B9B'; ctx.fillRect(5,2,6,2); ctx.fillRect(3,4,10,5); ctx.fillRect(5,9,6,3); ctx.fillRect(7,12,2,2);
        ctx.fillStyle='#8DF7FF'; ctx.fillRect(5,4,3,3); ctx.fillRect(4,7,3,2); ctx.fillStyle='#3AC9D8'; ctx.fillRect(8,8,3,3);
      }),
      132:makeSprite(ctx=>{
        ctx.fillStyle='#79B8C2'; ctx.fillRect(6,2,4,2); ctx.fillRect(5,4,6,2); ctx.fillRect(4,6,8,7); ctx.fillRect(5,13,6,2);
        ctx.fillStyle='#E4FFFF'; ctx.fillRect(6,5,2,6); ctx.fillRect(5,12,2,1); ctx.fillStyle='#5A929C'; ctx.fillRect(10,7,1,5);
      }),
      133:makeSprite(ctx=>{
        ctx.fillStyle='#725534'; ctx.fillRect(6,2,4,2); ctx.fillRect(5,4,6,2); ctx.fillRect(4,6,8,7); ctx.fillRect(5,13,6,2);
        ctx.fillStyle='#97733D'; ctx.fillRect(5,8,6,5); ctx.fillStyle='#C3A45F'; ctx.fillRect(6,6,3,2);
        ctx.fillStyle='#E4FFFF'; ctx.fillRect(5,5,1,3); ctx.fillStyle='#4D3929'; ctx.fillRect(9,9,2,2);
      }),
      123:makeSprite(ctx=>{
        ctx.fillStyle='#D8D0C2'; ctx.fillRect(3,3,10,10); ctx.fillStyle='#F1EADD';
        [[4,2],[8,2],[12,5],[2,7],[6,6],[10,9],[4,12],[12,12]].forEach(([x,y])=>ctx.fillRect(x,y,2,2));
      }),
      124:makeSprite(ctx=>{
        ctx.fillStyle='#75624F'; ctx.fillRect(3,7,10,6); ctx.fillRect(5,4,6,4); ctx.fillRect(7,2,2,3);
        ctx.fillStyle='#D9CEBC'; ctx.fillRect(4,7,8,2); ctx.fillStyle='#4B3C31'; ctx.fillRect(3,12,10,2);
      }),
      125:makeSprite(ctx=>{
        ctx.fillStyle='#704E3B'; ctx.fillRect(4,3,8,11); ctx.fillRect(2,5,3,6); ctx.fillRect(11,5,3,6);
        ctx.fillStyle='#B58A67'; ctx.fillRect(7,4,2,8); ctx.fillStyle='#D5B68A'; ctx.fillRect(6,7,4,1); ctx.fillRect(6,10,4,1);
      }),
      126:makeSprite(ctx=>{
        ctx.fillStyle='#555461'; ctx.fillRect(4,2,8,5); ctx.fillRect(5,6,3,8); ctx.fillRect(9,6,3,8);
        ctx.fillStyle='#928B9A'; ctx.fillRect(5,3,6,2); ctx.fillStyle='#342F3C'; ctx.fillRect(5,12,3,2); ctx.fillRect(9,12,3,2);
      }),
      127:makeSprite(ctx=>{
        ctx.fillStyle='#563F32'; ctx.fillRect(3,4,5,8); ctx.fillRect(9,4,5,8); ctx.fillRect(2,11,6,3); ctx.fillRect(8,11,6,3);
        ctx.fillStyle='#A98460'; ctx.fillRect(4,5,3,4); ctx.fillRect(10,5,3,4); ctx.fillStyle='#34271F'; ctx.fillRect(2,13,6,1); ctx.fillRect(8,13,6,1);
      }),
      128:makeSprite(ctx=>{
        ctx.fillStyle='#707B80'; ctx.fillRect(3,6,10,7); ctx.fillRect(5,3,6,5); ctx.fillRect(6,2,4,2);
        ctx.fillStyle='#DCE3E5'; ctx.fillRect(4,7,8,2); ctx.fillStyle='#40494D'; ctx.fillRect(3,12,10,2);
      }),
      129:makeSprite(ctx=>{
        ctx.fillStyle='#737E82'; ctx.fillRect(4,3,8,11); ctx.fillRect(2,5,3,6); ctx.fillRect(11,5,3,6);
        ctx.fillStyle='#E0E6E8'; ctx.fillRect(5,4,6,2); ctx.fillRect(7,6,2,6); ctx.fillStyle='#465055'; ctx.fillRect(5,12,6,2);
      }),
      130:makeSprite(ctx=>{
        ctx.fillStyle='#697479'; ctx.fillRect(4,2,8,5); ctx.fillRect(5,6,3,8); ctx.fillRect(9,6,3,8);
        ctx.fillStyle='#D2D9DB'; ctx.fillRect(5,3,6,2); ctx.fillStyle='#424B50'; ctx.fillRect(5,12,3,2); ctx.fillRect(9,12,3,2);
      }),
      131:makeSprite(ctx=>{
        ctx.fillStyle='#646F73'; ctx.fillRect(3,5,5,7); ctx.fillRect(9,5,5,7); ctx.fillRect(2,11,6,3); ctx.fillRect(8,11,6,3);
        ctx.fillStyle='#D4DBDD'; ctx.fillRect(4,6,3,3); ctx.fillRect(10,6,3,3); ctx.fillStyle='#3E474B'; ctx.fillRect(2,13,6,1); ctx.fillRect(8,13,6,1);
      }),
      104:makeSprite(ctx=>{
        ctx.fillStyle='#54361E'; for(let i=0;i<10;i++) ctx.fillRect(3+i,13-i,3,1);
        ctx.fillStyle='#C49A62'; for(let i=0;i<8;i++) ctx.fillRect(4+i,12-i,2,1);
      }),
      105:makeSprite(ctx=>{
        ctx.fillStyle='#5B3C22'; for(let i=0;i<10;i++) ctx.fillRect(4+i,13-i,2,1);
        ctx.fillStyle='#A9773F'; ctx.fillRect(3,3,8,2); ctx.fillRect(4,2,6,1); ctx.fillRect(7,4,3,2);
      }),
      106:makeSprite(ctx=>{
        ctx.fillStyle='#59432F'; for(let i=0;i<10;i++) ctx.fillRect(4+i,13-i,2,1);
        ctx.fillStyle='#8E8E8E'; ctx.fillRect(2,3,11,2); ctx.fillRect(4,2,7,1); ctx.fillRect(7,4,5,2);
        ctx.fillStyle='#C5C5C5'; ctx.fillRect(3,3,5,1);
      }),
      107:makeSprite(ctx=>{
        ctx.fillStyle='#59432F'; for(let i=0;i<10;i++) ctx.fillRect(4+i,13-i,2,1);
        ctx.fillStyle='#BFC9CE'; ctx.fillRect(2,3,11,2); ctx.fillRect(4,2,7,1); ctx.fillRect(7,4,5,2);
        ctx.fillStyle='#F4FFFF'; ctx.fillRect(3,3,5,1);
      }),
      108:makeSprite(ctx=>{
        ctx.fillStyle='#59432F'; for(let i=0;i<10;i++) ctx.fillRect(4+i,13-i,2,1);
        ctx.fillStyle='#16B9C7'; ctx.fillRect(2,3,11,2); ctx.fillRect(4,2,7,1); ctx.fillRect(7,4,5,2);
        ctx.fillStyle='#9BFFFF'; ctx.fillRect(3,3,5,1);
      }),
      109:makeSprite(ctx=>{
        ctx.fillStyle='#777'; ctx.fillRect(2,5,12,7); ctx.fillRect(4,3,8,2); ctx.fillRect(4,12,8,1);
        ctx.fillStyle='#E8E8E8'; ctx.fillRect(4,6,7,2); ctx.fillStyle='#AFAFAF'; ctx.fillRect(3,9,9,2);
      }),
      110:makeSprite(ctx=>{
        ctx.fillStyle='#A87516'; ctx.fillRect(2,5,12,7); ctx.fillRect(4,3,8,2); ctx.fillRect(4,12,8,1);
        ctx.fillStyle='#FFE679'; ctx.fillRect(4,6,7,2); ctx.fillStyle='#D7A92F'; ctx.fillRect(3,9,9,2);
      }),
      111:makeSprite(ctx=>{
        ctx.fillStyle='#7F472D'; ctx.fillRect(3,5,10,7); ctx.fillRect(5,3,7,2); ctx.fillStyle='#D48756';
        ctx.fillRect(4,6,7,2); ctx.fillRect(8,9,3,2); ctx.fillStyle='#A85C3A'; ctx.fillRect(3,10,3,1);
      }),
      112:makeSprite(ctx=>{
        ctx.fillStyle='#087344'; ctx.fillRect(5,2,6,2); ctx.fillRect(3,4,10,6); ctx.fillRect(5,10,6,3); ctx.fillRect(7,13,2,1);
        ctx.fillStyle='#8BFFC3'; ctx.fillRect(5,4,3,3); ctx.fillRect(4,7,3,2); ctx.fillStyle='#31C979'; ctx.fillRect(8,8,3,3);
      }),
      113:makeSprite(ctx=>{
        ctx.fillStyle='#914A2D'; ctx.fillRect(2,5,12,7); ctx.fillRect(4,3,8,2); ctx.fillRect(4,12,8,1);
        ctx.fillStyle='#F1A16B'; ctx.fillRect(4,6,7,2); ctx.fillStyle='#BD6841'; ctx.fillRect(3,9,9,2);
      }),
      114:makeAxeSprite('#A9773F','#E2B06B','#5B3C22'),
      115:makeAxeSprite('#8E8E8E','#D4D4D4','#59432F'),
      116:makeAxeSprite('#BFC9CE','#F4FFFF','#59432F'),
      117:makeAxeSprite('#16B9C7','#9BFFFF','#59432F'),
      118:makeSprite(ctx=>{
        ctx.fillStyle='#7F2936'; ctx.fillRect(3,5,10,7); ctx.fillRect(5,3,7,2); ctx.fillStyle='#E37A77'; ctx.fillRect(4,6,7,3); ctx.fillStyle='#F2B1A0'; ctx.fillRect(7,7,3,2); ctx.fillStyle='#5B2028'; ctx.fillRect(3,10,3,2);
      }),
      119:makeSprite(ctx=>{
        ctx.fillStyle='#66351F'; ctx.fillRect(3,5,10,7); ctx.fillRect(5,3,7,2); ctx.fillStyle='#C77B3D'; ctx.fillRect(4,6,7,3); ctx.fillStyle='#F0B45B'; ctx.fillRect(7,7,3,2); ctx.fillStyle='#8A4826'; ctx.fillRect(3,10,3,2);
      }),
      120:makeSprite(ctx=>{
        ctx.fillStyle='#6C4B31'; ctx.fillRect(6,1,4,2); ctx.fillRect(5,3,6,2);
        ctx.fillStyle='#C9F5F7'; ctx.fillRect(4,5,8,8); ctx.fillRect(5,13,6,2);
        ctx.fillStyle='#2B9DB6'; ctx.fillRect(5,9,6,5); ctx.fillRect(6,14,4,1);
        ctx.fillStyle='#F5FFFF'; ctx.fillRect(5,6,2,3); ctx.fillRect(8,5,2,1);
      }),
      121:makeSprite(ctx=>{
        ctx.fillStyle='#3D6936'; ctx.fillRect(3,6,10,7); ctx.fillRect(5,4,6,2);
        ctx.fillStyle='#9BCB68'; ctx.fillRect(4,7,7,2); ctx.fillRect(7,5,2,7);
        ctx.fillStyle='#EFE5C6'; ctx.fillRect(2,9,12,2); ctx.fillRect(6,7,3,6);
        ctx.fillStyle='#B85B54'; ctx.fillRect(7,9,2,2);
      }),
      122:makeSprite(ctx=>{
        ctx.fillStyle='#6A3826'; ctx.fillRect(2,8,12,5); ctx.fillRect(4,13,8,2);
        ctx.fillStyle='#C9833F'; ctx.fillRect(3,7,10,4); ctx.fillStyle='#F2C26C'; ctx.fillRect(5,7,6,2);
        ctx.fillStyle='#7DAD45'; ctx.fillRect(6,5,3,2); ctx.fillRect(9,6,2,1);
        ctx.fillStyle='#E8D4A2'; ctx.fillRect(1,13,14,1);
      })
    };

    function makeAxeSprite(headColor, highlightColor, handleColor) {
      return makeSprite(ctx=>{
        ctx.fillStyle=handleColor;
        for(let i=0;i<10;i++) ctx.fillRect(4+i,13-i,2,1);
        ctx.fillStyle=headColor; ctx.fillRect(2,2,7,2); ctx.fillRect(1,4,6,2); ctx.fillRect(3,6,4,2);
        ctx.fillStyle=highlightColor; ctx.fillRect(3,3,4,1); ctx.fillRect(2,5,3,1);
      });
    }

    function createItemIcon(itemId, className) {
      const canvas=document.createElement('canvas'); canvas.width=32; canvas.height=32;
      canvas.className=className;
      const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false;
      const texture=ITEM_TEXTURES[itemId];
      if (texture && texture.image) ctx.drawImage(texture.image,0,0,32,32);
      return canvas;
    }

    // --- 2. SCENE & RENDERER ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 32, 80);

    const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 150);
    camera.rotation.order = 'YXZ';
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    let graphicsScale=0.85;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio*graphicsScale, 1.25));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const sun = new THREE.DirectionalLight(0xffffff, 0.55);
    sun.position.set(40, 80, 30);
    scene.add(sun);

    function createDroppedItem(itemId,count,position,velocity,age=0) {
      const texture=ITEM_TEXTURES[itemId];
      if (!texture || droppedItems.length>=250) return null;
      const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false});
      const sprite=new THREE.Sprite(material); sprite.scale.set(0.38,0.38,1);
      const pos=new THREE.Vector3(position.x,position.y,position.z);
      sprite.position.copy(pos); scene.add(sprite);
      const record={itemId,count,mesh:sprite,material,pos,vel:new THREE.Vector3(velocity.x,velocity.y,velocity.z),age};
      droppedItems.push(record); return record;
    }
    function spawnDroppedItem(itemId,count=1) {
      const forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
      const position=player.pos.clone().addScaledVector(forward,0.85); position.y-=1.05;
      const velocity=forward.clone().multiplyScalar(2.2); velocity.y=2.2;
      return createDroppedItem(itemId,count,position,velocity,0);
    }
    function removeDroppedItem(index) {
      const record=droppedItems[index];
      if (!record) return;
      scene.remove(record.mesh); record.material.dispose(); droppedItems.splice(index,1);
    }
    function clearDroppedItems() {
      for (let i=droppedItems.length-1;i>=0;i--) removeDroppedItem(i);
    }
    function updateDroppedItems(dt) {
      for (let i=droppedItems.length-1;i>=0;i--) {
        const item=droppedItems[i]; item.age+=dt;
        item.vel.y-=12*dt;
        item.pos.x+=item.vel.x*dt; item.pos.y+=item.vel.y*dt; item.pos.z+=item.vel.z*dt;
        const bx=Math.round(item.pos.x), by=Math.round(item.pos.y-0.18), bz=Math.round(item.pos.z);
        if (item.vel.y<0 && voxelMap.has(keyOf(bx,by,bz))) {
          item.pos.y=by+0.72; item.vel.y=0; item.vel.x*=0.65; item.vel.z*=0.65;
        }
        item.material.rotation=item.age*2.2; item.mesh.position.copy(item.pos);
        if (item.age>0.45 && item.pos.distanceToSquared(player.pos)<1.8*1.8 && inventorySpaceForItem(item.itemId)>0) {
          const taken=addItem(item.itemId,item.count);
          if (taken>0) playSound('pickup');
          item.count-=taken;
          if (item.count<=0) { removeDroppedItem(i); continue; }
        }
        if (item.age>360) removeDroppedItem(i);
      }
    }

    // --- 3. INSTANCED BATCHED RENDERING ---
    const MAX_INSTANCES = 9000;
    const INSTANCE_CAPACITY = { 1:16000, 2:16000, 3:45000, 4:12000, 7:12000, 13:30000, 34:50000, 36:2000 };
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const instancedMeshes = {};
    const dummy = new THREE.Object3D();
    const TREE_TINT_HEX = {
      forest: { wood:0xF0D9B5, leaves:0xC8E8A5 },
      plains: { wood:0xFFE2B5, leaves:0xD8F29C },
      taiga: { wood:0xC5C9C0, leaves:0xA8C9AD },
      winter: { wood:0xC1D0DD, leaves:0xDDEBF2 },
      hot: { wood:0x9D754B, leaves:0xB48643 }
    };
    const CLIMATE_PALETTES=['mild','winter','hot'];

    BLOCKS.forEach(b => {
      if (b.id===1||b.id===6||b.id===10) return;
      const im = new THREE.InstancedMesh(b.geometry||unitBox, b.mat, INSTANCE_CAPACITY[b.id] || MAX_INSTANCES);
      im.count = 0;
      im.frustumCulled = false;
      scene.add(im);
      instancedMeshes[b.id] = im;
    });
    const grassInstancedMeshes={}, grassInstanceCounts={};
    for (const palette of CLIMATE_PALETTES) {
      const grassMaterials=BLOCK_BY_ID[1].mat.map((base,face)=>{
        const material=base.clone();
        if (face!==3&&palette==='winter') material.map=face===2?TEX.snowTop:TEX.snow;
        if (face!==3&&palette==='hot') material.map=face===2?TEX.dryGrassTop:TEX.dryGrassSide;
        return material;
      });
      const mesh=new THREE.InstancedMesh(unitBox,grassMaterials,INSTANCE_CAPACITY[1]||MAX_INSTANCES);
      mesh.count=0; mesh.frustumCulled=false; scene.add(mesh);
      grassInstancedMeshes[palette]=mesh; grassInstanceCounts[palette]=0;
    }
    const treeInstancedMeshes={6:{},10:{}};
    const treeInstanceCounts={6:{},10:{}};
    for (const id of [6,10]) for (const biome of Object.keys(TREE_TINT_HEX)) {
      const tint=TREE_TINT_HEX[biome][id===6?'wood':'leaves'];
      const blockMaterials=BLOCK_BY_ID[id].mat;
      const baseMaterials=Array.isArray(blockMaterials)?blockMaterials:[blockMaterials];
      const tintedMaterials=baseMaterials.map(base=>{
        const material=base.clone(); material.color.setHex(tint);
        if (id===10&&biome==='winter') material.map=TEX.winterLeaves;
        if (id===10&&biome==='hot') material.map=TEX.autumnLeaves;
        return material;
      });
      const im=new THREE.InstancedMesh(unitBox,Array.isArray(blockMaterials)?tintedMaterials:tintedMaterials[0],INSTANCE_CAPACITY[id]||MAX_INSTANCES);
      im.count=0; im.frustumCulled=false; scene.add(im);
      treeInstancedMeshes[id][biome]=im; treeInstanceCounts[id][biome]=0;
    }

    // --- 4. INFINITE CHUNK WORLD (±9000 BLOCKS) ---
    const WORLD_LIMIT = 9000;
    const CHUNK_SIZE = 12;
    let renderDist = 4;
    const voxelMap = new Map();
    // Per-block placement direction and door state are saved and synchronized separately.
    const blockRotations = new Map();
    const openDoors = new Set();
    const voxelKeysByChunk = new Map();
    const REDSTONE_NODE_IDS=new Set([37,38,39,40,41,42]);
    const REDSTONE_NEIGHBORS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const redstoneComponentKeys=new Set();
    const leafDecayTimers = new Map();
    const generatedChunks = new Set();
    const chunkQueue = [];
    const queuedChunks = new Set();
    let activeChunkJob=null;
    let needsMeshRebuild = false;
    let chunksSinceMeshRebuild = 0;
    const CHUNKS_PER_MESH_REBUILD = 4;
    const MAP_XZ_SIZE = 20001;
    const MAP_Y_SIZE = 100001;
    let worldSeed=(Math.random()*4294967296)>>>0;
    let legacyWorldGeneration=false;
    const multiplayerOverrides=new Map();
    const multiplayerOverridesByChunk=new Map();
    const pendingWorldSnapshots=new Map();
    const remotePlayers=new Map();
    let roomDirectoryChannel=null, roomDirectoryPromise=null;
    let multiplayerChannel=null, multiplayerRoomId='', multiplayerRoomCode='', multiplayerClientId='';
    let multiplayerPlayerName='Player', multiplayerIsHost=false, multiplayerRoomMode='classic', multiplayerRoomSeed=0, multiplayerRoomVisibility='private';
    let multiplayerPlayerId='', multiplayerPlayerToken='', multiplayerHostToken='';
    let multiplayerPendingPlayerData=null, multiplayerLoadedSavedWorld=false, multiplayerLastWorldSave=0;
    let multiplayerImportedBackup=false, multiplayerBackupWaiter=null;
    let multiplayerPositionTimer=0;

    // Compact numeric keys avoid building and splitting strings for every voxel.
    function keyOf(x, y, z) {
      return ((x + 10000) * MAP_XZ_SIZE + (z + 10000)) * MAP_Y_SIZE + (y + 50000);
    }
    function chunkIndexKey(chunkX,chunkZ) { return (chunkX+1000)*2001+(chunkZ+1000); }
    function addVoxelKeyToChunk(packedKey,chunkX,chunkZ) {
      const chunkKey=chunkIndexKey(chunkX,chunkZ);
      let keys=voxelKeysByChunk.get(chunkKey);
      if (!keys) { keys=new Set(); voxelKeysByChunk.set(chunkKey,keys); }
      keys.add(packedKey);
    }
    function indexVoxelKey(packedKey) {
      const horizontal=Math.floor(packedKey/MAP_Y_SIZE);
      const x=Math.floor(horizontal/MAP_XZ_SIZE)-10000;
      const z=(horizontal%MAP_XZ_SIZE)-10000;
      addVoxelKeyToChunk(packedKey,Math.floor(x/CHUNK_SIZE),Math.floor(z/CHUNK_SIZE));
    }
    function setVoxelAtKey(packedKey,x,z,id) {
      voxelMap.set(packedKey,id);
      if (REDSTONE_NODE_IDS.has(id)) redstoneComponentKeys.add(packedKey);
      else if (redstoneComponentKeys.has(packedKey)) redstoneComponentKeys.delete(packedKey);
      addVoxelKeyToChunk(packedKey,Math.floor(x/CHUNK_SIZE),Math.floor(z/CHUNK_SIZE));
      return packedKey;
    }
    function setVoxel(x,y,z,id) { return setVoxelAtKey(keyOf(x,y,z),x,z,id); }
    function setPackedVoxel(packedKey,id) {
      voxelMap.set(packedKey,id);
      if (REDSTONE_NODE_IDS.has(id)) redstoneComponentKeys.add(packedKey);
      else if (redstoneComponentKeys.has(packedKey)) redstoneComponentKeys.delete(packedKey);
      indexVoxelKey(packedKey);
    }
    function deleteVoxel(x,y,z) {
      const packedKey=keyOf(x,y,z);
      if (!voxelMap.delete(packedKey)) return;
      redstoneComponentKeys.delete(packedKey);
      leafDecayTimers.delete(packedKey);
      const horizontal=Math.floor(packedKey/MAP_Y_SIZE);
      const blockX=Math.floor(horizontal/MAP_XZ_SIZE)-10000;
      const blockZ=(horizontal%MAP_XZ_SIZE)-10000;
      const chunkKey=chunkIndexKey(Math.floor(blockX/CHUNK_SIZE),Math.floor(blockZ/CHUNK_SIZE));
      const keys=voxelKeysByChunk.get(chunkKey);
      if (keys) { keys.delete(packedKey); if (!keys.size) voxelKeysByChunk.delete(chunkKey); }
    }

    function decodeVoxelPosition(packedKey) {
      const horizontal=Math.floor(packedKey/MAP_Y_SIZE);
      return {
        x:Math.floor(horizontal/MAP_XZ_SIZE)-10000,
        z:(horizontal%MAP_XZ_SIZE)-10000,
        y:(packedKey-horizontal*MAP_Y_SIZE)-50000
      };
    }
    function isValidMultiplayerKey(packedKey) {
      if (!Number.isSafeInteger(packedKey)) return false;
      const pos=decodeVoxelPosition(packedKey);
      return Math.abs(pos.x)<=WORLD_LIMIT&&Math.abs(pos.z)<=WORLD_LIMIT&&pos.y>=-100&&pos.y<=10000;
    }
    function cacheMultiplayerOverride(packedKey,id) {
      multiplayerOverrides.set(packedKey,id);
      const {x,z}=decodeVoxelPosition(packedKey), chunkKey=chunkIndexKey(Math.floor(x/CHUNK_SIZE),Math.floor(z/CHUNK_SIZE));
      let chunkOverrides=multiplayerOverridesByChunk.get(chunkKey);
      if (!chunkOverrides) { chunkOverrides=new Map(); multiplayerOverridesByChunk.set(chunkKey,chunkOverrides); }
      chunkOverrides.set(packedKey,id);
    }
    function sendMultiplayerEvent(event,payload) {
      if (!multiplayerChannel) return;
      multiplayerChannel.send({type:'broadcast',event,payload}).catch(()=>{});
    }
    function recordMultiplayerBlockChange(packedKey,id) {
      if (!multiplayerChannel) return;
      cacheMultiplayerOverride(packedKey,id);
      sendMultiplayerEvent('block-change',{key:packedKey,id,rotation:blockRotations.get(packedKey)||0,open:openDoors.has(packedKey)});
    }
    function applyMultiplayerOverridesForChunk(cx,cz) {
      const overrides=multiplayerOverridesByChunk.get(chunkIndexKey(cx,cz));
      if (!overrides) return;
      let redstoneChanged=false;
      for (const [packedKey,id] of overrides) {
        const oldId=voxelMap.get(packedKey), pos=decodeVoxelPosition(packedKey);
        if (id===null) deleteVoxel(pos.x,pos.y,pos.z);
        else setVoxelAtKey(packedKey,pos.x,pos.z,id);
        if (REDSTONE_NODE_IDS.has(oldId)||REDSTONE_NODE_IDS.has(id)) redstoneChanged=true;
      }
      if (redstoneChanged) recomputeRedstonePower();
    }
    function applyRemoteBlockChange(payload) {
      if (!payload||!isValidMultiplayerKey(payload.key)||(payload.id!==null&&!BLOCK_BY_ID[payload.id])) return;
      const pos=decodeVoxelPosition(payload.key), oldId=voxelMap.get(payload.key);
      if (payload.id===null) { deleteVoxel(pos.x,pos.y,pos.z); blockRotations.delete(payload.key); openDoors.delete(payload.key); }
      else { setVoxelAtKey(payload.key,pos.x,pos.z,payload.id); blockRotations.set(payload.key,Number.isFinite(payload.rotation)?payload.rotation:0); if (payload.open) openDoors.add(payload.key); else openDoors.delete(payload.key); }
      cacheMultiplayerOverride(payload.key,payload.id);
      if (oldId===6) queueLeafDecayAround(pos.x,pos.y,pos.z);
      if (REDSTONE_NODE_IDS.has(oldId)||REDSTONE_NODE_IDS.has(payload.id)) recomputeRedstonePower();
      rebuildVisibleInstances();
    }
    function resetWorldForMultiplayer(seed,overrides=[]) {
      worldSeed=seed>>>0; legacyWorldGeneration=false; seedLabel.textContent=worldSeed;
      voxelMap.clear(); blockRotations.clear(); openDoors.clear(); voxelKeysByChunk.clear(); redstoneComponentKeys.clear(); leafDecayTimers.clear();
      generatedChunks.clear(); chunkQueue.length=0; queuedChunks.clear(); activeChunkJob=null;
      multiplayerOverrides.clear(); multiplayerOverridesByChunk.clear();
      overrides.forEach(entry=>{
        if (!Array.isArray(entry)||!isValidMultiplayerKey(entry[0])||(entry[1]!==null&&!BLOCK_BY_ID[entry[1]])) return;
        if(entry[1]!==null){if(Number.isFinite(entry[2]))blockRotations.set(entry[0],entry[2]);if(entry[3])openDoors.add(entry[0]);}
        cacheMultiplayerOverride(entry[0],entry[1]);
      });
      chestContents.clear(); clearDroppedItems(); clearMobs();
      Object.keys(inventoryCounts).forEach(id=>delete inventoryCounts[id]);
      Object.keys(equippedItems).forEach(slot=>equippedItems[slot]=null);
      hotbarSlots.fill(null); savedSurvivalHotbar=hotbarSlots.slice(); selectedSlot=0;
      player.pos.set(0.5,terrainHeight(0,0)+3.2,0.5); player.vel.set(0,0,0); player.yaw=0; player.pitch=-0.25;
      player.fallStartY=player.pos.y;
      generateChunk(0,0); processChunkGeneration(CHUNK_SIZE*CHUNK_SIZE,Infinity);
      updateChunksAroundPlayer(true); rebuildVisibleInstances();
    }
    function recomputeRedstonePower() {
      const dust=new Map(), lamps=new Map(), leverSources=new Set();
      for (const packedKey of redstoneComponentKeys) {
        const id=voxelMap.get(packedKey);
        if (!REDSTONE_NODE_IDS.has(id)) { redstoneComponentKeys.delete(packedKey); continue; }
        const cell=decodeVoxelPosition(packedKey);
        if (id===37||id===42) dust.set(packedKey,cell);
        else if (id===39||id===40) lamps.set(packedKey,cell);
        else if (id===41) leverSources.add(packedKey);
      }
      const poweredDust=new Set(), queue=[];
      for (const leverKey of leverSources) {
        const lever=decodeVoxelPosition(leverKey);
        for (const [dx,dy,dz] of REDSTONE_NEIGHBORS) {
          const wireKey=keyOf(lever.x+dx,lever.y+dy,lever.z+dz);
          if (dust.has(wireKey)&&!poweredDust.has(wireKey)) {
            poweredDust.add(wireKey); queue.push({key:wireKey,distance:1});
          }
        }
      }
      for (let i=0;i<queue.length;i++) {
        const current=queue[i];
        if (current.distance>=15) continue;
        const cell=dust.get(current.key);
        for (const [dx,dy,dz] of REDSTONE_NEIGHBORS) {
          const nextKey=keyOf(cell.x+dx,cell.y+dy,cell.z+dz);
          if (dust.has(nextKey)&&!poweredDust.has(nextKey)) {
            poweredDust.add(nextKey); queue.push({key:nextKey,distance:current.distance+1});
          }
        }
      }
      let changed=false;
      for (const [packedKey,cell] of dust) {
        const desiredId=poweredDust.has(packedKey)?42:37;
        if (voxelMap.get(packedKey)!==desiredId) { setVoxelAtKey(packedKey,cell.x,cell.z,desiredId); changed=true; }
      }
      for (const [packedKey,cell] of lamps) {
        let powered=false;
        for (const [dx,dy,dz] of REDSTONE_NEIGHBORS) {
          const neighborKey=keyOf(cell.x+dx,cell.y+dy,cell.z+dz);
          if (leverSources.has(neighborKey)||poweredDust.has(neighborKey)) { powered=true; break; }
        }
        const desiredId=powered?40:39;
        if (voxelMap.get(packedKey)!==desiredId) { setVoxelAtKey(packedKey,cell.x,cell.z,desiredId); changed=true; }
      }
      if (changed) { needsMeshRebuild=true; chunksSinceMeshRebuild=CHUNKS_PER_MESH_REBUILD; }
    }
    function toggleRedstoneLeverAt(hit) {
      if (!hit||(hit.id!==38&&hit.id!==41)) return false;
      const nextId=hit.id===38?41:38;
      setVoxel(hit.x,hit.y,hit.z,nextId);
      recordMultiplayerBlockChange(keyOf(hit.x,hit.y,hit.z),nextId);
      recomputeRedstonePower();
      rebuildVisibleInstances();
      playSound('ui');
      return true;
    }

    function hash2D(x, z) {
      if (legacyWorldGeneration) {
        let n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
        return n - Math.floor(n);
      }
      let n=Math.imul(x|0,374761393)+Math.imul(z|0,668265263)+Math.imul(worldSeed|0,1442695041);
      n=Math.imul(n^(n>>>13),1274126177);
      return ((n^(n>>>16))>>>0)/4294967296;
    }
    function valueNoise2D(x,z,scale) {
      const sx=x*scale, sz=z*scale;
      const x0=Math.floor(sx), z0=Math.floor(sz), tx=sx-x0, tz=sz-z0;
      const ux=tx*tx*(3-2*tx), uz=tz*tz*(3-2*tz);
      const a=hash2D(x0,z0), b=hash2D(x0+1,z0);
      const c=hash2D(x0,z0+1), d=hash2D(x0+1,z0+1);
      const top=a+(b-a)*ux, bottom=c+(d-c)*ux;
      return top+(bottom-top)*uz;
    }

    const SEA_LEVEL=12;
    function terrainHeight(x, z) {
      if (legacyWorldGeneration) {
        const h1 = Math.sin(x * 0.055) * 4.2 + Math.cos(z * 0.06) * 3.8;
        const h2 = Math.sin((x + z) * 0.13) * 1.8;
        return Math.max(7, Math.floor(16 + h1 + h2));
      }
      const field=valueNoise2D(x+381,z-971,0.009);
      const distantIsland=Math.max(0,Math.min(1,(field-0.54)/0.15));
      const starterIsland=Math.max(0,Math.min(1,(58-Math.hypot(x*0.94,z*1.06))/28));
      const island=Math.max(distantIsland,starterIsland);
      if (island<0.16) return 6+Math.floor(valueNoise2D(x-611,z+250,0.035)*4);
      const hills=(valueNoise2D(x-230,z+783,0.045)-0.5)*8*island;
      const detail=Math.sin((x+z+(worldSeed%997))*0.035)*1.2*island;
      return Math.max(7,Math.floor(SEA_LEVEL-5+island*24+hills+detail));
    }
    function temperatureAt(x,z,topY=terrainHeight(x,z)) {
      if (legacyWorldGeneration) {
        if ((Math.sin(x*0.025)+Math.cos(z*0.025))>0.80) return 32;
        return topY>=24?-5:15;
      }
      const heat=valueNoise2D(x+1200,z-500,0.009);
      return Math.round(-2+heat*52-Math.max(0,topY-19)*0.55);
    }
    function biomeAt(x,z,topY=terrainHeight(x,z)) {
      if (legacyWorldGeneration) {
        const desertSignal=Math.sin(x*0.025)+Math.cos(z*0.025);
        // Keep legacy worlds too: a narrow forest belt separates old desert
        // regions and high, snowy ground without changing their terrain.
        if (Math.abs(desertSignal-0.80)<=0.08||(topY>=19&&topY<=23)) return 'forest';
        if (desertSignal>0.80) return 'desert';
        return topY>=24?'snowy mountains':'plains';
      }
      const temperature=temperatureAt(x,z,topY), moisture=valueNoise2D(x-701,z+316,0.015);
      if (temperature<=-6) return 'snowy mountains';
      if (temperature>=26&&moisture<0.46) return 'desert';
      // Warm and cold edge bands stay forested so deserts and winter areas do not touch directly.
      if ((temperature>-6&&temperature<=1)||(temperature>=18&&temperature<26)||(temperature>=26&&moisture<0.60)) return 'forest';
      if (temperature<=13&&moisture>0.45) return 'taiga';
      if (moisture>=0.60) return 'forest';
      return 'plains';
    }
    function temperaturePaletteAt(x,z) {
      const temperature=temperatureAt(x,z);
      return temperature<=8?'winter':temperature>=26?'hot':'mild';
    }
    function treeTintPaletteAt(x,z,climate=temperaturePaletteAt(x,z)) {
      return climate==='mild'?biomeAt(x,z):climate;
    }
    function hash3D(x, y, z) {
      let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647);
      if (!legacyWorldGeneration) h+=Math.imul(worldSeed|0,1597334677);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    function isDesert(x, z) {
      return biomeAt(x,z)==='desert';
    }

    function generateChunkColumn(job,columnIndex) {
      const dx=Math.floor(columnIndex/CHUNK_SIZE), dz=columnIndex%CHUNK_SIZE;
      const wx=job.cx*CHUNK_SIZE+dx, wz=job.cz*CHUNK_SIZE+dz;
      if (Math.abs(wx)>WORLD_LIMIT || Math.abs(wz)>WORLD_LIMIT) return;
      const topY=terrainHeight(wx,wz), biome=biomeAt(wx,wz,topY), desert=biome==='desert';
      const localTemperature=temperatureAt(wx,wz,topY);
      const snowSurface=biome==='snowy mountains'||(biome==='taiga'&&localTemperature<=3);
      let beachSurface=false;
      if (!legacyWorldGeneration&&!desert&&!snowSurface&&topY>=SEA_LEVEL&&topY<=SEA_LEVEL+3) {
        outer: for (let radius=1;radius<=3;radius++) {
          for (const [dx,dz] of [[radius,0],[-radius,0],[0,radius],[0,-radius],[radius,radius],[radius,-radius],[-radius,radius],[-radius,-radius]]) {
            if (terrainHeight(wx+dx,wz+dz)<SEA_LEVEL) { beachSurface=true; break outer; }
          }
        }
      }
      setVoxel(wx,-20,wz,12);
      for (let y=-19;y<=topY;y++) {
        const k=keyOf(wx,y,wz);
        const isCave=y<topY-3&&y>-19&&(
          Math.sin(wx*0.12+y*0.11+job.cavePhaseA)+
          Math.cos(wz*0.13-y*0.09+job.cavePhaseB)+
          Math.sin((wx-wz)*0.075+job.cavePhaseC)>2.05);
        if (isCave) continue;
        if (y===topY) { setVoxelAtKey(k,wx,wz,!legacyWorldGeneration&&topY<SEA_LEVEL?7:(desert||beachSurface?7:(snowSurface?26:1))); continue; }
        if (desert&&y>=topY-6&&y<topY-3) { setVoxelAtKey(k,wx,wz,28); continue; }
        if (y>=topY-3) { setVoxelAtKey(k,wx,wz,desert||beachSurface?7:2); continue; }

        let blockId=y<=-7?13:3;
        const oreField=hash3D(Math.floor(wx/3),Math.floor(y/3),Math.floor(wz/3));
        if (y<=-13&&oreField>0.92) blockId=32;
        const oreSpot=hash3D(wx+17,y-23,wz-9);
        if (oreSpot>0.40) {
          if (y<=-15&&oreField<0.003) blockId=25;
          else if (y<=6&&oreField<0.008) blockId=24;
          else if (y<=-9&&oreField<0.025) blockId=11;
          else if (y<=3&&oreField<0.045) blockId=16;
          else if (y<=10&&oreField<0.075) blockId=15;
          else if (y<=12&&oreField<0.14) blockId=23;
          else if (oreField<0.18) blockId=14;
        }
        if (blockId===3&&y>=-2&&y<=10&&hash3D(wx+13,y+27,wz-31)<0.035) blockId=21;
        else if (blockId===3&&y<topY-4&&hash3D(wx-47,y+9,wz+19)<0.012) blockId=22;
        else if (blockId===3&&oreField>0.91) blockId=27;
        if ((blockId===3||blockId===13)&&y<=-12&&hash3D(wx+213,y-71,wz-159)<0.035) blockId=43;
        setVoxelAtKey(k,wx,wz,blockId);
      }

      if (!legacyWorldGeneration&&topY<SEA_LEVEL) {
        for (let y=topY+1;y<=SEA_LEVEL;y++) setVoxel(wx,y,wz,34);
      }

      const treeChance=legacyWorldGeneration?0.022:biome==='forest'?0.085:biome==='taiga'?0.045:biome==='snowy mountains'?0.018:0.008;
      if (topY>=SEA_LEVEL+1&&!desert&&!beachSurface&&dx>=2&&dx<=CHUNK_SIZE-3&&dz>=2&&dz<=CHUNK_SIZE-3&&hash2D(wx,wz)<treeChance) {
        const trunk=4;
        for (let ty=1;ty<=trunk;ty++) setVoxel(wx,topY+ty,wz,6);
        for (let lx=-2;lx<=2;lx++) for (let lz=-2;lz<=2;lz++) for (let ly=trunk-1;ly<=trunk+1;ly++) {
          if (Math.abs(lx)+Math.abs(lz)+Math.abs(ly-trunk)<=3) {
            const lk=keyOf(wx+lx,topY+ly,wz+lz);
            if (!voxelMap.has(lk)) setVoxel(wx+lx,topY+ly,wz+lz,10);
          }
        }
      }
      if (desert&&topY>=SEA_LEVEL+1&&dx>=1&&dx<CHUNK_SIZE-1&&dz>=1&&dz<CHUNK_SIZE-1&&hash2D(wx-23,wz+67)<0.022) {
        const cactusHeight=1+Math.floor(hash2D(wx+331,wz-127)*3);
        for (let cy=1;cy<=cactusHeight;cy++) {
          if (!voxelMap.has(keyOf(wx,topY+cy,wz))) setVoxel(wx,topY+cy,wz,35);
        }
      }
    }

    function generateChunk(cx, cz) {
      const cKey = `${cx},${cz}`;
      if (generatedChunks.has(cKey)||queuedChunks.has(cKey)) return;
      queuedChunks.add(cKey);
      chunkQueue.push({cx,cz,key:cKey,nextColumn:0,
        cavePhaseA:legacyWorldGeneration?0:(worldSeed&65535)*0.00017,
        cavePhaseB:legacyWorldGeneration?0:((worldSeed>>>8)&65535)*0.00013,
        cavePhaseC:legacyWorldGeneration?0:((worldSeed>>>16)&65535)*0.00011});
    }

    function processChunkGeneration(maxColumns=18,timeBudgetMs=2.25) {
      const start=performance.now(); let processed=0;
      while (processed<maxColumns&&performance.now()-start<timeBudgetMs) {
        if (!activeChunkJob&&chunkQueue.length) {
          const pcx=Math.floor(player.pos.x/CHUNK_SIZE), pcz=Math.floor(player.pos.z/CHUNK_SIZE);
          chunkQueue.sort((a,b)=>((a.cx-pcx)**2+(a.cz-pcz)**2)-((b.cx-pcx)**2+(b.cz-pcz)**2));
          activeChunkJob=chunkQueue.shift()||null;
        }
        if (!activeChunkJob) break;
        generateChunkColumn(activeChunkJob,activeChunkJob.nextColumn++);
        processed++;
        if (activeChunkJob.nextColumn>=CHUNK_SIZE*CHUNK_SIZE) {
          applyMultiplayerOverridesForChunk(activeChunkJob.cx,activeChunkJob.cz);
          generatedChunks.add(activeChunkJob.key); queuedChunks.delete(activeChunkJob.key);
          activeChunkJob=null; chunksSinceMeshRebuild++; needsMeshRebuild=true;
        }
      }
    }

    const WATER_NEIGHBORS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const LEAF_NEIGHBORS=[];
    for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++) for (let dz=-1;dz<=1;dz++) {
      if (dx||dy||dz) LEAF_NEIGHBORS.push([dx,dy,dz]);
    }
    function queueLeafDecayAround(x,y,z) {
      const queue=[], cluster=new Map();
      for (const [dx,dy,dz] of LEAF_NEIGHBORS) {
        const leafKey=keyOf(x+dx,y+dy,z+dz);
        if (voxelMap.get(leafKey)===10&&!cluster.has(leafKey)) {
          const leaf={x:x+dx,y:y+dy,z:z+dz,key:leafKey};
          cluster.set(leafKey,leaf); queue.push(leaf);
        }
      }
      const supported=new Set(), supportQueue=[];
      for (let index=0;index<queue.length;index++) {
        const leaf=queue[index];
        for (const [dx,dy,dz] of LEAF_NEIGHBORS) {
          const nx=leaf.x+dx, ny=leaf.y+dy, nz=leaf.z+dz, nextKey=keyOf(nx,ny,nz);
          const nextId=voxelMap.get(nextKey);
          if (nextId===6) {
            for (const [sx,sy,sz] of LEAF_NEIGHBORS) {
              const supportKey=keyOf(nx+sx,ny+sy,nz+sz);
              if (voxelMap.get(supportKey)===10&&!supported.has(supportKey)) {
                supported.add(supportKey); supportQueue.push({key:supportKey,distance:1});
              }
            }
          } else if (nextId===10&&!cluster.has(nextKey)&&cluster.size<512) {
            const nextLeaf={x:nx,y:ny,z:nz,key:nextKey};
            cluster.set(nextKey,nextLeaf); queue.push(nextLeaf);
          }
        }
      }
      for (let index=0;index<supportQueue.length;index++) {
        const support=supportQueue[index];
        if (support.distance>=6) continue;
        const leaf=cluster.get(support.key);
        if (!leaf) continue;
        for (const [dx,dy,dz] of LEAF_NEIGHBORS) {
          const nextKey=keyOf(leaf.x+dx,leaf.y+dy,leaf.z+dz);
          if (voxelMap.get(nextKey)===10&&cluster.has(nextKey)&&!supported.has(nextKey)) {
            supported.add(nextKey); supportQueue.push({key:nextKey,distance:support.distance+1});
          }
        }
      }
      cluster.forEach((leaf,key)=>{
        if (supported.has(key)) leafDecayTimers.delete(key);
        else if (!leafDecayTimers.has(key)) leafDecayTimers.set(key,1.5+Math.random()*2.5);
      });
    }
    function updateLeafDecay(dt) {
      if (!leafDecayTimers.size) return;
      let changed=false;
      for (const [packedKey,timeLeft] of leafDecayTimers) {
        if (voxelMap.get(packedKey)!==10) { leafDecayTimers.delete(packedKey); continue; }
        const nextTime=timeLeft-dt;
        if (nextTime>0) { leafDecayTimers.set(packedKey,nextTime); continue; }
        leafDecayTimers.delete(packedKey);
        const horizontal=Math.floor(packedKey/MAP_Y_SIZE);
        const x=Math.floor(horizontal/MAP_XZ_SIZE)-10000;
        const z=(horizontal%MAP_XZ_SIZE)-10000;
        const y=(packedKey-horizontal*MAP_Y_SIZE)-50000;
        deleteVoxel(x,y,z); recordMultiplayerBlockChange(packedKey,null); changed=true;
        if (Math.random()<0.025&&!addItem(20,1)) spawnDroppedItem(20,1);
      }
      if (changed) { needsMeshRebuild=true; chunksSinceMeshRebuild=CHUNKS_PER_MESH_REBUILD; }
    }
    function isOpaque(x, y, z) {
      const id = voxelMap.get(keyOf(x, y, z));
      if (!id) return false;
      const b = BLOCK_BY_ID[id];
      return b && !b.transparent;
    }
    let grassSpreadTimer=0;
    function updateGrassSpread(dt) {
      grassSpreadTimer-=dt;
      if (grassSpreadTimer>0) return;
      grassSpreadTimer=3.5;
      const centerX=Math.floor(player.pos.x), centerZ=Math.floor(player.pos.z);
      for (let attempt=0;attempt<4;attempt++) {
        const x=centerX+Math.floor(Math.random()*17)-8;
        const z=centerZ+Math.floor(Math.random()*17)-8;
        const surfaceY=terrainHeight(x,z);
        for (let y=surfaceY+1;y>=surfaceY-1;y--) {
          if (voxelMap.get(keyOf(x,y,z))!==2||isOpaque(x,y+1,z)||y<surfaceY-1) continue;
          let adjacentGrass=false;
          for (const [dx,dy,dz] of WATER_NEIGHBORS) {
            if (voxelMap.get(keyOf(x+dx,y+dy,z+dz))===1) { adjacentGrass=true; break; }
          }
          if (adjacentGrass) {
            setVoxel(x,y,z,1); recordMultiplayerBlockChange(keyOf(x,y,z),1);
            needsMeshRebuild=true; chunksSinceMeshRebuild=CHUNKS_PER_MESH_REBUILD;
            return;
          }
        }
      }
    }

    function rebuildVisibleInstances() {
      const counts = {};
      BLOCKS.forEach(b => counts[b.id] = 0);
      for (const id of [6,10]) for (const biome of Object.keys(TREE_TINT_HEX)) treeInstanceCounts[id][biome]=0;
      CLIMATE_PALETTES.forEach(palette=>grassInstanceCounts[palette]=0);

      const px = Math.floor(player.pos.x);
      const pz = Math.floor(player.pos.z);
      const maxDist = (renderDist + 1) * CHUNK_SIZE;
      const minChunkX=Math.floor((px-maxDist)/CHUNK_SIZE), maxChunkX=Math.floor((px+maxDist)/CHUNK_SIZE);
      const minChunkZ=Math.floor((pz-maxDist)/CHUNK_SIZE), maxChunkZ=Math.floor((pz+maxDist)/CHUNK_SIZE);
      const climateCache=new Map();
      const treePaletteCache=new Map();
      const climateForColumn=(x,z)=>{
        const key=keyOf(x,0,z);
        let palette=climateCache.get(key);
        if (!palette) { palette=temperaturePaletteAt(x,z); climateCache.set(key,palette); }
        return palette;
      };
      const treePaletteForColumn=(x,z)=>{
        const key=keyOf(x,0,z);
        let palette=treePaletteCache.get(key);
        if (!palette) { palette=treeTintPaletteAt(x,z,climateForColumn(x,z)); treePaletteCache.set(key,palette); }
        return palette;
      };

      for (let cx=minChunkX;cx<=maxChunkX;cx++) for (let cz=minChunkZ;cz<=maxChunkZ;cz++) {
       const chunkVoxels=voxelKeysByChunk.get(chunkIndexKey(cx,cz));
       if (!chunkVoxels) continue;
       for (const k of chunkVoxels) {
        const id=voxelMap.get(k);
        if (!id) continue;
        const horizontal = Math.floor(k / MAP_Y_SIZE);
        const x = Math.floor(horizontal / MAP_XZ_SIZE) - 10000;
        const z = (horizontal % MAP_XZ_SIZE) - 10000;
        const y = (k - horizontal * MAP_Y_SIZE) - 50000;

        if (Math.abs(x - px) > maxDist || Math.abs(z - pz) > maxDist) continue;

        if (
          isOpaque(x + 1, y, z) && isOpaque(x - 1, y, z) &&
          isOpaque(x, y + 1, z) && isOpaque(x, y - 1, z) &&
          isOpaque(x, y, z + 1) && isOpaque(x, y, z - 1)
        ) {
          continue;
        }
        if (id===34) {
          let exposed=false;
          for (const [dx,dy,dz] of WATER_NEIGHBORS) {
            const neighbor=voxelMap.get(keyOf(x+dx,y+dy,z+dz));
            if (neighbor!==34&&!isOpaque(x+dx,y+dy,z+dz)) { exposed=true; break; }
          }
          if (!exposed) continue;
        }

        dummy.position.set(x,y,z); dummy.rotation.set(0,0,0); dummy.scale.set(1,1,1);
        if (id===37||id===42) {
          dummy.position.y=y-0.46; dummy.scale.set(1,0.06,1);
        } else if (id===38||id===41) {
          dummy.position.y=y-0.2; dummy.scale.set(0.24,0.58,0.24);
          dummy.rotation.z=id===38?-0.3:0.3;
        }
        const packedRotation=blockRotations.get(k)||0;
        if (id===44||id===46) {
          const doorBottomKey=id===46?keyOf(x,y-1,z):k;
          const doorOpen=openDoors.has(doorBottomKey);
          const swing=doorOpen?Math.PI/2:0;
          // Rotate around the left-hand hinge rather than the block centre, so the
          // open panel sits flat along the neighbouring side of the doorway.
          if (doorOpen) {
            dummy.position.x+=-0.5*Math.cos(packedRotation)+0.5*Math.cos(packedRotation+swing);
            dummy.position.z+=0.5*Math.sin(packedRotation)-0.5*Math.sin(packedRotation+swing);
          }
          dummy.rotation.y=packedRotation+swing;
        } else if (id===45||id===17||id===18||id===33) dummy.rotation.y=packedRotation;
        dummy.updateMatrix();
        if (id===1) {
          const palette=climateForColumn(x,z), idx=grassInstanceCounts[palette];
          if (idx< (INSTANCE_CAPACITY[1]||MAX_INSTANCES)) {
            grassInstancedMeshes[palette].setMatrixAt(idx,dummy.matrix);
            grassInstanceCounts[palette]=idx+1;
          }
        } else if (id===6||id===10) {
          const palette=treePaletteForColumn(x,z), mesh=treeInstancedMeshes[id][palette]||treeInstancedMeshes[id].forest;
          const idx=treeInstanceCounts[id][palette]||0;
          if (idx< (INSTANCE_CAPACITY[id]||MAX_INSTANCES)) {
            mesh.setMatrixAt(idx,dummy.matrix);
            treeInstanceCounts[id][palette]=idx+1;
          }
        } else {
          const idx=counts[id];
          if (idx < (INSTANCE_CAPACITY[id] || MAX_INSTANCES)) {
            instancedMeshes[id].setMatrixAt(idx, dummy.matrix);
            counts[id] = idx + 1;
          }
        }
       }
      }

      BLOCKS.forEach(b => {
        if (b.id===1||b.id===6||b.id===10) return;
        const im = instancedMeshes[b.id];
        im.count = counts[b.id];
        im.visible = im.count>0;
        im.instanceMatrix.needsUpdate = true;
      });
      for (const id of [6,10]) for (const biome of Object.keys(TREE_TINT_HEX)) {
        const im=treeInstancedMeshes[id][biome];
        im.count=treeInstanceCounts[id][biome];
        im.visible=im.count>0;
        im.instanceMatrix.needsUpdate=true;
      }
      for (const palette of CLIMATE_PALETTES) {
        const im=grassInstancedMeshes[palette];
        im.count=grassInstanceCounts[palette]; im.visible=im.count>0; im.instanceMatrix.needsUpdate=true;
      }

      needsMeshRebuild = false;
      chunksSinceMeshRebuild = 0;
    }

    let lastQueuedPlayerChunkX=null, lastQueuedPlayerChunkZ=null;
    function updateChunksAroundPlayer(force=false) {
      const pcx = Math.floor(player.pos.x / CHUNK_SIZE);
      const pcz = Math.floor(player.pos.z / CHUNK_SIZE);
      if (!force&&pcx===lastQueuedPlayerChunkX&&pcz===lastQueuedPlayerChunkZ) return;
      lastQueuedPlayerChunkX=pcx; lastQueuedPlayerChunkZ=pcz;

      for (let i=chunkQueue.length-1;i>=0;i--) {
        const job=chunkQueue[i];
        if (Math.abs(job.cx-pcx)>renderDist||Math.abs(job.cz-pcz)>renderDist) {
          queuedChunks.delete(job.key); chunkQueue.splice(i,1);
        }
      }

      for (let r = 0; r <= renderDist; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            const cx = pcx + dx;
            const cz = pcz + dz;
            generateChunk(cx,cz);
          }
        }
      }

    }
    function setRenderDistance(value) {
      renderDist=[2,3,4].includes(Number(value))?Number(value):4;
      renderLabel.textContent=renderDist;
      scene.fog.near=renderDist*8; scene.fog.far=renderDist*20;
      needsMeshRebuild=true;
      updateChunksAroundPlayer(true);
      const setting=document.getElementById('menuRenderDistance');
      if (setting) setting.value=String(renderDist);
    }

    // --- 5. SURVIVAL / CREATIVE & HOTBAR ---
    let isCreative = false;
    let gameMode='classic', lastSurvivalMode='classic';
    let health = 20;
    let hunger = 20, hungerDrainTimer=0, starvationTimer=0;
    let thirst=20, thirstDrainTimer=0, dehydrationTimer=0, healthRegenTimer=0;
    let bodyTemperature=37, thermalExposureTimer=0, thermalSampleTimer=0, thermalAmbient=15;
    let thermalSampleX=NaN, thermalSampleZ=NaN, lastBodyTempDisplay=NaN;
    let selectedSlot = 0;
    const hotbarSlots = [6, 5, 4, 2, 7, 3, 8, 18, 19, null];
    let savedSurvivalHotbar = hotbarSlots.slice();
    const inventoryCounts = Object.create(null);
    const equippedItems={head:null,chest:null,legs:null,feet:null};
    const INVENTORY_SLOT_LIMIT=27, ITEM_STACK_LIMIT=64;
    const chestContents=new Map();
    const droppedItems=[];
    const mobs=[];
    let mobSpawnTimer=0;
    let chestOpenKey=null;
    let craftingTableOpen=false;
    let craftingStationId=null;

    const hotbarEl = document.getElementById('hotbar');
    const heartsEl = document.getElementById('hearts');
    const hungerEl = document.getElementById('hunger');
    const thirstEl = document.getElementById('thirst');
    const bodyTempBarEl = document.getElementById('bodyTempBar');
    const modeLabel = document.getElementById('modeLabel');
    const seedLabel = document.getElementById('seedLabel');
    const biomeLabel = document.getElementById('biomeLabel');
    const temperatureLabel = document.getElementById('temperatureLabel');
    modeLabel.textContent=gameMode.toUpperCase();
    seedLabel.textContent=worldSeed;
    biomeLabel.textContent=biomeAt(0,0);
    temperatureLabel.textContent=`${temperatureAt(0,0)}°C`;
    const inventoryPanel = document.getElementById('inventoryPanel');
    const inventoryGrid = document.getElementById('inventoryGrid');
    const recipeList = document.getElementById('recipeList');
    const stationLabel = document.getElementById('stationLabel');
    const toastEl = document.getElementById('toast');
    const inventoryCapacityEl=document.getElementById('inventoryCapacity');
    const equipmentStatsEl=document.getElementById('equipmentStats');
    const equipmentSlotElements=[...document.querySelectorAll('[data-equipment-slot]')];
    const chestCapacityEl=document.getElementById('chestCapacity');
    const chestSection=document.getElementById('chestSection');
    const recipeSection=document.getElementById('recipeSection');
    const chestGrid=document.getElementById('chestGrid');
    const trashDropZone=document.getElementById('trashDropZone');
    let toastTimer = null;
    let inventoryDragActive=false, suppressInventoryClickUntil=0;

    const RECIPES = [
      { name:'Wooden planks', inputs:{6:1}, outputs:{5:4}, description:'1 Log → 4 Planks' },
      { name:'Sticks', inputs:{5:2}, outputs:{104:4}, description:'2 Planks → 4 Sticks' },
      { name:'Crafting table', inputs:{5:4}, outputs:{18:1}, description:'4 Planks → 1 Crafting Table' },
      { name:'Wood pickaxe', inputs:{5:3,104:2}, outputs:{105:1}, description:'3 Planks + 2 Sticks', needsTable:true },
      { name:'Stone pickaxe', inputs:{4:3,104:2}, outputs:{106:1}, description:'3 Cobblestone + 2 Sticks', needsTable:true },
      { name:'Wood axe', inputs:{5:3,104:2}, outputs:{114:1}, description:'3 Planks + 2 Sticks', needsTable:true },
      { name:'Stone axe', inputs:{4:3,104:2}, outputs:{115:1}, description:'3 Cobblestone + 2 Sticks', needsTable:true },
      { name:'Iron axe', inputs:{109:3,104:2}, outputs:{116:1}, description:'3 Iron Ingots + 2 Sticks', needsTable:true },
      { name:'Diamond axe', inputs:{103:3,104:2}, outputs:{117:1}, description:'3 Diamonds + 2 Sticks', needsTable:true },
      { name:'Iron ingot', inputs:{101:1}, outputs:{109:1}, description:'Smelt raw iron in a furnace', needsFurnace:true },
      { name:'Gold ingot', inputs:{102:1}, outputs:{110:1}, description:'Smelt raw gold in a furnace', needsFurnace:true },
      { name:'Copper ingot', inputs:{111:1}, outputs:{113:1}, description:'Smelt raw copper in a furnace', needsFurnace:true },
      { name:'Cooked Meat', inputs:{118:1}, outputs:{119:1}, description:'Cook raw meat in a furnace', needsFurnace:true },
      { name:'Glass', inputs:{7:1}, outputs:{9:1}, description:'Smelt sand in a furnace', needsFurnace:true },
      { name:'Empty Glass Bottles', inputs:{9:3}, outputs:{132:3}, description:'3 Glass → 3 Empty Glass Bottles', needsTable:true },
      { name:'Herbal Poultice', inputs:{10:3}, outputs:{121:1}, description:'3 Leaves → 1 Herbal Poultice' },
      { name:'Warmth Stew', inputs:{119:1,10:2}, outputs:{122:1}, description:'Cooked Meat + 2 Leaves → 1 Warmth Stew' },
      { name:'Wool Cap', inputs:{123:5}, outputs:{124:1}, description:'5 Wool → 1 warm head covering', needsTable:true },
      { name:'Wool Coat', inputs:{123:8}, outputs:{125:1}, description:'8 Wool → 1 warm body layer', needsTable:true },
      { name:'Wool Trousers', inputs:{123:7}, outputs:{126:1}, description:'7 Wool → 1 warm leg layer', needsTable:true },
      { name:'Wool Boots', inputs:{123:4}, outputs:{127:1}, description:'4 Wool → 1 warm foot layer', needsTable:true },
      { name:'Iron Helmet', inputs:{109:5}, outputs:{128:1}, description:'5 Iron Ingots → 1 helmet', needsTable:true },
      { name:'Iron Chestplate', inputs:{109:8}, outputs:{129:1}, description:'8 Iron Ingots → 1 chestplate', needsTable:true },
      { name:'Iron Leggings', inputs:{109:7}, outputs:{130:1}, description:'7 Iron Ingots → 1 pair of leggings', needsTable:true },
      { name:'Iron Boots', inputs:{109:4}, outputs:{131:1}, description:'4 Iron Ingots → 1 pair of boots', needsTable:true },
      { name:'Iron pickaxe', inputs:{109:3,104:2}, outputs:{107:1}, description:'3 Iron Ingots + 2 Sticks', needsTable:true },
      { name:'Diamond pickaxe', inputs:{103:3,104:2}, outputs:{108:1}, description:'3 Diamonds + 2 Sticks', needsTable:true },
      { name:'Torches', inputs:{100:1,104:1}, outputs:{19:4}, description:'1 Coal + 1 Stick → 4 Torches', needsTable:true },
      { name:'Furnace', inputs:{4:8}, outputs:{17:1}, description:'8 Cobblestone → 1 Furnace', needsTable:true },
      { name:'Campfire', inputs:{6:3,104:3,100:1}, outputs:{36:1}, description:'3 Logs + 3 Sticks + Coal → 1 Campfire', needsTable:true },
      { name:'Sandstone', inputs:{7:4}, outputs:{28:4}, description:'4 Sand → 4 Sandstone', needsTable:true },
      { name:'Stone bricks', inputs:{4:4}, outputs:{29:4}, description:'4 Cobblestone → 4 Stone Bricks', needsTable:true },
      { name:'Mossy stone bricks', inputs:{29:4,10:1}, outputs:{30:4}, description:'4 Stone Bricks + Leaves → 4 Mossy Bricks', needsTable:true },
      { name:'Polished granite', inputs:{27:4}, outputs:{31:4}, description:'4 Granite → 4 Polished Granite', needsTable:true },
      { name:'Basalt', inputs:{13:4}, outputs:{32:4}, description:'4 Deepslate → 4 Basalt', needsTable:true },
      { name:'Chest', inputs:{5:8}, outputs:{33:1}, description:'8 Planks → 1 Chest', needsTable:true },
      { name:'Lever', inputs:{4:1,5:1,104:1}, outputs:{38:1}, description:'1 Cobblestone + 1 Plank + 1 Stick', needsTable:true },
      { name:'Redstone Lamp', inputs:{37:4,9:1}, outputs:{39:1}, description:'4 Redstone Dust + 1 Glass', needsTable:true },
      { name:'Wooden Door', inputs:{5:6}, outputs:{44:1}, description:'6 Planks → 1 Door', needsTable:true },
      { name:'Oak Stairs', inputs:{5:6}, outputs:{45:4}, description:'6 Planks → 4 Stairs', needsTable:true }
    ];

    function worldSaveData() {
      return {
        format:'minecraft-html-world', version:8, seed:worldSeed,
        generation:legacyWorldGeneration?'legacy-v1':'seeded-v8-redstone-islands', savedAt:new Date().toISOString(),
        blocks:Array.from(voxelMap.entries()), blockRotations:Array.from(blockRotations.entries()), openDoors:Array.from(openDoors), generatedChunks:Array.from(generatedChunks),
        leafDecayTimers:Array.from(leafDecayTimers.entries()).filter(([key,time])=>voxelMap.get(key)===10&&Number.isFinite(time)),
        pendingChunks:[...(activeChunkJob?[activeChunkJob]:[]),...chunkQueue].map(job=>({cx:job.cx,cz:job.cz,nextColumn:job.nextColumn})),
        player:{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch,health,hunger,thirst,bodyTemperature,flying:player.flying},
        inventory:{...inventoryCounts}, equipment:{...equippedItems}, hotbar:hotbarSlots.slice(), survivalHotbar:savedSurvivalHotbar.slice(),
        selectedSlot, mode:gameMode, survivalMode:lastSurvivalMode, creative:isCreative, renderDistance:renderDist,
        chests:Array.from(chestContents.entries()),
        mobs:mobs.map(mob=>({kind:mob.kind,x:mob.group.position.x,z:mob.group.position.z,dirX:mob.dirX,dirZ:mob.dirZ,turnTimer:mob.turnTimer,health:mob.health})),
        droppedItems:droppedItems.map(item=>({id:item.itemId,count:item.count,pos:item.pos.toArray(),vel:item.vel.toArray(),age:item.age}))
      };
    }
    function downloadWorldJson() {
      try {
        const data=JSON.stringify(worldSaveData());
        const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
        const link=document.createElement('a');
        link.href=url; link.download=`voxel-world-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
        showToast('World JSON saved');
        return true;
      } catch (error) { showToast('Could not save world JSON'); return false; }
    }
    function loadWorldData(data) {
      if (!data || data.format!=='minecraft-html-world' || ![1,2,3,4,5,6,7,8].includes(data.version) || !Array.isArray(data.blocks) || !Array.isArray(data.generatedChunks)) {
        throw new Error('Invalid world save');
      }
      legacyWorldGeneration=data.version===1 || data.generation==='legacy-v1';
      if (data.version>=2 && !Number.isInteger(data.seed)) throw new Error('World save has no generation seed');
      worldSeed=legacyWorldGeneration?0:(data.seed>>>0);
      seedLabel.textContent=worldSeed;
      voxelMap.clear(); blockRotations.clear(); openDoors.clear(); voxelKeysByChunk.clear(); redstoneComponentKeys.clear(); leafDecayTimers.clear(); generatedChunks.clear(); chunkQueue.length=0; queuedChunks.clear(); activeChunkJob=null;
      data.blocks.forEach(entry=>{
        if (!Array.isArray(entry) || !Number.isSafeInteger(entry[0]) || !BLOCK_BY_ID[entry[1]]) return;
        setPackedVoxel(entry[0],entry[1]);
      });
      (Array.isArray(data.blockRotations)?data.blockRotations:[]).forEach(entry=>{if(Array.isArray(entry)&&Number.isSafeInteger(entry[0])&&Number.isFinite(entry[1])&&voxelMap.has(entry[0]))blockRotations.set(entry[0],entry[1]);});
      (Array.isArray(data.openDoors)?data.openDoors:[]).forEach(key=>{if(Number.isSafeInteger(key)&&voxelMap.get(key)===44)openDoors.add(key);});
      (Array.isArray(data.leafDecayTimers)?data.leafDecayTimers:[]).forEach(entry=>{
        if (Array.isArray(entry)&&Number.isSafeInteger(entry[0])&&voxelMap.get(entry[0])===10&&Number.isFinite(entry[1])&&entry[1]>0) {
          leafDecayTimers.set(entry[0],Math.min(10,entry[1]));
        }
      });
      data.generatedChunks.forEach(key=>{if(typeof key==='string'&&key.length<40)generatedChunks.add(key);});
      Object.keys(inventoryCounts).forEach(id=>delete inventoryCounts[id]);
      Object.entries(data.inventory||{}).forEach(([id,count])=>{
        const n=Number(id);
        if (ITEM_INFO[n] && Number.isInteger(count) && count>0 && count<=ITEM_STACK_LIMIT && Object.keys(inventoryCounts).length<INVENTORY_SLOT_LIMIT) inventoryCounts[n]=count;
      });
      Object.keys(equippedItems).forEach(slot=>{
        const itemId=Number(data.equipment&&data.equipment[slot]);
        equippedItems[slot]=ITEM_INFO[itemId]&&ITEM_INFO[itemId].equipmentSlot===slot?itemId:null;
      });
      const loadedHotbar=Array.from({length:10},(_,i)=>data.hotbar&&data.hotbar[i]!==undefined&&ITEM_INFO[data.hotbar[i]]?data.hotbar[i]:null);
      clearDuplicateHotbarItems(loadedHotbar);
      hotbarSlots.splice(0,hotbarSlots.length,...loadedHotbar);
      savedSurvivalHotbar=Array.from({length:10},(_,i)=>data.survivalHotbar&&data.survivalHotbar[i]!==undefined&&ITEM_INFO[data.survivalHotbar[i]]?data.survivalHotbar[i]:null);
      clearDuplicateHotbarItems(savedSurvivalHotbar);
      selectedSlot=Number.isInteger(data.selectedSlot)?Math.max(0,Math.min(9,data.selectedSlot)):0;
      gameMode=['realistic','classic','creative'].includes(data.mode)?data.mode:(data.creative?'creative':'classic');
      lastSurvivalMode=['realistic','classic'].includes(data.survivalMode)?data.survivalMode:(gameMode==='realistic'?'realistic':'classic');
      isCreative=!!data.creative||gameMode==='creative';
      modeLabel.textContent=isCreative?'CREATIVE':gameMode.toUpperCase();
      health=Number.isFinite(data.player&&data.player.health)?Math.max(0,Math.min(20,data.player.health)):20;
      hunger=Number.isFinite(data.player&&data.player.hunger)?Math.max(0,Math.min(20,data.player.hunger)):20;
      thirst=Number.isFinite(data.player&&data.player.thirst)?Math.max(0,Math.min(20,data.player.thirst)):20;
      bodyTemperature=Number.isFinite(data.player&&data.player.bodyTemperature)?Math.max(30,Math.min(43,data.player.bodyTemperature)):37;
      thermalExposureTimer=0; thermalSampleTimer=0; thermalSampleX=NaN; thermalSampleZ=NaN; lastBodyTempDisplay=NaN;
      const savedPlayer=data.player||{};
      const px=Number.isFinite(savedPlayer.x)&&Math.abs(savedPlayer.x)<=WORLD_LIMIT?savedPlayer.x:0.5;
      const py=Number.isFinite(savedPlayer.y)&&savedPlayer.y>-100&&savedPlayer.y<10000?savedPlayer.y:terrainHeight(0,0)+3.2;
      const pz=Number.isFinite(savedPlayer.z)&&Math.abs(savedPlayer.z)<=WORLD_LIMIT?savedPlayer.z:0.5;
      player.pos.set(px,py,pz); player.vel.set(0,0,0);
      biomeLabel.textContent=biomeAt(Math.floor(px),Math.floor(pz));
      temperatureLabel.textContent=`${temperatureAt(Math.floor(px),Math.floor(pz))}°C`;
      player.yaw=Number.isFinite(savedPlayer.yaw)?savedPlayer.yaw:0;
      player.pitch=Number.isFinite(savedPlayer.pitch)?Math.max(-1.55,Math.min(1.55,savedPlayer.pitch)):-0.25;
      player.flying=isCreative&&!!savedPlayer.flying;
      (Array.isArray(data.pendingChunks)?data.pendingChunks:[]).forEach(job=>{
        if (!Number.isInteger(job.cx)||!Number.isInteger(job.cz)||Math.abs(job.cx)>Math.ceil(WORLD_LIMIT/CHUNK_SIZE)||Math.abs(job.cz)>Math.ceil(WORLD_LIMIT/CHUNK_SIZE)) return;
        const key=`${job.cx},${job.cz}`;
        if (generatedChunks.has(key)) return;
        generateChunk(job.cx,job.cz);
        const queued=chunkQueue.find(entry=>entry.key===key);
        if (queued) queued.nextColumn=Math.max(0,Math.min(CHUNK_SIZE*CHUNK_SIZE-1,Number.isInteger(job.nextColumn)?job.nextColumn:0));
      });
      renderDist=[2,3,4].includes(data.renderDistance)?data.renderDistance:4;
      renderLabel.textContent=renderDist; scene.fog.near=renderDist*8; scene.fog.far=renderDist*20;
      lastQueuedPlayerChunkX=null; lastQueuedPlayerChunkZ=null; updateChunksAroundPlayer(true);
      chestContents.clear();
      (Array.isArray(data.chests)?data.chests:[]).forEach(entry=>{
        if (!Array.isArray(entry)||!Number.isSafeInteger(entry[0])||voxelMap.get(entry[0])!==33) return;
        const contents=Object.create(null);
        Object.entries(entry[1]||{}).forEach(([id,count])=>{
          const n=Number(id);
          if (ITEM_INFO[n]&&Number.isInteger(count)&&count>0&&count<=ITEM_STACK_LIMIT&&Object.keys(contents).length<INVENTORY_SLOT_LIMIT) contents[n]=count;
        });
        chestContents.set(entry[0],contents);
      });
      clearDroppedItems();
      (Array.isArray(data.droppedItems)?data.droppedItems:[]).forEach(item=>{
        if (!ITEM_INFO[item.id]||!Number.isInteger(item.count)||item.count<1||!Array.isArray(item.pos)||item.pos.length<3||!item.pos.every(Number.isFinite)) return;
        const pos=new THREE.Vector3(item.pos[0],item.pos[1],item.pos[2]);
        const vel=Array.isArray(item.vel)&&item.vel.length>=3&&item.vel.every(Number.isFinite)?new THREE.Vector3(item.vel[0],item.vel[1],item.vel[2]):new THREE.Vector3();
        createDroppedItem(item.id,Math.min(item.count,ITEM_STACK_LIMIT),pos,vel,Number.isFinite(item.age)?item.age:0);
      });
      restoreMobs(data.mobs);
      if (gameStarted) ensureMobPopulation();
      chestOpenKey=null; craftingTableOpen=false; stopMining(); mineInputHeld=false;
      hungerDrainTimer=0; starvationTimer=0; thirstDrainTimer=0; dehydrationTimer=0; healthRegenTimer=0;
      syncInventoryToHotbar();
      recomputeRedstonePower();
      rebuildVisibleInstances(); renderHotbar(); renderHearts();
      if (inventoryPanel.classList.contains('open')) renderInventory();
      showToast('World loaded');
    }

    function showToast(message) {
      toastEl.textContent = message;
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1500);
    }
    function addItem(itemId, amount=1) {
      if (!ITEM_INFO[itemId] || amount<=0) return 0;
      if (!isCreative) clearUnavailableHotbarSlots();
      const current=inventoryCounts[itemId]||0;
      if (!isCreative && current===0 && Object.keys(inventoryCounts).length>=INVENTORY_SLOT_LIMIT) return 0;
      const added=Math.min(amount,ITEM_STACK_LIMIT-current);
      if (added<=0) return 0;
      inventoryCounts[itemId]=current+added;
      assignInventoryItemToHotbar(itemId);
      renderHotbar();
      if (inventoryPanel.classList.contains('open')) renderInventory();
      return added;
    }
    function clearUnavailableHotbarSlots() {
      if (isCreative) return;
      for (let i=0;i<hotbarSlots.length;i++) {
        const itemId=hotbarSlots[i];
        if (itemId!==null && !(inventoryCounts[itemId]||0)) hotbarSlots[i]=null;
      }
    }
    function assignInventoryItemToHotbar(itemId) {
      if (!isCreative) clearUnavailableHotbarSlots();
      if (hotbarSlots.includes(itemId)) return;
      const nextSlot=hotbarSlots.indexOf(null);
      if (nextSlot>=0) hotbarSlots[nextSlot]=itemId;
    }
    function clearDuplicateHotbarItems(slots,preferredSlot=-1) {
      const order=preferredSlot>=0&&preferredSlot<slots.length
        ? [preferredSlot,...slots.map((_,index)=>index).filter(index=>index!==preferredSlot)]
        : slots.map((_,index)=>index);
      const seen=new Set();
      for (const index of order) {
        const itemId=slots[index];
        if (itemId===null) continue;
        if (seen.has(itemId)) slots[index]=null;
        else seen.add(itemId);
      }
    }
    function moveItemToHotbar(itemId,targetSlot) {
      if (!ITEM_INFO[itemId]||!Number.isInteger(targetSlot)||targetSlot<0||targetSlot>=hotbarSlots.length) return;
      const sourceSlot=hotbarSlots.findIndex((id,index)=>index!==targetSlot&&id===itemId);
      const displacedItem=hotbarSlots[targetSlot];
      if (sourceSlot>=0) hotbarSlots[sourceSlot]=displacedItem===itemId?null:displacedItem;
      hotbarSlots[targetSlot]=itemId;
      clearDuplicateHotbarItems(hotbarSlots,targetSlot);
    }
    function syncInventoryToHotbar() {
      if (isCreative) return;
      clearUnavailableHotbarSlots();
      Object.keys(inventoryCounts).forEach(id=>assignInventoryItemToHotbar(Number(id)));
    }
    function inventorySpaceForItem(itemId) {
      if (!ITEM_INFO[itemId]) return 0;
      const current=inventoryCounts[itemId]||0;
      if (current>=ITEM_STACK_LIMIT) return 0;
      if (!isCreative && current===0 && Object.keys(inventoryCounts).length>=INVENTORY_SLOT_LIMIT) return 0;
      return ITEM_STACK_LIMIT-current;
    }
    function canAddItems(outputs) {
      if (isCreative) return true;
      let used=Object.keys(inventoryCounts).length;
      for (const [id,amount] of Object.entries(outputs)) {
        const current=inventoryCounts[id]||0;
        if (current+amount>ITEM_STACK_LIMIT) return false;
        if (current===0 && amount>0) used++;
      }
      return used<=INVENTORY_SLOT_LIMIT;
    }
    function equippedArmorRating() {
      return Object.values(equippedItems).reduce((total,itemId)=>total+(ITEM_INFO[itemId]?.armor||0),0);
    }
    function equippedInsulation() {
      return Object.values(equippedItems).reduce((total,itemId)=>total+(ITEM_INFO[itemId]?.insulation||0),0);
    }
    function renderEquipment() {
      equipmentSlotElements.forEach(element=>{
        const slot=element.dataset.equipmentSlot, itemId=equippedItems[slot], item=itemId===null?null:ITEM_INFO[itemId];
        element.classList.toggle('equipped',!!item);
        element.innerHTML=item
          ? `<span class="equipment-slot-label">${slot==='chest'?'Body':slot[0].toUpperCase()+slot.slice(1)}</span><img class="equipment-icon" alt="" src="${createItemIcon(itemId,'').toDataURL()}"><span class="equipment-item-name">${item.name}</span>`
          : `<span class="equipment-slot-label">${slot==='chest'?'Body':slot[0].toUpperCase()+slot.slice(1)}</span><span>Empty</span>`;
        element.title=item?`${item.name} · ${item.armor||0} armor · ${item.insulation||0} insulation · click to remove`:`Drop ${slot} clothing or armor here`;
      });
      const armor=equippedArmorRating(), insulation=equippedInsulation();
      equipmentStatsEl.textContent=`Armor ${armor} · insulation ${insulation} · slows heat and cold changes in Realistic mode`;
    }
    function equipItem(itemId,origin='player') {
      const item=ITEM_INFO[itemId], slot=item&&item.equipmentSlot;
      if (!slot||!Object.prototype.hasOwnProperty.call(equippedItems,slot)) { showToast('That item does not fit an equipment slot'); return; }
      if (origin!=='player'&&origin!=='hotbar') { showToast('Move clothing into your backpack before equipping it'); return; }
      if (equippedItems[slot]===itemId) return;
      const previous=equippedItems[slot];
      if (!isCreative && !(inventoryCounts[itemId]>0)) { showToast('You do not have that clothing item'); return; }
      if (previous!==null&&!isCreative&&!canAddItems({[previous]:1})) { showToast('Inventory full'); return; }
      if (!isCreative) {
        inventoryCounts[itemId]--;
        if (inventoryCounts[itemId]<=0) delete inventoryCounts[itemId];
        clearUnavailableHotbarSlots();
        if (previous!==null) addItem(previous,1);
      }
      equippedItems[slot]=itemId;
      renderHotbar(); renderInventory();
      showToast(`Equipped ${item.name}`);
    }
    function unequipItem(slot) {
      const itemId=equippedItems[slot];
      if (itemId===null||itemId===undefined) return;
      if (!isCreative&&!addItem(itemId,1)) { showToast('Inventory full'); return; }
      equippedItems[slot]=null;
      renderHotbar(); renderInventory();
      showToast(`Removed ${ITEM_INFO[itemId].name}`);
    }
    function hasItems(inputs) {
      return Object.entries(inputs).every(([id, amount]) => (inventoryCounts[id] || 0) >= amount);
    }
    function isCraftingTableNearby() {
      const px=Math.round(player.pos.x), py=Math.round(player.pos.y), pz=Math.round(player.pos.z);
      for (let x=px-4; x<=px+4; x++) for (let y=py-4; y<=py+4; y++) for (let z=pz-4; z<=pz+4; z++) {
        if (voxelMap.get(keyOf(x,y,z))===18 && (x-px)**2+(y-py)**2+(z-pz)**2<=16) return true;
      }
      return false;
    }
    function isFurnaceNearby() {
      const px=Math.round(player.pos.x), py=Math.round(player.pos.y), pz=Math.round(player.pos.z);
      for (let x=px-4; x<=px+4; x++) for (let y=py-4; y<=py+4; y++) for (let z=pz-4; z<=pz+4; z++) {
        if (voxelMap.get(keyOf(x,y,z))===17 && (x-px)**2+(y-py)**2+(z-pz)**2<=16) return true;
      }
      return false;
    }
    function craftRecipe(recipe) {
      if (recipe.needsTable && (!craftingTableOpen||craftingStationId!==18)) return showToast('Open a crafting table to make that');
      if (recipe.needsFurnace && ![17,36].includes(craftingStationId)) return showToast('Open a furnace or campfire to make that');
      if (!isCreative && !hasItems(recipe.inputs)) return showToast('Not enough materials');
      if (!canAddItems(recipe.outputs)) return showToast('Inventory full');
      if (!isCreative) Object.entries(recipe.inputs).forEach(([id,amount]) => {
        inventoryCounts[id]-=amount;
        if (inventoryCounts[id]<=0) delete inventoryCounts[id];
      });
      Object.entries(recipe.outputs).forEach(([id,amount]) => addItem(Number(id),amount));
      playSound('craft');
      renderHotbar(); renderInventory(); showToast(`Crafted ${recipe.name}`);
    }
    function setDragData(event,itemId,origin,slotIndex=null) {
      event.dataTransfer.setData('text/plain',JSON.stringify({itemId,origin,slotIndex}));
      event.dataTransfer.effectAllowed='move';
    }
    function transferInventoryToChest(itemId) {
      if (chestOpenKey===null) return;
      const contents=chestContents.get(chestOpenKey)||Object.create(null);
      const current=contents[itemId]||0;
      const available=isCreative?ITEM_STACK_LIMIT:(inventoryCounts[itemId]||0);
      if (!available) return;
      if (current===0 && Object.keys(contents).length>=INVENTORY_SLOT_LIMIT) { showToast('Chest is full'); return; }
      const moved=Math.min(available,ITEM_STACK_LIMIT-current);
      if (!moved) { showToast('That chest stack is full'); return; }
      contents[itemId]=current+moved; chestContents.set(chestOpenKey,contents);
      sendMultiplayerEvent('chest-change',{key:chestOpenKey,contents:{...contents}});
      if (!isCreative) {
        inventoryCounts[itemId]-=moved;
        if (inventoryCounts[itemId]<=0) delete inventoryCounts[itemId];
      }
      renderHotbar(); renderInventory();
    }
    function transferChestToInventory(itemId) {
      if (chestOpenKey===null) return;
      const contents=chestContents.get(chestOpenKey)||Object.create(null);
      const current=contents[itemId]||0;
      if (isCreative && current>0) {
        let slot=hotbarSlots.indexOf(itemId);
        if (slot<0) slot=hotbarSlots.indexOf(null);
        if (slot<0) slot=selectedSlot;
        hotbarSlots[slot]=itemId; selectedSlot=slot;
        delete contents[itemId]; chestContents.set(chestOpenKey,contents);
        sendMultiplayerEvent('chest-change',{key:chestOpenKey,contents:{...contents}});
        renderHotbar(); renderInventory();
        return;
      }
      const moved=addItem(itemId,current);
      if (!moved) { showToast('Inventory full'); return; }
      contents[itemId]-=moved;
      if (contents[itemId]<=0) delete contents[itemId];
      chestContents.set(chestOpenKey,contents);
      sendMultiplayerEvent('chest-change',{key:chestOpenKey,contents:{...contents}});
      renderInventory();
    }
    function createItemCard(itemId,count,origin) {
      const item=ITEM_INFO[itemId];
      const card=document.createElement('button'); card.type='button'; card.draggable=true;
      card.className=`inv-item ${origin==='player'&&hotbarSlots[selectedSlot]===itemId?'selected':''}`;
      card.innerHTML=`<span>${item.name}</span><span class="inv-count">${isCreative&&origin==='player'?'∞':count}</span>`;
      card.prepend(createItemIcon(itemId,'inventory-icon'));
      card.title=origin==='player'?(item.equipmentSlot?'Click to wear; drag to matching slot':chestOpenKey!==null?'Click or drag to store':'Click to move or swap into the selected hotbar slot; drag onto a hotbar slot to move it'):'Click or drag to take from chest';
      card.addEventListener('click',event=>{
        if (inventoryDragActive || performance.now()<suppressInventoryClickUntil) { event.preventDefault(); return; }
        if (origin==='player' && chestOpenKey!==null) transferInventoryToChest(itemId);
        else if (origin==='chest') transferChestToInventory(itemId);
        else if (item.equipmentSlot) equipItem(itemId,'player');
        else { moveItemToHotbar(itemId,selectedSlot); renderHotbar(); renderInventory(); }
      });
      card.addEventListener('dragstart',event=>{inventoryDragActive=true;setDragData(event,itemId,origin);});
      return card;
    }
    function renderChest() {
      chestGrid.innerHTML='';
      if (chestOpenKey===null) return;
      const contents=chestContents.get(chestOpenKey)||Object.create(null);
      chestContents.set(chestOpenKey,contents);
      Object.entries(contents).forEach(([id,count])=>chestGrid.appendChild(createItemCard(Number(id),count,'chest')));
      chestCapacityEl.textContent=`${Object.keys(contents).length} / ${INVENTORY_SLOT_LIMIT} slots · stacks up to ${ITEM_STACK_LIMIT}`;
    }
    function renderInventory() {
      if (!inventoryPanel.classList.contains('open')) return;
      inventoryGrid.innerHTML='';
      const inChest=chestOpenKey!==null;
      recipeSection.hidden=inChest; chestSection.hidden=!inChest;
      recipeSection.querySelector('h3').textContent=craftingStationId===18?'Crafting Table':craftingStationId===17?'Furnace':craftingStationId===36?'Campfire':'Hand Crafting';
      trashDropZone.hidden=false;
      trashDropZone.textContent=isCreative?'Drag a hotbar item here to remove it':'Drag a hotbar stack here to drop it';
      inventoryCapacityEl.textContent=isCreative?'Creative inventory · unlimited items':`${Object.keys(inventoryCounts).length} / ${INVENTORY_SLOT_LIMIT} slots · stacks up to ${ITEM_STACK_LIMIT}`;
      renderEquipment();
      const available=Object.values(ITEM_INFO).filter(item=>isCreative||(inventoryCounts[item.id]||0)>0);
      available.forEach(item=>inventoryGrid.appendChild(createItemCard(item.id,inventoryCounts[item.id]||0,'player')));
      if (inChest) {
        stationLabel.textContent='Chest storage · click or drag stacks between the chest and your backpack.';
        renderChest();
        return;
      }
      const tableNearby=craftingTableOpen||isCraftingTableNearby(), furnaceNearby=isFurnaceNearby();
      stationLabel.textContent=craftingStationId===18?'Crafting table · hand-crafted recipes and table recipes are available here.':craftingStationId===17?'Furnace · smelting and cooking recipes are available here.':craftingStationId===36?'Campfire · cooking and heating recipes are available here.':'Hand crafting · simple recipes only. Use a crafting table or furnace for station recipes.';
      recipeList.innerHTML='';
      const shownRecipes=RECIPES.filter(recipe=>craftingStationId===18?!recipe.needsFurnace:([17,36].includes(craftingStationId)?!!recipe.needsFurnace:!recipe.needsTable&&!recipe.needsFurnace));
      shownRecipes.forEach(recipe=>{
        const button=document.createElement('button');
        const ready=(isCreative||hasItems(recipe.inputs))&&(!recipe.needsTable||craftingStationId===18)&&(!recipe.needsFurnace||[17,36].includes(craftingStationId))&&canAddItems(recipe.outputs);
        button.type='button'; button.className='recipe'; button.disabled=!ready;
        const outputName=Object.keys(recipe.outputs).map(id=>`${ITEM_INFO[id].name} ×${recipe.outputs[id]}`).join(', ');
        const stationNote='';
        button.innerHTML=`<strong>${recipe.name} → ${outputName}</strong><small>${recipe.description}${stationNote}</small>`;
        button.addEventListener('click',()=>craftRecipe(recipe)); recipeList.appendChild(button);
      });
    }
    function toggleInventory(forceOpen=null) {
      const wasOpen=inventoryPanel.classList.contains('open');
      const open=forceOpen===null?!inventoryPanel.classList.contains('open'):forceOpen;
      inventoryPanel.classList.toggle('open',open);
      if (open!==wasOpen) playSound('ui');
      if (open) {
        renderInventory();
        if (document.pointerLockElement) document.exitPointerLock();
      } else if (gameStarted) {
        craftingTableOpen=false; craftingStationId=null;
        requestGamePointerLock();
      } else {
        craftingTableOpen=false; craftingStationId=null;
      }
    }
    function renderHotbar() {
      hotbarEl.innerHTML='';
      hotbarSlots.forEach((itemId,i)=>{
        const item=itemId===null?null:ITEM_INFO[itemId], div=document.createElement('div');
        const count=itemId===null?0:(inventoryCounts[itemId]||0);
        const hasItem=!!item&&(isCreative||count>0);
        div.className=`slot ${i===selectedSlot?'active':''} ${!hasItem?'empty':''}`;
        div.draggable=hasItem;
        div.style.backgroundColor='#303030';
        const countText=isCreative?'∞':count;
        const keyLabel=i===9?'0':String(i+1);
        div.innerHTML=`<span class="key">${keyLabel}</span><span class="item-label">${hasItem?item.name:''}</span><span class="count">${hasItem?countText:''}</span>`;
        div.title=hasItem?`${item.name} · drag to remove/drop`:'Empty hotbar slot';
        if (hasItem) div.insertBefore(createItemIcon(itemId,'hotbar-icon'),div.querySelector('.item-label'));
        div.onmousedown=e=>e.stopPropagation();
        div.addEventListener('click',event=>{
          if (inventoryDragActive || performance.now()<suppressInventoryClickUntil) { event.preventDefault(); return; }
          selectedSlot=i; renderHotbar(); renderInventory();
        });
        if (hasItem) div.addEventListener('dragstart',event=>{inventoryDragActive=true;setDragData(event,itemId,'hotbar',i);});
        div.addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='move';div.classList.add('drag-over');});
        div.addEventListener('dragleave',()=>div.classList.remove('drag-over'));
        div.addEventListener('drop',event=>{
          event.preventDefault(); event.stopPropagation(); div.classList.remove('drag-over');
          inventoryDragActive=false; suppressInventoryClickUntil=performance.now()+500;
          let payload;
          try { payload=JSON.parse(event.dataTransfer.getData('text/plain')); } catch (_) { payload=null; }
          if (!payload||!ITEM_INFO[payload.itemId]) return;
          if (payload.origin==='hotbar') {
            const sourceSlot=Number(payload.slotIndex);
            if (!Number.isInteger(sourceSlot)||sourceSlot<0||sourceSlot>=hotbarSlots.length||hotbarSlots[sourceSlot]!==payload.itemId) return;
            [hotbarSlots[sourceSlot],hotbarSlots[i]]=[hotbarSlots[i],hotbarSlots[sourceSlot]];
            clearDuplicateHotbarItems(hotbarSlots,i);
          } else if (payload.origin==='player') moveItemToHotbar(Number(payload.itemId),i);
          else return;
          selectedSlot=i; renderHotbar(); renderInventory();
        });
        hotbarEl.appendChild(div);
      });
    }

    function renderHearts() {
      if (isCreative) {
        heartsEl.innerHTML = '';
      } else {
        let out = '';
        for (let i = 0; i < 10; i++) out += (health >= (i + 1) * 2) ? '❤️' : '🖤';
        heartsEl.innerHTML = out;
      }
      renderHunger();
      renderThirst();
      renderBodyTemperature();
    }
    function renderHunger() {
      if (isCreative) { hungerEl.innerHTML=''; return; }
      let out='';
      for (let i=0;i<10;i++) out+=hunger>=(i+1)*2?'🍗':'▫️';
      hungerEl.innerHTML=out;
    }
    function renderThirst() {
      if (isCreative||gameMode!=='realistic') { thirstEl.innerHTML=''; thirstEl.title=''; return; }
      let out='';
      for (let i=0;i<10;i++) out+=thirst>=(i+1)*2?'💧':'▫️';
      thirstEl.innerHTML=out;
      thirstEl.title=`Thirst: ${thirst}/20`;
    }
    function renderBodyTemperature() {
      if (isCreative||gameMode!=='realistic') {
        bodyTempBarEl.innerHTML=''; bodyTempBarEl.title=''; bodyTempBarEl.className='';
        bodyTempBarEl.removeAttribute('role'); bodyTempBarEl.removeAttribute('aria-valuemin'); bodyTempBarEl.removeAttribute('aria-valuemax');
        bodyTempBarEl.removeAttribute('aria-valuenow'); bodyTempBarEl.removeAttribute('aria-valuetext');
        return;
      }
      const position=Math.max(0,Math.min(100,((bodyTemperature-30)/14)*100));
      const state=bodyTemperature<35?'TOO COLD':bodyTemperature>39?'TOO HOT':'COMFORTABLE';
      bodyTempBarEl.className=`temperature-status ${bodyTemperature<35?'cold':bodyTemperature>39?'hot':'comfortable'}`;
      bodyTempBarEl.innerHTML=`<div class="temperature-meter"><div class="temperature-title">BODY TEMPERATURE</div><div class="temperature-track"><span class="temperature-center"></span><span class="temperature-pointer" style="left:${position}%"></span></div><div class="temperature-scale"><span>30° COLD</span><span>37° OK</span><span>44° HOT</span></div></div><span class="temperature-reading">${bodyTemperature.toFixed(1)}°C<br><small>${state}</small></span>`;
      bodyTempBarEl.title=`Body temperature: ${bodyTemperature.toFixed(1)}°C · ${state.toLowerCase()}`;
      bodyTempBarEl.setAttribute('role','meter'); bodyTempBarEl.setAttribute('aria-valuemin','30'); bodyTempBarEl.setAttribute('aria-valuemax','44');
      bodyTempBarEl.setAttribute('aria-valuenow',bodyTemperature.toFixed(1)); bodyTempBarEl.setAttribute('aria-valuetext',`${bodyTemperature.toFixed(1)} degrees Celsius, ${state.toLowerCase()}`);
      lastBodyTempDisplay=Math.round(bodyTemperature*10)/10;
    }
    function eatSelectedFood() {
      if (isCreative) { showToast('Survival items are not needed in Creative'); return true; }
      const itemId=hotbarSlots[selectedSlot], item=ITEM_INFO[itemId];
      if (!item||(!item.foodValue&&!item.thirstValue&&!item.healValue&&!item.coolValue&&!item.temperatureValue)||(inventoryCounts[itemId]||0)<=0) return false;
      let used=false;
      if (item.foodValue&&hunger<20) { hunger=Math.min(20,hunger+item.foodValue); hungerDrainTimer=0; starvationTimer=0; used=true; }
      if (item.thirstValue&&gameMode==='realistic'&&thirst<20) { thirst=Math.min(20,thirst+item.thirstValue); thirstDrainTimer=0; dehydrationTimer=0; used=true; }
      if (item.healValue&&health<20) { health=Math.min(20,health+item.healValue); healthRegenTimer=0; used=true; }
      if (item.coolValue&&gameMode==='realistic'&&bodyTemperature>37) { bodyTemperature=Math.max(37,bodyTemperature-item.coolValue); thermalExposureTimer=0; used=true; }
      if (item.temperatureValue&&gameMode==='realistic'&&bodyTemperature<37) { bodyTemperature=Math.min(37,bodyTemperature+item.temperatureValue); thermalExposureTimer=0; used=true; }
      if (!used) {
        if (item.thirstValue&&gameMode!=='realistic') showToast('Purified water restores thirst in Realistic mode');
        else if ((item.foodValue===undefined||hunger>=20)&&(item.thirstValue===undefined||thirst>=20)&&(item.healValue===undefined||health>=20)) showToast('Your needs are already full');
        else showToast(`Cannot use ${item.name} right now`);
        return true;
      }
      if (itemId===120&&!isCreative) {
        const hasRoomForEmpty=inventorySpaceForItem(132)>0||((inventoryCounts[itemId]||0)===1&&(inventoryCounts[132]||0)<ITEM_STACK_LIMIT);
        if (!hasRoomForEmpty) { showToast('Make room for the empty bottle first'); return true; }
      }
      inventoryCounts[itemId]--;
      if (inventoryCounts[itemId]<=0) delete inventoryCounts[itemId];
      if (itemId===120) addItem(132,1);
      renderHotbar(); renderInventory(); renderHearts();
      showToast(`Used ${item.name}`);
      return true;
    }

    function toggleMode() {
      isCreative = !isCreative;
      if (isCreative) {
        savedSurvivalHotbar=hotbarSlots.slice();
        hotbarSlots.fill(null);
      } else {
        if (gameMode==='creative') gameMode=lastSurvivalMode;
        hotbarSlots.splice(0,hotbarSlots.length,...savedSurvivalHotbar);
        player.flying=false;
        syncInventoryToHotbar();
      }
      modeLabel.textContent=isCreative?'CREATIVE':gameMode.toUpperCase();
      renderHotbar(); renderHearts(); renderInventory();
      showToast(isCreative?'Creative mode: unlimited blocks and flight':`${gameMode[0].toUpperCase()+gameMode.slice(1)} mode`);
    }

    renderHotbar();
    renderHearts();

    // --- 6. PLAYER PHYSICS & CONTROLS ---
    const spawnY = terrainHeight(0, 0) + 3.2;
    const player = {
      pos: new THREE.Vector3(0.5, spawnY, 0.5),
      vel: new THREE.Vector3(0, 0, 0),
      height: 1.62,
      radius: 0.28,
      speed: 6.2,
      jumpForce: 8.2,
      onGround: false,
      inWater: false,
      flying: false,
      yaw: 0,
      pitch: -0.25,
      fallStartY: spawnY
    };

    const MOB_BODY_GEO=new THREE.BoxGeometry(0.9,0.62,0.58);
    const MOB_HEAD_GEO=new THREE.BoxGeometry(0.42,0.42,0.42);
    const MOB_LEG_GEO=new THREE.BoxGeometry(0.17,0.42,0.17);
    const MOB_EYE_GEO=new THREE.BoxGeometry(0.055,0.07,0.035);
    const MOB_SNOUT_GEO=new THREE.BoxGeometry(0.24,0.16,0.1);
    const MOB_HORN_GEO=new THREE.BoxGeometry(0.09,0.18,0.09);
    const MOB_PATCH_GEO=new THREE.BoxGeometry(0.28,0.22,0.04);
    const MOB_EYE_MAT=new THREE.MeshLambertMaterial({color:0x171513});
    const MOB_TYPES={
      pig:{body:new THREE.MeshLambertMaterial({color:0xd78391}),head:new THREE.MeshLambertMaterial({color:0xe49aa3}),detail:new THREE.MeshLambertMaterial({color:0xb85f70})},
      sheep:{body:new THREE.MeshLambertMaterial({color:0xe5dfcc}),head:new THREE.MeshLambertMaterial({color:0xc8b99d}),detail:new THREE.MeshLambertMaterial({color:0xaaa18f})},
      cow:{body:new THREE.MeshLambertMaterial({color:0xe8e2d5}),head:new THREE.MeshLambertMaterial({color:0x55483d}),detail:new THREE.MeshLambertMaterial({color:0x423930})}
    };
    function addMobPart(group,geometry,material,x,y,z) {
      const mesh=new THREE.Mesh(geometry,material); mesh.position.set(x,y,z); group.add(mesh); return mesh;
    }
    function createMob(kind,x,z,dirX=null,dirZ=null,turnTimer=null,health=10) {
      if (!MOB_TYPES[kind]) kind='sheep';
      const group=new THREE.Group(), materials=MOB_TYPES[kind], legs=[];
      addMobPart(group,MOB_BODY_GEO,materials.body,0,0.62,0);
      addMobPart(group,MOB_HEAD_GEO,materials.head,0,0.78,-0.43);
      for (const lx of [-0.27,0.27]) for (const lz of [-0.19,0.19]) legs.push(addMobPart(group,MOB_LEG_GEO,materials.detail,lx,0.22,lz));
      addMobPart(group,MOB_EYE_GEO,MOB_EYE_MAT,-0.11,0.84,-0.647);
      addMobPart(group,MOB_EYE_GEO,MOB_EYE_MAT,0.11,0.84,-0.647);
      if (kind==='pig') addMobPart(group,MOB_SNOUT_GEO,materials.detail,0,0.68,-0.69);
      if (kind==='cow') {
        addMobPart(group,MOB_HORN_GEO,materials.detail,-0.17,1.04,-0.42);
        addMobPart(group,MOB_HORN_GEO,materials.detail,0.17,1.04,-0.42);
        addMobPart(group,MOB_PATCH_GEO,materials.detail,0.26,0.7,-0.296);
        addMobPart(group,MOB_PATCH_GEO,materials.detail,-0.3,0.56,0.12);
      }
      const healthCanvas=document.createElement('canvas'); healthCanvas.width=64; healthCanvas.height=8;
      const healthTexture=new THREE.CanvasTexture(healthCanvas); healthTexture.magFilter=THREE.NearestFilter; healthTexture.minFilter=THREE.NearestFilter;
      const healthBar=new THREE.Sprite(new THREE.SpriteMaterial({map:healthTexture,transparent:true,depthTest:false}));
      healthBar.scale.set(0.8,0.1,1); healthBar.position.set(0,1.42,0); healthBar.visible=false; group.add(healthBar);
      group.position.set(x,terrainHeight(Math.floor(x),Math.floor(z))+0.5,z);
      scene.add(group);
      const angle=Math.random()*Math.PI*2;
      const mob={kind,group,legs,dirX:dirX===null?Math.cos(angle):dirX,dirZ:dirZ===null?Math.sin(angle):dirZ,
        turnTimer:turnTimer===null?1+Math.random()*4:turnTimer,phase:Math.random()*Math.PI*2,
        health:Math.max(1,Math.min(10,Number.isFinite(health)?health:10)),maxHealth:10,healthBar,healthCanvas,healthTexture,healthBarTimer:0};
      mob.group.rotation.y=Math.atan2(-mob.dirX,-mob.dirZ);
      mobs.push(mob);
      if (mob.health<mob.maxHealth) refreshMobHealthBar(mob);
      return mob;
    }
    function refreshMobHealthBar(mob) {
      const ctx=mob.healthCanvas.getContext('2d');
      ctx.clearRect(0,0,64,8); ctx.fillStyle='#34221f'; ctx.fillRect(0,0,64,8);
      ctx.fillStyle=mob.health>5?'#62d85c':'#e7a53d'; ctx.fillRect(1,1,62*(mob.health/mob.maxHealth),6);
      mob.healthTexture.needsUpdate=true; mob.healthBar.visible=true; mob.healthBarTimer=2.5;
    }
    function removeMob(index) {
      const mob=mobs[index]; if (!mob) return;
      scene.remove(mob.group); mob.healthTexture.dispose(); mob.healthBar.material.dispose(); mobs.splice(index,1);
    }
    const REMOTE_PLAYER_BODY_GEO=new THREE.BoxGeometry(0.56,0.9,0.34);
    const REMOTE_PLAYER_HEAD_GEO=new THREE.BoxGeometry(0.42,0.42,0.42);
    const REMOTE_PLAYER_LEG_GEO=new THREE.BoxGeometry(0.19,0.48,0.2);
    function createRemotePlayer(id,name) {
      let hue=0; for (let i=0;i<id.length;i++) hue=(hue*31+id.charCodeAt(i))%360;
      const bodyMaterial=new THREE.MeshLambertMaterial({color:new THREE.Color(`hsl(${hue}, 58%, 49%)`)});
      const headMaterial=new THREE.MeshLambertMaterial({color:new THREE.Color(`hsl(${hue}, 43%, 72%)`)});
      const group=new THREE.Group();
      const body=new THREE.Mesh(REMOTE_PLAYER_BODY_GEO,bodyMaterial); body.position.y=0.92; group.add(body);
      const head=new THREE.Mesh(REMOTE_PLAYER_HEAD_GEO,headMaterial); head.position.set(0,1.62,-0.02); group.add(head);
      const leftLeg=new THREE.Mesh(REMOTE_PLAYER_LEG_GEO,bodyMaterial); leftLeg.position.set(-0.15,0.24,0); group.add(leftLeg);
      const rightLeg=new THREE.Mesh(REMOTE_PLAYER_LEG_GEO,bodyMaterial); rightLeg.position.set(0.15,0.24,0); group.add(rightLeg);
      const labelCanvas=document.createElement('canvas'); labelCanvas.width=160; labelCanvas.height=36;
      const ctx=labelCanvas.getContext('2d'); ctx.fillStyle='rgba(15,18,14,0.78)'; ctx.fillRect(2,2,156,32);
      ctx.font='bold 18px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff';
      ctx.fillText(String(name||'Player').slice(0,18),80,18,148);
      const labelTexture=new THREE.CanvasTexture(labelCanvas); labelTexture.magFilter=THREE.NearestFilter;
      const labelMaterial=new THREE.SpriteMaterial({map:labelTexture,transparent:true,depthWrite:false});
      const label=new THREE.Sprite(labelMaterial); label.scale.set(1.5,0.34,1); label.position.y=2.12; group.add(label);
      scene.add(group);
      const position=player.pos.clone(); position.y-=player.height;
      group.position.copy(position);
      const remote={id,name:String(name||'Player').slice(0,18),group,target:position.clone(),yaw:0,bodyMaterial,headMaterial,labelMaterial,labelTexture};
      remotePlayers.set(id,remote); return remote;
    }
    function updateRemotePlayer(payload) {
      if (!payload||typeof payload.clientId!=='string'||payload.clientId===multiplayerClientId||typeof payload.name!=='string') return;
      const values=[payload.x,payload.y,payload.z,payload.yaw];
      if (!values.every(Number.isFinite)||Math.abs(payload.x)>WORLD_LIMIT||Math.abs(payload.z)>WORLD_LIMIT||payload.y<-100||payload.y>10000) return;
      let remote=remotePlayers.get(payload.clientId);
      if (!remote) remote=createRemotePlayer(payload.clientId,payload.name);
      remote.name=String(payload.name).slice(0,18); remote.target.set(payload.x,payload.y-player.height,payload.z); remote.yaw=payload.yaw;
    }
    function syncRemotePlayersFromPresence() {
      if (!multiplayerChannel) return;
      const active=new Set();
      Object.values(multiplayerChannel.presenceState()).forEach(entries=>entries.forEach(entry=>{
        if (!entry||typeof entry.clientId!=='string'||entry.clientId===multiplayerClientId) return;
        active.add(entry.clientId);
        let remote=remotePlayers.get(entry.clientId);
        if (!remote) remote=createRemotePlayer(entry.clientId,entry.name||'Player');
      }));
      for (const id of remotePlayers.keys()) if (!active.has(id)) {
        const remote=remotePlayers.get(id); scene.remove(remote.group);
        remote.bodyMaterial.dispose(); remote.headMaterial.dispose(); remote.labelTexture.dispose(); remote.labelMaterial.dispose();
        remotePlayers.delete(id);
      }
      multiplayerCountEl.textContent=String(active.size+1);
    }
    function clearRemotePlayers() {
      for (const remote of remotePlayers.values()) {
        scene.remove(remote.group); remote.bodyMaterial.dispose(); remote.headMaterial.dispose();
        remote.labelTexture.dispose(); remote.labelMaterial.dispose();
      }
      remotePlayers.clear(); multiplayerCountEl.textContent='1';
    }
    function animateRemotePlayers(dt) {
      for (const remote of remotePlayers.values()) {
        remote.group.position.lerp(remote.target,Math.min(1,dt*14));
        let angle=remote.group.rotation.y, delta=((remote.yaw-angle+Math.PI*3)%(Math.PI*2))-Math.PI;
        remote.group.rotation.y=angle+delta*Math.min(1,dt*12);
      }
    }
    function clearMobs() {
      while (mobs.length) removeMob(mobs.length-1);
      mobSpawnTimer=0;
    }
    function spawnMobsNearPlayer(targetCount=5) {
      let attempts=0;
      while (mobs.length<targetCount&&attempts<targetCount*12) {
        attempts++;
        const angle=Math.random()*Math.PI*2, distance=7+Math.random()*12;
        const x=Math.max(-WORLD_LIMIT+2,Math.min(WORLD_LIMIT-2,player.pos.x+Math.cos(angle)*distance));
        const z=Math.max(-WORLD_LIMIT+2,Math.min(WORLD_LIMIT-2,player.pos.z+Math.sin(angle)*distance));
        const gx=Math.floor(x), gz=Math.floor(z), ground=terrainHeight(gx,gz);
        if (ground<=SEA_LEVEL||isDesert(gx,gz)||voxelMap.has(keyOf(gx,ground+1,gz))||voxelMap.has(keyOf(gx,ground+2,gz))) continue;
        createMob(['pig','sheep','cow'][Math.floor(Math.random()*3)],x,z);
      }
    }
    function ensureMobPopulation() { if (!mobs.length) spawnMobsNearPlayer(5); }
    function restoreMobs(saved) {
      clearMobs();
      if (!Array.isArray(saved)) return;
      saved.slice(0,10).forEach(mob=>{
        if (!MOB_TYPES[mob.kind]||!Number.isFinite(mob.x)||!Number.isFinite(mob.z)||Math.abs(mob.x)>WORLD_LIMIT||Math.abs(mob.z)>WORLD_LIMIT) return;
        createMob(mob.kind,mob.x,mob.z,Number.isFinite(mob.dirX)?mob.dirX:null,Number.isFinite(mob.dirZ)?mob.dirZ:null,Number.isFinite(mob.turnTimer)?mob.turnTimer:null,mob.health);
      });
    }
    function updateMobs(dt) {
      mobSpawnTimer+=dt;
      if (mobs.length<5&&mobSpawnTimer>=8) { spawnMobsNearPlayer(5); mobSpawnTimer=0; }
      const despawnDistance=(renderDist+3)*CHUNK_SIZE;
      for (let i=mobs.length-1;i>=0;i--) {
        const mob=mobs[i], pos=mob.group.position;
        if (Math.abs(pos.x-player.pos.x)>despawnDistance||Math.abs(pos.z-player.pos.z)>despawnDistance) {
          removeMob(i); continue;
        }
        mob.turnTimer-=dt;
        if (mob.turnTimer<=0) {
          const angle=Math.random()*Math.PI*2; mob.dirX=Math.cos(angle); mob.dirZ=Math.sin(angle); mob.turnTimer=2+Math.random()*5;
        }
        const speed=0.7, nextX=pos.x+mob.dirX*speed*dt, nextZ=pos.z+mob.dirZ*speed*dt;
        const gx=Math.floor(nextX), gz=Math.floor(nextZ), ground=terrainHeight(gx,gz);
        const blocked=ground<=SEA_LEVEL||Math.abs(ground-(Math.round(pos.y-0.5)))>1||voxelMap.has(keyOf(gx,ground+1,gz))||voxelMap.has(keyOf(gx,ground+2,gz));
        if (blocked) { const oldDirX=mob.dirX; mob.dirX=-mob.dirZ; mob.dirZ=oldDirX; mob.turnTimer=0.4; }
        else { pos.x=nextX; pos.z=nextZ; pos.y=ground+0.5; }
        mob.group.rotation.y=Math.atan2(-mob.dirX,-mob.dirZ);
        if (mob.healthBarTimer>0) { mob.healthBarTimer-=dt; if (mob.healthBarTimer<=0) mob.healthBar.visible=false; }
        mob.phase+=dt*7;
        mob.legs.forEach((leg,index)=>{leg.rotation.x=Math.sin(mob.phase+(index%2)*Math.PI)*0.38;});
      }
    }
    function updateRealisticTemperature(dt) {
      if (isCreative||gameMode!=='realistic'||inventoryPanel.classList.contains('open')) return;
      const x=Math.floor(player.pos.x), z=Math.floor(player.pos.z);
      thermalSampleTimer+=dt;
      if (x!==thermalSampleX||z!==thermalSampleZ||thermalSampleTimer>=1) {
        const ambient=temperatureAt(x,z);
        thermalAmbient=player.inWater?Math.min(18,ambient-3):ambient;
        thermalSampleX=x; thermalSampleZ=z; thermalSampleTimer=0;
      }
      let drift=0;
      const clothingProtection=Math.max(0.3,1-Math.min(0.7,equippedInsulation()*0.11));
      if (thermalAmbient<8) drift=-(8-thermalAmbient)*0.0012*clothingProtection;
      else if (thermalAmbient>30) drift=(thermalAmbient-30)*0.004*clothingProtection;
      else drift=(37-bodyTemperature)*0.002;
      bodyTemperature=Math.max(30,Math.min(43,bodyTemperature+drift*dt));
      if (bodyTemperature<34) {
        thermalExposureTimer+=dt;
        if (thermalExposureTimer>=12) {
          health=Math.max(1,health-1); thermalExposureTimer=0; renderHearts();
        }
      } else thermalExposureTimer=0;
      const display=Math.round(bodyTemperature*10)/10;
      if (display!==lastBodyTempDisplay) renderBodyTemperature();
    }
    function updateHunger(dt) {
      if (isCreative||inventoryPanel.classList.contains('open')) return;
      const moving=player.onGround&&(Math.abs(player.vel.x)+Math.abs(player.vel.z)>0.2);
      const initialHealth=health;
      hungerDrainTimer+=dt*(moving?1:0.18);
      if (hungerDrainTimer>=35) {
        hungerDrainTimer-=35;
        if (hunger>0) { hunger--; renderHunger(); }
      }
      if (hunger===0) {
        starvationTimer+=dt;
        if (starvationTimer>=15) { health=Math.max(1,health-1); starvationTimer=0; }
      } else starvationTimer=0;
      if (gameMode==='realistic') {
        const ambientHeat=Math.max(0,thermalAmbient-25)*0.035;
        const bodyHeat=Math.max(0,bodyTemperature-37)*0.12;
        const heatMultiplier=1+ambientHeat+bodyHeat;
        thirstDrainTimer+=dt*(moving?1:0.5)*heatMultiplier;
        if (thirstDrainTimer>=30) {
          thirstDrainTimer-=30;
          if (thirst>0) { thirst--; renderThirst(); }
        }
        if (thirst===0) {
          dehydrationTimer+=dt;
          if (dehydrationTimer>=10) { health=Math.max(1,health-1); dehydrationTimer=0; }
        } else dehydrationTimer=0;
      }
      const healthDamaged=health<initialHealth;
      const temperatureSafe=gameMode!=='realistic'||(bodyTemperature>=35&&bodyTemperature<=39);
      const canRegenerate=gameMode==='classic'?hunger>=18:gameMode==='realistic'&&hunger>=14&&thirst>=12&&temperatureSafe;
      if (healthDamaged||health>=20||!canRegenerate) healthRegenTimer=0;
      else {
        healthRegenTimer+=dt;
        const regenInterval=gameMode==='realistic'?12:4;
        if (healthRegenTimer>=regenInterval) { health=Math.min(20,health+1); healthRegenTimer-=regenInterval; }
      }
      if (health!==initialHealth) renderHearts();
    }

    generateChunk(0,0);
    processChunkGeneration(CHUNK_SIZE*CHUNK_SIZE,Infinity);
    updateChunksAroundPlayer();
    rebuildVisibleInstances();

    const keys = {};
    let lastSpaceTap = 0;
    let gameStarted = false;
    let hasPlayedBefore=false;

    const overlay = document.getElementById('overlay');
    const playBtn = document.getElementById('playBtn');
    const renderLabel = document.getElementById('renderLabel');
    const mainMenu = document.getElementById('mainMenu');
    const settingsMenu = document.getElementById('settingsMenu');
    const modeMenu = document.getElementById('modeMenu');
    const multiplayerMenu=document.getElementById('multiplayerMenu');
    const multiplayerButton=document.getElementById('multiplayerBtn');
    const quitPrompt = document.getElementById('quitPrompt');
    const quitButton = document.getElementById('quitButton');
    const menuTitle = document.getElementById('menuTitle');
    const renderDistanceSetting = document.getElementById('menuRenderDistance');
    const graphicsQualitySetting = document.getElementById('graphicsQuality');
    const multiplayerCountEl=document.getElementById('multiplayerCount');
    const multiplayerHud=document.getElementById('multiplayerHud');
    const multiplayerHudCode=document.getElementById('multiplayerHudCode');
    const multiplayerStatusEl=document.getElementById('multiplayerStatus');
    const multiplayerChatPanel=document.getElementById('multiplayerChat');
    const hostPlayersPanel=document.getElementById('hostPlayersPanel');
    const chatMessagesEl=document.getElementById('chatMessages');
    const hostPlayersListEl=document.getElementById('hostPlayersList');
    let multiplayerJoinTimeout=null;

    function showMainMenu() {
      if (!hasPlayedBefore&&multiplayerChannel) disconnectMultiplayerRoom();
      mainMenu.hidden=false; settingsMenu.hidden=true; modeMenu.hidden=true; multiplayerMenu.hidden=true; quitPrompt.hidden=true;
      quitButton.hidden=!hasPlayedBefore;
      multiplayerButton.hidden=hasPlayedBefore&&!getLastHostSession();
      document.getElementById('roomCodePause').hidden=!(hasPlayedBefore&&multiplayerRoomCode);
      document.getElementById('pauseRoomCode').textContent=multiplayerRoomCode;
      menuTitle.innerHTML=hasPlayedBefore?'PAUSED':'MINECRAFT <span>HTML</span>';
      playBtn.textContent=hasPlayedBefore?'RESUME':'PLAY';
      renderDistanceSetting.value=String(renderDist);
      graphicsQualitySetting.value=String(graphicsScale);
      overlay.style.display='flex';
    }
    function setGraphicsQuality(value) {
      const quality=Number(value);
      graphicsScale=[0.65,0.85,1].includes(quality)?quality:0.85;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio*graphicsScale,1.25));
      renderer.setSize(window.innerWidth,window.innerHeight);
      graphicsQualitySetting.value=String(graphicsScale);
    }

    function requestGamePointerLock() {
      if (!document.body.requestPointerLock) return;
      try {
        const lockRequest=document.body.requestPointerLock();
        if (lockRequest && lockRequest.catch) lockRequest.catch(()=>{});
      } catch (err) {}
    }

    function startGame() {
      playSound('start');
      ensureMobPopulation();
      gameStarted = true;
      hasPlayedBefore=true;
      multiplayerHud.hidden=!multiplayerChannel;
      multiplayerHudCode.textContent=multiplayerRoomCode.slice(0,8);
      overlay.style.display = 'none';
      document.body.focus();
      requestGamePointerLock();
    }
    async function quitToTitle(saveWorld) {
      if (multiplayerChannel) {
        if (saveWorld&&multiplayerIsHost) {
          const backedUp=await downloadMultiplayerBackup();
          if (!backedUp) return;
          try { await callWorldApi('mark_host_offline',{world_id:multiplayerRoomId,host_token:multiplayerHostToken}); }
          catch (error) { console.warn('Could not mark the host offline before leaving:',error); }
        } else {
          const saved=await savePlayerToCloud();
          if (!saved&&saveWorld) return;
        }
      } else if (saveWorld&&!downloadWorldJson()) return;
      gameStarted=false;
      if (document.pointerLockElement) document.exitPointerLock();
      quitPrompt.hidden=true; overlay.style.display='none';
      setTimeout(()=>window.location.reload(),saveWorld?650:50);
    }

    function chooseGameMode(mode) {
      if (!['realistic','classic','creative'].includes(mode)) return;
      gameMode=mode; lastSurvivalMode=mode==='realistic'?'realistic':'classic';
      isCreative=mode==='creative';
      health=20; hunger=20; thirst=20;
      Object.keys(equippedItems).forEach(slot=>equippedItems[slot]=null);
      hungerDrainTimer=0; starvationTimer=0; thirstDrainTimer=0; dehydrationTimer=0; healthRegenTimer=0;
      bodyTemperature=37; thermalExposureTimer=0; thermalSampleTimer=0; thermalSampleX=NaN; thermalSampleZ=NaN; lastBodyTempDisplay=NaN;
      selectedSlot=0; hotbarSlots.fill(null); savedSurvivalHotbar=hotbarSlots.slice();
      player.flying=isCreative&&player.flying;
      modeLabel.textContent=isCreative?'CREATIVE':gameMode.toUpperCase();
      renderHotbar(); renderHearts();
      if (mode==='realistic') { addItem(132,2); addItem(121,2); }
      startGame();
    }

    function randomMultiplayerId() {
      const bytes=new Uint8Array(16);
      if (window.crypto&&window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
      else for (let i=0;i<bytes.length;i++) bytes[i]=Math.floor(Math.random()*256);
      return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('').toUpperCase();
    }
    const MULTIPLAYER_API_URL=`${SUPABASE_URL}/functions/v1/mc-world-api`;
    async function callWorldApi(action,payload={},options={}) {
      if (!multiplayerClient) throw new Error('Supabase is not available. Check your connection and reload.');
      const response=await fetch(MULTIPLAYER_API_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY},
        body:JSON.stringify({action,...payload}),
        keepalive:!!options.keepalive
      });
      let result={};
      try { result=await response.json(); } catch (_) {}
      if (!response.ok||result.error) throw new Error(result.error||`World service returned ${response.status}`);
      return result;
    }
    function playerSessionStorageKey(worldId) { return `mc-player-session:${worldId}`; }
    function hostSessionStorageKey(worldId) { return `mc-host-session:${worldId}`; }
    function getSavedPlayerSession(worldId) {
      try { return JSON.parse(localStorage.getItem(playerSessionStorageKey(worldId))||'null'); } catch (_) { return null; }
    }
    function storePlayerSession(worldId,playerId,playerToken) {
      try { localStorage.setItem(playerSessionStorageKey(worldId),JSON.stringify({playerId,playerToken})); } catch (_) {}
    }
    function storeHostSession(worldId,hostToken,playerId,playerToken) {
      try {
        localStorage.setItem(hostSessionStorageKey(worldId),JSON.stringify({hostToken,playerId,playerToken}));
        localStorage.setItem('mc-last-host-world',worldId);
      } catch (_) {}
    }
    function getLastHostSession() {
      try {
        const worldId=localStorage.getItem('mc-last-host-world');
        const session=worldId?JSON.parse(localStorage.getItem(hostSessionStorageKey(worldId))||'null'):null;
        return worldId&&session&&session.hostToken&&session.playerId&&session.playerToken?{worldId,...session}:null;
      } catch (_) { return null; }
    }
    function sharedWorldSaveData() {
      const data=worldSaveData();
      data.player={};
      delete data.inventory; delete data.equipment; delete data.hotbar;
      delete data.survivalHotbar; delete data.selectedSlot;
      return data;
    }
    function playerSaveData() {
      return {
        inventory:{...inventoryCounts}, equipment:{...equippedItems},
        hotbar:hotbarSlots.slice(), survivalHotbar:savedSurvivalHotbar.slice(), selectedSlot,
        health,hunger,thirst,bodyTemperature,
        player:{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch,flying:player.flying}
      };
    }
    function applyPlayerSaveData(data) {
      if (!data||typeof data!=='object') return;
      Object.keys(inventoryCounts).forEach(id=>delete inventoryCounts[id]);
      Object.entries(data.inventory||{}).forEach(([id,count])=>{
        const n=Number(id);
        if (ITEM_INFO[n]&&Number.isInteger(count)&&count>0&&count<=ITEM_STACK_LIMIT&&Object.keys(inventoryCounts).length<INVENTORY_SLOT_LIMIT) inventoryCounts[n]=count;
      });
      Object.keys(equippedItems).forEach(slot=>{
        const itemId=Number(data.equipment&&data.equipment[slot]);
        equippedItems[slot]=ITEM_INFO[itemId]&&ITEM_INFO[itemId].equipmentSlot===slot?itemId:null;
      });
      const hotbar=Array.from({length:10},(_,i)=>data.hotbar&&ITEM_INFO[data.hotbar[i]]?data.hotbar[i]:null);
      clearDuplicateHotbarItems(hotbar); hotbarSlots.splice(0,hotbarSlots.length,...hotbar);
      savedSurvivalHotbar=Array.from({length:10},(_,i)=>data.survivalHotbar&&ITEM_INFO[data.survivalHotbar[i]]?data.survivalHotbar[i]:null);
      clearDuplicateHotbarItems(savedSurvivalHotbar);
      selectedSlot=Number.isInteger(data.selectedSlot)?Math.max(0,Math.min(9,data.selectedSlot)):0;
      if (Number.isFinite(data.health)) health=Math.max(0,Math.min(20,data.health));
      if (Number.isFinite(data.hunger)) hunger=Math.max(0,Math.min(20,data.hunger));
      if (Number.isFinite(data.thirst)) thirst=Math.max(0,Math.min(20,data.thirst));
      if (Number.isFinite(data.bodyTemperature)) bodyTemperature=Math.max(30,Math.min(43,data.bodyTemperature));
      const saved=data.player||{};
      if ([saved.x,saved.y,saved.z].every(Number.isFinite)&&Math.abs(saved.x)<=WORLD_LIMIT&&Math.abs(saved.z)<=WORLD_LIMIT&&saved.y>-100&&saved.y<10000) {
        player.pos.set(saved.x,saved.y,saved.z); player.vel.set(0,0,0);
      }
      if (Number.isFinite(saved.yaw)) player.yaw=saved.yaw;
      if (Number.isFinite(saved.pitch)) player.pitch=Math.max(-1.55,Math.min(1.55,saved.pitch));
      player.flying=isCreative&&!!saved.flying;
      lastBodyTempDisplay=NaN; renderHotbar(); renderHearts(); renderInventory();
    }
    async function savePlayerToCloud(options={}) {
      if (!multiplayerRoomId||!multiplayerPlayerId||!multiplayerPlayerToken) return false;
      try {
        await callWorldApi('save_player',{
          world_id:multiplayerRoomId,player_id:multiplayerPlayerId,
          player_token:multiplayerPlayerToken,save_data:playerSaveData()
        },options);
        return true;
      } catch (error) {
        if (/banned|kicked|invalid player session/i.test(String(error&&error.message||''))) handleForcedRoomExit(error.message);
        else console.warn('Player auto-save failed:',error);
        return false;
      }
    }
    async function saveWorldToCloud(options={}) {
      if (!multiplayerRoomId||!multiplayerIsHost||!multiplayerHostToken) {
        showToast('Only the host can save the shared world'); return false;
      }
      try {
        await callWorldApi('save_world',{
          world_id:multiplayerRoomId,host_token:multiplayerHostToken,
          world_data:sharedWorldSaveData(),mode:multiplayerRoomMode,
          seed:multiplayerRoomSeed,visibility:multiplayerRoomVisibility
        },options);
        multiplayerLastWorldSave=Date.now();
        if (!options.silent) showToast('Shared world synced');
        return true;
      } catch (error) { showToast(`World save failed: ${error.message}`); return false; }
    }
    async function requestOnlinePlayersToSaveBackup() {
      if (!multiplayerChannel||!multiplayerIsHost) return {saved:0,missing:0,failed:0};
      const expected=new Set();
      Object.values(multiplayerChannel.presenceState()).forEach(entries=>entries.forEach(entry=>{
        if (entry&&entry.playerId&&entry.playerId!==multiplayerPlayerId) expected.add(entry.playerId);
      }));
      if (!expected.size) return {saved:0,missing:0,failed:0};
      const requestId=randomMultiplayerId();
      return await new Promise(resolve=>{
        const finish=()=>{
          if (multiplayerBackupWaiter!==waiter) return;
          clearTimeout(timer);
          multiplayerBackupWaiter=null;
          const results=Array.from(waiter.results.values());
          resolve({
            saved:results.filter(Boolean).length,
            failed:results.filter(value=>value===false).length,
            missing:Math.max(0,expected.size-results.length)
          });
        };
        const waiter={requestId,expected,results:new Map(),finish};
        const timer=setTimeout(finish,6000);
        multiplayerBackupWaiter=waiter;
        sendMultiplayerEvent('backup-save-request',{requestId});
      });
    }
    function downloadJsonFile(data,fileName) {
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const link=document.createElement('a');
      link.href=url; link.download=fileName;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    }
    async function downloadMultiplayerBackup() {
      if (!multiplayerChannel||!multiplayerIsHost||!multiplayerRoomId||!multiplayerHostToken) {
        showToast('Only the host can create a multiplayer backup'); return false;
      }
      try {
        if (!await savePlayerToCloud()) throw new Error('Your player save could not be synced. Backup was not created.');
        const onlineResults=await requestOnlinePlayersToSaveBackup();
        if (!await saveWorldToCloud({silent:true})) throw new Error('The shared world could not be synced. Backup was not created.');
        const result=await callWorldApi('create_backup',{
          world_id:multiplayerRoomId,
          host_token:multiplayerHostToken,
          host_player_id:multiplayerPlayerId,
          host_player_token:multiplayerPlayerToken
        });
        if (!result.backup||result.backup.format!=='voxel-multiplayer-backup') throw new Error('The backup service returned an invalid backup.');
        const stamp=new Date().toISOString().replace(/[:.]/g,'-');
        downloadJsonFile(result.backup,`voxel-multiplayer-backup-${multiplayerRoomId}-${stamp}.json`);
        const warningCount=onlineResults.failed+onlineResults.missing;
        if (warningCount) {
          showToast(`Backup downloaded; ${warningCount} online player save(s) did not confirm`);
          setMultiplayerStatus(`Backup downloaded. ${warningCount} online player save(s) did not confirm, so their included positions may be from their last cloud save.`);
        } else {
          showToast(`Complete backup downloaded · ${result.backup.players.length} player(s)`);
          setMultiplayerStatus(`Complete backup downloaded with the shared world and ${result.backup.players.length} player save(s).`);
        }
        return true;
      } catch (error) {
        showToast(`Backup failed: ${error.message}`);
        setMultiplayerStatus(`Backup failed: ${error.message}`);
        return false;
      }
    }
    async function importMultiplayerBackup(backup) {
      if (!backup||backup.format!=='voxel-multiplayer-backup'||backup.version!==1||
          !backup.world||!Array.isArray(backup.players)||!backup.host||
          !backup.world.world_data||!Array.isArray(backup.world.world_data.blocks)||
          !Array.isArray(backup.world.world_data.generatedChunks)) {
        throw new Error('This is not a valid multiplayer backup JSON.');
      }
      const host=backup.players.find(profile=>profile&&profile.is_host===true&&profile.player_id===backup.host.player_id);
      if (!host||typeof backup.host.host_token!=='string'||typeof backup.host.player_token!=='string') {
        throw new Error('The backup is missing its host credentials or host player save.');
      }
      if (multiplayerChannel) {
        if (multiplayerIsHost&&multiplayerRoomId&&multiplayerHostToken) {
          try { await callWorldApi('mark_host_offline',{world_id:multiplayerRoomId,host_token:multiplayerHostToken}); } catch (_) {}
        }
        disconnectMultiplayerRoom();
        updateMultiplayerControls();
      }
      setMultiplayerStatus('Restoring the world and every saved player from backup…');
      await callWorldApi('restore_backup',{backup});
      storeHostSession(backup.world.id,backup.host.host_token,backup.host.player_id,backup.host.player_token);
      storePlayerSession(backup.world.id,backup.host.player_id,backup.host.player_token);
      multiplayerImportedBackup=true;
      multiplayerRoomMode=backup.world.mode;
      multiplayerRoomSeed=Number(backup.world.seed)>>>0;
      multiplayerRoomVisibility=backup.world.visibility||'private';
      loadWorldData(backup.world.world_data);
      if (host.save_data) applyPlayerSaveData(host.save_data);
      updateMultiplayerControls();
      showToast(`Backup restored · ${backup.players.length} saved player(s)`);
      setMultiplayerStatus(`Backup restored. ${backup.players.length} player save(s) are ready. Open Multiplayer and choose Resume Saved Host World to start the server.`);
    }

    function handleForcedRoomExit(message) {
      if (!multiplayerChannel) return;
      const oldChannel=multiplayerChannel;
      if (multiplayerClient) multiplayerClient.removeChannel(oldChannel);
      multiplayerChannel=null; multiplayerIsHost=false; multiplayerHud.hidden=true;
      multiplayerChatPanel.hidden=true; hostPlayersPanel.hidden=true;
      pendingWorldSnapshots.clear(); clearRemotePlayers();
      gameStarted=false;
      if (document.pointerLockElement) document.exitPointerLock();
      overlay.style.display='flex'; mainMenu.hidden=true; multiplayerMenu.hidden=false;
      updateMultiplayerControls();
      setMultiplayerStatus(message||'You no longer have access to this world.');
      showToast(message||'Removed from the world');
    }
    function setMultiplayerStatus(message) { multiplayerStatusEl.textContent=message; }
    function multiplayerErrorMessage(error) {
      const message=String(error&&error.message||'');
      if (message.includes('Realtime could not join')) return 'Supabase rejected the room. Check that Realtime is enabled and public channels are allowed in project settings.';
      return message||'Could not connect to the multiplayer service.';
    }
    function disconnectMultiplayerRoom() {
      if (multiplayerChannel&&multiplayerClient) multiplayerClient.removeChannel(multiplayerChannel);
      multiplayerChannel=null; multiplayerRoomId=''; multiplayerRoomCode=''; multiplayerIsHost=false;
      multiplayerPlayerId=''; multiplayerPlayerToken=''; multiplayerHostToken='';
      multiplayerPendingPlayerData=null; multiplayerLoadedSavedWorld=false;
      if (multiplayerJoinTimeout) { clearTimeout(multiplayerJoinTimeout); multiplayerJoinTimeout=null; }
      pendingWorldSnapshots.clear(); clearRemotePlayers(); multiplayerHud.hidden=true;
      multiplayerChatPanel.hidden=true; hostPlayersPanel.hidden=true;
    }
    function cleanMultiplayerName(value) { return String(value||'Player').replace(/[<>\u0000-\u001F]/g,'').trim().slice(0,18)||'Player'; }
    async function connectMultiplayerRoom(roomId,isHost) {
      if (!multiplayerClient) throw new Error('The Supabase client did not load. Check your internet connection and reload.');
      if (multiplayerChannel) await multiplayerClient.removeChannel(multiplayerChannel);
      multiplayerChannel=null; clearRemotePlayers(); pendingWorldSnapshots.clear();
      multiplayerClientId=randomMultiplayerId(); multiplayerIsHost=isHost;
      const channel=multiplayerClient.channel(`mc-world:${roomId}`,{
        config:{private:false,presence:{key:multiplayerClientId},broadcast:{ack:false,self:false}}
      });
      multiplayerChannel=channel;
      channel.on('broadcast',{event:'player-position'},message=>updateRemotePlayer(message.payload));
      channel.on('broadcast',{event:'block-change'},message=>applyRemoteBlockChange(message.payload));
      channel.on('broadcast',{event:'sync-request'},message=>{
        if (multiplayerIsHost&&message.payload&&message.payload.clientId!==multiplayerClientId) sendMultiplayerSnapshot(message.payload.clientId);
      });
      channel.on('broadcast',{event:'world-snapshot'},message=>receiveMultiplayerSnapshot(message.payload));
      channel.on('broadcast',{event:'chest-change'},message=>{
        const payload=message.payload;
        if (!payload||!isValidMultiplayerKey(payload.key)||voxelMap.get(payload.key)!==33) return;
        if (payload.contents===null) chestContents.delete(payload.key);
        else if (payload.contents&&typeof payload.contents==='object') {
          const contents=Object.create(null);
          Object.entries(payload.contents).forEach(([id,count])=>{const n=Number(id);if(ITEM_INFO[n]&&Number.isInteger(count)&&count>0&&count<=ITEM_STACK_LIMIT)contents[n]=count;});
          chestContents.set(payload.key,contents);
        }
        if (chestOpenKey===payload.key) renderInventory();
      });
      channel.on('broadcast',{event:'chat-message'},message=>receiveMultiplayerChat(message.payload));
      channel.on('broadcast',{event:'backup-save-request'},message=>{
        const payload=message.payload;
        if (!payload||typeof payload.requestId!=='string'||!multiplayerRoomId) return;
        (async()=>{
          const ok=await savePlayerToCloud();
          sendMultiplayerEvent('backup-save-ack',{requestId:payload.requestId,playerId:multiplayerPlayerId,ok});
        })();
      });
      channel.on('broadcast',{event:'backup-save-ack'},message=>{
        const payload=message.payload, waiter=multiplayerBackupWaiter;
        if (!multiplayerIsHost||!waiter||!payload||payload.requestId!==waiter.requestId||!waiter.expected.has(payload.playerId)) return;
        waiter.results.set(payload.playerId,payload.ok===true);
        if (waiter.results.size>=waiter.expected.size) waiter.finish();
      });
      channel.on('broadcast',{event:'player-kicked'},message=>{
        const payload=message.payload;
        if (payload&&payload.targetPlayerId===multiplayerPlayerId) handleForcedRoomExit(payload.message||'The host removed you from this world.');
      });
      channel.on('presence',{event:'sync'},syncRemotePlayersFromPresence);
      await new Promise((resolve,reject)=>{
        let settled=false;
        const timeout=setTimeout(()=>{if(!settled){settled=true;reject(new Error('Realtime connection timed out.'));}},15000);
        channel.subscribe(async status=>{
          if (settled) return;
          if (status==='SUBSCRIBED') {
            try {
              await channel.track({clientId:multiplayerClientId,playerId:multiplayerPlayerId,name:multiplayerPlayerName,host:isHost,joinedAt:Date.now()});
              settled=true; clearTimeout(timeout); syncRemotePlayersFromPresence(); resolve();
            } catch (error) { settled=true; clearTimeout(timeout); reject(error); }
          } else if (status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED') {
            settled=true; clearTimeout(timeout); reject(new Error(`Realtime could not join (${status}).`));
          }
        });
      }).catch(async error=>{
        if (multiplayerChannel===channel) multiplayerChannel=null;
        await multiplayerClient.removeChannel(channel);
        throw error;
      });
    }
    async function sendMultiplayerSnapshot(targetClientId) {
      if (!multiplayerChannel||!multiplayerIsHost) return;
      const entries=Array.from(multiplayerOverrides.entries(),([key,id])=>[key,id,blockRotations.get(key)||0,openDoors.has(key)]), pageSize=80;
      const totalPages=Math.max(1,Math.ceil(entries.length/pageSize)), snapshotId=randomMultiplayerId();
      for (let page=0;page<totalPages;page++) {
        await multiplayerChannel.send({type:'broadcast',event:'world-snapshot',payload:{
          targetClientId,snapshotId,page,totalPages,seed:multiplayerRoomSeed,mode:multiplayerRoomMode,
          worldState:page===0?{chests:Array.from(chestContents.entries()),mobs:mobs.map(mob=>({kind:mob.kind,x:mob.group.position.x,z:mob.group.position.z,dirX:mob.dirX,dirZ:mob.dirZ,turnTimer:mob.turnTimer,health:mob.health})),droppedItems:droppedItems.map(item=>({id:item.itemId,count:item.count,pos:item.pos.toArray(),vel:item.vel.toArray(),age:item.age}))}:null,
          entries:entries.slice(page*pageSize,(page+1)*pageSize)
        }}).catch(()=>{});
      }
    }
    function receiveMultiplayerSnapshot(payload) {
      if (!payload||payload.targetClientId!==multiplayerClientId||typeof payload.snapshotId!=='string'||
          !Number.isInteger(payload.seed)||payload.seed<0||payload.seed>4294967295||
          !['realistic','classic','creative'].includes(payload.mode)||!Number.isInteger(payload.page)||
          !Number.isInteger(payload.totalPages)||payload.totalPages<1||payload.totalPages>1000||
          payload.page<0||payload.page>=payload.totalPages||!Array.isArray(payload.entries)||payload.entries.length>80) return;
      let snapshot=pendingWorldSnapshots.get(payload.snapshotId);
      if (!snapshot) {
        snapshot={seed:payload.seed,mode:payload.mode,totalPages:payload.totalPages,pages:new Map(),worldState:null};
        pendingWorldSnapshots.set(payload.snapshotId,snapshot);
      }
      if (snapshot.seed!==payload.seed||snapshot.mode!==payload.mode||snapshot.totalPages!==payload.totalPages) return;
      snapshot.pages.set(payload.page,payload.entries);
      if (payload.page===0&&payload.worldState) snapshot.worldState=payload.worldState;
      if (snapshot.pages.size!==snapshot.totalPages) return;
      const overrides=[];
      for (let page=0;page<snapshot.totalPages;page++) overrides.push(...(snapshot.pages.get(page)||[]));
      pendingWorldSnapshots.clear();
      if (multiplayerJoinTimeout) { clearTimeout(multiplayerJoinTimeout); multiplayerJoinTimeout=null; }
      multiplayerRoomMode=snapshot.mode;
      multiplayerRoomSeed=snapshot.seed;
      setMultiplayerStatus('World synced. Joining the room…');
      if (multiplayerLoadedSavedWorld) {
        for (const entry of overrides) {
          if (!Array.isArray(entry)||!isValidMultiplayerKey(entry[0])||(entry[1]!==null&&!BLOCK_BY_ID[entry[1]])) continue;
          const pos=decodeVoxelPosition(entry[0]);
          if (entry[1]===null) { deleteVoxel(pos.x,pos.y,pos.z); blockRotations.delete(entry[0]); openDoors.delete(entry[0]); }
          else { setVoxelAtKey(entry[0],pos.x,pos.z,entry[1]); if(Number.isFinite(entry[2]))blockRotations.set(entry[0],entry[2]); if(entry[3])openDoors.add(entry[0]); else openDoors.delete(entry[0]); }
          cacheMultiplayerOverride(entry[0],entry[1]);
        }
      } else resetWorldForMultiplayer(snapshot.seed,overrides);
      if (snapshot.worldState&&Array.isArray(snapshot.worldState.chests)) {
        chestContents.clear();
        snapshot.worldState.chests.forEach(entry=>{if(Array.isArray(entry)&&Number.isSafeInteger(entry[0])&&voxelMap.get(entry[0])===33){const c=Object.create(null);Object.entries(entry[1]||{}).forEach(([id,count])=>{const n=Number(id);if(ITEM_INFO[n]&&Number.isInteger(count)&&count>0&&count<=ITEM_STACK_LIMIT)c[n]=count;});chestContents.set(entry[0],c);}});
        clearDroppedItems(); (snapshot.worldState.droppedItems||[]).forEach(item=>{if(ITEM_INFO[item.id]&&Number.isInteger(item.count)&&Array.isArray(item.pos)&&item.pos.every(Number.isFinite)){const pos=new THREE.Vector3(...item.pos);const vel=Array.isArray(item.vel)&&item.vel.every(Number.isFinite)?new THREE.Vector3(...item.vel):new THREE.Vector3();createDroppedItem(item.id,Math.min(item.count,ITEM_STACK_LIMIT),pos,vel,Number(item.age)||0);}});
        restoreMobs(snapshot.worldState.mobs||[]);
      }
      rebuildVisibleInstances();
      multiplayerHud.hidden=false; multiplayerHudCode.textContent=multiplayerRoomCode.slice(0,8);
      chooseGameMode(snapshot.mode);
      if (multiplayerPendingPlayerData) applyPlayerSaveData(multiplayerPendingPlayerData);
      multiplayerPendingPlayerData=null; multiplayerLoadedSavedWorld=false;
      updateMultiplayerControls();
    }
    function sendLocalPlayerPosition() {
      if (!multiplayerChannel||!gameStarted) return;
      sendMultiplayerEvent('player-position',{
        clientId:multiplayerClientId,name:multiplayerPlayerName,
        x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw
      });
    }
    function enterMultiplayerGame(seed,mode,savedWorldData=null,savedPlayerData=null) {
      multiplayerRoomMode=mode; multiplayerRoomSeed=seed>>>0;
      if (savedWorldData&&Array.isArray(savedWorldData.blocks)&&Array.isArray(savedWorldData.generatedChunks)) {
        multiplayerOverrides.clear(); multiplayerOverridesByChunk.clear();
        loadWorldData(savedWorldData); multiplayerLoadedSavedWorld=true;
      } else { resetWorldForMultiplayer(seed,[]); multiplayerLoadedSavedWorld=false; }
      multiplayerMenu.hidden=true; mainMenu.hidden=true; settingsMenu.hidden=true; modeMenu.hidden=true;
      overlay.style.display='none';
      chooseGameMode(mode);
      if (savedPlayerData) applyPlayerSaveData(savedPlayerData);
      multiplayerPendingPlayerData=null;
      multiplayerHud.hidden=false; multiplayerHudCode.textContent=multiplayerRoomCode.slice(0,8);
      if (multiplayerIsHost&&!multiplayerLastWorldSave) multiplayerLastWorldSave=Date.now();
      updateMultiplayerControls();
    }
    async function copyMultiplayerInvite() {
      if (!multiplayerRoomCode) return;
      try {
        await navigator.clipboard.writeText(multiplayerRoomCode);
        showToast('Room invite code copied');
      } catch (_) { showToast(`Invite code: ${multiplayerRoomCode}`); }
    }

    multiplayerButton.addEventListener('click',()=>{
      if (hasPlayedBefore&&!getLastHostSession()) return;
      multiplayerPlayerName=cleanMultiplayerName(document.getElementById('multiplayerName').value);
      multiplayerMenu.hidden=false; mainMenu.hidden=true; settingsMenu.hidden=true; modeMenu.hidden=true;
      document.getElementById('createdRoomCode').hidden=true;
      updateMultiplayerControls();
      setMultiplayerStatus(multiplayerClient?'Create a new server, resume your saved host world, or join a friend.':'Supabase is not available. Check your connection and reload.');
    });
    document.getElementById('multiplayerBackButton').addEventListener('click',showMainMenu);
    async function createMultiplayerRoom() {
      const button=document.getElementById('createRoomButton');
      multiplayerPlayerName=cleanMultiplayerName(document.getElementById('multiplayerName').value);
      document.getElementById('multiplayerName').value=multiplayerPlayerName;
      const roomId=randomMultiplayerId(), playerId=randomMultiplayerId();
      const seed=window.crypto&&window.crypto.getRandomValues?window.crypto.getRandomValues(new Uint32Array(1))[0]:(Math.random()*4294967296)>>>0;
      const mode=document.getElementById('multiplayerMode').value;
      multiplayerRoomVisibility=document.getElementById('roomVisibility').value;
      multiplayerRoomMode=mode; multiplayerRoomSeed=seed; multiplayerIsHost=true; multiplayerImportedBackup=false;
      button.disabled=true; setMultiplayerStatus('Creating your saved server world…');
      try {
        const created=await callWorldApi('create_world',{
          world_id:roomId,player_id:playerId,username:multiplayerPlayerName,
          seed,mode,visibility:multiplayerRoomVisibility,world_name:`${multiplayerPlayerName}'s World`
        });
        multiplayerRoomId=roomId; multiplayerRoomCode=roomId;
        multiplayerPlayerId=playerId; multiplayerHostToken=created.host_token; multiplayerPlayerToken=created.player_token;
        storeHostSession(roomId,multiplayerHostToken,playerId,multiplayerPlayerToken);
        storePlayerSession(roomId,playerId,multiplayerPlayerToken);
        await connectMultiplayerRoom(roomId,true);
        document.getElementById('createdRoomCodeText').textContent=roomId;
        document.getElementById('createdRoomCode').hidden=false;
        enterMultiplayerGame(seed,mode);
        await savePlayerToCloud();
        await saveWorldToCloud();
        setMultiplayerStatus('Your temporary server is online. The world is saved separately.');
        showToast('Server world created · share the invite code');
      } catch (error) {
        if (multiplayerRoomId&&multiplayerHostToken) callWorldApi('mark_host_offline',{world_id:multiplayerRoomId,host_token:multiplayerHostToken}).catch(()=>{});
        setMultiplayerStatus(multiplayerErrorMessage(error));
      } finally { button.disabled=false; }
    }
    async function joinMultiplayerRoom(roomCode) {
      const button=document.getElementById('joinRoomButton');
      multiplayerPlayerName=cleanMultiplayerName(document.getElementById('multiplayerName').value);
      document.getElementById('multiplayerName').value=multiplayerPlayerName;
      if (!roomCode||roomCode.length!==32) { setMultiplayerStatus('Enter the full 32-character room invite code.'); return; }
      const saved=getSavedPlayerSession(roomCode);
      const playerId=saved&&idOkForGame(saved.playerId)?saved.playerId:randomMultiplayerId();
      button.disabled=true; setMultiplayerStatus('Checking the saved world and player session…');
      try {
        const joined=await callWorldApi('join_world',{
          world_id:roomCode,player_id:playerId,player_token:saved&&saved.playerToken,
          username:multiplayerPlayerName
        });
        multiplayerRoomId=roomCode; multiplayerRoomCode=roomCode; multiplayerPlayerId=playerId;
        multiplayerPlayerToken=joined.player_token; multiplayerHostToken=''; multiplayerIsHost=false;
        multiplayerRoomMode=joined.world.mode; multiplayerRoomSeed=Number(joined.world.seed)>>>0;
        multiplayerRoomVisibility=joined.world.visibility||'private';
        multiplayerPendingPlayerData=joined.player_data||null;
        storePlayerSession(roomCode,playerId,multiplayerPlayerToken);
        if (joined.world.world_data&&Array.isArray(joined.world.world_data.blocks)&&Array.isArray(joined.world.world_data.generatedChunks)) {
          multiplayerOverrides.clear(); multiplayerOverridesByChunk.clear();
          loadWorldData(joined.world.world_data); multiplayerLoadedSavedWorld=true;
        } else multiplayerLoadedSavedWorld=false;
        await connectMultiplayerRoom(roomCode,false);
        sendMultiplayerEvent('sync-request',{clientId:multiplayerClientId,playerId:multiplayerPlayerId});
        multiplayerJoinTimeout=setTimeout(()=>{
          if (!gameStarted&&multiplayerChannel) setMultiplayerStatus('The host is online but has not sent the live world yet. Check that the host is still playing.');
        },15000);
      } catch (error) {
        multiplayerPendingPlayerData=null; multiplayerLoadedSavedWorld=false;
        setMultiplayerStatus(multiplayerErrorMessage(error));
      } finally { button.disabled=false; }
    }
    async function resumeSavedHostWorld() {
      const button=document.getElementById('resumeWorldButton'), saved=getLastHostSession();
      if (!saved) { setMultiplayerStatus('No saved host world session is stored in this browser.'); updateMultiplayerControls(); return; }
      button.disabled=true; setMultiplayerStatus('Reopening your saved server world…');
      try {
        const loaded=await callWorldApi('load_host_world',{world_id:saved.worldId,host_token:saved.hostToken});
        multiplayerRoomId=saved.worldId; multiplayerRoomCode=saved.worldId;
        multiplayerPlayerId=saved.playerId; multiplayerPlayerToken=saved.playerToken; multiplayerHostToken=saved.hostToken;
        multiplayerIsHost=true; multiplayerRoomMode=loaded.world.mode; multiplayerRoomSeed=Number(loaded.world.seed)>>>0;
        multiplayerRoomVisibility=loaded.world.visibility||'private';
        await connectMultiplayerRoom(saved.worldId,true);
        const savedWorld=loaded.world.world_data&&Array.isArray(loaded.world.world_data.blocks)?loaded.world.world_data:null;
        multiplayerLastWorldSave=Date.now();
        enterMultiplayerGame(multiplayerRoomSeed,multiplayerRoomMode,savedWorld,loaded.player_data||null);
        multiplayerImportedBackup=false;
        updateMultiplayerControls();
        setMultiplayerStatus('Saved world reopened. Players can join while you are online.');
        showToast('Saved world loaded');
      } catch (error) { setMultiplayerStatus(multiplayerErrorMessage(error)); }
      finally { button.disabled=false; }
    }
    function idOkForGame(value) { return typeof value==='string'&&/^[A-F0-9]{32}$/.test(value); }
    async function refreshPublicRooms() {
      const list=document.getElementById('publicRoomsList'), status=document.getElementById('roomFinderStatus');
      list.innerHTML=''; status.textContent='Searching for online public worlds…';
      try {
        const result=await callWorldApi('list_public');
        const rooms=Array.isArray(result.rooms)?result.rooms:[];
        if (!rooms.length) { status.textContent='No public worlds are online right now.'; return; }
        status.textContent=`${rooms.length} public world${rooms.length===1?'':'s'} online`;
        rooms.forEach(room=>{
          const row=document.createElement('div'); row.className='public-room-row';
          const info=document.createElement('div'); info.className='public-room-info';
          const name=document.createElement('div'); name.className='public-room-name'; name.textContent=room.world_name||'Minecraft World';
          const meta=document.createElement('div'); meta.className='public-room-meta'; meta.textContent=`${String(room.mode||'classic').toUpperCase()} · Host online`;
          const join=document.createElement('button'); join.type='button'; join.className='btn secondary'; join.textContent='JOIN';
          join.addEventListener('click',()=>{
            document.getElementById('roomCodeInput').value=room.id;
            document.getElementById('roomFinderMenu').hidden=true;
            multiplayerMenu.hidden=false;
            document.getElementById('joinRoomButton').click();
          });
          info.append(name,meta); row.append(info,join); list.appendChild(row);
        });
      } catch (error) { status.textContent=`Could not find public worlds: ${error.message}`; }
    }
    async function refreshHostPlayers() {
      if (!multiplayerIsHost||!multiplayerRoomId||!multiplayerHostToken) return;
      hostPlayersListEl.textContent='Loading players…';
      try {
        const result=await callWorldApi('list_players',{world_id:multiplayerRoomId,host_token:multiplayerHostToken});
        hostPlayersListEl.innerHTML='';
        (result.players||[]).forEach(player=>{
          const row=document.createElement('div'); row.className='host-player-row';
          const info=document.createElement('div');
          const title=document.createElement('strong'); title.textContent=player.username+(player.is_host?' · HOST':'');
          const seen=Date.now()-Date.parse(player.last_seen_at||0);
          const detail=document.createElement('small'); detail.textContent=player.is_host?'World owner':player.is_banned?'BANNED':seen<45000?'Online':'Offline';
          info.append(title,detail); row.append(info);
          if (!player.is_host) {
            const actions=document.createElement('div'); actions.className='host-player-actions';
            const actionButton=(label,action,danger=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(danger)b.classList.add('danger');b.addEventListener('click',()=>moderateMultiplayerPlayer(player.player_id,action));actions.appendChild(b);};
            if (player.is_banned) actionButton('UNBAN','unban');
            else { actionButton('KICK','kick',true); actionButton('BAN','ban',true); }
            row.append(actions);
          }
          hostPlayersListEl.appendChild(row);
        });
        if (!(result.players||[]).length) hostPlayersListEl.textContent='No players have joined yet.';
      } catch (error) { hostPlayersListEl.textContent=error.message; }
    }
    async function moderateMultiplayerPlayer(playerId,action) {
      if (!multiplayerIsHost) return;
      try {
        await callWorldApi('moderate',{world_id:multiplayerRoomId,host_token:multiplayerHostToken,target_player_id:playerId,moderation:action});
        if (action==='kick'||action==='ban') sendMultiplayerEvent('player-kicked',{targetPlayerId:playerId,message:action==='ban'?'You were banned by the host.':'You were kicked by the host.'});
        showToast(`${action.toUpperCase()} applied`); await refreshHostPlayers();
      } catch (error) { showToast(`Could not ${action}: ${error.message}`); }
    }
    function updateMultiplayerControls() {
      const host=!!(multiplayerChannel&&multiplayerIsHost);
      document.getElementById('playersToggleButton').hidden=!host;
      document.getElementById('cloudSaveButton').hidden=!host;
      const importBackupButton=document.getElementById('resumeWorldButton');
      if (importBackupButton) { importBackupButton.hidden=false; importBackupButton.disabled=false; importBackupButton.textContent='IMPORT JSON BACKUP'; }
      const save=document.getElementById('saveWorldButton'), load=document.getElementById('loadWorldButton');
      if (save) { save.disabled=!!multiplayerChannel&&!host; save.textContent=multiplayerChannel?(host?'Save backup JSON':'Host saves backup'):'Save world JSON'; }
      if (load) load.disabled=!!multiplayerChannel;
    }
    function appendMultiplayerChat(name,message) {
      const line=document.createElement('div'); line.className='chat-line';
      const who=document.createElement('strong'); who.textContent=`${String(name||'Player').slice(0,18)}:`;
      const body=document.createElement('span'); body.textContent=String(message||'').slice(0,240);
      line.append(who,body); chatMessagesEl.appendChild(line);
      while (chatMessagesEl.children.length>60) chatMessagesEl.firstElementChild.remove();
      chatMessagesEl.scrollTop=chatMessagesEl.scrollHeight;
    }
    function receiveMultiplayerChat(payload) {
      if (!payload||typeof payload.message!=='string'||!payload.message.trim()) return;
      appendMultiplayerChat(payload.name,payload.message.trim());
    }
    function submitMultiplayerChat(event) {
      event.preventDefault();
      const input=document.getElementById('chatInput'), message=input.value.trim().slice(0,240);
      if (!message||!multiplayerChannel) return;
      sendMultiplayerEvent('chat-message',{clientId:multiplayerClientId,playerId:multiplayerPlayerId,name:multiplayerPlayerName,message});
      appendMultiplayerChat(multiplayerPlayerName,message); input.value='';
    }
    document.getElementById('createRoomButton').addEventListener('click',createMultiplayerRoom);
    document.getElementById('resumeWorldButton').addEventListener('click',()=>document.getElementById('loadWorldInput').click());
    document.getElementById('findRoomsButton').addEventListener('click',()=>{
      multiplayerMenu.hidden=true; document.getElementById('roomFinderMenu').hidden=false; refreshPublicRooms();
    });
    document.getElementById('refreshRoomsButton').addEventListener('click',refreshPublicRooms);
    document.getElementById('roomFinderBackButton').addEventListener('click',()=>{
      document.getElementById('roomFinderMenu').hidden=true; multiplayerMenu.hidden=false;
    });
    document.getElementById('joinRoomButton').addEventListener('click',()=>{
      const roomCode=document.getElementById('roomCodeInput').value.toUpperCase().replace(/[^A-F0-9]/g,'');
      joinMultiplayerRoom(roomCode);
    });
    document.getElementById('playersToggleButton').addEventListener('click',()=>{
      hostPlayersPanel.hidden=!hostPlayersPanel.hidden;
      if (!hostPlayersPanel.hidden) { multiplayerChatPanel.hidden=true; refreshHostPlayers(); }
    });
    document.getElementById('closePlayersButton').addEventListener('click',()=>hostPlayersPanel.hidden=true);
    document.getElementById('refreshPlayersButton').addEventListener('click',refreshHostPlayers);
    document.getElementById('chatToggleButton').addEventListener('click',()=>{
      multiplayerChatPanel.hidden=!multiplayerChatPanel.hidden;
      if (!multiplayerChatPanel.hidden) { hostPlayersPanel.hidden=true; if(document.pointerLockElement)document.exitPointerLock(); document.getElementById('chatInput').focus(); }
    });
    document.getElementById('closeChatButton').addEventListener('click',()=>multiplayerChatPanel.hidden=true);
    document.getElementById('chatForm').addEventListener('submit',submitMultiplayerChat);
    document.getElementById('cloudSaveButton').addEventListener('click',downloadMultiplayerBackup);
    document.getElementById('copyRoomCodeButton').addEventListener('click',copyMultiplayerInvite);
    document.getElementById('copyInviteButton').addEventListener('click',copyMultiplayerInvite);
    window.addEventListener('beforeunload',()=>{
      if (multiplayerChannel&&multiplayerClient) multiplayerClient.removeChannel(multiplayerChannel);
      if (multiplayerRoomId&&multiplayerPlayerId&&multiplayerPlayerToken) {
        callWorldApi('save_player',{world_id:multiplayerRoomId,player_id:multiplayerPlayerId,player_token:multiplayerPlayerToken,save_data:playerSaveData()},{keepalive:true}).catch(()=>{});
      }
      if (multiplayerRoomId&&multiplayerIsHost&&multiplayerHostToken) {
        callWorldApi('mark_host_offline',{world_id:multiplayerRoomId,host_token:multiplayerHostToken},{keepalive:true}).catch(()=>{});
      }
    });
    setInterval(async()=>{
      if (!multiplayerChannel||!multiplayerRoomId||!multiplayerPlayerId||!multiplayerPlayerToken) return;
      try {
        await callWorldApi('heartbeat',{world_id:multiplayerRoomId,player_id:multiplayerPlayerId,player_token:multiplayerPlayerToken});
      } catch (error) {
        if (/banned|kicked|invalid player session/i.test(String(error&&error.message||''))) { handleForcedRoomExit(error.message); return; }
      }
      if (gameStarted) await savePlayerToCloud();
      if (multiplayerIsHost&&gameStarted&&Date.now()-multiplayerLastWorldSave>45000) await saveWorldToCloud();
    },20000);

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hasPlayedBefore) startGame();
      else { mainMenu.hidden=true; settingsMenu.hidden=true; modeMenu.hidden=false; }
    });
    document.getElementById('settingsBtn').addEventListener('click',()=>{
      renderDistanceSetting.value=String(renderDist);
      graphicsQualitySetting.value=String(graphicsScale);
      mainMenu.hidden=true; settingsMenu.hidden=false;
    });
    document.getElementById('backButton').addEventListener('click',showMainMenu);
    document.getElementById('modeBackButton').addEventListener('click',showMainMenu);
    quitButton.addEventListener('click',()=>{
      mainMenu.hidden=true; settingsMenu.hidden=true; modeMenu.hidden=true; quitPrompt.hidden=false;
    });
    document.getElementById('saveQuitButton').addEventListener('click',()=>quitToTitle(true));
    document.getElementById('discardQuitButton').addEventListener('click',()=>quitToTitle(false));
    document.getElementById('cancelQuitButton').addEventListener('click',showMainMenu);
    modeMenu.querySelectorAll('[data-game-mode]').forEach(button=>button.addEventListener('click',()=>chooseGameMode(button.dataset.gameMode)));
    renderDistanceSetting.addEventListener('change',()=>setRenderDistance(renderDistanceSetting.value));
    graphicsQualitySetting.addEventListener('change',()=>setGraphicsQuality(graphicsQualitySetting.value));

    window.addEventListener('keydown', (e) => {
      const typingTarget=e.target&&e.target.closest&&e.target.closest('input,textarea,select,[contenteditable="true"]');
      if (typingTarget) {
        if (e.code==='Escape'&&typingTarget.closest('#multiplayerChat')) { multiplayerChatPanel.hidden=true; document.body.focus(); }
        return;
      }
      if (e.repeat && ['KeyE','KeyM','KeyR','Escape','KeyQ','KeyG'].includes(e.code)) return;
      if (!gameStarted && settingsMenu.hidden && modeMenu.hidden && multiplayerMenu.hidden && (e.code === 'Enter' || e.code === 'Space')) {
        if (hasPlayedBefore) startGame();
        else { mainMenu.hidden=true; modeMenu.hidden=false; }
        return;
      }

      keys[e.code] = true;

      if (e.key === '0') {
        selectedSlot=9;
        renderHotbar(); renderInventory();
      } else if (e.key >= '1' && e.key <= '9') {
        selectedSlot=parseInt(e.key)-1;
        renderHotbar(); renderInventory();
      }
      if (e.code === 'KeyM'&&gameStarted) toggleMode();
      if (e.code === 'KeyR'&&gameStarted) {
        setRenderDistance(renderDist===4?2:(renderDist===2?3:4));
      }
      if (e.code === 'Escape') {
        if (!quitPrompt.hidden) showMainMenu();
        else if (inventoryPanel.classList.contains('open')) { chestOpenKey=null; craftingTableOpen=false; craftingStationId=null; toggleInventory(false); }
        else if (!gameStarted&&(!settingsMenu.hidden||!modeMenu.hidden||!multiplayerMenu.hidden)) showMainMenu();
        else { gameStarted=false; showMainMenu(); if (document.pointerLockElement) document.exitPointerLock(); }
      }
      if (e.code === 'KeyE' && gameStarted) {
        if (inventoryPanel.classList.contains('open')) { chestOpenKey=null; craftingTableOpen=false; craftingStationId=null; toggleInventory(false); }
        else {
          const targeted=raycastVoxel();
          if (toggleRedstoneLeverAt(targeted)) return;
          if (targeted&&(targeted.id===44||targeted.id===46)) { toggleDoorAt(targeted); return; }
          chestOpenKey=targeted&&targeted.id===33?keyOf(targeted.x,targeted.y,targeted.z):null;
          craftingStationId=targeted&&[17,18,36].includes(targeted.id)?targeted.id:null;
          craftingTableOpen=craftingStationId===18;
          if (chestOpenKey!==null && !chestContents.has(chestOpenKey)) chestContents.set(chestOpenKey,Object.create(null));
          toggleInventory(true);
        }
        return;
      }
      if (gameStarted && !inventoryPanel.classList.contains('open')) {
        if (e.code === 'KeyQ') { mineInputHeld=true; beginMining(); }
        if (e.code === 'KeyF') placeTargetedBlock();
        if (e.code === 'KeyG') dropSelectedItems(e.shiftKey);
      }

      if (e.code === 'Space' && isCreative && gameStarted) {
        const now = performance.now();
        if (now - lastSpaceTap < 280) {
          player.flying = !player.flying;
          player.vel.y = 0;
        }
        lastSpaceTap = now;
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code]=false;
      if (e.code==='KeyQ') { mineInputHeld=false; stopMining(); }
    });
    window.addEventListener('blur',()=>{mineInputHeld=false;stopMining();isDraggingLook=false;});

    document.getElementById('closeInventory').addEventListener('click',()=>{chestOpenKey=null;toggleInventory(false);});
    window.addEventListener('dragend',()=>{inventoryDragActive=false;suppressInventoryClickUntil=performance.now()+500;});
    function bindDropTarget(element,handler) {
      element.addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='move';element.classList.add('drag-over');});
      element.addEventListener('dragleave',()=>element.classList.remove('drag-over'));
      element.addEventListener('drop',event=>{
        event.preventDefault(); element.classList.remove('drag-over');
        inventoryDragActive=false; suppressInventoryClickUntil=performance.now()+500;
        const raw=event.dataTransfer.getData('text/plain');
        let payload;
        try { payload=JSON.parse(raw); } catch (_) { payload={itemId:Number(raw),origin:event.dataTransfer.getData('application/x-voxel-origin')}; }
        const itemId=Number(payload&&payload.itemId), origin=payload&&payload.origin;
        if (ITEM_INFO[itemId]) handler(itemId,origin,payload);
      });
    }
    bindDropTarget(chestGrid,(itemId,origin)=>{if(origin==='player')transferInventoryToChest(itemId);});
    bindDropTarget(inventoryGrid,(itemId,origin)=>{if(origin==='chest')transferChestToInventory(itemId);});
    equipmentSlotElements.forEach(element=>{
      bindDropTarget(element,(itemId,origin)=>equipItem(itemId,origin));
      element.addEventListener('click',()=>{
        if (inventoryDragActive||performance.now()<suppressInventoryClickUntil) return;
        unequipItem(element.dataset.equipmentSlot);
      });
    });
    bindDropTarget(trashDropZone,(itemId,origin,payload)=>{
      if (origin==='hotbar') {
        const slot=Number(payload&&payload.slotIndex);
        if (!Number.isInteger(slot)||slot<0||slot>=hotbarSlots.length||hotbarSlots[slot]!==itemId) return;
        if (isCreative) hotbarSlots[slot]=null;
        else {
          const amount=inventoryCounts[itemId]||0;
          if (!amount) hotbarSlots[slot]=null;
          else if (!spawnDroppedItem(itemId,amount)) return showToast('Too many dropped items nearby');
          else {
            delete inventoryCounts[itemId];
            for (let i=0;i<hotbarSlots.length;i++) if (hotbarSlots[i]===itemId) hotbarSlots[i]=null;
          }
        }
        renderHotbar(); renderInventory();
        return;
      }
      if (origin==='chest' && chestOpenKey!==null) {
        const contents=chestContents.get(chestOpenKey)||Object.create(null), amount=contents[itemId]||0;
        if (isCreative) delete contents[itemId];
        else if (amount && spawnDroppedItem(itemId,amount)) delete contents[itemId];
        chestContents.set(chestOpenKey,contents); sendMultiplayerEvent('chest-change',{key:chestOpenKey,contents:{...contents}}); renderInventory(); return;
      }
      if (isCreative) {
        let removed=false;
        for (let i=0;i<hotbarSlots.length;i++) if (hotbarSlots[i]===itemId) { hotbarSlots[i]=null; removed=true; }
        if (!removed) showToast('That item is not in your hotbar');
        renderHotbar(); renderInventory();
      } else {
        const amount=inventoryCounts[itemId]||0;
        if (amount && spawnDroppedItem(itemId,amount)) {
          delete inventoryCounts[itemId]; renderHotbar(); renderInventory();
        }
      }
    });
    document.getElementById('saveWorldButton').addEventListener('click',()=>{
      if (multiplayerChannel) { if (multiplayerIsHost) downloadMultiplayerBackup(); else showToast('Only the host can create a multiplayer backup'); }
      else downloadWorldJson();
    });
    document.getElementById('loadWorldButton').addEventListener('click',()=>document.getElementById('loadWorldInput').click());
    document.getElementById('loadWorldInput').addEventListener('change',event=>{
      const file=event.target.files&&event.target.files[0]; if(!file) return;
      const reader=new FileReader();
      reader.onload=async()=>{
        try {
          const parsed=JSON.parse(reader.result);
          if (parsed&&parsed.format==='voxel-multiplayer-backup') await importMultiplayerBackup(parsed);
          else loadWorldData(parsed);
        } catch(error) { showToast(`Could not import backup: ${error.message||'Invalid JSON'}`); }
      };
      reader.onerror=()=>showToast('Could not read that world file');
      reader.readAsText(file); event.target.value='';
    });
    window.addEventListener('wheel', (e) => {
      if (!gameStarted || inventoryPanel.classList.contains('open')) return;
      selectedSlot = (selectedSlot + (e.deltaY > 0 ? 1 : -1) + 10) % 10;
      renderHotbar();
    });

    let isDraggingLook = false;
    window.addEventListener('mousemove', (e) => {
      if (!gameStarted || inventoryPanel.classList.contains('open')) return;
      if (document.pointerLockElement === document.body || isDraggingLook) {
        player.yaw -= e.movementX * 0.0024;
        player.pitch -= e.movementY * 0.0024;
        player.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, player.pitch));
      }
    });

    // --- 7. FAST VOXEL RAYCASTING, BREAKING & PLACING ---
    const highlightGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.012,1.012,1.012));
    const highlightBox = new THREE.LineSegments(highlightGeo, new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.9 }));
    highlightBox.renderOrder=4; scene.add(highlightBox);

    function makeCrackMaterial(stage) {
      const canvas=document.createElement('canvas'); canvas.width=16; canvas.height=16;
      const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,16,16);
      const paths=[
        [[7,0],[6,3],[8,5],[6,8],[9,10],[7,13],[8,16]],
        [[0,4],[3,5],[5,7],[6,9],[4,12],[2,13]],
        [[15,3],[12,5],[11,7],[9,8],[10,11],[13,13],[14,16]],
        [[2,0],[3,3],[5,4],[6,7]],
        [[13,0],[12,2],[10,3],[9,6]],
        [[0,10],[3,9],[5,10],[7,12]],
        [[15,9],[12,9],[11,11],[9,13]],
        [[4,16],[5,13],[7,12],[8,10]]
      ];
      paths.slice(0,stage+1).forEach((points,index)=>{
        ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
        points.slice(1).forEach(point=>ctx.lineTo(point[0],point[1]));
        ctx.strokeStyle='rgba(0,0,0,0.9)'; ctx.lineWidth=1.45; ctx.lineCap='square'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(points[0][0]+0.5,points[0][1]);
        points.slice(1).forEach(point=>ctx.lineTo(point[0]+0.5,point[1]));
        ctx.strokeStyle='rgba(225,225,225,0.7)'; ctx.lineWidth=0.45; ctx.stroke();
      });
      const texture=new THREE.CanvasTexture(canvas); texture.magFilter=THREE.NearestFilter; texture.minFilter=THREE.NearestFilter;
      const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
      return material;
    }
    const crackMaterials=Array.from({length:8},(_,stage)=>makeCrackMaterial(stage));
    const crackOverlay=new THREE.Mesh(new THREE.BoxGeometry(1.014,1.014,1.014),crackMaterials[0]);
    crackOverlay.visible=false; crackOverlay.renderOrder=2; scene.add(crackOverlay);

    const voxelRayDirection=new THREE.Vector3();
    const voxelRayOrigin=new THREE.Vector3();
    function raycastVoxel(maxDist = 6.5) {
      const dir = voxelRayDirection.set(0,0,-1).applyEuler(camera.rotation).normalize();
      const origin = voxelRayOrigin.copy(camera.position);

      // Voxel blocks are centered on integer coordinates (x, y, z) spanning [x - 0.5, x + 0.5]
      let x = Math.round(origin.x);
      let y = Math.round(origin.y);
      let z = Math.round(origin.z);

      const stepX = dir.x > 0 ? 1 : -1;
      const stepY = dir.y > 0 ? 1 : -1;
      const stepZ = dir.z > 0 ? 1 : -1;

      const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : 1e9;
      const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : 1e9;
      const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : 1e9;

      let tMaxX = dir.x !== 0 ? ((x + stepX * 0.5 - origin.x) / dir.x) : 1e9;
      let tMaxY = dir.y !== 0 ? ((y + stepY * 0.5 - origin.y) / dir.y) : 1e9;
      let tMaxZ = dir.z !== 0 ? ((z + stepZ * 0.5 - origin.z) / dir.z) : 1e9;

      let normal = { x: 0, y: 0, z: 0 };
      let dist = 0;

      for (let i = 0; i < 40 && dist <= maxDist; i++) {
        const id = voxelMap.get(keyOf(x, y, z));
        if (id) {
          return { x, y, z, id, normal };
        }
        if (tMaxX < tMaxY) {
          if (tMaxX < tMaxZ) {
            dist = tMaxX; x += stepX; tMaxX += tDeltaX;
            normal = { x: -stepX, y: 0, z: 0 };
          } else {
            dist = tMaxZ; z += stepZ; tMaxZ += tDeltaZ;
            normal = { x: 0, y: 0, z: -stepZ };
          }
        } else {
          if (tMaxY < tMaxZ) {
            dist = tMaxY; y += stepY; tMaxY += tDeltaY;
            normal = { x: 0, y: -stepY, z: 0 };
          } else {
            dist = tMaxZ; z += stepZ; tMaxZ += tDeltaZ;
            normal = { x: 0, y: 0, z: -stepZ };
          }
        }
      }
      return null;
    }

    const mobRaycaster=new THREE.Raycaster();
    function raycastMob(maxDist=6.5) {
      if (!mobs.length) return null;
      const dir=new THREE.Vector3(0,0,-1).applyEuler(camera.rotation).normalize();
      const origin=camera.position;
      const blockHit=raycastVoxel(maxDist);
      const blockDistance=blockHit?origin.distanceTo(new THREE.Vector3(blockHit.x,blockHit.y,blockHit.z))-0.7:Infinity;
      const meshOwners=[];
      mobs.forEach(mob=>mob.group.children.forEach(mesh=>{if(mesh.isMesh)meshOwners.push({mesh,mob});}));
      mobRaycaster.set(origin,dir); mobRaycaster.far=maxDist; scene.updateMatrixWorld(true);
      const intersections=mobRaycaster.intersectObjects(meshOwners.map(entry=>entry.mesh),false);
      for (const hit of intersections) {
        const owner=meshOwners.find(entry=>entry.mesh===hit.object);
        if (!owner) continue;
        if (hit.distance>blockDistance+0.35) return null;
        return {mob:owner.mob,distance:hit.distance};
      }
      return null;
    }
    function damageMob(mob) {
      if (!mob||!mobs.includes(mob)) return;
      const held=ITEM_INFO[hotbarSlots[selectedSlot]];
      const damage=isCreative?mob.maxHealth:(held&&held.toolType==='axe'?6:held&&held.toolType==='pickaxe'?4:3);
      mob.health=Math.max(0,mob.health-damage);
      refreshMobHealthBar(mob);
      if (mob.health>0) { showToast(`${mob.kind[0].toUpperCase()+mob.kind.slice(1)} · ${mob.health}/${mob.maxHealth}`); return; }
      const position=mob.group.position.clone(); position.y-=0.1;
      const rawMeatCount=mob.kind==='sheep'?1+Math.floor(Math.random()*2):1+Math.floor(Math.random()*3);
      const velocity=new THREE.Vector3((Math.random()-0.5)*1.4,1.8,(Math.random()-0.5)*1.4);
      removeMob(mobs.indexOf(mob));
      if (!createDroppedItem(118,rawMeatCount,position,velocity,0)) addItem(118,rawMeatCount);
      if (mob.kind==='sheep') {
        const woolCount=1+Math.floor(Math.random()*3);
        if (!createDroppedItem(123,woolCount,position,velocity,0)) addItem(123,woolCount);
        showToast('Sheep dropped raw meat and wool');
      } else showToast(`${mob.kind[0].toUpperCase()+mob.kind.slice(1)} dropped raw meat`);
    }

    let miningActive=false, mineInputHeld=false, miningTargetKey=null, miningHit=null, miningProgress=0, miningDuration=0, miningSoundTimer=0;
    function miningTimeFor(blockId) {
      const block=BLOCK_BY_ID[blockId];
      const hardness=BLOCK_HARDNESS[blockId]===undefined?1:BLOCK_HARDNESS[blockId];
      if (!Number.isFinite(hardness)) return Infinity;
      const held=ITEM_INFO[hotbarSlots[selectedSlot]];
      const tier=held&&held.toolLevel?held.toolLevel:0;
      const required=block&&block.requiredPickaxe?block.requiredPickaxe:0;
      let speed;
      if (required) speed=held&&held.toolType==='pickaxe'&&tier>=required ? 2.8+(tier-required)*0.85 : 0.35;
      else if (block&&block.preferredTool) speed=held&&held.toolType===block.preferredTool ? 3.1+Math.max(0,tier-1)*0.8 : 0.65;
      else speed=1+(held&&held.toolType==='pickaxe'?tier*0.12:0);
      return Math.max(0.12,hardness*1.5/speed);
    }
    function stopMining() {
      miningActive=false; miningTargetKey=null; miningHit=null; miningProgress=0;
      miningSoundTimer=0;
      crackOverlay.visible=false;
    }
    function breakBlock(hit) {
      if (!hit) return;
      const blockKey=keyOf(hit.x,hit.y,hit.z);
      if (voxelMap.get(blockKey)!==hit.id) return;
      const bInfo=BLOCK_BY_ID[hit.id];
      if (!isCreative && bInfo && bInfo.unbreakable) return;
      if (bInfo && bInfo.id===33) {
        const contents=chestContents.get(blockKey);
        if (!isCreative && contents) Object.entries(contents).forEach(([id,count])=>spawnDroppedItem(Number(id),count));
        chestContents.delete(blockKey);
        sendMultiplayerEvent('chest-change',{key:blockKey,contents:null});
      }
      if (hit.id===44||hit.id===46) {
        const bottomY=hit.id===46?hit.y-1:hit.y, topY=bottomY+1;
        for (const y of [bottomY,topY]) { const key=keyOf(hit.x,y,hit.z); if(voxelMap.has(key)){deleteVoxel(hit.x,y,hit.z);blockRotations.delete(key);openDoors.delete(key);recordMultiplayerBlockChange(key,null);} }
      } else { deleteVoxel(hit.x,hit.y,hit.z); blockRotations.delete(blockKey); openDoors.delete(blockKey); recordMultiplayerBlockChange(blockKey,null); }
      if (hit.id===6) queueLeafDecayAround(hit.x,hit.y,hit.z);
      if (REDSTONE_NODE_IDS.has(hit.id)) recomputeRedstonePower();
      playSound('break',hit.id);
      if (!isCreative && bInfo) {
        const held=ITEM_INFO[hotbarSlots[selectedSlot]];
        const toolLevel=held&&held.toolLevel?held.toolLevel:0;
        const required=bInfo.requiredPickaxe||0;
        const canHarvest=required===0 || (held&&held.toolType==='pickaxe'&&toolLevel>=required);
        if (canHarvest) {
          const dropId=(hit.id===44||hit.id===46)?44:(bInfo.dropItem===undefined?bInfo.id:bInfo.dropItem);
          if (!addItem(dropId,1)) spawnDroppedItem(dropId,1);
          if (bInfo.id===10 && Math.random()<0.12 && !addItem(20,1)) spawnDroppedItem(20,1);
        } else if (required>0) showToast(required>1?'A stone pickaxe is needed to harvest this':'A wooden pickaxe is needed to harvest this');
      }
      rebuildVisibleInstances(); renderInventory();
    }
    function startMiningAt(hit) {
      if (!hit) { stopMining(); return; }
      const block=BLOCK_BY_ID[hit.id];
      if (!isCreative && block && block.unbreakable) { stopMining(); mineInputHeld=false; return; }
      const key=keyOf(hit.x,hit.y,hit.z);
      if (miningActive && miningTargetKey===key) return;
      miningTargetKey=key; miningHit={...hit}; miningProgress=0; miningSoundTimer=0;
      if (isCreative) { stopMining(); breakBlock(hit); return; }
      miningDuration=miningTimeFor(hit.id); miningActive=true;
      crackOverlay.position.set(hit.x,hit.y,hit.z); crackOverlay.material=crackMaterials[0]; crackOverlay.visible=true;
    }
    function beginMining() {
      const mobTarget=raycastMob();
      if (mobTarget) { mineInputHeld=false; stopMining(); damageMob(mobTarget.mob); return; }
      startMiningAt(raycastVoxel());
    }
    function dropSelectedItems(dropStack=false) {
      const itemId=hotbarSlots[selectedSlot];
      if (itemId===null || !ITEM_INFO[itemId]) return;
      const available=isCreative?ITEM_STACK_LIMIT:(inventoryCounts[itemId]||0);
      const amount=dropStack?available:Math.min(1,available);
      if (!amount) return;
      if (!spawnDroppedItem(itemId,amount)) return showToast('Too many dropped items nearby');
      playSound('drop');
      if (!isCreative) {
        inventoryCounts[itemId]-=amount;
        if (inventoryCounts[itemId]<=0) delete inventoryCounts[itemId];
        renderHotbar(); renderInventory();
      }
    }
    function updateMining(dt) {
      if (!miningActive) {
        if (mineInputHeld && gameStarted && !inventoryPanel.classList.contains('open')) beginMining();
        return;
      }
      if (!gameStarted || inventoryPanel.classList.contains('open')) { stopMining(); return; }
      const hit=raycastVoxel();
      if (!hit) { stopMining(); return; }
      const key=keyOf(hit.x,hit.y,hit.z);
      if (key!==miningTargetKey) { startMiningAt(hit); return; }
      miningHit={...hit}; miningProgress+=dt;
      const progress=Math.min(1,miningProgress/miningDuration);
      miningSoundTimer-=dt;
      if (progress<1&&miningSoundTimer<=0) {
        const heldItem=ITEM_INFO[hotbarSlots[selectedSlot]];
        playSound('mine',hit.id,heldItem&&heldItem.toolType||'hand');
        miningSoundTimer=0.31+Math.random()*0.07;
      }
      const stage=Math.min(crackMaterials.length-1,Math.floor(progress*crackMaterials.length));
      crackOverlay.position.set(hit.x,hit.y,hit.z); crackOverlay.material=crackMaterials[stage]; crackOverlay.visible=true;
      if (progress>=1) {
        const completedHit=miningHit; stopMining(); breakBlock(completedHit);
      }
    }

    function consumeOneItem(itemId) {
      if (isCreative) return true;
      const count=inventoryCounts[itemId]||0;
      if (count<=0) return false;
      if (count===1) delete inventoryCounts[itemId];
      else inventoryCounts[itemId]=count-1;
      clearUnavailableHotbarSlots();
      return true;
    }
    function canAddAfterConsuming(outputId,consumedId) {
      if ((inventoryCounts[outputId]||0)>=ITEM_STACK_LIMIT) return false;
      return inventorySpaceForItem(outputId)>0||(!isCreative&&(inventoryCounts[consumedId]||0)===1);
    }
    function openWorkstation(hit) {
      if (!hit||![17,18,36].includes(hit.id)) return false;
      chestOpenKey=null; craftingStationId=hit.id; craftingTableOpen=hit.id===18; toggleInventory(true); return true;
    }
    function toggleDoorAt(hit) {
      if (!hit||(hit.id!==44&&hit.id!==46)) return false;
      const bottomY=hit.id===46?hit.y-1:hit.y, bottomKey=keyOf(hit.x,bottomY,hit.z), topKey=keyOf(hit.x,bottomY+1,hit.z);
      const opening=!openDoors.has(bottomKey);
      if (opening) { openDoors.add(bottomKey); openDoors.add(topKey); }
      else { openDoors.delete(bottomKey); openDoors.delete(topKey); }
      recordMultiplayerBlockChange(bottomKey,44); recordMultiplayerBlockChange(topKey,46);
      rebuildVisibleInstances(); playSound('ui'); return true;
    }
    function placeTargetedBlock() {
      const hit=raycastVoxel();
      if (toggleRedstoneLeverAt(hit)) return;
      if (hit&&(hit.id===44||hit.id===46)) { toggleDoorAt(hit); return; }
      if (openWorkstation(hit)) return;
      const selectedItem=ITEM_INFO[hotbarSlots[selectedSlot]];
      if (selectedItem&&(selectedItem.foodValue||selectedItem.thirstValue||selectedItem.healValue)) { eatSelectedFood(); return; }
      const selectedItemId=hotbarSlots[selectedSlot];
      if (selectedItemId===132) {
        if (!hit||hit.id!==34) { showToast('Aim an empty bottle at water to collect it'); return; }
        if (!isCreative&&(inventoryCounts[132]||0)<=0) return;
        if (!canAddAfterConsuming(133,132)) { showToast('Make room for the dirty water bottle'); return; }
        consumeOneItem(132);
        if (!addItem(133,1)) { if (!isCreative) addItem(132,1); showToast('Could not collect the water'); return; }
        showToast('Water collected · purify it at a campfire');
        return;
      }
      if (selectedItemId===133) {
        if (!hit||hit.id!==36) { showToast('Use the dirty water bottle on a campfire to purify it'); return; }
        if (!isCreative&&(inventoryCounts[133]||0)<=0) return;
        if (!canAddAfterConsuming(120,133)) { showToast('Make room for the purified water bottle'); return; }
        consumeOneItem(133);
        if (!addItem(120,1)) { if (!isCreative) addItem(133,1); showToast('Could not purify the water'); return; }
        showToast('Water purified · drink it to restore thirst');
        return;
      }
      if (!hit) return;

      const nx = hit.x + hit.normal.x;
      const ny = hit.y + hit.normal.y;
      const nz = hit.z + hit.normal.z;

      if (Math.abs(nx) > WORLD_LIMIT || Math.abs(nz) > WORLD_LIMIT) return;
      if (voxelMap.has(keyOf(nx, ny, nz))) return;
      if (hotbarSlots[selectedSlot]!==null&&ITEM_INFO[hotbarSlots[selectedSlot]]?.blockId===44&&voxelMap.has(keyOf(nx,ny+1,nz))) { showToast('There is not enough room for the door'); return; }

      // Check AABB overlap between placed block [nx-0.5, nx+0.5] and player bounding box
      const pMinX = player.pos.x - player.radius;
      const pMaxX = player.pos.x + player.radius;
      const pMinY = player.pos.y - player.height;
      const pMaxY = player.pos.y + 0.15;
      const pMinZ = player.pos.z - player.radius;
      const pMaxZ = player.pos.z + player.radius;

      const overlapsPlayer =
        (nx + 0.5 > pMinX && nx - 0.5 < pMaxX) &&
        (ny + 0.5 > pMinY && ny - 0.5 < pMaxY) &&
        (nz + 0.5 > pMinZ && nz - 0.5 < pMaxZ);

      if (overlapsPlayer) return;

      const itemId=hotbarSlots[selectedSlot], item=itemId===null?null:ITEM_INFO[itemId];
      if (!item || (!isCreative && (inventoryCounts[itemId]||0)<=0)) return;
      if (item.blockId===null) { showToast('That item cannot be placed'); return; }
      if (item.blockId===37||item.blockId===38) {
        const supportId=voxelMap.get(keyOf(nx,ny-1,nz));
        const topPlacement=hit.normal.y===1;
        const wireSideExtension=item.blockId===37&&(hit.id===37||hit.id===42)&&hit.normal.y===0;
        if ((!topPlacement&&!wireSideExtension)||!BLOCK_BY_ID[supportId]||!BLOCK_BY_ID[supportId].solid) {
          showToast(item.blockId===37?'Redstone dust needs a solid block underneath':'Place the lever on top of a solid block');
          return;
        }
      }
      const placedKey=keyOf(nx,ny,nz);
      setVoxel(nx,ny,nz,item.blockId);
      if (item.blockId===44) setVoxel(nx,ny+1,nz,46);
      const facing=Math.round((player.yaw-Math.PI)/(Math.PI/2))*(Math.PI/2);
      blockRotations.set(placedKey,facing);
      if (item.blockId===44) { const upperKey=keyOf(nx,ny+1,nz); blockRotations.set(upperKey,facing); openDoors.delete(placedKey); openDoors.delete(upperKey); recordMultiplayerBlockChange(upperKey,46); }
      recordMultiplayerBlockChange(placedKey,item.blockId);
      playSound('place');
      if (item.blockId===6) queueLeafDecayAround(nx,ny,nz);
      if (REDSTONE_NODE_IDS.has(item.blockId)) recomputeRedstonePower();
      if (item.blockId===33 && !chestContents.has(placedKey)) {
        chestContents.set(placedKey,Object.create(null));
        sendMultiplayerEvent('chest-change',{key:placedKey,contents:{}});
      }
      if (!isCreative) {
        inventoryCounts[itemId]--;
        if (inventoryCounts[itemId]<=0) delete inventoryCounts[itemId];
        renderHotbar(); renderInventory();
      }
      rebuildVisibleInstances();
    }

    function pickTargetedBlock() {
      if (!isCreative) return;
      const hit=raycastVoxel();
      if (!hit || !BLOCK_BY_ID[hit.id]) return;
      const pickedId=hit.id===46?44:hit.id;
      let slot=hotbarSlots.indexOf(pickedId);
      if (slot<0) slot=hotbarSlots.findIndex(itemId=>itemId===null);
      if (slot<0) slot=selectedSlot;
      hotbarSlots[slot]=pickedId;
      selectedSlot=slot;
      renderHotbar(); renderInventory();
    }

    // Pointer lock retargets mouse events to the locked element (the body),
    // so listen on document to keep all mouse buttons working in and out of lock.
    document.addEventListener('mousedown', (e) => {
      if (e.target.closest && e.target.closest('#overlay, #inventoryPanel, #hotbar, #multiplayerHud, .multiplayer-float-panel')) return;
      if (!gameStarted || inventoryPanel.classList.contains('open')) return;
      if (document.pointerLockElement !== document.body) requestGamePointerLock();

      if (e.button === 0) {
        isDraggingLook = true;
        mineInputHeld=true;
        beginMining();
      } else if (e.button === 1) {
        e.preventDefault();
        if (isCreative) pickTargetedBlock();
      } else if (e.button === 2) {
        e.preventDefault();
        const hit=raycastVoxel();
        if (toggleRedstoneLeverAt(hit)) return;
        if (hit&&(hit.id===44||hit.id===46)) { toggleDoorAt(hit); return; }
        if ((hotbarSlots[selectedSlot]===132&&hit&&hit.id===34)||(hotbarSlots[selectedSlot]===133&&hit&&hit.id===36)) { placeTargetedBlock(); return; }
        if (openWorkstation(hit)) return;
        if (hit&&hit.id===33) { chestOpenKey=keyOf(hit.x,hit.y,hit.z); craftingTableOpen=false; craftingStationId=null; if(!chestContents.has(chestOpenKey))chestContents.set(chestOpenKey,Object.create(null)); toggleInventory(true); return; }
        placeTargetedBlock();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button===0) { mineInputHeld=false; stopMining(); }
      isDraggingLook=false;
    });

    function collidesAt(pos) {
      const minX = Math.round(pos.x - player.radius);
      const maxX = Math.round(pos.x + player.radius);
      const minY = Math.round(pos.y - player.height + 0.05);
      const maxY = Math.round(pos.y + 0.15);
      const minZ = Math.round(pos.z - player.radius);
      const maxZ = Math.round(pos.z + player.radius);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            const id=voxelMap.get(keyOf(x,y,z));
            const packed=keyOf(x,y,z);
            if (id===44||id===46) {
              const bottomKey=id===46?keyOf(x,y-1,z):packed;
              if (openDoors.has(bottomKey)) continue;
              const rotation=blockRotations.get(packed)||0, dx=pos.x-x, dz=pos.z-z;
              const localX=dx*Math.cos(rotation)-dz*Math.sin(rotation), localZ=dx*Math.sin(rotation)+dz*Math.cos(rotation);
              if (Math.abs(localX)<0.5+player.radius&&Math.abs(localZ)<0.08+player.radius) return true;
            } else if (id===45) {
              const rotation=blockRotations.get(packed)||0, dx=pos.x-x, dz=pos.z-z;
              const localX=dx*Math.cos(rotation)-dz*Math.sin(rotation), localZ=dx*Math.sin(rotation)+dz*Math.cos(rotation);
              const horizontalFull=Math.abs(dx)<0.5+player.radius&&Math.abs(dz)<0.5+player.radius;
              const lowerOverlap=pos.y-player.height+0.05<y&&pos.y+0.15>y-0.5&&horizontalFull;
              const upperFootprint=localX>-0.5-player.radius&&localX<player.radius&&Math.abs(localZ)<0.5+player.radius;
              const upperOverlap=pos.y-player.height+0.05<y+0.5&&pos.y+0.15>y&&upperFootprint;
              if (lowerOverlap||upperOverlap) return true;
            } else if (id!==undefined&&BLOCK_BY_ID[id]&&BLOCK_BY_ID[id].solid!==false) return true;
          }
        }
      }
      return false;
    }
    function isPlayerInWater(pos=player.pos) {
      const minX=Math.round(pos.x-player.radius), maxX=Math.round(pos.x+player.radius);
      const minY=Math.round(pos.y-player.height+0.05), maxY=Math.round(pos.y+0.15);
      const minZ=Math.round(pos.z-player.radius), maxZ=Math.round(pos.z+player.radius);
      for (let x=minX;x<=maxX;x++) for (let y=minY;y<=maxY;y++) for (let z=minZ;z<=maxZ;z++) {
        if (voxelMap.get(keyOf(x,y,z))===34) return true;
      }
      return false;
    }

    // --- 8. MAIN LOOP ---
    const coordsEl = document.getElementById('coords');
    const fpsEl = document.getElementById('fps');
    const moveForwardVector=new THREE.Vector3();
    const moveRightVector=new THREE.Vector3();
    const moveVector=new THREE.Vector3();
    let prevTime = performance.now();
    let frameCount = 0;
    let lastFpsTime = prevTime;
    let biomeLabelX=NaN, biomeLabelZ=NaN;
    let lastCoordsX=NaN,lastCoordsY=NaN,lastCoordsZ=NaN,lastMenuRenderAt=0;

    function animate() {
      requestAnimationFrame(animate);

      const now = performance.now();
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;

      frameCount++;
      if (now - lastFpsTime >= 500) {
        fpsEl.textContent = Math.round((frameCount * 1000) / (now - lastFpsTime));
        frameCount = 0;
        lastFpsTime = now;
      }

      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;

      if (gameStarted && !inventoryPanel.classList.contains('open')) {
        const turnSpeed = 2.2 * dt;
        if (keys['ArrowLeft']) player.yaw += turnSpeed;
        if (keys['ArrowRight']) player.yaw -= turnSpeed;
        if (keys['ArrowUp']) player.pitch = Math.min(Math.PI / 2 - 0.02, player.pitch + turnSpeed);
        if (keys['ArrowDown']) player.pitch = Math.max(-Math.PI / 2 + 0.02, player.pitch - turnSpeed);

        const forward = moveForwardVector.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
        const right = moveRightVector.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
        const move = moveVector.set(0,0,0);

        if (keys['KeyW']) move.add(forward);
        if (keys['KeyS']) move.sub(forward);
        if (keys['KeyD']) move.add(right);
        if (keys['KeyA']) move.sub(right);
        if (move.lengthSq() > 0) move.normalize();

        const inWater=isPlayerInWater();
        if (inWater!==player.inWater) player.fallStartY=player.pos.y;
        player.inWater=inWater;
        const moveSpeed = player.flying ? player.speed * 1.8 : player.inWater ? player.speed*0.68 : player.speed;
        player.vel.x = move.x * moveSpeed;
        player.vel.z = move.z * moveSpeed;

        if (player.flying) {
          player.vel.y = 0;
          if (keys['Space']) player.vel.y = moveSpeed;
          if (keys['ShiftLeft'] || keys['ShiftRight']) player.vel.y = -moveSpeed;
          player.fallStartY = player.pos.y;
        } else if (player.inWater) {
          player.vel.y=Math.max(-3.2,player.vel.y-2.2*dt);
          if (keys['Space']) player.vel.y=Math.min(4.2,player.vel.y+18*dt);
          if (keys['ShiftLeft']||keys['ShiftRight']) player.vel.y=Math.max(-4.2,player.vel.y-18*dt);
        } else {
          if (keys['Space'] && player.onGround) {
            player.vel.y = player.jumpForce;
            player.onGround = false;
          }
          player.vel.y -= 22 * dt;
        }

        player.pos.x += player.vel.x * dt;
        if (collidesAt(player.pos)) player.pos.x -= player.vel.x * dt;

        player.pos.z += player.vel.z * dt;
        if (collidesAt(player.pos)) player.pos.z -= player.vel.z * dt;

        player.pos.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, player.pos.x));
        player.pos.z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, player.pos.z));

        const currentlyInWater=isPlayerInWater();
        if (currentlyInWater!==player.inWater) player.fallStartY=player.pos.y;
        player.inWater=currentlyInWater;

        const wasOnGround = player.onGround;
        player.pos.y += player.vel.y * dt;
        if (collidesAt(player.pos)) {
          if (player.vel.y < 0) {
            player.onGround = true;
            if (!wasOnGround && !isCreative) {
              const fallDist = player.fallStartY - player.pos.y;
              if (fallDist > 3.5) {
                const rawDamage=Math.floor(fallDist-3);
                const armorMultiplier=Math.max(0.35,1-equippedArmorRating()*0.045);
                health = Math.max(0, health - Math.max(1,Math.floor(rawDamage*armorMultiplier)));
                renderHearts();
                if (health === 0) {
                  health = 20;
                  hunger = 20; thirst=20; bodyTemperature=37; hungerDrainTimer=0; starvationTimer=0; thirstDrainTimer=0; dehydrationTimer=0; healthRegenTimer=0; thermalExposureTimer=0; lastBodyTempDisplay=NaN;
                  player.pos.set(0.5, terrainHeight(0, 0) + 3.2, 0.5);
                  renderHearts();
                }
              }
            }
            player.fallStartY = player.pos.y;
          }
          player.pos.y -= player.vel.y * dt;
          player.vel.y = 0;
        } else {
          if (wasOnGround) player.fallStartY = player.pos.y;
          player.onGround = false;
        }

        if (player.pos.y < -25) {
          player.pos.set(0.5, terrainHeight(0, 0) + 3.2, 0.5);
          player.vel.set(0, 0, 0);
        }

        updateChunksAroundPlayer();
      }

      if (gameStarted) processChunkGeneration();
      if (gameStarted) updateLeafDecay(dt);
      if (gameStarted) updateGrassSpread(dt);
      if (needsMeshRebuild && ((!activeChunkJob&&chunkQueue.length===0) || chunksSinceMeshRebuild>=CHUNKS_PER_MESH_REBUILD)) {
        rebuildVisibleInstances();
      }
      if (gameStarted&&multiplayerChannel) {
        multiplayerPositionTimer+=dt;
        if (multiplayerPositionTimer>=0.1) { multiplayerPositionTimer=0; sendLocalPlayerPosition(); }
      }
      animateRemotePlayers(dt);
      camera.position.copy(player.pos);
      if (gameStarted) updateMobs(dt);
      if (gameStarted) updateRealisticTemperature(dt);
      if (gameStarted) updateHunger(dt);
      if (gameStarted) updateDroppedItems(dt);
      updateMining(dt);
      if (gameStarted) {
        const px=Math.floor(player.pos.x), py=Math.floor(player.pos.y), pz=Math.floor(player.pos.z);
        if (px!==lastCoordsX||py!==lastCoordsY||pz!==lastCoordsZ) {
          const depth=Math.max(0,terrainHeight(px,pz)-py);
          coordsEl.textContent=`${px}, ${py}, ${pz} | Depth ${depth}m`;
          lastCoordsX=px; lastCoordsY=py; lastCoordsZ=pz;
        }
        if (px!==biomeLabelX||pz!==biomeLabelZ) {
          biomeLabel.textContent=biomeAt(px,pz);
          temperatureLabel.textContent=`${temperatureAt(px,pz)}°C`;
          biomeLabelX=px; biomeLabelZ=pz;
        }
      }

      if (gameStarted&&!inventoryPanel.classList.contains('open')) {
        const hit = raycastVoxel();
        if (hit) {
          highlightBox.visible=true; highlightBox.position.set(hit.x,hit.y,hit.z); highlightBox.scale.set(1,1,1);
          if (hit.id===37||hit.id===42) { highlightBox.position.y=hit.y-0.46; highlightBox.scale.set(1,0.06,1); }
          else if (hit.id===38||hit.id===41) { highlightBox.position.y=hit.y-0.2; highlightBox.scale.set(0.24,0.58,0.24); }
        }
        else highlightBox.visible = false;
      } else highlightBox.visible = false;

      if (gameStarted||now-lastMenuRenderAt>=100) {
        renderer.render(scene, camera);
        lastMenuRenderAt=now;
      }
    }

    document.getElementById('inventoryPanel').addEventListener('mousedown',e=>e.stopPropagation());
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio*graphicsScale,1.25));
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
