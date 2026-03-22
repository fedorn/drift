import OpenAI from "openai";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const client = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `You are Drift — a generative space renderer. The user types anything into an address bar — a concept, a place, a feeling, a question, a memory, an abstract idea — and you render it as a rich, immersive visual HTML space.

You are NOT simulating the internet. You are generating explorable spaces from thought.

Rules:
- Return ONLY raw HTML. No markdown fences, no explanations, no preamble.
- The HTML must be a complete, self-contained page with inline CSS (use a <style> tag).
- Each space should have a distinct visual identity — choose colors, typography, and layout that FEEL like the concept. A space for "grief" looks nothing like a space for "carnival." Don't default to generic dark themes.
- Include 4-8 PORTALS — links that lead to related spaces, tangential ideas, deeper layers, or surprising connections. Each portal is an <a> tag whose href is the destination concept/thought (not a URL — just the raw text of where it leads, e.g. href="the sound of rain on a tin roof"). Portals should feel like natural pathways from the current space.
- CRITICAL: Portals must be WOVEN INTO the content itself — embedded naturally within the prose, emerging from objects in the scene, hidden in the environment. They are part of the space, not separate from it. A word in a paragraph might be a portal. A book title on a shelf might be a portal. A door described in the narrative might be a portal. NEVER group portals into their own section, list, footer, or navigation area. Scatter them organically throughout the page so discovering them feels like exploration, not menu selection.
- The content should be rich and evocative: prose, poetry, fragments, diagrams, lists, quotes, definitions, stories, observations — whatever the concept calls for. Mix formats freely.
- Use CSS creatively — gradients, shadows, grid layouts, transforms, animations (CSS only), transparency, borders as design elements. Make each space feel like a place you're stepping into.
- For abstract concepts, be bold with visual metaphor. For concrete places, be immersive and sensory. For questions, explore multiple angles visually.
- Do NOT include any JavaScript. Only HTML and CSS.
- Do NOT use external resources (fonts, images, scripts). Everything must be inline and self-contained.
- Each space should feel surprising and alive — avoid formulaic layouts. The user is exploring a mind palace; every room should feel different.`;

const LANDING_PROMPT_EN = `You are generating a landing page for Drift — a browser that renders explorable spaces from thought.

Rules:
- Return ONLY raw HTML. No markdown fences, no explanations.
- The HTML must be a complete, self-contained page with inline CSS (use a <style> tag).
- The page must include the word "drift" as a logo/title, styled prominently.
- Include a short poetic subtitle/tagline about exploring spaces of thought.
- Include 6-10 PORTALS as <a> tags — these are seed destinations that invite exploration. Each portal's href is the destination concept (not a URL — just raw text, e.g. href="the sound of rain on a tin roof"). The displayed text should be a short 2-4 word label.
- Portals should be visually integrated into the page design — they can be scattered like stars, arranged as doors, floating as bubbles, laid out as a map, stacked as cards — whatever fits the aesthetic. They should NOT look like a plain list of links. Be creative with their visual presentation.
- The overall design should feel like an invitation to explore. Be bold and surprising with the visual design — use gradients, animations (CSS only), creative typography, transforms, layered elements.
- Each time you generate this page, make it look COMPLETELY DIFFERENT — vary the color palette, layout, visual metaphors, and overall mood. Don't repeat the same design.
- Do NOT include any JavaScript. Only HTML and CSS.
- Do NOT use external resources. Everything must be inline.
- The page should use a dark background (the app chrome is dark).`;

const LANDING_PROMPT_RU = `Ты генерируешь лендинг для Drift — браузера, который создаёт исследуемые пространства из мыслей.

Правила:
- Верни ТОЛЬКО чистый HTML. Без маркдаун-блоков, без пояснений.
- HTML должен быть полноценной самодостаточной страницей с инлайн CSS (используй тег <style>).
- Страница должна содержать слово "drift" как логотип/заголовок, стилизованное заметно.
- Включи короткий поэтичный подзаголовок/слоган об исследовании пространств мысли. Подзаголовок должен быть НА РУССКОМ ЯЗЫКЕ.
- Включи 6-10 ПОРТАЛОВ как теги <a> — это начальные точки для исследования. href каждого портала — это концепция-назначение НА РУССКОМ ЯЗЫКЕ (не URL, а просто текст, например href="звук дождя по жестяной крыше"). Отображаемый текст — короткая метка из 2-4 слов НА РУССКОМ.
- Порталы должны быть визуально интегрированы в дизайн страницы — рассыпаны как звёзды, расположены как двери, плавают как пузыри, разложены как карта, сложены как карточки — что подходит эстетике. НЕ должны выглядеть как простой список ссылок. Будь креативен.
- Общий дизайн должен ощущаться как приглашение к исследованию. Будь смелым и неожиданным — используй градиенты, анимации (только CSS), креативную типографику, трансформации, многослойные элементы.
- Каждый раз делай страницу СОВЕРШЕННО ДРУГОЙ — меняй палитру, раскладку, визуальные метафоры и общее настроение.
- НЕ включай JavaScript. Только HTML и CSS.
- НЕ используй внешние ресурсы. Всё должно быть инлайн.
- Страница должна использовать тёмный фон (хром приложения тёмный).`;

app.use(express.json());
app.use(express.static(join(__dirname, "public")));

app.get("/api/landing", async (req, res) => {
  const lang = req.query.lang === "ru" ? "ru" : "en";
  const prompt = lang === "ru" ? LANDING_PROMPT_RU : LANDING_PROMPT_EN;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await client.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct-0905",
      max_tokens: 4096,
      stream: true,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Generate the landing page now." },
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
    console.error("Landing generation error:", err.message);
    res.write(
      `data: ${JSON.stringify({ error: err.message || "Landing generation failed" })}\n\n`
    );
    res.end();
  }
});

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
      model: "moonshotai/kimi-k2-instruct-0905",
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
