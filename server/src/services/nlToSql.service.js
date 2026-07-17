// Calls Groq's OpenAI-compatible chat completions endpoint (free tier
// available at console.groq.com) to translate a natural-language question
// into a single SQLite SELECT statement, grounded in the uploaded
// database's real schema. The raw model output is never trusted directly —
// it always passes through sqlSafety.service.js before execution.

const env = require('../config/env');
const AppError = require('../utils/AppError');

const SYSTEM_PROMPT = `You are a SQLite query generator. You are given a database schema and a
question in plain English. Respond with ONE single SQLite SELECT statement
that answers the question, and nothing else — no explanation, no markdown
fences, no semicolon-separated statements.

Rules:
- Only use tables and columns that appear in the schema.
- Never use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, PRAGMA, or any
  statement that is not a SELECT.
- Prefer explicit column lists over SELECT *.
- Use SQLite date functions (date(), datetime(), strftime()) for date logic.
- If the question cannot be answered with the given schema, respond with
  exactly: SELECT 'UNANSWERABLE' AS error;`;

async function generateSql(question, schemaText) {
  if (!env.groqApiKey) {
    throw new AppError(
      'The server is missing GROQ_API_KEY. Add a free key from console.groq.com to your .env file.',
      500,
      'MISSING_API_KEY'
    );
  }

  const userPrompt = `Schema:\n${schemaText}\n\nQuestion: ${question}\n\nSQL:`;

  let response;
  try {
    response = await fetch(env.groqApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.groqApiKey}`,
      },
      body: JSON.stringify({
        model: env.groqModel,
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
  } catch (err) {
    throw new AppError('Could not reach the AI provider. Check your network connection and try again.', 502, 'AI_UNREACHABLE');
  }

  if (!response.ok) {
    const body = await safeReadJson(response);
    const providerMessage = body?.error?.message || response.statusText;
    throw new AppError(`The AI provider returned an error: ${providerMessage}`, 502, 'AI_PROVIDER_ERROR');
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new AppError('The AI provider returned an empty response.', 502, 'AI_EMPTY_RESPONSE');
  }

  return content.trim();
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

module.exports = { generateSql };
