async function testSSEBypass() {
  console.log('Testando SSE com header de bypass...');
  
  const sseRes = await fetch('http://localhost:3001/api/tools/ping/8.8.8.8', {
    headers: {
      'x-internal-secret': 'NETMONITOR_INTERNAL_BYPASS_2026'
    }
  });
  
  console.log('Status HTTP:', sseRes.status);
  
  if (!sseRes.ok) {
    const text = await sseRes.text();
    console.error('Erro HTTP:', text);
    return;
  }
  
  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  
  let chunksRead = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    console.log('[SSE CHUNK]', chunk.trim());
    chunksRead++;
    if (chunksRead >= 3) {
      console.log('✅ SUCESSO! 3 pacotes recebidos pela conexão mantida. Saindo.');
      process.exit(0);
    }
  }
}

testSSEBypass();
