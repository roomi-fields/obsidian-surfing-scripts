/**
 * Script Surfing : Créer Article - Monolingue ou Bilingue
 * Assemble l'article généré + l'enluminure téléchargée dans une note Obsidian
 * Compatible ChatGPT uniquement
 */

(async function() {
    'use strict';

    const API_URL = 'http://localhost:27123';
    const TOKEN = '79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab';

    if (!location.hostname.includes('chat.openai.com') && !location.hostname.includes('chatgpt.com')) {
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

    // Fonction pour extraire un article depuis les messages
    function extractArticle(messages, lang) {
        for (let i = messages.length - 1; i >= 0; i--) {
            const text = messages[i].innerText;

            // Détection de la langue
            const hasEndMarker = text.includes('<!-- END -->');
            const hasArticleType = text.includes('type: article');
            const isFrench = text.includes('Bibliographie');
            const isEnglish = text.includes('Bibliography');

            if (!hasEndMarker && !hasArticleType) continue;

            if ((lang === 'FR' && isFrench) || (lang === 'EN' && isEnglish)) {
                return extractContent(text);
            }
        }
        return null;
    }

    function extractContent(text) {
        let content = text;

        const yamlStart = content.indexOf('---');
        if (yamlStart > 0) {
            content = content.substring(yamlStart);
        }

        content = content.replace(/Copier le code\s*/g, '');
        content = content.replace(/Copy code\s*/g, '');

        const yamlMatch = content.match(/(---[\s\S]*?---[\s\S]*?)<!-- END -->/);
        if (yamlMatch) {
            content = yamlMatch[1].trim();
        } else {
            const mdMatch = content.match(/```markdown\n([\s\S]*?)```/);
            if (mdMatch) {
                content = mdMatch[1].trim();
            }
        }

        content = content.replace(/<!-- END -->/g, '');
        return content;
    }

    function parseFrontmatter(content) {
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) return {};

        const fm = {};
        match[1].split('\n').forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length) {
                fm[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
            }
        });
        return fm;
    }

    function extractBody(content) {
        return content.replace(/^---[\s\S]*?---\n*/, '');  // Retire seulement le frontmatter
    }

    function createSlug(title) {
        return title
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    // Supprimer tout popup existant
    const existing = document.getElementById('obsidian-overlay');
    if (existing) existing.remove();

    const messages = document.querySelectorAll('[data-turn="assistant"]');
    if (messages.length === 0) {
        alert('Aucune réponse trouvée');
        return;
    }

    // Extraire les articles FR et EN
    const articleFR = extractArticle(messages, 'FR');
    const articleEN = extractArticle(messages, 'EN');

    const hasFR = articleFR !== null;
    const hasEN = articleEN !== null;
    const isBilingual = hasFR && hasEN;

    if (!hasFR && !hasEN) {
        alert('Aucun article trouvé. Assurez-vous d\'avoir généré un article.');
        return;
    }

    // Récupérer les enluminures
    const enluminureFR = window.lastSavedEnluminureFR || window.lastSavedEnluminure || null;
    const enluminureEN = window.lastSavedEnluminureEN || null;

    // Parser les frontmatters
    const fmFR = hasFR ? parseFrontmatter(articleFR) : {};
    const fmEN = hasEN ? parseFrontmatter(articleEN) : {};

    // Titre pour le fichier (utiliser FR en priorité)
    const mainTitle = fmFR.title || fmEN.title || 'Article-' + Date.now();
    const sanitizedTitle = mainTitle.replace(/[\/\\:*?"<>|]/g, '').substring(0, 100);

    let finalContent;

    if (isBilingual) {
        // ===== FORMAT BILINGUE =====
        const surfingUrl = 'obsidian://web-open?url=' + encodeURIComponent(window.location.href);
        const bodyFR = extractBody(articleFR);
        const bodyEN = extractBody(articleEN);

        const enluminurePathFR = enluminureFR ? `_Assets/Enluminures/${enluminureFR}` : '';
        const enluminurePathEN = enluminureEN ? `_Assets/Enluminures/${enluminureEN}` : '';

        finalContent = `---
type: article
date: ${fmFR.date || new Date().toISOString().split('T')[0]}
category: ${fmFR.categorie || fmEN.categorie || 'systemique'}
source: ${fmFR.source || 'ChatGPT'}
conversation_url: ${surfingUrl}
wordpress_url_fr:
wordpress_url_en:
substack_draft_id_en:
substack_url_en:
---

> [!info]- Version française
> **title:** ${fmFR.title || mainTitle}
> **subtitle:** ${fmFR.subtitle || ''}
> **excerpt:** ${fmFR.excerpt || ''}
> **slug:** ${createSlug(fmFR.title || mainTitle)}
> **focus_keyword:** ${fmFR.focus_keyword || ''}
> **tags:** ${fmFR.tags || ''}
> **enluminure:** ${enluminurePathFR}
> **wordpress_url:**
>
> ---
${enluminureFR ? `> ![[${enluminurePathFR}|150]]\n` : ''}> # ${fmFR.title || mainTitle}
>
> ### ${fmFR.subtitle || ''}
>
${bodyFR.split('\n').map(line => '> ' + line).join('\n')}


> [!info]- English version
> **title:** ${fmEN.title || ''}
> **subtitle:** ${fmEN.subtitle || ''}
> **excerpt:** ${fmEN.excerpt || ''}
> **slug:** ${createSlug(fmEN.title || '')}
> **focus_keyword:** ${fmEN.focus_keyword || ''}
> **tags:** ${fmEN.tags || ''}
> **enluminure:** ${enluminurePathEN}
> **wordpress_url:**
>
> ---
${enluminureEN ? `> ![[${enluminurePathEN}|150]]\n` : ''}> # ${fmEN.title || ''}
>
> ### ${fmEN.subtitle || ''}
>
${bodyEN.split('\n').map(line => '> ' + line).join('\n')}
`;
    } else {
        // ===== FORMAT MONOLINGUE (comportement original) =====
        const article = articleFR || articleEN;
        const fm = hasFR ? fmFR : fmEN;
        const enluminure = hasFR ? enluminureFR : (enluminureEN || enluminureFR);
        const body = extractBody(article);

        if (!enluminure) {
            const continueWithout = confirm('Aucune enluminure détectée.\n\nCliquer OK pour continuer sans enluminure.');
            if (!continueWithout) return;
        }

        const enluminurePath = enluminure ? `_Assets/Enluminures/${enluminure}` : '';
        const surfingUrl = 'obsidian://web-open?url=' + encodeURIComponent(window.location.href);
        const slug = createSlug(fm.title || mainTitle);
        const subtitle = fm.subtitle || '';

        // Séparer bibliographie
        const biblioMatch = body.match(/## Bibliograph(?:ie|y)\n([\s\S]*)$/);
        let mainBody = body;
        let bibliography = '';
        if (biblioMatch) {
            bibliography = biblioMatch[1].trim();
            mainBody = body.replace(/## Bibliograph(?:ie|y)\n[\s\S]*$/, '').trim();
        }

        finalContent = `---
type: article
date: ${fm.date || new Date().toISOString().split('T')[0]}
title: "${fm.title || mainTitle}"
subtitle: "${subtitle}"
excerpt: "${fm.excerpt || ''}"
slug: ${slug}
focus_keyword: ${fm.focus_keyword || ''}
tags: ${fm.tags || '[]'}
categorie: ${fm.categorie || 'systemique'}
${enluminure ? `enluminure: ${enluminurePath}\n` : ''}source: ${fm.source || 'ChatGPT'}
conversation_url: "${surfingUrl}"
---
${enluminure ? `![[${enluminurePath}|150]]\n` : ''}${mainBody}${bibliography ? `\n\n## Bibliographie\n\n${bibliography}` : ''}`;
    }

    // Créer le popup
    const modeLabel = isBilingual ? 'Bilingue FR/EN' : (hasFR ? 'Français' : 'English');
    const enluminureStatus = isBilingual
        ? `FR: ${enluminureFR || 'manquante'} | EN: ${enluminureEN || 'manquante'}`
        : (enluminureFR || enluminureEN || 'Sans enluminure');

    const overlay = document.createElement('div');
    overlay.id = 'obsidian-overlay';
    overlay.innerHTML = `
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:white;padding:20px;border-radius:8px;min-width:400px;color:black;">
                <h3 style="margin:0 0 15px 0;">Créer article Obsidian</h3>
                <p style="margin:0 0 5px 0;font-size:14px;"><strong>Mode:</strong> ${modeLabel}</p>
                <p style="margin:0 0 5px 0;font-size:14px;"><strong>Fichier:</strong> ${sanitizedTitle}.md</p>
                <p style="margin:0 0 15px 0;font-size:12px;color:#666;">Enluminure: ${enluminureStatus}</p>
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

    try {
        await loadFolders('');
        const folders = Array.from(folderSet).sort();
        folders.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f === '/' ? '/ (racine)' : f;
            select.appendChild(opt);
        });
    } catch (e) {
        alert('Impossible de contacter Obsidian. Vérifiez que Local REST API est actif.');
        overlay.remove();
    }

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
                alert(`Article créé : ${path}\n\n${modeLabel}`);
                overlay.remove();
                // Reset
                window.lastSavedEnluminure = null;
                window.lastSavedEnluminureFR = null;
                window.lastSavedEnluminureEN = null;
            } else {
                alert('Erreur création: ' + r.status);
            }
        } catch (e) {
            alert('Erreur: ' + e.message);
        }
    };

    console.log(`Popup Créer Article affiché (${modeLabel})`);
})();
