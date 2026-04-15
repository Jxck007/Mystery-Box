import re, sys
path = r'C:\Users\JEEVESH R\Downloads\Mystery Box\Mystery-Box\src\app\team\components\mystery-box.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

pattern = r'<div className="bg-white text-black[\s\S]*?<h1[\s\S]*?\{gameTitle\}</h1>\s*</div>'
repl = r'<div className="bg-[#0a0a0a] text-[#b4ff39] px-6 py-4 rounded-xl max-w-[85%] text-center border border-[rgba(180,255,57,0.4)] shadow-[0_0_20px_rgba(180,255,57,0.3)]"><h1 className="font-headline text-2xl sm:text-4xl md:text-5xl uppercase tracking-tighter font-black" style={{ letterSpacing: "-0.04em" }}>{gameTitle}</h1></div>'
text = re.sub(pattern, repl, text)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
