/**
 * Bookmarklet 5 : Créer article avec enluminure
 * Assemble l'article généré + l'enluminure téléchargée dans une note Obsidian
 * Compatible ChatGPT uniquement
 */

(async function() {
  const API_URL = 'http://localhost:27123';
  const TOKEN = '79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab';

  const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');

  if (!isChatGPT) {
    alert('Ce bookmarklet fonctionne uniquement sur ChatGPT');
    return;
  }

  // Utiliser surfingFetch si disponible
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

  // Récupérer les réponses de l'assistant
  const messages = document.querySelectorAll('[data-turn="assistant"]');

  if (messages.length === 0) {
    alert('Aucune réponse trouvée');
    return;
  }

  // Chercher le message contenant l'article (celui avec <!-- END --> ou le frontmatter YAML)
  let articleMessage = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = messages[i].innerText;
    if (text.includes('<!-- END -->') || (text.includes('---') && text.includes('type: article'))) {
      articleMessage = messages[i];
      break;
    }
  }

  if (!articleMessage) {
    alert('Aucun article trouvé. Assurez-vous d\'avoir généré un article avec le bookmarklet "Article Rédaction".');
    return;
  }

  // Extraire le contenu
  let content = articleMessage.innerText;

  // Nettoyer les éléments UI ChatGPT
  const yamlStart = content.indexOf('---');
  if (yamlStart > 0) {
    content = content.substring(yamlStart);
  }
  content = content.replace(/Copier le code\s*/g, '');
  content = content.replace(/Copy code\s*/g, '');

  // Extraire jusqu'au marqueur END
  const yamlMatch = content.match(/(---[\s\S]*?---[\s\S]*?)<!-- END -->/);
  if (yamlMatch) {
    content = yamlMatch[1].trim();
  } else {
    // Fallback : chercher bloc markdown
    const mdMatch = content.match(/```markdown\n([\s\S]*?)```/);
    if (mdMatch) {
      content = mdMatch[1].trim();
    }
  }
  content = content.replace(/<!-- END -->/g, '');

  // Extraire le titre (H1) et le sous-titre (H3)
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Article-' + Date.now();

  const subtitleMatch = content.match(/^### (.+)$/m);
  const subtitleFromH3 = subtitleMatch ? subtitleMatch[1].trim() : null;

  // Récupérer le nom de l'enluminure sauvegardée
  const enluminure = window.lastSavedEnluminure || null;

  if (!enluminure) {
    const continueWithout = confirm('Aucune enluminure détectée.\n\nAs-tu cliqué sur "Save to Obsidian" sur l\'image ?\n\nCliquer OK pour continuer sans enluminure, ou Annuler pour revenir.');
    if (!continueWithout) return;
  }

  // Extraire le frontmatter existant
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let frontmatter = {};
  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split('\n');
    lines.forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        frontmatter[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      }
    });
  }

  // Extraire le contenu sans le frontmatter, sans le titre H1 et sans le sous-titre H3
  let articleContent = content
    .replace(/^---[\s\S]*?---\n*/, '')
    .replace(/^# .+\n+/, '')
    .replace(/^### .+\n+/, '');

  // Séparer la bibliographie du reste
  const biblioMatch = articleContent.match(/## Bibliographie\n([\s\S]*)$/);
  let bibliography = '';
  if (biblioMatch) {
    bibliography = biblioMatch[1].trim();
    articleContent = articleContent.replace(/## Bibliographie\n[\s\S]*$/, '').trim();
  }

  // Construire le contenu final avec l'enluminure
  const enluminurePath = enluminure ? `_Assets/Enluminures/${enluminure}` : '';

  // Encoder l'URL pour Obsidian Surfing
  const rawUrl = frontmatter.conversation_url || window.location.href;
  const surfingUrl = 'obsidian://web-open?url=' + encodeURIComponent(rawUrl);

  // Générer le slug depuis le title (lowercase, sans accents, tirets)
  const slugFromTitle = (frontmatter.title || title)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9\s-]/g, '') // Garde uniquement lettres, chiffres, espaces, tirets
    .trim()
    .replace(/\s+/g, '-') // Espaces → tirets
    .replace(/-+/g, '-'); // Tirets multiples → un seul

  // Récupérer le subtitle depuis le frontmatter ou le H3
  const subtitle = frontmatter.subtitle || subtitleFromH3 || '';

  let finalContent = `---
type: article
date: ${frontmatter.date || new Date().toISOString().split('T')[0]}
title: "${frontmatter.title || title}"
subtitle: "${subtitle}"
excerpt: "${frontmatter.excerpt || ''}"
slug: ${slugFromTitle}
focus_keyword: ${frontmatter.focus_keyword || ''}
tags: ${frontmatter.tags || '[]'}
categorie: ${frontmatter.categorie || 'systemique'}
${enluminure ? `enluminure: ${enluminurePath}\n` : ''}source: ${frontmatter.source || 'ChatGPT'}
conversation_url: "${surfingUrl}"
---
${enluminure ? `![[${enluminurePath}|150]]\n` : ''}# ${frontmatter.title || title}

${subtitle ? `### ${subtitle}\n\n` : ''}`;

  finalContent += articleContent;

  if (bibliography) {
    finalContent += `\n\n## Bibliographie\n\n${bibliography}`;
  }

  // Sanitize le titre pour le nom de fichier
  const sanitizedTitle = title
    .replace(/[\/\\:*?"<>|]/g, '')
    .substring(0, 100);

  // Créer le popup de sélection de dossier
  const overlay = document.createElement('div');
  overlay.id = 'obsidian-overlay';
  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;">
      <div style="background:white;padding:20px;border-radius:8px;min-width:350px;color:black;">
        <h3 style="margin:0 0 15px 0;">Créer article Obsidian</h3>
        <p style="margin:0 0 5px 0;font-size:14px;"><strong>Fichier:</strong> ${sanitizedTitle}.md</p>
        <p style="margin:0 0 15px 0;font-size:12px;color:#666;">${enluminure ? '🖼️ Enluminure: ' + enluminure : '⚠️ Sans enluminure'}</p>
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

  // Charger les dossiers
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
  }).catch(() => {
    alert('Impossible de contacter Obsidian. Vérifiez que Local REST API est actif.');
    overlay.remove();
  });

  btnCancel.onclick = () => overlay.remove();

  btnCreate.onclick = async () => {
    const folder = select.value === '/' ? '' : select.value;
    const path = folder + sanitizedTitle + '.md';

    try {
      const r = await safeFetch(API_URL + '/vault/' + encodeURIComponent(path), {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + TOKEN,
          'Content-Type': 'text/markdown'
        },
        body: finalContent
      });
      if (r.ok) {
        alert('Article créé : ' + path + (enluminure ? '\n\n🖼️ Avec enluminure intégrée' : ''));
        overlay.remove();
        // Reset pour le prochain article
        window.lastSavedEnluminure = null;
      } else {
        alert('Erreur création: ' + r.status);
      }
    } catch (e) {
      alert('Erreur: ' + e.message);
    }
  };
})();

// BOOKMARKLET (copier cette ligne) :
// javascript:(async function(){const API="http://localhost:27123",TKN="79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab";if(!location.hostname.includes("chat.openai.com")&&!location.hostname.includes("chatgpt.com")){alert("Ce bookmarklet fonctionne uniquement sur ChatGPT");return}const useSF=typeof surfingFetch==="function";async function sf(u,o){if(useSF){const r=await surfingFetch(u,o);return{ok:r.ok,status:r.status,json:()=>JSON.parse(r.text)}}return fetch(u,o)}const x=document.getElementById("obsidian-overlay");if(x)x.remove();const msgs=document.querySelectorAll('[data-turn="assistant"]');if(msgs.length===0){alert("Aucune réponse trouvée");return}let am=null;for(let i=msgs.length-1;i>=0;i--){const t=msgs[i].innerText;if(t.includes("<!-- END -->")||(t.includes("---")&&t.includes("type: article"))){am=msgs[i];break}}if(!am){alert("Aucun article trouvé.");return}let c=am.innerText;const ys=c.indexOf("---");if(ys>0)c=c.substring(ys);c=c.replace(/Copier le code\s*/g,"").replace(/Copy code\s*/g,"");const ym=c.match(/(---[\s\S]*?---[\s\S]*?)<!-- END -->/);if(ym)c=ym[1].trim();else{const mm=c.match(/```markdown\n([\s\S]*?)```/);if(mm)c=mm[1].trim()}c=c.replace(/<!-- END -->/g,"");const tm=c.match(/^# (.+)$/m),title=tm?tm[1].trim():"Article-"+Date.now();const stm=c.match(/^### (.+)$/m),subH3=stm?stm[1].trim():null;const enlu=window.lastSavedEnluminure||null;if(!enlu&&!confirm("Aucune enluminure détectée.\n\nCliquer OK pour continuer sans enluminure."))return;const fm=c.match(/^---\n([\s\S]*?)\n---/);let fmd={};if(fm)fm[1].split("\n").forEach(l=>{const[k,...v]=l.split(":");if(k&&v.length)fmd[k.trim()]=v.join(":").trim().replace(/^["']|["']$/g,"")});let ac=c.replace(/^---[\s\S]*?---\n*/,"").replace(/^# .+\n+/,"").replace(/^### .+\n+/,"");const bm=ac.match(/## Bibliographie\n([\s\S]*)$/);let bib="";if(bm){bib=bm[1].trim();ac=ac.replace(/## Bibliographie\n[\s\S]*$/,"").trim()}const ep=enlu?`_Assets/Enluminures/${enlu}`:"";const rawUrl=fmd.conversation_url||location.href;const sUrl="obsidian://web-open?url="+encodeURIComponent(rawUrl);const slug=(fmd.title||title).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s-]/g,"").trim().replace(/\s+/g,"-").replace(/-+/g,"-");const sub=fmd.subtitle||subH3||"";let fc=`---\ntype: article\ndate: ${fmd.date||new Date().toISOString().split("T")[0]}\ntitle: "${fmd.title||title}"\nsubtitle: "${sub}"\nexcerpt: "${fmd.excerpt||""}"\nslug: ${slug}\nfocus_keyword: ${fmd.focus_keyword||""}\ntags: ${fmd.tags||"[]"}\ncategorie: ${fmd.categorie||"systemique"}\n${enlu?`enluminure: ${ep}\n`:""}source: ${fmd.source||"ChatGPT"}\nconversation_url: "${sUrl}"\n---\n${enlu?`![[${ep}|150]]\n`:""}# ${fmd.title||title}\n\n${sub?`### ${sub}\n\n`:""}`;fc+=ac;if(bib)fc+=`\n\n## Bibliographie\n\n${bib}`;const st=title.replace(/[\/\\:*?"<>|]/g,"").substring(0,100);const ov=document.createElement("div");ov.id="obsidian-overlay";ov.innerHTML=`<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;"><div style="background:white;padding:20px;border-radius:8px;min-width:350px;color:black;"><h3 style="margin:0 0 15px 0;">Créer article Obsidian</h3><p style="margin:0 0 5px 0;font-size:14px;"><strong>Fichier:</strong> ${st}.md</p><p style="margin:0 0 15px 0;font-size:12px;color:#666;">${enlu?"🖼️ Enluminure: "+enlu:"⚠️ Sans enluminure"}</p><select id="obsidian-folder" style="width:100%;padding:8px;margin-bottom:15px;background:white;color:black;border:1px solid #ccc;"></select><div style="display:flex;gap:10px;justify-content:flex-end;"><button id="obsidian-cancel" style="padding:8px 16px;cursor:pointer;">Annuler</button><button id="obsidian-create" style="padding:8px 16px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;">Créer</button></div></div></div>`;document.body.appendChild(ov);const sel=document.getElementById("obsidian-folder"),btnC=document.getElementById("obsidian-cancel"),btnOk=document.getElementById("obsidian-create");const fs=new Set(["/"]);async function lf(p){try{const r=await sf(API+"/vault/"+encodeURIComponent(p),{headers:{Authorization:"Bearer "+TKN}});const d=r.json();for(const f of d.files.filter(f=>f.endsWith("/"))){const fp=p+f;fs.add(fp);await lf(fp)}}catch(e){}}try{await lf("");Array.from(fs).sort().forEach(f=>{const o=document.createElement("option");o.value=f;o.textContent=f==="/"?"/ (racine)":f;sel.appendChild(o)})}catch(e){alert("Impossible de contacter Obsidian.");ov.remove()}btnC.onclick=()=>ov.remove();btnOk.onclick=async()=>{const folder=sel.value==="/"?"":sel.value,path=folder+st+".md";try{const r=await sf(API+"/vault/"+encodeURIComponent(path),{method:"PUT",headers:{Authorization:"Bearer "+TKN,"Content-Type":"text/markdown"},body:fc});r.ok?(alert("Article créé : "+path+(enlu?"\n\n🖼️ Avec enluminure intégrée":"")),ov.remove(),window.lastSavedEnluminure=null):alert("Erreur création: "+r.status)}catch(e){alert("Erreur: "+e.message)}}})();
