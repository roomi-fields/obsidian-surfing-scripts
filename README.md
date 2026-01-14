# Scripts Surfing - Obsidian + Claude.ai / ChatGPT / Gemini

Automatise la création de notes et articles Obsidian depuis tes conversations Claude.ai, ChatGPT ou Gemini via le plugin Surfing.

## Architecture

```
scripts/
├── prompt-from-vault.js   # Injecte un prompt depuis le vault
├── create-note.js         # Crée une note depuis la réponse
├── creer-article.js       # Crée un article avec enluminure
├── download-dalle.js      # Boutons Save sur images DALL-E
└── attach-note.js         # Attache la note active à ChatGPT

vault/_prompts/            # Prompts stockés dans Obsidian
├── _exemple-variables.md  # Documentation des variables
├── Re-Liance - Thérapie.md
├── Re-Liance - Regards.md
├── Résumé Conversation.md
├── Traduire Article FR-EN.md
├── Enluminure FR.md
└── Enluminure EN.md
```

## Prérequis

1. Plugin **Surfing** (fork avec `surfingFetch`) installé dans Obsidian
2. Plugin **Local REST API** installé et actif sur le port `27123`
3. Token API configuré (à modifier dans les scripts)
4. Dossier `_prompts/` dans votre vault avec vos fichiers de prompts

## Variables dynamiques

Les prompts stockés dans le vault peuvent utiliser ces variables :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `{{source}}` | Nom de l'IA | Claude, ChatGPT ou Gemini |
| `{{date}}` | Date du jour | 2025-12-15 |
| `{{conversation_url}}` | URL Obsidian Surfing | obsidian://web-open?url=... |
| `{{raw_url}}` | URL brute | https://claude.ai/chat/... |

---

## Scripts disponibles

### 1. Prompt depuis le Vault

**URL Pattern** : `https://claude.ai/*`, `https://chatgpt.com/*` et `https://gemini.google.com/*`

Affiche un sélecteur pour choisir un prompt .md depuis le vault et l'injecte dans la conversation.

### 2. Créer Note

**URL Pattern** : `https://claude.ai/*` et `https://chatgpt.com/*`

Extrait la dernière réponse de l'assistant et crée une note Obsidian via l'API Local REST.

### 3. Créer Article (avec enluminure)

**URL Pattern** : `https://chatgpt.com/*`

Assemble l'article généré + l'enluminure téléchargée dans une note Obsidian. Détecte automatiquement le mode monolingue ou bilingue.

### 4. Télécharger Image DALL-E

**URL Pattern** : `https://chatgpt.com/*`

Script automatique qui ajoute des boutons "Save FR" et "Save EN" sur les images DALL-E générées.

### 5. Attacher Note

**URL Pattern** : `https://chatgpt.com/*`

Affiche un sélecteur pour choisir une note du vault et l'attache comme fichier .md dans ChatGPT.

---

## Créer un nouveau prompt

1. Créez un fichier `.md` dans `vault/_prompts/`
2. Utilisez les variables `{{source}}`, `{{date}}`, `{{conversation_url}}`, `{{raw_url}}`
3. Le script l'affichera automatiquement dans le sélecteur

Exemple minimal :
```markdown
Résume cette conversation en 3 points clés.

Format :
---
type: note
source: "{{source}}"
date: {{date}}
---
# Résumé

- Point 1
- Point 2
- Point 3

<!-- END -->
```

---

## Utilisation

### Workflow standard

1. Ouvre **claude.ai**, **chatgpt.com** ou **gemini.google.com** dans Surfing
2. Discute du sujet
3. Exécute **"Prompt depuis le Vault"** → Sélectionne ton prompt
4. L'IA génère la réponse formatée
5. Exécute **"Créer Note"** ou **"Créer Article"** selon le type

### Workflow articles avec enluminure (ChatGPT)

1. Sélectionne le prompt **"Re-Liance - Thérapie"** ou **"Re-Liance - Regards"**
2. Sélectionne **"Enluminure FR"** → Clique "Save FR" sur l'image
3. (Optionnel) Sélectionne **"Traduire Article FR-EN"**
4. (Optionnel) Sélectionne **"Enluminure EN"** → Clique "Save EN"
5. Exécute **"Créer Article"** → Détecte automatiquement mono/bilingue

---

## Dépannage

| Problème | Solution |
|----------|----------|
| "Dossier non trouvé" | Vérifiez le chemin `PROMPTS_FOLDER` dans le script |
| "Zone de saisie non trouvée" | Rechargez la page |
| "Aucune réponse trouvée" | Attendez que l'IA finisse de répondre |
| "Impossible de contacter Obsidian" | Vérifiez que Local REST API est actif |

---

## Configuration

Modifiez ces constantes dans les scripts :

```javascript
const API_URL = 'http://localhost:27123';
const TOKEN = 'votre-token-api';
const PROMPTS_FOLDER = 'Publications/_prompts'; // Chemin relatif dans le vault
```

---

## Déploiement dans Surfing

Les scripts sont stockés dans la configuration du plugin Surfing (pas comme fichiers externes).

**Fichier** : `.obsidian/plugins/surfing/data.json`

**Structure** :
```json
{
  "customScripts": [
    {
      "id": "uuid",
      "name": "Nom du script",
      "code": "// code JS (échappé JSON)",
      "enabled": true
    }
  ]
}
```

**Procédure manuelle** :
1. Modifier le script `.js` dans ce projet
2. Échapper le code pour JSON (`"` → `\"`, newlines → `\n`)
3. Remplacer le champ `code` dans `data.json`
4. Redémarrer Obsidian

**Avec Claude Code** : Demander directement de mettre à jour `data.json` avec le nouveau script.
