/**
 * Bookmarklet 4 : Générer une enluminure (première lettre de l'article)
 * Compatible ChatGPT uniquement (DALL-E)
 */

(function() {
  const isChatGPT = window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com');

  if (!isChatGPT) {
    alert('Ce bookmarklet fonctionne uniquement sur ChatGPT (DALL-E)');
    return;
  }

  const prompt = `Crée une enluminure représentant la première lettre du titre de l'article que tu viens de produire. La lettre doit être en capitale. Cette enluminure doit absolument être en lien avec le thème de l'article et en reprendre des éléments.

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
})();

// BOOKMARKLET (copier cette ligne) :
// javascript:(function(){if(!location.hostname.includes("chat.openai.com")&&!location.hostname.includes("chatgpt.com")){alert("Ce bookmarklet fonctionne uniquement sur ChatGPT (DALL-E)");return}const e=`Crée une enluminure représentant la première lettre du titre de l'article que tu viens de produire. La lettre doit être en capitale. Cette enluminure doit absolument être en lien avec le thème de l'article et en reprendre des éléments.\n\nStyle recherché :\n- Dessin au crayon / graphite, avec lavis aquarelle très léger\n- Inspiration art nouveau, moderne et épuré (à partir des éléments de l'article)\n- Dimension spirituelle très discrète et non religieuse\n- Détails fins, lignes délicates, ambiance légère et vivante\n- Structure des enluminures médiévales : la lettre doit pouvoir s'intégrer au coin en haut à gauche d'un texte qui l'entoure, elle doit donc être très proche du haut de l'image\n\nCouleurs :\n- Couleur principale de la lettre : #34495E (bleu-gris profond)\n- Enluminures : nuances de gris, ombres graphite, très légères touches de lavis\n- AUCUN fond (transparent), aucune texture papier\n- S'il y a des zones pour lesquelles tu ne peux pas appliquer de transparence, la couleur de fond doit être : #DFF4ED\n\nComposition :\n- La lettre doit être parfaitement centrée\n- L'image doit être recadrée AU RAS des bords de la lettre\n- Pas d'ombre portée, pas de lueur, pas de vignette, pas de contour décoratif\n\nSortie :\n- PNG avec fond transparent - OBLIGATOIRE\n- Résolution 200x200`;let t=document.querySelector("#prompt-textarea")||document.querySelector('div[contenteditable="true"]')||document.querySelector("textarea"),n=document.querySelector('button[data-testid="send-button"]')||document.querySelector('button[data-testid="fruitjuice-send-button"]')||document.querySelector('form button[type="submit"]');if(!t){alert("Zone de saisie non trouvée");return}t.focus();if(t.tagName==="TEXTAREA"){t.value=e;t.dispatchEvent(new Event("input",{bubbles:true}))}else{document.execCommand("insertText",false,e)}setTimeout(()=>{n&&!n.disabled&&n.click()},300)})();
