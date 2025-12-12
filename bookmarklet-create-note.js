/**
 * Bookmarklet 2 : Créer note Obsidian depuis réponse AI
 * Compatible Claude.ai et ChatGPT
 */

(async function() {
  const API_URL = 'http://localhost:27123';
  const TOKEN = '79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab';

  const isClaude = window.location.hostname.includes('claude.ai');
  const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');

  // Utiliser surfingFetch si disponible (bypass CSP), sinon fetch standard
  const useSurfingFetch = typeof surfingFetch === 'function';

  async function safeFetch(url, options) {
    if (useSurfingFetch) {
      const res = await surfingFetch(url, options);
      return {
        ok: res.ok,
        status: res.status,
        json: () => JSON.parse(res.text),
        text: () => res.text
      };
    }
    return fetch(url, options);
  }

  // Supprimer tout popup existant
  const existing = document.getElementById('obsidian-overlay');
  if (existing) existing.remove();

  // Récupérer la dernière réponse selon le site
  let lastMessage;
  if (isClaude) {
    const messages = document.querySelectorAll('[data-is-streaming="false"]');
    lastMessage = messages[messages.length - 1];
  } else if (isChatGPT) {
    const messages = document.querySelectorAll('[data-turn="assistant"]');
    lastMessage = messages[messages.length - 1];
  }

  if (!lastMessage) {
    alert('Aucune réponse trouvée');
    return;
  }

  // Extraire le contenu markdown
  let content = lastMessage.innerText;

  // Nettoyer les éléments UI de ChatGPT - trouver le début du frontmatter YAML
  const yamlStart = content.indexOf('---');
  if (yamlStart > 0) {
    content = content.substring(yamlStart);
  }

  // Supprimer les éléments UI
  content = content.replace(/Copier le code\s*/g, '');
  content = content.replace(/Copy code\s*/g, '');

  // Chercher le bloc YAML complet (frontmatter + contenu jusqu'au marqueur END)
  // Pattern: --- ... --- suivi du contenu jusqu'à <!-- END -->
  const yamlMatch = content.match(/(---[\s\S]*?---[\s\S]*?)<!-- END -->/);
  if (yamlMatch) {
    content = yamlMatch[1].trim();
  } else {
    // Fallback : chercher bloc markdown classique
    const mdMatch = content.match(/```markdown\n([\s\S]*?)```/);
    if (mdMatch) {
      content = mdMatch[1].trim();
    }
  }

  // Supprimer le marqueur END s'il reste (fallback)
  content = content.replace(/<!-- END -->/g, '');

  // Extraire le titre depuis le H1
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Note-' + Date.now();

  // Supprimer le titre H1 du contenu (Obsidian utilise le nom de fichier)
  content = content.replace(/^# .+\n+/m, '');

  // Sanitize pour nom de fichier (garder les espaces)
  const sanitized = title
    .replace(/[\/\\:*?"<>|]/g, '')
    .substring(0, 100);

  // Créer le popup
  const overlay = document.createElement('div');
  overlay.id = 'obsidian-overlay';
  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;">
      <div style="background:white;padding:20px;border-radius:8px;min-width:300px;color:black;">
        <h3 style="margin:0 0 15px 0;">Créer note Obsidian</h3>
        <p style="margin:0 0 10px 0;font-size:14px;">Fichier: ${sanitized}.md</p>
        <select id="obsidian-folder" style="width:100%;padding:8px;margin-bottom:15px;background:white;color:black;border:1px solid #ccc;"></select>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="obsidian-cancel" style="padding:8px 16px;cursor:pointer;">Annuler</button>
          <button id="obsidian-create" style="padding:8px 16px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;">Créer</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const select = document.getElementById('obsidian-folder');
  const btnCancel = document.getElementById('obsidian-cancel');
  const btnCreate = document.getElementById('obsidian-create');

  // Charger les dossiers récursivement
  const folderSet = new Set(['/']);

  async function loadFolders(path) {
    try {
      const res = await safeFetch(API_URL + '/vault/' + encodeURIComponent(path), {
        headers: { 'Authorization': 'Bearer ' + TOKEN }
      });
      const data = res.json();
      const subfolders = data.files.filter(f => f.endsWith('/'));
      for (const sub of subfolders) {
        const fullPath = path + sub;
        folderSet.add(fullPath);
        await loadFolders(fullPath);
      }
    } catch (e) {}
  }

  loadFolders('').then(() => {
    const folders = Array.from(folderSet).sort();
    folders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f === '/' ? '/ (racine)' : f;
      select.appendChild(opt);
    });
  })
  .catch(() => {
    alert('Impossible de contacter Obsidian. Vérifiez que Local REST API est actif.');
    overlay.remove();
  });

  btnCancel.onclick = () => overlay.remove();

  btnCreate.onclick = async () => {
    const folder = select.value === '/' ? '' : select.value;
    const path = folder + sanitized + '.md';

    try {
      const r = await safeFetch(API_URL + '/vault/' + encodeURIComponent(path), {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + TOKEN,
          'Content-Type': 'text/markdown'
        },
        body: content
      });
      if (r.ok) {
        alert('Note créée : ' + path);
        overlay.remove();
      } else {
        alert('Erreur création: ' + r.status);
      }
    } catch (e) {
      alert('Erreur: ' + e.message);
    }
  };
})();

// BOOKMARKLET (copier cette ligne) :
// javascript:(async function(){const API="http://localhost:27123",TKN="79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab",useSF=typeof surfingFetch==="function";async function sf(u,o){if(useSF){const r=await surfingFetch(u,o);return{ok:r.ok,status:r.status,json:()=>JSON.parse(r.text)}}return fetch(u,o)}const isClaude=location.hostname.includes("claude.ai"),isChatGPT=location.hostname.includes("chat.openai.com")||location.hostname.includes("chatgpt.com"),x=document.getElementById("obsidian-overlay");if(x)x.remove();let o;if(isClaude){const n=document.querySelectorAll('[data-is-streaming="false"]');o=n[n.length-1]}else if(isChatGPT){const n=document.querySelectorAll('[data-turn="assistant"]');o=n[n.length-1]}if(!o){alert("Aucune réponse trouvée");return}let a=o.innerText;const ys=a.indexOf("---");if(ys>0)a=a.substring(ys);a=a.replace(/Copier le code\s*/g,"");a=a.replace(/Copy code\s*/g,"");const y=a.match(/(---[\s\S]*?---[\s\S]*?)<!-- END -->/);if(y){a=y[1].trim()}else{const i=a.match(/```markdown\n([\s\S]*?)```/);if(i)a=i[1].trim()}a=a.replace(/<!-- END -->/g,"");const s=a.match(/^# (.+)$/m),l=s?s[1].trim():"Note-"+Date.now();a=a.replace(/^# .+\n+/m,"");const r=l.replace(/[\/\\:*?"<>|]/g,"").substring(0,100),c=document.createElement("div");c.id="obsidian-overlay";c.innerHTML=`<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;"><div style="background:white;padding:20px;border-radius:8px;min-width:300px;color:black;"><h3 style="margin:0 0 15px 0;">Créer note Obsidian</h3><p style="margin:0 0 10px 0;font-size:14px;">Fichier: ${r}.md</p><select id="obsidian-folder" style="width:100%;padding:8px;margin-bottom:15px;background:white;color:black;border:1px solid #ccc;"></select><div style="display:flex;gap:10px;justify-content:flex-end;"><button id="obsidian-cancel" style="padding:8px 16px;cursor:pointer;">Annuler</button><button id="obsidian-create" style="padding:8px 16px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;">Créer</button></div></div></div>`,document.body.appendChild(c);const d=document.getElementById("obsidian-folder"),u=document.getElementById("obsidian-cancel"),p=document.getElementById("obsidian-create");const fs=new Set(["/"]);async function lf(path){try{const res=await sf(API+"/vault/"+encodeURIComponent(path),{headers:{Authorization:"Bearer "+TKN}});const data=res.json();for(const f of data.files.filter(f=>f.endsWith("/"))){const fp=path+f;fs.add(fp);await lf(fp)}}catch(e){}}try{await lf("");Array.from(fs).sort().forEach(f=>{const opt=document.createElement("option");opt.value=f;opt.textContent=f==="/"?"/ (racine)":f;d.appendChild(opt)})}catch(e){alert("Impossible de contacter Obsidian.");c.remove()}u.onclick=()=>c.remove();p.onclick=async()=>{const folder=d.value==="/"?"":d.value,path=folder+r+".md";try{const res=await sf(API+"/vault/"+encodeURIComponent(path),{method:"PUT",headers:{Authorization:"Bearer "+TKN,"Content-Type":"text/markdown"},body:a});res.ok?(alert("Note créée : "+path),c.remove()):alert("Erreur création: "+res.status)}catch(e){alert("Erreur: "+e.message)}}})();
