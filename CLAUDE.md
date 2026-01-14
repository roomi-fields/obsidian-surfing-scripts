# Scripts Obsidian Surfing

## Architecture du projet

Ce projet contient des scripts pour automatiser la création de notes et articles Obsidian depuis Claude.ai, ChatGPT et Gemini via le plugin Surfing.

### Emplacements des fichiers

| Type | Chemin | Description |
|------|--------|-------------|
| **Scripts JS** | `D:\Claude\obsidian-surfing-scripts\` | Scripts fonctionnels |
| **Prompts** | `D:\Romain\Articles\Publications\_prompts\` | Prompts .md stockés dans le vault Obsidian |
| **Vault Obsidian** | `D:\Romain\Articles\` | Vault principal |

### Scripts principaux

- `prompt-from-vault.js` - Sélecteur de prompts depuis le vault (Claude + ChatGPT + Gemini)
- `create-note.js` - Crée une note depuis la réponse (Claude + ChatGPT)
- `creer-article.js` - Crée un article avec enluminure (ChatGPT uniquement)
- `download-dalle.js` - Boutons Save FR/EN sur images DALL-E (ChatGPT uniquement)
- `attach-note.js` - Attache la note active Obsidian à ChatGPT (ChatGPT uniquement)

### Prompts disponibles

Les prompts sont dans `Publications/_prompts/` :
- `Re-Liance - Thérapie.md` - Article catégorie thérapie
- `Re-Liance - Regards.md` - Article catégorie regards
- `Résumé Conversation.md` - Résumé de conversation
- `Traduire Article FR-EN.md` - Traduction FR → EN
- `Enluminure FR.md` - Génère enluminure française
- `Enluminure EN.md` - Génère enluminure anglaise
- `_exemple-variables.md` - Documentation des variables

### Variables dynamiques dans les prompts

- `{{source}}` → "Claude", "ChatGPT" ou "Gemini"
- `{{date}}` → date du jour (YYYY-MM-DD)
- `{{conversation_url}}` → URL encodée pour Obsidian Surfing
- `{{raw_url}}` → URL brute de la conversation

### Configuration

Les scripts utilisent l'API Local REST d'Obsidian :
- Port : `27123`
- Token : configuré dans chaque script
- Chemin prompts : `Publications/_prompts`

### Déploiement des scripts dans Surfing

Les scripts sont stockés **directement dans la configuration** du plugin Surfing, pas comme fichiers externes.

**Fichier de configuration** : `D:\Romain\Articles\.obsidian\plugins\surfing\data.json`

**Structure** : Les scripts sont dans le tableau `customScripts`, chaque entrée contient :
```json
{
  "id": "uuid",
  "name": "Nom du script",
  "code": "// code JS échappé pour JSON...",
  "enabled": true
}
```

**Procédure de déploiement** :
1. Modifier le script dans ce projet (`*.js`)
2. Copier le contenu du script
3. Remplacer le champ `code` correspondant dans `data.json` (attention à l'échappement JSON : `"` → `\"`, newlines → `\n`)
4. Redémarrer Obsidian pour appliquer les changements

**Alternative avec Claude** : Demander à Claude de mettre à jour directement le `data.json` avec le nouveau code du script.
