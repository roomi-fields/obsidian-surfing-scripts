/**
 * Script Surfing : Envoyer un prompt depuis le vault Obsidian
 * Compatible Claude.ai, ChatGPT et Gemini
 *
 * Variables supportées dans les fichiers .md :
 * - {{source}} → "Claude", "ChatGPT" ou "Gemini"
 * - {{date}} → date du jour (YYYY-MM-DD)
 * - {{conversation_url}} → URL encodée pour Obsidian Surfing
 * - {{raw_url}} → URL brute de la conversation
 */

(async function() {
  const SCRIPT_NAME = 'prompt-from-vault';

  // Logger les erreurs dans la console de manière visible
  function logError(context, error) {
    console.error(`[${SCRIPT_NAME}] ERROR in ${context}:`, error);
    console.error(`[${SCRIPT_NAME}] Stack:`, error.stack || 'No stack');
  }

  function logInfo(message) {
    console.log(`[${SCRIPT_NAME}] ${message}`);
  }

  try {
    const API_URL = 'http://localhost:27123';
    const TOKEN = '79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab';
    const PROMPTS_FOLDER = '_Assets/Prompts';

    const isClaude = window.location.hostname.includes('claude.ai');
    const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');
    const isGemini = window.location.hostname.includes('gemini.google.com');

    logInfo(`Platform detected: Claude=${isClaude}, ChatGPT=${isChatGPT}, Gemini=${isGemini}`);

    if (!isClaude && !isChatGPT && !isGemini) {
      alert('Ce script fonctionne uniquement sur Claude.ai, ChatGPT ou Gemini');
      return;
    }

    const source = isClaude ? 'Claude' : (isChatGPT ? 'ChatGPT' : 'Gemini');
    const rawUrl = window.location.href;
    const surfingUrl = 'obsidian://web-open?url=' + encodeURIComponent(rawUrl);
    const today = new Date().toISOString().split('T')[0];

    // Utiliser surfingFetch si disponible (Obsidian Surfing)
    const useSurfingFetch = typeof surfingFetch === 'function';
    logInfo(`Using surfingFetch: ${useSurfingFetch}`);

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
    const existing = document.getElementById('prompt-selector-overlay');
    if (existing) existing.remove();

    // Créer le popup de sélection avec DOM API (compatible Trusted Types pour Gemini)
    const overlay = document.createElement('div');
    overlay.id = 'prompt-selector-overlay';

    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#1e1e1e;padding:20px;border-radius:8px;min-width:400px;max-width:500px;color:#dcddde;';

    const title = document.createElement('h3');
    title.style.cssText = 'margin:0 0 15px 0;';
    title.textContent = 'Sélectionner un prompt';

    const info = document.createElement('p');
    info.style.cssText = 'margin:0 0 10px 0;font-size:12px;color:#888;';
    info.textContent = `Source: ${source} | Dossier: ${PROMPTS_FOLDER}/`;

    const select = document.createElement('select');
    select.id = 'prompt-file-select';
    select.style.cssText = 'width:100%;padding:10px;margin-bottom:10px;background:#2b2b2b;color:#dcddde;border:1px solid #404040;font-size:14px;';
    const loadingOpt = document.createElement('option');
    loadingOpt.value = '';
    loadingOpt.textContent = 'Chargement...';
    select.appendChild(loadingOpt);

    const preview = document.createElement('div');
    preview.id = 'prompt-preview';
    preview.style.cssText = 'max-height:200px;overflow-y:auto;padding:10px;background:#2b2b2b;border-radius:4px;margin-bottom:15px;font-size:12px;font-family:monospace;white-space:pre-wrap;display:none;color:#dcddde;border:1px solid #404040;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';

    const btnCancel = document.createElement('button');
    btnCancel.id = 'prompt-cancel';
    btnCancel.style.cssText = 'padding:8px 16px;cursor:pointer;border:1px solid #404040;background:#2b2b2b;color:#dcddde;border-radius:4px;';
    btnCancel.textContent = 'Annuler';

    const btnSend = document.createElement('button');
    btnSend.id = 'prompt-send';
    btnSend.style.cssText = 'padding:8px 16px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;';
    btnSend.textContent = 'Envoyer';
    btnSend.disabled = true;

    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnSend);

    modal.appendChild(title);
    modal.appendChild(info);
    modal.appendChild(select);
    modal.appendChild(preview);
    modal.appendChild(btnRow);

    backdrop.appendChild(modal);
    overlay.appendChild(backdrop);
    document.body.appendChild(overlay);

    logInfo('Popup created successfully');

    let promptsCache = {};

    // Helper pour mettre à jour le select sans innerHTML
    function setSelectOptions(options) {
      while (select.firstChild) {
        select.removeChild(select.firstChild);
      }
      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        select.appendChild(option);
      });
    }

    // Charger la liste des fichiers .md dans le dossier prompts
    async function loadPromptFiles() {
      try {
        logInfo('Loading prompt files...');
        const res = await safeFetch(API_URL + '/vault/' + encodeURIComponent(PROMPTS_FOLDER + '/'), {
          headers: { 'Authorization': 'Bearer ' + TOKEN }
        });

        if (!res.ok) {
          throw new Error('Dossier non trouvé: ' + PROMPTS_FOLDER);
        }

        const data = await res.json();
        const mdFiles = data.files.filter(f => f.endsWith('.md'));
        logInfo(`Found ${mdFiles.length} prompt files`);

        if (mdFiles.length === 0) {
          setSelectOptions([{ value: '', text: 'Aucun fichier .md trouvé' }]);
          return;
        }

        const options = [{ value: '', text: '-- Choisir un prompt --' }];
        mdFiles.forEach(f => {
          options.push({ value: f, text: f.replace('.md', '') });
        });
        setSelectOptions(options);

      } catch (e) {
        logError('loadPromptFiles', e);
        setSelectOptions([{ value: '', text: 'Erreur: ' + e.message }]);
      }
    }

    // Charger et afficher l'aperçu d'un prompt
    async function loadPromptPreview(filename) {
      if (!filename) {
        preview.style.display = 'none';
        btnSend.disabled = true;
        return;
      }

      try {
        logInfo(`Loading preview for: ${filename}`);
        const path = PROMPTS_FOLDER + '/' + filename;
        const res = await safeFetch(API_URL + '/vault/' + encodeURIComponent(path), {
          headers: { 'Authorization': 'Bearer ' + TOKEN }
        });

        if (!res.ok) {
          throw new Error('Fichier non trouvé');
        }

        let content = typeof res.text === 'function' ? await res.text() : res.text;

        // Supprimer le frontmatter YAML s'il existe (uniquement en tout début de fichier)
        if (content.startsWith('---')) {
          content = content.replace(/^---[\s\S]*?---\n*/, '');
        }

        // Remplacer les variables
        content = content
          .replace(/\{\{source\}\}/g, source)
          .replace(/\{\{date\}\}/g, today)
          .replace(/\{\{conversation_url\}\}/g, surfingUrl)
          .replace(/\{\{raw_url\}\}/g, rawUrl);

        promptsCache[filename] = content;

        // Aperçu tronqué
        const previewText = content.length > 500
          ? content.substring(0, 500) + '...\n\n[' + content.length + ' caractères au total]'
          : content;

        preview.textContent = previewText;
        preview.style.display = 'block';
        btnSend.disabled = false;
        logInfo('Preview loaded successfully');

      } catch (e) {
        logError('loadPromptPreview', e);
        preview.textContent = 'Erreur: ' + e.message;
        preview.style.display = 'block';
        btnSend.disabled = true;
      }
    }

    // Envoyer le prompt
    function sendPrompt(content) {
      try {
        let textarea;

        if (isClaude) {
          textarea = document.querySelector('div[contenteditable="true"]');
          logInfo(`Claude textarea found: ${!!textarea}`);
        } else if (isChatGPT) {
          textarea = document.querySelector('#prompt-textarea')
            || document.querySelector('div[contenteditable="true"]')
            || document.querySelector('textarea');
          logInfo(`ChatGPT textarea found: ${!!textarea}`);
        } else if (isGemini) {
          // Gemini utilise un rich-textarea avec un div contenteditable à l'intérieur
          textarea = document.querySelector('rich-textarea div[contenteditable="true"]')
            || document.querySelector('div.ql-editor[contenteditable="true"]')
            || document.querySelector('div[contenteditable="true"]');
          logInfo(`Gemini textarea found: ${!!textarea}`);
        }

        if (!textarea) {
          logError('sendPrompt', new Error('Zone de saisie non trouvée'));
          alert('Zone de saisie non trouvée');
          return false;
        }

        textarea.focus();

        if (textarea.tagName === 'TEXTAREA') {
          textarea.value = content;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          document.execCommand('insertText', false, content);
        }

        logInfo('Prompt inserted successfully');
        return true;

      } catch (e) {
        logError('sendPrompt', e);
        alert('Erreur lors de l\'envoi: ' + e.message);
        return false;
      }
    }

    // Event listeners
    select.onchange = () => loadPromptPreview(select.value);
    btnCancel.onclick = () => overlay.remove();

    btnSend.onclick = () => {
      const filename = select.value;
      if (filename && promptsCache[filename]) {
        if (sendPrompt(promptsCache[filename])) {
          overlay.remove();
        }
      }
    };

    // Charger les fichiers au démarrage
    await loadPromptFiles();

  } catch (e) {
    logError('main', e);
    alert('[prompt-from-vault] Erreur: ' + e.message);
  }
})();
