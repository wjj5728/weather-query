import { NextRequest, NextResponse } from "next/server";

type GeoItem = {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
};

type WeatherDaily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
};

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city")?.trim();
  if (!city) {
    return NextResponse.json({ error: "缺少 city 参数" }, { status: 400 });
  }

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`,
      { cache: "no-store" }
    );
    if (!geoRes.ok) {
      return NextResponse.json({ error: "地理编码请求失败" }, { status: 502 });
    }

    const geoJson = (await geoRes.json()) as { results?: GeoItem[] };
    const hit = geoJson.results?.[0];
    if (!hit) {
      return NextResponse.json({ error: "未找到该城市" }, { status: 404 });
    }

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=Asia%2FShanghai`,
      { cache: "no-store" }
    );

    if (!weatherRes.ok) {
      return NextResponse.json({ error: "天气请求失败" }, { status: 502 });
    }

    const weatherJson = (await weatherRes.json()) as {
      current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
        apparent_temperature?: number;
        wind_speed_10m?: number;
        time?: string;
      };
      daily?: WeatherDaily;
    };

    const current = weatherJson.current;
    const daily = weatherJson.daily;

    const forecast = (daily?.time || []).map((date, idx) => ({
      date,
      max: daily?.temperature_2m_max?.[idx],
      min: daily?.temperature_2m_min?.[idx],
    }));

    return NextResponse.json({
      city: hit.name,
      country: hit.country ?? "",
      latitude: hit.latitude,
      longitude: hit.longitude,
      current: {
        temperature: current?.temperature_2m,
        humidity: current?.relative_humidity_2m,
        feelsLike: current?.apparent_temperature,
        windSpeed: current?.wind_speed_10m,
        time: current?.time,
      },
      forecast,
    });
  } catch {
    return NextResponse.json({ error: "服务异常" }, { status: 500 });
  }
}
