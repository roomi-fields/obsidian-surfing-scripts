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
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Propriétés frontmatter à ne PAS copier depuis la version FR
// (elles seront récupérées depuis l'ancien fichier EN s'il existe)
const SKIP_PROPS = ['wordpress_url', 'wordpress_id', 'wordpress_slug'];

// Propriétés frontmatter à traduire
const TRANSLATE_PROPS = ['title', 'subtitle', 'excerpt', 'tags', 'slug'];

// Fichiers de config connus contenant la clé Gemini (Windows + WSL)
const CONFIG_PATHS = [
    path.join('D:', 'Claude', 'atelier-ifs', 'config.yaml'),
    '/mnt/d/Claude/atelier-ifs/config.yaml',
];

function findGeminiApiKey() {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    for (const cfgPath of CONFIG_PATHS) {
        try {
            if (!fs.existsSync(cfgPath)) continue;
            const content = fs.readFileSync(cfgPath, 'utf-8');
            const match = content.match(/gemini_api_key:\s*["']?([^"'\s\r\n]+)["']?/);
            if (match) return match[1];
        } catch (e) { /* ignore */ }
    }
    return null;
}

const GEMINI_API_KEY = findGeminiApiKey();

// === Validation ===
if (!GEMINI_API_KEY) {
    console.error('Clé API Gemini introuvable. Vérifiez config.yaml ou définissez GEMINI_API_KEY.');
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

function callGemini(prompt, maxTokens, timeoutMs) {
    const url = `${GEMINI_URL}?key=${GEMINI_API_KEY}`;

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
                    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
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

async function translateBody(body) {
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

    return await callGemini(prompt, 32768, 180000);
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

    // Traduire frontmatter + corps
    const translatedProps = await translateFrontmatter(props);
    const translatedBody = await translateBody(cleanBody);

    // Vérification sections
    const h2CountTranslated = (translatedBody.match(/^## /gm) || []).length;
    if (h2CountOriginal > 0 && h2CountTranslated < h2CountOriginal) {
        console.log(`⚠️ H2: ${h2CountOriginal} → ${h2CountTranslated} (troncation possible)`);
    }

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
