# Scripts Surfing - Obsidian + Claude.ai / ChatGPT

Automatise la création de notes et articles Obsidian (monolingues et bilingues) depuis tes conversations Claude.ai ou ChatGPT via le plugin Surfing.

## Prérequis

1. Plugin **Surfing** (fork avec `surfingFetch`) installé dans Obsidian
2. Plugin **Local REST API** installé et actif sur le port `27123`
3. Token API configuré (à modifier dans les scripts ci-dessous)
4. Plugin de recadrage d'images configuré (pour `_Assets/Enluminures/`)

## Installation

Dans Obsidian, ouvre les paramètres de Surfing → "Custom Scripts" et ajoute les scripts ci-dessous avec les URL patterns indiqués.

---

## Script 1 : Résumé YAML

**URL Pattern** : `https://claude.ai/*` et `https://chatgpt.com/*`

Injecte un prompt demandant à l'IA de générer un compte rendu structuré avec frontmatter YAML.

```javascript
// Résumé YAML - Génère un compte rendu structuré de la conversation
// URL Pattern: https://claude.ai/* et https://chatgpt.com/*

(function() {
    'use strict';

    const isClaude = window.location.hostname.includes('claude.ai');
    const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');
    const source = isClaude ? 'Claude' : isChatGPT ? 'ChatGPT' : 'AI';

    const surfingUrl = 'obsidian://web-open?url=' + encodeURIComponent(window.location.href);

    const prompt = `Génère un compte rendu des aspects importants de cette conversation , je te donne ici quelques exemples:
- points clés
- perspectives,
- aspects stratégiques,
- idées,
- points restant ouverts,
- points forts,
- difficultés,
- points en tension,
- ce qui est innovant,
- mes enthousiasmes et de mes préoccupations ou doutes,
- difficultés soulevées
dans cette conversation pour mes notes Obsidian.

INSTRUCTIONS STRICTES :
- Affiche le résultat UNIQUEMENT dans un bloc de code markdown (entre \`\`\`markdown et \`\`\`)
- PAS de texte avant ou après le bloc de code
- PAS de fichier à télécharger
- Taille adaptée en prenant soin de ne garder que les informations pertinentes
- Tags : 5 maximum, en minuscules, pertinents
- Titre: le titre ne doit pas contenir: * " / \\ < > : | ?
- Le style doit être adapté au contenu : style direct et concis (liste de points) pour un contenu plus technique ou pragmatique, style plus structuré pour un développement conceptuel ou des notes pour une rédaction d'article.

FORMAT EXACT à respecter (copie ce template) :

---
type: conversation
source: "${source}"
conversation_url: "${surfingUrl}"
date: ${new Date().toISOString().split('T')[0]}
tags: [tag1, tag2]
---
# Titre descriptif (idéalement 3 mots, 5 mots maximum)

## Contexte

## Points clés

## Etat Actuel

## Ensuite

<!-- END -->`;

    let textarea, sendBtn;

    if (isClaude) {
        textarea = document.querySelector('div[contenteditable="true"]');
        sendBtn = document.querySelector('button[aria-label="Send Message"]');
    } else if (isChatGPT) {
        textarea = document.querySelector('#prompt-textarea')
            || document.querySelector('div[contenteditable="true"]')
            || document.querySelector('textarea');
        sendBtn = document.querySelector('button[data-testid="send-button"]')
            || document.querySelector('button[data-testid="fruitjuice-send-button"]')
            || document.querySelector('form button[type="submit"]');
    }

    if (!textarea) {
        alert('Zone de saisie non trouvée');
        return;
    }

    textarea.focus();

    if (textarea.tagName === 'TEXTAREA') {
        textarea.value = prompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        document.execCommand('insertText', false, prompt);
    }

    setTimeout(() => {
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
    }, 300);

    console.log('📝 Prompt Résumé YAML injecté');
})();
```

---

## Script 2 : Créer Note

**URL Pattern** : `https://claude.ai/*` et `https://chatgpt.com/*`

Extrait la dernière réponse de l'assistant et crée une note Obsidian via l'API Local REST.

```javascript
// Créer Note - Extrait la réponse et crée une note Obsidian
// URL Pattern: https://claude.ai/* et https://chatgpt.com/*

(async function() {
    'use strict';

    const API_URL = 'http://localhost:27123';
    const TOKEN = '79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab'; // À modifier

    const isClaude = window.location.hostname.includes('claude.ai');
    const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');

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

    const existing = document.getElementById('obsidian-overlay');
    if (existing) existing.remove();

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

    let content = lastMessage.innerText;

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

    const titleMatch = content.match(/^# (.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Note-' + Date.now();

    content = content.replace(/^# .+\n+/m, '');

    const sanitized = title
        .replace(/[\/\\:*?"<>|]/g, '')
        .substring(0, 100);

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

    console.log('📄 Popup Créer Note affiché');
})();
```

---

## Script 3 : Article Rédaction (FR)

**URL Pattern** : `https://claude.ai/*` et `https://chatgpt.com/*`

Injecte un prompt pour rédiger un article style Re-Liance avec frontmatter YAML enrichi SEO.

```javascript
// Article Rédaction FR - Génère un article structuré style Re-Liance
// URL Pattern: https://claude.ai/* et https://chatgpt.com/*

(function() {
    'use strict';

    const isClaude = window.location.hostname.includes('claude.ai');
    const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');
    const source = isClaude ? 'Claude' : isChatGPT ? 'ChatGPT' : 'AI';

    const surfingUrl = 'obsidian://web-open?url=' + encodeURIComponent(window.location.href);

    const prompt = `En te basant sur notre conversation, rédige un article selon les consignes suivantes :

RÔLE : Tu es uniquement un rédacteur d'articles texte pour le site Re-Liance.
Tu écris des articles professionnels de haute qualité sur des thèmes humains, psychologiques, existentiels, relationnels, philosophiques, thérapeutiques et sociétaux.
Tu adoptes le style Re-liance : fluide, continu, organique, incarné, poétique sans lyrisme, nuancé, non jargonneux et toujours ancré dans une rigueur intellectuelle douce et accessible.
Tu mets en lien les dimensions du corps, de la psyché, du social et du symbolique.

Structure de référence (modulable selon le sujet) :
1. Introduction : enjeu humain, existentiel, symbolique ou sociétal.
2. Origines / notions fondamentales / étymologie : concepts clés, racines culturelles et symboliques.
3. Regard sur le sujet & différentes perspectives : approche psychologique, systémique, philosophique, existentielle.
4. Impacts concrets dans la vie : effets sur la condition humaine individuelle et collective.
5. Développement signifiant : exploration profonde et articulée du sujet.
6. Ouverture (si pertinent) : espace pour ce qui dépasse le concept.
7. Conclusion : brève, incarnée, qui ouvre sans fermer.

Citations : 1 à 2 max par section, réelles, en français. Bibliographie : 3 à 5 titres max, accessibles, en français.

Style rédactionnel :
- Langage fluide, organique, relationnel.
- Écriture incarnée, sensible, mais rigoureuse.
- Aucune liste à puces dans le corps du texte.
- Pas de ton de coach, pas d'injonctions.
- Pensée systémique, vivante, nuancée, non dogmatique.
- Poésie sobre, jamais grandiloquente.
- Usage du « nous » ou « on » pour la condition humaine.

Règles de titrage :
- title : 50-60 caractères, ne commence jamais par un article, évocateur avec une légère part de suspens, sans ponctuation finale, contient le mot-clé principal naturellement
- subtitle : 80-120 caractères, complète le titre sans le répéter, crée de la curiosité ou précise l'angle
- excerpt : 150-160 caractères EXACTEMENT, accroche qui résume la valeur pour le lecteur, contient le mot-clé naturellement, ne reprend pas le titre mot pour mot

INSTRUCTIONS STRICTES :
- Affiche le résultat UNIQUEMENT dans un bloc de code markdown (entre \`\`\`markdown et \`\`\`)
- PAS de texte avant ou après le bloc de code
- PAS de fichier à télécharger
- Longueur : 1500 à 2500 mots
- Tags : 5-7, en minuscules sans accents, mélange thème principal + concepts clés
- Titre (title) : ne doit pas contenir * " / \\ < > : | ?
- focus_keyword : 1-3 mots que quelqu'un taperait pour trouver cet article, présent dans title, excerpt et premier paragraphe
- categorie : choisir parmi [systemique, psychologie, philosophie, relations, therapie, societe, existence, corps-psyche]

FORMAT EXACT à respecter (copie ce template) :

---
type: article
title: "Titre principal ici"
subtitle: "Sous-titre qui complète et intrigue"
excerpt: "Accroche de 150-160 caractères exactement qui donne envie de lire l'article complet."
focus_keyword: mot-clé principal
categorie: systemique
tags: [tag1, tag2, tag3, tag4, tag5]
source: "${source}"
conversation_url: "${surfingUrl}"
date: ${new Date().toISOString().split('T')[0]}
---
# [Reprendre le title exactement]

### [Reprendre le subtitle exactement]

[Contenu de l'article selon la structure ci-dessus - le premier paragraphe doit contenir le focus_keyword naturellement]

## Bibliographie

<!-- END -->`;

    let textarea, sendBtn;

    if (isClaude) {
        textarea = document.querySelector('div[contenteditable="true"]');
        sendBtn = document.querySelector('button[aria-label="Send Message"]');
    } else if (isChatGPT) {
        textarea = document.querySelector('#prompt-textarea')
            || document.querySelector('div[contenteditable="true"]')
            || document.querySelector('textarea');
        sendBtn = document.querySelector('button[data-testid="send-button"]')
            || document.querySelector('button[data-testid="fruitjuice-send-button"]')
            || document.querySelector('form button[type="submit"]');
    }

    if (!textarea) {
        alert('Zone de saisie non trouvée');
        return;
    }

    textarea.focus();

    if (textarea.tagName === 'TEXTAREA') {
        textarea.value = prompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        document.execCommand('insertText', false, prompt);
    }

    setTimeout(() => {
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
    }, 300);

    console.log('📰 Prompt Article Rédaction FR injecté');
})();
```

---

## Script 4 : Traduire Article (FR → EN)

**URL Pattern** : `https://claude.ai/*` et `https://chatgpt.com/*`

Traduit l'article français en anglais tout en conservant le même format.

```javascript
// Traduire Article - Traduit l'article FR en anglais
// URL Pattern: https://claude.ai/* et https://chatgpt.com/*

(function() {
    'use strict';

    const isClaude = window.location.hostname.includes('claude.ai');
    const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');
    const source = isClaude ? 'Claude' : isChatGPT ? 'ChatGPT' : 'AI';

    const surfingUrl = 'obsidian://web-open?url=' + encodeURIComponent(window.location.href);

    const prompt = `Traduis l'article que tu viens de rédiger en anglais.

INSTRUCTIONS STRICTES :
- Conserve EXACTEMENT la même structure et le même format
- Traduis tout le contenu y compris le frontmatter YAML (title, subtitle, excerpt, tags, focus_keyword)
- Adapte le slug pour l'anglais (mots anglais, tirets)
- Les tags doivent être en anglais sans accents
- Les citations doivent être traduites avec la mention [translated] si l'original est en français
- La bibliographie reste en français (titres originaux) mais tu peux ajouter une note [French edition]
- Conserve le style fluide, organique et poétique dans la traduction
- Ne traduis PAS de manière littérale : adapte les expressions idiomatiques
- L'excerpt doit faire 150-160 caractères en anglais

Affiche le résultat UNIQUEMENT dans un bloc de code markdown (entre \`\`\`markdown et \`\`\`)

FORMAT EXACT (même structure que l'original) :

---
type: article
title: "English title here"
subtitle: "English subtitle here"
excerpt: "English excerpt of 150-160 characters exactly."
focus_keyword: english keyword
categorie: [même catégorie]
tags: [english-tag1, english-tag2, ...]
source: "${source}"
conversation_url: "${surfingUrl}"
date: ${new Date().toISOString().split('T')[0]}
---
# [English title]

### [English subtitle]

[Translated content...]

## Bibliography

<!-- END -->`;

    let textarea, sendBtn;

    if (isClaude) {
        textarea = document.querySelector('div[contenteditable="true"]');
        sendBtn = document.querySelector('button[aria-label="Send Message"]');
    } else if (isChatGPT) {
        textarea = document.querySelector('#prompt-textarea')
            || document.querySelector('div[contenteditable="true"]')
            || document.querySelector('textarea');
        sendBtn = document.querySelector('button[data-testid="send-button"]')
            || document.querySelector('button[data-testid="fruitjuice-send-button"]')
            || document.querySelector('form button[type="submit"]');
    }

    if (!textarea) {
        alert('Zone de saisie non trouvée');
        return;
    }

    textarea.focus();

    if (textarea.tagName === 'TEXTAREA') {
        textarea.value = prompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        document.execCommand('insertText', false, prompt);
    }

    setTimeout(() => {
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
    }, 300);

    console.log('🌍 Prompt Traduire Article injecté');
})();
```

---

## Script 5 : Enluminure FR (ChatGPT uniquement)

**URL Pattern** : `https://chatgpt.com/*`

Génère une enluminure DALL-E de la première lettre du titre français.

```javascript
// Enluminure FR - Génère une enluminure DALL-E pour la version française
// URL Pattern: https://chatgpt.com/*

(function() {
    'use strict';

    if (!location.hostname.includes('chat.openai.com') && !location.hostname.includes('chatgpt.com')) {
        alert('Ce script fonctionne uniquement sur ChatGPT (DALL-E)');
        return;
    }

    const prompt = `Crée une enluminure représentant la première lettre du titre de l'article FRANÇAIS que tu viens de produire. La lettre doit être en capitale. Cette enluminure doit absolument être en lien avec le thème de l'article et en reprendre des éléments.

Style recherché :
- Dessin au crayon / graphite, avec lavis aquarelle très léger
- Inspiration art nouveau, moderne et épuré (à partir des éléments de l'article)
- Dimension spirituelle très discrète et non religieuse
- Détails fins, lignes délicates, ambiance légère et vivante
- Structure des enluminures médiévales : la lettre doit pouvoir s'intégrer au coin en haut à gauche d'un texte qui l'entoure, elle doit donc être très proche du haut de l'image

Couleurs :
- Couleur principale de la lettre : #34495E (bleu-gris profond)
- Enluminures : nuances de gris, ombres graphite, très légères touches de lavis
- AUCUN fond (transparent), aucune texture papier
- S'il y a des zones pour lesquelles tu ne peux pas appliquer de transparence, la couleur de fond doit être : #DFF4ED

Composition :
- La lettre doit être parfaitement centrée
- L'image doit être recadrée AU RAS des bords de la lettre
- Pas d'ombre portée, pas de lueur, pas de vignette, pas de contour décoratif

Sortie :
- PNG avec fond transparent - OBLIGATOIRE
- Résolution 200x200`;

    let textarea = document.querySelector('#prompt-textarea')
        || document.querySelector('div[contenteditable="true"]')
        || document.querySelector('textarea');
    let sendBtn = document.querySelector('button[data-testid="send-button"]')
        || document.querySelector('button[data-testid="fruitjuice-send-button"]')
        || document.querySelector('form button[type="submit"]');

    if (!textarea) {
        alert('Zone de saisie non trouvée');
        return;
    }

    textarea.focus();

    if (textarea.tagName === 'TEXTAREA') {
        textarea.value = prompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        document.execCommand('insertText', false, prompt);
    }

    setTimeout(() => {
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
    }, 300);

    console.log('🖼️ Prompt Enluminure FR injecté');
})();
```

---

## Script 6 : Enluminure EN (ChatGPT uniquement)

**URL Pattern** : `https://chatgpt.com/*`

Génère une enluminure DALL-E de la première lettre du titre anglais.

```javascript
// Enluminure EN - Génère une enluminure DALL-E pour la version anglaise
// URL Pattern: https://chatgpt.com/*

(function() {
    'use strict';

    if (!location.hostname.includes('chat.openai.com') && !location.hostname.includes('chatgpt.com')) {
        alert('Ce script fonctionne uniquement sur ChatGPT (DALL-E)');
        return;
    }

    const prompt = `Crée une enluminure représentant la première lettre du titre de l'article ANGLAIS que tu viens de traduire. La lettre doit être en capitale. Cette enluminure doit absolument être en lien avec le thème de l'article et en reprendre des éléments.

IMPORTANT : La lettre à illustrer est celle du TITRE ANGLAIS, pas du titre français.

Style recherché :
- Dessin au crayon / graphite, avec lavis aquarelle très léger
- Inspiration art nouveau, moderne et épuré (à partir des éléments de l'article)
- Dimension spirituelle très discrète et non religieuse
- Détails fins, lignes délicates, ambiance légère et vivante
- Structure des enluminures médiévales : la lettre doit pouvoir s'intégrer au coin en haut à gauche d'un texte qui l'entoure, elle doit donc être très proche du haut de l'image

Couleurs :
- Couleur principale de la lettre : #34495E (bleu-gris profond)
- Enluminures : nuances de gris, ombres graphite, très légères touches de lavis
- AUCUN fond (transparent), aucune texture papier
- S'il y a des zones pour lesquelles tu ne peux pas appliquer de transparence, la couleur de fond doit être : #DFF4ED

Composition :
- La lettre doit être parfaitement centrée
- L'image doit être recadrée AU RAS des bords de la lettre
- Pas d'ombre portée, pas de lueur, pas de vignette, pas de contour décoratif

Sortie :
- PNG avec fond transparent - OBLIGATOIRE
- Résolution 200x200`;

    let textarea = document.querySelector('#prompt-textarea')
        || document.querySelector('div[contenteditable="true"]')
        || document.querySelector('textarea');
    let sendBtn = document.querySelector('button[data-testid="send-button"]')
        || document.querySelector('button[data-testid="fruitjuice-send-button"]')
        || document.querySelector('form button[type="submit"]');

    if (!textarea) {
        alert('Zone de saisie non trouvée');
        return;
    }

    textarea.focus();

    if (textarea.tagName === 'TEXTAREA') {
        textarea.value = prompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        document.execCommand('insertText', false, prompt);
    }

    setTimeout(() => {
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
    }, 300);

    console.log('🖼️ Prompt Enluminure EN injecté');
})();
```

---

## Script 7 : Télécharger Image DALL-E (ChatGPT uniquement)

**URL Pattern** : `https://chatgpt.com/*`

Script automatique qui ajoute un bouton "Save FR" et "Save EN" sur les images DALL-E. Le recadrage est géré automatiquement par le plugin Obsidian.

```javascript
// Télécharger Image DALL-E - Boutons "Save FR" et "Save EN"
// URL Pattern: https://chatgpt.com/*
// Note: Le recadrage automatique est géré par le plugin Obsidian

(function() {
    'use strict';

    const SAVE_FOLDER = '_Assets/Enluminures';
    const OBSIDIAN_API_PORT = 27123;
    const OBSIDIAN_API_KEY = '79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab'; // À modifier

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

    function extractArticleInfo(lang) {
        // Cherche l'article FR ou EN selon la langue
        const msgs = document.querySelectorAll('[data-turn="assistant"]');
        for (let i = msgs.length - 1; i >= 0; i--) {
            const text = msgs[i].innerText;

            // Pour EN, chercher un article avec des mots anglais typiques
            // Pour FR, chercher l'article français
            const isEnglish = text.includes('Bibliography') ||
                             (text.includes('type: article') && !text.includes('Bibliographie'));
            const isFrench = text.includes('Bibliographie') ||
                            (text.includes('type: article') && !text.includes('Bibliography'));

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

        // Fallback : dernier article trouvé
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

    async function saveImage(img, lang, btn) {
        btn.innerHTML = '⏳...';
        btn.disabled = true;

        try {
            const info = extractArticleInfo(lang);
            const dateStr = new Date().toISOString().split('T')[0];

            let filename;
            if (info && info.firstLetter) {
                const slug = createSlug(info.title);
                filename = `enluminure-${info.firstLetter}-${slug}-${lang.toLowerCase()}-${dateStr}.png`;
            } else {
                filename = `enluminure-${lang.toLowerCase()}-${dateStr}-${Date.now()}.png`;
            }

            const filepath = `${SAVE_FOLDER}/${filename}`;

            // Télécharger l'image
            const imageResponse = await fetch(img.src, { method: 'GET', credentials: 'include' });
            if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`);

            const arrayBuffer = await imageResponse.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);

            // Sauvegarder via surfingFetch (le plugin Obsidian gère le recadrage automatiquement)
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

                // Stocker selon la langue
                if (lang === 'FR') {
                    window.lastSavedEnluminureFR = filename;
                    window.lastSavedEnluminure = filename; // Compatibilité
                } else {
                    window.lastSavedEnluminureEN = filename;
                }

                console.log(`🖼️ Enluminure ${lang} saved:`, filepath);

                setTimeout(() => {
                    btn.innerHTML = lang === 'FR' ? '🇫🇷 Save FR' : '🇬🇧 Save EN';
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
                btn.innerHTML = lang === 'FR' ? '🇫🇷 Save FR' : '🇬🇧 Save EN';
                btn.style.background = 'rgba(0, 0, 0, 0.7)';
                btn.disabled = false;
            }, 2000);
        }
    }

    function addDownloadButtons(img) {
        if (img.dataset.surfingProcessed) return;
        img.dataset.surfingProcessed = 'true';
        if (!img.src.includes('/backend-api/') && !img.src.includes('oaiusercontent')) return;

        let container = img.closest('div[style*="aspect-ratio"]') || img.parentElement;
        if (!container) return;

        const containerStyle = window.getComputedStyle(container);
        if (containerStyle.position === 'static') {
            container.style.position = 'relative';
        }

        // Bouton FR
        const btnFR = document.createElement('button');
        btnFR.innerHTML = '🇫🇷 Save FR';
        btnFR.style.cssText = buttonStyleBase + 'top: 8px; right: 8px;';
        btnFR.onmouseover = () => btnFR.style.background = 'rgba(0, 0, 0, 0.9)';
        btnFR.onmouseout = () => btnFR.style.background = 'rgba(0, 0, 0, 0.7)';
        btnFR.onclick = (e) => { e.preventDefault(); e.stopPropagation(); saveImage(img, 'FR', btnFR); };

        // Bouton EN
        const btnEN = document.createElement('button');
        btnEN.innerHTML = '🇬🇧 Save EN';
        btnEN.style.cssText = buttonStyleBase + 'top: 8px; right: 90px;';
        btnEN.onmouseover = () => btnEN.style.background = 'rgba(0, 0, 0, 0.9)';
        btnEN.onmouseout = () => btnEN.style.background = 'rgba(0, 0, 0, 0.7)';
        btnEN.onclick = (e) => { e.preventDefault(); e.stopPropagation(); saveImage(img, 'EN', btnEN); };

        container.appendChild(btnFR);
        container.appendChild(btnEN);
    }

    function processImages() {
        document.querySelectorAll('img[src*="backend-api"], img[src*="oaiusercontent"]').forEach(addDownloadButtons);
    }

    processImages();

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) processImages();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('🏄 Surfing DALL-E Image Downloader (FR/EN) loaded');
})();
```

---

## Script 8 : Créer Article (Monolingue ou Bilingue)

**URL Pattern** : `https://chatgpt.com/*`

Détecte automatiquement si une traduction existe et crée l'article au format approprié.

```javascript
// Créer Article - Monolingue ou Bilingue selon le contexte
// URL Pattern: https://chatgpt.com/*

(async function() {
    'use strict';

    const API_URL = 'http://localhost:27123';
    const TOKEN = '79e3a12f004e1adc897f290b9532d4669d7602a2f26c30aa70f68a2f691ebbab'; // À modifier

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

> [!info]- 🇫🇷 Version française
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


> [!info]- 🇬🇧 English version
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
    const modeLabel = isBilingual ? '🌍 Bilingue FR/EN' : (hasFR ? '🇫🇷 Français' : '🇬🇧 English');
    const enluminureStatus = isBilingual
        ? `FR: ${enluminureFR || '⚠️ manquante'} | EN: ${enluminureEN || '⚠️ manquante'}`
        : (enluminureFR || enluminureEN || '⚠️ Sans enluminure');

    const overlay = document.createElement('div');
    overlay.id = 'obsidian-overlay';
    overlay.innerHTML = `
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:white;padding:20px;border-radius:8px;min-width:400px;color:black;">
                <h3 style="margin:0 0 15px 0;">Créer article Obsidian</h3>
                <p style="margin:0 0 5px 0;font-size:14px;"><strong>Mode:</strong> ${modeLabel}</p>
                <p style="margin:0 0 5px 0;font-size:14px;"><strong>Fichier:</strong> ${sanitizedTitle}.md</p>
                <p style="margin:0 0 15px 0;font-size:12px;color:#666;">🖼️ ${enluminureStatus}</p>
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

    console.log(`📰 Popup Créer Article affiché (${modeLabel})`);
})();
```

---

## Utilisation

### Workflow monolingue (inchangé)

1. Ouvre **chatgpt.com** dans Surfing
2. Discute du sujet
3. Exécute **"Article Rédaction FR"**
4. Exécute **"Enluminure FR"**
5. Clique **"🇫🇷 Save FR"** sur l'image
6. Exécute **"Créer Article"** → Détecte automatiquement le mode monolingue

### Workflow bilingue

1. Ouvre **chatgpt.com** dans Surfing
2. Discute du sujet
3. Exécute **"Article Rédaction FR"** → Article français généré
4. Exécute **"Traduire Article"** → Article anglais généré
5. Exécute **"Enluminure FR"** → Image FR générée
6. Clique **"🇫🇷 Save FR"** sur l'image
7. Exécute **"Enluminure EN"** → Image EN générée
8. Clique **"🇬🇧 Save EN"** sur l'image
9. Exécute **"Créer Article"** → Détecte automatiquement le mode bilingue et crée le fichier avec les deux versions

---

## Dépannage

| Problème | Solution |
|----------|----------|
| "Zone de saisie non trouvée" | Recharge la page |
| "Aucune réponse trouvée" | Attends que l'IA finisse de répondre |
| "Impossible de contacter Obsidian" | Vérifie que Local REST API est actif |
| Mauvaise détection FR/EN | Le script cherche "Bibliographie" (FR) vs "Bibliography" (EN) |

---

## Variables globales (debug)

```javascript
window.lastSavedEnluminure    // Compatibilité (= FR)
window.lastSavedEnluminureFR  // Enluminure française
window.lastSavedEnluminureEN  // Enluminure anglaise
```
