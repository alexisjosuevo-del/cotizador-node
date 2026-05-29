export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, catalogSample } = req.body;

    if (!prompt || !catalogSample) {
        return res.status(400).json({ error: 'Faltan parámetros' });
    }

    const sysPrompt = `Eres un cotizador experto. A partir del catálogo de productos que recibes, crea una lista de compra recomendada según lo pedido por el usuario.
Catálogo:
${catalogSample}

Regla vital: Responde ESTRICTAMENTE en formato JSON plano con la siguiente estructura:
[
  {"id": "AQUÍ_ID_DEL_PRODUCTO", "qty": AQUÍ_CANTIDAD_NUMERICA}
]
Nada de explicaciones. Si no encuentras, devuelve [].`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: sysPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Groq API Error Response:", errorData);
            return res.status(response.status).json({ error: 'Error del servicio LLM', details: errorData });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}
