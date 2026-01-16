/**
 * Script Surfing : Générer Image (Enluminure ou Illustration)
 * URL Pattern: https://chatgpt.com/*
 *
 * Ce script détecte automatiquement si la conversation contient déjà du contenu :
 * - Si OUI : injecte uniquement le prompt de génération d'image
 * - Si NON : propose de sélectionner un article (type: article)
 *
 * Prérequis : Le script download-dalle.js doit être actif pour sauvegarder l'image générée.
 */

(async function() {
  'use strict';

  const SCRIPT_NAME = 'generer-image';
  const API_URL = 'http://localhost:27123';
  const TOKEN = '79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab';
  const ARTICLES_FOLDER = 'Publications';
  const PROMPTS_FOLDER = '_Assets/Prompts Pipeline/images';

  function logInfo(msg) { console.log(`[${SCRIPT_NAME}] ${msg}`); }
  function logError(ctx, e) { console.error(`[${SCRIPT_NAME}] ${ctx}:`, e); }

  const isChatGPT = window.location.hostname.includes('chatgpt.com') || window.location.hostname.includes('chat.openai.com');
  if (!isChatGPT) {
    alert('Ce script fonctionne uniquement sur ChatGPT');
    return;
  }

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

  // === Détection du contenu existant ===

  function hasExistingContent() {
    // Vérifier s'il y a des messages dans la conversation (plusieurs selecteurs possibles selon la version ChatGPT)
    const assistantMsgs = document.querySelectorAll('[data-message-author-role="assistant"], [data-turn="assistant"]');
    const userMsgs = document.querySelectorAll('[data-message-author-role="user"], [data-turn="user"]');

    // S'il y a au moins un échange (user + assistant), on considère qu'il y a du contenu
    if (assistantMsgs.length > 0 && userMsgs.length > 0) {
      logInfo(`Conversation existante détectée: ${userMsgs.length} msg user, ${assistantMsgs.length} msg assistant`);
      return true;
    }

    logInfo('Nouvelle conversation détectée');
    return false;
  }

  // Essayer de détecter le titre de l'article dans la conversation
  function detectArticleTitle() {
    const userMsgs = document.querySelectorAll('[data-message-author-role="user"], [data-turn="user"]');
    for (const msg of userMsgs) {
      const text = msg.textContent || '';
      // Chercher un titre H1
      const h1Match = text.match(/^# (.+)$/m);
      if (h1Match) return h1Match[1].trim();
      // Chercher dans le frontmatter
      const fmMatch = text.match(/title:\s*["']?([^"'\n]+)["']?/);
      if (fmMatch) return fmMatch[1].trim();
    }
    return null;
  }

  // Détecter le fichier source depuis la conversation existante
  function detectSourceFile() {
    const userMsgs = document.querySelectorAll('[data-message-author-role="user"], [data-turn="user"]');
    for (const msg of userMsgs) {
      const text = msg.textContent || '';
      const sourceMatch = text.match(/Fichier source\s*:\s*([^\n]+\.md)/i);
      if (sourceMatch) {
        return sourceMatch[1].trim();
      }
    }
    // Fallback: chercher dans tout le body
    const allText = document.body.innerText || '';
    const bodyMatch = allText.match(/Fichier source\s*:\s*([^\n]+\.md)/i);
    if (bodyMatch) {
      return bodyMatch[1].trim();
    }
    return null;
  }

  // Extraire la première lettre significative
  function getFirstLetter(title) {
    if (!title) return null;
    const match = title.match(/[a-zA-ZÀ-ÿ]/);
    return match ? match[0].toUpperCase() : null;
  }

  // === Chargement des prompts ===

  async function loadPromptTemplate(type) {
    const filename = type === 'enluminure' ? 'enluminure.prompt.md' : 'illustration.prompt.md';
    const path = `${PROMPTS_FOLDER}/${filename}`;

    try {
      const res = await safeFetch(
        `${API_URL}/vault/${encodeURIComponent(path)}`,
        { headers: { 'Authorization': `Bearer ${TOKEN}` } }
      );

      if (!res.ok) {
        throw new Error(`Prompt non trouvé: ${path}`);
      }

      const content = typeof res.text === 'function' ? await res.text() : res.text;

      // Extraire le contenu du bloc code
      const match = content.match(/```\n([\s\S]*?)```/);
      if (match) {
        return match[1].trim();
      }

      return content;
    } catch (e) {
      logError('loadPromptTemplate', e);
      return null;
    }
  }

  // === Recherche des articles ===

  // Vérifier si un fichier a type: article dans son frontmatter
  async function isArticleFile(filePath) {
    try {
      const res = await safeFetch(
        `${API_URL}/vault/${encodeURIComponent(filePath)}`,
        { headers: { 'Authorization': `Bearer ${TOKEN}` } }
      );
      if (!res.ok) return false;

      const content = typeof res.text === 'function' ? await res.text() : res.text;
      // Chercher type: article dans le frontmatter
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const frontmatter = fmMatch[1];
        return /^type:\s*article\s*$/m.test(frontmatter);
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  async function findArticleFiles() {
    const articles = [];

    async function searchFolder(path = '') {
      try {
        const res = await safeFetch(
          `${API_URL}/vault/${encodeURIComponent(path)}`,
          { headers: { 'Authorization': `Bearer ${TOKEN}` } }
        );
        if (!res.ok) return;

        const data = res.json ? res.json() : JSON.parse(res.text);

        for (const item of data.files) {
          if (item.endsWith('/')) {
            if (item.startsWith('.') || item.startsWith('_')) continue;
            await searchFolder(path + item);
          } else if (item.endsWith('.md')) {
            const filePath = path + item;
            if (await isArticleFile(filePath)) {
              articles.push(filePath);
            }
          }
        }
      } catch (e) {
        logError('searchFolder', e);
      }
    }

    await searchFolder(ARTICLES_FOLDER + '/');
    return articles;
  }

  // Extraire le titre depuis le contenu
  function extractTitle(content) {
    // Extraire le frontmatter d'abord
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const frontmatter = fmMatch[1];
      // Chercher la ligne title: (gère guillemets et apostrophes dans le titre)
      const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
      if (titleMatch) {
        let title = titleMatch[1].trim();
        // Retirer les guillemets englobants si présents
        if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'"))) {
          title = title.slice(1, -1);
        }
        return title;
      }
    }
    // Fallback: chercher le H1
    const h1Match = content.match(/^# (.+)$/m);
    if (h1Match) return h1Match[1].trim();
    return null;
  }

  // Extraire le contenu sans frontmatter ni dataviewjs
  function extractArticleContent(content) {
    let cleaned = content.replace(/^---[\s\S]*?---\n*/m, '');
    cleaned = cleaned.replace(/```dataviewjs[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/^`button-.*`$/gm, '');
    return cleaned.trim();
  }

  // === Insertion du prompt ===

  function insertPrompt(content) {
    const textarea = document.querySelector('#prompt-textarea')
      || document.querySelector('div[contenteditable="true"]')
      || document.querySelector('textarea');

    if (!textarea) {
      alert('Zone de saisie ChatGPT non trouvée');
      return false;
    }

    textarea.focus();

    if (textarea.tagName === 'TEXTAREA') {
      textarea.value = content;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      document.execCommand('insertText', false, content);
    }

    logInfo('Prompt inséré avec succès');
    return true;
  }

  // === Interface utilisateur ===

  // Supprimer popup existant
  const existing = document.getElementById('image-generator-popup');
  if (existing) existing.remove();

  const hasContent = hasExistingContent();
  const detectedTitle = hasContent ? detectArticleTitle() : null;
  const detectedLetter = getFirstLetter(detectedTitle);

  // Créer le popup
  const overlay = document.createElement('div');
  overlay.id = 'image-generator-popup';

  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#1e1e1e;padding:20px;border-radius:8px;min-width:450px;max-width:600px;color:#dcddde;';

  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 15px 0;';
  title.textContent = '🎨 Générer une image';

  // Info sur le mode
  const modeInfo = document.createElement('div');
  modeInfo.style.cssText = 'margin:0 0 15px 0;padding:10px;background:#f0f9ff;border-radius:4px;font-size:13px;';
  if (hasContent) {
    modeInfo.innerHTML = `<strong>✅ Conversation existante détectée</strong><br>
      Le prompt d'image sera injecté directement.
      ${detectedTitle ? `<br>Titre détecté: <em>${detectedTitle}</em>` : ''}`;
  } else {
    modeInfo.innerHTML = `<strong>📝 Nouvelle conversation</strong><br>
      Sélectionnez un article à inclure avec le prompt.`;
  }

  // Sélection du type d'image
  const typeLabel = document.createElement('label');
  typeLabel.style.cssText = 'display:block;margin-bottom:5px;font-weight:bold;font-size:14px;';
  typeLabel.textContent = 'Type d\'image :';

  const typeSelect = document.createElement('select');
  typeSelect.style.cssText = 'width:100%;padding:10px;margin-bottom:15px;background:#2b2b2b;color:#dcddde;border:1px solid #404040;font-size:14px;';

  const types = [
    { value: 'enluminure', label: '🔤 Enluminure (lettre décorative)' },
    { value: 'illustration', label: '🖼️ Illustration (header article)' }
  ];

  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.value;
    opt.textContent = t.label;
    typeSelect.appendChild(opt);
  });

  // Champ lettre (pour enluminure)
  const letterContainer = document.createElement('div');
  letterContainer.style.cssText = 'margin-bottom:15px;';

  const letterLabel = document.createElement('label');
  letterLabel.style.cssText = 'display:block;margin-bottom:5px;font-weight:bold;font-size:14px;';
  letterLabel.textContent = 'Lettre pour l\'enluminure :';

  const letterInput = document.createElement('input');
  letterInput.type = 'text';
  letterInput.maxLength = 1;
  letterInput.value = detectedLetter || '';
  letterInput.placeholder = 'Ex: O';
  letterInput.style.cssText = 'width:60px;padding:10px;font-size:18px;text-align:center;text-transform:uppercase;border:1px solid #ccc;border-radius:4px;';

  letterContainer.appendChild(letterLabel);
  letterContainer.appendChild(letterInput);

  // Sélection d'article (si nouvelle conversation)
  const articleContainer = document.createElement('div');
  articleContainer.style.cssText = hasContent ? 'display:none;' : 'margin-bottom:15px;';

  const articleLabel = document.createElement('label');
  articleLabel.style.cssText = 'display:block;margin-bottom:5px;font-weight:bold;font-size:14px;';
  articleLabel.textContent = 'Article source :';

  const articleSelect = document.createElement('select');
  articleSelect.style.cssText = 'width:100%;padding:10px;background:#2b2b2b;color:#dcddde;border:1px solid #404040;font-size:14px;';

  const loadingOpt = document.createElement('option');
  loadingOpt.value = '';
  loadingOpt.textContent = 'Chargement...';
  articleSelect.appendChild(loadingOpt);

  articleContainer.appendChild(articleLabel);
  articleContainer.appendChild(articleSelect);

  // Boutons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:20px;';

  const btnCancel = document.createElement('button');
  btnCancel.style.cssText = 'padding:10px 20px;cursor:pointer;border:1px solid #404040;background:#2b2b2b;color:#dcddde;border-radius:4px;';
  btnCancel.textContent = 'Annuler';

  const btnGenerate = document.createElement('button');
  btnGenerate.style.cssText = 'padding:10px 20px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;';
  btnGenerate.textContent = '🎨 Injecter le prompt';

  btnRow.appendChild(btnCancel);
  btnRow.appendChild(btnGenerate);

  // Assembler le modal
  modal.appendChild(title);
  modal.appendChild(modeInfo);
  modal.appendChild(typeLabel);
  modal.appendChild(typeSelect);
  modal.appendChild(letterContainer);
  modal.appendChild(articleContainer);
  modal.appendChild(btnRow);
  backdrop.appendChild(modal);
  overlay.appendChild(backdrop);
  document.body.appendChild(overlay);

  // === Event handlers ===

  // Afficher/masquer le champ lettre selon le type
  typeSelect.onchange = () => {
    letterContainer.style.display = typeSelect.value === 'enluminure' ? 'block' : 'none';
  };

  btnCancel.onclick = () => overlay.remove();

  // Charger les articles si nouvelle conversation
  if (!hasContent) {
    logInfo('Chargement des articles (type: article)...');
    const articles = await findArticleFiles();
    logInfo(`${articles.length} articles trouvés`);

    while (articleSelect.firstChild) articleSelect.removeChild(articleSelect.firstChild);

    if (articles.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Aucun article trouvé (type: article)';
      articleSelect.appendChild(opt);
    } else {
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '-- Sélectionner un article --';
      articleSelect.appendChild(defaultOpt);

      articles.forEach(path => {
        const opt = document.createElement('option');
        opt.value = path;
        // Extraire un nom lisible depuis le chemin
        const articleName = path.replace('Articles/', '').replace('.md', '');
        opt.textContent = articleName || path;
        articleSelect.appendChild(opt);
      });
    }

    // Quand on sélectionne un article, essayer de détecter la lettre
    articleSelect.onchange = async () => {
      if (!articleSelect.value) return;

      try {
        const res = await safeFetch(
          `${API_URL}/vault/${encodeURIComponent(articleSelect.value)}`,
          { headers: { 'Authorization': `Bearer ${TOKEN}` } }
        );
        if (res.ok) {
          const content = typeof res.text === 'function' ? await res.text() : res.text;
          const articleTitle = extractTitle(content);
          const letter = getFirstLetter(articleTitle);
          if (letter && !letterInput.value) {
            letterInput.value = letter;
            logInfo(`Lettre détectée: ${letter} (titre: ${articleTitle})`);
          }
        }
      } catch (e) {}
    };
  }

  // === Génération ===

  btnGenerate.onclick = async () => {
    const imageType = typeSelect.value;
    const letter = letterInput.value.toUpperCase();

    // Validation
    if (imageType === 'enluminure' && !letter) {
      alert('Veuillez entrer une lettre pour l\'enluminure');
      letterInput.focus();
      return;
    }

    if (!hasContent && !articleSelect.value) {
      alert('Veuillez sélectionner un article');
      return;
    }

    btnGenerate.textContent = '⏳ Chargement...';
    btnGenerate.disabled = true;

    try {
      // Charger le template du prompt
      let promptTemplate = await loadPromptTemplate(imageType);
      if (!promptTemplate) {
        throw new Error('Impossible de charger le template du prompt');
      }

      // Remplacer la variable lettre si enluminure
      if (imageType === 'enluminure') {
        promptTemplate = promptTemplate.replace(/\{\{LETTRE\}\}/g, letter);
      }

      let finalPrompt;

      if (hasContent) {
        // Conversation existante : prompt seul, mais inclure Fichier source si détecté
        const sourceFile = detectSourceFile();
        if (sourceFile) {
          finalPrompt = `Fichier source : ${sourceFile}\n\n${promptTemplate}`;
          logInfo(`Fichier source détecté: ${sourceFile}`);
        } else {
          finalPrompt = promptTemplate;
          logInfo('⚠️ Aucun fichier source détecté dans la conversation');
        }
      } else {
        // Nouvelle conversation : article + prompt
        const res = await safeFetch(
          `${API_URL}/vault/${encodeURIComponent(articleSelect.value)}`,
          { headers: { 'Authorization': `Bearer ${TOKEN}` } }
        );

        if (!res.ok) {
          throw new Error('Impossible de lire l\'article');
        }

        const content = typeof res.text === 'function' ? await res.text() : res.text;
        const articleContent = extractArticleContent(content);
        const filePath = articleSelect.value; // Chemin complet pour retrouver le fichier

        finalPrompt = `Fichier source : ${filePath}

Voici l'article :

---
${articleContent}
---

${promptTemplate}`;
      }

      // Fermer et insérer
      overlay.remove();

      if (insertPrompt(finalPrompt)) {
        logInfo(`Prompt ${imageType} injecté. Appuyez sur Entrée pour générer.`);
      }

    } catch (e) {
      logError('btnGenerate', e);
      alert('Erreur: ' + e.message);
      btnGenerate.textContent = '🎨 Injecter le prompt';
      btnGenerate.disabled = false;
    }
  };

  logInfo('Interface prête');
})();
