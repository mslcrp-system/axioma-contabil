import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Model selection - Using gemini-3-flash-preview
    const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

    const systemPrompt = `Você é um Consultor Sênior de M&A e Reestruturação Financeira analisando os números de um prospect. 
Seu objetivo é expor a falta de governança e gerar 'Fricção Construtiva' para vender a consultoria. 

Siga estas regras rigorosamente:
1. Analise os dados financeiros fornecidos (série histórica e drill-down de ofensores).
2. Escreva 3 alertas curtos e brutais. 
3. Cada alerta deve conter: 
   - title: Um Título de Risco impactante.
   - math_fact: A constatação matemática (cite os números e percentuais exatos e as contas ofensoras se relevante).
   - socratic_question: Uma pergunta difícil que o empresário não saberá responder sem a consultoria (focada em causa raiz e futuro).
   - severity: "alta" ou "media".

Retorne o resultado ESTRITAMENTE em formato JSON seguindo este esquema:
{ 
  "insights": [ 
    { 
      "title": "string", 
      "math_fact": "string", 
      "socratic_question": "string", 
      "severity": "alta" | "media" 
    } 
  ] 
}`;

    const prompt = `Aqui estão os dados financeiros consolidados:\n${JSON.stringify(data, null, 2)}`;

    const result = await model.generateContent([
        { text: systemPrompt },
        { text: prompt }
    ]);

    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    
    return NextResponse.json(JSON.parse(cleanJson));

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: "Falha ao gerar insights cognitivos" }, { status: 500 });
  }
}
