import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { systemPrompt } from '@/lib/prompt';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEvolutionMessage } from '@/lib/evolution';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { sessionId, message } = await req.json();

    if (!sessionId || !message) {
      return NextResponse.json({ error: 'Missing sessionId or message' }, { status: 400 });
    }

    // 1. Fetch chat history
    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    // 2. Fetch session data
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.human_takeover) {
      return NextResponse.json({ text: '' }); // Do not reply with AI if human took over
    }

    // 3. Format history for Gemini
    const history = messages?.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })) || [];

    // Append the new message
    history.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // 4. Generate response with Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: systemPrompt });

    // Also tell Gemini to try to output a JSON block at the end if it collected the 4 info pieces.
    const extractionPrompt = `\nSe você já conseguiu extrair Nome, Telefone, E-mail e Profissão/Idade, adicione no final da sua resposta (e apenas quando tiver todos) um bloco JSON exatamente com o seguinte formato, não fale mais nada depois dele: \`\`\`json\n{"extracted": true, "nome": "...", "telefone": "...", "email": "...", "profissao": "..."}\n\`\`\``;

    history[history.length - 1].parts[0].text += extractionPrompt;

    const chat = model.startChat({
      history: history.slice(0, -1),
    });

    const result = await chat.sendMessage(message + extractionPrompt);
    let text = result.response.text();

    // 5. Check if JSON extraction is present
    let extractedData = null;
    const jsonMatch = text.match(/\`\`\`json\n({.*?})\n\`\`\`/s);
    if (jsonMatch) {
      try {
        extractedData = JSON.parse(jsonMatch[1]);
        // Remove the json block from the text sent to user
        text = text.replace(/\`\`\`json\n({.*?})\n\`\`\`/s, '').trim();
      } catch (e) {
        console.error('Failed to parse extracted JSON');
      }
    }

    // 6. Save AI message
    const { data: aiMessage, error: aiError } = await supabaseAdmin
      .from('messages')
      .insert({ session_id: sessionId, sender: 'ai', content: text })
      .select()
      .single();

    // 7. If extracted, update session and send Evolution message
    if (extractedData && extractedData.extracted && session.status !== 'qualified') {
      await supabaseAdmin
        .from('sessions')
        .update({
          name: extractedData.nome,
          phone: extractedData.telefone,
          email: extractedData.email,
          profession: extractedData.profissao,
          status: 'qualified'
        })
        .eq('id', sessionId);

      // Trigger evolution api
      await sendEvolutionMessage(
        extractedData.telefone, 
        \`Olá ${extractedData.nome}, aqui é a equipe da Performance Educacional! Vi que você estava conversando com nosso assistente virtual. Como podemos te ajudar agora a dar o próximo passo na sua carreira?\`
      );
    }

    return NextResponse.json({ text, messageId: aiMessage?.id });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
