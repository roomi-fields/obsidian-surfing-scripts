/**
 * Bookmarklet 1 : Envoyer le prompt de résumé YAML
 * Compatible Claude.ai et ChatGPT
 */

(function() {
  const isClaude = window.location.hostname.includes('claude.ai');
  const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');
  const source = isClaude ? 'Claude' : isChatGPT ? 'ChatGPT' : 'AI';

  // Encoder l'URL pour Obsidian Surfing
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
    // ChatGPT : essayer plusieurs sélecteurs
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

  // Insérer le texte selon le type d'élément
  if (textarea.tagName === 'TEXTAREA') {
    textarea.value = prompt;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // contenteditable (Claude ou ChatGPT)
    document.execCommand('insertText', false, prompt);
  }

  setTimeout(() => {
    if (sendBtn && !sendBtn.disabled) sendBtn.click();
  }, 300);
})();

// BOOKMARKLET (copier cette ligne) :
// javascript:(function(){const isClaude=location.hostname.includes("claude.ai"),isChatGPT=location.hostname.includes("chat.openai.com")||location.hostname.includes("chatgpt.com"),source=isClaude?"Claude":isChatGPT?"ChatGPT":"AI",sUrl="obsidian://web-open?url="+encodeURIComponent(location.href),e=`Génère un compte rendu des aspects importants de cette conversation , je te donne ici quelques exemples:\n- points clés\n- perspectives,\n- aspects stratégiques,\n- idées,\n- points restant ouverts,\n- points forts,\n- difficultés,\n- points en tension,\n- ce qui est innovant,\n- mes enthousiasmes et de mes préoccupations ou doutes,\n- difficultés soulevées\ndans cette conversation pour mes notes Obsidian.\n\nINSTRUCTIONS STRICTES :\n- Affiche le résultat UNIQUEMENT dans un bloc de code markdown (entre \\\`\\\`\\\`markdown et \\\`\\\`\\\`)\n- PAS de texte avant ou après le bloc de code\n- PAS de fichier à télécharger\n- Taille adaptée en prenant soin de ne garder que les informations pertinentes\n- Tags : 5 maximum, en minuscules, pertinents\n- Titre: le titre ne doit pas contenir: * " / \\\\ < > : | ?\n- Le style doit être adapté au contenu : style direct et concis (liste de points) pour un contenu plus technique ou pragmatique, style plus structuré pour un développement conceptuel ou des notes pour une rédaction d'article.\n\nFORMAT EXACT à respecter (copie ce template) :\n\n---\ntype: conversation\nsource: "${source}"\nconversation_url: "${sUrl}"\ndate: ${new Date().toISOString().split("T")[0]}\ntags: [tag1, tag2]\n---\n# Titre descriptif (idéalement 3 mots, 5 mots maximum)\n\n## Contexte\n\n## Points clés\n\n## Etat Actuel\n\n## Ensuite\n\n<!-- END -->`;let t,n;if(isClaude){t=document.querySelector('div[contenteditable="true"]');n=document.querySelector('button[aria-label="Send Message"]')}else if(isChatGPT){t=document.querySelector("#prompt-textarea")||document.querySelector('div[contenteditable="true"]')||document.querySelector("textarea");n=document.querySelector('button[data-testid="send-button"]')||document.querySelector('button[data-testid="fruitjuice-send-button"]')||document.querySelector('form button[type="submit"]')}if(!t){alert("Zone de saisie non trouvée");return}t.focus();if(t.tagName==="TEXTAREA"){t.value=e;t.dispatchEvent(new Event("input",{bubbles:true}))}else{document.execCommand("insertText",false,e)}setTimeout(()=>{n&&!n.disabled&&n.click()},300)})();
