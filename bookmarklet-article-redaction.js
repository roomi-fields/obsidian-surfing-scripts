/**
 * Bookmarklet 3 : Rédaction d'article pour Obsidian
 * Compatible Claude.ai et ChatGPT
 */

(function() {
  const isClaude = window.location.hostname.includes('claude.ai');
  const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');
  const source = isClaude ? 'Claude' : isChatGPT ? 'ChatGPT' : 'AI';

  // Encoder l'URL pour Obsidian Surfing
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
})();

// BOOKMARKLET (copier cette ligne) :
// javascript:(function(){const isClaude=location.hostname.includes("claude.ai"),isChatGPT=location.hostname.includes("chat.openai.com")||location.hostname.includes("chatgpt.com"),source=isClaude?"Claude":isChatGPT?"ChatGPT":"AI",sUrl="obsidian://web-open?url="+encodeURIComponent(location.href),e=`En te basant sur notre conversation, rédige un article selon les consignes suivantes :\n\nRÔLE : Tu es uniquement un rédacteur d'articles texte pour le site Re-Liance.\nTu écris des articles professionnels de haute qualité sur des thèmes humains, psychologiques, existentiels, relationnels, philosophiques, thérapeutiques et sociétaux.\nTu adoptes le style Re-liance : fluide, continu, organique, incarné, poétique sans lyrisme, nuancé, non jargonneux et toujours ancré dans une rigueur intellectuelle douce et accessible.\nTu mets en lien les dimensions du corps, de la psyché, du social et du symbolique.\n\nStructure de référence (modulable selon le sujet) :\n1. Introduction : enjeu humain, existentiel, symbolique ou sociétal.\n2. Origines / notions fondamentales / étymologie : concepts clés, racines culturelles et symboliques.\n3. Regard sur le sujet & différentes perspectives : approche psychologique, systémique, philosophique, existentielle.\n4. Impacts concrets dans la vie : effets sur la condition humaine individuelle et collective.\n5. Développement signifiant : exploration profonde et articulée du sujet.\n6. Ouverture (si pertinent) : espace pour ce qui dépasse le concept.\n7. Conclusion : brève, incarnée, qui ouvre sans fermer.\n\nCitations : 1 à 2 max par section, réelles, en français. Bibliographie : 3 à 5 titres max, accessibles, en français.\n\nStyle rédactionnel :\n- Langage fluide, organique, relationnel.\n- Écriture incarnée, sensible, mais rigoureuse.\n- Aucune liste à puces dans le corps du texte.\n- Pas de ton de coach, pas d'injonctions.\n- Pensée systémique, vivante, nuancée, non dogmatique.\n- Poésie sobre, jamais grandiloquente.\n- Usage du « nous » ou « on » pour la condition humaine.\n\nRègles de titrage :\n- title : 50-60 caractères, ne commence jamais par un article, évocateur avec une légère part de suspens, sans ponctuation finale, contient le mot-clé principal naturellement\n- subtitle : 80-120 caractères, complète le titre sans le répéter, crée de la curiosité ou précise l'angle\n- excerpt : 150-160 caractères EXACTEMENT, accroche qui résume la valeur pour le lecteur, contient le mot-clé naturellement, ne reprend pas le titre mot pour mot\n\nINSTRUCTIONS STRICTES :\n- Affiche le résultat UNIQUEMENT dans un bloc de code markdown (entre \\\`\\\`\\\`markdown et \\\`\\\`\\\`)\n- PAS de texte avant ou après le bloc de code\n- PAS de fichier à télécharger\n- Longueur : 1500 à 2500 mots\n- Tags : 5-7, en minuscules sans accents, mélange thème principal + concepts clés\n- Titre (title) : ne doit pas contenir * " / \\\\ < > : | ?\n- focus_keyword : 1-3 mots que quelqu'un taperait pour trouver cet article, présent dans title, excerpt et premier paragraphe\n- categorie : choisir parmi [systemique, psychologie, philosophie, relations, therapie, societe, existence, corps-psyche]\n\nFORMAT EXACT à respecter (copie ce template) :\n\n---\ntype: article\ntitle: "Titre principal ici"\nsubtitle: "Sous-titre qui complète et intrigue"\nexcerpt: "Accroche de 150-160 caractères exactement qui donne envie de lire l'article complet."\nfocus_keyword: mot-clé principal\ncategorie: systemique\ntags: [tag1, tag2, tag3, tag4, tag5]\nsource: "${source}"\nconversation_url: "${sUrl}"\ndate: ${new Date().toISOString().split("T")[0]}\n---\n# [Reprendre le title exactement]\n\n### [Reprendre le subtitle exactement]\n\n[Contenu de l'article selon la structure ci-dessus - le premier paragraphe doit contenir le focus_keyword naturellement]\n\n## Bibliographie\n\n<!-- END -->`;let t,n;if(isClaude){t=document.querySelector('div[contenteditable="true"]');n=document.querySelector('button[aria-label="Send Message"]')}else if(isChatGPT){t=document.querySelector("#prompt-textarea")||document.querySelector('div[contenteditable="true"]')||document.querySelector("textarea");n=document.querySelector('button[data-testid="send-button"]')||document.querySelector('button[data-testid="fruitjuice-send-button"]')||document.querySelector('form button[type="submit"]')}if(!t){alert("Zone de saisie non trouvée");return}t.focus();if(t.tagName==="TEXTAREA"){t.value=e;t.dispatchEvent(new Event("input",{bubbles:true}))}else{document.execCommand("insertText",false,e)}setTimeout(()=>{n&&!n.disabled&&n.click()},300)})();
