import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";

export async function createEmbeddings(
  texts: string[],
  openaiClient?: OpenAI
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!openaiClient && !apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = openaiClient ?? new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

export async function createEmbedding(
  text: string,
  openaiClient?: OpenAI
): Promise<number[]> {
  const [embedding] = await createEmbeddings([text], openaiClient);
  if (!embedding) {
    throw new Error("OpenAI returned an empty embedding");
  }
  return embedding;
}

