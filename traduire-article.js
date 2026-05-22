#!/usr/bin/env node
/**
 * Traduire Article - Traduit un article FR → EN via Gemini
 *
 * Crée la version anglaise dans le sous-dossier _en/ du dossier parent.
 * Traduction fidèle et complète (pas de résumé).
 *
 * Usage: node traduire-article.js "D:\chemin\vers\article.md"
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// === Configuration ===
// Chaîne de repli : qualité >= gemini-2.5-flash uniquement (jamais de downgrade
// vers les modèles -lite ou 2.0). Chaque modèle a son PROPRE quota gratuit/jour ;
// sur 429 (quota épuisé) on bascule au suivant. Override possible via GEMINI_MODEL.
const GEMINI_MODELS = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : [
        'gemini-2.5-flash',
        'gemini-3-flash-preview',
        'gemini-3.5-flash',
        'gemini-2.5-pro',
    ];
const modelUrl = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

// Propriétés frontmatter à ne PAS copier depuis la version FR
// (elles seront récupérées depuis l'ancien fichier EN s'il existe)
const SKIP_PROPS = ['wordpress_url', 'wordpress_id', 'wordpress_slug'];

// Propriétés frontmatter à traduire
const TRANSLATE_PROPS = ['title', 'subtitle', 'excerpt', 'tags', 'slug'];

// Clés API Gemini — MULTI-CLÉ pour cumuler les quotas gratuits (chaque clé = projet
// = quota séparé). Découverte (ordre, dédupliqué) : env GEMINI_API_KEYS (séparées par
// virgule) > fichier .gemini-keys à côté de ce script (NON versionné, une clé/ligne) >
// config.yaml (clé unique historique).
const CONFIG_PATHS = [
    path.join('K:', 'therapie', 'atelier-ifs', 'config.yaml'),
    '/home/romi/dev/therapie/atelier-ifs/config.yaml',
];

function findGeminiApiKeys() {
    const keys = [];
    if (process.env.GEMINI_API_KEYS) keys.push(...process.env.GEMINI_API_KEYS.split(','));
    if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
    try {
        const kf = path.join(__dirname, '.gemini-keys');
        if (fs.existsSync(kf)) {
            for (const line of fs.readFileSync(kf, 'utf-8').split(/\r?\n/)) {
                const k = line.trim();
                if (k && !k.startsWith('#')) keys.push(k);
            }
        }
    } catch (e) { /* ignore */ }
    for (const cfgPath of CONFIG_PATHS) {
        try {
            if (!fs.existsSync(cfgPath)) continue;
            const m = fs.readFileSync(cfgPath, 'utf-8').match(/gemini_api_key:\s*["']?([^"'\s\r\n]+)["']?/);
            if (m) keys.push(m[1]);
        } catch (e) { /* ignore */ }
    }
    return [...new Set(keys.map(k => k.trim()).filter(Boolean))];
}

const GEMINI_API_KEYS = findGeminiApiKeys();
const maskKey = (k) => `…${k.slice(-6)}`;

// === Validation ===
if (GEMINI_API_KEYS.length === 0) {
    console.error('Aucune clé API Gemini trouvée. Renseignez .gemini-keys, config.yaml ou GEMINI_API_KEYS.');
    process.exit(1);
}

const filePath = process.argv[2];
if (!filePath) {
    console.error('Usage: node traduire-article.js <fichier.md>');
    process.exit(1);
}

if (!fs.existsSync(filePath)) {
    console.error(`Fichier introuvable: ${filePath}`);
    process.exit(1);
}

// === Gemini API ===

// Transitoire (surcharge serveur / timeout) : on retente le MÊME modèle avec backoff.
const RETRYABLE = /erreur (503|500)|Timeout Gemini/i;
// Quota épuisé (429 RESOURCE_EXHAUSTED) : inutile d'insister, on bascule au modèle suivant.
const QUOTA = /erreur 429/i;
// Sortie incomplète : budget tokens atteint (MAX_TOKENS) ou validation échouée (sections
// manquantes). Réessayer le même modèle ne sert à rien — on bascule au modèle suivant, qui
// peut produire une traduction complète. Si tous échouent, callGemini jette (pas d'écrasement).
const INCOMPLETE = /MAX_TOKENS|troncation/i;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// `validate(text)` (optionnel) doit JETER une erreur "troncation: ..." si la sortie est
// incomplète ; cela force le repli vers le modèle/clé suivant au lieu d'accepter un résultat
// partiel. Utilisé pour le corps (vérification du nombre de sections H2).
async function callGemini(prompt, maxTokens, timeoutMs, { maxRetries = 3, validate = null } = {}) {
    let lastErr;
    for (const key of GEMINI_API_KEYS) {
        for (const model of GEMINI_MODELS) {
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const text = await callGeminiOnce(prompt, maxTokens, timeoutMs, model, key);
                    if (validate) validate(text); // jette si incomplet → catch → modèle suivant
                    if (key !== GEMINI_API_KEYS[0] || model !== GEMINI_MODELS[0])
                        console.error(`  (généré via ${model} / clé ${maskKey(key)})`);
                    return text;
                } catch (e) {
                    lastErr = e;
                    if (QUOTA.test(e.message)) {
                        console.error(`  Quota épuisé: ${model} / clé ${maskKey(key)} (429) — modèle suivant`);
                        break; // modèle suivant (même clé) ; clé suivante quand tous épuisés
                    }
                    if (INCOMPLETE.test(e.message)) {
                        console.error(`  Sortie incomplète: ${model} / clé ${maskKey(key)} (${e.message.slice(0, 40)}) — modèle suivant`);
                        break; // ne pas accepter un résultat tronqué — essayer un autre modèle
                    }
                    if (attempt === maxRetries || !RETRYABLE.test(e.message)) throw e;
                    const delay = Math.min(2000 * 2 ** attempt, 30000); // 2s,4s,8s (cap 30s)
                    console.error(`  Gemini transitoire ${model}/${maskKey(key)} (${e.message.slice(0, 50)}) — retry ${attempt + 1}/${maxRetries} dans ${delay / 1000}s`);
                    await sleep(delay);
                }
            }
        }
    }
    throw new Error(`Tous les modèles × clés Gemini épuisés/en échec (${GEMINI_MODELS.length} modèles × ${GEMINI_API_KEYS.length} clés). Dernière erreur: ${lastErr && lastErr.message}`);
}

function callGeminiOnce(prompt, maxTokens, timeoutMs, model, key) {
    const url = `${modelUrl(model)}?key=${key}`;

    const payload = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: maxTokens
        }
    });

    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const req = https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: timeoutMs
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Gemini API erreur ${res.statusCode}: ${data.slice(0, 500)}`));
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    const cand = json.candidates?.[0];
                    if (cand?.finishReason === 'MAX_TOKENS') {
                        reject(new Error(`erreur MAX_TOKENS: sortie tronquée (budget ${maxTokens} atteint)`));
                        return;
                    }
                    const text = cand?.content?.parts?.[0]?.text;
                    if (!text) throw new Error('Réponse Gemini vide');
                    resolve(text);
                } catch (e) {
                    reject(new Error(`Parse Gemini: ${e.message}`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout Gemini (${timeoutMs / 1000}s)`)); });
        req.write(payload);
        req.end();
    });
}

// === Frontmatter parsing ===

function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { raw: null, body: content, props: {}, lines: [] };

    const raw = match[1];
    const body = content.slice(match[0].length);
    const props = {};
    const lines = raw.split(/\r?\n/);

    let currentKey = null;
    let inArray = false;

    for (const line of lines) {
        const arrayItem = line.match(/^\s+-\s+(.*)/);
        if (arrayItem && currentKey && inArray) {
            if (!Array.isArray(props[currentKey])) props[currentKey] = [];
            props[currentKey].push(arrayItem[1].trim());
            continue;
        }

        const kv = line.match(/^([a-z_]+):\s*(.*)/);
        if (kv) {
            currentKey = kv[1];
            const val = kv[2].trim();
            if (val === '' || val === '[]') {
                props[currentKey] = [];
                inArray = true;
            } else {
                props[currentKey] = val.replace(/^["']|["']$/g, '');
                inArray = false;
            }
        }
    }

    return { raw, body, props, lines };
}

function formatValue(key, value) {
    if (Array.isArray(value)) {
        return `${key}:\n${value.map(t => `  - ${t}`).join('\n')}`;
    }
    if (typeof value === 'string' && (value.includes(':') || value.includes('"') || value.includes("'"))) {
        return `${key}: "${value.replace(/"/g, '\\"')}"`;
    }
    return `${key}: ${value}`;
}

// === Traduction du frontmatter ===

async function translateFrontmatter(props) {
    const toTranslate = {};
    for (const key of TRANSLATE_PROPS) {
        if (props[key] !== undefined && props[key] !== '') {
            toTranslate[key] = props[key];
        }
    }

    if (Object.keys(toTranslate).length === 0) return {};

    const prompt = `You are a professional French-to-English translator for blog articles.
Translate the following YAML frontmatter fields from French to English.

Rules:
- title: translate faithfully, keep it concise (60-70 chars). Keep any prefix like "I1)", "L6)", "M2)" exactly as-is. No commentary, just the translation
- subtitle: translate faithfully
- excerpt: translate faithfully, keep it 150-160 characters
- slug: create an English URL-friendly slug (lowercase, hyphens, no accents)
- tags: translate each tag to English (lowercase, hyphens for compound words)

Input (JSON):
${JSON.stringify(toTranslate, null, 2)}

Respond ONLY with valid JSON, no text before or after:
{
  "title": "...",
  "subtitle": "...",
  "excerpt": "...",
  "slug": "...",
  "tags": ["tag1", "tag2"]
}`;

    const response = await callGemini(prompt, 8192, 30000);

    let jsonStr = response.trim();
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '');
    jsonStr = jsonStr.replace(/\n?```\s*$/i, '');
    jsonStr = jsonStr.trim();

    return JSON.parse(jsonStr);
}

// === Traduction du corps ===

async function translateBody(body, expectedH2 = 0) {
    const prompt = `You are a professional French-to-English translator.
Translate the following Markdown article from French to English.

CRITICAL RULES:
- Translate EVERY paragraph, EVERY sentence, EVERY heading. Do NOT skip or summarize anything.
- The translation must be COMPLETE and EXACT - same structure, same number of sections, same level of detail.
- Keep all Markdown formatting intact (headings, bold, italic, links, code blocks, blockquotes, lists, Obsidian callouts like > [!type]).
- Keep Obsidian wikilinks syntax [[...]] but translate the display text after the pipe |
- Keep code examples unchanged (only translate comments if any).
- Keep URLs unchanged.
- Keep proper nouns unchanged (names, software names, etc.).
- Translate naturally, not word-for-word. The result should read like native English.
- If the text contains image embeds like ![[path|size]], keep them exactly as-is.
- Do NOT add any commentary, notes, translator's notes, or explanations. Output ONLY the translated article, nothing else.
- Do NOT convert simple blockquotes (> text) into Obsidian callouts (> [!type]). Keep blockquotes exactly as they are.

Article to translate:
${body}`;

    // Rejette toute traduction qui perd des sections (le modèle a sauté/résumé) → repli.
    return await callGemini(prompt, 32768, 180000, {
        validate: (text) => {
            const n = (text.match(/^## /gm) || []).length;
            if (expectedH2 > 0 && n < expectedH2) {
                throw new Error(`troncation: ${expectedH2} sections H2 attendues, ${n} obtenues`);
            }
        }
    });
}

// === Construction du fichier EN ===

function buildEnglishFile(originalRaw, translatedProps, translatedBody, originalProps) {
    const lines = originalRaw.split(/\r?\n/);
    const result = [];
    let langAdded = false;
    let i = 0;

    while (i < lines.length) {
        const kv = lines[i].match(/^([a-z_]+):\s*(.*)/);

        if (kv) {
            const key = kv[1];

            // Ajouter lang: en après type:
            if (key === 'type' && !langAdded) {
                result.push(lines[i]);
                result.push('lang: en');
                langAdded = true;
                i++;
                continue;
            }

            // Sauter les propriétés WordPress
            if (SKIP_PROPS.includes(key)) {
                i++;
                while (i < lines.length && /^\s+-\s+/.test(lines[i])) i++;
                continue;
            }

            // Remplacer les propriétés traduites
            if (TRANSLATE_PROPS.includes(key) && translatedProps[key] !== undefined) {
                // Sauter les lignes de l'ancienne valeur (y compris arrays)
                i++;
                while (i < lines.length && /^\s+-\s+/.test(lines[i])) i++;
                result.push(formatValue(key, translatedProps[key]));
                continue;
            }
        }

        result.push(lines[i]);
        i++;
    }

    // Si lang: en n'a pas été ajouté (pas de champ type:)
    if (!langAdded) {
        result.unshift('lang: en');
    }

    // Nettoyer le body traduit
    let cleanBody = translatedBody.trim();
    // Retirer les éventuels blocs code englobants
    cleanBody = cleanBody.replace(/^```(?:markdown)?\s*\n?/i, '');
    cleanBody = cleanBody.replace(/\n?```\s*$/i, '');

    // Forcer le format [[STEM|PREFIX]] pour les wikilinks d'articles
    cleanBody = cleanBody.replace(/\[\[([A-Z]\d+)_([^\]|]+)(?:\|[^\]]+)?\]\]/g,
        (match, prefix, rest) => `[[${prefix}_${rest}|${prefix}]]`);

    // Retirer les callouts ajoutés par Gemini (> [!note], > [!example], etc.)
    // Transforme "> [!type] text" en "> text" et "> [!type]\n" en ">\n"
    cleanBody = cleanBody.replace(/^(>\s*)\[!(?:note|info|example|tip|warning|abstract|quote|caution)\][-+]?\s*/gmi, '$1');

    return `---\n${result.join('\n')}\n---\n${cleanBody}\n`;
}

// === Main ===

async function main() {
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);
    const enDir = path.join(fileDir, '_en');
    const enPath = path.join(enDir, fileName);

    // Lire l'article
    const content = fs.readFileSync(filePath, 'utf-8');
    const { raw, body, props } = parseFrontmatter(content);

    if (!raw) {
        console.error('Pas de frontmatter trouvé dans le fichier.');
        process.exit(1);
    }

    console.log(`Traduction ${fileName}...`);

    // Préparer le body (sans dataviewjs/buttons/callout SPEC)
    let cleanBody = body.trim()
        .replace(/```dataviewjs[\s\S]*?```/g, '')
        .replace(/^`button-.*`$/gm, '');

    // Retirer le callout SPEC complet (header + toutes les lignes > qui suivent)
    const lines = cleanBody.split('\n');
    const filtered = [];
    let inSpec = false;
    for (const line of lines) {
        if (/^> \[!abstract\]-?\s*SPEC/.test(line)) {
            inSpec = true;
            continue;
        }
        if (inSpec) {
            if (/^>/.test(line)) continue;
            inSpec = false;
        }
        filtered.push(line);
    }
    cleanBody = filtered.join('\n');

    const h2CountOriginal = (cleanBody.match(/^## /gm) || []).length;

    // Traduire frontmatter + corps. translateBody jette si la traduction perd des sections
    // (repli automatique vers un autre modèle/clé ; abandon sans écraser si tous échouent).
    const translatedProps = await translateFrontmatter(props);
    const translatedBody = await translateBody(cleanBody, h2CountOriginal);

    // À ce stade la complétude est garantie ; garde-fou défensif.
    const h2CountTranslated = (translatedBody.match(/^## /gm) || []).length;

    // Récupérer les champs WordPress de l'ancien fichier EN s'il existe
    let preservedFields = {};
    if (fs.existsSync(enPath)) {
        const oldContent = fs.readFileSync(enPath, 'utf-8');
        const oldFm = parseFrontmatter(oldContent);
        for (const key of SKIP_PROPS) {
            if (oldFm.props[key]) preservedFields[key] = oldFm.props[key];
        }
        // Conserver aussi le slug EN existant s'il diffère du slug FR traduit
        if (oldFm.props['slug'] && !translatedProps['slug']) {
            preservedFields['slug'] = oldFm.props['slug'];
        }
    }

    // Écrire le fichier EN
    let enContent = buildEnglishFile(raw, translatedProps, translatedBody, props);

    // Réinjecter les champs WordPress préservés dans le frontmatter
    if (Object.keys(preservedFields).length > 0) {
        const fmMatch = enContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
            let fmText = fmMatch[1];
            for (const [key, value] of Object.entries(preservedFields)) {
                // N'ajouter que si absent du frontmatter actuel
                if (!new RegExp(`^${key}:`, 'm').test(fmText)) {
                    fmText += `\n${key}: ${value}`;
                }
            }
            enContent = `---\n${fmText}\n---` + enContent.slice(fmMatch[0].length);
        }
    }

    if (!fs.existsSync(enDir)) fs.mkdirSync(enDir, { recursive: true });
    fs.writeFileSync(enPath, enContent, 'utf-8');

    console.log(`Traduction _en/${fileName} (H2: ${h2CountOriginal}→${h2CountTranslated})`);
}

main().catch(e => {
    console.error(`❌ Erreur: ${e.message}`);
    process.exit(1);
});
