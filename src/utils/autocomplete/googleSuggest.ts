/**
 * Google Suggest API를 사용하여 YouTube 검색 제안을 가져옵니다.
 */
export async function getGoogleSuggestions(query: string): Promise<string[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1_800);

    const response = await fetch(`http://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodedQuery}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    if (!response.ok) {
      return [];
    }

    const text = await response.text();
    const data = JSON.parse(text);

    // Google Suggest API 응답 형식: [query, [suggestions], [], {...}]
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].slice(0, 25); // Discord autocomplete는 최대 25개까지 지원
    }

    return [];
  } catch (error) {
    console.error('Failed to fetch Google suggestions:', error);
    return [];
  }
}
