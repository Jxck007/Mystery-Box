import fs from 'fs';
const path = 'C:/Users/JEEVESH R/Downloads/Mystery Box/Mystery-Box/src/app/team/page.tsx';
let txt = fs.readFileSync(path, 'utf8');

txt = txt.replace(/\{unlockFlow === "playingGame" \? \([\s\S]*?<GamePage[\s\S]*?\/>\s*\) : \(\s*/g, '');

txt = txt.replace(/<div className="mystery-box-scene"\>/, '<div className="mystery-box-scene">\n {unlockFlow === "playingGame" ? ( <GamePage embedded boxId={revealedGame?.id} onGameComplete={() => { setUnlockFlow("unlocked"); setRevealedGame(null); setRevealedOpenRecord(null); }} /> ) : (');

fs.writeFileSync(path, txt);
