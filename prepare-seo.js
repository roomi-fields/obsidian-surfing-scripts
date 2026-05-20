#!/usr/bin/env node
/**
 * Prepare SEO - Génère les propriétés SEO d'un article via Gemini
 *
 * Propriétés générées : title, subtitle, excerpt, slug, focus_keyword, tags
 * (Les propriétés WordPress sont générées lors de la publication)
 *
 * Usage: node prepare-seo.js "D:\chemin\vers\article.md"
 *
 * Clé API Gemini détectée automatiquement depuis :
 *   1. Variable d'environnement GEMINI_API_KEY
 *   2. K:\therapie\atelier-ifs\config.yaml (gemini_api_key)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// === Configuration ===
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SEO_KEYS = ['title', 'subtitle', 'excerpt', 'slug', 'focus_keyword', 'tags'];

// Fichiers de config connus contenant la clé Gemini (Windows + WSL)
const CONFIG_PATHS = [
    path.join('K:', 'therapie', 'atelier-ifs', 'config.yaml'),
    '/home/romi/dev/therapie/atelier-ifs/config.yaml',
];

function findGeminiApiKey() {
    // 1. Variable d'environnement
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

    // 2. Fichiers de config connus
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
    console.error('Usage: node prepare-seo.js <fichier.md>');
    process.exit(1);
}

if (!fs.existsSync(filePath)) {
    console.error(`Fichier introuvable: ${filePath}`);
    process.exit(1);
}

// === Frontmatter parsing ===

function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { raw: null, body: content, props: {} };

    const raw = match[1];
    const body = content.slice(match[0].length);
    const props = {};

    let currentKey = null;
    let inArray = false;

    for (const line of raw.split(/\r?\n/)) {
        // Array item
        const arrayItem = line.match(/^\s+-\s+(.*)/);
        if (arrayItem && currentKey && inArray) {
            if (!Array.isArray(props[currentKey])) props[currentKey] = [];
            props[currentKey].push(arrayItem[1].trim());
            continue;
        }

        // Key-value
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

    return { raw, body, props };
}

// === Frontmatter update ===

function formatValue(key, value) {
    if (key === 'tags' && Array.isArray(value)) {
        return `tags:\n${value.map(t => `  - ${t}`).join('\n')}`;
    }
    if (typeof value === 'string' && (value.includes(':') || value.includes('"') || value.includes("'"))) {
        return `${key}: "${value.replace(/"/g, '\\"')}"`;
    }
    return `${key}: ${value}`;
}

function updateFrontmatter(content, seoProps) {
    const { raw, body } = parseFrontmatter(content);

    if (!raw) {
        // Pas de frontmatter existant : en créer un
        let fm = '---\ntype: article\n';
        for (const key of SEO_KEYS) {
            if (seoProps[key] !== undefined) {
                fm += formatValue(key, seoProps[key]) + '\n';
            }
        }
        fm += '---\n';
        return fm + content;
    }

    let lines = raw.split(/\r?\n/);
    let result = [];
    let handled = new Set();
    let i = 0;

    while (i < lines.length) {
        const kv = lines[i].match(/^([a-z_]+):\s*(.*)/);

        if (kv && SEO_KEYS.includes(kv[1]) && seoProps[kv[1]] !== undefined) {
            const key = kv[1];
            handled.add(key);

            // Skip existing value (including array lines)
            i++;
            while (i < lines.length && /^\s+-\s+/.test(lines[i])) {
                i++;
            }

            // Write new value
            result.push(formatValue(key, seoProps[key]));
        } else {
            result.push(lines[i]);
            i++;
        }
    }

    // Append missing SEO properties
    for (const key of SEO_KEYS) {
        if (seoProps[key] !== undefined && !handled.has(key)) {
            result.push(formatValue(key, seoProps[key]));
        }
    }

    return `---\n${result.join('\n')}\n---${body}`;
}

// === Gemini API ===

function buildPrompt(articleContent, existingProps) {
    const existing = SEO_KEYS
        .filter(k => existingProps[k] !== undefined && existingProps[k] !== '')
        .map(k => `  ${k}: ${JSON.stringify(existingProps[k])}`)
        .join('\n');

    return `Tu es un expert SEO pour des blogs WordPress francophones.
Analyse l'article ci-dessous et génère les propriétés SEO suivantes.

Propriétés attendues :
- subtitle : sous-titre accrocheur (une phrase, complète le titre)
- excerpt : meta description (150-160 caractères, contient le mot-clé, incite au clic)
- slug : identifiant URL (minuscules, tirets, sans accents, court et lisible)
- focus_keyword : mot-clé SEO principal (1-3 mots, minuscules)
- tags : 5-8 tags pertinents (minuscules, tirets pour les espaces composés)

${existing ? `Propriétés déjà présentes (améliore-les si nécessaire, sinon conserve) :\n${existing}\n` : ''}
IMPORTANT : Réponds UNIQUEMENT avec un bloc JSON valide, sans texte avant ni après :
{
  "subtitle": "...",
  "excerpt": "...",
  "slug": "...",
  "focus_keyword": "...",
  "tags": ["tag1", "tag2"]
}

Article :
---
${articleContent}`;
}

// Erreurs transitoires Google (surcharge 503 / quota 429 / serveur 500 / timeout) :
// on retente avec backoff exponentiel avant d'abandonner.
const RETRYABLE = /erreur (503|500|429)|Timeout Gemini/i;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callGemini(prompt, maxRetries = 4) {
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await callGeminiOnce(prompt);
        } catch (e) {
            lastErr = e;
            if (attempt === maxRetries || !RETRYABLE.test(e.message)) throw e;
            const delay = Math.min(2000 * 2 ** attempt, 30000);
            console.error(`  Gemini transitoire (${e.message.slice(0, 80)}) — retry ${attempt + 1}/${maxRetries} dans ${delay / 1000}s`);
            await sleep(delay);
        }
    }
    throw lastErr;
}

function callGeminiOnce(prompt) {
    const url = `${GEMINI_URL}?key=${GEMINI_API_KEY}`;

    const payload = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192
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
            timeout: 30000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Gemini API erreur ${res.statusCode}: ${data.slice(0, 300)}`));
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
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout Gemini (30s)')); });
        req.write(payload);
        req.end();
    });
}

// === Parse Gemini response ===

function parseSeoResponse(text) {
    // Extraire le JSON (avec ou sans bloc ```json)
    let jsonStr = text.trim();

    // Retirer les marqueurs de bloc code
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '');
    jsonStr = jsonStr.replace(/\n?```\s*$/i, '');
    jsonStr = jsonStr.trim();

    const seo = JSON.parse(jsonStr);

    // Validation minimale
    if (!seo.focus_keyword || !seo.tags) {
        throw new Error('Propriétés SEO incomplètes dans la réponse');
    }

    // Normaliser tags en array
    if (typeof seo.tags === 'string') {
        seo.tags = seo.tags.split(',').map(t => t.trim());
    }

    return seo;
}

// === Main ===

async function main() {
    const fileName = path.basename(filePath);

    // Lire l'article
    const content = fs.readFileSync(filePath, 'utf-8');
    const { props, body } = parseFrontmatter(content);

    // Extraire le titre H1 du corps de l'article
    const h1Match = body.match(/^# (.+)$/m);
    const h1Title = h1Match ? h1Match[1].trim() : null;

    // Préparer le contenu pour Gemini (body sans frontmatter)
    const articleText = body.trim()
        .replace(/```dataviewjs[\s\S]*?```/g, '')
        .replace(/^`button-.*`$/gm, '');

    // Appeler Gemini (génère tout sauf le title)
    const response = await callGemini(buildPrompt(articleText, props));

    // Debug: afficher la réponse brute si besoin
    if (process.env.DEBUG) {
        console.log('--- Réponse Gemini brute ---');
        console.log(response);
        console.log('--- Fin réponse ---');
    }

    // Parser la réponse et utiliser le H1 comme title
    const seoProps = parseSeoResponse(response);
    if (h1Title) seoProps.title = h1Title;

    // Mettre à jour le fichier
    const updated = updateFrontmatter(content, seoProps);
    fs.writeFileSync(filePath, updated, 'utf-8');

    console.log(`SEO ${fileName}: slug=${seoProps.slug}, kw=${seoProps.focus_keyword}, ${seoProps.tags.length} tags`);
}

main().catch(e => {
    console.error(`❌ Erreur: ${e.message}`);
    process.exit(1);
});
