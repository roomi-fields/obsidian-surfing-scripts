/**
 * Script Surfing : Créer note Obsidian depuis réponse AI + bouton enrichissement
 * Compatible Claude.ai et ChatGPT
 *
 * Variante de create-note.js qui ajoute automatiquement un bouton Dataview JS
 * pour enrichir le brouillon via le workflow n8n.
 */

(async function() {
  const API_URL = 'http://localhost:27123';
  const TOKEN = '79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab';

  // Catégories disponibles (correspondent aux notebooks NotebookLM enregistrés)
  const CATEGORIES = [
    { id: 'cnv', label: 'CNV (Communication NonViolente)' },
    { id: 'ifs', label: 'IFS (Internal Family Systems - EN)' },
    { id: 'ifs-fr', label: 'IFS (Thérapie IFS - FR)' },
    { id: 'osho', label: 'OSHO (Méditation/Spiritualité)' },
    { id: 'polyvagal', label: 'Polyvagal (Théorie Polyvagale)' },
    { id: 'psychedeliques', label: 'Psychédéliques (Thérapies)' },
    { id: 'focusing', label: 'Focusing (Gendlin)' },
    { id: 'plutchik', label: 'Plutchik (Émotions)' }
  ];

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

  // Ajouter le bouton d'enrichissement n8n (Dataview JS) après le frontmatter
  // Note: CATEGORY_PLACEHOLDER sera remplacé par la catégorie sélectionnée lors de la création
  const enrichButton = `
\`\`\`dataviewjs
const btn = dv.el('button', '🚀 Générer Références + Structure');
btn.style.cssText = 'background:#7c3aed;color:white;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:14px;';
btn.onclick = async () => {
  const file = dv.current().file.path;
  const categorie = dv.current().categorie || 'regards';
  btn.textContent = '⏳ Enrichissement en cours...';
  btn.disabled = true;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout
    const res = await fetch('http://192.168.1.44:32770/webhook/article-enrichissement', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({file_path: file, category: categorie}),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data.status === 'success') {
      btn.textContent = '✅ Fichiers créés !';
      new Notice('_2_references.md et _3_structure.md créés ! (notebook: ' + (data.notebook_used || 'aucun') + ')');
    } else {
      btn.textContent = '❌ Erreur';
    }
  } catch(e) {
    btn.textContent = '❌ ' + e.message;
  }
};
\`\`\`

`;
  // Insérer le bouton après le frontmatter (après le second ---)
  const frontmatterEnd = content.indexOf('---', content.indexOf('---') + 3);
  if (frontmatterEnd !== -1) {
    const insertPos = frontmatterEnd + 3;
    content = content.slice(0, insertPos) + '\n' + enrichButton + content.slice(insertPos);
  } else {
    // Pas de frontmatter, ajouter au début
    content = enrichButton + content;
  }

  // Sanitize pour nom de fichier (garder les espaces)
  const sanitized = title
    .replace(/[\/\\:*?"<>|]/g, '')
    .substring(0, 100);

  // Nom du fichier avec suffixe numéroté _1_brouillon
  const filename = sanitized + '_1_brouillon.md';

  // Créer le popup
  const overlay = document.createElement('div');
  overlay.id = 'obsidian-overlay';

  // Générer les options de catégorie
  const categoryOptions = CATEGORIES.map(c =>
    `<option value="${c.id}">${c.label}</option>`
  ).join('');

  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;">
      <div style="background:white;padding:20px;border-radius:8px;min-width:350px;color:black;">
        <h3 style="margin:0 0 15px 0;">Créer brouillon + bouton enrichir</h3>
        <p style="margin:0 0 10px 0;font-size:14px;">Fichier: ${filename}</p>

        <label style="display:block;margin-bottom:5px;font-weight:bold;font-size:13px;">Catégorie (notebook NotebookLM) :</label>
        <select id="obsidian-category" style="width:100%;padding:8px;margin-bottom:8px;background:white;color:black;border:1px solid #ccc;">
          ${categoryOptions}
        </select>

        <label style="display:block;margin-bottom:5px;font-size:12px;color:#666;">Ou catégorie personnalisée (prioritaire si remplie) :</label>
        <input type="text" id="obsidian-category-custom" placeholder="ex: meditation, jung, attachement..." style="width:100%;padding:8px;margin-bottom:15px;background:white;color:black;border:1px solid #ccc;box-sizing:border-box;">

        <label style="display:block;margin-bottom:5px;font-weight:bold;font-size:13px;">Dossier :</label>
        <select id="obsidian-folder" style="width:100%;padding:8px;margin-bottom:15px;background:white;color:black;border:1px solid #ccc;"></select>

        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="obsidian-cancel" style="padding:8px 16px;cursor:pointer;">Annuler</button>
          <button id="obsidian-create" style="padding:8px 16px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;">Créer</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const selectCategory = document.getElementById('obsidian-category');
  const inputCategoryCustom = document.getElementById('obsidian-category-custom');
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
    const path = folder + filename;
    // Catégorie personnalisée prioritaire si remplie, sinon dropdown
    const customCat = inputCategoryCustom.value.trim().toLowerCase().replace(/\s+/g, '-');
    const selectedCategory = customCat || selectCategory.value;

    // Injecter la catégorie dans le frontmatter
    let finalContent = content;
    const fmMatch = finalContent.match(/^(---\n[\s\S]*?)(---)/);
    if (fmMatch) {
      // Frontmatter existe : ajouter categorie avant le --- de fermeture
      const fmContent = fmMatch[1];
      const fmEnd = fmMatch[2];
      // Vérifier si categorie existe déjà
      if (!fmContent.includes('categorie:')) {
        finalContent = finalContent.replace(
          fmMatch[0],
          fmContent + 'categorie: ' + selectedCategory + '\n' + fmEnd
        );
      }
    } else {
      // Pas de frontmatter : en créer un
      finalContent = '---\ncategorie: ' + selectedCategory + '\n---\n\n' + finalContent;
    }

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
        alert('Brouillon créé avec catégorie "' + selectedCategory + '" : ' + path);
        overlay.remove();
      } else {
        alert('Erreur création: ' + r.status);
      }
    } catch (e) {
      alert('Erreur: ' + e.message);
    }
  };
})();
