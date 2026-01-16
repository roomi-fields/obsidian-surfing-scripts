/**
 * Script Surfing : Télécharger Image DALL-E
 * URL Pattern: https://chatgpt.com/*
 *
 * Ajoute des boutons "Save FR", "Save EN" et "Save Illus" sur les images DALL-E
 * pour les sauvegarder dans Obsidian.
 * Si une note est attachée, l'image y est automatiquement intégrée.
 */

(function() {
  'use strict';

  if (window.__dalleSaveButtonsLoaded) {
    console.log('🖼️ DALL-E Save Buttons déjà chargé');
    return;
  }
  window.__dalleSaveButtonsLoaded = true;

  const ENLUMINURE_FOLDER = '_Assets/Enluminures';
  const ILLUSTRATION_FOLDER = '_Assets/Illustrations';
  const OBSIDIAN_API_PORT = 27123;
  const OBSIDIAN_API_KEY = '79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab';

  const buttonStyleBase = `
    position: absolute;
    z-index: 100;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: background 0.2s;
  `;

  // Détecter le fichier attaché dans ChatGPT
  function getAttachedFileName() {
    // Méthode 1: Chercher "Fichier source : X.md" dans les messages
    const messages = document.querySelectorAll('[data-message-author-role="user"]');
    for (const msg of messages) {
      const text = msg.textContent || '';
      const sourceMatch = text.match(/Fichier source\s*:\s*([^\n]+\.md)/i);
      if (sourceMatch) {
        console.log('📎 Fichier source trouvé:', sourceMatch[1].trim());
        return sourceMatch[1].trim();
      }
    }

    // Méthode 2: Chercher n'importe quel texte contenant un .md
    const allText = document.body.innerText || '';
    const mdMatch = allText.match(/Fichier source\s*:\s*([^\n]+\.md)/i);
    if (mdMatch) {
      console.log('📎 Fichier source trouvé (body):', mdMatch[1].trim());
      return mdMatch[1].trim();
    }

    // Méthode 3: Fallback - chercher un élément qui se termine par .md
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.children.length === 0) {
        const text = (el.textContent || '').trim();
        if (text.endsWith('.md') && text.length < 200 && text.length > 3) {
          console.log('📎 Fichier .md trouvé (fallback):', text);
          return text;
        }
      }
    }

    console.log('⚠️ Aucun fichier source détecté');
    return null;
  }

  // Chercher le fichier dans le vault par son nom ou chemin
  async function findFileInVault(fileNameOrPath) {
    console.log(`🔍 Recherche de "${fileNameOrPath}" dans le vault...`);

    // Si c'est déjà un chemin complet (contient /), vérifier s'il existe directement
    if (fileNameOrPath.includes('/')) {
      try {
        const res = await window.surfingFetch(
          `http://127.0.0.1:${OBSIDIAN_API_PORT}/vault/${encodeURIComponent(fileNameOrPath)}`,
          { headers: { 'Authorization': `Bearer ${OBSIDIAN_API_KEY}` } }
        );
        if (res.ok) {
          console.log(`✅ Fichier trouvé (chemin direct): ${fileNameOrPath}`);
          return fileNameOrPath;
        }
      } catch (e) {}
    }

    // Sinon, recherche par nom de fichier
    const filename = fileNameOrPath.includes('/') ? fileNameOrPath.split('/').pop() : fileNameOrPath;
    const searchName = filename.replace('.md', '');

    async function searchFolder(path = '') {
      try {
        const res = await window.surfingFetch(
          `http://127.0.0.1:${OBSIDIAN_API_PORT}/vault/${encodeURIComponent(path)}`,
          { headers: { 'Authorization': `Bearer ${OBSIDIAN_API_KEY}` } }
        );
        if (!res.ok) {
          console.log(`❌ Impossible de lire le dossier: ${path}`);
          return null;
        }

        const data = JSON.parse(res.text);

        for (const item of data.files) {
          if (item.endsWith('/')) {
            if (item.startsWith('.') || item.startsWith('_Assets')) continue;
            const found = await searchFolder(path + item);
            if (found) return found;
          } else if (item === filename || item.replace('.md', '') === searchName) {
            console.log(`✅ Fichier trouvé: ${path + item}`);
            return path + item;
          }
        }
      } catch (e) {
        console.error('Erreur recherche vault:', e);
      }
      return null;
    }

    // Essayer d'abord dans les dossiers courants
    const directPaths = [
      'Publications/' + filename,
      'Articles/' + filename
    ];

    for (const directPath of directPaths) {
      try {
        const res = await window.surfingFetch(
          `http://127.0.0.1:${OBSIDIAN_API_PORT}/vault/${encodeURIComponent(directPath)}`,
          { headers: { 'Authorization': `Bearer ${OBSIDIAN_API_KEY}` } }
        );
        if (res.ok) {
          console.log(`✅ Fichier trouvé directement: ${directPath}`);
          return directPath;
        }
      } catch (e) {}
    }

    // Sinon recherche récursive dans Publications/ puis racine
    const inPublications = await searchFolder('Publications/');
    if (inPublications) return inPublications;

    return await searchFolder();
  }

  // Mettre à jour la note avec l'image (enluminure ou illustration)
  async function updateNoteWithImage(notePath, imageFilename, lang, imageType = 'enluminure') {
    const isIllustration = imageType === 'illustration';
    const saveFolder = isIllustration ? ILLUSTRATION_FOLDER : ENLUMINURE_FOLDER;

    try {
      // Lire le contenu actuel
      const readRes = await window.surfingFetch(
        `http://127.0.0.1:${OBSIDIAN_API_PORT}/vault/${encodeURIComponent(notePath)}`,
        { headers: { 'Authorization': `Bearer ${OBSIDIAN_API_KEY}` } }
      );

      if (!readRes.ok) {
        console.error('Impossible de lire la note:', notePath);
        return false;
      }

      let content = readRes.text;
      const imagePath = `${saveFolder}/${imageFilename}`;
      const imageEmbed = isIllustration ? `![[${imagePath}]]` : `![[${imagePath}|150]]`;

      // Vérifier si la note a un frontmatter
      const hasFrontmatter = content.startsWith('---');

      if (hasFrontmatter) {
        // Mettre à jour le champ dans le frontmatter
        const frontmatterEnd = content.indexOf('---', 3);
        if (frontmatterEnd > 0) {
          let frontmatter = content.substring(0, frontmatterEnd + 3);
          let body = content.substring(frontmatterEnd + 3);

          // Déterminer le champ à mettre à jour
          let fieldName;
          if (isIllustration) {
            fieldName = 'illustration';
          } else {
            fieldName = lang === 'EN' ? 'enluminure_en' : 'enluminure';
          }

          // Mettre à jour ou ajouter le champ
          const fieldRegex = new RegExp(`^${fieldName}:.*$`, 'm');
          if (fieldRegex.test(frontmatter)) {
            frontmatter = frontmatter.replace(fieldRegex, `${fieldName}: ${imagePath}`);
          } else {
            // Ajouter avant le dernier ---
            frontmatter = frontmatter.replace(/---\s*$/, `${fieldName}: ${imagePath}\n---`);
          }

          // Supprimer l'ancien embed s'il existe (pour permettre le remplacement)
          const oldEmbedPattern = isIllustration
            ? /!\[\[_Assets\/Illustrations\/[^\]]+\]\]\n*/g
            : /!\[\[_Assets\/Enluminures\/[^\]]+\|?\d*\]\]\n*/g;
          body = body.replace(oldEmbedPattern, '');

          // Ajouter le nouvel embed
          if (!body.includes(imageEmbed)) {
            if (isIllustration) {
              // Pour illustration, ajouter après le titre H1
              const h1Match = body.match(/^(#\s+.+\n)/m);
              if (h1Match) {
                body = body.replace(h1Match[0], `${h1Match[0]}\n${imageEmbed}\n`);
              } else {
                body = `\n${imageEmbed}\n${body}`;
              }
            } else {
              // Pour enluminure, ajouter avant le titre H1
              const h1Match = body.match(/^(#\s+.+)$/m);
              if (h1Match) {
                body = body.replace(h1Match[0], `${imageEmbed}\n${h1Match[0]}`);
              } else {
                body = `\n${imageEmbed}\n${body}`;
              }
            }
          }

          content = frontmatter + body;
        }
      } else {
        // Pas de frontmatter, ajouter l'embed au début
        if (!content.includes(imageEmbed)) {
          content = `${imageEmbed}\n\n${content}`;
        }
      }

      // Sauvegarder la note mise à jour
      const saveRes = await window.surfingFetch(
        `http://127.0.0.1:${OBSIDIAN_API_PORT}/vault/${encodeURIComponent(notePath)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${OBSIDIAN_API_KEY}`,
            'Content-Type': 'text/markdown'
          },
          body: content
        }
      );

      if (saveRes.ok) {
        console.log(`📝 Note mise à jour avec ${imageType}: ${notePath}`);
        return true;
      }
    } catch (e) {
      console.error('Erreur mise à jour note:', e);
    }
    return false;
  }

  // Alias pour compatibilité
  async function updateNoteWithEnluminure(notePath, filename, lang) {
    return updateNoteWithImage(notePath, filename, lang, 'enluminure');
  }

  function extractArticleInfo(lang) {
    const msgs = document.querySelectorAll('[data-turn="assistant"]');
    for (let i = msgs.length - 1; i >= 0; i--) {
      const text = msgs[i].innerText;
      const isEnglish = text.includes('Bibliography') || (text.includes('type: article') && !text.includes('Bibliographie'));
      const isFrench = text.includes('Bibliographie') || (text.includes('type: article') && !text.includes('Bibliography'));

      if ((lang === 'EN' && isEnglish) || (lang === 'FR' && isFrench)) {
        const titleMatch = text.match(/^# (.+)$/m);
        if (titleMatch) {
          return {
            title: titleMatch[1].trim(),
            firstLetter: titleMatch[1].trim().charAt(0).toUpperCase()
          };
        }
      }
    }

    // Fallback
    for (let i = msgs.length - 1; i >= 0; i--) {
      const text = msgs[i].innerText;
      if (text.includes('type: article') || text.includes('<!-- END -->')) {
        const titleMatch = text.match(/^# (.+)$/m);
        if (titleMatch) {
          return {
            title: titleMatch[1].trim(),
            firstLetter: titleMatch[1].trim().charAt(0).toUpperCase()
          };
        }
      }
    }
    return null;
  }

  function createSlug(title) {
    return title
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
  }

  async function saveImage(img, lang, btn, imageType = 'enluminure') {
    btn.innerHTML = '⏳...';
    btn.disabled = true;

    const isIllustration = imageType === 'illustration';
    const saveFolder = isIllustration ? ILLUSTRATION_FOLDER : ENLUMINURE_FOLDER;

    try {
      // Détecter le fichier attaché
      const attachedFile = getAttachedFileName();

      const info = extractArticleInfo(lang);
      const dateStr = new Date().toISOString().split('T')[0];

      let filename;
      if (isIllustration) {
        // Nom de fichier pour illustration
        if (info && info.title) {
          const slug = createSlug(info.title);
          filename = `illustration-${slug}-${dateStr}.png`;
        } else if (attachedFile) {
          const slug = createSlug(attachedFile.replace('.md', ''));
          filename = `illustration-${slug}-${dateStr}.png`;
        } else {
          filename = `illustration-${dateStr}-${Date.now()}.png`;
        }
      } else {
        // Nom de fichier pour enluminure (comportement original)
        if (info && info.firstLetter) {
          const slug = createSlug(info.title);
          filename = `enluminure-${info.firstLetter}-${slug}-${lang.toLowerCase()}-${dateStr}.png`;
        } else if (attachedFile) {
          const slug = createSlug(attachedFile.replace('.md', ''));
          filename = `enluminure-${slug}-${lang.toLowerCase()}-${dateStr}.png`;
        } else {
          filename = `enluminure-${lang.toLowerCase()}-${dateStr}-${Date.now()}.png`;
        }
      }

      const filepath = `${saveFolder}/${filename}`;

      // Pour les enluminures: supprimer le fichier existant avant de créer le nouveau
      // Cela garantit un événement "create" qui déclenchera le plugin autocrop
      if (!isIllustration) {
        try {
          const checkRes = await window.surfingFetch(
            `http://127.0.0.1:${OBSIDIAN_API_PORT}/vault/${encodeURIComponent(filepath)}`,
            { method: 'GET', headers: { 'Authorization': `Bearer ${OBSIDIAN_API_KEY}` } }
          );
          if (checkRes.ok) {
            console.log(`🗑️ Suppression de l'enluminure existante: ${filepath}`);
            await window.surfingFetch(
              `http://127.0.0.1:${OBSIDIAN_API_PORT}/vault/${encodeURIComponent(filepath)}`,
              { method: 'DELETE', headers: { 'Authorization': `Bearer ${OBSIDIAN_API_KEY}` } }
            );
            // Petit délai pour laisser Obsidian traiter la suppression
            await new Promise(r => setTimeout(r, 200));
          }
        } catch (e) {
          // Fichier n'existe pas, on continue
        }
      }

      const imageResponse = await fetch(img.src, { method: 'GET', credentials: 'include' });
      if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`);

      const arrayBuffer = await imageResponse.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      const saveResponse = await window.surfingFetch(
        `http://127.0.0.1:${OBSIDIAN_API_PORT}/vault/${encodeURIComponent(filepath)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${OBSIDIAN_API_KEY}`,
            'Content-Type': 'application/octet-stream'
          },
          body: bytes
        }
      );

      if (saveResponse.ok) {
        btn.innerHTML = '✅';
        btn.style.background = 'rgba(0, 128, 0, 0.8)';
        navigator.clipboard.writeText(`![[${filename}]]`);

        if (isIllustration) {
          window.lastSavedIllustration = filename;
          console.log(`🖼️ Illustration saved:`, filepath);
        } else {
          if (lang === 'FR') {
            window.lastSavedEnluminureFR = filename;
            window.lastSavedEnluminure = filename;
          } else {
            window.lastSavedEnluminureEN = filename;
          }
          console.log(`🖼️ Enluminure ${lang} saved:`, filepath);
        }

        // Si un fichier était attaché, mettre à jour la note
        console.log('🔍 Recherche fichier attaché...');
        if (attachedFile) {
          console.log(`📎 Fichier attaché détecté: "${attachedFile}"`);
          btn.innerHTML = '📝...';
          const notePath = await findFileInVault(attachedFile);
          console.log(`🔍 Chemin trouvé dans vault: ${notePath || 'NON TROUVÉ'}`);
          if (notePath) {
            const updated = await updateNoteWithImage(notePath, filename, lang, imageType);
            if (updated) {
              btn.innerHTML = '✅📝';
              console.log(`📝 Note "${attachedFile}" mise à jour avec ${imageType}`);
            } else {
              console.log(`❌ Échec mise à jour de "${notePath}"`);
            }
          } else {
            console.log(`⚠️ Note "${attachedFile}" non trouvée dans le vault`);
            btn.innerHTML = '✅⚠️';
          }
        } else {
          console.log('⚠️ Aucun fichier attaché détecté - image sauvegardée sans mise à jour de note');
        }

        setTimeout(() => {
          if (isIllustration) {
            btn.innerHTML = '🖼️ Illus';
          } else {
            btn.innerHTML = lang === 'FR' ? '🇫🇷 Save FR' : '🇬🇧 Save EN';
          }
          btn.style.background = 'rgba(0, 0, 0, 0.7)';
          btn.disabled = false;
        }, 2000);
      } else {
        throw new Error(`Failed to save: ${saveResponse.status}`);
      }
    } catch (error) {
      console.error('Surfing Image Download Error:', error);
      btn.innerHTML = '❌';
      btn.style.background = 'rgba(128, 0, 0, 0.8)';
      setTimeout(() => {
        if (imageType === 'illustration') {
          btn.innerHTML = '🖼️ Illus';
        } else {
          btn.innerHTML = lang === 'FR' ? '🇫🇷 Save FR' : '🇬🇧 Save EN';
        }
        btn.style.background = 'rgba(0, 0, 0, 0.7)';
        btn.disabled = false;
      }, 2000);
    }
  }

  function addDownloadButtons(img) {
    let container = img.closest('div[style*="aspect-ratio"]') || img.parentElement;
    if (!container) return;

    if (container.querySelector('.dalle-save-btn')) {
      return;
    }

    if (!img.src.includes('/backend-api/') && !img.src.includes('oaiusercontent')) {
      return;
    }

    const containerStyle = window.getComputedStyle(container);
    if (containerStyle.position === 'static') {
      container.style.position = 'relative';
    }

    const btnFR = document.createElement('button');
    btnFR.className = 'dalle-save-btn dalle-save-btn-fr';
    btnFR.innerHTML = '🇫🇷 Save FR';
    btnFR.style.cssText = buttonStyleBase + 'top: 8px; right: 8px;';
    btnFR.onmouseover = () => btnFR.style.background = 'rgba(0, 0, 0, 0.9)';
    btnFR.onmouseout = () => btnFR.style.background = 'rgba(0, 0, 0, 0.7)';
    btnFR.onclick = (e) => { e.preventDefault(); e.stopPropagation(); saveImage(img, 'FR', btnFR, 'enluminure'); };

    const btnEN = document.createElement('button');
    btnEN.className = 'dalle-save-btn dalle-save-btn-en';
    btnEN.innerHTML = '🇬🇧 Save EN';
    btnEN.style.cssText = buttonStyleBase + 'top: 8px; right: 90px;';
    btnEN.onmouseover = () => btnEN.style.background = 'rgba(0, 0, 0, 0.9)';
    btnEN.onmouseout = () => btnEN.style.background = 'rgba(0, 0, 0, 0.7)';
    btnEN.onclick = (e) => { e.preventDefault(); e.stopPropagation(); saveImage(img, 'EN', btnEN, 'enluminure'); };

    const btnIllus = document.createElement('button');
    btnIllus.className = 'dalle-save-btn dalle-save-btn-illus';
    btnIllus.innerHTML = '🖼️ Illus';
    btnIllus.style.cssText = buttonStyleBase + 'top: 8px; right: 172px;';
    btnIllus.onmouseover = () => btnIllus.style.background = 'rgba(0, 0, 0, 0.9)';
    btnIllus.onmouseout = () => btnIllus.style.background = 'rgba(0, 0, 0, 0.7)';
    btnIllus.onclick = (e) => { e.preventDefault(); e.stopPropagation(); saveImage(img, 'FR', btnIllus, 'illustration'); };

    container.appendChild(btnFR);
    container.appendChild(btnEN);
    container.appendChild(btnIllus);
  }

  function processImages() {
    document.querySelectorAll('img[src*="backend-api"], img[src*="oaiusercontent"]').forEach(addDownloadButtons);
  }

  processImages();

  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        shouldProcess = true;
        break;
      }
    }
    if (shouldProcess) {
      clearTimeout(window.__dalleProcessTimeout);
      window.__dalleProcessTimeout = setTimeout(processImages, 100);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  console.log('🏄 DALL-E Save Buttons loaded (enluminures + illustrations)');
})();
