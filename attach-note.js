/**
 * Script Surfing : Attacher une note Obsidian à ChatGPT
 * URL Pattern: https://chatgpt.com/*
 *
 * Affiche un sélecteur en arborescence pour choisir une note du vault
 * et l'attache comme fichier .md dans ChatGPT.
 */

(async function() {
  const API_URL = 'http://localhost:27123';
  const TOKEN = '79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab';

  const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');

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

  // Supprimer popup existant
  const existing = document.getElementById('note-selector-overlay');
  if (existing) existing.remove();

  // Styles
  const styles = `
    .tree-folder { cursor: pointer; user-select: none; }
    .tree-folder:hover { background: #f0f0f0; }
    .tree-folder-icon { display: inline-block; width: 16px; text-align: center; margin-right: 4px; }
    .tree-folder-name { font-weight: 500; }
    .tree-children { margin-left: 20px; }
    .tree-children.collapsed { display: none; }
    .tree-file { padding: 6px 10px; cursor: pointer; border-radius: 4px; }
    .tree-file:hover { background: #e8e8ff; }
    .tree-file-name { color: #333; }
    .search-results .tree-file { margin-left: 0; }
    .search-results .tree-file-path { font-size: 11px; color: #888; margin-top: 2px; }
  `;

  // Créer le popup
  const overlay = document.createElement('div');
  overlay.id = 'note-selector-overlay';
  overlay.innerHTML = `
    <style>${styles}</style>
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;">
      <div style="background:#1e1e1e;padding:20px;border-radius:8px;min-width:500px;max-width:650px;max-height:80vh;color:#dcddde;display:flex;flex-direction:column;">
        <h3 style="margin:0 0 15px 0;">Attacher une note à ChatGPT</h3>
        <input type="text" id="note-search" placeholder="Rechercher une note..." style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #404040;border-radius:4px;box-sizing:border-box;background:#2b2b2b;color:#dcddde;">
        <div id="note-tree" style="flex:1;overflow-y:auto;border:1px solid #404040;border-radius:4px;max-height:450px;min-height:250px;padding:8px;background:#2b2b2b;">
          <div style="padding:20px;text-align:center;color:#888;">Chargement...</div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:15px;">
          <button id="note-cancel" style="padding:8px 16px;cursor:pointer;border:1px solid #404040;background:#2b2b2b;color:#dcddde;border-radius:4px;">Annuler</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const searchInput = document.getElementById('note-search');
  const treeContainer = document.getElementById('note-tree');
  const btnCancel = document.getElementById('note-cancel');

  // Structure arborescente
  let tree = { name: '', children: {}, files: [] };
  let allFiles = [];

  // Charger l'arborescence récursivement
  async function loadTree(path = '', node = tree) {
    try {
      const res = await safeFetch(API_URL + '/vault/' + encodeURIComponent(path), {
        headers: { 'Authorization': 'Bearer ' + TOKEN }
      });

      if (!res.ok) return;

      const data = await res.json();

      for (const item of data.files) {
        if (item.endsWith('/')) {
          const folderName = item.slice(0, -1);
          // Ignorer dossiers cachés (. seulement)
          if (folderName.startsWith('.')) continue;

          node.children[folderName] = { name: folderName, children: {}, files: [] };
          await loadTree(path + item, node.children[folderName]);
        } else if (item.endsWith('.md')) {
          const fullPath = path + item;
          node.files.push({ name: item, path: fullPath });
          allFiles.push(fullPath);
        }
      }
    } catch (e) {
      console.error('Erreur chargement:', e);
    }
  }

  // Rendre l'arborescence
  function renderTree(node, container, level = 0) {
    // Trier dossiers par nom
    const folders = Object.keys(node.children).sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' })
    );

    // Trier fichiers par nom
    const files = [...node.files].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
    );

    // Afficher les dossiers
    for (const folderName of folders) {
      const folder = node.children[folderName];
      const hasContent = Object.keys(folder.children).length > 0 || folder.files.length > 0;
      if (!hasContent) continue;

      const folderEl = document.createElement('div');
      folderEl.className = 'tree-folder';
      folderEl.style.padding = '6px 10px';
      folderEl.innerHTML = `
        <span class="tree-folder-icon">▶</span>
        <span class="tree-folder-name">📁 ${folderName}</span>
      `;

      const childrenEl = document.createElement('div');
      childrenEl.className = 'tree-children collapsed';

      folderEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const icon = folderEl.querySelector('.tree-folder-icon');
        const isCollapsed = childrenEl.classList.contains('collapsed');

        if (isCollapsed) {
          childrenEl.classList.remove('collapsed');
          icon.textContent = '▼';
        } else {
          childrenEl.classList.add('collapsed');
          icon.textContent = '▶';
        }
      });

      container.appendChild(folderEl);
      container.appendChild(childrenEl);

      renderTree(folder, childrenEl, level + 1);
    }

    // Afficher les fichiers
    for (const file of files) {
      const fileEl = document.createElement('div');
      fileEl.className = 'tree-file';
      fileEl.innerHTML = `<span class="tree-file-name">📄 ${file.name.replace('.md', '')}</span>`;
      fileEl.addEventListener('click', () => attachNote(file.path));
      container.appendChild(fileEl);
    }
  }

  // Afficher résultats de recherche (liste plate)
  function renderSearchResults(filter) {
    const filtered = allFiles.filter(f =>
      f.toLowerCase().includes(filter.toLowerCase())
    );

    treeContainer.innerHTML = '';
    treeContainer.classList.add('search-results');

    if (filtered.length === 0) {
      treeContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#666;">Aucune note trouvée</div>';
      return;
    }

    const display = filtered.slice(0, 50);

    for (const filePath of display) {
      const name = filePath.split('/').pop().replace('.md', '');
      const folder = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';

      const fileEl = document.createElement('div');
      fileEl.className = 'tree-file';
      fileEl.innerHTML = `
        <div class="tree-file-name">📄 ${name}</div>
        ${folder ? `<div class="tree-file-path">${folder}</div>` : ''}
      `;
      fileEl.addEventListener('click', () => attachNote(filePath));
      treeContainer.appendChild(fileEl);
    }

    if (filtered.length > 50) {
      const moreEl = document.createElement('div');
      moreEl.style.cssText = 'padding:10px;text-align:center;color:#666;font-size:12px;';
      moreEl.textContent = `... et ${filtered.length - 50} autres notes`;
      treeContainer.appendChild(moreEl);
    }
  }

  // Afficher l'arborescence complète
  function renderFullTree() {
    treeContainer.innerHTML = '';
    treeContainer.classList.remove('search-results');
    renderTree(tree, treeContainer);
  }

  // Attacher la note sélectionnée
  async function attachNote(filePath) {
    try {
      const fileName = filePath.split('/').pop();

      const contentRes = await safeFetch(API_URL + '/vault/' + encodeURIComponent(filePath), {
        headers: { 'Authorization': 'Bearer ' + TOKEN }
      });

      if (!contentRes.ok) {
        throw new Error('Impossible de lire le fichier');
      }

      const content = typeof contentRes.text === 'function' ? await contentRes.text() : contentRes.text;

      const blob = new Blob([content], { type: 'text/markdown' });
      const file = new File([blob], fileName, { type: 'text/markdown' });

      // Utiliser l'input file directement
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        overlay.remove();
      } else {
        throw new Error('Input file non trouvé');
      }

    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  }

  // Événements
  btnCancel.onclick = () => overlay.remove();

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (query.length > 0) {
      renderSearchResults(query);
    } else {
      renderFullTree();
    }
  });

  // Charger et afficher
  await loadTree();
  renderFullTree();
  searchInput.focus();
})();
