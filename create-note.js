/**
 * Script Surfing : Créer note Obsidian depuis réponse AI
 * Compatible Claude.ai, ChatGPT et Gemini
 *
 * Option "Bouton pipeline" : ajoute un bouton Dataview JS pour lancer
 * le workflow de publication (génération références + structure).
 */

(async function() {
  const SCRIPT_NAME = 'create-note';
  const API_URL = 'http://localhost:27123';
  const TOKEN = 'YOUR_LOCAL_REST_API_TOKEN';

  // Catégories disponibles (notebooks NotebookLM)
  const CATEGORIES = [
    { id: 'cnv', label: 'CNV (Communication NonViolente)' },
    { id: 'ifs', label: 'IFS (Internal Family Systems - EN)' },
    { id: 'ifs-fr', label: 'IFS (Thérapie IFS - FR)' },
    { id: 'osho', label: 'OSHO (Méditation/Spiritualité)' },
    { id: 'polyvagal', label: 'Polyvagal (Théorie Polyvagale)' },
    { id: 'psychedeliques', label: 'Psychédéliques (Thérapies)' },
    { id: 'focusing', label: 'Focusing (Gendlin)' },
    { id: 'plutchik', label: 'Plutchik (Émotions)' },
    { id: 'regards', label: 'Regards (sans notebook)' }
  ];

  function logError(context, error) {
    console.error(`[${SCRIPT_NAME}] ERROR in ${context}:`, error);
  }

  function logInfo(message) {
    console.log(`[${SCRIPT_NAME}] ${message}`);
  }

  const isClaude = window.location.hostname.includes('claude.ai');
  const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');
  const isGemini = window.location.hostname.includes('gemini.google.com');

  logInfo(`Platform: Claude=${isClaude}, ChatGPT=${isChatGPT}, Gemini=${isGemini}`);

  // Utiliser surfingFetch si disponible (bypass CSP)
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
  } else if (isGemini) {
    const messages = document.querySelectorAll('message-content');
    lastMessage = messages[messages.length - 1];
  }

  if (!lastMessage) {
    alert('Aucune réponse trouvée');
    return;
  }

  // Extraire le contenu markdown
  let content = lastMessage.innerText;

  // Nettoyer les éléments UI - trouver le début du frontmatter YAML
  const yamlStart = content.indexOf('---');
  if (yamlStart > 0) {
    content = content.substring(yamlStart);
  }

  // Supprimer les éléments UI
  content = content.replace(/Copier le code\s*/g, '');
  content = content.replace(/Copy code\s*/g, '');

  // Chercher le bloc YAML complet jusqu'au marqueur END
  const yamlMatch = content.match(/(---[\s\S]*?---[\s\S]*?)<!-- END -->/);
  if (yamlMatch) {
    content = yamlMatch[1].trim();
  } else {
    const mdMatch = content.match(/```markdown\n([\s\S]*?)```/);
    if (mdMatch) {
      content = mdMatch[1].trim();
    }
  }

  // Supprimer le marqueur END s'il reste
  content = content.replace(/<!-- END -->/g, '');

  // Extraire le titre depuis le H1
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Note-' + Date.now();

  // Supprimer le titre H1 du contenu (Obsidian utilise le nom de fichier)
  content = content.replace(/^# .+\n+/m, '');

  // Sanitize pour nom de fichier
  const sanitized = title
    .replace(/[\/\\:*?"<>|]/g, '')
    .substring(0, 100);

  // Charger le template du bouton workflow depuis le vault
  const WORKFLOW_BUTTON_TEMPLATE = '_Assets/Prompts Pipeline/workflow-button.template.md';

  async function loadWorkflowButton() {
    try {
      const res = await safeFetch(API_URL + '/vault/' + encodeURIComponent(WORKFLOW_BUTTON_TEMPLATE), {
        headers: { 'Authorization': 'Bearer ' + TOKEN }
      });
      if (res.ok) {
        const content = typeof res.text === 'function' ? await res.text() : res.text;
        // Extraire le bloc dataviewjs du template
        const match = content.match(/```dataviewjs\n([\s\S]*?)```/);
        if (match) {
          return '\n```dataviewjs\n' + match[1] + '```\n\n';
        }
      }
    } catch (e) {
      logError('loadWorkflowButton', e);
    }
    // Fallback si le template n'est pas trouvé
    logInfo('Template workflow-button non trouvé, utilisation du fallback');
    return null;
  }

  // === Créer le popup avec DOM API (compatible Trusted Types) ===
  const overlay = document.createElement('div');
  overlay.id = 'obsidian-overlay';

  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#1e1e1e;padding:20px;border-radius:8px;min-width:380px;max-width:450px;color:#dcddde;';

  const titleEl = document.createElement('h3');
  titleEl.style.cssText = 'margin:0 0 15px 0;';
  titleEl.textContent = 'Créer note Obsidian';

  const filenameInfo = document.createElement('p');
  filenameInfo.id = 'filename-info';
  filenameInfo.style.cssText = 'margin:0 0 15px 0;font-size:13px;color:#666;';
  filenameInfo.textContent = `Fichier: ${sanitized}.md`;

  // Checkbox pipeline
  const pipelineRow = document.createElement('div');
  pipelineRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:15px;padding:10px;background:#2b2b2b;border:1px solid #404040;border-radius:4px;';

  const pipelineCheckbox = document.createElement('input');
  pipelineCheckbox.type = 'checkbox';
  pipelineCheckbox.id = 'pipeline-checkbox';
  pipelineCheckbox.style.cssText = 'width:18px;height:18px;cursor:pointer;';

  const pipelineLabel = document.createElement('label');
  pipelineLabel.htmlFor = 'pipeline-checkbox';
  pipelineLabel.style.cssText = 'cursor:pointer;font-weight:500;';
  pipelineLabel.textContent = 'Bouton pour pipeline de publication';

  pipelineRow.appendChild(pipelineCheckbox);
  pipelineRow.appendChild(pipelineLabel);

  // Conteneur catégorie (masqué par défaut)
  const categoryContainer = document.createElement('div');
  categoryContainer.id = 'category-container';
  categoryContainer.style.cssText = 'display:none;margin-bottom:15px;';

  const categoryLabel = document.createElement('label');
  categoryLabel.style.cssText = 'display:block;margin-bottom:5px;font-weight:bold;font-size:13px;';
  categoryLabel.textContent = 'Catégorie (notebook NotebookLM) :';

  const categorySelect = document.createElement('select');
  categorySelect.id = 'obsidian-category';
  categorySelect.style.cssText = 'width:100%;padding:8px;margin-bottom:8px;background:#2b2b2b;color:#dcddde;border:1px solid #404040;';

  CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.label;
    categorySelect.appendChild(opt);
  });

  const customLabel = document.createElement('label');
  customLabel.style.cssText = 'display:block;margin-bottom:5px;font-size:12px;color:#666;';
  customLabel.textContent = 'Ou catégorie personnalisée (prioritaire si remplie) :';

  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.id = 'obsidian-category-custom';
  customInput.placeholder = 'ex: meditation, jung, attachement...';
  customInput.style.cssText = 'width:100%;padding:8px;background:#2b2b2b;color:#dcddde;border:1px solid #404040;box-sizing:border-box;';

  categoryContainer.appendChild(categoryLabel);
  categoryContainer.appendChild(categorySelect);
  categoryContainer.appendChild(customLabel);
  categoryContainer.appendChild(customInput);

  // Sélecteur dossier
  const folderLabel = document.createElement('label');
  folderLabel.style.cssText = 'display:block;margin-bottom:5px;font-weight:bold;font-size:13px;';
  folderLabel.textContent = 'Dossier :';

  const folderSelect = document.createElement('select');
  folderSelect.id = 'obsidian-folder';
  folderSelect.style.cssText = 'width:100%;padding:8px;margin-bottom:15px;background:#2b2b2b;color:#dcddde;border:1px solid #404040;';

  const loadingOpt = document.createElement('option');
  loadingOpt.value = '';
  loadingOpt.textContent = 'Chargement...';
  folderSelect.appendChild(loadingOpt);

  // Boutons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';

  const btnCancel = document.createElement('button');
  btnCancel.style.cssText = 'padding:8px 16px;cursor:pointer;border:1px solid #404040;background:#2b2b2b;color:#dcddde;border-radius:4px;';
  btnCancel.textContent = 'Annuler';

  const btnCreate = document.createElement('button');
  btnCreate.style.cssText = 'padding:8px 16px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;';
  btnCreate.textContent = 'Créer';

  btnRow.appendChild(btnCancel);
  btnRow.appendChild(btnCreate);

  // Assembler le modal
  modal.appendChild(titleEl);
  modal.appendChild(filenameInfo);
  modal.appendChild(pipelineRow);
  modal.appendChild(categoryContainer);
  modal.appendChild(folderLabel);
  modal.appendChild(folderSelect);
  modal.appendChild(btnRow);

  backdrop.appendChild(modal);
  overlay.appendChild(backdrop);
  document.body.appendChild(overlay);

  logInfo('Popup created');

  // Gestion checkbox pipeline
  pipelineCheckbox.onchange = () => {
    const isPipeline = pipelineCheckbox.checked;
    categoryContainer.style.display = isPipeline ? 'block' : 'none';
    filenameInfo.textContent = isPipeline
      ? `Fichier: ${sanitized}_1_brouillon.md`
      : `Fichier: ${sanitized}.md`;
  };

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
    } catch (e) {
      logError('loadFolders', e);
    }
  }

  loadFolders('').then(() => {
    while (folderSelect.firstChild) {
      folderSelect.removeChild(folderSelect.firstChild);
    }
    const folders = Array.from(folderSet).sort();
    folders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f === '/' ? '/ (racine)' : f;
      // Présélectionner Publications/_brouillons/ si existe
      if (f === 'Publications/_brouillons/') {
        opt.selected = true;
      }
      folderSelect.appendChild(opt);
    });
  }).catch(() => {
    alert('Impossible de contacter Obsidian. Vérifiez que Local REST API est actif.');
    overlay.remove();
  });

  btnCancel.onclick = () => overlay.remove();

  btnCreate.onclick = async () => {
    const isPipeline = pipelineCheckbox.checked;
    const folder = folderSelect.value === '/' ? '' : folderSelect.value;
    const filename = isPipeline ? sanitized + '_1_brouillon.md' : sanitized + '.md';
    const path = folder + filename;

    let finalContent = content;

    if (isPipeline) {
      // Catégorie personnalisée prioritaire
      const customCat = customInput.value.trim().toLowerCase().replace(/\s+/g, '-');
      const selectedCategory = customCat || categorySelect.value;

      // Charger le template du bouton workflow
      const workflowButton = await loadWorkflowButton();
      if (!workflowButton) {
        alert('Impossible de charger le template workflow-button. Vérifiez que le fichier existe.');
        return;
      }

      // Injecter le bouton après le frontmatter
      const frontmatterEnd = finalContent.indexOf('---', finalContent.indexOf('---') + 3);
      if (frontmatterEnd !== -1) {
        const insertPos = frontmatterEnd + 3;
        finalContent = finalContent.slice(0, insertPos) + '\n' + workflowButton + finalContent.slice(insertPos);
      } else {
        finalContent = workflowButton + finalContent;
      }

      // Injecter la catégorie dans le frontmatter
      const fmMatch = finalContent.match(/^(---\n[\s\S]*?)(---)/);
      if (fmMatch) {
        const fmContent = fmMatch[1];
        const fmEnd = fmMatch[2];
        if (!fmContent.includes('categorie:')) {
          finalContent = finalContent.replace(
            fmMatch[0],
            fmContent + 'categorie: ' + selectedCategory + '\n' + fmEnd
          );
        }
      } else {
        finalContent = '---\ncategorie: ' + selectedCategory + '\n---\n\n' + finalContent;
      }

      logInfo(`Pipeline mode: category=${selectedCategory}`);
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
        const msg = isPipeline
          ? `Brouillon créé avec bouton pipeline : ${path}`
          : `Note créée : ${path}`;
        alert(msg);
        overlay.remove();
        logInfo('Note created: ' + path);
      } else {
        alert('Erreur création: ' + r.status);
      }
    } catch (e) {
      logError('create', e);
      alert('Erreur: ' + e.message);
    }
  };
})();
