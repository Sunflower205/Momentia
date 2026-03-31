export async function generateMoment(input: string) {
  const response = await fetch('/api/generate-moment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input })
  });
  if (!response.ok) throw new Error('Generation failed');
  return response.json();
}

export async function generateMBTIQuote(mbti: string) {
  const response = await fetch('/api/generate-mbti', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mbti })
  });
  if (!response.ok) throw new Error('Generation failed');
  return response.json();
}
