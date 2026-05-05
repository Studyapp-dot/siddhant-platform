import { createClient } from '@supabase/supabase-js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Creates a standalone Supabase client that does NOT depend on cookies.
 * This is critical because extraction runs fire-and-forget AFTER redirect(),
 * at which point the request context (and cookies()) is already gone.
 * 
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for writes.
 * Falls back to anon key (may fail writes if RLS is strict).
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

/**
 * Get the model from env, defaulting to gemini-2.5-flash.
 */
function getModel(): string {
  return process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash'
}

// The master prompt for extracting structured metadata from Indian law articles
function buildPrompt(title: string, content: string, nodeType: string): string {
  return `You are a legal metadata extractor for an Indian law education platform called Siddhant. Your job is to read a legal article written by a law student and extract structured metadata from it.

ARTICLE TITLE: ${title}
NODE TYPE: ${nodeType}
ARTICLE CONTENT:
${content}

---

Based on the article above, extract the following metadata as JSON. Only include fields where the information is CLEARLY present in the article text. Do NOT guess or hallucinate. If a field cannot be determined from the text, omit it.

EXTRACTION RULES:
1. NORMALIZE court names: "S.C.I.", "SC", "Supreme Court", "Hon'ble Supreme Court" → "Supreme Court of India"
2. NORMALIZE High Court names: "Bombay HC", "BHC" → "Bombay High Court"
3. CITATIONS should be in standard format: "AIR 1978 SC 597" or "(1973) 4 SCC 225"
4. DATES should be ISO format: "1978-01-25"
5. For essentials/ingredients, extract EACH element as a separate string in an array
6. For ratio_decidendi, extract the CORE legal principle in 1-2 sentences
7. For case_status: only use "good_law", "overruled", "partially_overruled", or "doubted"

RESPOND WITH ONLY A JSON OBJECT matching the node type:

${getSchemaForType(nodeType)}

Additionally, for ALL node types, include this field:
"suggested_edges": [
  { "target_title": "Name of related node", "relationship_type": "one of: interprets, establishes, codifies, prerequisite, distinguish_from, related_to, exception_to, governed_by, analogous_to, replaces, followed, applied, overruled, distinguished, explained, referred_to", "reason": "brief explanation" }
]

RESPOND WITH ONLY VALID JSON. No markdown, no explanation, no code blocks.`
}

function getSchemaForType(nodeType: string): string {
  switch (nodeType) {
    case 'section':
      return `{
  "section_number": "string (e.g. '103', '304A')",
  "bare_act_text": "string (exact statutory text if quoted in the article)",
  "essentials": ["string array — each ingredient/element of the offence or provision"],
  "punishment": "string (e.g. 'Death or life imprisonment, and fine')",
  "cognizable": true/false,
  "bailable": true/false,
  "compoundable": true/false,
  "parent_statute": "string (e.g. 'Bharatiya Nyaya Sanhita, 2023')",
  "enforcement_status": "in_force | repealed"
}`
    case 'constitutional_provision':
      return `{
  "article_number": "string (e.g. '14', '19(1)(a)', '21')",
  "bare_text": "string (exact constitutional text if quoted)",
  "part": "string (e.g. 'Part III — Fundamental Rights')",
  "amendment_details": "string (if related to a specific amendment)"
}`
    case 'judgment':
      return `{
  "case_name": "string (e.g. 'Maneka Gandhi v. Union of India')",
  "citations": ["string array of citations like 'AIR 1978 SC 597'"],
  "court": "string (normalized, e.g. 'Supreme Court of India')",
  "bench_type": "Single Judge | Division Bench | Full Bench | Constitution Bench",
  "bench_strength": number or null,
  "judges": ["string array of judge names if mentioned"],
  "date_of_judgment": "ISO date string or null",
  "ratio_decidendi": "string (core legal principle in 1-2 sentences)",
  "case_status": "good_law | overruled | partially_overruled | doubted",
  "significance": "string (why this case matters, 1 sentence)"
}`
    case 'doctrine':
      return `{
  "doctrine_name": "string (e.g. 'Doctrine of Basic Structure')",
  "origin_case": "string (case where doctrine was first established)",
  "applicable_domains": ["string array like 'constitutional', 'administrative'"],
  "key_elements": ["string array of core elements of the doctrine"],
  "current_status": "string (e.g. 'Well-established', 'Debated')"
}`
    case 'concept':
      return `{
  "concept_name": "string (e.g. 'Mens Rea')",
  "translation": "string (e.g. 'Guilty Mind')",
  "applicable_domains": ["string array like 'criminal', 'tort'"],
  "related_maxims": ["string array of related legal maxims"]
}`
    case 'statute':
      return `{
  "short_title": "string (e.g. 'BNS', 'IPC', 'CPC')",
  "full_title": "string",
  "act_number": "string (e.g. '45 of 2023')",
  "date_of_enactment": "ISO date string or null",
  "date_of_enforcement": "ISO date string or null",
  "legislative_list": "union | state | concurrent | residuary",
  "status": "in_force | repealed | partially_repealed",
  "replaces": "string (name of previous act it replaced, if any)"
}`
    case 'chapter':
      return `{
  "chapter_number": "string (e.g. 'VI', 'III', 'Part III')",
  "chapter_title": "string (e.g. 'Offences Affecting the Human Body')",
  "parent_statute": "string (e.g. 'Bharatiya Nyaya Sanhita, 2023')"
}`
    default: // topic
      return `{
  "key_themes": ["string array of main themes covered"],
  "related_statutes": ["string array of statutes mentioned"],
  "related_cases": ["string array of cases mentioned"]
}`
  }
}

/**
 * Extract metadata from a node's article content using AI.
 * Uses a standalone Supabase client (no cookies needed).
 * Designed to run fire-and-forget after redirect().
 */
export async function extractMetadata(nodeId: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('[extract-metadata] OPENROUTER_API_KEY not configured')
    return { success: false, error: 'OPENROUTER_API_KEY not configured' }
  }

  const model = getModel()

  try {
    const supabase = getSupabaseClient()

    // 1. Fetch the node and its latest revision
    const { data: node, error: nodeErr } = await supabase
      .from('nodes')
      .select('id, title, node_type')
      .eq('id', nodeId)
      .single()

    if (nodeErr || !node) {
      console.error('[extract-metadata] Node fetch failed:', nodeErr?.message)
      return { success: false, error: `Node not found: ${nodeErr?.message}` }
    }

    const { data: revision, error: revErr } = await supabase
      .from('revisions')
      .select('report_content')
      .eq('node_id', nodeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (revErr || !revision?.report_content) {
      console.error('[extract-metadata] Revision fetch failed:', revErr?.message)
      return { success: false, error: `No content found: ${revErr?.message}` }
    }

    const content = revision.report_content
    if (content.trim().length < 20) {
      return { success: false, error: 'Article content too short for extraction' }
    }

    const nodeType = node.node_type || 'topic'
    const prompt = buildPrompt(node.title, content, nodeType)

    console.log(`[extract-metadata] Starting extraction for node "${node.title}" (${nodeType}) using model ${model}`)

    // 2. Call OpenRouter
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://thesiddhant.in',
        'X-Title': 'Siddhant Legal Platform',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[extract-metadata] OpenRouter error: ${response.status}`, errText)
      return { success: false, error: `OpenRouter API error: ${response.status} — ${errText}` }
    }

    const data = await response.json()
    let rawOutput = data.choices?.[0]?.message?.content

    // Some models (StepFun, DeepSeek) put everything in "reasoning" and return content: null
    // when they run out of output tokens. Try to extract JSON from the reasoning field.
    if (!rawOutput) {
      const reasoning = data.choices?.[0]?.message?.reasoning
      if (reasoning && typeof reasoning === 'string') {
        // Try to find a JSON object in the reasoning text
        const jsonMatch = reasoning.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          rawOutput = jsonMatch[0]
          console.log('[extract-metadata] Extracted JSON from reasoning field')
        }
      }
    }

    if (!rawOutput) {
      const finishReason = data.choices?.[0]?.finish_reason || 'unknown'
      console.error(`[extract-metadata] Empty AI response (finish_reason: ${finishReason}). Model may need more tokens or doesn't support this task. Try changing OPENROUTER_MODEL in .env.local`)
      return { success: false, error: `Empty response from AI (finish_reason: ${finishReason}). Try a different model.` }
    }

    console.log('[extract-metadata] Raw AI output:', rawOutput.slice(0, 300))

    // 3. Parse JSON (handle markdown code blocks if AI wraps it)
    let cleaned = rawOutput.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    let extracted: Record<string, any>
    try {
      extracted = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[extract-metadata] JSON parse failed:', cleaned.slice(0, 500))
      return { success: false, error: `Failed to parse AI output as JSON` }
    }

    // 4. Separate suggested_edges from metadata
    const suggestedEdges = extracted.suggested_edges || []
    delete extracted.suggested_edges

    // 5. Mark metadata as AI-extracted with timestamp
    extracted._extracted_at = new Date().toISOString()
    extracted._extraction_model = model
    if (suggestedEdges.length > 0) {
      extracted._suggested_edges = suggestedEdges
    }

    // 6. Update the node's metadata
    const { error: updateError } = await supabase
      .from('nodes')
      .update({ metadata: extracted })
      .eq('id', nodeId)

    if (updateError) {
      console.error('[extract-metadata] Supabase update failed:', updateError.message)
      return { success: false, error: `Supabase update failed: ${updateError.message}` }
    }

    console.log(`[extract-metadata] ✓ Successfully extracted metadata for "${node.title}"`)
    return { success: true }
  } catch (err: any) {
    console.error('[extract-metadata] Unexpected error:', err)
    return { success: false, error: err.message || 'Unknown extraction error' }
  }
}
