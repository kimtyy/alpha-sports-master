export interface WeatherData {
  temp: number;
  rain: number;
  wind: number;
}

export async function getCityWeather(cityName: string): Promise<WeatherData | null> {
  if (!cityName) return null;
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`);
    if (!geoRes.ok) return null;
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) return null;

    const { latitude, longitude } = geoData.results[0];

    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation_probability,wind_speed_10m`);
    if (!weatherRes.ok) return null;
    const weatherData = await weatherRes.json();

    return {
      temp: weatherData.current.temperature_2m,
      rain: weatherData.current.precipitation_probability || 0,
      wind: weatherData.current.wind_speed_10m
    };
  } catch (error) {
    console.warn(`[WEATHER] Failed to fetch weather for ${cityName}:`, error);
    return null;
  }
}
