import OpenAI from "openai";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const client = new OpenAI({
  baseURL: "https://api.cerebras.ai/v1",
  apiKey: process.env.CEREBRAS_API_KEY,
});

const SYSTEM_PROMPT = `You are Drift — a generative space renderer. The user types anything into an address bar — a concept, a place, a feeling, a question, a memory, an abstract idea — and you render it as a rich, immersive visual HTML space.

You are NOT simulating the internet. You are generating explorable spaces from thought.

Rules:
- Return ONLY raw HTML. No markdown fences, no explanations, no preamble.
- The HTML must be a complete, self-contained page with inline CSS (use a <style> tag).
- Each space should have a distinct visual identity — choose colors, typography, and layout that FEEL like the concept. A space for "grief" looks nothing like a space for "carnival." Don't default to generic dark themes.
- Include 4-8 PORTALS — links that lead to related spaces, tangential ideas, deeper layers, or surprising connections. Each portal is an <a> tag whose href is the destination concept/thought (not a URL — just the raw text of where it leads, e.g. href="the sound of rain on a tin roof"). Portals should feel like natural pathways from the current space.
- Make portals visually integrated into the space — they can be doors, objects, glowing text, paths, signs, constellations, drawers, books on a shelf — whatever fits the space's aesthetic. They should NOT look like a generic list of links.
- The content should be rich and evocative: prose, poetry, fragments, diagrams, lists, quotes, definitions, stories, observations — whatever the concept calls for. Mix formats freely.
- Use CSS creatively — gradients, shadows, grid layouts, transforms, animations (CSS only), transparency, borders as design elements. Make each space feel like a place you're stepping into.
- For abstract concepts, be bold with visual metaphor. For concrete places, be immersive and sensory. For questions, explore multiple angles visually.
- Do NOT include any JavaScript. Only HTML and CSS.
- Do NOT use external resources (fonts, images, scripts). Everything must be inline and self-contained.
- Each space should feel surprising and alive — avoid formulaic layouts. The user is exploring a mind palace; every room should feel different.`;

app.use(express.json());
app.use(express.static(join(__dirname, "public")));

app.post("/api/navigate", async (req, res) => {
  const { destination, origin } = req.body;
  if (!destination)
    return res.status(400).json({ error: "Destination is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const userMessage = origin
      ? `I came from the space "${origin}" and now I want to enter: ${destination}`
      : `Generate the space for: ${destination}`;

    const stream = await client.chat.completions.create({
      model: "qwen-3-235b-a22b-instruct-2507",
      max_tokens: 4096,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) {
        res.write(`data: ${JSON.stringify({ html: text })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("LLM error:", err.message);
    res.write(
      `data: ${JSON.stringify({ error: err.message || "Generation failed" })}\n\n`
    );
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Drift running at http://localhost:${PORT}`);
});
