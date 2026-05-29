export async function sendEvolutionMessage(phone: string, text: string) {
  const evolutionKey = process.env.EVOLUTION_API_KEY;
  // Based on common evolution api structure, using an assumed base URL. 
  // Let me ask or just use a generic one if I don't know the URL. Wait, the user didn't provide the Evolution API base URL.
  // I will use a placeholder or check if they provided it. 
  // Ah, I don't have the base URL. I'll ask or put a placeholder.
  const baseUrl = process.env.EVOLUTION_API_URL || 'https://sua-api-evolution.com';
  const instanceName = 'Performance Educacional';
  
  try {
    const res = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionKey || ''
      },
      body: JSON.stringify({
        number: phone,
        text: text
      })
    });
    
    return await res.json();
  } catch (error) {
    console.error('Error sending evolution message:', error);
    return null;
  }
}
